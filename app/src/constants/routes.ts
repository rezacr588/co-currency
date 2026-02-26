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
  wallet: '/(app)/(tabs)/wallet',
  walletAdd: '/(app)/(tabs)/wallet/add',
  walletHistory: '/(app)/(tabs)/wallet/history',
  walletConvert: '/(app)/(tabs)/wallet/convert',
  walletChat: '/(app)/(tabs)/wallet/chat',
  goals: '/(app)/(tabs)/goals',
  reports: '/(app)/(tabs)/reports',

  // Authenticated routes (non-tab)
  profile: '/(app)/profile',
  budgets: '/(app)/budgets',
  recurring: '/(app)/recurring',
  subscriptions: '/(app)/subscriptions',
  badges: '/(app)/badges',
  planner: '/planner',
} as const;

export type RouteKey = keyof typeof ROUTES;
