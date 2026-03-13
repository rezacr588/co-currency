import {
  ADD_TRANSACTION_DRAFT_VERSION,
  addTransactionDraftStorageKey,
  hasAddTransactionDraftContent,
  hasAddTransactionPrefill,
} from '../addTransactionDraft';

describe('addTransactionDraft helpers', () => {
  it('builds a stable per-user storage key', () => {
    expect(addTransactionDraftStorageKey('user-1')).toBe('@add_transaction_draft:user-1');
  });

  it('detects meaningful launch prefills including linked tasks', () => {
    expect(hasAddTransactionPrefill({ return_to: '/finapp' })).toBe(false);
    expect(hasAddTransactionPrefill({ amount: '42' })).toBe(true);
    expect(hasAddTransactionPrefill({ linked_task_id: 'task-1' })).toBe(true);
  });

  it('treats the untouched default draft as empty and edited drafts as meaningful', () => {
    const emptyDraft = {
      version: ADD_TRANSACTION_DRAFT_VERSION,
      updated_at: Date.now(),
      step: 'basics' as const,
      type: 'debit' as const,
      amount: '',
      currency: 'TRY',
      enable_target_conversion: true,
      wallet_currency: 'USD',
      category: 'other',
      description: '',
    };

    expect(hasAddTransactionDraftContent(emptyDraft)).toBe(false);
    expect(hasAddTransactionDraftContent({ ...emptyDraft, amount: '25' })).toBe(true);
    expect(hasAddTransactionDraftContent({ ...emptyDraft, step: 'review' })).toBe(true);
  });
});
