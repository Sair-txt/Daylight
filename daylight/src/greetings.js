/**
 * Daylight — Thoughtful Zen Greeting System
 * Combines time-of-day greeting with a quiet, reflective daily supporting message.
 * Rotates deterministically on each local calendar day without external dependencies.
 */

import { getLocalDateString } from './dates.js';

export const ZEN_SUPPORTING_MESSAGES = [
  "Make room for what matters.",
  "One thing at a time.",
  "Start where you are.",
  "Let the day unfold.",
  "A little clarity goes a long way.",
  "Keep it simple today.",
  "Give the important things space.",
  "Begin your day gently.",
  "Today can begin simply.",
  "Leave a little room to breathe.",
  "Choose what deserves your attention.",
  "Small steps still count.",
  "Focus on the next right step.",
  "Move at a steady, honest pace.",
  "Clear space for quiet focus.",
  "Notice the progress already made."
];

/**
 * Returns the primary time-based greeting based on local hour (0-23).
 */
export function getTimeOfDayGreeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Deterministically returns the daily supporting message for a given local date string (YYYY-MM-DD).
 * Stable throughout the entire local calendar day regardless of re-renders or view switching.
 */
export function getDailyZenMessage(dateStr = getLocalDateString()) {
  if (!dateStr || typeof dateStr !== 'string') {
    dateStr = getLocalDateString();
  }

  // Polynomial hash of the local YYYY-MM-DD string
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }

  const index = Math.abs(hash) % ZEN_SUPPORTING_MESSAGES.length;
  return ZEN_SUPPORTING_MESSAGES[index];
}
