import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { Container } from '../../layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { TransactionHistory } from '../Wallet/TransactionHistory';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

function StatsCard({ title, value, subtitle, icon, colorClass = 'text-purple-600 dark:text-purple-400' }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 ${colorClass}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeatureCardProps {
  to: string;
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ to, icon, title, description }: FeatureCardProps) {
  return (
    <Link to={to} className="block">
      <Card className="h-full hover:border-purple-300 dark:hover:border-purple-700 transition-colors cursor-pointer group">
        <CardContent className="py-4 text-center">
          <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform">{icon}</span>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000,
  });

  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
    staleTime: 60 * 1000,
  });

  const { data: budgetsData, isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
    staleTime: 60 * 1000,
  });

  const { data: recurringData, isLoading: recurringLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.recurring.list(),
    staleTime: 60 * 1000,
  });

  // Calculate stats
  const goals = goalsData?.goals || [];
  const activeGoals = goals.filter(g => !g.is_completed);
  const overallGoalProgress = activeGoals.length > 0
    ? Math.round(activeGoals.reduce((acc, g) => acc + (g.current_amount / g.target_amount) * 100, 0) / activeGoals.length)
    : 0;

  const budgets = budgetsData?.budgets || [];
  const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (b.spent || 0), 0);
  const budgetPercentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const recurring = recurringData?.recurring_transactions || [];
  const dueRecurring = recurring.filter(r => {
    if (!r.is_active) return false;
    const nextDate = new Date(r.next_execution);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return nextDate <= today;
  });

  const isLoading = summaryLoading || goalsLoading || budgetsLoading || recurringLoading;

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('welcomeBack')}, {user?.name}!
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{t('dashboardSubtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/wallet/add">
                <Button variant="primary" size="sm">
                  {t('addTransaction')}
                </Button>
              </Link>
              <Link to="/wallet">
                <Button variant="secondary" size="sm">
                  {t('viewWallet')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <Skeleton className="h-4 w-20 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <StatsCard
                  title={t('totalBalance')}
                  value={formatCurrency(summary?.total_balance_usd || 0, 'USD')}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <StatsCard
                  title={t('activeGoals')}
                  value={activeGoals.length}
                  subtitle={`${overallGoalProgress}% ${t('overallProgress').toLowerCase()}`}
                  colorClass="text-purple-600 dark:text-purple-400"
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <StatsCard
                  title={t('budgetStatus')}
                  value={`${budgetPercentage}%`}
                  subtitle={`${formatCurrency(totalSpent, 'USD')} / ${formatCurrency(totalBudget, 'USD')}`}
                  colorClass={budgetPercentage > 90 ? 'text-rose-600 dark:text-rose-400' : budgetPercentage > 70 ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
                <StatsCard
                  title={t('dueRecurring')}
                  value={dueRecurring.length}
                  subtitle={t('pendingExecutions')}
                  colorClass={dueRecurring.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                />
              </>
            )}
          </div>

          {/* Feature Navigation Cards */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">{t('quickAccess')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <FeatureCard
                to="/wallet"
                icon="wallet"
                title={t('wallet')}
                description={t('walletCardDesc')}
              />
              <FeatureCard
                to="/goals"
                icon="target"
                title={t('financialGoals')}
                description={t('goalsCardDesc')}
              />
              <FeatureCard
                to="/budgets"
                icon="chart"
                title={t('budgets')}
                description={t('budgetsCardDesc')}
              />
              <FeatureCard
                to="/recurring"
                icon="repeat"
                title={t('recurring')}
                description={t('recurringCardDesc')}
              />
              <FeatureCard
                to="/reports"
                icon="trending"
                title={t('reportsAndStats')}
                description={t('reportsCardDesc')}
              />
              <FeatureCard
                to="/wallet/ai"
                icon="robot"
                title={t('aiParser')}
                description={t('aiCardDesc')}
              />
            </div>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('recentActivity')}</CardTitle>
              <Link to="/wallet/history">
                <Button variant="ghost" size="sm">
                  {t('viewAll')}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : summary?.recent_transactions && summary.recent_transactions.length > 0 ? (
                <TransactionHistory
                  transactions={summary.recent_transactions.slice(0, 5)}
                  showPagination={false}
                />
              ) : (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  {t('noTransactions')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
