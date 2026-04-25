import { auth } from './auth';
import { wallet } from './wallet';
import { ai } from './ai';
import { chat } from './chat';
import { goals } from './goals';
import { tags } from './tags';
import { tasks } from './tasks';
import { planner } from './planner';
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
import { wealth } from './wealth';
import { coai } from './coai';
import { forecasting } from './forecasting';
import { agent } from './agent';
import { social } from './social';
import { admin } from './admin';
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
  tasks,
  planner,
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
  wealth,
  coai,
  forecasting,
  agent,
  social,
  admin,
};

export {
  API_BASE,
  setAuthToken,
  setRefreshToken,
  getAuthToken,
  getRefreshToken,
  clearAuthToken,
  setOnAuthError,
  setOnTokenRefresh,
  loadTokens,
} from './base';
