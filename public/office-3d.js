import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A retained 3D scene. Session coordinates retain the 2D renderer's 1200 × 800 contract.
export function createOffice(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-20, 20, 12, -12, .1, 160);
  const target = new THREE.Vector3(0, .7, .7);
  const homePosition = new THREE.Vector3(17, 25, 34);
  camera.position.copy(homePosition);
  camera.lookAt(target);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI / 5;
  controls.maxPolarAngle = Math.PI / 2.8;
  controls.minAzimuthAngle = -.85;
  controls.maxAzimuthAngle = .95;
  controls.minZoom = .7;
  controls.maxZoom = 1.9;
  controls.rotateSpeed = .6;
  controls.zoomSpeed = .7;
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const floorY = .15;
  const DESK_SLOTS = [
    { gx: 300, gy: 435 }, { gx: 580, gy: 440 }, { gx: 870, gy: 430 },
    { gx: 390, gy: 650 }, { gx: 720, gy: 665 },
    { gx: 175, gy: 610 }, { gx: 1010, gy: 630 },
  ];
  const actors = new Map(), helpers = new Map(), effects = [];
  const geometries = new Set(), materials = new Map(), textures = new Set();
  const geoCache = new Map();
  let width = 1, height = 1, night = false, lastFrame = 0, disposed = false;
  const projected = new THREE.Vector3();
  const worldX = gx => (gx - 600) / 40;
  const worldZ = gy => (gy - 400) / 40;
  const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const modelColor = model => {
    const m = String(model || '').toLowerCase();
    return m.includes('claude') ? '#bc7858' : m.includes('gpt') || m.includes('codex') || m.startsWith('o') ? '#438b74' : m.includes('gemini') ? '#638eb6' : '#a48eb5';
  };
  function material(color, roughness = .85) {
    const key = `${color}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
    return materials.get(key);
  }
  function geometry(key, make) {
    if (!geoCache.has(key)) { const g = make(); geoCache.set(key, g); geometries.add(g); }
    return geoCache.get(key);
  }
  const sphereGeo = geometry('sphere', () => new THREE.SphereGeometry(1, 24, 16));
  function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
    const item = new THREE.Mesh(geo, typeof mat === 'string' ? material(mat) : mat);
    item.position.set(x, y, z); item.castShadow = true; item.receiveShadow = true;
    parent.add(item); return item;
  }
  function ball(parent, color, x, y, z, sx, sy = sx, sz = sx) {
    const item = mesh(parent, sphereGeo, color, x, y, z); item.scale.set(sx, sy, sz); return item;
  }
  function box(parent, color, x, y, z, w, h, d, radius = .1) {
    const key = `box:${w}:${h}:${d}:${radius}`;
    const geo = geometry(key, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)));
    return mesh(parent, geo, color, x, y, z);
  }
  function cylinder(parent, color, x, y, z, radius, h, top = radius) {
    const key = `cylinder:${radius}:${top}:${h}`;
    return mesh(parent, geometry(key, () => new THREE.CylinderGeometry(top, radius, h, 20)), color, x, y, z);
  }
  function torus(parent, color, x, y, z, radius, tube) {
    const geo = geometry(`torus:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 8, 32));
    return mesh(parent, geo, color, x, y, z);
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const item = new THREE.Group(); item.position.set(x, y, z); parent.add(item); return item;
  }
  function textTexture(text, bg, fg, size = 64, w = 512, h = 128) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const c2 = c.getContext('2d');
    c2.fillStyle = bg; c2.fillRect(0, 0, w, h);
    c2.font = `800 ${size}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    c2.fillStyle = fg; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(text, w / 2, h / 2);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture); return texture;
  }
  function sign(parent, text, x, y, z, w = 3.5) {
    const board = box(parent, '#ead5a6', x, y, z, w, .67, .18, .12);
    const mat = new THREE.MeshBasicMaterial({ map: textTexture(text, '#fff3d6', '#655340', 58) });
    materials.set(`sign:${text}`, mat);
    const face = mesh(parent, geometry(`sign:${w}`, () => new THREE.PlaneGeometry(w - .15, .52)), mat, x, y, z + .101);
    face.castShadow = false;
    return board;
  }
  const hemi = new THREE.HemisphereLight('#fff4df', '#8a9d79', 2.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 3.0); sun.position.set(-12, 22, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 65 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0002; sun.shadow.radius = 4; scene.add(sun);
  const fill = new THREE.DirectionalLight('#d5eaff', 1.0); fill.position.set(12, 10, -10); scene.add(fill);
  const stage = group(scene);
  box(stage, '#e3c89e', 0, -.62, 0, 28, 1.25, 20, .8);
  box(stage, '#96ba7e', 0, .02, 0, 27.8, .3, 19.8, .7);
  const backdropMat = material('#efe9d9');
  const backdrop = mesh(scene, geometry('backdrop', () => new THREE.PlaneGeometry(250, 250)), backdropMat, 0, -1.28, 0);
  backdrop.rotation.x = -Math.PI / 2; backdrop.castShadow = false;
  // The broad curved trail links work, coffee, and picnic areas.
  const pathCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-13, .19, 3.8), new THREE.Vector3(-7, .19, 3.1),
    new THREE.Vector3(-1, .19, 3.5), new THREE.Vector3(5, .19, 2.9), new THREE.Vector3(13, .19, 3.5),
  ]);
  const pathGeo = new THREE.TubeGeometry(pathCurve, 72, .62, 8, false); geometries.add(pathGeo);
  const path = mesh(stage, pathGeo, '#e8d6af'); path.scale.y = .035; path.position.y = .19; path.castShadow = false;

  function tree(x, z, s = 1) {
    const g = group(stage, x, floorY, z); g.scale.setScalar(s);
    cylinder(g, '#ba8d64', 0, 1.3, 0, .27, 2.6, .2);
    const branch = cylinder(g, '#ba8d64', .32, 2, 0, .13, 1.0); branch.rotation.z = -.55;
    ball(g, '#91b97f', -.65, 2.8, .03, .95, 1.0, .85);
    ball(g, '#a5c78d', .65, 2.9, -.1, 1.0, 1.05, .9);
    ball(g, '#bad39c', 0, 3.65, .05, 1.15, 1.1, 1.0);
    return g;
  }
  tree(-11.5, -6.4, 1.15); tree(-11.9, -.2, .9); tree(10.7, -6.3, 1.16);
  tree(12.0, .2, .87); tree(11.7, 7.5, .7);
  function flower(x, z, color = '#f5d2cf', s = 1) {
    const g = group(stage, x, floorY, z); g.scale.setScalar(s);
    cylinder(g, '#739564', 0, .17, 0, .025, .34);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ball(g, color, Math.cos(a) * .13, .36 + Math.sin(a) * .13, .02, .105, .105, .055); }
    ball(g, '#e5ba60', 0, .36, .075, .075, .075, .045);
  }
  [[-12,5],[-10,7.6],[-8,-3],[-2,7.6],[3,-6.7],[9,5.4],[5,7.8],[11,-2.5],[-7,7.8],[2,-3.8],[-10,-8.1],[7,-7.7]].forEach(([x,z], i) => flower(x,z,i % 2 ? '#fff5df' : '#edbdc6', 1.1));
  for (const [x,z] of [[-9,5],[-5,-6.8],[6,-5.5],[10,4.7],[-12,8],[7,8],[-4,7.8]]) {
    const grass = group(stage,x,.18,z);
    for (let i=0;i<3;i++) { const leaf=ball(grass,'#86ab71',(i-1)*.1,.17,0,.045,.21,.025); leaf.rotation.z=(i-1)*-.35; }
  }

  // A rounded, open-front little studio with a pitched terracotta roof.
  const cabin = group(stage, -2.5, floorY, -5.35);
  box(cabin, '#cda783', 0, .12, 0, 6.2, .25, 3.9, .18);
  box(cabin, '#fff0cf', 0, 1.66, -.15, 5.5, 3.05, 3.3, .2);
  const roofShape = new THREE.Shape(); roofShape.moveTo(-3.2,0); roofShape.lineTo(0,1.7); roofShape.lineTo(3.2,0); roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape,{depth:4.0, bevelEnabled:true, bevelThickness:.09, bevelSize:.09, bevelSegments:2, steps:1}); geometries.add(roofGeo);
  mesh(cabin, roofGeo, '#c98d83', 0, 3.15, -2.0);
  // Raised soft ridge and chimney make the roof read as a miniature model.
  const ridge = cylinder(cabin,'#c38d83',0,4.89,0,.12,4.15); ridge.rotation.x=Math.PI/2;
  box(cabin, '#e9c6ab', 1.8, 4.07, -.9, .55, 1.2, .6, .08);
  box(cabin, '#d8ad93', 1.8, 4.65, -.9, .7, .18, .75, .06);
  box(cabin, '#ae8a67', -.95, 1.35, 1.55, 1.45, 2.55, .19, .16);
  const windowMaterial = new THREE.MeshStandardMaterial({color:'#c6e2df',roughness:.45,emissive:'#f2bf65',emissiveIntensity:0}); materials.set('window',windowMaterial);
  box(cabin, windowMaterial, -.95, 1.75, 1.68, 1.12, 1.35, .07, .1);
  box(cabin, '#f4e3c1', -.95, 1.75, 1.73, .055, 1.35, .03, .01);
  ball(cabin,'#ddbd79',-.48,.9,1.72,.09);
  box(cabin,'#b39272',1.2,1.85,1.55,1.55,1.5,.19,.12);
  box(cabin,windowMaterial,1.2,1.85,1.68,1.3,1.25,.07,.08);
  box(cabin,'#f3e5c9',1.2,1.85,1.74,.07,1.3,.04,.01);
  box(cabin,'#f3e5c9',1.2,1.85,1.74,1.3,.07,.04,.01);
  box(cabin,'#c69b76',1.2,.98,1.8,1.8,.22,.55,.07);
  for(let i=0;i<3;i++){ cylinder(cabin,'#cfaa83',.65+i*.55,1.2,1.85,.17,.32,.21); ball(cabin,'#a6be80',.65+i*.55,1.55,1.85,.24,.32,.2); }
  sign(cabin,'작은 작업실',0,3.55,2.2,3.4);
  box(cabin,'#dfc6a2',-.9,.12,2.04,2.0,.22,.7,.1);
  const lamp = new THREE.PointLight('#ffd99a',0,10,2); lamp.position.set(-2.5,2.7,-2.8); scene.add(lamp);

  // Picnic textile, a wicker basket, and tiny treats.
  box(stage,'#ebc1cc',1.9,.205,6.05,6.6,.1,4.8,.3);
  for(let x=0;x<8;x++) for(let z=0;z<6;z++) {
    if((x+z)%2===0) box(stage,'#f5d7df',-1.0+x*.82,.265,4.0+z*.79,.81,.025,.78,.01);
  }
  const basket=group(stage,2.0,.3,6.6);
  box(basket,'#b68b5c',0,.33,0,1.45,.65,.9,.13);
  box(basket,'#d6b480',0,.58,0,1.55,.18,1.0,.08);
  for(let i=0;i<3;i++) box(basket,'#ca9f6f',0,.17+i*.15,.46,1.4,.055,.025,.01);
  const handle=torus(basket,'#9d7854',0,.9,0,.48,.065); handle.scale.y=1.1;
  ball(basket,'#f0dfb6',-.4,.68,.06,.25); ball(basket,'#bad399',.02,.73,.08,.25); ball(basket,'#e9b7b1',.4,.68,.06,.23);
  function cup(parent,x,y,z,color='#f0d795') {
    const g=group(parent,x,y,z);
    cylinder(g,color,0,.16,0,.17,.31,.2);
    cylinder(g,'#987458',0,.32,0,.155,.015,.155);
    const handle=torus(g,color,.2,.17,0,.12,.04); handle.scale.x=.8;
    return g;
  }
  cup(stage,4.35,.3,7.25,'#e8d094'); cup(stage,-.45,.3,7.65,'#a7c8cf');

  const coffee=group(stage,7.5,floorY,-3.6);
  for(const x of [-1.45,1.45]) for(const z of [-.5,.5]) cylinder(coffee,'#b7956b',x,.62,z,.09,1.25);
  box(coffee,'#d4b184',0,1.3,0,3.4,.22,1.65,.12);
  box(coffee,'#a4bbc0',.7,1.85,-.1,1.0,.9,.75,.12);
  box(coffee,'#596d6d',.7,1.95,.3,.63,.4,.05,.04);
  for(let i=0;i<2;i++) cylinder(coffee,i?'#a9c8bd':'#eac6aa',-.9+i*.55,1.65,0,.2,.55,.2);
  cup(coffee,-.25,1.45,.4);
  sign(coffee,'COFFEE',0,.8,.65,2.25);
  const bench=group(stage,9.7,floorY,-.8);
  box(bench,'#e6c89e',0,.65,0,2.4,.2,.8,.1);
  for(const x of [-.9,.9]) box(bench,'#ab8b62',x,.3,0,.16,.6,.55,.04);
  box(bench,'#dcb78c',0,1.15,-.35,2.4,.8,.13,.07);

  const garden=group(stage,-8.1,.19,1.8);
  box(garden,'#c7a47c',0,.06,0,3.8,.16,2.1,.6);
  box(garden,'#dbc097',0,.15,0,3.5,.05,1.8,.5);
  for(let i=0;i<6;i++){
    const x=-1.25+(i%3)*1.2,z=-.5+Math.floor(i/3)*.9;
    cylinder(garden,'#7c9d68',x,.33,z,.035,.3);
    const a=ball(garden,'#98b97d',x-.12,.46,z,.19,.065,.1); a.rotation.z=.35;
    const b=ball(garden,'#a8c58a',x+.12,.46,z,.19,.065,.1); b.rotation.z=-.35;
  }
  cylinder(stage,'#b28a61',-9.6,.75,4.9,.12,1.2);
  box(stage,'#d7968f',-9.6,1.6,4.9,.95,.9,.75,.2);
  box(stage,'#6f6758',-9.6,1.65,5.3,.62,.055,.04,.01);
  box(stage,'#efd18c',-9.07,1.8,4.9,.08,.42,.3,.03);

  function makeActor(id, color, scale=1) {
    const seed=hash(id), kind=seed%3;
    const g=group(scene), body=group(g,0,floorY,0);
    g.scale.setScalar(scale);
    const fur=['#fff4df','#f6e2cb','#e8ede1','#f5e7df'][seed%4];
    ball(body,fur,0,1.18,0,.77,1.04,.61);
    ball(body,'#fff8e9',0,.98,.48,.52,.62,.18);
    const feet=[ball(body,fur,-.33,.17,.16,.24,.17,.31),ball(body,fur,.33,.17,.16,.24,.17,.31)];
    const arms=[ball(body,fur,-.73,1.0,.15,.17,.35,.19),ball(body,fur,.73,1.0,.15,.17,.35,.19)];
    if(kind===0){
      for(const x of [-.48,.48]) { ball(body,fur,x,2.03,-.03,.26,.28,.19); ball(body,'#e9bdb3',x,2.07,.14,.14,.15,.05); }
    }else if(kind===1){
      for(const x of [-.34,.34]) { const ear=ball(body,fur,x,2.32,-.02,.19,.57,.16); ear.rotation.z=x*.23; const inner=ball(body,'#edc4ba',x,2.34,.125,.09,.4,.035); inner.rotation.z=x*.23; }
    }else{
      for(const x of [-.48,.48]) { const ear=mesh(body,geometry('ear',()=>new THREE.ConeGeometry(.26,.58,3)),fur,x,2.08,0); ear.rotation.y=Math.PI/6; ear.rotation.z=-x*.2; ball(body,'#e4c0b5',x,2.08,.16,.1,.16,.035); }
    }
    const eyes=[];
    for(const x of [-.25,.25]) {
      const eye=ball(body,'#433e37',x,1.5,.578,.068,.095,.04); eyes.push(eye);
      ball(body,'#fffef2',x-.014,1.532,.613,.019,.024,.012);
      ball(body,'#e9b5af',x*1.58,1.27,.56,.14,.07,.025);
    }
    ball(body,'#9d7861',0,1.32,.662,.06,.042,.025);
    const smileGeo=geometry('smile',()=>new THREE.TorusGeometry(.09,.018,6,16,Math.PI));
    for(const x of [-.075,.075]) { const smile=mesh(body,smileGeo,'#655347',x,1.23,.66); smile.rotation.z=Math.PI; }
    const badge=ball(body,color,0,.72,.66,.19,.12,.025);
    const laptop=group(body,0,.35,.68);
    box(laptop,'#889e99',0,.04,.18,1.0,.075,.7,.06);
    const lid=box(laptop,'#819791',0,.35,-.08,1.0,.65,.08,.05); lid.rotation.x=-.12;
    box(laptop,'#d4e7d9',0,.36,-.02,.82,.48,.02,.025);
    for(let i=0;i<3;i++) box(laptop,i===0?'#c99573':'#8ca98e',-.12+(i%2)*.08,.47-i*.11,.003,.44-i*.07,.025,.012,.005);
    const mug=cup(body,.25,.6,.72,'#edd28c');
    const thinking=group(body,.83,1.9,.05);
    for(let i=0;i<3;i++) ball(thinking,'#e2c78a',i*.13,i*.12,0,.045+i*.012);
    const sleep=group(body,.8,2.1,.02);
    for(let i=0;i<3;i++) { const mark=box(sleep,'#819b8b',i*.12,i*.15,0,.13,.035,.04,.01); mark.rotation.z=-.4; }
    return {group:g,body,feet,arms,eyes,badge,laptop,mug,thinking,sleep,seed,scale,mode:'home',gx:0,gy:0,nextTrip:0,until:0};
  }
  const residents=[makeActor('resident-bunny','#be9a77',.65),makeActor('resident-cat','#93ad85',.55)];
  residents[0].gx=1015;residents[0].gy=235;residents[1].gx=840;residents[1].gy=710;
  function pose(actor,status,t,walking=false) {
    actor.group.position.set(worldX(actor.gx),0,worldZ(actor.gy));
    actor.group.rotation.y=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z);
    const bounce=reducedMotion?0:walking?Math.abs(Math.sin(t/95))*.09:Math.sin(t/700+actor.seed%10)*.018;
    actor.body.position.y=floorY+bounce;
    actor.laptop.visible=status==='working';actor.mug.visible=status==='idle';actor.thinking.visible=status==='thinking';actor.sleep.visible=status==='sleep';
    const blink=status==='sleep'||(!reducedMotion&&Math.floor(t/130+actor.seed%23)%37===0);
    actor.eyes.forEach(eye=>{eye.scale.y=blink?.022:.095;});
    actor.feet.forEach((foot,i)=>{foot.position.z=.16+(walking&&!reducedMotion?Math.sin(t/95+i*Math.PI)*.12:0);});
    actor.arms.forEach((arm,i)=>{arm.rotation.x=status==='working'&&!reducedMotion?-.45+Math.sin(t/95+i*Math.PI)*.12:0;});
    actor.body.rotation.z=status==='sleep'?.07:0;
    actor.thinking.rotation.z=reducedMotion?0:Math.sin(t/800)*.12;
  }
  function updateActor(emp,dt,now,t) {
    let actor=actors.get(emp.id);
    if(!actor){ actor=makeActor(emp.id,modelColor(emp.model));actor.gx=emp._slot.gx;actor.gy=emp._slot.gy;actor.nextTrip=now+12000+hash(emp.id)%9000;actors.set(emp.id,actor); }
    actor.badge.material=material(modelColor(emp.model));
    const idleMs=emp.lastActivity?Date.now()-new Date(emp.lastActivity).getTime():0;
    const sleeping=emp.status==='idle'&&idleMs>180000;
    if(actor.mode==='home'&&emp.status==='idle'&&idleMs>6000&&!sleeping&&now>actor.nextTrip&&!reducedMotion)actor.mode='out';
    if((emp.status!=='idle'||sleeping)&&actor.mode!=='home')actor.mode='back';
    if(actor.mode==='coffee'&&now>actor.until)actor.mode='back';
    if(actor.mode==='out'||actor.mode==='back'){
      const destination=actor.mode==='out'?{gx:870+(hash(emp.id)%3)*22,gy:330+(hash(emp.id)%2)*30}:emp._slot;
      const dx=destination.gx-actor.gx,dy=destination.gy-actor.gy,d=Math.hypot(dx,dy),step=(emp.status==='idle'?48:165)*dt/1000;
      if(d<=step){actor.gx=destination.gx;actor.gy=destination.gy;if(actor.mode==='out'){actor.mode='coffee';actor.until=now+3500;}else{actor.mode='home';actor.nextTrip=now+28000+hash(emp.id)%15000;}}
      else{actor.gx+=dx/d*step;actor.gy+=dy/d*step;}
    }else if(actor.mode==='home'){actor.gx=emp._slot.gx;actor.gy=emp._slot.gy;}
    pose(actor,sleeping?'sleep':emp.status,t,actor.mode==='out'||actor.mode==='back');
    return actor;
  }
  function fit() {
    width=Math.max(1,canvas.clientWidth||window.innerWidth);height=Math.max(1,canvas.clientHeight||window.innerHeight);
    renderer.setSize(width,height,false);
    const aspect=width/height,half=Math.max(11.3,17/aspect);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  }
  function setTheme(name) {
    night=name==='night';
    scene.background=new THREE.Color(night?'#283943':'#eee9dc');
    scene.fog=new THREE.Fog(night?'#283943':'#eee9dc',65,130);
    backdropMat.color.set(night?'#30434a':'#efe9d9');
    hemi.color.set(night?'#cbdcf0':'#fff4df');hemi.groundColor.set(night?'#46585d':'#8a9d79');hemi.intensity=night?1.2:2.0;
    sun.color.set(night?'#c7d7ef':'#fff3dc');sun.intensity=night?1.2:3.0;fill.intensity=night?.7:1.0;
    windowMaterial.emissiveIntensity=night?1.5:0;windowMaterial.color.set(night?'#f0cf88':'#c6e2df');lamp.intensity=night?8:0;
    renderer.toneMappingExposure=night?1.05:1.0;
  }
  function toScreen(gx,gy,dy=0) {
    projected.set(worldX(gx),floorY+Math.max(0,-dy/40),worldZ(gy)).project(camera);
    return {x:(projected.x+1)*width/2,y:(1-projected.y)*height/2+Math.max(0,dy),visible:projected.z>=-1&&projected.z<=1};
  }
  function resetView(){camera.position.copy(homePosition);camera.zoom=1;controls.target.copy(target);camera.updateProjectionMatrix();controls.update();}
  function zoomBy(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();controls.update();}
  function rotateBy(radians){
    const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    spherical.theta=THREE.MathUtils.clamp(spherical.theta+radians,controls.minAzimuthAngle,controls.maxAzimuthAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
  }
  function addFx(gx,gy,dy,type){
    const g=group(scene,worldX(gx),floorY-dy/40,worldZ(gy));
    if(type==='check') {const a=box(g,'#70a584',-.09,0,0,.1,.32,.08,.035);a.rotation.z=.65;const b=box(g,'#70a584',.1,.12,0,.1,.6,.08,.035);b.rotation.z=-.6;}
    else {ball(g,'#e4a1b0',-.11,.08,0,.18);ball(g,'#e4a1b0',.11,.08,0,.18);const p=ball(g,'#e4a1b0',0,-.08,0,.18,.24,.16);p.rotation.z=Math.PI/4;}
    effects.push({group:g,born:performance.now(),baseY:g.position.y});
    if(effects.length>24)scene.remove(effects.shift().group);
  }
  function render(employees,t){
    if(disposed)return;
    const now=performance.now(),dt=lastFrame?Math.min(100,now-lastFrame):16;lastFrame=now;
    controls.update();
    const seen=new Set(),seenHelpers=new Set();
    for(const emp of employees){
      if(!emp._slot)continue;
      seen.add(emp.id);const actor=updateActor(emp,dt,now,t);
      (emp.subagents||[]).slice(0,4).forEach((sub,i)=>{
        const key=`${emp.id}:${sub.id||i}`;seenHelpers.add(key);
        let helper=helpers.get(key);if(!helper){helper=makeActor(key,modelColor(sub.model),.36);helpers.set(key,helper);}
        helper.owner=emp.id;helper.index=i;helper.badge.material=material(modelColor(sub.model));
        helper.gx=actor.gx+(i%2?-1:1)*(50+Math.floor(i/2)*26);helper.gy=actor.gy+26+Math.floor(i/2)*32;
        pose(helper,'working',t);
      });
    }
    for(const [id,actor]of actors)if(!seen.has(id)){scene.remove(actor.group);actors.delete(id);}
    for(const [key,helper]of helpers)if(!seenHelpers.has(key)){scene.remove(helper.group);helpers.delete(key);}
    pose(residents[0],'idle',t);pose(residents[1],'sleep',t);
    for(let i=effects.length-1;i>=0;i--){const e=effects[i],age=now-e.born;if(age>1100){scene.remove(e.group);effects.splice(i,1);continue;}e.group.position.y=e.baseY+age/1200;e.group.scale.setScalar(Math.max(.05,1-age/1100));e.group.rotation.y=camera.rotation.y;}
    renderer.render(scene,camera);
  }
  function dispose(){
    if(disposed)return;disposed=true;
    window.removeEventListener('resize',fit);controls.dispose();
    for(const geo of geometries)geo.dispose();for(const mat of materials.values())mat.dispose();for(const texture of textures)texture.dispose();
    scene.clear();actors.clear();helpers.clear();effects.length=0;renderer.dispose();
  }
  window.addEventListener('resize',fit);fit();setTheme('day');controls.update();
  return {render,fit,toScreen,DESK_SLOTS,ZONES:[],modelColor,setTheme,addFx,resetView,zoomBy,rotateBy,dispose,
    getScale:()=>Math.min(1.08,Math.max(.65,height/800*camera.zoom)),
    getEmployeePosition:id=>{const a=actors.get(id);return a?{gx:a.gx,gy:a.gy}:null;},
    getSubagentPosition:(id,index)=>{for(const h of helpers.values())if(h.owner===id&&h.index===index)return{gx:h.gx,gy:h.gy};return null;},
  };
}
