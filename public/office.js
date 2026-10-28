/* Copilot Virtual Office — a little illustrated work village. */
'use strict';

(function () {
  const W = 1200, H = 800;
  const INK = '#454338';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1, width: W, height: H };
  const DESK_SLOTS = [
    { gx: 270, gy: 470 }, { gx: 595, gy: 445 }, { gx: 915, gy: 480 },
    { gx: 445, gy: 665 }, { gx: 755, gy: 685 },
    { gx: 165, gy: 690 }, { gx: 1050, gy: 690 },
  ];
  const ZONES = [];
  const walkers = new Map();
  const helperPositions = new Map();
  const fx = [];
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let night = false, lastFrame = 0;

  function modelColor(model) {
    const m = String(model || '').toLowerCase();
    if (m.includes('claude')) return '#b86d4d';
    if (m.includes('gpt') || m.includes('codex') || m.startsWith('o')) return '#37856d';
    if (m.includes('gemini')) return '#567fa4';
    return '#8d7097';
  }

  function hash(s) {
    let n = 2166136261;
    for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  }

  function shape(fill, stroke = INK, width = 3.5) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill, stroke = INK, width = 3.5) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); shape(fill, stroke, width);
  }
  function box(x, y, w, h, r, fill, stroke = INK, width = 3.5) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); shape(fill, stroke, width);
  }
  function line(points, color = INK, width = 3.5) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function label(text, x, y, size = 16, color = INK) {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  }
  function shadow(x, y, rx = 43, ry = 10) {
    ellipse(x, y, rx, ry, 'rgba(59,89,49,.13)', null);
  }
  function cloud(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-48, 9);
    ctx.bezierCurveTo(-73, -7, -38, -29, -22, -22);
    ctx.bezierCurveTo(-11, -46, 30, -35, 35, -19);
    ctx.bezierCurveTo(64, -18, 76, 9, 47, 13);
    ctx.bezierCurveTo(8, 17, -19, 15, -48, 9);
    shape(night ? '#656d86' : '#fffef8', null); ctx.restore();
  }
  function flower(x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      ellipse(Math.sin(a) * 6, Math.cos(a) * 6, 4.5, 5, color, null);
    }
    ellipse(0, 0, 3, 3, '#e7b75e', null); ctx.restore();
  }
  function tree(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    shadow(0, 3, 55, 10);
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-8, -86); ctx.lineTo(12, -86); ctx.lineTo(13, 0); ctx.closePath();
    shape('#cfa16b');
    ellipse(-35, -74, 37, 33, night ? '#59765f' : '#94c17b');
    ellipse(36, -77, 36, 33, night ? '#628169' : '#a0ca83');
    ellipse(0, -111, 43, 40, night ? '#6d8d73' : '#afd98e');
    ellipse(-13, -126, 11, 7, night ? '#8fa58b' : '#d4e9ae', null);
    line([[1, -45], [1, -17]], '#ab7c55', 3); ctx.restore();
  }
  function sign(text, x, y, width = 126, fill = '#fff3bf') {
    box(x - 5, y + 10, 10, 34, 3, '#c79564', INK, 3);
    box(x - width / 2, y - 17, width, 34, 7, fill, INK, 3);
    label(text, x, y, 15);
    ellipse(x - width / 2 + 10, y, 2, 2, '#a08e65', null);
    ellipse(x + width / 2 - 10, y, 2, 2, '#a08e65', null);
  }

  function background(t) {
    const left = -view.ox / view.scale, top = -view.oy / view.scale;
    const width = view.width / view.scale, height = view.height / view.scale;
    ctx.fillStyle = night ? '#39465f' : '#c5e7ee';
    ctx.fillRect(left, top, width, height);
    const drift = reducedMotion ? 0 : Math.sin(t / 24000) * 12;
    cloud(200 + drift, 105, .85); cloud(780 - drift, 114, .62); cloud(1070 + drift, 183, .7);
    ellipse(1010, 93, 65, 65, night ? '#59637b' : '#e2edbf', null);
    ellipse(1010, 93, 43, 43, night ? '#fff2c5' : '#fff0a4', null);
    if (night) ellipse(1027, 78, 37, 37, '#59637b', null);
    else {
      ellipse(998, 92, 2.5, 4, '#b9934f', null); ellipse(1022, 92, 2.5, 4, '#b9934f', null);
      ctx.beginPath(); ctx.arc(1010, 96, 7, .2, Math.PI - .2); shape(null, '#b9934f', 2);
    }
    if (night) {
      for (let i = 0; i < 28; i++) {
        const x = (i * 173 + 41) % W, y = (i * 47 + 25) % 245;
        ellipse(x, y, i % 3 === 0 ? 2 : 1.2, i % 3 === 0 ? 2 : 1.2, '#f7edcf', null);
      }
    }
    ctx.beginPath(); ctx.moveTo(left - 10, 330);
    ctx.bezierCurveTo(80, 210, 245, 240, 450, 290);
    ctx.bezierCurveTo(700, 180, 950, 260, left + width + 10, 310);
    ctx.lineTo(left + width + 10, top + height); ctx.lineTo(left - 10, top + height); ctx.closePath();
    shape(night ? '#536e61' : '#c4db9c', null);
    ctx.beginPath(); ctx.moveTo(left - 10, 360);
    ctx.bezierCurveTo(240, 300, 390, 325, 620, 335);
    ctx.bezierCurveTo(870, 345, 1020, 290, left + width + 10, 340);
    ctx.lineTo(left + width + 10, top + height + 1); ctx.lineTo(left - 10, top + height + 1); ctx.closePath();
    shape(night ? '#66836c' : '#a8cd8b', null);
    ctx.beginPath(); ctx.moveTo(left - 20, 590);
    ctx.bezierCurveTo(270, 535, 440, 555, 600, 545);
    ctx.bezierCurveTo(850, 530, 960, 560, left + width + 20, 520);
    ctx.strokeStyle = night ? '#a9a184' : '#e8d9ad'; ctx.lineWidth = 37; ctx.stroke();
    const plants = [[68,455],[370,385],[740,414],[1090,420],[94,640],[322,720],[1110,746],[815,751],[575,745],[55,751],[1000,565],[1120,570],[378,514],[820,507]];
    for (let i = 0; i < plants.length; i++) {
      const [x, y] = plants[i];
      if (i % 2 === 0) flower(x, y, .9, i % 4 ? '#fffaf0' : '#f1c0bd');
      else line([[x - 5, y - 8], [x, y + 2], [x + 4, y - 11], [x, y + 2], [x + 11, y - 5]], night ? '#8ca887' : '#7ca96e', 3);
    }
    tree(105, 355, 1.03); tree(1080, 354, .93); tree(1165, 610, .69);
  }

  function cottage() {
    shadow(600, 356, 150, 15);
    box(468, 335, 263, 24, 5, '#c49b75');
    box(481, 210, 236, 131, 6, night ? '#c7bd9f' : '#fff0cd');
    ctx.beginPath(); ctx.moveTo(462, 220); ctx.lineTo(488, 166); ctx.lineTo(711, 166); ctx.lineTo(736, 220); ctx.closePath();
    shape(night ? '#aa8080' : '#dba69a');
    for (let i = 0; i < 5; i++) line([[494 + i * 43, 172], [481 + i * 50, 215]], '#bc8d83', 2);
    box(535, 234, 63, 107, 7, '#b88c6a');
    box(545, 246, 43, 56, 5, night ? '#f3d998' : '#d9eef0', INK, 3);
    line([[566, 248], [566, 301]], '#ad8e74', 3);
    ellipse(585, 317, 3.5, 3.5, '#f4daa0', INK, 1.5);
    box(624, 242, 66, 55, 7, night ? '#f3d998' : '#d5e9ec');
    line([[657, 244], [657, 295]], '#b29676', 3);
    line([[626, 269], [689, 269]], '#b29676', 3);
    box(525, 181, 148, 32, 9, '#fff9e8', INK, 2.5); label('작은 작업실', 599, 197, 18);
    box(628, 298, 60, 12, 3, '#bf916d', INK, 2.5);
    for (let i = 0; i < 4; i++) flower(635 + i * 15, 296 - i % 2 * 4, .65, i % 2 ? '#f3beb6' : '#fff1c3');
    box(495, 298, 21, 33, 4, '#b5c895', INK, 2.5);
    line([[505, 300], [505, 273]], '#6a8d61', 3);
    ellipse(498, 280, 8, 4, '#8db87c', null); ellipse(512, 286, 8, 4, '#8db87c', null);
  }

  function picnic() {
    shadow(593, 714, 221, 20);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(376, 548, 442, 183, 35); ctx.clip();
    ctx.fillStyle = night ? '#bf9da7' : '#f8d8df'; ctx.fillRect(376, 548, 442, 183);
    ctx.fillStyle = night ? '#ad8999' : '#f1bdcb';
    for (let x = 387; x < 820; x += 60) ctx.fillRect(x, 548, 30, 183);
    ctx.globalAlpha = .55;
    for (let y = 559; y < 740; y += 60) ctx.fillRect(376, y, 442, 30);
    ctx.restore();
    box(376, 548, 442, 183, 35, null, INK, 3.5);
    ctx.setLineDash([6, 7]); box(386, 558, 422, 163, 27, null, '#fff5ed', 2); ctx.setLineDash([]);
    ellipse(595, 613, 45, 13, '#c09875', INK, 3);
    ctx.beginPath(); ctx.moveTo(551, 607); ctx.lineTo(562, 641); ctx.quadraticCurveTo(595, 653, 629, 641); ctx.lineTo(639, 607); ctx.closePath(); shape('#dbb384');
    line([[558, 621], [632, 621]], '#ba8e64', 2.5); line([[562, 632], [629, 632]], '#ba8e64', 2.5);
    ellipse(577, 603, 13, 10, '#fff5de', INK, 2.5); ellipse(601, 602, 13, 12, '#d7e9b3', INK, 2.5); ellipse(620, 605, 11, 9, '#f1bbb2', INK, 2.5);
    ctx.beginPath(); ctx.moveTo(568, 603); ctx.bezierCurveTo(568, 569, 622, 569, 622, 603); shape(null, INK, 4);
    cup(403, 708, '#a6ccd2', 1); cup(791, 708, '#f2d590', 1);
  }

  function cup(x, y, color, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ellipse(12, -10, 6, 6, null, INK, 2.5);
    box(-10, -21, 24, 23, 5, color, INK, 2.5);
    ellipse(2, -20, 10, 3, '#9f785b', INK, 2); ctx.restore();
  }

  function garden() {
    ellipse(221, 502, 100, 25, '#d6b587', INK, 3);
    for (let i = 0; i < 5; i++) {
      const x = 156 + i * 32, y = 499 + i % 2 * 8;
      line([[x, y + 3], [x, y - 12]], '#7b9b60', 3);
      ellipse(x - 6, y - 8, 7, 3.5, '#92b56e', null); ellipse(x + 6, y - 12, 7, 3.5, '#92b56e', null);
    }
    sign('아이디어 텃밭', 211, 366, 144, '#fff4c8');
    sign('잠깐, 쉬어가요', 938, 594, 148, '#f9e6bb');
    box(84, 660, 12, 84, 4, '#bf9364', INK, 2.5);
    box(53, 620, 72, 56, [22, 22, 4, 4], '#dc9690');
    line([[65, 645], [109, 645]], INK, 4);
    box(119, 632, 16, 28, 3, '#f5d889', INK, 3);
    // The outdoor coffee counter.
    box(846, 359, 147, 16, 4, '#d5ae7f');
    box(854, 375, 12, 43, 3, '#bb9166', INK, 3);
    box(973, 375, 12, 43, 3, '#bb9166', INK, 3);
    box(858, 316, 40, 43, 5, '#e4dec9', INK, 3);
    box(865, 325, 26, 18, 3, '#7c8e8c', INK, 2);
    cup(925, 355, '#f4e1b3', .8); cup(962, 355, '#c1dbd4', .8);
    label('COFFEE & IDEAS', 921, 395, 10, '#6d634e');
  }

  function mascot(x, y, seed, status, t, accent, scale = 1, walking = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const kind = seed % 4;
    const fur = ['#fffdf1', '#fff1ce', '#eef1e8', '#f9e5d5'][kind];
    const bob = reducedMotion ? 0 : walking ? Math.sin(t / 95) * 3 : Math.sin(t / 600 + seed % 10) * 1.3;
    shadow(0, 1, 38, 8);
    ctx.translate(0, bob);
    // Ears sit behind the soft, one-piece silhouette.
    if (kind === 1) {
      ellipse(-19, -92, 10, 25, fur); ellipse(18, -92, 10, 25, fur);
      ellipse(-19, -94, 4, 15, '#efc8ba', null); ellipse(18, -94, 4, 15, '#efc8ba', null);
    } else if (kind === 2) {
      ctx.beginPath(); ctx.moveTo(-37, -64); ctx.lineTo(-35, -101); ctx.quadraticCurveTo(-25, -107, -10, -78); ctx.closePath(); shape(fur);
      ctx.beginPath(); ctx.moveTo(9, -78); ctx.quadraticCurveTo(26, -108, 35, -99); ctx.lineTo(38, -63); ctx.closePath(); shape(fur);
      line([[-30, -87], [-22, -80]], '#d3b9ae', 4); line([[25, -82], [30, -89]], '#d3b9ae', 4);
    } else {
      ellipse(-25, -83, 14, 15, fur); ellipse(25, -83, 14, 15, fur);
      ellipse(-25, -84, 6, 7, '#efd3c1', null); ellipse(25, -84, 6, 7, '#efd3c1', null);
    }
    const legSwing = walking && !reducedMotion ? Math.sin(t / 95) * 3 : 0;
    ellipse(-16, -5 + legSwing, 10, 10, fur); ellipse(16, -5 - legSwing, 10, 10, fur);
    ctx.beginPath(); ctx.moveTo(-38, -55);
    ctx.bezierCurveTo(-39, -83, -18, -91, 0, -91);
    ctx.bezierCurveTo(24, -92, 42, -77, 41, -53);
    ctx.bezierCurveTo(47, -35, 40, -14, 28, -9);
    ctx.bezierCurveTo(10, 0, -12, -1, -29, -11);
    ctx.bezierCurveTo(-43, -20, -47, -39, -38, -55); ctx.closePath(); shape(fur);
    // Floppy arms, rosy cheeks, and tiny face.
    ellipse(-40, -29, 6, 12, fur, INK, 2.5); ellipse(40, -29, 6, 12, fur, INK, 2.5);
    ellipse(-26, -43, 9, 5, '#efb8b2', null); ellipse(26, -43, 9, 5, '#efb8b2', null);
    const blink = status === 'sleep' || (!reducedMotion && Math.floor(t / 130 + seed % 19) % 36 === 0);
    if (blink) {
      line([[-18, -54], [-13, -51], [-8, -54]], INK, 2.5);
      line([[8, -54], [13, -51], [18, -54]], INK, 2.5);
    } else {
      ellipse(-13, -55, 4.3, 5.4, INK, null); ellipse(13, -55, 4.3, 5.4, INK, null);
      ellipse(-14, -57, 1.4, 1.7, '#fff', null); ellipse(12, -57, 1.4, 1.7, '#fff', null);
    }
    ellipse(0, -46, 2.7, 2, '#8b6a58', null);
    ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(-2, -35, 0, -41); ctx.quadraticCurveTo(3, -35, 7, -40); shape(null, INK, 2);
    box(-11, -24, 22, 10, 5, accent, null);
    if (status === 'working') {
      box(-30, -27, 60, 31, 5, '#b8d2d1', INK, 3);
      box(-24, -22, 48, 19, 3, '#edf6e9', INK, 1.5);
      line([[-14, -14], [-19, -10], [-14, -6]], accent, 2);
      line([[13, -14], [18, -10], [13, -6]], accent, 2);
      line([[3, -15], [-2, -5]], accent, 2);
      box(-34, 1, 68, 5, 3, '#8caaa8', INK, 2.5);
    } else if (status === 'idle') cup(6, -11, '#eed397', .9);
    else if (status === 'thinking') {
      line([[30, -28], [20, -43]], INK, 3);
      for (let i = 0; i < 3; i++) ellipse(48 + i * 8, -82 - i * 8, 2.7, 2.7, '#799083', null);
    } else if (status === 'sleep') label('z z', 44, -91 - (reducedMotion ? 0 : Math.sin(t / 800) * 4), 15, night ? '#eddfcb' : '#6b8062');
    ctx.restore();
  }

  function updateWalker(emp, dt, now) {
    const slot = emp._slot;
    let w = walkers.get(emp.id);
    if (!w) {
      w = { gx: slot.gx, gy: slot.gy, mode: 'home', nextTrip: now + 12000 + hash(emp.id) % 10000 };
      walkers.set(emp.id, w);
    }
    const idleMs = emp.lastActivity ? Date.now() - new Date(emp.lastActivity).getTime() : 0;
    const sleepy = emp.status === 'idle' && idleMs > 180000;
    if (w.mode === 'home' && emp.status === 'idle' && idleMs > 6000 && !sleepy && now > w.nextTrip && !reducedMotion) w.mode = 'out';
    if ((emp.status !== 'idle' || sleepy) && w.mode !== 'home') w.mode = 'back';
    if (w.mode === 'coffee' && now > w.until) w.mode = 'back';
    if (w.mode === 'out' || w.mode === 'back') {
      const target = w.mode === 'out' ? { gx: 820, gy: 448 } : slot;
      const dx = target.gx - w.gx, dy = target.gy - w.gy, distance = Math.hypot(dx, dy);
      const step = (emp.status === 'idle' ? 46 : 170) * dt / 1000;
      if (distance <= step) {
        w.gx = target.gx; w.gy = target.gy;
        if (w.mode === 'out') { w.mode = 'coffee'; w.until = now + 3500; }
        else { w.mode = 'home'; w.nextTrip = now + 23000 + hash(emp.id) % 18000; }
      } else { w.gx += dx / distance * step; w.gy += dy / distance * step; }
    } else if (w.mode === 'home') { w.gx = slot.gx; w.gy = slot.gy; }
    return { w, sleepy };
  }

  function fit() {
    view.width = canvas.clientWidth || window.innerWidth;
    view.height = canvas.clientHeight || window.innerHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(view.width * view.dpr); canvas.height = Math.round(view.height * view.dpr);
    view.scale = Math.max(.1, Math.min(view.width / W, view.height / H));
    view.ox = (view.width - W * view.scale) / 2; view.oy = (view.height - H * view.scale) / 2;
  }
  function toScreen(gx, gy, dy = 0) {
    return { x: gx * view.scale + view.ox, y: (gy + dy) * view.scale + view.oy };
  }
  function addFx(gx, gy, dy, type) {
    fx.push({ gx, gy: gy + dy, type, born: performance.now() });
    if (fx.length > 24) fx.shift();
  }
  function drawEffects(now) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], age = now - f.born;
      if (age > 1100) { fx.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = 1 - age / 1100;
      const y = f.gy - age / 30;
      if (f.type === 'check') {
        ellipse(f.gx, y, 13, 13, '#fff9e8', '#659c75', 2);
        line([[f.gx - 6, y], [f.gx - 1, y + 5], [f.gx + 7, y - 6]], '#659c75', 3);
      } else {
        ctx.beginPath(); ctx.moveTo(f.gx, y + 10);
        ctx.bezierCurveTo(f.gx - 29, y - 6, f.gx - 9, y - 21, f.gx, y - 8);
        ctx.bezierCurveTo(f.gx + 9, y - 21, f.gx + 29, y - 6, f.gx, y + 10); shape('#eaa6af', '#b97e85', 2);
      }
      ctx.restore();
    }
  }
  function render(employees, t) {
    const now = performance.now(), dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
    lastFrame = now;
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * view.ox, view.dpr * view.oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    background(t); cottage(); picnic(); garden();
    // Resident animals keep the village alive, even before teammates arrive.
    mascot(1021, 323, 0, 'idle', t, '#dfb579', .69);
    mascot(857 + (reducedMotion ? 0 : Math.sin(t / 10000) * 18), 710, 2, 'sleep', t, '#90ad8a', .52);
    const seen = new Set(), items = [];
    helperPositions.clear();
    for (const emp of employees) {
      if (!emp._slot) continue;
      seen.add(emp.id);
      const { w, sleepy } = updateWalker(emp, dt, now);
      const walking = w.mode === 'out' || w.mode === 'back';
      items.push({ y: w.gy, draw: () => mascot(w.gx, w.gy, hash(emp.id), sleepy ? 'sleep' : emp.status, t, modelColor(emp.model), 1, walking) });
      const positions = [];
      (emp.subagents || []).slice(0, 4).forEach((sub, i) => {
        const p = { gx: w.gx + (i % 2 === 0 ? -1 : 1) * (66 + Math.floor(i / 2) * 38), gy: w.gy + 28 + Math.floor(i / 2) * 31 };
        positions.push(p);
        items.push({ y: p.gy, draw: () => mascot(p.gx, p.gy, hash(sub.id || sub.name), 'working', t, modelColor(sub.model), .39) });
      });
      helperPositions.set(emp.id, positions);
    }
    for (const id of walkers.keys()) if (!seen.has(id)) walkers.delete(id);
    items.sort((a, b) => a.y - b.y).forEach(item => item.draw());
    drawEffects(now);
  }

  window.addEventListener('resize', fit); fit();
  window.Office = {
    render, toScreen, fit, DESK_SLOTS, ZONES, modelColor, addFx,
    setTheme: name => { night = name === 'night'; },
    getScale: () => view.scale,
    getEmployeePosition: id => walkers.get(id) || null,
    getSubagentPosition: (id, index) => (helperPositions.get(id) || [])[index] || null,
  };
})();
