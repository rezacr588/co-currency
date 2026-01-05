import { useLanguage } from '../../../context/LanguageContext';

interface SwapButtonProps {
  onClick: () => void;
}

export function SwapButton({ onClick }: SwapButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-4 focus:ring-offset-white dark:focus:ring-offset-slate-900"
      aria-label={t('swapCurrencies')}
      title={t('swapCurrencies')}
    >
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300" />

      <svg
        className="relative w-6 h-6 text-white group-hover:rotate-180 transition-transform duration-500 ease-out"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    </button>
  );
}
