/* Copilot Virtual Office — data layer + DOM overlays */
'use strict';

(function () {
  const overlay = document.getElementById('overlay');
  const tickerEl = document.getElementById('ticker');
  const liveEl = document.getElementById('liveCount');
  const emptyEl = document.getElementById('empty');
  const connectionEl = document.getElementById('connectionStatus');

  let employees = [];
  const slotOf = new Map(); // sessionId -> slot index
  const doms = new Map();   // key -> {tag, bubble}

  // demo mode (?demo=1): fake teammates for showcase/screenshots
  const demoMode = new URLSearchParams(location.search).has('demo');
  function demoEmployees() {
    const now = Date.now();
    return [
      { id: 'demo-a', name: '작은 개발자', model: 'Claude', status: 'working', toolCount: 42,
        lastActivity: new Date(now).toISOString(), currentTool: { name: 'view', detail: 'scene.ts' },
        subagents: [], recent: [] },
      { id: 'demo-b', name: '느긋한 친구', model: 'GPT', status: 'idle', toolCount: 7,
        lastActivity: new Date(now - 30000).toISOString(), subagents: [], recent: [] },
      { id: 'demo-c', name: '꼼꼼한 기록가', model: 'Gemini', status: 'thinking', toolCount: 3,
        lastActivity: new Date(now).toISOString(), lastUserMessage: '계획표 정리 중', subagents: [], recent: [] },
    ];
  }
  const demoSessions = demoMode ? demoEmployees() : [];
  document.getElementById('demoBadge').hidden = !demoMode;

  function assignSlots(list) {
    const ids = new Set(list.map((e) => e.id));
    for (const id of [...slotOf.keys()]) if (!ids.has(id)) slotOf.delete(id);
    const used = new Set(slotOf.values());
    for (const emp of list) {
      if (!slotOf.has(emp.id)) {
        let i = 0;
        while (used.has(i) && i < Office.DESK_SLOTS.length) i++;
        if (i < Office.DESK_SLOTS.length) { slotOf.set(emp.id, i); used.add(i); }
      }
      const idx = slotOf.get(emp.id);
      emp._slot = idx !== undefined ? Office.DESK_SLOTS[idx] : null;
    }
  }

  // ---- websocket -------------------------------------------------------
  function connect() {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
    ws.onopen = () => {
      document.body.dataset.connected = 'true';
      connectionEl.textContent = 'Copilot 실시간 연결';
    };
    ws.onmessage = (ev) => {
      try {
        const snap = JSON.parse(ev.data);
        employees = snap.sessions || [];
        if (demoMode) employees = employees.concat(demoSessions);
        assignSlots(employees);
        popEmotes();
        updateChrome();
        updateTicker();
      } catch { /* ignore */ }
    };
    ws.onclose = () => {
      document.body.dataset.connected = 'false';
      connectionEl.textContent = '연결이 끊겼어요 · 다시 연결 중';
      setTimeout(connect, 1500);
    };
    ws.onerror = () => ws.close();
  }

  function updateChrome() {
    const seated = employees.filter((e) => e._slot).length;
    const extra = employees.length - seated;
    liveEl.textContent = `친구 ${employees.length}명${extra > 0 ? ` · ${extra}명 대기` : ''}`;
    emptyEl.style.display = employees.length ? 'none' : 'flex';
    document.title = `(${employees.length}) 코파일럿 마을 · Copilot Virtual Office`;
  }

  function updateTicker() {
    const rows = [];
    for (const e of employees) {
      for (const r of e.recent || []) rows.push({ t: r.t, name: e.name, text: r.text });
    }
    rows.sort((a, b) => String(a.t).localeCompare(String(b.t)));
    tickerEl.innerHTML = rows.slice(-3).reverse().map((r) => {
      const time = r.t ? new Date(r.t).toLocaleTimeString('ko-KR', { hour12: false }) : '';
      return `<div class="row">${time} <b>${esc(r.name)}</b> ${esc(r.text)}</div>`;
    }).join('') || (demoMode ? '데모 친구들이 마을을 구경하고 있어요. 실제 세션을 열면 새 친구가 찾아와요.' : '오늘도 작은 아이디어가 자라는 중이에요.');
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---- emote pops (diff snapshots) ---------------------------------------
  const prevStats = new Map(); // id -> {toolCount, status}
  function popEmotes() {
    const ids = new Set();
    for (const emp of employees) {
      ids.add(emp.id);
      const prev = prevStats.get(emp.id);
      if (prev && emp._slot) {
        const s = Office.getEmployeePosition(emp.id) || emp._slot;
        if ((emp.toolCount || 0) > (prev.toolCount || 0)) {
          Office.addFx(s.gx, s.gy, -105, 'check');
        }
        if (prev.status !== 'idle' && emp.status === 'idle') {
          Office.addFx(s.gx + 12, s.gy, -112, 'heart');
        }
      }
      prevStats.set(emp.id, { toolCount: emp.toolCount || 0, status: emp.status });
    }
    for (const id of [...prevStats.keys()]) if (!ids.has(id)) prevStats.delete(id);
  }

  // ---- DOM overlay sync --------------------------------------------------
  function ensureDom(key, kind) {
    let d = doms.get(key);
    if (!d) {
      d = document.createElement('div');
      d.className = kind;
      overlay.appendChild(d);
      doms.set(key, d);
    }
    return d;
  }

  function activityText(emp, idleMs) {
    if (emp.status === 'working') {
      const tool = emp.currentTool || {};
      const detail = tool.detail || '';
      if (tool.name === 'view') return `📖 ${detail || '파일'} 읽는 중`;
      if (tool.name === 'edit' || tool.name === 'create') return `✏️ ${detail || '코드'} 다듬는 중`;
      if (tool.name === 'bash') return `💻 ${detail || '명령 실행 중'}`;
      if (tool.name === 'grep' || tool.name === 'glob') return `🔎 ${detail || '자료'} 찾는 중`;
      return `💻 ${tool.name || '작업 중'}${detail ? ` · ${detail}` : ''}`;
    }
    if (emp.status === 'thinking') return `📝 ${emp.lastUserMessage || '곰곰이 생각 중'}`;
    return idleMs > 3 * 60 * 1000 ? '💤 잠깐 꿈나라 여행 중' : '☕ 잠깐 쉬어 가는 중';
  }

  function syncOverlays() {
    const alive = new Set();
    const scale = Math.min(1.15, Math.max(0.65, Office.getScale()));
    for (const emp of employees) {
      if (!emp._slot) continue;
      const s = Office.getEmployeePosition(emp.id) || emp._slot;
      const idleMs = emp.lastActivity ? Date.now() - new Date(emp.lastActivity).getTime() : 0;
      const mood = emp.status === 'working' ? '작업 중' : emp.status === 'thinking' ? '생각 중' : idleMs > 180000 ? '자는 중' : '쉬는 중';

      const tagKey = `tag:${emp.id}`;
      alive.add(tagKey);
      const tag = ensureDom(tagKey, 'tag');
      const tp = Office.toScreen(s.gx, s.gy, 14);
      tag.style.transform = `translate(${tp.x}px, ${tp.y}px) translateX(-50%) scale(${scale})`;
      const html = `<div class="name">${esc(emp.name)}</div>` +
        `<div class="model"><span class="model-dot" style="background:${Office.modelColor(emp.model)}"></span>${esc(emp.model || 'Copilot')} · ${esc(mood)} · ${emp.toolCount || 0}회</div>`;
      if (tag.innerHTML !== html) tag.innerHTML = html;

      const bKey = `bubble:${emp.id}`;
      alive.add(bKey);
      const bubble = ensureDom(bKey, 'bubble');
      bubble.classList.toggle('ghost', emp.status === 'thinking');
      bubble.classList.toggle('rest', emp.status === 'idle');
      const bp = Office.toScreen(s.gx, s.gy, -120);
      bubble.style.transform = `translate(${bp.x}px, ${bp.y}px) translate(-50%, -100%) scale(${scale})`;
      const text = activityText(emp, idleMs);
      const content = `<span class="message">${esc(text)}</span>`;
      if (bubble.innerHTML !== content) bubble.innerHTML = content;
      bubble.title = text;

      (emp.subagents || []).slice(0, 4).forEach((sub, i) => {
        const pos = Office.getSubagentPosition(emp.id, i);
        if (!pos) return;
        const key = `sub:${emp.id}:${sub.id}`;
        alive.add(key);
        const el = ensureDom(key, 'tag helper');
        const p = Office.toScreen(pos.gx, pos.gy, 8);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translateX(-50%) scale(${scale})`;
        const html = `<div class="name">${esc(sub.name)}</div>`;
        if (el.innerHTML !== html) el.innerHTML = html;
      });
    }
    for (const [key, el] of doms) {
      if (!alive.has(key)) { el.remove(); doms.delete(key); }
    }
  }

  // ---- zone labels -------------------------------------------------------
  const zoneEls = (Office.ZONES || []).map((z) => {
    const el = document.createElement('div');
    el.className = 'zone';
    el.textContent = z.name;
    overlay.appendChild(el);
    return { z, el };
  });
  function syncZones() {
    for (const { z, el } of zoneEls) {
      const p = Office.toScreen(z.gx, z.gy, 0);
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    }
  }

  // ---- theme -----------------------------------------------------------
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(name) {
    document.body.dataset.theme = name;
    Office.setTheme(name);
    document.getElementById('themeIcon').textContent = name === 'day' ? '☾' : '☀';
    document.getElementById('themeLabel').textContent = name === 'day' ? '밤 풍경' : '낮 풍경';
    themeBtn.setAttribute('aria-label', name === 'day' ? '밤 풍경으로 전환' : '낮 풍경으로 전환');
    try { localStorage.setItem('vo-theme', name); } catch { /* ignore */ }
  }
  let theme = 'day';
  try { theme = localStorage.getItem('vo-theme') || 'day'; } catch { /* ignore */ }
  const urlTheme = new URLSearchParams(location.search).get('theme');
  if (urlTheme === 'day' || urlTheme === 'night') theme = urlTheme;
  applyTheme(theme);
  themeBtn.addEventListener('click', () => {
    theme = theme === 'day' ? 'night' : 'day';
    applyTheme(theme);
  });

  // ---- loop ----------------------------------------------------------------
  function frame(t) {
    Office.render(employees, t);
    syncOverlays();
    syncZones();
    requestAnimationFrame(frame);
  }

  connect();
  if (demoMode) { employees = demoSessions; assignSlots(employees); }
  updateChrome();
  updateTicker();
  requestAnimationFrame(frame);
})();
