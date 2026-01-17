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
} from 'recharts';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Container } from '../components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorMessage } from '../components/ui/ErrorMessage';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

export function Reports() {
  const { t } = useLanguage();
  const [currency, setCurrency] = useState('USD');
  const [months, setMonths] = useState(6);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { data: monthlyData, isLoading: monthlyLoading, error: monthlyError, refetch: refetchMonthly } = useQuery({
    queryKey: ['reports', 'monthly', currentYear, currentMonth, currency],
    queryFn: () => api.reports.monthly(currentYear, currentMonth, currency),
  });

  const { data: categoryData, isLoading: categoryLoading, error: categoryError, refetch: refetchCategory } = useQuery({
    queryKey: ['reports', 'category', currency],
    queryFn: () => api.reports.category(undefined, undefined, currency),
  });

  const { data: trendsData, isLoading: trendsLoading, error: trendsError, refetch: refetchTrends } = useQuery({
    queryKey: ['reports', 'trends', months, currency],
    queryFn: () => api.reports.trends(months, currency),
  });

  const { data: networthData, isLoading: networthLoading, error: networthError, refetch: refetchNetworth } = useQuery({
    queryKey: ['reports', 'networth', currency],
    queryFn: () => api.reports.networth(currency),
  });

  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
  });

  const pieData = categoryData?.categories?.map((cat, index) => ({
    name: t(`category_${cat.category}` as any) || cat.category,
    value: cat.amount,
    color: COLORS[index % COLORS.length],
  })) || [];

  const trendsChartData = trendsData?.trends?.map((trend) => ({
    period: trend.period,
    income: trend.income,
    expenses: trend.expenses,
    net: trend.net,
  })) || [];

  const networthPieData = networthData?.balances?.map((bal, index) => ({
    name: bal.currency,
    value: bal.balance_in_base,
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('reportsAndStats')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{t('reportsDescription')}</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24">
                {currenciesData?.slice(0, 20).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
              <Link to="/wallet">
                <Button variant="ghost" size="sm">
                  {t('backToWallet')}
                </Button>
              </Link>
            </div>
          </div>

          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t('monthlySummary')}</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <Skeleton className="h-32" />
              ) : monthlyError ? (
                <ErrorMessage onRetry={refetchMonthly}>{t('failedToLoadReport')}</ErrorMessage>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-sm text-green-600 dark:text-green-400">{t('income')}</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatCurrency(monthlyData?.income || 0, currency)}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-sm text-red-600 dark:text-red-400">{t('expenses')}</p>
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {formatCurrency(monthlyData?.expenses || 0, currency)}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">{t('netSavings')}</p>
                    <p className={`text-2xl font-bold ${(monthlyData?.net || 0) >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-red-700 dark:text-red-300'}`}>
                      {formatCurrency(monthlyData?.net || 0, currency)}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <p className="text-sm text-purple-600 dark:text-purple-400">{t('savingsRate')}</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                      {(monthlyData?.savings_rate || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>{t('spendingByCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryLoading ? (
                  <Skeleton className="h-64" />
                ) : categoryError ? (
                  <ErrorMessage onRetry={refetchCategory}>{t('failedToLoadReport')}</ErrorMessage>
                ) : pieData.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {t('noDataAvailable')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value, currency) : ''} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Net Worth Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>{t('balanceDistribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                {networthLoading ? (
                  <Skeleton className="h-64" />
                ) : networthError ? (
                  <ErrorMessage onRetry={refetchNetworth}>{t('failedToLoadReport')}</ErrorMessage>
                ) : networthPieData.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {t('noDataAvailable')}
                  </p>
                ) : (
                  <div>
                    <div className="text-center mb-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('totalNetWorth')}</p>
                      <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                        {formatCurrency(networthData?.total_balance || 0, currency)}
                      </p>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={networthPieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name }) => name}
                        >
                          {networthPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value, currency) : ''} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trends */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('incomeVsExpenses')}</CardTitle>
              <Select value={months.toString()} onChange={(e) => setMonths(parseInt(e.target.value))} className="w-32">
                <option value="3">3 {t('months')}</option>
                <option value="6">6 {t('months')}</option>
                <option value="12">12 {t('months')}</option>
              </Select>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-80" />
              ) : trendsError ? (
                <ErrorMessage onRetry={refetchTrends}>{t('failedToLoadReport')}</ErrorMessage>
              ) : trendsChartData.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  {t('noDataAvailable')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendsChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="period" className="text-sm" />
                    <YAxis tickFormatter={(value) => formatCurrency(value, currency)} className="text-sm" />
                    <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value, currency) : ''} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stackId="1"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.3}
                      name={t('income')}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stackId="2"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                      name={t('expenses')}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      stroke="#6366f1"
                      strokeWidth={2}
                      name={t('netSavings')}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
