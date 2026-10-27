import test from 'node:test';
import assert from 'node:assert/strict';

import { StorageAdapter, STORAGE_KEY, PROBE_KEY, getSafeLocalStorage } from '../src/storage.js';
import { createInitialState } from '../src/schema.js';

class MockStorage {
  constructor(initialData = {}, throwOnSet = false) {
    this.store = new Map(Object.entries(initialData));
    this.throwOnSet = throwOnSet;
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: Dom storage limit reached');
    }
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
}

test('Storage: Probe succeeds with working backend', () => {
  const backend = new MockStorage();
  const adapter = new StorageAdapter(backend);
  assert.equal(adapter.probe(), true);
  // Ensure probe key was safely removed
  assert.equal(backend.getItem(PROBE_KEY), null);
});

test('Storage: Probe failure switches to memory mode', () => {
  const brokenBackend = new MockStorage({}, true); // throws on set
  const adapter = new StorageAdapter(brokenBackend);
  assert.equal(adapter.probe(), false);

  const res = adapter.load();
  assert.equal(adapter.status, 'memory');
  assert.equal(res.mode, 'memory');
});

test('Storage: First launch initializes valid state', () => {
  const backend = new MockStorage();
  const adapter = new StorageAdapter(backend);
  const res = adapter.load();
  assert.equal(res.success, true);
  assert.equal(adapter.status, 'persistent');
  assert.equal(adapter.state.schemaVersion, 1);
  assert.notEqual(backend.getItem(STORAGE_KEY), null);
});

test('Storage: Malformed stored JSON enters recovery mode without overwriting raw payload', () => {
  const corruptedRaw = '{ "schemaVersion": 1, "tasks": [ broken json ...';
  const backend = new MockStorage({ [STORAGE_KEY]: corruptedRaw });
  const adapter = new StorageAdapter(backend);

  const res = adapter.load();
  assert.equal(res.success, false);
  assert.equal(adapter.status, 'recovery');
  // Raw payload must be preserved!
  assert.equal(adapter.exportRawRecoveryData(), corruptedRaw);
  assert.equal(backend.getItem(STORAGE_KEY), corruptedRaw);

  // Saving while in recovery mode must be blocked to prevent destroying raw data
  const saveAttempt = adapter.save(createInitialState());
  assert.equal(saveAttempt.success, false);
});

test('Storage: Transactional restore commits to storage first before changing in-memory state', () => {
  const initialBackend = new MockStorage();
  const adapter = new StorageAdapter(initialBackend);
  adapter.load();
  adapter.state.tasks = [{ id: 't_original', title: 'Original Task' }];
  adapter.save(adapter.state);

  const backupToRestore = {
    schemaVersion: 1,
    preferences: { theme: 'dark', startupView: 'do', currency: 'EUR' },
    tasks: [{ id: 't_restored', title: 'Restored Task' }],
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

  const res = adapter.restore(JSON.stringify(backupToRestore));
  assert.equal(res.success, true);
  assert.equal(adapter.state.tasks[0].id, 't_restored');
  assert.equal(adapter.state.preferences.currency, 'EUR');
});

test('Storage: Transactional restore write failure preserves existing state untouched', () => {
  const backend = new MockStorage();
  const adapter = new StorageAdapter(backend);
  adapter.load();
  adapter.state.tasks = [{ id: 't_safe', title: 'Must Stay Safe' }];
  adapter.save(adapter.state);

  // Now simulate storage becoming read-only / throwing quota error
  backend.throwOnSet = true;

  const candidateBackup = {
    schemaVersion: 1,
    preferences: { theme: 'system', startupView: 'zen', currency: 'USD' },
    tasks: [{ id: 't_new', title: 'New Task' }],
    projects: [], events: [], habits: [], habitEntries: [],
    goals: [], milestones: [], notes: [], journalEntries: [], transactions: [], budgets: []
  };

  const res = adapter.restore(JSON.stringify(candidateBackup));
  assert.equal(res.success, false);
  assert.match(res.error, /Failed to commit restored data/);
  // Canonical in-memory state must NOT have been changed!
  assert.equal(adapter.state.tasks[0].id, 't_safe');
});

test('Storage: Transactional reset write failure preserves current data', () => {
  const backend = new MockStorage();
  const adapter = new StorageAdapter(backend);
  adapter.load();
  adapter.state.tasks = [{ id: 't_keep', title: 'Keep Me' }];
  adapter.save(adapter.state);

  backend.throwOnSet = true;
  const res = adapter.reset();
  assert.equal(res.success, false);
  assert.equal(adapter.state.tasks.length, 1);
  assert.equal(adapter.state.tasks[0].id, 't_keep');
});

test('Storage: getSafeLocalStorage returns null when accessing window.localStorage throws SecurityError', () => {
  const originalWindow = globalThis.window;
  try {
    const fakeWindow = {};
    Object.defineProperty(fakeWindow, 'localStorage', {
      get() {
        throw new Error('SecurityError: Failed to read the localStorage property from Window: Access is denied for this document.');
      },
      configurable: true
    });
    globalThis.window = fakeWindow;

    const safeStorage = getSafeLocalStorage();
    assert.equal(safeStorage, null, 'getSafeLocalStorage must catch SecurityError and return null');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('Storage: StorageAdapter defaults to memory mode when backend throws SecurityError on probe', () => {
  const securityErrorBackend = {
    getItem() {
      throw new Error('SecurityError: Access is denied');
    },
    setItem() {
      throw new Error('SecurityError: Access is denied');
    },
    removeItem() {
      throw new Error('SecurityError: Access is denied');
    }
  };

  const adapter = new StorageAdapter(securityErrorBackend);
  const probeOk = adapter.probe();
  assert.equal(probeOk, false);
  assert.equal(adapter.status, 'memory');

  const loadRes = adapter.load();
  assert.equal(loadRes.success, true);
  assert.equal(loadRes.mode, 'memory');
  assert.equal(adapter.status, 'memory');
});

test('Storage: StorageAdapter with null backend operates safely in memory mode', () => {
  const adapter = new StorageAdapter(null);
  assert.equal(adapter.probe(), false);
  const loadRes = adapter.load();
  assert.equal(loadRes.success, true);
  assert.equal(loadRes.mode, 'memory');
  assert.equal(adapter.status, 'memory');

  // Mutate and save in memory
  adapter.state.tasks = [{ id: 't_mem', title: 'Memory Task' }];
  const saveRes = adapter.save();
  assert.equal(saveRes.success, true);
  assert.equal(saveRes.mode, 'memory');
  assert.equal(adapter.state.tasks[0].title, 'Memory Task');
});

