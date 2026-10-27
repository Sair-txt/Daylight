import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CURRENT_SCHEMA_VERSION,
  createInitialState,
  validateState,
  normalizeAndCleanState
} from '../src/schema.js';
import { isValidDateString, parseLocalDate, addDays } from '../src/dates.js';

test('Schema: Empty state initializes with valid schema v1', () => {
  const state = createInitialState();
  assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(state.preferences.theme, 'system');
  assert.equal(state.preferences.startupView, 'zen');
  assert.equal(state.preferences.currency, 'USD');
  const res = validateState(state);
  assert.equal(res.valid, true);
});

test('Schema: Rejects malformed or non-object root', () => {
  assert.equal(validateState(null).valid, false);
  assert.equal(validateState([]).valid, false);
  assert.equal(validateState('string').valid, false);
  assert.equal(validateState(123).valid, false);
});

test('Schema: Rejects unsupported newer schema versions', () => {
  const futureState = { ...createInitialState(), schemaVersion: 999 };
  const res = validateState(futureState);
  assert.equal(res.valid, false);
  assert.match(res.error, /Unsupported newer schema version/);
});

test('Schema: Rejects invalid preferences (theme, startupView, currency)', () => {
  const badTheme = { ...createInitialState(), preferences: { theme: 'neon' } };
  assert.equal(validateState(badTheme).valid, false);

  const badView = { ...createInitialState(), preferences: { startupView: 'calendar' } };
  assert.equal(validateState(badView).valid, false);

  const badCurrency = { ...createInitialState(), preferences: { currency: 'BITCOIN' } };
  assert.equal(validateState(badCurrency).valid, false);
});

test('Schema: Rejects duplicate IDs in any collection', () => {
  const state = createInitialState();
  state.tasks = [
    { id: 't1', title: 'Task 1' },
    { id: 't1', title: 'Task 2' } // duplicate ID!
  ];
  const res = validateState(state);
  assert.equal(res.valid, false);
  assert.match(res.error, /Duplicate task ID/);
});

test('Schema: Rejects tasks with self-parenting or circular subtask cycles', () => {
  const selfParent = createInitialState();
  selfParent.tasks = [{ id: 't1', title: 'Task 1', parentId: 't1' }];
  assert.equal(validateState(selfParent).valid, false);

  const cyclicState = createInitialState();
  cyclicState.tasks = [
    { id: 't1', title: 'Task 1', parentId: 't3' },
    { id: 't2', title: 'Task 2', parentId: 't1' },
    { id: 't3', title: 'Task 3', parentId: 't2' }
  ];
  const res = validateState(cyclicState);
  assert.equal(res.valid, false);
  assert.match(res.error, /Cyclic subtask relationship/);
});

test('Schema: Rejects invalid date formats or impossible calendar dates', () => {
  assert.equal(isValidDateString('2026-10-24'), true);
  assert.equal(isValidDateString('2026-02-28'), true);
  assert.equal(isValidDateString('2026-02-29'), false); // 2026 is not a leap year!
  assert.equal(isValidDateString('2026-13-01'), false); // month 13
  assert.equal(isValidDateString('2026-04-31'), false); // April has 30 days
  assert.equal(isValidDateString('10/24/2026'), false);
  assert.equal(isValidDateString('invalid'), false);

  const invalidTaskDate = createInitialState();
  invalidTaskDate.tasks = [{ id: 't1', title: 'Task', dueDate: '2026-02-30' }];
  assert.equal(validateState(invalidTaskDate).valid, false);
});

test('Schema: Normalization cleans dangling references predictably', () => {
  const dirtyState = createInitialState();
  dirtyState.tasks = [
    { id: 't1', title: 'Task 1', projectId: 'non_existent_p1', parentId: 'non_existent_parent' }
  ];
  dirtyState.milestones = [
    { id: 'm1', goalId: 'non_existent_g1', title: 'Orphan milestone' }
  ];
  dirtyState.habitEntries = [
    { id: 'he1', habitId: 'non_existent_h1', date: '2026-10-24', completed: true }
  ];
  dirtyState.goals = [
    { id: 'g1', title: 'Goal 1', linkedTaskIds: ['t1', 'deleted_task_id'] }
  ];

  const cleaned = normalizeAndCleanState(dirtyState);
  assert.equal(cleaned.tasks[0].projectId, null);
  assert.equal(cleaned.tasks[0].parentId, null);
  assert.equal(cleaned.milestones.length, 0);
  assert.equal(cleaned.habitEntries.length, 0);
  assert.deepEqual(cleaned.goals[0].linkedTaskIds, ['t1']);
});

test('Schema: Accepts BDT as supported currency in preferences', () => {
  const bdtState = createInitialState();
  bdtState.preferences.currency = 'BDT';
  const res = validateState(bdtState);
  assert.equal(res.valid, true);
});

test('Schema: Habit recurrence supports custom schedule with validation and normalization', () => {
  const customHabitState = createInitialState();
  customHabitState.habits = [{
    id: 'h_custom',
    name: 'Workout on MWF',
    recurrence: 'custom',
    scheduledDays: [1, 3, 5],
    status: 'active'
  }];
  assert.equal(validateState(customHabitState).valid, true);

  // Rejects empty scheduledDays
  const emptyDaysState = createInitialState();
  emptyDaysState.habits = [{
    id: 'h_empty',
    name: 'No days',
    recurrence: 'custom',
    scheduledDays: [],
    status: 'active'
  }];
  assert.equal(validateState(emptyDaysState).valid, false);

  // Rejects invalid day index (7)
  const badDayState = createInitialState();
  badDayState.habits = [{
    id: 'h_badday',
    name: 'Bad day',
    recurrence: 'custom',
    scheduledDays: [1, 7],
    status: 'active'
  }];
  assert.equal(validateState(badDayState).valid, false);

  // Normalization sorts and deduplicates days
  const unnormalizedState = createInitialState();
  unnormalizedState.habits = [{
    id: 'h_norm',
    name: 'Sort me',
    recurrence: 'custom',
    scheduledDays: [5, 1, 3, 1, 5],
    status: 'active'
  }];
  const normalized = normalizeAndCleanState(unnormalizedState);
  assert.deepEqual(normalized.habits[0].scheduledDays, [1, 3, 5]);
});
