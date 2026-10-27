/**
 * Daylight — Centralized Storage Adapter
 * Transactional restore, transactional reset, safe probe, error containment.
 */

import {
  CURRENT_SCHEMA_VERSION,
  createInitialState,
  validateState,
  normalizeAndCleanState
} from './schema.js';

export const STORAGE_KEY = 'daylight.data.v1';
export const PROBE_KEY = 'daylight.__storage_probe__';

/**
 * Safely accesses window.localStorage without throwing SecurityError
 * if third-party cookies or storage are blocked in sandboxed iframes or private browsing.
 */
export function getSafeLocalStorage() {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
      return window.localStorage;
    }
  } catch (e) {
    // SecurityError / permission denied when storage is blocked
  }
  return null;
}

export class StorageAdapter {
  constructor(backend = undefined) {
    this.backend = backend !== undefined ? backend : getSafeLocalStorage();
    this.state = createInitialState();
    this.status = 'persistent'; // 'persistent' | 'memory' | 'recovery' | 'write_error'
    this.rawCorruptedPayload = null;
    this.lastErrorMessage = null;
  }

  probe() {
    if (!this.backend) {
      this.status = 'memory';
      return false;
    }
    try {
      const probeValue = `probe_${Date.now()}_${Math.random()}`;
      this.backend.setItem(PROBE_KEY, probeValue);
      const readBack = this.backend.getItem(PROBE_KEY);
      this.backend.removeItem(PROBE_KEY);
      if (readBack === probeValue) {
        return true;
      }
      this.status = 'memory';
      return false;
    } catch (e) {
      this.status = 'memory';
      this.lastErrorMessage = e && e.message ? e.message : 'Storage probe failed';
      return false;
    }
  }

  load() {
    const isProbeOk = this.probe();
    if (!isProbeOk) {
      this.status = 'memory';
      this.state = createInitialState();
      return { success: true, mode: 'memory' };
    }

    try {
      const raw = this.backend.getItem(STORAGE_KEY);
      if (!raw) {
        // First launch: initialize valid empty state and persist it
        this.state = createInitialState();
        this.status = 'persistent';
        const saveRes = this.save(this.state);
        return { success: true, mode: saveRes.success ? 'persistent' : 'memory' };
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        // Malformed JSON: Enter Recovery Mode, preserve raw payload!
        this.rawCorruptedPayload = raw;
        this.status = 'recovery';
        this.lastErrorMessage = `Malformed JSON: ${parseErr.message}`;
        this.state = createInitialState();
        return { success: false, mode: 'recovery', error: this.lastErrorMessage };
      }

      const validation = validateState(parsed);
      if (!validation.valid) {
        // Validation failed: Enter Recovery Mode, preserve raw payload!
        this.rawCorruptedPayload = raw;
        this.status = 'recovery';
        this.lastErrorMessage = `Validation failed: ${validation.error}`;
        this.state = createInitialState();
        return { success: false, mode: 'recovery', error: this.lastErrorMessage };
      }

      // Clean dangling references safely
      this.state = normalizeAndCleanState(parsed);
      this.status = 'persistent';
      return { success: true, mode: 'persistent' };
    } catch (err) {
      this.status = 'recovery';
      this.lastErrorMessage = err && err.message ? err.message : 'Unexpected load error';
      this.rawCorruptedPayload = this.backend ? this.backend.getItem(STORAGE_KEY) : null;
      this.state = createInitialState();
      return { success: false, mode: 'recovery', error: this.lastErrorMessage };
    }
  }

  save(candidateState) {
    if (this.status === 'recovery') {
      return { success: false, error: 'Cannot save while in Recovery Mode without user resolution' };
    }

    const target = candidateState || this.state;
    const validation = validateState(target);
    if (!validation.valid) {
      return { success: false, error: `Invalid state: ${validation.error}` };
    }

    const cleaned = normalizeAndCleanState(target);
    const serialized = JSON.stringify(cleaned);

    if (this.status === 'memory' || !this.backend) {
      this.state = cleaned;
      return { success: true, mode: 'memory' };
    }

    try {
      this.backend.setItem(STORAGE_KEY, serialized);
      this.state = cleaned;
      this.status = 'persistent';
      return { success: true, mode: 'persistent' };
    } catch (err) {
      this.status = 'write_error';
      this.lastErrorMessage = err && err.message ? err.message : 'Storage write failed';
      // Keep candidate state in memory so edits are not instantly lost
      this.state = cleaned;
      return { success: false, mode: 'write_error', error: this.lastErrorMessage };
    }
  }

  /**
   * Transactional Restore:
   * 1. Parse JSON safely
   * 2. Validate full schema and data
   * 3. Attempt commit to storage FIRST
   * 4. Only after write succeeds, replace canonical in-memory state
   * 5. If write fails, retain existing state!
   */
  restore(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr) {
      return { success: false, error: `Invalid JSON file: ${parseErr.message}` };
    }

    const validation = validateState(parsed);
    if (!validation.valid) {
      return { success: false, error: `Backup validation failed: ${validation.error}` };
    }

    const candidate = normalizeAndCleanState(parsed);
    const serialized = JSON.stringify(candidate);

    if (this.backend && this.status !== 'memory') {
      try {
        this.backend.setItem(STORAGE_KEY, serialized);
      } catch (writeErr) {
        // Write failed! Leave existing state intact!
        return {
          success: false,
          error: `Failed to commit restored data to storage: ${writeErr.message}. Current data was preserved.`
        };
      }
    }

    // Storage commit succeeded -> Commit to in-memory state
    this.state = candidate;
    this.status = this.backend ? 'persistent' : 'memory';
    this.rawCorruptedPayload = null;
    return { success: true, mode: this.status, state: this.state };
  }

  /**
   * Transactional Reset:
   * Commits empty state to storage before wiping in-memory data.
   */
  reset() {
    const emptyState = createInitialState();
    const serialized = JSON.stringify(emptyState);

    if (this.backend && this.status !== 'memory') {
      try {
        this.backend.setItem(STORAGE_KEY, serialized);
      } catch (err) {
        return {
          success: false,
          error: `Storage reset write failed: ${err.message}. Current data was preserved.`
        };
      }
    }

    this.state = emptyState;
    this.status = this.backend ? 'persistent' : 'memory';
    this.rawCorruptedPayload = null;
    return { success: true };
  }

  exportSnapshot() {
    return JSON.stringify(this.state, null, 2);
  }

  exportRawRecoveryData() {
    return this.rawCorruptedPayload || '';
  }
}
