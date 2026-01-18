interface GoalProgressProps {
  progress: number;
  isCompleted: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GoalProgress({ progress, isCompleted, size = 'md' }: GoalProgressProps) {
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const getProgressColor = () => {
    if (isCompleted) return 'bg-green-500';
    if (progress >= 75) return 'bg-purple-500';
    if (progress >= 50) return 'bg-violet-500';
    if (progress >= 25) return 'bg-fuchsia-500';
    return 'bg-purple-400';
  };

  return (
    <div className="w-full">
      <div className={`w-full ${heights[size]} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
        <div
          className={`${heights[size]} ${getProgressColor()} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}
