/**
 * Daylight — Schema & Data Integrity
 * Complete validation, normalization, and migration rules.
 */

import { isValidDateString } from './dates.js';
import { SUPPORTED_CURRENCIES } from './finance.js';
import { isValidHexColor, normalizeHexColor } from './color.js';

export const CURRENT_SCHEMA_VERSION = 1;

export function createInitialState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    preferences: {
      theme: 'system',
      startupView: 'zen',
      currency: 'USD',
      activeSection: 'today',
      accentColor: null
    },
    tasks: [],
    projects: [],
    events: [],
    habits: [],
    habitEntries: [],
    goals: [],
    milestones: [],
    notes: [],
    journalEntries: [],
    transactions: [],
    budgets: []
  };
}

/**
 * Validates candidate data structure strictly.
 * Returns { valid: boolean, error?: string, warnings?: string[] }
 */
export function validateState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Data must be a non-null object' };
  }

  // Schema version check
  if (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) {
    return { valid: false, error: 'Invalid or missing schemaVersion' };
  }
  if (data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { valid: false, error: `Unsupported newer schema version (${data.schemaVersion}). This version of Daylight supports schema v${CURRENT_SCHEMA_VERSION}.` };
  }

  // Preferences check
  if (!data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) {
    return { valid: false, error: 'Missing or invalid preferences object' };
  }
  const validThemes = ['system', 'light', 'dark'];
  if (data.preferences.theme && !validThemes.includes(data.preferences.theme)) {
    return { valid: false, error: `Invalid theme preference: ${data.preferences.theme}` };
  }
  const validViews = ['zen', 'do'];
  if (data.preferences.startupView && !validViews.includes(data.preferences.startupView)) {
    return { valid: false, error: `Invalid startupView preference: ${data.preferences.startupView}` };
  }
  if (data.preferences.currency && !SUPPORTED_CURRENCIES[data.preferences.currency]) {
    return { valid: false, error: `Unsupported currency code: ${data.preferences.currency}` };
  }
  if (data.preferences.accentColor !== undefined && data.preferences.accentColor !== null) {
    if (typeof data.preferences.accentColor !== 'string' || !isValidHexColor(data.preferences.accentColor)) {
      return { valid: false, error: `Invalid accentColor preference: ${data.preferences.accentColor}. Must be a valid 6-character hex code or null.` };
    }
  }

  const collections = [
    'tasks', 'projects', 'events', 'habits', 'habitEntries',
    'goals', 'milestones', 'notes', 'journalEntries', 'transactions', 'budgets'
  ];

  for (const col of collections) {
    if (!Array.isArray(data[col])) {
      return { valid: false, error: `Collection '${col}' must be an array` };
    }
  }

  // 1. Validate Projects
  const projectIds = new Set();
  for (let i = 0; i < data.projects.length; i++) {
    const p = data.projects[i];
    if (!p || typeof p !== 'object') return { valid: false, error: `Project at index ${i} is invalid` };
    if (typeof p.id !== 'string' || !p.id.trim()) return { valid: false, error: `Project at index ${i} has invalid ID` };
    if (projectIds.has(p.id)) return { valid: false, error: `Duplicate project ID: ${p.id}` };
    projectIds.add(p.id);
    if (typeof p.name !== 'string' || !p.name.trim()) return { valid: false, error: `Project ${p.id} missing name` };
  }

  // 2. Validate Tasks
  const taskIds = new Set();
  const taskParentMap = new Map();
  for (let i = 0; i < data.tasks.length; i++) {
    const t = data.tasks[i];
    if (!t || typeof t !== 'object') return { valid: false, error: `Task at index ${i} is invalid` };
    if (typeof t.id !== 'string' || !t.id.trim()) return { valid: false, error: `Task at index ${i} has invalid ID` };
    if (taskIds.has(t.id)) return { valid: false, error: `Duplicate task ID: ${t.id}` };
    taskIds.add(t.id);
    if (typeof t.title !== 'string' || !t.title.trim()) return { valid: false, error: `Task ${t.id} missing title` };

    if (t.priority && !['low', 'normal', 'high'].includes(t.priority)) {
      return { valid: false, error: `Task ${t.id} has invalid priority: ${t.priority}` };
    }
    if (t.dueDate !== null && t.dueDate !== undefined) {
      if (!isValidDateString(t.dueDate)) {
        return { valid: false, error: `Task ${t.id} has invalid dueDate: ${t.dueDate}` };
      }
    }
    if (t.parentId) {
      if (t.parentId === t.id) {
        return { valid: false, error: `Task ${t.id} cannot be its own parent` };
      }
      taskParentMap.set(t.id, t.parentId);
    }
  }

  // Check subtask cycles
  for (const [childId, parentId] of taskParentMap.entries()) {
    const visited = new Set([childId]);
    let curr = parentId;
    while (curr) {
      if (visited.has(curr)) {
        return { valid: false, error: `Cyclic subtask relationship detected involving task: ${curr}` };
      }
      visited.add(curr);
      curr = taskParentMap.get(curr);
    }
  }

  // 3. Validate Events
  const eventIds = new Set();
  for (let i = 0; i < data.events.length; i++) {
    const e = data.events[i];
    if (!e || typeof e !== 'object') return { valid: false, error: `Event at index ${i} is invalid` };
    if (typeof e.id !== 'string' || !e.id.trim()) return { valid: false, error: `Event at index ${i} has invalid ID` };
    if (eventIds.has(e.id)) return { valid: false, error: `Duplicate event ID: ${e.id}` };
    eventIds.add(e.id);
    if (typeof e.title !== 'string' || !e.title.trim()) return { valid: false, error: `Event ${e.id} missing title` };
    if (!isValidDateString(e.date)) return { valid: false, error: `Event ${e.id} has invalid date: ${e.date}` };
    if (e.startTime && e.endTime && e.endTime < e.startTime) {
      return { valid: false, error: `Event ${e.id} has end time earlier than start time` };
    }
  }

  // 4. Validate Habits
  const habitIds = new Set();
  const validRecurrences = ['daily', 'weekdays', 'custom'];
  for (let i = 0; i < data.habits.length; i++) {
    const h = data.habits[i];
    if (!h || typeof h !== 'object') return { valid: false, error: `Habit at index ${i} is invalid` };
    if (typeof h.id !== 'string' || !h.id.trim()) return { valid: false, error: `Habit at index ${i} has invalid ID` };
    if (habitIds.has(h.id)) return { valid: false, error: `Duplicate habit ID: ${h.id}` };
    habitIds.add(h.id);
    if (typeof h.name !== 'string' || !h.name.trim()) return { valid: false, error: `Habit ${h.id} missing name` };
    if (h.recurrence && !validRecurrences.includes(h.recurrence)) {
      return { valid: false, error: `Habit ${h.id} has invalid recurrence: ${h.recurrence}` };
    }
    if (h.recurrence === 'custom') {
      if (!Array.isArray(h.scheduledDays) || h.scheduledDays.length === 0) {
        return { valid: false, error: `Habit ${h.id} with custom recurrence must have at least one scheduled day` };
      }
    }
    if (h.scheduledDays !== undefined) {
      if (!Array.isArray(h.scheduledDays)) {
        return { valid: false, error: `Habit ${h.id} scheduledDays must be an array` };
      }
      for (const d of h.scheduledDays) {
        if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6) {
          return { valid: false, error: `Habit ${h.id} scheduledDays contains invalid day index: ${d}` };
        }
      }
    }
  }

  // 5. Validate Habit Entries
  const habitEntryIds = new Set();
  for (let i = 0; i < data.habitEntries.length; i++) {
    const he = data.habitEntries[i];
    if (!he || typeof he !== 'object') return { valid: false, error: `Habit entry at index ${i} is invalid` };
    if (typeof he.id !== 'string' || !he.id.trim()) return { valid: false, error: `Habit entry at index ${i} has invalid ID` };
    if (habitEntryIds.has(he.id)) return { valid: false, error: `Duplicate habit entry ID: ${he.id}` };
    habitEntryIds.add(he.id);
    if (!isValidDateString(he.date)) return { valid: false, error: `Habit entry ${he.id} has invalid date: ${he.date}` };
  }

  // 6. Validate Goals
  const goalIds = new Set();
  for (let i = 0; i < data.goals.length; i++) {
    const g = data.goals[i];
    if (!g || typeof g !== 'object') return { valid: false, error: `Goal at index ${i} is invalid` };
    if (typeof g.id !== 'string' || !g.id.trim()) return { valid: false, error: `Goal at index ${i} has invalid ID` };
    if (goalIds.has(g.id)) return { valid: false, error: `Duplicate goal ID: ${g.id}` };
    goalIds.add(g.id);
    if (typeof g.title !== 'string' || !g.title.trim()) return { valid: false, error: `Goal ${g.id} missing title` };
    if (g.targetDate && !isValidDateString(g.targetDate)) {
      return { valid: false, error: `Goal ${g.id} has invalid targetDate: ${g.targetDate}` };
    }
  }

  // 7. Validate Milestones
  const milestoneIds = new Set();
  for (let i = 0; i < data.milestones.length; i++) {
    const m = data.milestones[i];
    if (!m || typeof m !== 'object') return { valid: false, error: `Milestone at index ${i} is invalid` };
    if (typeof m.id !== 'string' || !m.id.trim()) return { valid: false, error: `Milestone at index ${i} has invalid ID` };
    if (milestoneIds.has(m.id)) return { valid: false, error: `Duplicate milestone ID: ${m.id}` };
    milestoneIds.add(m.id);
    if (typeof m.title !== 'string' || !m.title.trim()) return { valid: false, error: `Milestone ${m.id} missing title` };
  }

  // 8. Validate Notes
  const noteIds = new Set();
  for (let i = 0; i < data.notes.length; i++) {
    const n = data.notes[i];
    if (!n || typeof n !== 'object') return { valid: false, error: `Note at index ${i} is invalid` };
    if (typeof n.id !== 'string' || !n.id.trim()) return { valid: false, error: `Note at index ${i} has invalid ID` };
    if (noteIds.has(n.id)) return { valid: false, error: `Duplicate note ID: ${n.id}` };
    noteIds.add(n.id);
    const hasTitle = typeof n.title === 'string' && n.title.trim().length > 0;
    const hasBody = typeof n.body === 'string' && n.body.trim().length > 0;
    if (!hasTitle && !hasBody) {
      return { valid: false, error: `Note ${n.id} must have a non-empty title or body` };
    }
  }

  // 9. Validate Journal Entries
  const journalIds = new Set();
  for (let i = 0; i < data.journalEntries.length; i++) {
    const j = data.journalEntries[i];
    if (!j || typeof j !== 'object') return { valid: false, error: `Journal entry at index ${i} is invalid` };
    if (typeof j.id !== 'string' || !j.id.trim()) return { valid: false, error: `Journal entry at index ${i} has invalid ID` };
    if (journalIds.has(j.id)) return { valid: false, error: `Duplicate journal entry ID: ${j.id}` };
    journalIds.add(j.id);
    if (!isValidDateString(j.date)) return { valid: false, error: `Journal entry ${j.id} has invalid date: ${j.date}` };
    if (typeof j.body !== 'string' || !j.body.trim()) return { valid: false, error: `Journal entry ${j.id} has empty body` };
  }

  // 10. Validate Transactions
  const txIds = new Set();
  for (let i = 0; i < data.transactions.length; i++) {
    const tx = data.transactions[i];
    if (!tx || typeof tx !== 'object') return { valid: false, error: `Transaction at index ${i} is invalid` };
    if (typeof tx.id !== 'string' || !tx.id.trim()) return { valid: false, error: `Transaction at index ${i} has invalid ID` };
    if (txIds.has(tx.id)) return { valid: false, error: `Duplicate transaction ID: ${tx.id}` };
    txIds.add(tx.id);

    if (tx.type !== 'expense' && tx.type !== 'income') {
      return { valid: false, error: `Transaction ${tx.id} has invalid type: ${tx.type}` };
    }
    if (typeof tx.amount !== 'number' || !Number.isInteger(tx.amount) || tx.amount <= 0) {
      return { valid: false, error: `Transaction ${tx.id} amount must be a positive integer in minor units` };
    }
    if (!isValidDateString(tx.date)) {
      return { valid: false, error: `Transaction ${tx.id} has invalid date: ${tx.date}` };
    }
    if (typeof tx.category !== 'string' || !tx.category.trim()) {
      return { valid: false, error: `Transaction ${tx.id} missing category` };
    }
  }

  // 11. Validate Budgets
  for (let i = 0; i < data.budgets.length; i++) {
    const b = data.budgets[i];
    if (!b || typeof b !== 'object') return { valid: false, error: `Budget at index ${i} is invalid` };
    if (typeof b.month !== 'string' || !/^\d{4}-\d{2}$/.test(b.month)) {
      return { valid: false, error: `Budget at index ${i} has invalid month: ${b.month}` };
    }
    if (typeof b.limit !== 'number' || !Number.isInteger(b.limit) || b.limit <= 0) {
      return { valid: false, error: `Budget at index ${i} limit must be a positive integer in minor units` };
    }
  }

  return { valid: true };
}

/**
 * Normalizes state and cleans up dangling references gracefully.
 */
export function normalizeAndCleanState(data) {
  const clean = JSON.parse(JSON.stringify(data));
  const projectIds = new Set(clean.projects.map(p => p.id));
  const taskIds = new Set(clean.tasks.map(t => t.id));
  const goalIds = new Set(clean.goals.map(g => g.id));
  const habitIds = new Set(clean.habits.map(h => h.id));

  // Clean task references
  clean.tasks = clean.tasks.map(t => {
    let changed = false;
    let projectId = t.projectId;
    let parentId = t.parentId;

    if (projectId && !projectIds.has(projectId)) {
      projectId = null;
      changed = true;
    }
    if (parentId && !taskIds.has(parentId)) {
      parentId = null;
      changed = true;
    }

    return changed ? { ...t, projectId, parentId } : t;
  });

  // Clean milestones whose goal no longer exists
  clean.milestones = clean.milestones.filter(m => goalIds.has(m.goalId));

  // Clean habit entries whose habit no longer exists
  clean.habitEntries = clean.habitEntries.filter(he => habitIds.has(he.habitId));

  // Normalize habit schedules
  clean.habits = clean.habits.map(h => {
    let recurrence = h.recurrence || 'daily';
    if (!['daily', 'weekdays', 'custom'].includes(recurrence)) {
      recurrence = 'daily';
    }
    let scheduledDays = Array.isArray(h.scheduledDays) ? [...h.scheduledDays] : [];
    if (recurrence === 'daily') {
      scheduledDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (recurrence === 'weekdays') {
      scheduledDays = [1, 2, 3, 4, 5];
    } else if (recurrence === 'custom') {
      scheduledDays = [...new Set(scheduledDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
      if (scheduledDays.length === 0) scheduledDays = [0, 1, 2, 3, 4, 5, 6];
    }
    return { ...h, recurrence, scheduledDays };
  });

  // Clean goal linkedTaskIds whose tasks no longer exist
  clean.goals = clean.goals.map(g => {
    if (Array.isArray(g.linkedTaskIds)) {
      const validLinks = g.linkedTaskIds.filter(id => taskIds.has(id));
      if (validLinks.length !== g.linkedTaskIds.length) {
        return { ...g, linkedTaskIds: validLinks };
      }
    }
    return g;
  });

  // Normalize preferences
  if (!clean.preferences || typeof clean.preferences !== 'object') {
    clean.preferences = {};
  }
  clean.preferences.theme = clean.preferences.theme || 'system';
  clean.preferences.startupView = clean.preferences.startupView || 'zen';
  clean.preferences.currency = clean.preferences.currency || 'USD';
  clean.preferences.activeSection = clean.preferences.activeSection || 'today';
  if (clean.preferences.accentColor) {
    clean.preferences.accentColor = normalizeHexColor(clean.preferences.accentColor);
  } else {
    clean.preferences.accentColor = null;
  }

  return clean;
}
