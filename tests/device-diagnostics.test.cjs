const test = require('node:test');
const assert = require('node:assert/strict');
const createDiagnostics = require('../device-diagnostics.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function harness(navigator = {}, secureContext = true) {
  let nextTimer = 0;
  const timers = new Map();
  const updates = [];
  const diagnostics = createDiagnostics({
    navigator,
    secureContext,
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    onUpdate(service, result) { updates.push({ service, ...result }); }
  });
  return {
    diagnostics,
    updates,
    timers,
    result(service) { return updates.filter(update => update.service === service).at(-1); },
    expireNext() {
      assert.ok(timers.size, 'expected a pending watchdog timer');
      const [id, timer] = [...timers].sort((left, right) => left[1].delay - right[1].delay)[0];
      timers.delete(id);
      timer.callback();
    }
  };
}

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test('insecure contexts never call either device API and offer no misleading hardware result', () => {
  let calls = 0;
  const app = harness({
    bluetooth: {
      getAvailability() { calls++; return Promise.resolve(true); },
      requestDevice() { calls++; return Promise.resolve({}); }
    },
    geolocation: { getCurrentPosition() { calls++; } }
  }, false);
  app.diagnostics.init();
  app.diagnostics.testBluetooth();
  app.diagnostics.testGPS();
  assert.equal(calls, 0);
  assert.equal(app.timers.size, 0);
  for (const service of ['bluetooth', 'gps']) {
    assert.equal(app.result(service).state, 'unavailable');
    assert.equal(app.result(service).disabled, true);
    assert.equal(app.result(service).busy, false);
  }
});

test('missing APIs fail gracefully without starting device tests or watchdogs', () => {
  let availabilityCalls = 0;
  const app = harness({ bluetooth: { getAvailability() { availabilityCalls++; } } });
  app.diagnostics.init();
  app.diagnostics.testBluetooth();
  app.diagnostics.testGPS();
  assert.equal(availabilityCalls, 0, 'availability alone is not usable Web Bluetooth');
  assert.equal(app.timers.size, 0);
  for (const service of ['bluetooth', 'gps']) {
    assert.equal(app.result(service).state, 'unavailable');
    assert.equal(app.result(service).disabled, true);
  }
});

test('supported APIs without getAvailability stay untested until a user starts a test', () => {
  let calls = 0;
  const app = harness({
    bluetooth: { requestDevice() { calls++; } },
    geolocation: { getCurrentPosition() { calls++; } }
  });
  app.diagnostics.init();
  assert.equal(calls, 0, 'initialization must not open chooser or location permissions');
  for (const service of ['bluetooth', 'gps']) {
    assert.equal(app.result(service).state, 'untested');
    assert.equal(app.result(service).busy, false);
    assert.equal(app.result(service).disabled, false);
  }
});

test('getAvailability true and false produce completed capability results without requesting a device', async () => {
  for (const available of [true, false]) {
    let chooserCalls = 0;
    const app = harness({ bluetooth: {
      getAvailability() { return Promise.resolve(available); },
      requestDevice() { chooserCalls++; }
    } });
    app.diagnostics.init();
    assert.equal(app.result('bluetooth').busy, true);
    await settlePromises();
    assert.equal(app.result('bluetooth').state, available ? 'available' : 'unavailable');
    assert.equal(app.result('bluetooth').busy, false);
    assert.equal(app.result('bluetooth').disabled, false, 'user may still try the chooser');
    assert.equal(chooserCalls, 0);
    assert.equal(app.timers.size, 0);
  }
});

test('getAvailability rejection or synchronous failure remains inconclusive and retryable', async () => {
  const failure = new Error('adapter query failed');
  for (const getAvailability of [() => Promise.reject(failure), () => { throw failure; }]) {
    const app = harness({ bluetooth: { getAvailability, requestDevice() {} } });
    app.diagnostics.init();
    await settlePromises();
    assert.equal(app.result('bluetooth').state, 'untested');
    assert.equal(app.result('bluetooth').busy, false);
    assert.equal(app.result('bluetooth').disabled, false);
    assert.equal(app.timers.size, 0);
  }
});

test('Bluetooth chooser is requested in the click call stack and selection does not connect GATT', async () => {
  const request = deferred();
  const order = [];
  let requestOptions;
  let connections = 0;
  const app = harness({ bluetooth: {
    requestDevice(options) { order.push('requestDevice'); requestOptions = options; return request.promise; }
  } });
  app.diagnostics.testBluetooth();
  order.push('handler returned');
  assert.deepEqual(order, ['requestDevice', 'handler returned'], 'awaiting before the chooser can lose user activation');
  assert.deepEqual(requestOptions, { acceptAllDevices: true });
  assert.equal(app.result('bluetooth').state, 'pending');
  request.resolve({ name: 'Test peripheral', gatt: { connect() { connections++; } } });
  await settlePromises();
  assert.equal(app.result('bluetooth').state, 'available');
  assert.equal(app.result('bluetooth').busy, false);
  assert.equal(connections, 0);
  assert.equal(app.timers.size, 0);
});

test('Bluetooth cancellation is inconclusive while browser permission denial is unavailable', async () => {
  for (const [name, expectedState] of [
    ['NotFoundError', 'untested'],
    ['NotAllowedError', 'unavailable'],
    ['SecurityError', 'unavailable']
  ]) {
    const app = harness({ bluetooth: { requestDevice() { return Promise.reject({ name }); } } });
    app.diagnostics.testBluetooth();
    await settlePromises();
    assert.equal(app.result('bluetooth').state, expectedState, name);
    assert.equal(app.result('bluetooth').busy, false);
    assert.equal(app.result('bluetooth').disabled, false);
    assert.equal(app.timers.size, 0);
  }
});

test('synchronous Bluetooth permission failure is handled like a rejected chooser', () => {
  const app = harness({ bluetooth: { requestDevice() { throw { name: 'SecurityError' }; } } });
  assert.doesNotThrow(() => app.diagnostics.testBluetooth());
  assert.equal(app.result('bluetooth').state, 'unavailable');
  assert.equal(app.result('bluetooth').busy, false);
  assert.equal(app.timers.size, 0);
});

test('GPS only becomes available after a real success callback and never reports coordinates', () => {
  let succeed;
  let positionOptions;
  const app = harness({ geolocation: {
    getCurrentPosition(success, failure, options) { succeed = success; positionOptions = options; }
  } });
  app.diagnostics.init();
  assert.equal(app.result('gps').state, 'untested');
  app.diagnostics.testGPS();
  assert.equal(app.result('gps').state, 'pending');
  assert.equal(app.result('gps').busy, true);
  assert.equal(positionOptions.enableHighAccuracy, true);
  assert.equal(positionOptions.maximumAge, 0, 'the diagnostic should request a fresh reading');
  assert.ok(positionOptions.timeout > 0 && positionOptions.timeout <= 20000, 'native acquisition must have a finite time limit');
  const latitude = 52.23123456;
  const longitude = 21.00123456;
  succeed({ coords: { latitude, longitude, accuracy: 12.6 }, timestamp: 1795183200000 });
  assert.equal(app.result('gps').state, 'available');
  assert.equal(app.result('gps').busy, false);
  assert.equal(app.timers.size, 0);
  const reported = JSON.stringify(app.updates);
  assert.equal(reported.includes(String(latitude)), false);
  assert.equal(reported.includes(String(longitude)), false);
  assert.equal(reported.includes('latitude'), false);
  assert.equal(reported.includes('longitude'), false);
});

test('GPS denial, unavailable position and native timeout finish the test without exposing raw errors', () => {
  for (const code of [1, 2, 3]) {
    let fail;
    const app = harness({ geolocation: { getCurrentPosition(success, failure) { fail = failure; } } });
    app.diagnostics.testGPS();
    fail({ code, message: 'sensitive internal debug details' });
    assert.equal(app.result('gps').state, 'unavailable', `error ${code}`);
    assert.equal(app.result('gps').busy, false);
    assert.equal(app.result('gps').disabled, false);
    assert.equal(app.timers.size, 0);
    assert.equal(JSON.stringify(app.updates).includes('sensitive internal debug details'), false);
  }
});

test('GPS watchdog unlocks retry and late callbacks cannot overwrite the new attempt', () => {
  const attempts = [];
  const app = harness({ geolocation: {
    getCurrentPosition(success, failure) { attempts.push({ success, failure }); }
  } });
  app.diagnostics.testGPS();
  app.expireNext();
  assert.equal(app.result('gps').state, 'untested', 'unanswered permission is not a hardware failure');
  assert.equal(app.result('gps').busy, false);
  app.diagnostics.testGPS();
  assert.equal(attempts.length, 2);
  const updatesBeforeLateCallbacks = app.updates.length;
  attempts[0].success({ coords: { accuracy: 3 } });
  attempts[0].failure({ code: 1 });
  assert.equal(app.updates.length, updatesBeforeLateCallbacks);
  assert.equal(app.result('gps').state, 'pending');
  attempts[1].success({ coords: { accuracy: 4 } });
  assert.equal(app.result('gps').state, 'available');
  assert.equal(app.result('gps').busy, false);
  assert.equal(app.timers.size, 0);
});

test('Bluetooth watchdog ignores a stale chooser result after the user retries', async () => {
  const attempts = [deferred(), deferred()];
  let call = 0;
  const app = harness({ bluetooth: { requestDevice() { return attempts[call++].promise; } } });
  app.diagnostics.testBluetooth();
  app.expireNext();
  assert.equal(app.result('bluetooth').state, 'untested');
  app.diagnostics.testBluetooth();
  const updatesBeforeLateResponse = app.updates.length;
  attempts[0].resolve({});
  await settlePromises();
  assert.equal(app.updates.length, updatesBeforeLateResponse);
  assert.equal(app.result('bluetooth').state, 'pending');
  attempts[1].reject({ name: 'NotFoundError' });
  await settlePromises();
  assert.equal(app.result('bluetooth').state, 'untested');
  assert.equal(app.result('bluetooth').busy, false);
  assert.equal(app.timers.size, 0);
});
