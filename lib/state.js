'use strict';

const path = require('path');

const TRUNC = 120;

function truncate(s, n = TRUNC) {
  if (!s) return '';
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function toolDetail(toolName, args) {
  if (!args) return '';
  switch (toolName) {
    case 'bash':
      return truncate(args.description || args.command);
    case 'view':
    case 'create':
    case 'edit':
      return truncate(args.path ? path.basename(args.path) : '');
    case 'grep':
    case 'glob':
      return truncate(args.pattern);
    case 'task':
      return truncate(args.description || args.name);
    case 'web_fetch':
      return truncate(args.url);
    default: {
      const v = args.description || args.query || args.prompt || '';
      return truncate(v);
    }
  }
}

/**
 * Reduces a stream of Copilot CLI events.jsonl entries into a single
 * "employee" view model for the virtual office.
 */
class SessionState {
  constructor(sessionId) {
    this.id = sessionId;
    this.cwd = null;
    this.model = null;
    this.startTime = null;
    this.status = 'idle'; // idle | thinking | working
    this.currentTool = null; // { name, detail, startedAt }
    this.lastUserMessage = '';
    this.lastAssistantMessage = '';
    this.lastActivity = null;
    this.toolCount = 0;
    this.turnCount = 0;
    this.subagents = new Map(); // agentId -> { name, model, startedAt }
    this.recent = []; // small ticker feed
  }

  _feed(text, timestamp) {
    this.recent.push({ text: truncate(text, 90), t: timestamp });
    if (this.recent.length > 8) this.recent.shift();
  }

  apply(ev) {
    const { type, data = {}, timestamp } = ev;
    this.lastActivity = timestamp || this.lastActivity;

    switch (type) {
      case 'session.start':
        this.cwd = (data.context && data.context.cwd) || this.cwd;
        this.model = data.selectedModel || this.model;
        this.startTime = data.startTime || timestamp;
        break;

      case 'session.model_change':
        this.model = data.model || data.newModel || data.selectedModel || this.model;
        break;

      case 'user.message':
        this.lastUserMessage = truncate(data.content || data.text || '');
        this.status = 'thinking';
        this._feed(`📨 ${this.lastUserMessage}`, timestamp);
        break;

      case 'assistant.turn_start':
        this.status = 'thinking';
        this.turnCount++;
        break;

      case 'assistant.message':
        this.lastAssistantMessage = truncate(data.content || data.text || '');
        break;

      case 'assistant.turn_end':
        this.status = 'idle';
        this.currentTool = null;
        break;

      case 'tool.execution_start':
        this.status = 'working';
        this.currentTool = {
          name: data.toolName || 'tool',
          detail: toolDetail(data.toolName, data.arguments),
          startedAt: timestamp,
        };
        this._feed(`🔧 ${this.currentTool.name}: ${this.currentTool.detail}`, timestamp);
        break;

      case 'tool.execution_complete':
        this.toolCount++;
        this.currentTool = null;
        if (this.status === 'working') this.status = 'thinking';
        break;

      case 'subagent.started':
        if (ev.agentId) {
          this.subagents.set(ev.agentId, {
            id: ev.agentId,
            name: data.agentDisplayName || data.agentName || 'agent',
            model: data.model || null,
            startedAt: timestamp,
          });
          this._feed(`🤝 subagent: ${data.agentName || 'agent'}`, timestamp);
        }
        break;

      case 'subagent.completed':
      case 'subagent.failed':
      case 'subagent.cancelled':
        if (ev.agentId) this.subagents.delete(ev.agentId);
        break;

      default:
        break;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.cwd ? path.basename(this.cwd) : this.id.slice(0, 8),
      cwd: this.cwd,
      model: this.model,
      startTime: this.startTime,
      status: this.status,
      currentTool: this.currentTool,
      lastUserMessage: this.lastUserMessage,
      lastAssistantMessage: this.lastAssistantMessage,
      lastActivity: this.lastActivity,
      toolCount: this.toolCount,
      turnCount: this.turnCount,
      subagents: [...this.subagents.values()],
      recent: this.recent,
    };
  }
}

module.exports = { SessionState };
