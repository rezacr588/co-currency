package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// FinancialDNAService handles financial personality analysis
type FinancialDNAService struct {
dnaRepo     *repository.FinancialDNARepository
walletRepo  *repository.WalletRepository
}

// NewFinancialDNAService creates a new DNA service
func NewFinancialDNAService(
dnaRepo *repository.FinancialDNARepository,
walletRepo *repository.WalletRepository,
) *FinancialDNAService {
return &FinancialDNAService{
dnaRepo:    dnaRepo,
walletRepo: walletRepo,
}
}

// GetDNA retrieves or calculates the user's financial DNA
func (s *FinancialDNAService) GetDNA(ctx context.Context, userID uuid.UUID) (*model.FinancialDNA, error) {
dna, err := s.dnaRepo.GetDNA(ctx, userID)
if err == nil && dna != nil {
// Check if we need to refresh (older than 7 days)
if time.Since(dna.LastUpdated) < 7*24*time.Hour {
return dna, nil
}
}

// Calculate new DNA
return s.CalculateDNA(ctx, userID)
}

// CalculateDNA analyzes transaction history to determine financial personality
func (s *FinancialDNAService) CalculateDNA(ctx context.Context, userID uuid.UUID) (*model.FinancialDNA, error) {
// Get last 90 days of transactions
endDate := time.Now()
startDate := endDate.AddDate(0, 0, -90)

transactions, err := s.walletRepo.GetTransactionsForPeriod(ctx, userID, startDate, endDate)
if err != nil {
return nil, err
}

if len(transactions) < 10 {
// Not enough data for meaningful analysis
return s.getDefaultDNA(userID, len(transactions)), nil
}

// Calculate behavioral metrics
metrics := s.calculateMetrics(transactions)

// Determine archetype based on metrics
archetype := s.determineArchetype(metrics)

// Generate strengths and growth areas
strengths, growthAreas := s.analyzeStrengthsAndGrowth(metrics)

// Build dimension details
dimensions := s.buildDimensions(metrics)

dna := &model.FinancialDNA{
UserID:               userID,
Archetype:            archetype,
SpendingTemperament:  metrics["spending_temperament"],
PlanningHorizon:      metrics["planning_horizon"],
RiskTolerance:        metrics["risk_tolerance"],
FinancialStress:      metrics["financial_stress"],
ImpulseControl:       metrics["impulse_control"],
Dimensions:           dimensions,
Strengths:            strengths,
GrowthAreas:          growthAreas,
TransactionsAnalyzed: len(transactions),
AnalysisPeriodDays:   90,
ConfidenceScore:      s.calculateConfidence(len(transactions)),
LastUpdated:          time.Now(),
}

dna.ArchetypeLabel, dna.ArchetypeEmoji, _ = model.GetArchetypeDetails(archetype)

// Save to database
if err := s.dnaRepo.UpsertDNA(ctx, dna); err != nil {
return nil, err
}

return dna, nil
}

func (s *FinancialDNAService) calculateMetrics(transactions []model.Transaction) map[string]float64 {
metrics := make(map[string]float64)

if len(transactions) == 0 {
return metrics
}

var totalSpend, totalIncome float64
var weekendSpend, weekdaySpend float64
var weekendCount, weekdayCount int
var sameDayPurchases int
categorySpend := make(map[string]float64)
dailyTotals := make(map[string]float64)

for _, tx := range transactions {
amount := tx.Amount
date := tx.CreatedAt.Format("2006-01-02")
dayOfWeek := tx.CreatedAt.Weekday()

if tx.Type == "debit" {
totalSpend += amount

if dayOfWeek == time.Saturday || dayOfWeek == time.Sunday {
weekendSpend += amount
weekendCount++
			} else {
				weekdaySpend += amount
				weekdayCount++
			}

			if tx.Category != "" {
				categorySpend[tx.Category] += amount
			}

			// Track daily spending for impulse detection
			if prev, exists := dailyTotals[date]; exists && prev > 0 {
				sameDayPurchases++
			}
			dailyTotals[date] += amount
		} else if tx.Type == "credit" {
			totalIncome += amount
}
}

// Spending Temperament (0=Frugal, 100=Generous)
savingsRate := 0.0
if totalIncome > 0 {
savingsRate = (totalIncome - totalSpend) / totalIncome
}
metrics["spending_temperament"] = clamp((1-savingsRate)*100, 0, 100)

// Planning Horizon (based on category diversity and consistency)
categoryCount := len(categorySpend)
diversityScore := math.Min(float64(categoryCount)/10*100, 100)
metrics["planning_horizon"] = diversityScore

// Risk Tolerance (based on spending variance)
variance := s.calculateSpendingVariance(dailyTotals)
metrics["risk_tolerance"] = clamp(variance/100*50, 0, 100)

// Financial Stress (based on spending to income ratio)
stressRatio := 0.0
if totalIncome > 0 {
stressRatio = totalSpend / totalIncome
}
metrics["financial_stress"] = clamp(stressRatio*100, 0, 100)

// Impulse Control (inverse of same-day multiple purchases)
impulseRatio := 0.0
if len(transactions) > 0 {
impulseRatio = 1 - (float64(sameDayPurchases) / float64(len(transactions)))
}
metrics["impulse_control"] = clamp(impulseRatio*100, 0, 100)

// Weekend premium
avgWeekend := 0.0
avgWeekday := 0.0
if weekendCount > 0 {
avgWeekend = weekendSpend / float64(weekendCount)
}
if weekdayCount > 0 {
avgWeekday = weekdaySpend / float64(weekdayCount)
}
if avgWeekday > 0 {
metrics["weekend_premium"] = avgWeekend / avgWeekday
} else {
metrics["weekend_premium"] = 1.0
}

return metrics
}

func (s *FinancialDNAService) calculateSpendingVariance(dailyTotals map[string]float64) float64 {
if len(dailyTotals) == 0 {
return 0
}

var values []float64
for _, v := range dailyTotals {
values = append(values, v)
}

// Calculate mean
var sum float64
for _, v := range values {
sum += v
}
mean := sum / float64(len(values))

// Calculate variance
var variance float64
for _, v := range values {
variance += (v - mean) * (v - mean)
}
variance /= float64(len(values))

return math.Sqrt(variance)
}

func (s *FinancialDNAService) determineArchetype(metrics map[string]float64) model.FinancialArchetype {
spending := metrics["spending_temperament"]
impulse := metrics["impulse_control"]
planning := metrics["planning_horizon"]
risk := metrics["risk_tolerance"]

// High impulse control + high planning = Planful Investor or Steady Saver
if impulse > 70 && planning > 60 {
if risk > 50 {
return model.ArchetypePlanfulInvestor
}
return model.ArchetypeSteadySaver
}

// Low impulse control + high spending = Impulsive Buyer
if impulse < 40 && spending > 60 {
return model.ArchetypeImpulsiveBuyer
}

// Low spending + low risk = Cautious Conserver
if spending < 40 && risk < 40 {
return model.ArchetypeCautousConserver
}

// Moderate spending + high impulse = Conscious Spender
if spending >= 40 && spending <= 70 && impulse > 50 {
return model.ArchetypeConsciousSpender
}

// Default to Balanced Manager
return model.ArchetypeBalancedManager
}

func (s *FinancialDNAService) analyzeStrengthsAndGrowth(metrics map[string]float64) ([]string, []string) {
var strengths, growthAreas []string

// Spending control
if metrics["spending_temperament"] < 50 {
strengths = append(strengths, "Strong spending discipline")
} else if metrics["spending_temperament"] > 75 {
growthAreas = append(growthAreas, "Consider tracking discretionary spending")
}

// Impulse control
if metrics["impulse_control"] > 70 {
strengths = append(strengths, "Excellent impulse control")
} else if metrics["impulse_control"] < 40 {
growthAreas = append(growthAreas, "Practice waiting 24 hours before purchases")
}

// Planning
if metrics["planning_horizon"] > 60 {
strengths = append(strengths, "Good financial planning habits")
} else {
growthAreas = append(growthAreas, "Create a monthly budget plan")
}

// Financial stress
if metrics["financial_stress"] < 50 {
strengths = append(strengths, "Healthy income-to-expense ratio")
} else if metrics["financial_stress"] > 80 {
growthAreas = append(growthAreas, "Focus on reducing expenses or increasing income")
}

// Weekend spending
if premium, ok := metrics["weekend_premium"]; ok && premium > 2.0 {
growthAreas = append(growthAreas, "Weekend spending is significantly higher than weekdays")
}

// Ensure we have at least one of each
if len(strengths) == 0 {
strengths = append(strengths, "Working toward financial balance")
}
if len(growthAreas) == 0 {
growthAreas = append(growthAreas, "Continue your great financial habits")
}

return strengths[:min(3, len(strengths))], growthAreas[:min(3, len(growthAreas))]
}

func (s *FinancialDNAService) buildDimensions(metrics map[string]float64) []model.DNADimension {
return []model.DNADimension{
{
Name:        "Spending Temperament",
Score:       metrics["spending_temperament"],
Label:       getDimensionLabel(metrics["spending_temperament"], "Frugal", "Generous"),
Description: "How freely you spend money",
},
{
Name:        "Planning Horizon",
Score:       metrics["planning_horizon"],
Label:       getDimensionLabel(metrics["planning_horizon"], "Day-to-Day", "Long-term"),
Description: "How far ahead you plan financially",
},
{
Name:        "Risk Tolerance",
Score:       metrics["risk_tolerance"],
Label:       getDimensionLabel(metrics["risk_tolerance"], "Conservative", "Adventurous"),
Description: "Your comfort with financial uncertainty",
},
{
Name:        "Financial Stress",
Score:       metrics["financial_stress"],
Label:       getDimensionLabel(metrics["financial_stress"], "Relaxed", "Pressured"),
Description: "Your expense-to-income pressure",
},
{
Name:        "Impulse Control",
Score:       metrics["impulse_control"],
Label:       getDimensionLabel(metrics["impulse_control"], "Spontaneous", "Deliberate"),
Description: "How methodically you make purchases",
},
}
}

func getDimensionLabel(score float64, lowLabel, highLabel string) string {
if score < 33 {
return lowLabel
} else if score > 66 {
return highLabel
}
return "Balanced"
}

func (s *FinancialDNAService) getDefaultDNA(userID uuid.UUID, txCount int) *model.FinancialDNA {
label, emoji, _ := model.GetArchetypeDetails(model.ArchetypeBalancedManager)
return &model.FinancialDNA{
UserID:               userID,
Archetype:            model.ArchetypeBalancedManager,
ArchetypeLabel:       label,
ArchetypeEmoji:       emoji,
SpendingTemperament:  50,
PlanningHorizon:      50,
RiskTolerance:        50,
FinancialStress:      50,
ImpulseControl:       50,
TransactionsAnalyzed: txCount,
AnalysisPeriodDays:   90,
ConfidenceScore:      0.1,
LastUpdated:          time.Now(),
Strengths:            []string{"Getting started with financial tracking"},
GrowthAreas:          []string{"Add more transactions for personalized insights"},
}
}

func (s *FinancialDNAService) calculateConfidence(txCount int) float64 {
// Confidence increases with more data
if txCount < 10 {
return 0.1
} else if txCount < 50 {
return 0.4
} else if txCount < 100 {
return 0.7
}
return 0.9
}

// GetInsights retrieves behavioral insights for a user
func (s *FinancialDNAService) GetInsights(ctx context.Context, userID uuid.UUID, limit int) ([]model.BehavioralInsight, error) {
return s.dnaRepo.GetInsights(ctx, userID, limit)
}

// MarkInsightRead marks an insight as read
func (s *FinancialDNAService) MarkInsightRead(ctx context.Context, userID, insightID uuid.UUID) error {
return s.dnaRepo.MarkInsightRead(ctx, userID, insightID)
}

// GetUnreadInsightCount returns count of unread insights
func (s *FinancialDNAService) GetUnreadInsightCount(ctx context.Context, userID uuid.UUID) (int, error) {
return s.dnaRepo.GetUnreadInsightCount(ctx, userID)
}

// GenerateInsights analyzes recent activity and creates new insights
func (s *FinancialDNAService) GenerateInsights(ctx context.Context, userID uuid.UUID) error {
// Get recent transactions
endDate := time.Now()
startDate := endDate.AddDate(0, 0, -30)

transactions, err := s.walletRepo.GetTransactionsForPeriod(ctx, userID, startDate, endDate)
if err != nil {
return err
}

if len(transactions) < 5 {
return nil
}

// Analyze patterns and create insights
patterns := s.detectPatterns(transactions)

for _, pattern := range patterns {
insight := &model.BehavioralInsight{
UserID:      userID,
Type:        "pattern",
Category:    pattern.PatternType,
Title:       pattern.Description,
Description: pattern.Metric,
Impact:      "neutral",
Severity:    s.getSeverityFromStrength(pattern.Strength),
}

if err := s.dnaRepo.CreateInsight(ctx, insight); err != nil {
continue // Don't fail on individual insight creation
}
}

return nil
}

func (s *FinancialDNAService) detectPatterns(transactions []model.Transaction) []model.SpendingPattern {
var patterns []model.SpendingPattern

// Weekend spending pattern
var weekendSpend, weekdaySpend float64
var weekendCount, weekdayCount int

for _, tx := range transactions {
if tx.Type != "debit" {
continue
}

if tx.CreatedAt.Weekday() == time.Saturday || tx.CreatedAt.Weekday() == time.Sunday {
weekendSpend += tx.Amount
weekendCount++
} else {
weekdaySpend += tx.Amount
weekdayCount++
}
}

if weekdayCount > 0 && weekendCount > 0 {
avgWeekend := weekendSpend / float64(weekendCount)
avgWeekday := weekdaySpend / float64(weekdayCount)

if avgWeekday > 0 {
ratio := avgWeekend / avgWeekday
if ratio > 1.5 {
patterns = append(patterns, model.SpendingPattern{
PatternType: "weekend_spike",
Strength:    math.Min(ratio/3, 1.0),
Description: "Weekend Spending Pattern",
Metric:      fmt.Sprintf("You spend %.1fx more on weekends than weekdays", ratio),
})
}
}
}

return patterns
}

func (s *FinancialDNAService) getSeverityFromStrength(strength float64) string {
if strength > 0.7 {
return "high"
} else if strength > 0.4 {
return "medium"
}
return "low"
}

// Helper functions
func clamp(value, min, max float64) float64 {
if value < min {
return min
}
if value > max {
return max
}
return value
}

func min(a, b int) int {
if a < b {
return a
}
return b
}
