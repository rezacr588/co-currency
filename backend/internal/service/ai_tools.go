package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// ToolCall represents a parsed tool call from LLM output
type ToolCall struct {
	Name   string                 `json:"name"`
	Params map[string]interface{} `json:"params"`
}

// AIToolExecutor handles executing tool calls against the database
type AIToolExecutor struct {
	walletRepo       *repository.WalletRepository
	categoryRepo     *repository.CategoryRepository
	reportsService   *ReportsService
	subscriptionRepo *repository.SubscriptionRepository
	noteRepo         *repository.NoteRepository
	loanRepo         *repository.LoanRepository
	budgetRepo       *repository.BudgetRepository
	wealthService    *WealthService
	tavilyAPIKey     string
}

// NewAIToolExecutor creates a new tool executor
func NewAIToolExecutor(
	walletRepo *repository.WalletRepository,
	categoryRepo *repository.CategoryRepository,
	reportsService *ReportsService,
	subscriptionRepo *repository.SubscriptionRepository,
	noteRepo *repository.NoteRepository,
	loanRepo *repository.LoanRepository,
	budgetRepo *repository.BudgetRepository,
	tavilyAPIKey string,
) *AIToolExecutor {
	return &AIToolExecutor{
		walletRepo:       walletRepo,
		categoryRepo:     categoryRepo,
		reportsService:   reportsService,
		subscriptionRepo: subscriptionRepo,
		noteRepo:         noteRepo,
		loanRepo:         loanRepo,
		budgetRepo:       budgetRepo,
		tavilyAPIKey:     tavilyAPIKey,
	}
}

// parseToolCall extracts a tool call from LLM output
func parseToolCall(response string) *ToolCall {
	startTag := "<tool_call>"
	endTag := "</tool_call>"

	startIdx := strings.Index(response, startTag)
	if startIdx == -1 {
		return nil
	}
	endOffset := strings.Index(response[startIdx:], endTag)
	if endOffset == -1 {
		return nil
	}
	endIdx := startIdx + endOffset

	jsonStr := strings.TrimSpace(response[startIdx+len(startTag) : endIdx])
	var tc ToolCall
	if err := json.Unmarshal([]byte(jsonStr), &tc); err != nil {
		log.Warn().Err(err).Str("json", jsonStr).Msg("Failed to parse tool call JSON")
		return nil
	}
	return &tc
}

// stripToolCallMarkers removes any <tool_call>...</tool_call> from a response
func stripToolCallMarkers(response string) string {
	for {
		startIdx := strings.Index(response, "<tool_call>")
		if startIdx == -1 {
			break
		}
		endOffset := strings.Index(response[startIdx:], "</tool_call>")
		if endOffset == -1 {
			// Malformed — strip from start tag to end
			response = response[:startIdx]
			break
		}
		endIdx := startIdx + endOffset
		response = response[:startIdx] + response[endIdx+len("</tool_call>"):]
	}
	return strings.TrimSpace(response)
}

// Execute routes a tool call to the appropriate handler
func (e *AIToolExecutor) Execute(ctx context.Context, userID uuid.UUID, currency string, tc *ToolCall) (string, error) {
	switch tc.Name {
	case "search_transactions":
		return e.executeSearchTransactions(ctx, userID, tc.Params)
	case "get_monthly_report":
		return e.executeGetMonthlyReport(ctx, userID, currency, tc.Params)
	case "get_category_report":
		return e.executeGetCategoryReport(ctx, userID, currency, tc.Params)
	case "get_spending_trends":
		return e.executeGetSpendingTrends(ctx, userID, currency, tc.Params)
	case "get_financial_forecast":
		return e.executeGetFinancialForecast(ctx, userID, currency, tc.Params)
	case "get_health_score":
		return e.executeGetHealthScore(ctx, userID, currency, tc.Params)
	case "get_subscriptions":
		return e.executeGetSubscriptions(ctx, userID, currency, tc.Params)
	case "search_notes":
		return e.executeSearchNotes(ctx, userID, tc.Params)
	case "web_search":
		return e.executeWebSearch(ctx, tc.Params)
	case "get_wealth_overview":
		return e.executeGetWealthOverview(ctx, userID, currency, tc.Params)
	case "get_what_if_analysis":
		return e.executeGetWhatIfAnalysis(ctx, userID, currency, tc.Params)
	default:
		return "", fmt.Errorf("unknown tool: %s", tc.Name)
	}
}

// --- Tool implementations ---

func (e *AIToolExecutor) executeSearchTransactions(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.walletRepo == nil {
		return "Transaction data is not available.", nil
	}

	filter := &model.TransactionFilter{
		Category: getStringParam(params, "category"),
		Type:     getStringParam(params, "type"),
		Currency: getStringParam(params, "currency"),
		Search:   getStringParam(params, "search"),
		FromDate: getStringParam(params, "from_date"),
		ToDate:   getStringParam(params, "to_date"),
	}

	limit := getIntParam(params, "limit", 50)
	if limit > 200 {
		limit = 200
	}

	transactions, total, err := e.walletRepo.GetTransactionsFiltered(ctx, userID, filter, limit, 0)
	if err != nil {
		return "", fmt.Errorf("searching transactions: %w", err)
	}

	if len(transactions) == 0 {
		return "No transactions found matching the criteria.", nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d transactions (showing %d):\n", total, len(transactions)))
	for _, tx := range transactions {
		sign := "+"
		if tx.Type == "debit" {
			sign = "-"
		}
		sb.WriteString(fmt.Sprintf("- %s: %s%.2f %s", tx.CreatedAt.Format("2006-01-02"), sign, tx.Amount, tx.Currency))
		if tx.Category != "" {
			sb.WriteString(fmt.Sprintf(" [%s]", tx.Category))
		}
		if tx.Description != "" {
			sb.WriteString(fmt.Sprintf(" — %s", tx.Description))
		}
		sb.WriteString("\n")
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetMonthlyReport(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.reportsService == nil {
		return "Reports service is not available.", nil
	}

	now := time.Now()
	year := getIntParam(params, "year", now.Year())
	month := getIntParam(params, "month", int(now.Month()))
	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	report, err := e.reportsService.GetMonthlyReport(ctx, userID, year, month, currency)
	if err != nil {
		return "", fmt.Errorf("getting monthly report: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Monthly Report — %s %d (%s):\n", time.Month(month).String(), year, currency))
	sb.WriteString(fmt.Sprintf("- Income: %.2f\n", report.Income))
	sb.WriteString(fmt.Sprintf("- Expenses: %.2f\n", report.Expenses))
	sb.WriteString(fmt.Sprintf("- Net: %.2f\n", report.Net))
	sb.WriteString(fmt.Sprintf("- Savings rate: %.1f%%\n", report.Savings))
	if len(report.Categories) > 0 {
		sb.WriteString("Category breakdown:\n")
		for _, cat := range report.Categories {
			sb.WriteString(fmt.Sprintf("  - %s: %.2f (%.1f%%, %d txns)\n", cat.Category, cat.Amount, cat.Percentage, cat.Count))
		}
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetCategoryReport(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.reportsService == nil {
		return "Reports service is not available.", nil
	}

	fromDate := getStringParam(params, "from_date")
	toDate := getStringParam(params, "to_date")
	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	// Default to last 30 days if no dates specified
	if fromDate == "" {
		fromDate = time.Now().AddDate(0, 0, -30).Format("2006-01-02")
	}
	if toDate == "" {
		toDate = time.Now().Format("2006-01-02")
	}

	report, err := e.reportsService.GetCategoryReport(ctx, userID, fromDate, toDate, currency)
	if err != nil {
		return "", fmt.Errorf("getting category report: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Category Report (%s to %s, %s):\n", report.FromDate, report.ToDate, currency))
	sb.WriteString(fmt.Sprintf("- Total spending: %.2f\n", report.Total))
	if len(report.Categories) > 0 {
		for _, cat := range report.Categories {
			sb.WriteString(fmt.Sprintf("  - %s: %.2f (%.1f%%, %d txns)\n", cat.Category, cat.Amount, cat.Percentage, cat.Count))
		}
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetSpendingTrends(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.reportsService == nil {
		return "Reports service is not available.", nil
	}

	months := getIntParam(params, "months", 6)
	if months > 12 {
		months = 12
	}
	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	report, err := e.reportsService.GetTrendsReport(ctx, userID, months, currency)
	if err != nil {
		return "", fmt.Errorf("getting spending trends: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Spending Trends — last %d months (%s):\n", months, currency))
	for _, t := range report.Trends {
		sb.WriteString(fmt.Sprintf("- %s: income=%.2f, expenses=%.2f, net=%.2f\n", t.Period, t.Income, t.Expenses, t.Net))
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetFinancialForecast(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.reportsService == nil {
		return "Reports service is not available.", nil
	}

	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	report, err := e.reportsService.GetForecast(ctx, userID, currency)
	if err != nil {
		return "", fmt.Errorf("getting forecast: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Financial Forecast (%s):\n", currency))
	sb.WriteString(fmt.Sprintf("- Current balance: %.2f\n", report.CurrentBalance))
	sb.WriteString(fmt.Sprintf("- Avg daily spend: %.2f\n", report.AvgDailySpend))
	sb.WriteString(fmt.Sprintf("- Avg daily income: %.2f\n", report.AvgDailyIncome))
	sb.WriteString(fmt.Sprintf("- Net daily flow: %.2f\n", report.NetDailyFlow))
	if report.DaysUntilZero > 0 {
		sb.WriteString(fmt.Sprintf("- Days until zero: %d\n", report.DaysUntilZero))
		if report.EstimatedZeroDate != nil {
			sb.WriteString(fmt.Sprintf("- Estimated zero date: %s\n", report.EstimatedZeroDate.Format("2006-01-02")))
		}
	} else {
		sb.WriteString("- Net flow is positive — balance is growing\n")
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetHealthScore(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.reportsService == nil {
		return "Reports service is not available.", nil
	}

	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	report, err := e.reportsService.GetHealthScore(ctx, userID, currency)
	if err != nil {
		return "", fmt.Errorf("getting health score: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Financial Health Score: %d/100 (trend: %s)\n", report.Score, report.Trend))
	sb.WriteString("Components:\n")
	sb.WriteString(fmt.Sprintf("  - Budget adherence: %.0f/100\n", report.Components.BudgetAdherence))
	sb.WriteString(fmt.Sprintf("  - Savings rate: %.0f/100\n", report.Components.SavingsRate))
	sb.WriteString(fmt.Sprintf("  - Goal progress: %.0f/100\n", report.Components.GoalProgress))
	sb.WriteString(fmt.Sprintf("  - Consistency: %.0f/100\n", report.Components.Consistency))
	sb.WriteString(fmt.Sprintf("  - Bill timing: %.0f/100\n", report.Components.BillTiming))
	if len(report.Tips) > 0 {
		sb.WriteString("Tips:\n")
		for _, tip := range report.Tips {
			sb.WriteString(fmt.Sprintf("  - %s\n", tip))
		}
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetSubscriptions(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.subscriptionRepo == nil {
		return "Subscription data is not available.", nil
	}

	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	subs, err := e.subscriptionRepo.GetSubscriptions(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("getting subscriptions: %w", err)
	}

	if len(subs) == 0 {
		return "No subscriptions found.", nil
	}

	// Get summary too
	summary, _ := e.subscriptionRepo.GetSubscriptionSummary(ctx, userID, currency)

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Subscriptions (%d total):\n", len(subs)))
	for _, sub := range subs {
		sb.WriteString(fmt.Sprintf("- %s: %.2f %s (%s, %s) — next: %s\n",
			sub.Name, sub.Amount, sub.Currency, sub.BillingCycle, sub.Status,
			sub.NextBillingDate.Format("2006-01-02")))
	}
	if summary != nil {
		sb.WriteString(fmt.Sprintf("\nTotal monthly cost: %.2f %s\n", summary.TotalMonthly, currency))
		sb.WriteString(fmt.Sprintf("Total yearly cost: %.2f %s\n", summary.TotalYearly, currency))
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeSearchNotes(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.noteRepo == nil {
		return "Notes are not available.", nil
	}

	query := getStringParam(params, "query")
	if query == "" {
		return "No search query provided.", nil
	}

	notes, err := e.noteRepo.Search(ctx, userID, query)
	if err != nil {
		return "", fmt.Errorf("searching notes: %w", err)
	}

	if len(notes) == 0 {
		return fmt.Sprintf("No notes found matching '%s'.", query), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d notes matching '%s':\n", len(notes), query))
	for _, note := range notes {
		sb.WriteString(fmt.Sprintf("- [%s] %s", note.CreatedAt.Format("2006-01-02"), note.Title))
		// Include a snippet of content (first 100 chars)
		content := strings.TrimSpace(note.Content)
		if len(content) > 100 {
			content = content[:100] + "..."
		}
		if content != "" {
			sb.WriteString(fmt.Sprintf(": %s", content))
		}
		sb.WriteString("\n")
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeWebSearch(ctx context.Context, params map[string]interface{}) (string, error) {
	if e.tavilyAPIKey == "" {
		return "Web search is not configured. Please set TAVILY_API_KEY.", nil
	}

	query := getStringParam(params, "query")
	if query == "" {
		return "No search query provided.", nil
	}

	// Build Tavily search request
	reqBody := map[string]interface{}{
		"api_key":             e.tavilyAPIKey,
		"query":               query,
		"search_depth":        "basic",
		"max_results":         5,
		"include_answer":      true,
		"include_raw_content": false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshaling search request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.tavily.com/search", bytes.NewReader(jsonData))
	if err != nil {
		return "", fmt.Errorf("creating search request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("search request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("search API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Answer  string `json:"answer"`
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("parsing search response: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Web search results for '%s':\n\n", query))

	if result.Answer != "" {
		sb.WriteString(fmt.Sprintf("Summary: %s\n\n", result.Answer))
	}

	for i, r := range result.Results {
		content := r.Content
		if len(content) > 300 {
			content = content[:300] + "..."
		}
		sb.WriteString(fmt.Sprintf("%d. **%s**\n   %s\n   Source: %s\n\n", i+1, r.Title, content, r.URL))
	}

	if len(result.Results) == 0 && result.Answer == "" {
		sb.WriteString("No results found.\n")
	}

	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetWealthOverview(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.wealthService == nil {
		return "Wealth analysis is not available.", nil
	}

	currency := getStringParam(params, "currency")
	if currency == "" {
		currency = defaultCurrency
	}

	overview, err := e.wealthService.GetOverview(ctx, userID, currency)
	if err != nil {
		return "", fmt.Errorf("getting wealth overview: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Wealth Overview (%s):\n", currency))
	sb.WriteString(fmt.Sprintf("- Nominal Total: %.2f\n", overview.NominalTotal))
	sb.WriteString(fmt.Sprintf("- Real Total (inflation-adjusted): %.2f\n", overview.RealTotal))
	sb.WriteString(fmt.Sprintf("- Monthly Erosion: %.2f (%.2f%%)\n", overview.ErosionAmount, overview.ErosionRate))
	sb.WriteString(fmt.Sprintf("- Wealth Shield Score: %d/100 (%s)\n", overview.ShieldScore, overview.ShieldLabel))
	if len(overview.CurrencyBreakdown) > 0 {
		sb.WriteString("\nPer-currency breakdown:\n")
		for _, e := range overview.CurrencyBreakdown {
			sb.WriteString(fmt.Sprintf("  - %s: nominal=%.2f, real=%.2f, inflation=%.1f%%, share=%.1f%%\n",
				e.Currency, e.NominalBalance, e.RealBalance, e.AnnualInflation, e.SharePercentage))
		}
	}
	return sb.String(), nil
}

func (e *AIToolExecutor) executeGetWhatIfAnalysis(ctx context.Context, userID uuid.UUID, defaultCurrency string, params map[string]interface{}) (string, error) {
	if e.wealthService == nil {
		return "What-if analysis is not available.", nil
	}

	fromCurrency := getStringParam(params, "from_currency")
	toCurrency := getStringParam(params, "to_currency")
	if fromCurrency == "" || toCurrency == "" {
		return "Both from_currency and to_currency are required.", nil
	}

	amount := float64(getIntParam(params, "amount", 1000))
	monthsAgo := getIntParam(params, "months_ago", 3)

	result, err := e.wealthService.GetWhatIf(ctx, userID, fromCurrency, toCurrency, amount, monthsAgo)
	if err != nil {
		return "", fmt.Errorf("running what-if analysis: %w", err)
	}

	return result.Explanation, nil
}

// --- Param helpers ---

func getStringParam(params map[string]interface{}, key string) string {
	v, ok := params[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return fmt.Sprintf("%v", v)
	}
	return s
}

func getIntParam(params map[string]interface{}, key string, defaultVal int) int {
	v, ok := params[key]
	if !ok {
		return defaultVal
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case string:
		var i int
		if _, err := fmt.Sscanf(n, "%d", &i); err == nil {
			return i
		}
	}
	return defaultVal
}

// buildToolDefinitionsPrompt generates the TOOLS section for the system prompt
func buildToolDefinitionsPrompt() string {
	return `## DYNAMIC DATA TOOLS

You have access to tools that let you query the user's financial data dynamically. Use them when the static context above isn't enough to answer a question — for example, when the user asks about a specific date range, a specific category, or data not in the recent snapshot.

### Available Tools

1. **search_transactions** — Search and filter transactions
   Params: category (string), type ("credit"/"debit"), currency (string), search (keyword), from_date (YYYY-MM-DD), to_date (YYYY-MM-DD), limit (int, max 200)

2. **get_monthly_report** — Get monthly income/expenses/savings with category breakdown
   Params: year (int), month (int, 1-12), currency (string)

3. **get_category_report** — Get spending by category for a date range
   Params: from_date (YYYY-MM-DD), to_date (YYYY-MM-DD), currency (string)

4. **get_spending_trends** — Get income/expense trends over N months
   Params: months (int, max 12), currency (string)

5. **get_financial_forecast** — Get 30-day cash flow projection
   Params: currency (string)

6. **get_health_score** — Get financial health score (0-100) with breakdown
   Params: currency (string)

7. **get_subscriptions** — Get active subscriptions and costs
   Params: currency (string)

8. **search_notes** — Full-text search on user's notes
   Params: query (string)

9. **web_search** — Search the internet for current information (news, exchange rates, financial tips, etc.)
   Params: query (string, required)

10. **get_wealth_overview** — Get real (inflation-adjusted) balances and Wealth Shield Score
    Params: currency (string)

11. **get_what_if_analysis** — Analyze what would have happened with a hypothetical currency conversion
    Params: from_currency (string), to_currency (string), amount (number), months_ago (int)

### How to Call a Tool

Output ONLY the following marker when you need to call a tool (nothing else in your response):

<tool_call>{"name": "tool_name", "params": {"key": "value"}}</tool_call>

### Rules
- Use tools ONLY when the static context above doesn't have the information needed
- Call ONE tool per turn — you'll get the results back and can then respond or call another tool
- When calling a tool, output ONLY the <tool_call> marker — no other text
- For simple greetings or questions answerable from the static context, respond normally without tools
- Use the correct category names from the AVAILABLE CATEGORIES list when filtering

### Examples

User: "How much did I spend on food in the last 3 months?"
<tool_call>{"name": "search_transactions", "params": {"category": "Food & Dining", "type": "debit", "from_date": "2025-11-01", "to_date": "2026-02-01"}}</tool_call>

User: "Show my spending trends"
<tool_call>{"name": "get_spending_trends", "params": {"months": 6}}</tool_call>

User: "What's my financial health?"
<tool_call>{"name": "get_health_score", "params": {}}</tool_call>

User: "What's the latest EUR to USD exchange rate?"
<tool_call>{"name": "web_search", "params": {"query": "EUR to USD exchange rate today"}}</tool_call>
`
}
