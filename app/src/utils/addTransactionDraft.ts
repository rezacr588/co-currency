import type { AddTransactionDraft } from '../types/wallet';

export const ADD_TRANSACTION_DRAFT_VERSION = 1;

export function addTransactionDraftStorageKey(userID: string): string {
  return `@add_transaction_draft:${userID}`;
}

export interface AddTransactionPrefillParams {
  type?: string;
  amount?: string;
  currency?: string;
  wallet_currency?: string;
  category?: string;
  description?: string;
  linked_task_id?: string;
  return_to?: string;
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasAddTransactionPrefill(params: AddTransactionPrefillParams): boolean {
  return hasText(params.type)
    || hasText(params.amount)
    || hasText(params.currency)
    || hasText(params.wallet_currency)
    || hasText(params.category)
    || hasText(params.description)
    || hasText(params.linked_task_id);
}

export function hasAddTransactionDraftContent(draft: AddTransactionDraft): boolean {
  return draft.step !== 'basics'
    || draft.type !== 'debit'
    || draft.amount.trim().length > 0
    || draft.currency !== 'TRY'
    || draft.enable_target_conversion !== true
    || draft.wallet_currency !== 'USD'
    || draft.category !== 'other'
    || draft.description.trim().length > 0;
}
