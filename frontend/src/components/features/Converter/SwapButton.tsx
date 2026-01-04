interface SwapButtonProps {
  onClick: () => void;
}

export function SwapButton({ onClick }: SwapButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 transition-all hover:scale-110 active:scale-95 group"
      aria-label="Swap currencies"
    >
      <svg
        className="w-6 h-6 text-primary-400 group-hover:rotate-180 transition-transform duration-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    </button>
  );
}
