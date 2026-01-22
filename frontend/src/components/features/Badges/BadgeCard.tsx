import { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { BadgeProgress } from '../../../types/goal';

const RARITY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    common: {
        bg: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-slate-300 dark:border-slate-600',
        text: 'text-slate-600 dark:text-slate-400',
        glow: '',
    },
    rare: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-300 dark:border-blue-600',
        text: 'text-blue-600 dark:text-blue-400',
        glow: 'shadow-blue-200 dark:shadow-blue-900/40',
    },
    epic: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-400 dark:border-purple-500',
        text: 'text-purple-600 dark:text-purple-400',
        glow: 'shadow-purple-200 dark:shadow-purple-900/40',
    },
    legendary: {
        bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
        border: 'border-amber-400 dark:border-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        glow: 'shadow-lg shadow-amber-200 dark:shadow-amber-900/40',
    },
};

interface BadgeCardProps {
    progress: BadgeProgress;
}

export function BadgeCard({ progress }: BadgeCardProps) {
    const { t } = useLanguage();
    const [showTooltip, setShowTooltip] = useState(false);

    const { badge, is_earned, progress_percent, current_value, required_value, earned_at } = progress;
    const rarityStyle = RARITY_COLORS[badge.rarity] || RARITY_COLORS.common;

    return (
        <div
            className="relative group"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <div
                className={`
          relative p-4 rounded-xl border-2 text-center transition-all duration-300
          ${rarityStyle.bg} ${rarityStyle.border}
          ${is_earned ? `${rarityStyle.glow} hover:scale-105` : 'opacity-50 grayscale'}
          ${!is_earned && progress_percent > 0 ? 'opacity-75 grayscale-0' : ''}
        `}
            >
                {/* Badge icon */}
                <div className="text-4xl mb-2 transition-transform group-hover:scale-110">
                    {badge.icon}
                </div>

                {/* Badge name */}
                <h3 className={`text-sm font-semibold mb-1 ${is_earned ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500'}`}>
                    {badge.name}
                </h3>

                {/* Rarity tag */}
                <div className={`text-xs font-medium ${rarityStyle.text} uppercase tracking-wide`}>
                    {badge.rarity}
                </div>

                {/* Progress bar (for unearned badges) */}
                {!is_earned && progress_percent > 0 && (
                    <div className="mt-2">
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(progress_percent, 100)}%` }}
                            />
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {Math.round(current_value)}/{Math.round(required_value)}
                        </div>
                    </div>
                )}

                {/* Earned checkmark */}
                {is_earned && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Tooltip */}
            {showTooltip && (
                <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg shadow-lg text-sm pointer-events-none">
                    <div className="font-semibold mb-1">{badge.name}</div>
                    <div className="text-slate-300 dark:text-slate-600 text-xs mb-2">{badge.description}</div>
                    {is_earned && earned_at && (
                        <div className="text-green-400 dark:text-green-600 text-xs">
                            ✓ {t('earnedOn') || 'Earned on'} {new Date(earned_at).toLocaleDateString()}
                        </div>
                    )}
                    {!is_earned && (
                        <div className="text-slate-400 dark:text-slate-500 text-xs">
                            {Math.round(progress_percent)}% {t('complete') || 'complete'}
                        </div>
                    )}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-100" />
                </div>
            )}
        </div>
    );
}
