package model

import (
"time"

"github.com/google/uuid"
)

// FinancialArchetype represents a user's financial personality type
type FinancialArchetype string

const (
ArchetypeConsciousSpender FinancialArchetype = "conscious_spender"
ArchetypeSteadySaver      FinancialArchetype = "steady_saver"
ArchetypeImpulsiveBuyer   FinancialArchetype = "impulsive_buyer"
ArchetypePlanfulInvestor  FinancialArchetype = "planful_investor"
ArchetypeBalancedManager  FinancialArchetype = "balanced_manager"
ArchetypeCautousConserver FinancialArchetype = "cautious_conserver"
)

// DNADimension represents a personality dimension score (0-100)
type DNADimension struct {
Name        string  `json:"name"`
Score       float64 `json:"score"`        // 0-100
Label       string  `json:"label"`        // e.g., "Frugal", "Generous"
Description string  `json:"description"`
}

// FinancialDNA represents a user's complete financial personality profile
type FinancialDNA struct {
ID               uuid.UUID          `json:"id"`
UserID           uuid.UUID          `json:"user_id"`
Archetype        FinancialArchetype `json:"archetype"`
ArchetypeLabel   string             `json:"archetype_label"`
ArchetypeEmoji   string             `json:"archetype_emoji"`

// Core dimensions (0-100 scale)
SpendingTemperament float64 `json:"spending_temperament"` // 0=Frugal, 100=Generous
PlanningHorizon     float64 `json:"planning_horizon"`     // 0=Short-term, 100=Long-term
RiskTolerance       float64 `json:"risk_tolerance"`       // 0=Conservative, 100=Aggressive
FinancialStress     float64 `json:"financial_stress"`     // 0=Low, 100=High
ImpulseControl      float64 `json:"impulse_control"`      // 0=Impulsive, 100=Deliberate

Dimensions  []DNADimension `json:"dimensions"`
Strengths   []string       `json:"strengths"`
GrowthAreas []string       `json:"growth_areas"`

// Analysis metadata
TransactionsAnalyzed int       `json:"transactions_analyzed"`
AnalysisPeriodDays   int       `json:"analysis_period_days"`
ConfidenceScore      float64   `json:"confidence_score"` // 0-1
LastUpdated          time.Time `json:"last_updated"`
CreatedAt            time.Time `json:"created_at"`
}

// BehavioralInsight represents a discovered pattern or recommendation
type BehavioralInsight struct {
ID          uuid.UUID `json:"id"`
UserID      uuid.UUID `json:"user_id"`
Type        string    `json:"type"`        // pattern, recommendation, alert
Category    string    `json:"category"`    // spending, timing, emotional, comparative
Title       string    `json:"title"`
Description string    `json:"description"`
Impact      string    `json:"impact"`      // positive, negative, neutral
Severity    string    `json:"severity"`    // low, medium, high
Data        map[string]interface{} `json:"data,omitempty"`
ActionURL   *string   `json:"action_url,omitempty"`
IsRead      bool      `json:"is_read"`
CreatedAt   time.Time `json:"created_at"`
}

// SpendingPattern represents detected spending patterns
type SpendingPattern struct {
PatternType string  `json:"pattern_type"` // weekend_spike, payday_effect, night_owl, etc.
Strength    float64 `json:"strength"`     // 0-1 confidence
Description string  `json:"description"`
Metric      string  `json:"metric"`       // e.g., "2.5x higher on weekends"
}

// PeerComparison represents anonymous peer comparison data
type PeerComparison struct {
Category      string  `json:"category"`
UserValue     float64 `json:"user_value"`
PeerAverage   float64 `json:"peer_average"`
PeerMedian    float64 `json:"peer_median"`
Percentile    int     `json:"percentile"` // User's percentile (1-100)
SampleSize    int     `json:"sample_size"`
TimeframeDays int     `json:"timeframe_days"`
}

// DNAQuizResponse represents a user's quiz answer
type DNAQuizResponse struct {
UserID     uuid.UUID `json:"user_id"`
QuestionID string    `json:"question_id"`
Answer     int       `json:"answer"` // 1-5 scale
CreatedAt  time.Time `json:"created_at"`
}

// DNAQuizQuestion defines an assessment question
type DNAQuizQuestion struct {
ID          string   `json:"id"`
Text        string   `json:"text"`
Category    string   `json:"category"` // spending, saving, risk, planning
Options     []string `json:"options"`
Dimension   string   `json:"dimension"` // Which DNA dimension this affects
}

// FinancialDNASummary is a lightweight version for lists/dashboards
type FinancialDNASummary struct {
Archetype      FinancialArchetype `json:"archetype"`
ArchetypeLabel string             `json:"archetype_label"`
ArchetypeEmoji string             `json:"archetype_emoji"`
TopStrength    string             `json:"top_strength"`
TopGrowthArea  string             `json:"top_growth_area"`
LastUpdated    time.Time          `json:"last_updated"`
}

// GetArchetypeDetails returns display info for an archetype
func GetArchetypeDetails(archetype FinancialArchetype) (label, emoji, description string) {
switch archetype {
case ArchetypeConsciousSpender:
return "Conscious Spender", "🎯", "You spend mindfully and intentionally, balancing enjoyment with financial goals."
case ArchetypeSteadySaver:
return "Steady Saver", "🐢", "You prioritize saving and security, building wealth slowly but surely."
case ArchetypeImpulsiveBuyer:
return "Spontaneous Spender", "⚡", "You enjoy the thrill of purchases and live in the moment."
case ArchetypePlanfulInvestor:
return "Planful Investor", "📈", "You take calculated risks and think long-term about wealth building."
case ArchetypeBalancedManager:
return "Balanced Manager", "⚖️", "You maintain a healthy balance between spending, saving, and investing."
case ArchetypeCautousConserver:
return "Cautious Conserver", "🛡️", "You prioritize security and avoid unnecessary financial risks."
default:
return "Unknown", "❓", "We're still learning about your financial personality."
}
}
