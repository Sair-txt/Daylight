/**
 * Daylight — Goals & Milestones Logic
 */

export function calculateGoalProgress(goal, milestones = []) {
  const goalMilestones = milestones.filter(m => m.goalId === goal.id);
  if (goalMilestones.length === 0) {
    return {
      hasMilestones: false,
      completed: 0,
      total: 0,
      percent: 0,
      text: goal.status || 'active'
    };
  }

  const completed = goalMilestones.filter(m => m.completed).length;
  const total = goalMilestones.length;
  const percent = Math.round((completed / total) * 100);

  return {
    hasMilestones: true,
    completed,
    total,
    percent,
    text: `${completed}/${total} (${percent}%)`
  };
}
