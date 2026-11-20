(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    var createDiagnostics = factory();
    var buttons = { bluetooth: document.getElementById('bluetooth-test'), gps: document.getElementById('gps-test') };
    var diagnostics = createDiagnostics({
      navigator: root.navigator,
      secureContext: root.isSecureContext === true || (typeof root.isSecureContext === 'undefined' && root.location.protocol === 'https:'),
      setTimeout: root.setTimeout.bind(root),
      clearTimeout: root.clearTimeout.bind(root),
      onUpdate: function (service, result) {
        document.getElementById(service + '-diagnostic').setAttribute('data-state', result.state);
        document.getElementById(service + '-status').textContent = result.label;
        document.getElementById(service + '-detail').textContent = result.detail;
        buttons[service].disabled = result.disabled || result.busy;
        buttons[service].setAttribute('aria-busy', String(result.busy));
      }
    });
    // Keep requestDevice in the actual click stack: Bluetooth requires user activation.
    buttons.bluetooth.addEventListener('click', diagnostics.testBluetooth);
    buttons.gps.addEventListener('click', diagnostics.testGPS);
    diagnostics.init();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  return function createDiagnostics(options) {
    var nav = options.navigator;
    var serial = { bluetooth: 0, gps: 0 };
    var timers = {};

    function report(service, state, label, detail, busy, disabled) {
      options.onUpdate(service, { state: state, label: label, detail: detail, busy: Boolean(busy), disabled: Boolean(disabled) });
    }

    function supported(service) {
      if (!options.secureContext) {
        report(service, 'unavailable', 'Niedostępny', 'Wymagane poprawne HTTPS. Przez HTTP test nie oceni możliwości samochodu.', false, true);
        return false;
      }
      var present = service === 'bluetooth' ? nav.bluetooth && typeof nav.bluetooth.requestDevice === 'function' : nav.geolocation && typeof nav.geolocation.getCurrentPosition === 'function';
      if (!present) {
        report(service, 'unavailable', 'Niedostępny', service === 'bluetooth' ? 'Przeglądarka nie udostępnia Web Bluetooth LE.' : 'Przeglądarka nie udostępnia API lokalizacji.', false, true);
        return false;
      }
      return true;
    }

    function begin(service, label, detail) {
      var id = ++serial[service];
      options.clearTimeout(timers[service]);
      report(service, 'pending', label, detail, true);
      timers[service] = options.setTimeout(function () {
        if (serial[service] !== id) return;
        serial[service] += 1;
        report(service, 'untested', 'Brak odpowiedzi', 'Sprawdź okno zgody lub wyboru urządzenia i ponów test. Dostęp nie został potwierdzony.');
      }, 25000);
      return id;
    }

    function finish(service, id, state, label, detail) {
      if (serial[service] !== id) return;
      options.clearTimeout(timers[service]);
      report(service, state, label, detail);
    }

    function bluetoothError(id, error) {
      var name = error && error.name;
      if (name === 'NotFoundError') {
        finish('bluetooth', id, 'untested', 'Nie potwierdzono', 'Nie wybrano urządzenia lub nie znaleziono urządzeń BLE. Możesz ponowić test.');
      } else if (name === 'SecurityError' || name === 'NotAllowedError') {
        finish('bluetooth', id, 'unavailable', 'Niedostępny', 'Dostęp do Bluetooth jest zablokowany przez uprawnienia lub ustawienia przeglądarki.');
      } else {
        finish('bluetooth', id, 'unavailable', 'Test nieudany', 'Przeglądarka nie uzyskała dostępu do Bluetooth. Sprawdź ustawienia i ponów test.');
      }
    }

    function testBluetooth() {
      if (!supported('bluetooth')) return;
      var id = begin('bluetooth', 'Wybierz urządzenie…', 'Zezwól na dostęp i wybierz urządzenie Bluetooth LE w oknie przeglądarki.');
      try {
        // Select a BLE device only; do not connect, pair or read/write any GATT services.
        nav.bluetooth.requestDevice({ acceptAllDevices: true }).then(function () {
          finish('bluetooth', id, 'available', 'Dostępny', 'Udało się wybrać urządzenie Bluetooth LE. Test nie sprawdza połączenia audio.');
        }, function (error) { bluetoothError(id, error); });
      } catch (error) { bluetoothError(id, error); }
    }

    function gpsError(id, error) {
      var code = error && error.code;
      var detail = code === 1 ? 'Brak zgody na lokalizację. Sprawdź uprawnienia strony i systemu samochodu.' : code === 3 ? 'Nie udało się ustalić pozycji w 15 sekund. Ponów test, gdy sygnał będzie dostępny.' : 'Przeglądarka nie mogła ustalić pozycji. API może być dostępne mimo braku odczytu.';
      finish('gps', id, 'unavailable', 'Niedostępny', detail);
    }

    function testGPS() {
      if (!supported('gps')) return;
      var id = begin('gps', 'Sprawdzanie…', 'Zezwól przeglądarce na lokalizację. Czekam na odczyt pozycji.');
      try {
        nav.geolocation.getCurrentPosition(function (position) {
          var accuracy = position && position.coords && position.coords.accuracy;
          var detail = 'Uzyskano lokalizację przeglądarki';
          if (typeof accuracy === 'number' && isFinite(accuracy) && accuracy >= 0) detail += ' (dokładność ±' + Math.round(accuracy) + ' m)';
          // No coordinates leave this callback or enter storage, logs or a network request.
          finish('gps', id, 'available', 'Dostępny', detail + '. Źródłem może być GPS lub sieć.');
        }, function (error) { gpsError(id, error); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      } catch (error) { gpsError(id, error); }
    }

    function init() {
      if (supported('gps')) report('gps', 'untested', 'Do sprawdzenia', 'Kliknij „Sprawdź GPS” i zezwól na lokalizację w przeglądarce.');
      if (!supported('bluetooth')) return;
      if (typeof nav.bluetooth.getAvailability !== 'function') {
        report('bluetooth', 'untested', 'Do sprawdzenia', 'API Bluetooth LE istnieje. Kliknij test, aby sprawdzić dostęp do urządzeń.');
        return;
      }
      var id = begin('bluetooth', 'Sprawdzanie…', 'Sprawdzam dostępność Web Bluetooth w przeglądarce.');
      try {
        nav.bluetooth.getAvailability().then(function (available) {
          finish('bluetooth', id, available ? 'available' : 'unavailable', available ? 'API dostępne' : 'Niedostępny', available ? 'Web Bluetooth LE jest dostępny. Kliknij test, aby wybrać urządzenie.' : 'Przeglądarka zgłasza brak dostępu do Bluetooth. Sprawdź ustawienia i uprawnienia.');
        }, function () {
          finish('bluetooth', id, 'untested', 'Do sprawdzenia', 'Nie udało się odczytać dostępności. Kliknij test, aby spróbować wybrać urządzenie.');
        });
      } catch (error) {
        finish('bluetooth', id, 'untested', 'Do sprawdzenia', 'Nie udało się odczytać dostępności. Kliknij test, aby spróbować wybrać urządzenie.');
      }
    }

    return { init: init, testBluetooth: testBluetooth, testGPS: testGPS };
  };
}));
