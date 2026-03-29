package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

// buildSystemPrompt creates a rich system prompt with financial context
func (s *AIChatService) buildSystemPrompt(userName string, fctx *model.FinancialContext, memories []model.UserMemory, rates map[string]float64) string {
	var sb strings.Builder

	// Header with user context (sanitize to prevent prompt injection)
	displayName := sanitizeForPrompt(userName, 100)
	if displayName == "" {
		displayName = "User"
	}

	fmt.Fprintf(&sb, `You are a helpful and knowledgeable personal finance advisor for %s. You have access to their complete financial data, memories from past conversations, and real-time exchange rates. Use this information to provide personalized, actionable advice.

## TODAY'S DATE
%s (%d days until month end)

`, displayName, fctx.TodayDate, fctx.DaysUntilMonthEnd)

	// User profile
	sb.WriteString("## USER PROFILE\n")
	if fctx.UserName != "" {
		fmt.Fprintf(&sb, "- Name: %s\n", sanitizeForPrompt(fctx.UserName, 100))
	}
	if fctx.AccountAgeDays > 0 {
		fmt.Fprintf(&sb, "- Account age: %d days\n", fctx.AccountAgeDays)
	}
	if fctx.PreferredCurrency != "" {
		fmt.Fprintf(&sb, "- Primary currency: %s\n", fctx.PreferredCurrency)
	}
	sb.WriteString("\n")

	// Long-term memories
	if len(memories) > 0 {
		sb.WriteString("## WHAT I REMEMBER ABOUT YOU\n")
		for _, m := range memories {
			fmt.Fprintf(&sb, "- [%s] %s\n", sanitizeForPrompt(m.Category, 100), sanitizeForPrompt(m.Content, 500))
		}
		sb.WriteString("\n")
	}

	// Multi-currency balances
	sb.WriteString("## WALLET BALANCES\n")
	if len(fctx.Balances) > 0 {
		for _, b := range fctx.Balances {
			fmt.Fprintf(&sb, "- %s: %.2f\n", b.Currency, b.Balance)
		}
	} else {
		sb.WriteString("- No balances yet\n")
	}
	sb.WriteString("\n")

	// Exchange rates
	if len(rates) > 0 {
		sb.WriteString("## LIVE EXCHANGE RATES\n")
		baseCurrency := fctx.PreferredCurrency
		if baseCurrency == "" {
			baseCurrency = "USD"
		}
		sb.WriteString(fmt.Sprintf("Base: %s\n", baseCurrency))
		for currency, rate := range rates {
			if currency != baseCurrency {
				sb.WriteString(fmt.Sprintf("- 1 %s = %.4f %s\n", baseCurrency, rate, currency))
			}
		}
		sb.WriteString("\n")
	}

	// Monthly overview
	sb.WriteString("## THIS MONTH'S OVERVIEW\n")
	sb.WriteString(fmt.Sprintf("- Income: %.2f %s\n", fctx.MonthlyIncome, fctx.PreferredCurrency))
	sb.WriteString(fmt.Sprintf("- Expenses: %.2f %s\n", fctx.MonthlyExpenses, fctx.PreferredCurrency))
	savings := fctx.MonthlyIncome - fctx.MonthlyExpenses
	var savingsRate float64
	if fctx.MonthlyIncome > 0 {
		savingsRate = (savings / fctx.MonthlyIncome) * 100
	}
	sb.WriteString(fmt.Sprintf("- Net savings: %.2f (%.1f%% savings rate)\n", savings, savingsRate))
	if fctx.SpendingTrend != "" {
		sb.WriteString(fmt.Sprintf("- Spending trend: %s vs last month\n", fctx.SpendingTrend))
	}
	sb.WriteString(fmt.Sprintf("- Transactions: %d\n\n", fctx.RecentTransactions))

	// Recent transactions
	if len(fctx.RecentTransactionList) > 0 {
		sb.WriteString("## RECENT TRANSACTIONS\n")
		for _, tx := range fctx.RecentTransactionList {
			sign := "+"
			if tx.Type == "debit" {
				sign = "-"
			}
			sb.WriteString(fmt.Sprintf("- %s: %s%.2f %s - %s", tx.Date, sign, tx.Amount, tx.Currency, tx.Description))
			if tx.Category != "" {
				sb.WriteString(fmt.Sprintf(" [%s]", tx.Category))
			}
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
	}

	// Top spending categories
	if len(fctx.TopCategories) > 0 {
		sb.WriteString("## TOP SPENDING CATEGORIES\n")
		for _, cat := range fctx.TopCategories {
			sb.WriteString(fmt.Sprintf("- %s: %.2f %s\n", cat.Category, cat.Amount, fctx.PreferredCurrency))
		}
		sb.WriteString("\n")
	}

	// Active budgets
	if len(fctx.ActiveBudgets) > 0 {
		sb.WriteString("## BUDGETS\n")
		for _, b := range fctx.ActiveBudgets {
			pct := float64(0)
			if b.Budget > 0 {
				pct = (b.Spent / b.Budget) * 100
			}
			status := "on track"
			if pct > 90 {
				status = "NEAR LIMIT"
			}
			if pct > 100 {
				status = "OVER BUDGET"
			}
			sb.WriteString(fmt.Sprintf("- %s: %.2f / %.2f spent (%.0f%%) - %s\n", b.Category, b.Spent, b.Budget, pct, status))
		}
		sb.WriteString("\n")
	}

	// Goals
	if len(fctx.SavingsGoals) > 0 {
		sb.WriteString("## GOALS\n")
		for _, g := range fctx.SavingsGoals {
			sb.WriteString(fmt.Sprintf("- %s: %.2f / %.2f (%.0f%% complete)\n", g.Name, g.Current, g.Target, g.Progress))
		}
		sb.WriteString("\n")
	}

	// Recurring items
	if len(fctx.RecurringItems) > 0 {
		sb.WriteString("## RECURRING TRANSACTIONS\n")
		for _, r := range fctx.RecurringItems {
			sb.WriteString(fmt.Sprintf("- %s: %.2f %s (%s, next: %s)\n", r.Description, r.Amount, r.Currency, r.Frequency, r.NextDate))
		}
		sb.WriteString("\n")
	}

	// Loans and Debts
	if len(fctx.ActiveLoans) > 0 || fctx.TotalDebt > 0 || fctx.TotalReceivable > 0 {
		sb.WriteString("## LOANS & DEBTS\n")
		if fctx.TotalDebt > 0 {
			sb.WriteString(fmt.Sprintf("- Total owed to others: %.2f %s\n", fctx.TotalDebt, fctx.PreferredCurrency))
		}
		if fctx.TotalReceivable > 0 {
			sb.WriteString(fmt.Sprintf("- Total owed to user: %.2f %s\n", fctx.TotalReceivable, fctx.PreferredCurrency))
		}
		if fctx.NetDebtPosition != 0 {
			position := "net creditor"
			if fctx.NetDebtPosition > 0 {
				position = "net debtor"
			}
			sb.WriteString(fmt.Sprintf("- Net position: %.2f %s (%s)\n", fctx.NetDebtPosition, fctx.PreferredCurrency, position))
		}
		if len(fctx.ActiveLoans) > 0 {
			sb.WriteString("\nActive loans:\n")
			for _, loan := range fctx.ActiveLoans {
				loanType := "owes"
				if loan.Type == "lent" {
					loanType = "owed by"
				}
				sb.WriteString(fmt.Sprintf("- %s (%s %s): %.2f %s remaining", loan.Name, loanType, loan.Counterparty, loan.RemainingAmount, loan.Currency))
				if loan.DueDate != "" {
					sb.WriteString(fmt.Sprintf(" (due: %s)", loan.DueDate))
				}
				sb.WriteString("\n")
			}
		}
		sb.WriteString("\n")
	}

	// Purchasing power data
	if fctx.WealthShieldScore > 0 || len(fctx.InflationExposure) > 0 {
		sb.WriteString("## PURCHASING POWER & INFLATION\n")
		sb.WriteString(fmt.Sprintf("- Wealth Shield Score: %d/100 (%s)\n", fctx.WealthShieldScore, model.GetShieldLabel(fctx.WealthShieldScore)))
		if fctx.RealTotalBalance > 0 {
			sb.WriteString(fmt.Sprintf("- Real Total Balance: %.2f %s (vs nominal %.2f)\n", fctx.RealTotalBalance, fctx.PreferredCurrency, fctx.TotalBalance))
		}
		if fctx.PurchasingPowerChange != 0 {
			sb.WriteString(fmt.Sprintf("- Monthly purchasing power change: %.2f%%\n", fctx.PurchasingPowerChange))
		}
		if fctx.CurrencyConcentrationRisk > 0 {
			sb.WriteString(fmt.Sprintf("- Currency concentration risk: %.1f%% (HHI)\n", fctx.CurrencyConcentrationRisk))
		}
		if len(fctx.InflationExposure) > 0 {
			sb.WriteString("\nPer-currency inflation exposure:\n")
			for _, e := range fctx.InflationExposure {
				sb.WriteString(fmt.Sprintf("- %s: %.1f%% annual inflation, real value: %.2f (erosion: %.2f)\n",
					e.Currency, e.AnnualRate, e.RealBalance, e.ErosionAmount))
			}
		}
		sb.WriteString("\n")
	}

	// Available categories
	if len(fctx.Categories) > 0 {
		sb.WriteString("## AVAILABLE CATEGORIES\n")
		for _, cat := range fctx.Categories {
			label := cat.Name
			if cat.Icon != "" {
				label = cat.Icon + " " + label
			}
			sb.WriteString(fmt.Sprintf("- %s\n", label))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(`## YOUR ROLE

1. **Use Real Data**: Always reference specific numbers from their financial data
2. **Use Correct Rates**: When converting currencies or discussing exchange rates, use the LIVE EXCHANGE RATES provided above
3. **Remember Context**: Reference memories and previous conversations when relevant
4. **Be Actionable**: Give concrete suggestions with specific amounts
5. **Talk Like a Human Advisor**: Sound like a trusted personal finance advisor in a natural conversation, not like an analyst report
6. **Avoid Jargon**: Use plain language and explain clearly when needed
7. **Be Concise**: Keep responses focused and easy to read
8. **Track Insights**: When you learn something important about the user (preferences, goals, habits), note it for future conversations

## RESPONSE FORMAT

- Be prose-first and conversational. Sound like a real advisor speaking naturally.
- Prefer 2-6 short paragraphs. Use bullets only when they improve clarity.
- Do **not** use markdown tables in the main body.
- If structured tabular data is truly needed, add one table at the very end under a clear "Summary Table" heading.
- Keep any table separate from the main explanation so clients can render it in a dedicated modal.

## CAPABILITIES

You can help with:
- Financial analysis and advice based on their data
- Currency conversions using real-time rates
- Budget tracking and recommendations
- Goal progress updates
- Spending pattern analysis
- Recurring expense insights

Remember: Be friendly, personal, practical, and always use the user's actual data when giving advice.
`)

	// Append tool definitions
	sb.WriteString("\n")
	sb.WriteString(buildToolDefinitionsPrompt())

	return sb.String()
}

// getFinancialContext gathers the user's financial data for the AI (with 60s cache)
func (s *AIChatService) getFinancialContext(ctx context.Context, userID uuid.UUID) (*model.FinancialContext, error) {
	cacheKey := "financial-context:" + userID.String()
	if cached, found := s.contextCache.Get(cacheKey); found {
		if fctx, ok := cached.(*model.FinancialContext); ok {
			return fctx, nil
		}
	}

	fctx, err := s.fetchFinancialContext(ctx, userID)
	if err != nil {
		return fctx, err
	}

	s.contextCache.Set(cacheKey, fctx, 5*time.Minute)
	return fctx, nil
}

// fetchFinancialContext performs the actual queries to gather financial data
// Uses parallel fetching via goroutines to reduce latency
func (s *AIChatService) fetchFinancialContext(ctx context.Context, userID uuid.UUID) (*model.FinancialContext, error) {
	log.Debug().
		Str("user_id", userID.String()).
		Msg("Retrieved financial context for AI chat")

	fctx := &model.FinancialContext{}
	now := time.Now()
	convertCurrency := s.contextCurrencyConverter()

	// Set date context
	fctx.TodayDate = now.Format("January 2, 2006")
	fctx.DaysUntilMonthEnd = daysUntilEndOfMonth(now)

	// Channel types for parallel fetching results
	type userResult struct {
		user *model.User
		err  error
	}
	type balancesResult struct {
		balances []model.WalletBalance
		err      error
	}
	type transactionsResult struct {
		transactions []model.Transaction
		err          error
	}
	type budgetsResult struct {
		budgets []model.Budget
		err     error
	}
	type goalsResult struct {
		goals []model.Goal
		err   error
	}
	type recurringResult struct {
		recurring []model.RecurringTransaction
		err       error
	}
	type categoriesResult struct {
		categories []model.Category
		err        error
	}
	type loansResult struct {
		loans []model.Loan
		err   error
	}

	// Create channels for results
	userCh := make(chan userResult, 1)
	balancesCh := make(chan balancesResult, 1)
	transactionsCh := make(chan transactionsResult, 1)
	budgetsCh := make(chan budgetsResult, 1)
	goalsCh := make(chan goalsResult, 1)
	recurringCh := make(chan recurringResult, 1)
	categoriesCh := make(chan categoriesResult, 1)
	loansCh := make(chan loansResult, 1)

	// Launch parallel fetches
	go func() {
		if s.userRepo != nil {
			user, err := s.userRepo.GetByID(ctx, userID)
			userCh <- userResult{user, err}
		} else {
			userCh <- userResult{nil, nil}
		}
	}()

	go func() {
		balances, err := s.walletRepo.GetBalances(ctx, userID)
		balancesCh <- balancesResult{balances, err}
	}()

	go func() {
		transactions, err := s.walletRepo.GetTransactions(ctx, userID, 50, 0)
		transactionsCh <- transactionsResult{transactions, err}
	}()

	go func() {
		budgets, err := s.budgetRepo.GetByUser(ctx, userID)
		budgetsCh <- budgetsResult{budgets, err}
	}()

	go func() {
		goals, err := s.goalRepo.GetByUser(ctx, userID)
		goalsCh <- goalsResult{goals, err}
	}()

	go func() {
		if s.recurringRepo != nil {
			recurring, err := s.recurringRepo.GetByUser(ctx, userID)
			recurringCh <- recurringResult{recurring, err}
		} else {
			recurringCh <- recurringResult{nil, nil}
		}
	}()

	go func() {
		if s.categoryRepo != nil {
			categories, err := s.categoryRepo.GetCategories(ctx, userID)
			categoriesCh <- categoriesResult{categories, err}
		} else {
			categoriesCh <- categoriesResult{nil, nil}
		}
	}()

	go func() {
		if s.loanRepo != nil {
			loans, err := s.loanRepo.GetAllByUser(ctx, userID.String(), "active", "")
			loansCh <- loansResult{loans, err}
		} else {
			loansCh <- loansResult{nil, nil}
		}
	}()

	// Collect results (all run in parallel, wait for all to complete)
	userRes := <-userCh
	balancesRes := <-balancesCh
	transactionsRes := <-transactionsCh
	budgetsRes := <-budgetsCh
	goalsRes := <-goalsCh
	recurringRes := <-recurringCh
	categoriesRes := <-categoriesCh
	loansRes := <-loansCh

	rateCache := make(map[string]float64)

	// Process user info
	if userRes.err == nil && userRes.user != nil {
		fctx.UserName = sanitizeForPrompt(userRes.user.Name, 100)
		if userRes.user.PreferredCurrency != "" {
			fctx.PreferredCurrency = normalizeCurrencyCode(userRes.user.PreferredCurrency)
		}
		if !userRes.user.CreatedAt.IsZero() {
			fctx.AccountAgeDays = int(now.Sub(userRes.user.CreatedAt).Hours() / 24)
		}
	}

	// Process balances
	if balancesRes.err == nil {
		for _, b := range balancesRes.balances {
			fctx.Balances = append(fctx.Balances, model.CurrencyBalance{
				Currency: b.Currency,
				Balance:  b.Balance,
			})
		}
		if fctx.PreferredCurrency == "" {
			fctx.PreferredCurrency = selectPreferredCurrencyFromBalances(ctx, balancesRes.balances, rateCache, convertCurrency)
		}
	}

	if fctx.PreferredCurrency == "" {
		fctx.PreferredCurrency = "USD"
	}

	// Convert aggregate balance to preferred currency
	for _, b := range fctx.Balances {
		converted, _ := convertAmountWithRateCache(
			ctx,
			b.Balance,
			b.Currency,
			fctx.PreferredCurrency,
			rateCache,
			convertCurrency,
		)
		fctx.TotalBalance += converted
	}

	// Process transactions and calculate monthly stats
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startOfLastMonth := startOfMonth.AddDate(0, -1, 0)

	if transactionsRes.err == nil {
		transactions := transactionsRes.transactions
		if len(fctx.Balances) == 0 && len(transactions) > 0 {
			currency := normalizeCurrencyCode(transactions[0].Currency)
			if currency != "" {
				fctx.PreferredCurrency = currency
			}
		}

		categoryTotals := make(map[string]float64)

		for i, tx := range transactions {
			convertedAmount, _ := convertAmountWithRateCache(
				ctx,
				tx.Amount,
				tx.Currency,
				fctx.PreferredCurrency,
				rateCache,
				convertCurrency,
			)

			// This month
			if tx.CreatedAt.After(startOfMonth) {
				fctx.RecentTransactions++
				if tx.Type == model.TransactionTypeCredit {
					fctx.MonthlyIncome += convertedAmount
				} else if tx.Type == model.TransactionTypeDebit {
					fctx.MonthlyExpenses += convertedAmount
					if tx.Category != "" {
						categoryTotals[tx.Category] += convertedAmount
					}
				}
			}

			// Last month (for trend)
			if tx.CreatedAt.After(startOfLastMonth) && tx.CreatedAt.Before(startOfMonth) {
				if tx.Type == "debit" {
					fctx.LastMonthExpenses += convertedAmount
				}
			}

			// Add recent transactions to list (last 10 for prompt efficiency)
			if i < 10 {
				fctx.RecentTransactionList = append(fctx.RecentTransactionList, model.TransactionSummary{
					Date:        tx.CreatedAt.Format("Jan 2"),
					Type:        tx.Type,
					Amount:      tx.Amount,
					Currency:    tx.Currency,
					Category:    sanitizeForPrompt(tx.Category, 100),
					Description: sanitizeForPrompt(tx.Description, 500),
				})
			}
		}

		// Calculate spending trend
		if fctx.LastMonthExpenses > 0 {
			change := ((fctx.MonthlyExpenses - fctx.LastMonthExpenses) / fctx.LastMonthExpenses) * 100
			if change > 10 {
				fctx.SpendingTrend = "increasing"
			} else if change < -10 {
				fctx.SpendingTrend = "decreasing"
			} else {
				fctx.SpendingTrend = "stable"
			}
		} else if fctx.MonthlyExpenses > 0 {
			fctx.SpendingTrend = "no prior data"
		}

		// Get top 5 spending categories
		for cat, amount := range categoryTotals {
			fctx.TopCategories = append(fctx.TopCategories, model.CategorySpending{
				Category: cat,
				Amount:   amount,
			})
		}
		// Sort by amount (descending)
		for i := 0; i < len(fctx.TopCategories); i++ {
			for j := i + 1; j < len(fctx.TopCategories); j++ {
				if fctx.TopCategories[j].Amount > fctx.TopCategories[i].Amount {
					fctx.TopCategories[i], fctx.TopCategories[j] = fctx.TopCategories[j], fctx.TopCategories[i]
				}
			}
		}
		if len(fctx.TopCategories) > 5 {
			fctx.TopCategories = fctx.TopCategories[:5]
		}
	}

	// Process budgets
	if budgetsRes.err == nil {
		for i, b := range budgetsRes.budgets {
			if i >= 10 {
				break
			}
			fctx.ActiveBudgets = append(fctx.ActiveBudgets, model.BudgetSummary{
				Category: sanitizeForPrompt(b.Category, 100),
				Budget:   b.Amount,
				Spent:    b.Spent,
			})
		}
	}

	// Process goals
	if goalsRes.err == nil {
		for i, g := range goalsRes.goals {
			if i >= 10 {
				break
			}
			progress := float64(0)
			if g.TargetAmount > 0 {
				progress = (g.CurrentAmount / g.TargetAmount) * 100
			}
			fctx.SavingsGoals = append(fctx.SavingsGoals, model.GoalSummary{
				Name:     sanitizeForPrompt(g.Name, 100),
				Target:   g.TargetAmount,
				Current:  g.CurrentAmount,
				Progress: progress,
			})
		}
	}

	// Process recurring transactions
	if recurringRes.err == nil {
		for _, r := range recurringRes.recurring {
			if r.IsActive {
				recType := "expense"
				if r.Type == "credit" {
					recType = "income"
				}
				fctx.RecurringItems = append(fctx.RecurringItems, model.RecurringSummary{
					Description: sanitizeForPrompt(r.Description, 500),
					Amount:      r.Amount,
					Currency:    r.Currency,
					Frequency:   r.Frequency,
					NextDate:    r.NextExecution.Format("Jan 2"),
					Type:        recType,
				})
			}
		}
	}

	// Process categories
	if categoriesRes.err == nil {
		for i, cat := range categoriesRes.categories {
			if i >= 10 {
				break
			}
			fctx.Categories = append(fctx.Categories, model.CategoryInfo{
				Name:      sanitizeForPrompt(cat.Name, 100),
				Icon:      cat.Icon,
				IsDefault: cat.IsDefault,
			})
		}
	}

	// Process loans
	if loansRes.err == nil {
		for _, loan := range loansRes.loans {
			loanSummary := model.LoanSummaryForAI{
				Name:            sanitizeForPrompt(loan.Name, 100),
				Type:            string(loan.Type),
				RemainingAmount: loan.RemainingAmount,
				Currency:        loan.Currency,
				Counterparty:    sanitizeForPrompt(loan.Counterparty, 100),
			}
			if loan.DueDate != nil {
				loanSummary.DueDate = loan.DueDate.Format("Jan 2, 2006")
			}
			fctx.ActiveLoans = append(fctx.ActiveLoans, loanSummary)

			convertedRemaining, _ := convertAmountWithRateCache(
				ctx,
				loan.RemainingAmount,
				loan.Currency,
				fctx.PreferredCurrency,
				rateCache,
				convertCurrency,
			)

			if loan.Type == model.LoanTypeBorrowed {
				fctx.TotalDebt += convertedRemaining
			} else {
				fctx.TotalReceivable += convertedRemaining
			}
		}
		fctx.NetDebtPosition = fctx.TotalDebt - fctx.TotalReceivable
	}

	// Get purchasing power data (sequential as it depends on preferred currency)
	if s.wealthService != nil {
		wealthOverview, err := s.wealthService.GetOverview(ctx, userID, fctx.PreferredCurrency)
		if err == nil && wealthOverview != nil {
			fctx.WealthShieldScore = wealthOverview.ShieldScore
			fctx.RealTotalBalance = wealthOverview.RealTotal
			fctx.NominalVsRealGap = wealthOverview.ErosionRate

			if wealthOverview.NominalTotal > 0 {
				fctx.PurchasingPowerChange = -wealthOverview.ErosionRate
			}

			// Currency concentration risk (HHI)
			hhi := 0.0
			for _, e := range wealthOverview.CurrencyBreakdown {
				share := e.SharePercentage / 100.0
				hhi += share * share
			}
			fctx.CurrencyConcentrationRisk = hhi * 100

			// Per-currency inflation exposure
			for _, e := range wealthOverview.CurrencyBreakdown {
				fctx.InflationExposure = append(fctx.InflationExposure, model.CurrencyInflation{
					Currency:      e.Currency,
					Balance:       e.NominalBalance,
					AnnualRate:    e.AnnualInflation,
					RealBalance:   e.RealBalance,
					ErosionAmount: e.ErosionAmount,
				})
			}
		}
	}

	return fctx, nil
}

func (s *AIChatService) contextCurrencyConverter() currencyConverterFunc {
	if s.exchangeService == nil {
		return nil
	}
	return s.exchangeService.Convert
}

func normalizeCurrencyCode(currency string) string {
	return strings.ToUpper(strings.TrimSpace(currency))
}

func convertAmountWithRateCache(
	ctx context.Context,
	amount float64,
	fromCurrency string,
	toCurrency string,
	rateCache map[string]float64,
	convert currencyConverterFunc,
) (float64, bool) {
	from := normalizeCurrencyCode(fromCurrency)
	to := normalizeCurrencyCode(toCurrency)

	if amount == 0 {
		return 0, true
	}
	if from == "" || to == "" || from == to {
		return amount, true
	}
	if convert == nil {
		return amount, false
	}

	cacheKey := from + "->" + to
	if rate, found := rateCache[cacheKey]; found {
		if rate > 0 {
			return amount * rate, true
		}
		return amount, false
	}

	result, err := convert(ctx, from, to, 1.0)
	if err != nil {
		log.Debug().
			Err(err).
			Str("from_currency", from).
			Str("to_currency", to).
			Msg("Failed to fetch exchange rate for AI context aggregation")
		rateCache[cacheKey] = 0
		return amount, false
	}

	rate := result.Result
	if rate <= 0 {
		rate = result.Rate
	}
	if rate <= 0 {
		rateCache[cacheKey] = 0
		return amount, false
	}

	rateCache[cacheKey] = rate
	return amount * rate, true
}

func selectPreferredCurrencyFromBalances(
	ctx context.Context,
	balances []model.WalletBalance,
	rateCache map[string]float64,
	convert currencyConverterFunc,
) string {
	if len(balances) == 0 {
		return ""
	}

	maxRawBalance := balances[0].Balance
	preferredRaw := normalizeCurrencyCode(balances[0].Currency)
	for _, b := range balances[1:] {
		if b.Balance > maxRawBalance {
			maxRawBalance = b.Balance
			preferredRaw = normalizeCurrencyCode(b.Currency)
		}
	}

	// Prefer the currency with the highest USD-equivalent value when rates are available.
	bestCurrency := ""
	bestUSDEquivalent := 0.0
	hasConverted := false
	totalCurrencies := 0
	convertibleCurrencies := 0
	for _, b := range balances {
		currency := normalizeCurrencyCode(b.Currency)
		if currency == "" {
			continue
		}
		totalCurrencies++
		converted, ok := convertAmountWithRateCache(ctx, b.Balance, currency, "USD", rateCache, convert)
		if !ok {
			continue
		}
		convertibleCurrencies++
		if !hasConverted || converted > bestUSDEquivalent {
			hasConverted = true
			bestUSDEquivalent = converted
			bestCurrency = currency
		}
	}

	if hasConverted && bestCurrency != "" && convertibleCurrencies == totalCurrencies {
		return bestCurrency
	}
	if preferredRaw != "" {
		return preferredRaw
	}
	return "USD"
}

// daysUntilEndOfMonth calculates days remaining in the current month
func daysUntilEndOfMonth(t time.Time) int {
	firstOfNextMonth := time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, t.Location())
	return int(firstOfNextMonth.Sub(t).Hours() / 24)
}

// getUserMemories retrieves long-term memories about the user
// If memoryService is available, uses semantic search; otherwise falls back to recent memories
func (s *AIChatService) getUserMemories(ctx context.Context, userID uuid.UUID, currentMessage string) ([]model.UserMemory, error) {
	// Try semantic search via memory service first
	if s.memoryService != nil {
		memories, err := s.memoryService.GetUserMemoriesForContext(ctx, userID, currentMessage)
		if err == nil && len(memories) > 0 {
			return memories, nil
		}
		// Fall through to fallback if semantic search fails
	}

	// Fallback to PostgreSQL recent memories
	if s.memoryRepo == nil {
		return nil, nil
	}
	return s.memoryRepo.GetRecent(ctx, userID, 20)
}

// getExchangeRates fetches current exchange rates for common currencies
func (s *AIChatService) getExchangeRates(ctx context.Context, baseCurrency string) map[string]float64 {
	rates := make(map[string]float64)
	if s.exchangeService == nil {
		return rates
	}

	// Get rates for common currencies
	commonCurrencies := []string{"USD", "EUR", "GBP", "IRR", "TRY", "AED", "CAD", "AUD"}
	for _, currency := range commonCurrencies {
		if currency == baseCurrency {
			rates[currency] = 1.0
			continue
		}
		result, err := s.exchangeService.Convert(ctx, baseCurrency, currency, 1.0)
		if err == nil {
			rates[currency] = result.Rate
		}
	}
	return rates
}
