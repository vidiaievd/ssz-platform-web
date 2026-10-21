/**
 * A module's learning goals as the inspector edits them: one goal per line of a
 * textarea. The limits mirror content-service's `UpdateContainerRequestDto`, so
 * the author hears about an over-long goal before the request is made.
 */
export const MAX_LEARNING_GOALS = 20;
export const MAX_LEARNING_GOAL_LENGTH = 300;

/** The goals a text stands for: trimmed lines, blank ones dropped — as the server stores them. */
export function parseLearningGoals(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export function formatLearningGoals(goals: string[]): string {
  return goals.join('\n');
}

export type LearningGoalsProblem = 'tooMany' | 'tooLong' | null;

export function learningGoalsProblem(goals: string[]): LearningGoalsProblem {
  if (goals.length > MAX_LEARNING_GOALS) return 'tooMany';
  if (goals.some((goal) => goal.length > MAX_LEARNING_GOAL_LENGTH)) return 'tooLong';
  return null;
}
