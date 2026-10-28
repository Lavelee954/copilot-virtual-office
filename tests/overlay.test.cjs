'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the real app's socket -> frame -> DOM lifecycle, with measured DOM sizes
// and camera projection supplied by the harness. No layout algorithm is copied.
function setup(view) {
  let nextFrame, socket, rotation=0;
  const positions=new Map();
  class Element {
    constructor(id='') {
      this.id=id;this.dataset={};this.children=[];this.innerHTML='';this.events={};this.hidden=false;
      this.style={setProperty(name,value){this[name]=value;}};
      this.classList={toggle(){}};
    }
    get offsetWidth(){return this.className==='bubble'?200:120;}
    get offsetHeight(){return this.className==='bubble'?40:44;}
    appendChild(el){this.children.push(el);el.parent=this;}
    remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
    addEventListener(name,fn){this.events[name]=fn;}
    setAttribute(){}
  }
  const els=Object.fromEntries(['overlay','ticker','liveCount','empty','connectionStatus','demoBadge','themeBtn','themeIcon','themeLabel'].map(id=>[id,new Element(id)]));
  els.overlay.clientWidth=1000;
  const body=new Element();body.dataset.view=view;
  const office={
    DESK_SLOTS:[{gx:400,gy:450},{gx:400,gy:300}],ZONES:[],
    render(employees){positions.clear();for(const emp of employees)if(emp._slot)positions.set(emp.id,emp._slot);},
    getEmployeePosition:id=>positions.get(id),getSubagentPosition:()=>null,
    toScreen:(gx,gy,dy=0)=>({x:gx+rotation*(gy<400?2.5:.3),y:gy+dy+rotation*.1,visible:true}),
    getScale:()=>1,modelColor:()=>'#438b74',setTheme(){},addFx(){},
  };
  const env={console,URLSearchParams,Date,Office:office,location:{search:'',protocol:'http:',host:'localhost'},document:{body,getElementById:id=>els[id],createElement:()=>new Element()},
    localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:fn=>{nextFrame=fn;},setTimeout(){},WebSocket:class{constructor(){socket=this;}}};
  env.window=env;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8'),env);
  const frame=()=>nextFrame(1000);
  const send=sessions=>{socket.onmessage({data:JSON.stringify({sessions})});frame();};
  const employees=[
    {id:'front',name:'Front worker',model:'GPT',status:'working',toolCount:1,currentTool:{name:'view',detail:'front.js'},lastActivity:new Date().toISOString(),subagents:[]},
    {id:'back',name:'Back worker',model:'GPT',status:'idle',toolCount:0,lastActivity:new Date().toISOString(),subagents:[]},
  ];
  send(employees);
  const tag=name=>els.overlay.children.find(el=>el.className==='tag'&&el.innerHTML.includes(name));
  const bubble=text=>els.overlay.children.find(el=>el.className==='bubble'&&el.innerHTML.includes(text));
  return {office,els,employees,tag,bubble,send,frame,rotate(value){rotation=value;frame();}};
}
function anchor(el){const match=/^translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);assert(match);return{x:Number(match[1]),y:Number(match[2])};}
function bounds(el){const p=anchor(el),isBubble=el.className==='bubble';return{left:p.x-el.offsetWidth/2,right:p.x+el.offsetWidth/2,top:p.y-(isBubble?el.offsetHeight:0),bottom:p.y+(isBubble?10:el.offsetHeight)};}
function overlaps(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}

test('3D speech clears a back-row label, keeps idle status, and tracks a changed camera projection',()=>{
  const h=setup('3d'),speech=h.bubble('front.js'),backTag=h.tag('Back worker'),frontTag=h.tag('Front worker');
  const defaultAnchor=h.office.toScreen(400,450,-120);
  const defaultRect={left:defaultAnchor.x-100,right:defaultAnchor.x+100,top:defaultAnchor.y-40,bottom:defaultAnchor.y+10};
  assert(overlaps(defaultRect,bounds(backTag)),'fixture must reproduce the original overlap');
  assert.equal(overlaps(bounds(speech),bounds(backTag)),false,'speech must leave the name readable');
  assert.equal(overlaps(bounds(speech),{left:370,right:430,top:192,bottom:306}),false,'relocated speech must also leave the rear character face visible');
  assert.equal(speech.hidden,false);
  assert.equal(h.bubble('쉬어').hidden,true);
  assert.equal(backTag.hidden,false);assert.match(backTag.innerHTML,/쉬는 중/);
  assert.deepEqual(anchor(frontTag),{x:400,y:464},'name remains at the projected feet');
  const relocated=anchor(speech);
  h.rotate(100);
  assert.deepEqual(anchor(frontTag),{x:430,y:474});
  assert.deepEqual(anchor(backTag),{x:650,y:324});
  assert.notDeepEqual(anchor(speech),relocated);
  assert.deepEqual(anchor(speech),{x:430,y:340},'speech returns to its anchor when rotation clears the collision');
  assert.equal(overlaps(bounds(speech),bounds(backTag)),false);
  h.send([]);assert.equal(h.els.overlay.children.length,0);
});

test('2D keeps original speech anchors and idle speech visible',()=>{
  const h=setup('2d'),speech=h.bubble('front.js');
  assert.deepEqual(anchor(speech),{x:400,y:330});
  assert.equal(overlaps(bounds(speech),bounds(h.tag('Back worker'))),true,'3D collision placement must not alter 2D');
  assert.equal(h.bubble('쉬어').hidden,false);
  h.rotate(100);assert.deepEqual(anchor(speech),{x:430,y:340});
});
