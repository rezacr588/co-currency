// Daily financial tips array
// Tips rotate based on day of year

export interface FinancialTip {
  id: number;
  category: 'savings' | 'budgeting' | 'investing' | 'spending' | 'general' | 'debt';
  tip: string;
  detail?: string;
}

export const financialTips: FinancialTip[] = [
  // Savings tips
  {
    id: 1,
    category: 'savings',
    tip: 'Pay yourself first',
    detail: 'Set up automatic transfers to savings on payday before spending on anything else.',
  },
  {
    id: 2,
    category: 'savings',
    tip: 'Build an emergency fund',
    detail: 'Aim for 3-6 months of expenses in an easily accessible account.',
  },
  {
    id: 3,
    category: 'savings',
    tip: 'Use the 24-hour rule',
    detail: 'Wait 24 hours before making non-essential purchases over $50.',
  },
  {
    id: 4,
    category: 'savings',
    tip: 'Round up your purchases',
    detail: 'Transfer the difference to savings when you spend.',
  },
  {
    id: 5,
    category: 'savings',
    tip: 'Save windfalls',
    detail: 'Put tax refunds, bonuses, and gifts directly into savings.',
  },
  {
    id: 6,
    category: 'savings',
    tip: 'Try a no-spend day',
    detail: 'Challenge yourself to spend nothing for one day each week.',
  },
  {
    id: 7,
    category: 'savings',
    tip: 'Automate your savings',
    detail: 'Set up automatic transfers so you save without thinking about it.',
  },
  {
    id: 8,
    category: 'savings',
    tip: 'Keep savings out of sight',
    detail: 'Use a separate bank for savings to reduce temptation.',
  },

  // Budgeting tips
  {
    id: 9,
    category: 'budgeting',
    tip: 'Track every expense',
    detail: 'Awareness is the first step to better financial habits.',
  },
  {
    id: 10,
    category: 'budgeting',
    tip: 'Use the 50/30/20 rule',
    detail: '50% needs, 30% wants, 20% savings and debt repayment.',
  },
  {
    id: 11,
    category: 'budgeting',
    tip: 'Review subscriptions monthly',
    detail: 'Cancel unused subscriptions to free up cash.',
  },
  {
    id: 12,
    category: 'budgeting',
    tip: 'Create category budgets',
    detail: 'Allocate specific amounts for groceries, entertainment, etc.',
  },
  {
    id: 13,
    category: 'budgeting',
    tip: 'Use cash for discretionary spending',
    detail: 'Physical cash makes spending more tangible and controlled.',
  },
  {
    id: 14,
    category: 'budgeting',
    tip: 'Plan your meals weekly',
    detail: 'Meal planning reduces food waste and impulse purchases.',
  },
  {
    id: 15,
    category: 'budgeting',
    tip: 'Check your bank balance daily',
    detail: 'Staying aware of your balance helps prevent overspending.',
  },
  {
    id: 16,
    category: 'budgeting',
    tip: 'Budget for irregular expenses',
    detail: 'Set aside monthly for annual costs like insurance and holidays.',
  },

  // Spending tips
  {
    id: 17,
    category: 'spending',
    tip: 'Compare prices before buying',
    detail: 'A quick search can save you significant money.',
  },
  {
    id: 18,
    category: 'spending',
    tip: 'Unsubscribe from retail emails',
    detail: 'Reduce temptation from promotional offers.',
  },
  {
    id: 19,
    category: 'spending',
    tip: 'Buy quality over quantity',
    detail: 'Investing in durable items saves money long-term.',
  },
  {
    id: 20,
    category: 'spending',
    tip: 'Use cashback apps',
    detail: 'Earn money back on purchases you would make anyway.',
  },
  {
    id: 21,
    category: 'spending',
    tip: 'Shop with a list',
    detail: 'Stick to your list to avoid impulse purchases.',
  },
  {
    id: 22,
    category: 'spending',
    tip: 'Wait for sales on big purchases',
    detail: 'Plan major purchases around seasonal sales.',
  },
  {
    id: 23,
    category: 'spending',
    tip: 'Consider cost per use',
    detail: 'A $100 item used 100 times is better than a $20 item used twice.',
  },
  {
    id: 24,
    category: 'spending',
    tip: 'Avoid lifestyle inflation',
    detail: 'When income rises, increase savings before spending.',
  },

  // Investing tips
  {
    id: 25,
    category: 'investing',
    tip: 'Start investing early',
    detail: 'Compound interest works best over long periods.',
  },
  {
    id: 26,
    category: 'investing',
    tip: 'Diversify your portfolio',
    detail: "Don't put all your eggs in one basket.",
  },
  {
    id: 27,
    category: 'investing',
    tip: 'Keep investing costs low',
    detail: 'High fees eat into your returns over time.',
  },
  {
    id: 28,
    category: 'investing',
    tip: 'Invest consistently',
    detail: 'Regular contributions matter more than timing the market.',
  },
  {
    id: 29,
    category: 'investing',
    tip: 'Max out employer matching',
    detail: "It's free money for your retirement.",
  },
  {
    id: 30,
    category: 'investing',
    tip: 'Reinvest dividends',
    detail: 'Let your money compound faster.',
  },
  {
    id: 31,
    category: 'investing',
    tip: 'Think long-term',
    detail: "Don't panic during market downturns.",
  },
  {
    id: 32,
    category: 'investing',
    tip: 'Educate yourself',
    detail: 'Learn about different investment vehicles.',
  },

  // Debt tips
  {
    id: 33,
    category: 'debt',
    tip: 'Pay more than the minimum',
    detail: 'Even small extra payments reduce total interest paid.',
  },
  {
    id: 34,
    category: 'debt',
    tip: 'Tackle high-interest debt first',
    detail: 'The avalanche method saves the most money.',
  },
  {
    id: 35,
    category: 'debt',
    tip: 'Consider balance transfers',
    detail: 'Move high-interest debt to lower-rate cards.',
  },
  {
    id: 36,
    category: 'debt',
    tip: 'Avoid new debt while paying off old',
    detail: 'Focus on becoming debt-free first.',
  },
  {
    id: 37,
    category: 'debt',
    tip: 'Negotiate interest rates',
    detail: 'Call your creditors and ask for lower rates.',
  },
  {
    id: 38,
    category: 'debt',
    tip: 'Use windfalls to pay down debt',
    detail: 'Apply unexpected money to your highest-rate debt.',
  },
  {
    id: 39,
    category: 'debt',
    tip: 'Celebrate debt milestones',
    detail: 'Acknowledge progress to stay motivated.',
  },
  {
    id: 40,
    category: 'debt',
    tip: 'Consolidate if it saves money',
    detail: 'Combine debts only if it lowers your overall rate.',
  },

  // General financial wisdom
  {
    id: 41,
    category: 'general',
    tip: 'Set specific financial goals',
    detail: 'Clear goals provide motivation and direction.',
  },
  {
    id: 42,
    category: 'general',
    tip: 'Review your finances weekly',
    detail: 'Regular check-ins keep you on track.',
  },
  {
    id: 43,
    category: 'general',
    tip: 'Build multiple income streams',
    detail: "Don't rely on a single source of income.",
  },
  {
    id: 44,
    category: 'general',
    tip: 'Protect your credit score',
    detail: 'Pay bills on time and keep credit utilization low.',
  },
  {
    id: 45,
    category: 'general',
    tip: 'Get adequate insurance',
    detail: 'Protect yourself from financial catastrophes.',
  },
  {
    id: 46,
    category: 'general',
    tip: 'Create a will and estate plan',
    detail: 'Protect your family and assets.',
  },
  {
    id: 47,
    category: 'general',
    tip: 'Negotiate your salary',
    detail: "Even small raises compound over your career.",
  },
  {
    id: 48,
    category: 'general',
    tip: 'Learn to say no',
    detail: "It's okay to decline expensive social activities.",
  },
  {
    id: 49,
    category: 'general',
    tip: 'Focus on net worth, not income',
    detail: "What you keep matters more than what you earn.",
  },
  {
    id: 50,
    category: 'general',
    tip: 'Make financial decisions together',
    detail: 'If partnered, align on money goals as a team.',
  },
];

// Get the tip for today based on day of year
export function getTodaysTip(): FinancialTip {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Rotate through tips based on day of year
  const tipIndex = dayOfYear % financialTips.length;
  return financialTips[tipIndex];
}

// Get tips by category
export function getTipsByCategory(category: FinancialTip['category']): FinancialTip[] {
  return financialTips.filter(tip => tip.category === category);
}

// Get a random tip
export function getRandomTip(): FinancialTip {
  const randomIndex = Math.floor(Math.random() * financialTips.length);
  return financialTips[randomIndex];
}
