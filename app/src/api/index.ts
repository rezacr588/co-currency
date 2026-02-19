import { auth } from './auth';
import { wallet } from './wallet';
import { ai } from './ai';
import { chat } from './chat';
import { goals } from './goals';
import { tags } from './tags';
import { budgets } from './budgets';
import { recurring } from './recurring';
import { reports } from './reports';
import { subscriptions } from './subscriptions';
import { badges } from './badges';
import { notes } from './notes';
import { loans } from './loans';
import { notifications } from './notifications';
import { challenges } from './challenges';
import { xp } from './xp';
import { news } from './news';
import { currencies, rates, convert } from './exchange';

export const api = {
  currencies,
  rates,
  convert,
  auth,
  wallet,
  ai,
  chat,
  goals,
  tags,
  budgets,
  recurring,
  reports,
  subscriptions,
  badges,
  notes,
  loans,
  notifications,
  challenges,
  xp,
  news,
};

export {
  API_BASE,
  setAuthToken,
  setRefreshToken,
  getAuthToken,
  getRefreshToken,
  clearAuthToken,
  setOnAuthError,
  loadTokens,
} from './base';
