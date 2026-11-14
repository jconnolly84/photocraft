const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {MessageChannel} = require('node:worker_threads');
const listeners = {};
const origin = 'https://example.test/school/';
const fixture = new Uint8Array([0, 1, 0, 0, 70, 79, 78, 84]);
let networkCalls = 0;
const owner = {
  url: origin,
  postMessage(message, ports) {
    const result = message.action === 'manifest'
      ? {rows: [{family: 'Arial', style: 'Regular', postscriptName: 'ArialMT'},
                {family: 'Bad|Row', style: 'Regular', postscriptName: 'Bad'}]}
      : message.name === 'ArialMT' ? {bytes: fixture.slice().buffer} : {error: 'Unavailable'};
    ports[0].postMessage(result); ports[0].close();
  },
};
const clients = new Map([
  ['editor', {url: origin + 'photocraft/?local_fonts=owner'}],
  ['owner', owner], ['other-editor', {url: origin + 'photocraft/'}],
]);
vm.runInNewContext(fs.readFileSync('host/local-font-worker.js', 'utf8'), {
  self: {registration: {scope: origin}, addEventListener: (type, handler) => {listeners[type] = handler;},
    clients: {get: async id => clients.get(id)}},
  URL, Response, Request, MessageChannel, ArrayBuffer, Set, setTimeout, clearTimeout,
  fetch: async request => {
    networkCalls++;
    assert.match(new URL(request.url).pathname, /^\/school\/(photocraft|build-\d+)\/fonts\/manifest.txt$/);
    return new Response('Arial | Regular | fonts/hosted.ttf\nLobster | Regular | fonts/lobster.ttf\n');
  },
});
async function fetchRoute(path, clientId = 'editor', method = 'GET') {
  let response;
  listeners.fetch({request: new Request(origin + path, {method}), clientId,
    respondWith(value) { response = Promise.resolve(value); }});
  return response;
}
(async () => {
  const manifest = await fetchRoute('photocraft/fonts/manifest.txt');
  const text = await manifest.text();
  assert(text.includes('Lobster | Regular | fonts/lobster.ttf'));
  assert(text.includes('Arial | Regular | fonts/__local/ArialMT.ttf'));
  assert(!text.includes('fonts/hosted.ttf'), 'Local matching face must take precedence');
  assert(!text.includes('Bad|Row'), 'Reject manifest field injection');
  assert.equal(manifest.headers.get('cache-control'), 'no-store');
  const font = await fetchRoute('photocraft/fonts/__local/ArialMT.ttf');
  assert.deepEqual(new Uint8Array(await font.arrayBuffer()), fixture);
  assert.equal(font.headers.get('cache-control'), 'no-store');
  const missing = await fetchRoute('photocraft/fonts/__local/Missing.ttf');
  assert.equal(missing.status, 404);
  const isolated = await fetchRoute('photocraft/fonts/__local/ArialMT.ttf', 'other-editor');
  assert.equal(isolated.status, 404, 'Another editor cannot inherit local fonts');
  const normal = await fetchRoute('photocraft/fonts/manifest.txt', 'other-editor');
  assert((await normal.text()).includes('fonts/hosted.ttf'));
  assert.equal(await fetchRoute('photocraft/app/app.part-aa'), undefined);
  assert.equal(await fetchRoute('photocraft/fonts/manifest.txt', 'editor', 'POST'), undefined);
  clients.set('versioned-editor', {url: origin + 'build-123/?local_fonts=owner'});
  const versioned = await fetchRoute('build-123/fonts/__local/ArialMT.ttf', 'versioned-editor');
  assert.deepEqual(new Uint8Array(await versioned.arrayBuffer()), fixture);
  const versionedManifest = await fetchRoute('build-123/fonts/manifest.txt', 'versioned-editor');
  assert((await versionedManifest.text()).includes('fonts/__local/ArialMT.ttf'));
  assert.equal(networkCalls, 3, 'Only hosted manifests may reach the network');
  console.log('Local manifest merging, exact font bytes, session isolation, no-store, no font uploads and passthrough checks passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
