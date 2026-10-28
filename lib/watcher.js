'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { SessionState } = require('./state');

const SESSION_ROOT = path.join(os.homedir(), '.copilot', 'session-state');
const POLL_MS = 800;
const LOCK_RE = /^inuse\.(\d+)\.lock$/;

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Watches ~/.copilot/session-state for live CLI sessions (via inuse.<pid>.lock)
 * and tails each live session's events.jsonl, feeding lines into SessionState.
 * Emits 'change' with the full snapshot whenever anything updates.
 */
class OfficeWatcher extends EventEmitter {
  constructor(root = SESSION_ROOT) {
    super();
    this.root = root;
    this.tracked = new Map(); // sessionId -> { state, offset, partial }
    this.timer = null;
  }

  start() {
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_MS);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
  }

  liveSessionIds() {
    let dirs;
    try {
      dirs = fs.readdirSync(this.root);
    } catch {
      return [];
    }
    const live = [];
    for (const id of dirs) {
      const dir = path.join(this.root, id);
      let entries;
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue;
      }
      const hasLive = entries.some((f) => {
        const m = LOCK_RE.exec(f);
        return m && pidAlive(Number(m[1]));
      });
      if (hasLive && entries.includes('events.jsonl')) live.push(id);
    }
    return live;
  }

  poll() {
    const live = new Set(this.liveSessionIds());
    let changed = false;

    for (const id of [...this.tracked.keys()]) {
      if (!live.has(id)) {
        this.tracked.delete(id);
        changed = true;
      }
    }

    for (const id of live) {
      if (!this.tracked.has(id)) {
        this.tracked.set(id, { state: new SessionState(id), offset: 0, partial: '' });
        changed = true;
      }
      if (this.readNew(id)) changed = true;
    }

    if (changed) this.emit('change', this.snapshot());
  }

  readNew(id) {
    const t = this.tracked.get(id);
    const file = path.join(this.root, id, 'events.jsonl');
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      return false;
    }
    if (stat.size < t.offset) {
      // truncated/rotated — rebuild from scratch
      t.offset = 0;
      t.partial = '';
      t.state = new SessionState(id);
    }
    if (stat.size === t.offset) return false;

    let fd;
    try {
      fd = fs.openSync(file, 'r');
      const len = stat.size - t.offset;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, t.offset);
      t.offset = stat.size;
      const text = t.partial + buf.toString('utf8');
      const lines = text.split('\n');
      t.partial = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          t.state.apply(JSON.parse(line));
        } catch {
          /* skip malformed line */
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }

  snapshot() {
    const sessions = [...this.tracked.values()]
      .map((t) => t.state.toJSON())
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    return { type: 'snapshot', at: new Date().toISOString(), sessions };
  }
}

module.exports = { OfficeWatcher, SESSION_ROOT };
