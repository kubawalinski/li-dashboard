(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LiPlaylistLinks = factory();
  }
}(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  function parseHttpsUrl(raw) {
    if (typeof raw !== "string") return null;
    var value = raw.trim();
    // URL parsers can silently discard embedded tabs/newlines. Reject them.
    if (!/^https:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value)) return null;
    try {
      var parsed = new URL(value);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function spotifyResult(id) {
    return {
      id: id,
      url: "https://open.spotify.com/playlist/" + encodeURIComponent(id),
      embedUrl: "https://open.spotify.com/embed/playlist/" + encodeURIComponent(id) + "?theme=0"
    };
  }

  function parseSpotifyPlaylist(raw) {
    if (typeof raw !== "string") return null;
    var uri = /^spotify:playlist:([a-zA-Z0-9]{22})$/.exec(raw.trim());
    if (uri) return spotifyResult(uri[1]);

    var parsed = parseHttpsUrl(raw);
    if (!parsed || parsed.hostname !== "open.spotify.com") return null;
    var match = /^\/(?:(?:intl-[a-z]{2}(?:-[a-z]{2})?)\/)?(?:embed\/)?playlist\/([a-zA-Z0-9]{22})\/?$/i.exec(parsed.pathname);
    return match ? spotifyResult(match[1]) : null;
  }

  function parseYouTubePlaylist(raw) {
    var parsed = parseHttpsUrl(raw);
    if (!parsed) return null;

    var host = parsed.hostname;
    var validPath;
    if (host === "youtu.be") {
      validPath = /^\/[a-zA-Z0-9_-]{11}\/?$/.test(parsed.pathname);
    } else if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      validPath = /^\/(?:playlist|watch|embed(?:\/videoseries|\/[a-zA-Z0-9_-]{11})?)\/?$/.test(parsed.pathname);
    } else {
      return null;
    }
    if (!validPath) return null;

    var lists = parsed.searchParams.getAll("list");
    if (lists.length !== 1) return null;
    var id = lists[0];
    // Watch Later / liked videos need an account; generated radio mixes are
    // not ordinary shareable playlists and do not reliably work in embeds.
    if (id === "WL" || id === "LL" || /^RD/.test(id)) return null;
    if (!/^[a-zA-Z0-9_-]{10,150}$/.test(id)) return null;

    return {
      id: id,
      url: "https://www.youtube.com/playlist?list=" + encodeURIComponent(id),
      embedUrl: "https://www.youtube.com/embed/videoseries?list=" + encodeURIComponent(id) + "&playsinline=1&rel=0&hl=pl"
    };
  }

  return {
    parseSpotifyPlaylist: parseSpotifyPlaylist,
    parseYouTubePlaylist: parseYouTubePlaylist
  };
}));
