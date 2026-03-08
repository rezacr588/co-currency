import { getAddTransactionSourceWalletState } from '../addTransactionSourceWallet';

describe('getAddTransactionSourceWalletState', () => {
  it('uses the amount currency when the source-wallet toggle is off', () => {
    const state = getAddTransactionSourceWalletState({
      type: 'debit',
      amount: 25,
      currency: 'try',
      enableSourceWallet: false,
      walletCurrency: 'USD',
      balances: [{ currency: 'TRY', balance: 40, updated_at: '' }],
    });

    expect(state.sourceWalletCurrency).toBe('TRY');
    expect(state.sourceWalletAmount).toBe(25);
    expect(state.isCrossCurrency).toBe(false);
    expect(state.hasInsufficientSourceBalance).toBe(false);
  });

  it('keeps USD as the source wallet for a non-USD debit when enabled', () => {
    const state = getAddTransactionSourceWalletState({
      type: 'debit',
      amount: 100,
      currency: 'eur',
      enableSourceWallet: true,
      walletCurrency: 'usd',
      conversionResult: 108,
      balances: [{ currency: 'USD', balance: 250, updated_at: '' }],
    });

    expect(state.sourceWalletCurrency).toBe('USD');
    expect(state.sourceWalletAmount).toBe(108);
    expect(state.isCrossCurrency).toBe(true);
    expect(state.hasInsufficientSourceBalance).toBe(false);
  });

  it('treats USD to USD as same-currency even when the source-wallet toggle is on', () => {
    const state = getAddTransactionSourceWalletState({
      type: 'debit',
      amount: 50,
      currency: 'USD',
      enableSourceWallet: true,
      walletCurrency: 'USD',
      balances: [{ currency: 'USD', balance: 100, updated_at: '' }],
    });

    expect(state.sourceWalletCurrency).toBe('USD');
    expect(state.sourceWalletAmount).toBe(50);
    expect(state.isCrossCurrency).toBe(false);
  });

  it('flags insufficient balance for cross-currency debits against the source wallet', () => {
    const state = getAddTransactionSourceWalletState({
      type: 'debit',
      amount: 100,
      currency: 'TRY',
      enableSourceWallet: true,
      walletCurrency: 'USD',
      conversionResult: 10,
      balances: [{ currency: 'USD', balance: 8, updated_at: '' }],
    });

    expect(state.sourceWalletCurrency).toBe('USD');
    expect(state.hasInsufficientSourceBalance).toBe(true);
  });

  it('does not flag insufficient balance for credits', () => {
    const state = getAddTransactionSourceWalletState({
      type: 'credit',
      amount: 100,
      currency: 'TRY',
      enableSourceWallet: true,
      walletCurrency: 'USD',
      conversionResult: 10,
      balances: [{ currency: 'USD', balance: 0, updated_at: '' }],
    });

    expect(state.hasInsufficientSourceBalance).toBe(false);
  });
});
