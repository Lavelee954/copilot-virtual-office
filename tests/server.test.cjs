'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '..');
let handler;
class Watcher extends EventEmitter { start() {} snapshot() { return {sessions:[]}; } }
class WSS extends EventEmitter { constructor() { super(); this.clients = new Set(); } }
function requireForServer(name) {
  if (name === 'http') return { createServer(fn) { handler = fn; return {listen() {}}; } };
  if (name === 'ws') return {WebSocketServer: WSS};
  if (name === './lib/watcher') return {OfficeWatcher: Watcher};
  return require(name);
}
requireForServer.resolve = require.resolve;
vm.runInNewContext(fs.readFileSync(path.join(root,'server.js'),'utf8'), {require:requireForServer, __dirname:root, process, console});
function request(url) {
  return new Promise((resolve,reject) => {
    let status, headers;
    const res = {writeHead(s,h) {status=s;headers=h;return this;}, end(body) {resolve({status,headers,body:body?.toString() || ''});}};
    try { handler({url},res); } catch (err) {reject(err);}
  });
}
test('serves app and the exact required Three.js module graph', async () => {
  assert.equal((await request('/?demo=1')).status,200);
  for (const file of ['build/three.module.js','build/three.core.js','examples/jsm/controls/OrbitControls.js','examples/jsm/geometries/RoundedBoxGeometry.js']) {
    const r=await request('/vendor/three/'+file);
    assert.equal(r.status,200,file); assert.match(r.headers['Content-Type'],/^text\/javascript/); assert(r.body.length>100);
  }
});
test('rejects malformed paths, escapes, and non-allowlisted package files', async () => {
  for (const url of ['/../server.js','/%2e%2e/server.js','/%2e%2e/public-extra/secret']) assert.equal((await request(url)).status,403,url);
  for (const url of ['/vendor/three/package.json','/vendor/three/../../server.js','/vendor/three/build/../build/three.module.js']) assert.equal((await request(url)).status,404,url);
  assert.equal((await request('/%zz')).status,400);
});
