'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Use real Three.js scene graph, geometries, camera matrices and materials.
// The GPU renderer and DOM pointer controls are stubs; these tests do not prove
// shader compilation, browser gestures or visual quality.
async function setup(reducedMotion=false) {
  const THREE = await import('three');
  const {RoundedBoxGeometry}=await import('three/addons/geometries/RoundedBoxGeometry.js');
  let time=1000,renderer;
  const epoch=Date.parse('2026-10-28T06:00:00Z');
  class ClockDate extends Date {static now(){return epoch+time;}}
  class Renderer {
    constructor(){renderer=this;this.shadowMap={};this.calls=0;}
    setPixelRatio(v){this.pixelRatio=v;}
    setSize(w,h){this.width=w;this.height=h;}
    render(scene,camera){this.scene=scene;this.camera=camera;scene.updateMatrixWorld();camera.updateMatrixWorld();this.calls++;}
    dispose(){this.disposed=true;}
  }
  class Controls {
    constructor(camera){this.camera=camera;this.target=new THREE.Vector3();}
    update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld();}
    dispose(){this.disposed=true;}
  }
  const events=new Map();
  const canvas={clientWidth:1200,clientHeight:800};
  const env={THREE:{...THREE,WebGLRenderer:Renderer},RoundedBoxGeometry,OrbitControls:Controls,performance:{now:()=>time},Date:ClockDate,console,
    window:{devicePixelRatio:3,innerWidth:1200,innerHeight:800,matchMedia:()=>({matches:reducedMotion}),addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>events.delete(n)},
    document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})}};
  const source=fs.readFileSync(path.join(__dirname,'../public/office-3d.js'),'utf8').replace(/^import .*;\n/gm,'').replace('export function createOffice','function createOffice');
  vm.runInNewContext(source+'\nglobalThis.makeOffice=createOffice;',env);
  const office=env.makeOffice(canvas);
  const frame=(list=[],ms=100)=>{time+=ms;office.render(list,time);};
  const employee=(id,status='working',slot=0)=>({id,model:'GPT',status,_slot:office.DESK_SLOTS[slot],lastActivity:new Date(epoch+time-30000).toISOString(),subagents:[]});
  frame();
  return {office,renderer,canvas,events,frame,employee,now:()=>epoch+time};
}
function finitePosition(p){assert(p);assert(Number.isFinite(p.gx));assert(Number.isFinite(p.gy));}
function materialColorCount(object,color){let count=0;object.traverse(node=>{if(node.material?.color?.getHexString()===color)count++;});return count;}

test('seven 3D actors, helper cap, removal and retained resource lifecycle',async()=>{
  const h=await setup(),{office,renderer,frame,employee}=h;
  const baseline=renderer.scene.children.length;
  const employees=Array.from({length:7},(_,i)=>employee('e'+i,'working',i));
  employees[0].subagents=Array.from({length:5},(_,i)=>({id:'s'+i,model:'Claude'}));
  frame(employees);
  for(const e of employees)finitePosition(office.getEmployeePosition(e.id));
  assert.equal(new Set(employees.map(e=>JSON.stringify(office.getEmployeePosition(e.id)))).size,7);
  assert.equal(renderer.scene.children.length,baseline+11);
  assert(office.getSubagentPosition('e0',3));assert.equal(office.getSubagentPosition('e0',4),null);
  frame([]);assert.equal(renderer.scene.children.length,baseline);
  assert.equal(office.getEmployeePosition('e0'),null);assert.equal(office.getSubagentPosition('e0',0),null);
  for(let i=0;i<25;i++){frame([employee('new-'+i)]);frame([]);}
  assert.equal(renderer.scene.children.length,baseline);
  frame(employees);
  const geometries=new Set(),materials=new Set();
  renderer.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});
  let disposedGeometry=0,disposedMaterial=0;
  for(const g of geometries)g.addEventListener('dispose',()=>disposedGeometry++);
  for(const m of materials)m.addEventListener('dispose',()=>disposedMaterial++);
  office.dispose();assert.equal(disposedGeometry,geometries.size);assert.equal(disposedMaterial,materials.size);
  assert.equal(renderer.scene.children.length,0);assert.equal(renderer.disposed,true);assert.equal(h.events.has('resize'),false);
  const calls=renderer.calls;office.dispose();frame(employees);assert.equal(renderer.calls,calls);
});
test('camera projection follows rotation/zoom/reset and remains finite after resizing',async()=>{
  const h=await setup(),{office,renderer,frame,canvas}=h;
  const start=office.toScreen(300,435,-120);
  assert.equal(start.visible,true);assert(start.y<office.toScreen(300,435,14).y);
  office.rotateBy(.3);frame();const rotated=office.toScreen(300,435,-120);assert(Math.abs(rotated.x-start.x)>5);
  office.zoomBy(1000);frame();assert.equal(renderer.camera.zoom,1.9);
  office.zoomBy(.00001);frame();assert.equal(renderer.camera.zoom,.7);
  office.resetView();frame();const reset=office.toScreen(300,435,-120);assert(Math.abs(reset.x-start.x)<.001);assert(Math.abs(reset.y-start.y)<.001);
  for(const [w,h]of [[375,650],[1440,740],[1,1]]){canvas.clientWidth=w;canvas.clientHeight=h;office.fit();frame();const p=office.toScreen(600,400,-120);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(renderer.width,w);}
  assert.equal(renderer.pixelRatio,2);
  office.dispose();
});
test('idle coffee movement returns when work arrives and sleep suppresses roaming',async()=>{
  const h=await setup(),{office,frame,employee}=h;
  const emp=employee('walker','idle');emp.subagents=[{id:'helper',model:'Claude'}];
  frame([emp]);const home={...office.getEmployeePosition(emp.id)};
  frame([emp],30000);for(let i=0;i<160;i++)frame([emp]);
  const away=office.getEmployeePosition(emp.id);assert(Math.hypot(away.gx-home.gx,away.gy-home.gy)>100);
  const helper=office.getSubagentPosition(emp.id,0);assert(Math.abs(helper.gx-away.gx)<100);
  emp.status='working';frame([emp]);for(let i=0;i<100;i++)frame([emp]);
  const returned=office.getEmployeePosition(emp.id);assert.equal(returned.gx,home.gx);assert.equal(returned.gy,home.gy);
  emp.status='idle';emp.lastActivity=new Date(h.now()-181000).toISOString();
  frame([emp],50000);for(let i=0;i<50;i++)frame([emp]);assert.equal(office.getEmployeePosition(emp.id).gx,home.gx);
  office.dispose();
});
test('night lighting changes and reduced motion keeps idle actors home',async()=>{
  const h=await setup(true),{office,renderer,frame,employee}=h;
  const day=renderer.scene.background.getHexString();office.setTheme('night');frame();assert.notEqual(renderer.scene.background.getHexString(),day);
  const point=renderer.scene.children.find(n=>n.isPointLight);assert(point.intensity>0);
  office.setTheme('day');frame();assert.equal(renderer.scene.background.getHexString(),day);assert.equal(point.intensity,0);
  const emp=employee('calm','idle');frame([emp]);const home={...office.getEmployeePosition(emp.id)};
  frame([emp],40000);for(let i=0;i<100;i++)frame([emp]);assert.equal(office.getEmployeePosition(emp.id).gx,home.gx);
  office.dispose();
});
test('retained 3D actor and helper markers follow model vendor changes',async()=>{
  const h=await setup(),{office,renderer,frame,employee}=h;
  const emp=employee('changes-model');emp.subagents=[{id:'same-helper',model:'GPT'}];frame([emp]);
  const before=materialColorCount(renderer.scene,'638eb6');
  emp.model='Gemini';emp.subagents[0].model='Gemini';frame([emp]);
  assert.equal(materialColorCount(renderer.scene,'638eb6'),before+2,'both retained markers must update');
  office.dispose();
});
