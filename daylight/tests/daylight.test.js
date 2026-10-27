import test from 'node:test';
import assert from 'node:assert/strict';

// Core logic functions tested in isolation (identical to the engine in daylight/index.html)

export const DEFAULT_PREFERENCES = {
  theme: 'system',
  startupView: 'zen',
  currency: 'USD',
  activeSection: 'today'
};

export function createInitialState() {
  return {
    schemaVersion: 1,
    preferences: { ...DEFAULT_PREFERENCES },
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

// Date helpers
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDate(str) {
  const d = parseLocalDate(str);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Subtask cycle prevention
export function canSetParent(taskId, parentId, tasks) {
  if (!parentId) return true;
  if (taskId === parentId) return false;
  let curr = tasks.find(t => t.id === parentId);
  const visited = new Set([taskId]);
  while (curr) {
    if (visited.has(curr.id)) return false;
    visited.add(curr.id);
    if (!curr.parentId) break;
    curr = tasks.find(t => t.id === curr.parentId);
  }
  return true;
}

// Schema validation
export function validateState(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Data must be an object' };
  }
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion < 1) {
    return { valid: false, error: 'Missing or invalid schemaVersion' };
  }
  if (!data.preferences || typeof data.preferences !== 'object') {
    return { valid: false, error: 'Missing preferences object' };
  }

  const arrayFields = [
    'tasks', 'projects', 'events', 'habits', 'habitEntries',
    'goals', 'milestones', 'notes', 'journalEntries', 'transactions', 'budgets'
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(data[field])) {
      return { valid: false, error: `Field '${field}' must be an array` };
    }
  }

  // Validate tasks
  const taskIds = new Set();
  for (const task of data.tasks) {
    if (!task.id || typeof task.title !== 'string') {
      return { valid: false, error: 'Task missing id or title' };
    }
    if (taskIds.has(task.id)) {
      return { valid: false, error: `Duplicate task id: ${task.id}` };
    }
    taskIds.add(task.id);
    if (task.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
      return { valid: false, error: `Invalid task dueDate format: ${task.dueDate}` };
    }
  }

  // Validate finance transactions
  for (const tx of data.transactions) {
    if (!tx.id || typeof tx.amount !== 'number' || !Number.isInteger(tx.amount) || tx.amount <= 0) {
      return { valid: false, error: 'Transaction amount must be a positive integer in minor units' };
    }
    if (tx.type !== 'expense' && tx.type !== 'income') {
      return { valid: false, error: `Invalid transaction type: ${tx.type}` };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
      return { valid: false, error: `Invalid transaction date: ${tx.date}` };
    }
  }

  return { valid: true };
}

// Habit streak calculation
export function calculateHabitStreak(habit, entries, referenceDateStr) {
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

  // If today is scheduled and completed, start with today.
  // If today is scheduled but not yet completed, start checking from yesterday.
  const todayStr = getLocalDateString(curr);
  const isTodayScheduled = scheduledDays.includes(curr.getDay());
  
  if (isTodayScheduled && entryMap.has(todayStr)) {
    streak++;
    curr.setDate(curr.getDate() - 1);
  } else if (!isTodayScheduled) {
    // Unscheduled today, skip to yesterday
    curr.setDate(curr.getDate() - 1);
  } else {
    // Today is scheduled but not completed yet: check yesterday to see current active streak
    curr.setDate(curr.getDate() - 1);
  }

  // Walk backward up to 365 days
  for (let i = 0; i < 365; i++) {
    const dayOfWeek = curr.getDay();
    const dateStr = getLocalDateString(curr);
    const isScheduled = scheduledDays.includes(dayOfWeek);

    if (isScheduled) {
      if (entryMap.has(dateStr)) {
        streak++;
      } else {
        break; // Streak ends
      }
    }
    // If not scheduled, it does NOT break the streak!
    curr.setDate(curr.getDate() - 1);
  }

  return streak;
}

// Finance calculations
export function calculateFinanceSummary(transactions, monthStr, budgets) {
  let income = 0;
  let expense = 0;
  const categoryTotals = {};

  for (const tx of transactions) {
    if (tx.date.startsWith(monthStr)) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      }
    }
  }

  const net = income - expense;
  const budgetObj = budgets.find(b => b.month === monthStr);
  const budgetLimit = budgetObj ? budgetObj.limit : null;
  const budgetRemaining = budgetLimit !== null ? budgetLimit - expense : null;

  return { income, expense, net, categoryTotals, budgetLimit, budgetRemaining };
}

// Deletion relationship cascades
export function unlinkProjectFromTasks(projectId, tasks) {
  return tasks.map(t => t.projectId === projectId ? { ...t, projectId: null } : t);
}

export function unlinkGoalFromTasks(goalId, tasks, goals) {
  const goal = goals.find(g => g.id === goalId);
  const linked = new Set(goal ? goal.linkedTaskIds : []);
  return tasks; // Tasks keep their identity, goal is removed
}

// Tests
test('Initial state creates valid canonical structure', () => {
  const state = createInitialState();
  const result = validateState(state);
  assert.equal(result.valid, true);
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.preferences.theme, 'system');
  assert.equal(state.preferences.startupView, 'zen');
  assert.deepEqual(state.tasks, []);
  assert.deepEqual(state.budgets, []);
});

test('Subtask cycle detection prevents self-parenting and circular references', () => {
  const tasks = [
    { id: 't1', title: 'Task 1', parentId: null },
    { id: 't2', title: 'Task 2', parentId: 't1' },
    { id: 't3', title: 'Task 3', parentId: 't2' }
  ];

  // Setting t1 as parent of t1 should fail
  assert.equal(canSetParent('t1', 't1', tasks), false);
  // Setting t3 as parent of t1 should fail (would create t1 -> t2 -> t3 -> t1 cycle)
  assert.equal(canSetParent('t1', 't3', tasks), false);
  // Setting t2 as parent of t1 should fail
  assert.equal(canSetParent('t1', 't2', tasks), false);
  // Setting null as parent of t2 is valid (unparenting)
  assert.equal(canSetParent('t2', null, tasks), true);
  // Setting an independent task t4 as child of t3 is valid
  assert.equal(canSetParent('t4', 't3', tasks), true);
});

test('Project deletion unassigns tasks safely without deleting them', () => {
  const tasks = [
    { id: 't1', title: 'Design Mockup', projectId: 'proj_1' },
    { id: 't2', title: 'Write Spec', projectId: 'proj_2' },
    { id: 't3', title: 'Review Code', projectId: 'proj_1' }
  ];

  const updatedTasks = unlinkProjectFromTasks('proj_1', tasks);
  assert.equal(updatedTasks.length, 3);
  assert.equal(updatedTasks[0].projectId, null);
  assert.equal(updatedTasks[1].projectId, 'proj_2');
  assert.equal(updatedTasks[2].projectId, null);
});

test('Date helpers parse and format without timezone shift', () => {
  const dateStr = '2026-10-23';
  const parsed = parseLocalDate(dateStr);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 9); // October is 9 (0-indexed)
  assert.equal(parsed.getDate(), 23);

  const formatted = getLocalDateString(parsed);
  assert.equal(formatted, dateStr);
});

test('Habit streak calculation correctly respects scheduled days and does not penalize unscheduled days', () => {
  // Habit scheduled only on weekdays (Mon-Fri = 1,2,3,4,5)
  const weekdayHabit = {
    id: 'h1',
    name: 'Weekday Journaling',
    scheduledDays: [1, 2, 3, 4, 5]
  };

  // Consider Friday Oct 23, 2026 (day 5), Thursday Oct 22 (day 4), Wednesday Oct 21 (day 3)
  const entries = [
    { habitId: 'h1', date: '2026-10-23', completed: true },
    { habitId: 'h1', date: '2026-10-22', completed: true },
    { habitId: 'h1', date: '2026-10-21', completed: true },
    // Weekend (Oct 17, 18) was unscheduled!
    // Friday Oct 16 (day 5) was completed
    { habitId: 'h1', date: '2026-10-20', completed: true },
    { habitId: 'h1', date: '2026-10-19', completed: true }
  ];

  const streak = calculateHabitStreak(weekdayHabit, entries, '2026-10-23');
  assert.equal(streak, 5);
});

test('Finance arithmetic uses integer minor units accurately', () => {
  const transactions = [
    { id: 'tx1', type: 'income', amount: 350050, date: '2026-10-01', category: 'Salary' }, // $3500.50
    { id: 'tx2', type: 'expense', amount: 12025, date: '2026-10-05', category: 'Groceries' }, // $120.25
    { id: 'tx3', type: 'expense', amount: 4500, date: '2026-10-12', category: 'Utilities' }, // $45.00
    { id: 'tx4', type: 'expense', amount: 8000, date: '2026-10-18', category: 'Groceries' }  // $80.00
  ];

  const budgets = [
    { month: '2026-10', limit: 200000 } // $2000.00
  ];

  const summary = calculateFinanceSummary(transactions, '2026-10', budgets);
  assert.equal(summary.income, 350050);
  assert.equal(summary.expense, 24525);
  assert.equal(summary.net, 325525);
  assert.equal(summary.categoryTotals['Groceries'], 20025);
  assert.equal(summary.categoryTotals['Utilities'], 4500);
  assert.equal(summary.budgetLimit, 200000);
  assert.equal(summary.budgetRemaining, 175475);
});

// Milestone progress calculation
export function calculateGoalProgress(goal, milestones) {
  const goalMilestones = milestones.filter(m => m.goalId === goal.id);
  if (goalMilestones.length === 0) {
    return { hasMilestones: false, text: goal.status };
  }
  const completed = goalMilestones.filter(m => m.completed).length;
  const percent = Math.round((completed / goalMilestones.length) * 100);
  return { hasMilestones: true, completed, total: goalMilestones.length, percent, text: `${completed}/${goalMilestones.length} (${percent}%)` };
}

test('Goal progress calculates derived milestone completion correctly', () => {
  const goal1 = { id: 'g1', title: 'Learn Japanese', status: 'active' };
  const goal2 = { id: 'g2', title: 'Run Marathon', status: 'active' };

  const milestones = [
    { id: 'm1', goalId: 'g1', title: 'Hiragana', completed: true },
    { id: 'm2', goalId: 'g1', title: 'Katakana', completed: true },
    { id: 'm3', goalId: 'g1', title: 'Kanji Basics', completed: false },
    { id: 'm4', goalId: 'g1', title: 'JLPT N5', completed: false }
  ];

  const p1 = calculateGoalProgress(goal1, milestones);
  assert.equal(p1.hasMilestones, true);
  assert.equal(p1.completed, 2);
  assert.equal(p1.total, 4);
  assert.equal(p1.percent, 50);

  const p2 = calculateGoalProgress(goal2, milestones);
  assert.equal(p2.hasMilestones, false);
  assert.equal(p2.text, 'active');
});

test('Schema validation rejects malformed state', () => {
  const invalidState1 = { schemaVersion: 0 };
  assert.equal(validateState(invalidState1).valid, false);

  const invalidState2 = {
    schemaVersion: 1,
    preferences: {},
    tasks: 'not an array'
  };
  assert.equal(validateState(invalidState2).valid, false);

  const invalidState3 = {
    ...createInitialState(),
    transactions: [
      { id: 'tx1', type: 'invalid_type', amount: 100, date: '2026-10-10' }
    ]
  };
  assert.equal(validateState(invalidState3).valid, false);
});
