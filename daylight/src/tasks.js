/**
 * Daylight — Tasks and Recursive Subtasks Logic
 */

export function canSetParentTask(taskId, candidateParentId, tasks = []) {
  if (!candidateParentId) return true;
  if (taskId === candidateParentId) return false;

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  let curr = taskMap.get(candidateParentId);
  const visited = new Set([taskId]);

  while (curr) {
    if (visited.has(curr.id)) return false; // Cycle detected
    visited.add(curr.id);
    if (!curr.parentId) break;
    curr = taskMap.get(curr.parentId);
  }
  return true;
}

export function getDescendantIds(taskId, tasks = []) {
  const childrenMap = new Map();
  for (const t of tasks) {
    if (t.parentId) {
      if (!childrenMap.has(t.parentId)) childrenMap.set(t.parentId, []);
      childrenMap.get(t.parentId).push(t.id);
    }
  }

  const result = new Set();
  const queue = [...(childrenMap.get(taskId) || [])];
  while (queue.length > 0) {
    const id = queue.shift();
    result.add(id);
    const sub = childrenMap.get(id);
    if (sub) queue.push(...sub);
  }
  return result;
}

export function deleteTask(taskId, deleteSubtasks, tasks = []) {
  if (deleteSubtasks) {
    const descendants = getDescendantIds(taskId, tasks);
    descendants.add(taskId);
    return tasks.filter(t => !descendants.has(t.id));
  } else {
    // Preserve subtasks as independent top-level tasks
    return tasks
      .filter(t => t.id !== taskId)
      .map(t => t.parentId === taskId ? { ...t, parentId: null } : t);
  }
}

/**
 * Checks if a task matches the filter predicate
 */
export function taskMatchesFilter(task, filter, todayStr) {
  if (filter === 'all') return true;
  if (filter === 'completed') return !!task.completed;
  if (task.completed) return false; // Other filters only apply to non-completed tasks

  if (filter === 'today') {
    return task.dueDate === todayStr || (!task.dueDate && task.isTopPriority);
  }
  if (filter === 'upcoming') {
    return !!(task.dueDate && task.dueDate > todayStr);
  }
  if (filter === 'high') {
    return task.priority === 'high';
  }
  return true;
}

/**
 * Builds a hierarchical list of tasks with arbitrary recursive depth.
 * Returns an array of task items with { ...task, depth: number }
 */
export function buildHierarchicalTaskList(tasks = [], filter = 'all', todayStr = '') {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const childrenMap = new Map();

  for (const t of tasks) {
    const pId = t.parentId && taskMap.has(t.parentId) ? t.parentId : null;
    if (!childrenMap.has(pId)) childrenMap.set(pId, []);
    childrenMap.get(pId).push(t);
  }

  // Pre-calculate which tasks match filter or have a descendant matching filter
  const matchesSelf = new Set();
  const matchesSubtree = new Set();

  for (const t of tasks) {
    if (taskMatchesFilter(t, filter, todayStr)) {
      matchesSelf.add(t.id);
      matchesSubtree.add(t.id);
      // bubble up to ancestors so parents are not hidden
      let pId = t.parentId;
      while (pId && taskMap.has(pId)) {
        matchesSubtree.add(pId);
        pId = taskMap.get(pId).parentId;
      }
    }
  }

  const result = [];
  const visited = new Set();

  function traverse(parentId, depth) {
    const list = childrenMap.get(parentId) || [];
    // Sort: pending first, then by priority, then by title
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const priOrder = { high: 0, normal: 1, low: 2 };
      const pa = priOrder[a.priority] ?? 1;
      const pb = priOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

    for (const item of list) {
      if (visited.has(item.id)) continue;
      visited.add(item.id);

      if (filter === 'all' || matchesSubtree.has(item.id)) {
        result.push({
          ...item,
          depth,
          matchesCurrentFilter: matchesSelf.has(item.id)
        });
        traverse(item.id, depth + 1);
      }
    }
  }

  traverse(null, 0);

  // If there are orphaned cyclic tasks that were never reached from root null, output them safely at root
  for (const t of tasks) {
    if (!visited.has(t.id)) {
      result.push({ ...t, depth: 0, matchesCurrentFilter: matchesSelf.has(t.id) });
    }
  }

  return result;
}
