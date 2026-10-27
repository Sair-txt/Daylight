import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateHabitStreak, getHabitRecentDays } from '../src/habits.js';
import { calculateGoalProgress } from '../src/goals.js';

test('Habits: Streak calculation counts only scheduled days and never penalizes unscheduled days', () => {
  // Habit scheduled Mon-Fri (1, 2, 3, 4, 5)
  const weekdayHabit = {
    id: 'h_reading',
    name: 'Reading on Weekdays',
    scheduledDays: [1, 2, 3, 4, 5]
  };

  // 2026-10-23 is Friday (day 5)
  // 2026-10-24 is Saturday (day 6, unscheduled)
  // 2026-10-25 is Sunday (day 0, unscheduled)
  // 2026-10-26 is Monday (day 1)
  const entries = [
    { habitId: 'h_reading', date: '2026-10-26', completed: true }, // Monday
    // Weekend was unscheduled!
    { habitId: 'h_reading', date: '2026-10-23', completed: true }, // Friday
    { habitId: 'h_reading', date: '2026-10-22', completed: true }, // Thursday
    { habitId: 'h_reading', date: '2026-10-21', completed: true }, // Wednesday
    { habitId: 'h_reading', date: '2026-10-20', completed: true }  // Tuesday
  ];

  const streak = calculateHabitStreak(weekdayHabit, entries, '2026-10-26');
  assert.equal(streak, 5);
});

test('Goals: Progress derivation from milestones', () => {
  const goalWithMilestones = { id: 'g1', title: 'Publish Daylight', status: 'active' };
  const milestones = [
    { id: 'm1', goalId: 'g1', completed: true },
    { id: 'm2', goalId: 'g1', completed: true },
    { id: 'm3', goalId: 'g1', completed: false }
  ];

  const prog = calculateGoalProgress(goalWithMilestones, milestones);
  assert.equal(prog.hasMilestones, true);
  assert.equal(prog.completed, 2);
  assert.equal(prog.total, 3);
  assert.equal(prog.percent, 67);
  assert.equal(prog.text, '2/3 (67%)');

  const goalNoMilestones = { id: 'g2', title: 'Learn Piano', status: 'in_progress' };
  const prog2 = calculateGoalProgress(goalNoMilestones, []);
  assert.equal(prog2.hasMilestones, false);
  assert.equal(prog2.text, 'in_progress');
});

test('Habits: Custom scheduled days (e.g. Tue/Thu) streak calculation', () => {
  // Tuesday (2) and Thursday (4)
  const customHabit = {
    id: 'h_custom_run',
    name: 'Run Tue & Thu',
    recurrence: 'custom',
    scheduledDays: [2, 4]
  };

  // 2026-10-20 was Tuesday (2)
  // 2026-10-22 was Thursday (4)
  // 2026-10-27 was Tuesday (2)
  // 2026-10-29 was Thursday (4)
  const entries = [
    { habitId: 'h_custom_run', date: '2026-10-29', completed: true },
    { habitId: 'h_custom_run', date: '2026-10-27', completed: true },
    { habitId: 'h_custom_run', date: '2026-10-22', completed: true },
    { habitId: 'h_custom_run', date: '2026-10-20', completed: true }
  ];

  const streak = calculateHabitStreak(customHabit, entries, '2026-10-29');
  assert.equal(streak, 4);

  // Recent days helper includes scheduled status
  const recentDays = getHabitRecentDays(customHabit, entries, '2026-10-29', 7);
  assert.equal(recentDays.length, 7);
  // Find Thursday (2026-10-29) in recentDays
  const thu = recentDays.find(d => d.date === '2026-10-29');
  assert.ok(thu);
  assert.equal(thu.isScheduled, true);
  assert.equal(thu.isCompleted, true);
  // Find Wednesday (2026-10-28) in recentDays - unscheduled
  const wed = recentDays.find(d => d.date === '2026-10-28');
  assert.ok(wed);
  assert.equal(wed.isScheduled, false);
});

