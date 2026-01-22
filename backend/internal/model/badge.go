package model

import (
	"time"

	"github.com/google/uuid"
)

// Badge represents a system achievement badge
type Badge struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	Icon             string    `json:"icon"`
	Category         string    `json:"category"` // milestone, savings, streak, budgeting, special
	RequirementType  string    `json:"requirement_type"`
	RequirementValue float64   `json:"requirement_value,omitempty"`
	Rarity           string    `json:"rarity"` // common, rare, epic, legendary
	CreatedAt        time.Time `json:"created_at"`
}

// UserBadge represents a badge earned by a user
type UserBadge struct {
	ID       uuid.UUID `json:"id"`
	UserID   uuid.UUID `json:"user_id"`
	BadgeID  uuid.UUID `json:"badge_id"`
	Badge    *Badge    `json:"badge,omitempty"`
	EarnedAt time.Time `json:"earned_at"`
}

// BadgeProgress represents progress toward earning a badge
type BadgeProgress struct {
	Badge           Badge      `json:"badge"`
	CurrentValue    float64    `json:"current_value"`
	RequiredValue   float64    `json:"required_value"`
	ProgressPercent float64    `json:"progress_percent"`
	IsEarned        bool       `json:"is_earned"`
	EarnedAt        *time.Time `json:"earned_at,omitempty"`
}

// BadgeCheckResult represents the result of checking badges
type BadgeCheckResult struct {
	NewlyEarned []UserBadge `json:"newly_earned"`
	TotalEarned int         `json:"total_earned"`
}

// Badge requirement types
const (
	BadgeReqTransactionCount  = "transaction_count"
	BadgeReqBudgetCount       = "budget_count"
	BadgeReqGoalCount         = "goal_count"
	BadgeReqTotalSaved        = "total_saved"
	BadgeReqStreakDays        = "streak_days"
	BadgeReqMonthsUnderBudget = "months_under_budget"
	BadgeReqCurrencyCount     = "currency_count"
	BadgeReqSubscriptionCount = "subscription_count"
	BadgeReqAIUsage           = "ai_usage"
	BadgeReqSpecial           = "special"
)

// Badge categories
var BadgeCategories = []string{"milestone", "savings", "streak", "budgeting", "special"}

// Badge rarities
var BadgeRarities = []string{"common", "rare", "epic", "legendary"}

// DefaultBadges are the pre-seeded system badges
var DefaultBadges = []Badge{
	// Milestone badges
	{
		Name:             "First Steps",
		Description:      "Add your first transaction",
		Icon:             "🎯",
		Category:         "milestone",
		RequirementType:  BadgeReqTransactionCount,
		RequirementValue: 1,
		Rarity:           "common",
	},
	{
		Name:             "Getting Started",
		Description:      "Add 10 transactions",
		Icon:             "📝",
		Category:         "milestone",
		RequirementType:  BadgeReqTransactionCount,
		RequirementValue: 10,
		Rarity:           "common",
	},
	{
		Name:             "Transaction Pro",
		Description:      "Add 100 transactions",
		Icon:             "💼",
		Category:         "milestone",
		RequirementType:  BadgeReqTransactionCount,
		RequirementValue: 100,
		Rarity:           "rare",
	},
	{
		Name:             "Budget Beginner",
		Description:      "Create your first budget",
		Icon:             "📊",
		Category:         "budgeting",
		RequirementType:  BadgeReqBudgetCount,
		RequirementValue: 1,
		Rarity:           "common",
	},
	{
		Name:             "Goal Setter",
		Description:      "Set your first savings goal",
		Icon:             "🎯",
		Category:         "milestone",
		RequirementType:  BadgeReqGoalCount,
		RequirementValue: 1,
		Rarity:           "common",
	},

	// Savings badges
	{
		Name:             "Century Saver",
		Description:      "Save $100 total",
		Icon:             "💯",
		Category:         "savings",
		RequirementType:  BadgeReqTotalSaved,
		RequirementValue: 100,
		Rarity:           "common",
	},
	{
		Name:             "Grand Saver",
		Description:      "Save $1,000 total",
		Icon:             "💰",
		Category:         "savings",
		RequirementType:  BadgeReqTotalSaved,
		RequirementValue: 1000,
		Rarity:           "rare",
	},
	{
		Name:             "Five Figure Club",
		Description:      "Save $10,000 total",
		Icon:             "🏆",
		Category:         "savings",
		RequirementType:  BadgeReqTotalSaved,
		RequirementValue: 10000,
		Rarity:           "epic",
	},
	{
		Name:             "Wealth Builder",
		Description:      "Save $100,000 total",
		Icon:             "👑",
		Category:         "savings",
		RequirementType:  BadgeReqTotalSaved,
		RequirementValue: 100000,
		Rarity:           "legendary",
	},

	// Streak badges
	{
		Name:             "Week Warrior",
		Description:      "7-day tracking streak",
		Icon:             "🔥",
		Category:         "streak",
		RequirementType:  BadgeReqStreakDays,
		RequirementValue: 7,
		Rarity:           "common",
	},
	{
		Name:             "Month Master",
		Description:      "30-day tracking streak",
		Icon:             "⚡",
		Category:         "streak",
		RequirementType:  BadgeReqStreakDays,
		RequirementValue: 30,
		Rarity:           "rare",
	},
	{
		Name:             "Quarterly Champion",
		Description:      "90-day tracking streak",
		Icon:             "🌟",
		Category:         "streak",
		RequirementType:  BadgeReqStreakDays,
		RequirementValue: 90,
		Rarity:           "epic",
	},

	// Budgeting badges
	{
		Name:             "Under Budget",
		Description:      "Stay under budget for a month",
		Icon:             "✅",
		Category:         "budgeting",
		RequirementType:  BadgeReqMonthsUnderBudget,
		RequirementValue: 1,
		Rarity:           "common",
	},
	{
		Name:             "Budget Pro",
		Description:      "Stay under budget 3 months in a row",
		Icon:             "📈",
		Category:         "budgeting",
		RequirementType:  BadgeReqMonthsUnderBudget,
		RequirementValue: 3,
		Rarity:           "rare",
	},

	// Special badges
	{
		Name:             "Globe Trotter",
		Description:      "Use 5 different currencies",
		Icon:             "🌍",
		Category:         "special",
		RequirementType:  BadgeReqCurrencyCount,
		RequirementValue: 5,
		Rarity:           "rare",
	},
	{
		Name:             "AI Explorer",
		Description:      "Use AI receipt parsing feature",
		Icon:             "🤖",
		Category:         "special",
		RequirementType:  BadgeReqAIUsage,
		RequirementValue: 1,
		Rarity:           "common",
	},
	{
		Name:             "Subscription Tracker",
		Description:      "Track 5 subscriptions",
		Icon:             "📱",
		Category:         "special",
		RequirementType:  BadgeReqSubscriptionCount,
		RequirementValue: 5,
		Rarity:           "common",
	},
}
