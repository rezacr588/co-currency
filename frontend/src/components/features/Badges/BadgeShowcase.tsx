import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { Card } from '../../ui/Card';

export function BadgeShowcase() {
    const { t } = useLanguage();

    const { data: earnedData } = useQuery({
        queryKey: ['badges', 'earned'],
        queryFn: () => api.badges.getEarned(),
    });

    const recentBadges = earnedData?.badges?.slice(0, 4) || [];

    if (recentBadges.length === 0) {
        return null;
    }

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    🏆 {t('recentBadges') || 'Recent Badges'}
                </h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {earnedData?.count || 0} {t('total') || 'total'}
                </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
                {recentBadges.map((userBadge) => (
                    <div
                        key={userBadge.id}
                        className="flex-shrink-0 w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl shadow-sm hover:scale-105 transition-transform cursor-pointer"
                        title={userBadge.badge?.name}
                    >
                        {userBadge.badge?.icon || '🎖️'}
                    </div>
                ))}
            </div>
        </Card>
    );
}
