(function () {
  'use strict';

  var STORAGE_KEY = 'li-dashboard:v1';
  var services = ['spotify', 'youtube'];
  var names = { spotify: 'Spotify', youtube: 'YouTube' };
  var samples = {
    spotify: { url: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6' },
    youtube: { url: 'https://www.youtube.com/playlist?list=PL1B627337ED6F55F0' }
  };
  var settings = { theme: 'dark', spotify: null, youtube: null };
  var stopped = { spotify: false, youtube: false };
  var editing = null;
  var returnFocus = null;
  var modal = document.getElementById('playlist-modal');
  var urlInput = document.getElementById('playlist-url');
  var titleRequests = { spotify: 0, youtube: 0 };
  var errorMessage = document.getElementById('playlist-error');
  var main = document.getElementById('main');
  var topbar = document.querySelector('.topbar');

  function parse(service, value) {
    return service === 'spotify' ? window.LiPlaylistLinks.parseSpotifyPlaylist(value) : window.LiPlaylistLinks.parseYouTubePlaylist(value);
  }

  function announce(message) {
    document.getElementById('announcement').textContent = message;
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      document.getElementById('storage-message').hidden = true;
    } catch (error) {
      document.getElementById('storage-message').hidden = false;
    }
  }

  function readSettings() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return;
      settings.theme = saved.theme === 'light' ? 'light' : 'dark';
      services.forEach(function (service) {
        var record = saved[service];
        var playlist = record && typeof record === 'object' && parse(service, record.url);
        if (playlist) {
          // Ignore the old manually entered name; only cache titles fetched from the provider.
          settings[service] = { url: playlist.url, title: typeof record.title === 'string' ? record.title.slice(0, 200) : '' };
        }
      });
    } catch (error) {
      // Invalid or unavailable storage must never prevent the clock or links from working.
      document.getElementById('storage-message').hidden = false;
    }
  }

  function updatePlaylistLabel(service, title) {
    var label = document.getElementById(service + '-label');
    label.textContent = title;
    label.title = title;
  }

  function loadPlaylistTitle(service) {
    var record = settings[service];
    var requestNumber = ++titleRequests[service];
    if (!record) return;
    var url = record.url;
    var fallback = record.title || 'Playlista ' + names[service];
    if (!window.fetch) { updatePlaylistLabel(service, fallback); return; }
    updatePlaylistLabel(service, record.title || 'Pobieranie nazwy…');
    var endpoint = service === 'spotify' ? 'https://open.spotify.com/oembed?url=' : 'https://www.youtube.com/oembed?format=json&url=';
    var controller = window.AbortController ? new window.AbortController() : null;
    var options = { credentials: 'omit' };
    if (controller) options.signal = controller.signal;
    var expired = false;
    function isCurrent() {
      return !expired && titleRequests[service] === requestNumber && settings[service] && settings[service].url === url;
    }
    var timeout = window.setTimeout(function () {
      if (isCurrent()) updatePlaylistLabel(service, fallback);
      expired = true;
      if (controller) controller.abort();
    }, 8000);
    // Only the provider's plain-text title is used, never oEmbed HTML or thumbnail URLs.
    window.fetch(endpoint + encodeURIComponent(url), options)
      .then(function (response) {
        if (!response.ok) throw new Error('Playlist metadata unavailable');
        return response.json();
      })
      .then(function (data) {
        window.clearTimeout(timeout);
        if (!isCurrent()) return;
        var title = data && typeof data.title === 'string' ? data.title.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
        if (!title) { updatePlaylistLabel(service, fallback); return; }
        settings[service].title = title;
        updatePlaylistLabel(service, title);
        saveSettings();
      }, function () {
        window.clearTimeout(timeout);
        if (isCurrent()) updatePlaylistLabel(service, fallback);
      });
  }

  function renderPlayer(service, reload) {
    var record = settings[service];
    var playlist = record && parse(service, record.url);
    var frame = document.getElementById(service + '-player');
    var placeholder = document.getElementById(service + '-placeholder');
    var actionButton = placeholder.querySelector('[data-edit]');
    var sampleButton = placeholder.querySelector('[data-sample]');
    var stopButton = document.querySelector('[data-stop="' + service + '"]');
    updatePlaylistLabel(service, record ? (record.title || 'Playlista ' + names[service]) : 'Twoja playlista');
    document.getElementById(service + '-player-tools').hidden = !playlist;
    stopButton.textContent = stopped[service] ? 'Otwórz ponownie' : 'Zatrzymaj';
    if (playlist && !stopped[service]) {
      document.getElementById(service + '-player-area').classList.add('is-loaded');
      placeholder.hidden = true;
      frame.hidden = false;
      if (reload || frame.getAttribute('src') !== playlist.embedUrl) frame.src = playlist.embedUrl;
      return;
    }
    // Unloading the cross-origin frame reliably stops playback without requiring an API token.
    frame.removeAttribute('src');
    document.getElementById(service + '-player-area').classList.remove('is-loaded');
    frame.hidden = true;
    placeholder.hidden = false;
    sampleButton.hidden = Boolean(playlist);
    if (playlist) {
      placeholder.querySelector('h4').textContent = 'Chwila ciszy.';
      placeholder.querySelector('p').textContent = 'Twoja playlista czeka. Otwórz odtwarzacz ponownie, kiedy chcesz.';
      actionButton.textContent = 'Otwórz odtwarzacz';
    } else {
      placeholder.querySelector('h4').textContent = service === 'spotify' ? 'Włącz swój rytm.' : 'Co dziś oglądamy?';
      placeholder.querySelector('p').textContent = service === 'spotify' ? 'Dodaj publiczną playlistę Spotify i słuchaj bezpośrednio tutaj.' : 'Koncerty, teledyski, ulubione serie. Jedna playlista, wiele możliwości.';
      actionButton.textContent = 'Dodaj playlistę';
    }
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    var label = settings.theme === 'dark' ? 'Jasny wygląd' : 'Ciemny wygląd';
    document.getElementById('theme-label').textContent = label;
    document.getElementById('theme-toggle').setAttribute('aria-label', 'Włącz ' + label.toLowerCase());
    document.querySelector('meta[name="theme-color"]').setAttribute('content', settings.theme === 'dark' ? '#111617' : '#eef2ef');
  }

  function updateClock() {
    var now = new Date();
    var hours = now.getHours();
    var time = String(hours).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var clock = document.getElementById('clock');
    // Only announce a time when focused; no live region that interrupts playback every minute.
    clock.textContent = time;
    clock.setAttribute('datetime', time);
    clock.setAttribute('aria-label', 'Bieżąca godzina: ' + time);
    document.getElementById('date').textContent = now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('greeting').textContent = hours >= 5 && hours < 18 ? 'Dzień dobry.' : 'Dobry wieczór.';
  }

  function clearError() {
    errorMessage.hidden = true;
    errorMessage.textContent = '';
    urlInput.removeAttribute('aria-invalid');
  }

  function openEditor(service, trigger) {
    editing = service;
    returnFocus = trigger || document.activeElement;
    var record = settings[service];
    document.getElementById('modal-service').textContent = names[service].toUpperCase();
    document.getElementById('modal-title').textContent = 'Twoja playlista ' + names[service];
    document.getElementById('modal-description').textContent = service === 'spotify' ? 'Wklej link do publicznej playlisty Spotify.' : 'Wklej link do playlisty YouTube: publicznej lub niepublicznej dostępnej przez link.';
    urlInput.placeholder = service === 'spotify' ? 'https://open.spotify.com/playlist/…' : 'https://www.youtube.com/playlist?list=…';
    urlInput.value = record ? record.url : '';
    document.getElementById('remove-playlist').hidden = !record;
    clearError();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    // inert is a progressive enhancement; the keyboard trap below supports older browsers.
    main.setAttribute('inert', '');
    topbar.setAttribute('inert', '');
    main.setAttribute('aria-hidden', 'true');
    topbar.setAttribute('aria-hidden', 'true');
    urlInput.focus();
  }

  function closeEditor() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    main.removeAttribute('inert');
    topbar.removeAttribute('inert');
    main.removeAttribute('aria-hidden');
    topbar.removeAttribute('aria-hidden');
    editing = null;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }

  document.querySelectorAll('[data-edit]').forEach(function (button) {
    button.addEventListener('click', function () {
      var service = button.getAttribute('data-edit');
      if (button.closest('.player-placeholder') && settings[service] && stopped[service]) {
        stopped[service] = false;
        renderPlayer(service);
        document.querySelector('[data-stop="' + service + '"]').focus();
      } else openEditor(service, button);
    });
  });

  document.getElementById('playlist-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!editing) return;
    var playlist = parse(editing, urlInput.value);
    if (!playlist) {
      errorMessage.textContent = editing === 'spotify' ? 'Wklej pełny link do playlisty, np. https://open.spotify.com/playlist/… . Link do utworu lub profilu nie jest playlistą.' : 'Wklej link do playlisty z parametrem list=… . Automatyczne miksy, „Do obejrzenia” i „Polubione” nie są obsługiwane.';
      errorMessage.hidden = false;
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return;
    }
    var service = editing;
    settings[service] = { url: playlist.url, title: '' };
    stopped[service] = false;
    saveSettings();
    renderPlayer(service);
    loadPlaylistTitle(service);
    closeEditor();
    // The empty-state add button has just been hidden; focus the persistent edit control.
    document.querySelector('.card-heading [data-edit="' + service + '"]').focus();
    announce('Zapisano playlistę ' + names[service] + '.');
  });

  urlInput.addEventListener('input', clearError);
  document.getElementById('modal-close').addEventListener('click', closeEditor);
  document.getElementById('modal-cancel').addEventListener('click', closeEditor);
  modal.addEventListener('click', function (event) { if (event.target === modal) closeEditor(); });
  document.getElementById('remove-playlist').addEventListener('click', function () {
    if (!editing) return;
    var service = editing;
    settings[service] = null;
    titleRequests[service] += 1;
    stopped[service] = false;
    saveSettings();
    renderPlayer(service);
    closeEditor();
    document.querySelector('.card-heading [data-edit="' + service + '"]').focus();
    announce('Usunięto zapisaną playlistę ' + names[service] + '.');
  });

  document.addEventListener('keydown', function (event) {
    if (modal.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
    if (event.key === 'Tab') {
      var focusable = Array.prototype.filter.call(modal.querySelectorAll('button, input, [tabindex="0"]'), function (element) { return !element.hidden && !element.disabled; });
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });

  document.querySelectorAll('[data-sample]').forEach(function (button) {
    button.addEventListener('click', function () {
      var service = button.getAttribute('data-sample');
      settings[service] = { url: samples[service].url, title: '' };
      stopped[service] = false;
      saveSettings();
      renderPlayer(service);
      loadPlaylistTitle(service);
      document.querySelector('.card-heading [data-edit="' + service + '"]').focus();
      announce('Włączono przykładową playlistę ' + names[service] + '.');
    });
  });

  document.querySelectorAll('[data-reload]').forEach(function (button) {
    button.addEventListener('click', function () {
      var service = button.getAttribute('data-reload');
      stopped[service] = false;
      renderPlayer(service, true);
      announce('Ponownie wczytano odtwarzacz ' + names[service] + '.');
    });
  });

  document.querySelectorAll('[data-stop]').forEach(function (button) {
    button.addEventListener('click', function () {
      var service = button.getAttribute('data-stop');
      stopped[service] = !stopped[service];
      renderPlayer(service);
      announce((stopped[service] ? 'Zatrzymano ' : 'Wczytano ponownie ') + 'odtwarzacz ' + names[service] + '.');
    });
  });

  document.getElementById('theme-toggle').addEventListener('click', function () {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveSettings();
  });

  var fullscreenButton = document.getElementById('fullscreen-toggle');
  if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
    fullscreenButton.hidden = false;
    fullscreenButton.addEventListener('click', function () {
      var operation;
      try { operation = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
      catch (error) { announce('Ta przeglądarka nie pozwala włączyć pełnego ekranu.'); }
      if (operation && operation.catch) operation.catch(function () { announce('Ta przeglądarka nie pozwala włączyć pełnego ekranu.'); });
    });
    document.addEventListener('fullscreenchange', function () {
      var active = Boolean(document.fullscreenElement);
      document.getElementById('fullscreen-label').textContent = active ? 'Zamknij pełny ekran' : 'Pełny ekran';
      fullscreenButton.setAttribute('aria-label', active ? 'Zamknij pełny ekran' : 'Włącz pełny ekran');
    });
  }

  function updateConnection() { document.getElementById('offline-message').hidden = navigator.onLine !== false; }
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  window.addEventListener('pageshow', function () { updateClock(); updateConnection(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) updateClock(); });

  readSettings();
  applyTheme();
  services.forEach(function (service) { renderPlayer(service); loadPlaylistTitle(service); });
  updateClock();
  updateConnection();
  window.setInterval(updateClock, 1000);
}());
