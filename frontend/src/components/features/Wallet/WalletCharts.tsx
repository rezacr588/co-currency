import { useMemo } from 'react';
import { Card } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import type { Transaction, WalletBalance } from '../../../types/wallet';
import { DEFAULT_CATEGORIES } from '../../../types/wallet';

interface WalletChartsProps {
  transactions: Transaction[];
  balances: WalletBalance[];
}

export function WalletCharts({ transactions, balances }: WalletChartsProps) {
  const { t } = useLanguage();

  // Calculate spending by category
  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type === 'debit') {
        const category = tx.category || 'other';
        categoryTotals[category] = (categoryTotals[category] || 0) + tx.amount;
      }
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => {
        const categoryInfo = DEFAULT_CATEGORIES.find(c => c.name === name);
        return {
          name,
          value,
          icon: categoryInfo?.icon || '📦',
          color: categoryInfo?.color || '#6b7280',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Calculate income vs expenses
  const incomeExpenses = useMemo(() => {
    let income = 0;
    let expenses = 0;

    transactions.forEach(tx => {
      if (tx.type === 'credit') {
        income += tx.amount;
      } else if (tx.type === 'debit') {
        expenses += tx.amount;
      }
    });

    return { income, expenses };
  }, [transactions]);

  // Calculate total for pie chart percentages
  const totalSpending = categoryData.reduce((sum, cat) => sum + cat.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Spending by Category */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('spendingByCategory') || 'Spending by Category'}
        </h3>
        {categoryData.length > 0 ? (
          <div className="space-y-3">
            {categoryData.slice(0, 6).map((category) => {
              const percentage = totalSpending > 0 ? (category.value / totalSpending) * 100 : 0;
              return (
                <div key={category.name} className="flex items-center gap-3">
                  <span className="text-xl">{category.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 dark:text-slate-300 capitalize">
                        {category.name}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        ${category.value.toFixed(2)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: category.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No spending data yet
          </p>
        )}
      </Card>

      {/* Income vs Expenses */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('incomeVsExpenses') || 'Income vs Expenses'}
        </h3>
        <div className="flex flex-col items-center py-4">
          <div className="flex gap-8 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                ${incomeExpenses.income.toFixed(2)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('income') || 'Income'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                ${incomeExpenses.expenses.toFixed(2)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t('expenses') || 'Expenses'}
              </div>
            </div>
          </div>

          {/* Balance indicator */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-green-600 dark:text-green-400">Income</span>
              <span className="text-red-600 dark:text-red-400">Expenses</span>
            </div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              {(incomeExpenses.income + incomeExpenses.expenses) > 0 && (
                <>
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{
                      width: `${(incomeExpenses.income / (incomeExpenses.income + incomeExpenses.expenses)) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{
                      width: `${(incomeExpenses.expenses / (incomeExpenses.income + incomeExpenses.expenses)) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>
            <div className="text-center mt-4">
              <div className={`text-lg font-semibold ${
                incomeExpenses.income >= incomeExpenses.expenses
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                Net: ${(incomeExpenses.income - incomeExpenses.expenses).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Balance Distribution */}
      <Card className="lg:col-span-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('balanceDistribution') || 'Balance Distribution'}
        </h3>
        {balances.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {balances.map((balance) => (
              <div
                key={balance.currency}
                className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center"
              >
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {balance.balance?.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {balance.currency}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            No balances yet
          </p>
        )}
      </Card>
    </div>
  );
}
