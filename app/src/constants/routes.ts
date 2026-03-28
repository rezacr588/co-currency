// Expo Router routes - file-based routing
export const ROUTES = {
  // Public routes
  home: '/',
  converter: '/converter',
  about: '/about',

  // Auth routes
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',

  // OAuth callbacks
  linkedinCallback: '/auth/linkedin/callback',
  googleCallback: '/auth/google/callback',

  // Authenticated routes (tabs)
  finappHome: '/finapp',
  todoHome: '/todo',
  dashboard: '/(app)/(tabs)',
  coaiHome: '/(app)/(tabs)',
  coaiChat: '/(app)/coai-chat',
  wallet: '/(app)/(tabs)',
  walletDetails: '/(app)/(tabs)/wallet',
  walletAdd: '/transaction-create',
  walletHistory: '/(app)/(tabs)/wallet/history',
  walletConvert: '/(app)/(tabs)/wallet/convert',
  walletChat: '/(app)/(tabs)/wallet/chat',
  plannerTab: '/(app)/(tabs)/planner',
  goals: '/(app)/(tabs)/goals',
  reports: '/(app)/(tabs)/reports',
  tools: '/(app)/tools',

  // Authenticated routes (non-tab)
  profile: '/(app)/profile',
  budgets: '/(app)/budgets',
  recurring: '/(app)/recurring',
  subscriptions: '/(app)/subscriptions',
  badges: '/(app)/badges',
  planner: '/planner',
} as const;

export type RouteKey = keyof typeof ROUTES;
