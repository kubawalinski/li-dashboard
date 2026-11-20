(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    var display = factory();
    var storageKey = 'li-dashboard:display-scale:v1';
    var select = document.getElementById('ui-scale');
    var html = document.documentElement;
    var canZoom = 'zoom' in html.style;
    var choice = 'auto';
    var queued = false;
    try { choice = display.normalizeChoice(root.localStorage.getItem(storageKey)); } catch (error) { /* Auto also works without storage. */ }

    function apply() {
      queued = false;
      // innerWidth remains independent of CSS element zoom. clientWidth would create feedback.
      var result = display.resolveDisplay(root.innerWidth, root.innerHeight, canZoom ? choice : '100');
      if (canZoom && html.style.zoom !== String(result.scale)) html.style.zoom = String(result.scale);
      html.style.setProperty('--ui-scale', String(result.scale));
      html.style.setProperty('--ui-viewport-height', result.height + 'px');
      html.setAttribute('data-ui-scale', String(Math.round(result.scale * 100)));
      ['small', 'stacked', 'phone', 'diagnostics-stacked'].forEach(function (layout) {
        if (result[layout]) html.setAttribute('data-ui-' + layout, '');
        else html.removeAttribute('data-ui-' + layout);
      });
      select.value = result.choice;
      select.options[0].textContent = 'Auto (' + Math.round(result.autoScale * 100) + '%)';
      Array.prototype.forEach.call(select.options, function (option) {
        option.disabled = option.value !== 'auto' && result.viewportWidth / (Number(option.value) / 100) < 360;
      });
      select.disabled = !canZoom;
      if (!canZoom) select.title = 'Ta przeglądarka obsługuje tylko rozmiar 100%.';
    }

    function schedule() {
      if (queued) return;
      queued = true;
      (root.requestAnimationFrame || root.setTimeout)(apply);
    }

    select.addEventListener('change', function () {
      choice = display.normalizeChoice(select.value);
      try { root.localStorage.setItem(storageKey, choice); } catch (error) { /* Apply the choice for this visit. */ }
      apply();
    });
    root.addEventListener('resize', schedule);
    root.addEventListener('orientationchange', schedule);
    root.addEventListener('pageshow', schedule);
    document.addEventListener('fullscreenchange', schedule);
    document.addEventListener('webkitfullscreenchange', schedule);
    apply();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var choices = ['auto', '100', '125', '150', '175', '200', '250'];
  function normalizeChoice(value) { return choices.indexOf(value) >= 0 ? value : 'auto'; }
  function resolveDisplay(width, height, value) {
    width = typeof width === 'number' && isFinite(width) && width > 0 ? width : 1440;
    height = typeof height === 'number' && isFinite(height) && height > 0 ? height : 900;
    var autoScale = Math.round(Math.max(1, Math.min(2.5, width / 1440)) * 1000) / 1000;
    var choice = normalizeChoice(value);
    var scale = choice === 'auto' ? autoScale : Number(choice) / 100;
    // Keep the selector and the minimum native player width usable on narrow screens.
    if (width / scale < 360) { choice = 'auto'; scale = autoScale; }
    var effectiveWidth = width / scale;
    return {
      choice: choice, scale: scale, autoScale: autoScale,
      viewportWidth: width, width: effectiveWidth, height: height / scale,
      small: effectiveWidth <= 1150, stacked: effectiveWidth <= 920,
      phone: effectiveWidth <= 620, 'diagnostics-stacked': effectiveWidth <= 1050
    };
  }
  return { normalizeChoice: normalizeChoice, resolveDisplay: resolveDisplay };
}));
