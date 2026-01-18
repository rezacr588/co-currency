import { useLanguage } from '../../../context/LanguageContext';

interface SwapButtonProps {
  onClick: () => void;
}

export function SwapButton({ onClick }: SwapButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 shadow-md shadow-primary-600/25 hover:shadow-primary-600/40 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-primary-600/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
      aria-label={t('swapCurrencies')}
      title={t('swapCurrencies')}
    >
      <svg
        className="relative w-5 h-5 text-white group-hover:rotate-180 transition-transform duration-300"
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
