import { auth } from './auth';
import { wallet } from './wallet';
import { ai } from './ai';
import { goals } from './goals';
import { tags } from './tags';
import { budgets } from './budgets';
import { recurring } from './recurring';
import { reports } from './reports';
import { subscriptions } from './subscriptions';
import { badges } from './badges';
import { currencies, rates, convert } from './exchange';
import { chat } from './chat';

export const api = {
  currencies,
  rates,
  convert,
  auth,
  wallet,
  ai,
  goals,
  tags,
  budgets,
  recurring,
  reports,
  subscriptions,
  badges,
  chat,
};

export {
  API_BASE,
  setAuthToken,
  setRefreshToken,
  getAuthToken,
  getRefreshToken,
  clearAuthToken,
  setOnAuthError,
} from './base';
