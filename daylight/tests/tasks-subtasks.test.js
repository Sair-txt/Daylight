import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canSetParentTask,
  getDescendantIds,
  deleteTask,
  buildHierarchicalTaskList
} from '../src/tasks.js';

test('Tasks: Subtask cycle detection handles deep chains', () => {
  const tasks = [
    { id: 't1', parentId: null },
    { id: 't2', parentId: 't1' },
    { id: 't3', parentId: 't2' },
    { id: 't4', parentId: 't3' },
    { id: 't5', parentId: 't4' }
  ];

  // Self parent
  assert.equal(canSetParentTask('t1', 't1', tasks), false);
  // Direct cycle: t1 parented to t2
  assert.equal(canSetParentTask('t1', 't2', tasks), false);
  // Deep cycle: t1 parented to t5
  assert.equal(canSetParentTask('t1', 't5', tasks), false);
  // Valid parent: t6 parented to t5
  assert.equal(canSetParentTask('t6', 't5', tasks), true);
  // Valid unparenting
  assert.equal(canSetParentTask('t2', null, tasks), true);
});

test('Tasks: Descendant IDs resolution finds all children and grandchildren', () => {
  const tasks = [
    { id: 'root', parentId: null },
    { id: 'child1', parentId: 'root' },
    { id: 'child2', parentId: 'root' },
    { id: 'grandchild1', parentId: 'child1' },
    { id: 'greatgrandchild1', parentId: 'grandchild1' },
    { id: 'other', parentId: null }
  ];

  const descendants = getDescendantIds('root', tasks);
  assert.equal(descendants.size, 4);
  assert.equal(descendants.has('child1'), true);
  assert.equal(descendants.has('child2'), true);
  assert.equal(descendants.has('grandchild1'), true);
  assert.equal(descendants.has('greatgrandchild1'), true);
  assert.equal(descendants.has('other'), false);
});

test('Tasks: Delete parent preserving subtasks makes children top-level', () => {
  const tasks = [
    { id: 'parent', title: 'Parent', parentId: null },
    { id: 'child1', title: 'Child 1', parentId: 'parent' },
    { id: 'child2', title: 'Child 2', parentId: 'parent' },
    { id: 'independent', title: 'Independent', parentId: null }
  ];

  const updated = deleteTask('parent', false, tasks);
  assert.equal(updated.length, 3);
  assert.equal(updated.some(t => t.id === 'parent'), false);
  const c1 = updated.find(t => t.id === 'child1');
  const c2 = updated.find(t => t.id === 'child2');
  assert.equal(c1.parentId, null);
  assert.equal(c2.parentId, null);
});

test('Tasks: Delete parent deleting subtasks cascades recursively', () => {
  const tasks = [
    { id: 'p', title: 'P', parentId: null },
    { id: 'c', title: 'C', parentId: 'p' },
    { id: 'gc', title: 'GC', parentId: 'c' },
    { id: 'other', title: 'Other', parentId: null }
  ];

  const updated = deleteTask('p', true, tasks);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'other');
});

test('Tasks: Hierarchical list builder preserves recursive depths', () => {
  const tasks = [
    { id: 'p1', title: 'Parent 1', parentId: null, completed: false, priority: 'normal' },
    { id: 'c1', title: 'Child 1', parentId: 'p1', completed: false, priority: 'normal' },
    { id: 'gc1', title: 'Grandchild 1', parentId: 'c1', completed: false, priority: 'normal' },
    { id: 'p2', title: 'Parent 2', parentId: null, completed: false, priority: 'normal' }
  ];

  const tree = buildHierarchicalTaskList(tasks, 'all', '2026-10-24');
  assert.equal(tree.length, 4);

  // Depth verification
  const p1Item = tree.find(t => t.id === 'p1');
  const c1Item = tree.find(t => t.id === 'c1');
  const gc1Item = tree.find(t => t.id === 'gc1');
  const p2Item = tree.find(t => t.id === 'p2');

  assert.equal(p1Item.depth, 0);
  assert.equal(c1Item.depth, 1);
  assert.equal(gc1Item.depth, 2);
  assert.equal(p2Item.depth, 0);
});

test('Tasks: Filtering does not hide subtasks unexpectedly', () => {
  const todayStr = '2026-10-24';
  const tasks = [
    { id: 'p1', title: 'Parent', parentId: null, dueDate: null, completed: false, isTopPriority: false, priority: 'normal' },
    { id: 'subToday', title: 'Subtask Due Today', parentId: 'p1', dueDate: todayStr, completed: false, isTopPriority: false, priority: 'normal' }
  ];

  // Filtering for 'today' should show both the matching subtask AND its parent so user sees the hierarchy!
  const filtered = buildHierarchicalTaskList(tasks, 'today', todayStr);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 'p1');
  assert.equal(filtered[1].id, 'subToday');
});
