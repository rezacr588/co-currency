import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import { useConvert, useCurrencies } from '../../../hooks';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { TransactionHistory } from '../Wallet/TransactionHistory';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import { formatCurrency, formatNumber } from '../../../utils/format';
import {
  Wallet,
  Target,
  PieChart,
  RefreshCw,
  TrendingUp,
  Bot,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Clock,
  ChevronRight,
  Sparkles,
  Calendar,
  AlertCircle,
  ArrowLeftRight,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';

interface QuickStatProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  bgColor: string;
  iconColor: string;
}

function QuickStat({ title, value, subtitle, icon, trend, trendValue, bgColor, iconColor }: QuickStatProps) {
  return (
    <div className={`${bgColor} rounded-2xl p-5 relative overflow-hidden`}>
      <div className="relative z-10">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center mb-3`}>
          {icon}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        {(subtitle || trendValue) && (
          <div className="flex items-center gap-2 mt-2">
            {trend && trendValue && (
              <span className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-500'
                }`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
                {trendValue}
              </span>
            )}
            {subtitle && <span className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>}
          </div>
        )}
      </div>
      {/* Decorative element */}
      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10 dark:bg-white/5" />
    </div>
  );
}

interface ActionCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function ActionCard({ to, icon, title, description, color }: ActionCardProps) {
  return (
    <Link to={to} className="block group">
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{description}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
}

// Quick Balance Converter - shows balance in different currencies
const POPULAR_CURRENCIES = ['EUR', 'GBP', 'TRY', 'JPY', 'CAD', 'AUD', 'CHF'];

interface QuickBalanceConverterProps {
  balanceUSD: number;
}

function QuickBalanceConverter({ balanceUSD }: QuickBalanceConverterProps) {
  const { t } = useLanguage();
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');
  const { data: currencies } = useCurrencies();

  // Get conversion rate
  const { data: conversionData, isLoading } = useConvert(
    balanceUSD > 0 ? 'USD' : '',
    balanceUSD > 0 ? selectedCurrency : '',
    balanceUSD > 0 ? balanceUSD : 0
  );

  const currencyOptions = useMemo(() => {
    if (!currencies) return POPULAR_CURRENCIES;
    return currencies.map(c => c.code).filter(code => code !== 'USD');
  }, [currencies]);

  const flag = CURRENCY_FLAGS[selectedCurrency] || '🌍';
  const usdFlag = CURRENCY_FLAGS['USD'] || '🇺🇸';

  return (
    <Card className="bg-gradient-to-br from-primary-50 to-sky-50 dark:from-primary-900/20 dark:to-sky-900/20 border-primary-200/50 dark:border-primary-800/50">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h3 className="font-semibold text-slate-800 dark:text-white">{t('balanceConverter')}</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* USD Balance */}
          <div className="flex-1 bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{usdFlag}</span>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">USD</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {formatCurrency(balanceUSD, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Arrow */}
          <div className="hidden sm:flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </div>

          {/* Converted Balance */}
          <div className="flex-1 bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{flag}</span>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-transparent border-none focus:ring-0 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors p-0"
              >
                {currencyOptions.slice(0, 20).map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {conversionData
                  ? formatNumber(conversionData.result, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : formatNumber(0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            {conversionData?.rate && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                1 USD = {formatNumber(conversionData.rate, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {selectedCurrency}
              </p>
            )}
          </div>
        </div>

        {/* Quick Currency Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {POPULAR_CURRENCIES.map(code => (
            <button
              key={code}
              onClick={() => setSelectedCurrency(code)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${selectedCurrency === code
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600'
                }`}
            >
              {CURRENCY_FLAGS[code]} {code}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastWidget() {
  const { data: forecast, isLoading } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.reports.forecast(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;
  if (!forecast || forecast.avg_daily_spend === 0) return null;

  const isPositive = forecast.net_daily_flow >= 0;

  return (
    <Card className="overflow-hidden border-none bg-slate-900 text-white">
      <CardContent className="p-0">
        <div className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              {isPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">Spending Forecast</h3>
              <p className="text-slate-400 text-sm">Based on your last 30 days</p>
            </div>
          </div>

          <div className="text-center sm:text-right">
            {isPositive ? (
              <div className="text-emerald-400 font-bold text-lg">Positive Cash Flow</div>
            ) : (
              <div>
                <div className="text-rose-400 font-bold text-2xl">{forecast.days_until_zero} Days</div>
                <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Until Balance reaches zero</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/5 p-4 grid grid-cols-3 gap-2 text-center border-t border-white/5">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Daily Spend</p>
            <p className="font-semibold text-sm">-{formatNumber(forecast.avg_daily_spend)} {forecast.currency}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Daily Income</p>
            <p className="font-semibold text-sm">+{formatNumber(forecast.avg_daily_income)} {forecast.currency}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Net Flow</p>
            <p className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{formatNumber(forecast.net_daily_flow)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
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

  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {getGreeting()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              {user?.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {t('dashboardSubtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/wallet/add">
              <Button variant="primary" size="md" className="gap-2">
                <Plus className="w-4 h-4" />
                {t('addTransaction')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-5">
                <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </>
        ) : (
          <>
            <QuickStat
              title={t('totalBalance')}
              value={formatCurrency(summary?.total_balance_usd || 0, 'USD')}
              subtitle={`${summary?.balances?.length || 0} ${t('currencies')}`}
              icon={<DollarSign className="w-5 h-5 text-white" />}
              bgColor="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20"
              iconColor="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <QuickStat
              title={t('activeGoals')}
              value={activeGoals.length}
              subtitle={activeGoals.length > 0 ? `${overallGoalProgress}% ${t('progress')}` : t('noActiveGoals')}
              icon={<Target className="w-5 h-5 text-white" />}
              bgColor="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20"
              iconColor="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <QuickStat
              title={t('budgetStatus')}
              value={`${budgetPercentage}%`}
              subtitle={totalBudget > 0 ? `${formatCurrency(totalSpent, 'USD')} / ${formatCurrency(totalBudget, 'USD')}` : t('noBudgets')}
              trend={budgetPercentage > 90 ? 'down' : budgetPercentage > 70 ? 'neutral' : 'up'}
              icon={<PieChart className="w-5 h-5 text-white" />}
              bgColor="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20"
              iconColor="bg-gradient-to-br from-sky-500 to-blue-600"
            />
            <QuickStat
              title={t('dueRecurring')}
              value={dueRecurring.length}
              subtitle={t('pendingExecutions')}
              trend={dueRecurring.length > 0 ? 'down' : 'up'}
              icon={<Clock className="w-5 h-5 text-white" />}
              bgColor="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20"
              iconColor="bg-gradient-to-br from-amber-500 to-orange-600"
            />
          </>
        )}
      </div>

      {/* Forecast and Balance Converter Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ForecastWidget />
        <QuickBalanceConverter balanceUSD={summary?.total_balance_usd || 0} />
      </div>

      {/* Alert for due recurring transactions */}
      {dueRecurring.length > 0 && (
        <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {t('recurringDueAlert')}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              {dueRecurring.length} {t('transactionsDue')}
            </p>
          </div>
          <Link to="/recurring">
            <Button variant="ghost" size="sm" className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40">
              {t('viewAll')}
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            {t('quickAccess')}
          </h2>
          <div className="space-y-3">
            <ActionCard
              to="/wallet"
              icon={<Wallet className="w-5 h-5 text-white" />}
              title={t('wallet')}
              description={t('walletCardDesc')}
              color="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <ActionCard
              to="/goals"
              icon={<Target className="w-5 h-5 text-white" />}
              title={t('financialGoals')}
              description={t('goalsCardDesc')}
              color="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <ActionCard
              to="/budgets"
              icon={<PieChart className="w-5 h-5 text-white" />}
              title={t('budgets')}
              description={t('budgetsCardDesc')}
              color="bg-gradient-to-br from-sky-500 to-blue-600"
            />
            <ActionCard
              to="/recurring"
              icon={<RefreshCw className="w-5 h-5 text-white" />}
              title={t('recurring')}
              description={t('recurringCardDesc')}
              color="bg-gradient-to-br from-amber-500 to-orange-600"
            />
            <ActionCard
              to="/reports"
              icon={<TrendingUp className="w-5 h-5 text-white" />}
              title={t('reportsAndStats')}
              description={t('reportsCardDesc')}
              color="bg-gradient-to-br from-rose-500 to-pink-600"
            />
            <ActionCard
              to="/wallet/ai"
              icon={<Bot className="w-5 h-5 text-white" />}
              title={t('aiParser')}
              description={t('aiCardDesc')}
              color="bg-gradient-to-br from-indigo-500 to-blue-600"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" />
                {t('recentActivity')}
              </CardTitle>
              <Link to="/wallet/history">
                <Button variant="ghost" size="sm" className="gap-1">
                  {t('viewAll')}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : summary?.recent_transactions && summary.recent_transactions.length > 0 ? (
                <TransactionHistory
                  transactions={summary.recent_transactions.slice(0, 6)}
                  showPagination={false}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Wallet className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    {t('noTransactions')}
                  </p>
                  <Link to="/wallet/add">
                    <Button variant="primary" size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      {t('addTransaction')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
