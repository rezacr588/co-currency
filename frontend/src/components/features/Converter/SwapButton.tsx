import { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { ArrowUpDown } from 'lucide-react';

interface SwapButtonProps {
  onClick: () => void;
}

export function SwapButton({ onClick }: SwapButtonProps) {
  const { t } = useLanguage();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onClick();
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex-shrink-0 w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center group focus:outline-none focus:ring-2 focus:ring-amber-400/40 hover:scale-105 active:scale-95"
      aria-label={t('swapCurrencies')}
      title={t('swapCurrencies')}
    >
      {/* Coin background */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-b from-amber-400 to-amber-500 shadow-md" />

      {/* Inner face */}
      <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-amber-300 to-amber-400" />

      {/* Subtle shine */}
      <span className="absolute inset-[3px] rounded-full bg-gradient-to-br from-white/40 via-transparent to-transparent" />

      {/* Icon */}
      <ArrowUpDown
        className={`relative w-4 h-4 text-amber-900 transition-transform duration-400 ${
          isAnimating ? 'rotate-180' : 'group-hover:rotate-180'
        }`}
        strokeWidth={2.5}
      />
    </button>
  );
}
