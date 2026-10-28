'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../public/main.js'),'utf8');

// Keep the bootstrap's statements intact; replace only dynamic module loading
// with a controlled importer. Browser/WebGL rendering is verified separately.
async function bootstrap(search='', failure) {
  const elements = new Map();
  function element(id) {
    return {id,hidden:true,dataset:{},events:{},attrs:{},textContent:'',
      addEventListener(name,fn) {this.events[name]=fn;},
      setAttribute(name,value) {this.attrs[name]=value;},
      cloneNode() {return element(this.id);},
      replaceWith(replacement) {elements.set(this.id,replacement);this.replaced=true;},
      remove() {this.removed=true;}};
  }
  for(const id of ['scene','sceneNotice','viewToggle','viewBadge','cameraControls','sceneHelp','rotateLeft','rotateRight','zoomIn','zoomOut','resetView','sceneLoading']) elements.set(id,element(id));
  const originalCanvas=elements.get('scene'), calls=[], imports=[];
  const api={rotateBy:v=>calls.push(['rotate',v]),zoomBy:v=>calls.push(['zoom',v]),resetView:()=>calls.push(['reset'])};
  const env={URLSearchParams,location:{search},document:{body:element('body'),getElementById:id=>elements.get(id)},console:{warn() {}}};
  env.window=env;
  env.importModule=async name=>{
    imports.push(name);
    if(name==='./office-3d.js') {
      if(failure==='import') throw new Error('Module unavailable');
      return {createOffice(canvas) {assert.equal(canvas,originalCanvas);assert.equal(env.document.body.dataset.view,'3d','3D layout must be selected before the renderer measures its canvas');if(failure==='context') throw new Error('WebGL unavailable');return api;}};
    }
    if(name==='./office.js') {env.Office={kind:'2d'};return {};}
    if(name==='./app.js') {assert(env.Office,'renderer must exist before app startup');calls.push(['start',env.Office]);return {};}
    throw new Error('Unexpected import '+name);
  };
  await vm.runInNewContext('(async()=>{'+source.replace(/\bimport\(/g,'importModule(')+'})()',env);
  return {env,elements,originalCanvas,calls,imports,api};
}
test('defaults to 3D and wires accessible camera controls after renderer creation',async()=>{
  const h=await bootstrap('?demo=1&theme=night');
  assert.equal(h.env.document.body.dataset.view,'3d');
  assert.deepEqual(h.imports,['./office-3d.js','./app.js']);
  assert.equal(h.elements.get('cameraControls').hidden,false);
  const destination=new URLSearchParams(h.elements.get('viewToggle').href.slice(1));
  assert.equal(destination.get('demo'),'1');assert.equal(destination.get('theme'),'night');assert.equal(destination.get('view'),'2d');
  for(const name of ['rotateLeft','rotateRight','zoomIn','zoomOut','resetView'])h.elements.get(name).events.click();
  assert.deepEqual(h.calls.slice(1).map(x=>x[0]),['rotate','rotate','zoom','zoom','reset']);
  h.originalCanvas.events.webglcontextlost();assert.equal(h.elements.get('sceneNotice').hidden,false);
  h.originalCanvas.events.webglcontextrestored();assert.equal(h.elements.get('sceneNotice').hidden,true);
  assert.equal(h.elements.get('sceneLoading').removed,true);
});
test('explicit 2D bypasses all 3D loading',async()=>{
  const h=await bootstrap('?view=2d&demo=1');
  assert.deepEqual(h.imports,['./office.js','./app.js']);
  assert.equal(h.env.document.body.dataset.view,'2d');assert.equal(h.elements.get('cameraControls').hidden,true);
  assert.equal(h.originalCanvas.replaced,undefined);
  assert.match(h.elements.get('viewToggle').href,/view=3d/);
});
for(const failure of ['context','import'])test(`falls back to a fresh 2D canvas after ${failure} failure`,async()=>{
  const h=await bootstrap('',failure);
  assert.deepEqual(h.imports,['./office-3d.js','./office.js','./app.js']);
  assert.equal(h.env.document.body.dataset.view,'2d');
  assert.notEqual(h.elements.get('scene'),h.originalCanvas);
  assert.equal(h.elements.get('sceneNotice').hidden,false);
  assert.equal(h.elements.get('sceneLoading').removed,true);
});
