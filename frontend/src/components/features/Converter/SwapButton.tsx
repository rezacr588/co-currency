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
      className={`relative flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600 shadow-xl shadow-primary-500/40 hover:shadow-primary-500/60 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group focus:outline-none focus:ring-4 focus:ring-primary-500/30 ${
        isAnimating ? 'animate-bounce-once' : ''
      }`}
      aria-label={t('swapCurrencies')}
      title={t('swapCurrencies')}
    >
      {/* Pulse ring effect */}
      <span className="absolute inset-0 rounded-2xl bg-primary-500/20 animate-ping opacity-0 group-hover:opacity-100" />

      {/* Inner glow */}
      <span className="absolute inset-1 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Icon */}
      <ArrowUpDown
        className={`relative w-5 h-5 text-white transition-transform duration-500 ${
          isAnimating ? 'rotate-180' : 'group-hover:rotate-180'
        }`}
      />
    </button>
  );
}
