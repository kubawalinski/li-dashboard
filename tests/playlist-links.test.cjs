const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseSpotifyPlaylist, parseYouTubePlaylist } = require('../playlist-links.js');

const spotifyId = '37i9dQZF1DX4WYpdgoIcn6';
const youtubeId = 'PLC77007E23FF423C6';

test('Spotify share, localized, embed and URI links all become one canonical playlist', () => {
  const expected = {
    id: spotifyId,
    url: `https://open.spotify.com/playlist/${spotifyId}`,
    embedUrl: `https://open.spotify.com/embed/playlist/${spotifyId}?theme=0`
  };
  [
    `https://open.spotify.com/playlist/${spotifyId}?si=shared-tracking-value`,
    ` https://open.spotify.com/intl-pl/playlist/${spotifyId}/?si=value `,
    `https://open.spotify.com/embed/playlist/${spotifyId}?utm_source=generator`,
    `spotify:playlist:${spotifyId}`
  ].forEach(input => assert.deepEqual(parseSpotifyPlaylist(input), expected, input));
});

test('Spotify rejects non-playlists, unsafe origins and malformed IDs', () => {
  [
    null, undefined, 123, '',
    `https://open.spotify.com/track/${spotifyId}`,
    `http://open.spotify.com/playlist/${spotifyId}`,
    `javascript:alert(1)`,
    `https://open.spotify.com.evil.test/playlist/${spotifyId}`,
    `https://open.spotify.com@evil.test/playlist/${spotifyId}`,
    `https://user:secret@open.spotify.com/playlist/${spotifyId}`,
    `https://open.spotify.com:8443/playlist/${spotifyId}`,
    `https://open.spoti\nfy.com/playlist/${spotifyId}`,
    `https://open.spotify.com/playlist/${spotifyId.slice(1)}`,
    `https://open.spotify.com/playlist/${spotifyId}%22%3E%3Cscript%3E`,
    `https://open.spotify.com/playlist/${spotifyId}/other`
  ].forEach(input => assert.equal(parseSpotifyPlaylist(input), null, String(input)));
});

test('YouTube playlist, watch, short share, music and embed links select the same playlist', () => {
  const expected = {
    id: youtubeId,
    url: `https://www.youtube.com/playlist?list=${youtubeId}`,
    embedUrl: `https://www.youtube.com/embed/videoseries?list=${youtubeId}&playsinline=1&rel=0&hl=pl`
  };
  [
    `https://www.youtube.com/playlist?list=${youtubeId}&si=tracking`,
    `https://youtube.com/watch?v=M7lc1UVf-VE&list=${youtubeId}&index=3`,
    `https://m.youtube.com/playlist?list=${youtubeId}`,
    `https://music.youtube.com/playlist?list=${youtubeId}`,
    `https://youtu.be/M7lc1UVf-VE?si=value&list=${youtubeId}`,
    `https://www.youtube.com/embed/videoseries?list=${youtubeId}`,
    `https://www.youtube.com/embed/M7lc1UVf-VE?list=${youtubeId}`,
    `https://www.youtube.com/embed?listType=playlist&list=${youtubeId}`
  ].forEach(input => assert.deepEqual(parseYouTubePlaylist(input), expected, input));
});

test('YouTube preserves case, underscores and hyphens in shareable playlist IDs', () => {
  const id = 'PL_example-ID_1234';
  assert.equal(parseYouTubePlaylist(`https://www.youtube.com/playlist?list=${id}`).id, id);
  assert.equal(parseYouTubePlaylist('https://music.youtube.com/playlist?list=OLAK5uy_example123456').id, 'OLAK5uy_example123456');
});

test('YouTube rejects a single video without a playlist and account-only or generated lists', () => {
  [
    `https://www.youtube.com/watch?v=M7lc1UVf-VE`,
    `https://youtu.be/M7lc1UVf-VE`,
    `https://www.youtube.com/playlist?list=WL`,
    `https://www.youtube.com/playlist?list=LL`,
    `https://www.youtube.com/playlist?list=RDM7lc1UVf-VE`,
    `https://www.youtube.com/playlist?list=RDAMVM1234567890`,
    `https://www.youtube.com/playlist?list=`,
    `https://www.youtube.com/playlist?list=short`,
    `https://www.youtube.com/playlist?list=${youtubeId}&list=PLsecond_12345`
  ].forEach(input => assert.equal(parseYouTubePlaylist(input), null, input));
});

test('YouTube rejects host spoofs, credentials, unsafe protocols and injected list IDs', () => {
  [
    null, undefined, {}, '',
    `http://www.youtube.com/playlist?list=${youtubeId}`,
    `javascript:alert(1)`,
    `https://www.youtube.com.evil.test/playlist?list=${youtubeId}`,
    `https://youtube.com@evil.test/playlist?list=${youtubeId}`,
    `https://user:secret@www.youtube.com/playlist?list=${youtubeId}`,
    `https://www.youtube.com:8443/playlist?list=${youtubeId}`,
    `https://www.you\ttube.com/playlist?list=${youtubeId}`,
    `https://www.youtube.com/channel/example?list=${youtubeId}`,
    `https://youtu.be/short?list=${youtubeId}`,
    `https://www.youtube.com/playlist?list=${youtubeId}%22%3E%3Cscript%3E`,
    `https://www.youtube.com/playlist?list=${youtubeId}%26autoplay%3D1`
  ].forEach(input => assert.equal(parseYouTubePlaylist(input), null, String(input)));
});

test('browser script exports the same public API without CommonJS or modules', () => {
  const context = { window: {}, URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../playlist-links.js'), 'utf8'), context);
  assert.equal(typeof context.window.LiPlaylistLinks.parseSpotifyPlaylist, 'function');
  assert.equal(typeof context.window.LiPlaylistLinks.parseYouTubePlaylist, 'function');
  assert.equal(context.window.LiPlaylistLinks.parseYouTubePlaylist(`https://youtube.com/playlist?list=${youtubeId}`).id, youtubeId);
});
