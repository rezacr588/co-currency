import type { WalletBalance } from '../types/wallet';

type TransactionDirection = 'credit' | 'debit';

export interface AddTransactionSourceWalletInput {
  type: TransactionDirection;
  amount: number;
  currency: string;
  enableSourceWallet: boolean;
  walletCurrency: string;
  conversionResult?: number;
  balances: WalletBalance[];
}

export interface AddTransactionSourceWalletState {
  amountCurrency: string;
  sourceWalletCurrency: string;
  sourceWalletBalance: number;
  sourceWalletAmount: number | null;
  isCrossCurrency: boolean;
  hasInsufficientSourceBalance: boolean;
}

function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toUpperCase();
}

export function getAddTransactionSourceWalletState({
  type,
  amount,
  currency,
  enableSourceWallet,
  walletCurrency,
  conversionResult,
  balances,
}: AddTransactionSourceWalletInput): AddTransactionSourceWalletState {
  const amountCurrency = normalizeCurrencyCode(currency);
  const preferredWalletCurrency = normalizeCurrencyCode(walletCurrency || amountCurrency) || amountCurrency;
  const sourceWalletCurrency = enableSourceWallet ? preferredWalletCurrency : amountCurrency;
  const isCrossCurrency = sourceWalletCurrency !== amountCurrency;
  const sourceWalletAmount =
    amount > 0
      ? isCrossCurrency
        ? (typeof conversionResult === 'number' && Number.isFinite(conversionResult) ? conversionResult : null)
        : amount
      : null;

  const matchedBalance = balances.find(
    (balance) => normalizeCurrencyCode(balance.currency) === sourceWalletCurrency
  );
  const sourceWalletBalance = matchedBalance?.balance ?? 0;
  const hasInsufficientSourceBalance =
    type === 'debit' &&
    sourceWalletAmount !== null &&
    sourceWalletBalance < sourceWalletAmount;

  return {
    amountCurrency,
    sourceWalletCurrency,
    sourceWalletBalance,
    sourceWalletAmount,
    isCrossCurrency,
    hasInsufficientSourceBalance,
  };
}
