import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { Card, CardHeader, CardContent } from '../../ui/Card';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { BadgeCard } from './BadgeCard';

export function BadgeGrid() {
    const { t } = useLanguage();

    const { data, isLoading, error } = useQuery({
        queryKey: ['badges', 'progress'],
        queryFn: () => api.badges.getProgress(),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (error) {
        return <ErrorMessage>Error loading badges</ErrorMessage>;
    }

    const earned = data?.progress?.filter(p => p.is_earned) || [];
    const inProgress = data?.progress?.filter(p => !p.is_earned && p.progress_percent > 0) || [];
    const locked = data?.progress?.filter(p => !p.is_earned && p.progress_percent === 0) || [];

    return (
        <div className="space-y-8">
            {/* Stats Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                        {data?.earned_count || 0}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('badgesEarned') || 'Badges Earned'}
                    </div>
                </Card>
                <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {inProgress.length}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('inProgress') || 'In Progress'}
                    </div>
                </Card>
                <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-slate-400">
                        {locked.length}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('locked') || 'Locked'}
                    </div>
                </Card>
                <Card className="p-4 text-center">
                    <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                        {data?.total_badges || 0}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('totalBadges') || 'Total Badges'}
                    </div>
                </Card>
            </div>

            {/* Earned Badges */}
            {earned.length > 0 && (
                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            🏆 {t('earnedBadges') || 'Earned Badges'}
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                                ({earned.length})
                            </span>
                        </h2>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {earned.map((progress) => (
                                <BadgeCard key={progress.badge.id} progress={progress} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* In Progress Badges */}
            {inProgress.length > 0 && (
                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            🎯 {t('inProgressBadges') || 'In Progress'}
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                                ({inProgress.length})
                            </span>
                        </h2>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {inProgress.map((progress) => (
                                <BadgeCard key={progress.badge.id} progress={progress} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Locked Badges */}
            {locked.length > 0 && (
                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            🔒 {t('lockedBadges') || 'Locked'}
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                                ({locked.length})
                            </span>
                        </h2>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {locked.map((progress) => (
                                <BadgeCard key={progress.badge.id} progress={progress} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {data?.progress?.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎖️</div>
                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                        {t('noBadgesYet') || 'No badges yet'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('startEarningBadges') || 'Start using CoFinance to earn achievements!'}
                    </p>
                </div>
            )}
        </div>
    );
}
