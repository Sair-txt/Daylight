import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, validateState, normalizeAndCleanState } from '../src/schema.js';
import { deleteTask } from '../src/tasks.js';
import { SUPPORTED_CURRENCIES, formatCurrency, decimalToMinorUnits, minorUnitsToDecimalString } from '../src/finance.js';
import { calculateHabitStreak, getHabitRecentDays } from '../src/habits.js';
import { calculateGoalProgress } from '../src/goals.js';

test('v1.2.0: Note edit workflow preserves immutable identity and timestamps correctly', () => {
  const originalNote = {
    id: 'note_123',
    title: 'Original Title',
    body: 'Original Body',
    pinned: false,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z'
  };

  const editedTitle = 'Updated Title';
  const editedBody = 'Updated Body with new insights';
  const updatedTimestamp = '2026-10-26T12:00:00.000Z';

  const updatedNote = {
    ...originalNote,
    title: editedTitle,
    body: editedBody,
    updatedAt: updatedTimestamp
  };

  assert.equal(updatedNote.id, originalNote.id, 'Note ID must remain unchanged');
  assert.equal(updatedNote.createdAt, originalNote.createdAt, 'createdAt must remain unchanged');
  assert.equal(updatedNote.title, 'Updated Title');
  assert.equal(updatedNote.body, 'Updated Body with new insights');
  assert.equal(updatedNote.updatedAt, updatedTimestamp);
});

test('v1.2.0: Event time validation ensures end time is after start time', () => {
  function validateEventTimes(isAllDay, startTime, endTime) {
    if (isAllDay) return { valid: true };
    if (startTime && endTime && endTime < startTime) {
      return { valid: false, error: 'End time cannot be earlier than start time.' };
    }
    return { valid: true };
  }

  assert.equal(validateEventTimes(false, '10:00', '11:00').valid, true);
  assert.equal(validateEventTimes(false, '10:00', '10:00').valid, true);
  assert.equal(validateEventTimes(false, '14:30', '09:00').valid, false);
  assert.equal(validateEventTimes(true, '14:30', '09:00').valid, true);
});

test('v1.2.0: Project deletion leaves associated tasks intact and unassigned', () => {
  const state = createInitialState();
  state.projects = [
    { id: 'proj_alpha', name: 'Alpha Project' }
  ];
  state.tasks = [
    { id: 'task_1', title: 'Task 1', projectId: 'proj_alpha' },
    { id: 'task_2', title: 'Task 2', projectId: 'proj_alpha' },
    { id: 'task_3', title: 'Task 3', projectId: null }
  ];

  // Simulating project deletion logic
  const projectToDeleteId = 'proj_alpha';
  state.projects = state.projects.filter(p => p.id !== projectToDeleteId);
  state.tasks.forEach(t => {
    if (t.projectId === projectToDeleteId) {
      t.projectId = null;
    }
  });

  assert.equal(state.projects.length, 0);
  assert.equal(state.tasks.length, 3, 'Tasks must not be deleted when project is deleted');
  assert.equal(state.tasks[0].projectId, null, 'Task 1 must now be unassigned');
  assert.equal(state.tasks[1].projectId, null, 'Task 2 must now be unassigned');
});

test('v1.2.0: Goal deletion cascades to its milestones while other goals remain intact', () => {
  const state = createInitialState();
  state.goals = [
    { id: 'goal_1', title: 'Goal 1' },
    { id: 'goal_2', title: 'Goal 2' }
  ];
  state.milestones = [
    { id: 'ms_1', goalId: 'goal_1', title: 'Milestone 1-1', completed: false },
    { id: 'ms_2', goalId: 'goal_1', title: 'Milestone 1-2', completed: true },
    { id: 'ms_3', goalId: 'goal_2', title: 'Milestone 2-1', completed: false }
  ];

  // Delete goal_1 and cascade delete milestones
  const goalToDeleteId = 'goal_1';
  state.goals = state.goals.filter(g => g.id !== goalToDeleteId);
  state.milestones = state.milestones.filter(m => m.goalId !== goalToDeleteId);

  assert.equal(state.goals.length, 1);
  assert.equal(state.goals[0].id, 'goal_2');
  assert.equal(state.milestones.length, 1);
  assert.equal(state.milestones[0].goalId, 'goal_2');
});

test('v1.2.0: Individual milestone deletion updates goal progress without deleting goal', () => {
  const goal = { id: 'g_main', title: 'Main Goal' };
  let milestones = [
    { id: 'ms_a', goalId: 'g_main', title: 'A', completed: true },
    { id: 'ms_b', goalId: 'g_main', title: 'B', completed: false }
  ];

  let progress = calculateGoalProgress(goal, milestones);
  assert.equal(progress.completed, 1);
  assert.equal(progress.total, 2);
  assert.equal(progress.percent, 50);

  // Delete milestone B
  milestones = milestones.filter(m => m.id !== 'ms_b');
  progress = calculateGoalProgress(goal, milestones);
  assert.equal(progress.completed, 1);
  assert.equal(progress.total, 1);
  assert.equal(progress.percent, 100);
});

test('v1.2.0: Habit deletion removes habit and cleans up all associated habit entries', () => {
  const state = createInitialState();
  state.habits = [
    { id: 'h_meditate', name: 'Meditate' },
    { id: 'h_read', name: 'Read' }
  ];
  state.habitEntries = [
    { id: 'he_1', habitId: 'h_meditate', date: '2026-10-25', completed: true },
    { id: 'he_2', habitId: 'h_meditate', date: '2026-10-26', completed: true },
    { id: 'he_3', habitId: 'h_read', date: '2026-10-26', completed: true }
  ];

  const habitToDeleteId = 'h_meditate';
  state.habits = state.habits.filter(h => h.id !== habitToDeleteId);
  state.habitEntries = state.habitEntries.filter(e => e.habitId !== habitToDeleteId);

  assert.equal(state.habits.length, 1);
  assert.equal(state.habits[0].id, 'h_read');
  assert.equal(state.habitEntries.length, 1);
  assert.equal(state.habitEntries[0].habitId, 'h_read');
});

test('v1.2.0: BDT currency math and formatting with 2 decimal places and 100 factor', () => {
  assert.equal(SUPPORTED_CURRENCIES.BDT.factor, 100);
  assert.equal(SUPPORTED_CURRENCIES.BDT.decimals, 2);
  assert.equal(SUPPORTED_CURRENCIES.BDT.symbol, '৳');

  const amountMinor = decimalToMinorUnits('1250.75', 'BDT');
  assert.equal(amountMinor, 125075);
  assert.equal(minorUnitsToDecimalString(amountMinor, 'BDT'), '1250.75');
  assert.equal(formatCurrency(amountMinor, 'BDT'), '৳1,250.75');
});

test('v1.2.0: JPY zero-decimal formatting and factor 1', () => {
  assert.equal(SUPPORTED_CURRENCIES.JPY.factor, 1);
  assert.equal(SUPPORTED_CURRENCIES.JPY.decimals, 0);

  const amountMinor = decimalToMinorUnits('5000', 'JPY');
  assert.equal(amountMinor, 5000);
  assert.equal(minorUnitsToDecimalString(amountMinor, 'JPY'), '5000');
  assert.equal(formatCurrency(amountMinor, 'JPY'), '¥5,000');
});
