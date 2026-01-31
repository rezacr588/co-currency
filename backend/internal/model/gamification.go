package model

import (
	"time"

	"github.com/google/uuid"
)

// UserXP represents a user's experience points and level
type UserXP struct {
	UserID           uuid.UUID `json:"user_id"`
	TotalXP          int       `json:"total_xp"`
	CurrentLevel     int       `json:"current_level"`
	XPToNextLevel    int       `json:"xp_to_next_level"`
	StreakDays       int       `json:"streak_days"`
	LastActivityDate *time.Time `json:"last_activity_date,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// XPTransaction represents an XP award event
type XPTransaction struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	Amount     int        `json:"amount"`
	Reason     string     `json:"reason"`
	SourceType string     `json:"source_type,omitempty"`
	SourceID   *uuid.UUID `json:"source_id,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// DailyReward represents a daily login reward
type DailyReward struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	LoginDate       time.Time `json:"login_date"`
	ConsecutiveDays int       `json:"consecutive_days"`
	XPAwarded       int       `json:"xp_awarded"`
	BonusAwarded    bool      `json:"bonus_awarded"`
	CreatedAt       time.Time `json:"created_at"`
}

// LevelInfo contains information about a level
type LevelInfo struct {
	Level          int    `json:"level"`
	Title          string `json:"title"`
	XPRequired     int    `json:"xp_required"`
	XPToNext       int    `json:"xp_to_next"`
	Benefits       string `json:"benefits,omitempty"`
}

// XPSourceType constants
const (
	XPSourceTransaction = "transaction"
	XPSourceBadge       = "badge"
	XPSourceChallenge   = "challenge"
	XPSourceGoal        = "goal"
	XPSourceLogin       = "login"
	XPSourceStreak      = "streak"
)

// XP reward amounts
const (
	XPLogTransaction     = 5
	XPDailyLogin         = 10
	XPStreakBonus7Days   = 50
	XPStreakBonus30Days  = 200
	XPBadgeEarned        = 100
	XPChallengeComplete  = 50
	XPGoalAchieved       = 200
	XPUnderBudget        = 10
)

// LevelThresholds defines XP required for each level
var LevelThresholds = map[int]int{
	1:  0,
	2:  100,
	3:  250,
	4:  500,
	5:  1000,
	6:  1500,
	7:  2000,
	8:  2750,
	9:  3500,
	10: 5000,
	11: 6000,
	12: 7500,
	13: 9000,
	14: 11000,
	15: 13000,
	16: 16000,
	17: 19000,
	18: 23000,
	19: 27000,
	20: 32000,
	25: 50000,
	30: 75000,
	40: 120000,
	50: 200000,
}

// LevelTitles defines titles for each level tier
var LevelTitles = map[int]string{
	1:  "Beginner",
	5:  "Apprentice",
	10: "Saver",
	15: "Budgeter",
	20: "Money Master",
	25: "Financial Pro",
	30: "Wealth Builder",
	40: "Finance Guru",
	50: "Money Legend",
}

// GetLevelForXP returns the level for a given XP amount
func GetLevelForXP(xp int) int {
	level := 1
	for lvl, threshold := range LevelThresholds {
		if xp >= threshold && lvl > level {
			level = lvl
		}
	}
	return level
}

// GetXPToNextLevel returns XP needed for next level
func GetXPToNextLevel(currentXP int) int {
	currentLevel := GetLevelForXP(currentXP)
	nextLevel := currentLevel + 1

	// Find next level threshold
	for lvl := nextLevel; lvl <= 50; lvl++ {
		if threshold, ok := LevelThresholds[lvl]; ok {
			return threshold - currentXP
		}
	}

	// Max level reached
	return 0
}

// GetLevelInfo returns detailed info about a level
func GetLevelInfo(level int) LevelInfo {
	title := "Beginner"
	for lvl, t := range LevelTitles {
		if level >= lvl {
			title = t
		}
	}

	xpRequired := 0
	if threshold, ok := LevelThresholds[level]; ok {
		xpRequired = threshold
	}

	xpToNext := 0
	for lvl := level + 1; lvl <= 50; lvl++ {
		if threshold, ok := LevelThresholds[lvl]; ok {
			xpToNext = threshold - xpRequired
			break
		}
	}

	return LevelInfo{
		Level:      level,
		Title:      title,
		XPRequired: xpRequired,
		XPToNext:   xpToNext,
	}
}

// DailyRewardTiers defines XP rewards for consecutive login days
var DailyRewardTiers = map[int]int{
	1:  10,  // Day 1
	2:  15,  // Day 2
	3:  20,  // Day 3
	4:  25,  // Day 4
	5:  30,  // Day 5
	6:  40,  // Day 6
	7:  100, // Day 7 (bonus week)
	14: 150, // 2 weeks
	30: 300, // 1 month
}

// GetDailyRewardXP returns XP for a given streak day
func GetDailyRewardXP(consecutiveDays int) int {
	// Check for exact tier match
	if xp, ok := DailyRewardTiers[consecutiveDays]; ok {
		return xp
	}

	// Otherwise use weekly cycle (days 8-13 reset to day 1-6 values)
	dayInCycle := ((consecutiveDays - 1) % 7) + 1
	if xp, ok := DailyRewardTiers[dayInCycle]; ok {
		return xp
	}

	return 10 // Default
}
