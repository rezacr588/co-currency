package model

import "time"

// ChallengeType represents the type of challenge
type ChallengeType string

const (
	ChallengeTypeNoSpend        ChallengeType = "no_spend"
	ChallengeTypeSaveAmount     ChallengeType = "save_amount"
	ChallengeTypeReduceCategory ChallengeType = "reduce_category"
	ChallengeTypeStreak         ChallengeType = "streak"
	ChallengeTypeLimitDaily     ChallengeType = "limit_daily"
)

// ChallengeDifficulty represents the difficulty level
type ChallengeDifficulty string

const (
	ChallengeDifficultyEasy   ChallengeDifficulty = "easy"
	ChallengeDifficultyMedium ChallengeDifficulty = "medium"
	ChallengeDifficultyHard   ChallengeDifficulty = "hard"
)

// UserChallengeStatus represents the status of a user's challenge
type UserChallengeStatus string

const (
	UserChallengeStatusActive    UserChallengeStatus = "active"
	UserChallengeStatusCompleted UserChallengeStatus = "completed"
	UserChallengeStatusFailed    UserChallengeStatus = "failed"
	UserChallengeStatusAbandoned UserChallengeStatus = "abandoned"
)

// Challenge represents a challenge definition
type Challenge struct {
	ID               string              `json:"id"`
	Name             string              `json:"name"`
	Description      string              `json:"description"`
	Type             ChallengeType       `json:"type"`
	Icon             string              `json:"icon"`
	Difficulty       ChallengeDifficulty `json:"difficulty"`
	DurationDays     int                 `json:"duration_days"`
	TargetValue      *float64            `json:"target_value,omitempty"`
	TargetCategory   *string             `json:"target_category,omitempty"`
	TargetPercentage *float64            `json:"target_percentage,omitempty"`
	PointsReward     int                 `json:"points_reward"`
	IsActive         bool                `json:"is_active"`
	IsFeatured       bool                `json:"is_featured"`
	CreatedAt        time.Time           `json:"created_at"`
}

// UserChallenge represents a user's participation in a challenge
type UserChallenge struct {
	ID           string              `json:"id"`
	UserID       string              `json:"user_id"`
	ChallengeID  string              `json:"challenge_id"`
	Challenge    *Challenge          `json:"challenge,omitempty"`
	Status       UserChallengeStatus `json:"status"`
	Progress     float64             `json:"progress"`
	CurrentValue float64             `json:"current_value"`
	StartedAt    time.Time           `json:"started_at"`
	CompletedAt  *time.Time          `json:"completed_at,omitempty"`
	StreakDays   int                 `json:"streak_days"`
	EndsAt       time.Time           `json:"ends_at"`
}

// ChallengeWithUserStatus combines challenge info with user's status
type ChallengeWithUserStatus struct {
	Challenge
	UserStatus     *UserChallengeStatus `json:"user_status,omitempty"`
	UserProgress   *float64             `json:"user_progress,omitempty"`
	UserChallengeID *string             `json:"user_challenge_id,omitempty"`
	EndsAt         *time.Time           `json:"ends_at,omitempty"`
}

// JoinChallengeRequest is the request to join a challenge
type JoinChallengeRequest struct {
	ChallengeID string `json:"challenge_id" validate:"required"`
}

// ChallengeStats represents user's challenge statistics
type ChallengeStats struct {
	TotalJoined     int     `json:"total_joined"`
	TotalCompleted  int     `json:"total_completed"`
	TotalFailed     int     `json:"total_failed"`
	TotalPoints     int     `json:"total_points"`
	CurrentStreak   int     `json:"current_streak"`
	LongestStreak   int     `json:"longest_streak"`
	CompletionRate  float64 `json:"completion_rate"`
	ActiveChallenges int    `json:"active_challenges"`
}
