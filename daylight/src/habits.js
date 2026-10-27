/**
 * Daylight — Habits Logic
 * Evaluates completion and streaks strictly against scheduled days.
 * Unscheduled days are never treated as failures or broken streaks.
 */

import { parseLocalDate, getLocalDateString } from './dates.js';

export function calculateHabitStreak(habit, entries = [], referenceDateStr = getLocalDateString()) {
  const refDate = parseLocalDate(referenceDateStr) || new Date();
  const scheduledDays = Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0
    ? habit.scheduledDays
    : [0, 1, 2, 3, 4, 5, 6];

  const entryMap = new Map();
  for (const e of entries) {
    if (e.habitId === habit.id && e.completed) {
      entryMap.set(e.date, true);
    }
  }

  let streak = 0;
  let curr = new Date(refDate);

  const todayStr = getLocalDateString(curr);
  const isTodayScheduled = scheduledDays.includes(curr.getDay());

  if (isTodayScheduled && entryMap.has(todayStr)) {
    streak++;
    curr.setDate(curr.getDate() - 1);
  } else if (!isTodayScheduled) {
    // Unscheduled today does not break streak, check backward
    curr.setDate(curr.getDate() - 1);
  } else {
    // Scheduled today but not checked off yet: check from yesterday
    curr.setDate(curr.getDate() - 1);
  }

  // Look backward up to 365 days
  for (let i = 0; i < 365; i++) {
    const isScheduled = scheduledDays.includes(curr.getDay());
    const dateStr = getLocalDateString(curr);

    if (isScheduled) {
      if (entryMap.has(dateStr)) {
        streak++;
      } else {
        break; // Streak boundary reached
      }
    }
    // If not scheduled, skip without penalty
    curr.setDate(curr.getDate() - 1);
  }

  return streak;
}

export function getHabitRecentDays(habit, entries = [], daysCount = 7, referenceDateStr = getLocalDateString()) {
  if (typeof daysCount === 'string') {
    const temp = daysCount;
    daysCount = typeof referenceDateStr === 'number' ? referenceDateStr : 7;
    referenceDateStr = temp;
  }
  const scheduledDays = Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0
    ? habit.scheduledDays
    : [0, 1, 2, 3, 4, 5, 6];

  const entryMap = new Map();
  for (const e of entries) {
    if (e.habitId === habit.id && e.completed) {
      entryMap.set(e.date, true);
    }
  }

  const result = [];
  const curr = parseLocalDate(referenceDateStr) || new Date();
  
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(curr);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const isScheduled = scheduledDays.includes(d.getDay());
    const isCompleted = entryMap.has(dateStr);
    result.push({
      date: dateStr,
      dayOfWeek: d.getDay(),
      isScheduled,
      isCompleted
    });
  }
  return result;
}
