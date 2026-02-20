import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Line,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from 'recharts';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { ROUTES } from '../constants/routes';
import { Container } from '../components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { formatCurrency, formatNumber } from '../utils/format';
import { ArrowLeft, TrendingUp, Wallet, Sparkles, CheckCircle } from 'lucide-react';

function formatReportCurrency(amount: number, currency: string): string {
  return formatCurrency(amount, currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

interface ChartProps {
  data: Array<{ name: string; value?: number; color?: string; income?: number; expenses?: number; net?: number }>;
  currency: string;
}

function InsightsCard({ currency }: { currency: string }) {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['insights', currency],
    queryFn: () => api.reports.insights(currency),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl mb-6" />;
  if (!insights) return null;

  const sentimentColor =
    insights.sentiment === 'positive' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
      insights.sentiment === 'negative' ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' :
        'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';

  const iconColor =
    insights.sentiment === 'positive' ? 'text-emerald-600 dark:text-emerald-400' :
      insights.sentiment === 'negative' ? 'text-rose-600 dark:text-rose-400' :
        'text-blue-600 dark:text-blue-400';

  return (
    <Card className={`mb-6 border ${sentimentColor}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm ${iconColor}`}>
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              AI Financial Advisor
              <span className={`text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 ${iconColor} uppercase tracking-wider font-semibold`}>
                {insights.sentiment}
              </span>
            </h3>
            <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
              {insights.advice}
            </p>

            <div className="space-y-2">
              {insights.action_items.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <CheckCircle className={`w-4 h-4 mt-0.5 ${iconColor}`} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyOverviewChart({ data, currency }: ChartProps) {
  const { t } = useLanguage();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey="name" className="text-xs" />
        <YAxis tickFormatter={(value) => formatNumber(value, { notation: 'compact' })} className="text-xs" />
        <Tooltip formatter={(value) => typeof value === 'number' ? formatReportCurrency(value, currency) : ''} />
        <Legend />
        <Bar dataKey="value" name={t('amount')} fill="#6366f1" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CategoryPieChart({ data, currency }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => typeof value === 'number' ? formatReportCurrency(value, currency) : ''} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function YearlyTrendChart({ data, currency }: ChartProps) {
  const { t } = useLanguage();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis dataKey="name" className="text-xs" />
        <YAxis tickFormatter={(value) => formatNumber(value, { notation: 'compact' })} className="text-xs" />
        <Tooltip formatter={(value) => typeof value === 'number' ? formatReportCurrency(value, currency) : ''} />
        <Legend />
        <Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name={t('income')} />
        <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name={t('expenses')} />
        <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} name={t('netSavings')} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Reports() {
  const { t } = useLanguage();
  const [currency, setCurrency] = useState('USD');
  const [view, setView] = useState<'monthly' | 'yearly'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
  });

  const { data: monthlyReport, isLoading: monthlyLoading, error: monthlyError } = useQuery({
    queryKey: ['reports', 'monthly', year, month, currency],
    queryFn: () => api.reports.monthly(year, month, currency),
    enabled: view === 'monthly',
  });

  const { data: yearlyReport, isLoading: yearlyLoading, error: yearlyError } = useQuery({
    queryKey: ['reports', 'yearly', year, currency],
    queryFn: () => api.reports.yearly(year, currency),
    enabled: view === 'yearly',
  });

  const monthlyOverviewData = [
    { name: t('income'), value: monthlyReport?.income || 0, color: '#22c55e' },
    { name: t('expenses'), value: monthlyReport?.expenses || 0, color: '#ef4444' },
    { name: t('netSavings'), value: monthlyReport?.net || 0, color: '#6366f1' },
  ];

  const monthlyCategoryData = monthlyReport?.categories?.map((cat, index) => ({
    name: t(`category_${cat.category}` as any) || cat.category,
    value: cat.amount ?? 0,
    color: COLORS[index % COLORS.length],
  })) ?? [];

  const yearlyTrendData = yearlyReport?.months?.map((m) => ({
    name: new Date(year, (m.month ?? 1) - 1).toLocaleString('default', { month: 'short' }),
    income: m.income ?? 0,
    expenses: m.expenses ?? 0,
    net: m.net ?? 0,
  })) ?? [];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link to={ROUTES.wallet} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {t('reportsAndStats')}
                </h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm ml-7">
                {t('reportsDescription')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div
                className="relative flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/70 px-2 py-1.5 shadow-sm"
                role="tablist"
                aria-label={t('reportsAndStats')}
              >
                <span className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-slate-200/70 dark:bg-slate-700/70" />
                <button
                  onClick={() => setView('monthly')}
                  role="tab"
                  aria-selected={view === 'monthly'}
                  className={`relative z-10 flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold tracking-wide rounded-full transition-all ${view === 'monthly'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm ring-1 ring-primary-500/30'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${view === 'monthly' ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                  />
                  {t('monthly')}
                </button>
                <button
                  onClick={() => setView('yearly')}
                  role="tab"
                  aria-selected={view === 'yearly'}
                  className={`relative z-10 flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold tracking-wide rounded-full transition-all ${view === 'yearly'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm ring-1 ring-primary-500/30'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${view === 'yearly' ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                  />
                  {t('yearly')}
                </button>
              </div>

              <Select value={year.toString()} onChange={(e) => setYear(parseInt(e.target.value))} className="w-24">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>

              {view === 'monthly' && (
                <Select value={month.toString()} onChange={(e) => setMonth(parseInt(e.target.value))} className="w-32">
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </Select>
              )}

              <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24">
                {currenciesData?.slice(0, 20).map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Monthly View */}
          {view === 'monthly' && (
            <div className="space-y-6 animate-fade-in">
              <InsightsCard currency={currency} />

              {monthlyLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
              ) : monthlyError ? (
                <ErrorMessage>{t('failedToLoadReport')}</ErrorMessage>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30">
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">{t('income')}</p>
                        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                          {formatReportCurrency(monthlyReport?.income || 0, currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30">
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-rose-600 dark:text-rose-400 mb-1">{t('expenses')}</p>
                        <p className="text-3xl font-bold text-rose-700 dark:text-rose-300">
                          {formatReportCurrency(monthlyReport?.expenses || 0, currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30">
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-1">{t('netSavings')}</p>
                        <p className={`text-3xl font-bold ${monthlyReport?.net && monthlyReport.net >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-700 dark:text-rose-300'}`}>
                          {formatReportCurrency(monthlyReport?.net || 0, currency)}
                        </p>
                        <p className="text-xs text-indigo-500 mt-1">
                          {t('savingsRate')}: {(monthlyReport?.savings_rate || 0).toFixed(1)}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('monthlySummary')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {monthlyOverviewData.some(d => d.value > 0) ? (
                          <MonthlyOverviewChart data={monthlyOverviewData} currency={currency} />
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-slate-400">
                            {t('noDataAvailable')}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>{t('spendingByCategory')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {monthlyCategoryData.length > 0 ? (
                          <CategoryPieChart data={monthlyCategoryData} currency={currency} />
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-slate-400">
                            {t('noDataAvailable')}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Yearly View */}
          {view === 'yearly' && (
            <div className="space-y-6 animate-fade-in">
              {yearlyLoading ? (
                <Skeleton className="h-96 w-full rounded-xl" />
              ) : yearlyError ? (
                <ErrorMessage>{t('failedToLoadReport')}</ErrorMessage>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <p className="text-sm font-medium text-slate-500">{t('yearlyTotal')} {t('income')}</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">
                          {formatReportCurrency(yearlyReport?.income || 0, currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-rose-500 rotate-180" />
                          <p className="text-sm font-medium text-slate-500">{t('yearlyTotal')} {t('expenses')}</p>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">
                          {formatReportCurrency(yearlyReport?.expenses || 0, currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="w-4 h-4 text-indigo-500" />
                          <p className="text-sm font-medium text-slate-500">{t('totalNetWorth')}</p>
                        </div>
                        <p className={`text-2xl font-bold ${yearlyReport?.net && yearlyReport.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatReportCurrency(yearlyReport?.net || 0, currency)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t('incomeVsExpenses')} ({year})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {yearlyTrendData.some(d => d.income > 0 || d.expenses > 0) ? (
                        <YearlyTrendChart data={yearlyTrendData} currency={currency} />
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-400">
                          {t('noDataAvailable')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
