package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// XPService handles XP and level logic
type XPService struct {
	xpRepo *repository.XPRepository
}

// NewXPService creates a new XPService
func NewXPService(xpRepo *repository.XPRepository) *XPService {
	return &XPService{xpRepo: xpRepo}
}

// GetUserXP returns user's current XP and level
func (s *XPService) GetUserXP(ctx context.Context, userID uuid.UUID) (*model.UserXP, error) {
	return s.xpRepo.GetUserXP(ctx, userID)
}

// AddXP awards XP to a user
func (s *XPService) AddXP(ctx context.Context, userID uuid.UUID, amount int, reason, sourceType string, sourceID *uuid.UUID) (*model.UserXP, bool, error) {
	// Get current XP
	xp, err := s.xpRepo.GetUserXP(ctx, userID)
	if err != nil {
		return nil, false, err
	}

	oldLevel := xp.CurrentLevel

	// Add XP
	xp.TotalXP += amount
	xp.CurrentLevel = model.GetLevelForXP(xp.TotalXP)
	xp.XPToNextLevel = model.GetXPToNextLevel(xp.TotalXP)

	now := time.Now()
	xp.LastActivityDate = &now

	// Save updated XP
	if err := s.xpRepo.UpsertUserXP(ctx, xp); err != nil {
		return nil, false, err
	}

	// Log XP transaction
	tx := &model.XPTransaction{
		UserID:     userID,
		Amount:     amount,
		Reason:     reason,
		SourceType: sourceType,
		SourceID:   sourceID,
	}
	if err := s.xpRepo.AddXPTransaction(ctx, tx); err != nil {
		log.Error().Err(err).Msg("Failed to log XP transaction")
	}

	leveledUp := xp.CurrentLevel > oldLevel

	return xp, leveledUp, nil
}

// GetXPHistory returns recent XP transactions
func (s *XPService) GetXPHistory(ctx context.Context, userID uuid.UUID, limit int) ([]model.XPTransaction, error) {
	return s.xpRepo.GetXPTransactions(ctx, userID, limit)
}

// GetLevelInfo returns info about a specific level or current level
func (s *XPService) GetLevelInfo(ctx context.Context, userID uuid.UUID, level *int) (*model.LevelInfo, error) {
	if level != nil {
		info := model.GetLevelInfo(*level)
		return &info, nil
	}

	xp, err := s.xpRepo.GetUserXP(ctx, userID)
	if err != nil {
		return nil, err
	}

	info := model.GetLevelInfo(xp.CurrentLevel)
	return &info, nil
}

// DailyRewardResponse represents the result of claiming a daily reward
type DailyRewardResponse struct {
	Reward         *model.DailyReward `json:"reward"`
	LeveledUp      bool               `json:"leveled_up"`
	NewLevel       *int               `json:"new_level,omitempty"`
	AlreadyClaimed bool               `json:"already_claimed"`
}

// ClaimDailyReward claims the daily login reward
func (s *XPService) ClaimDailyReward(ctx context.Context, userID uuid.UUID) (*DailyRewardResponse, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)

	// Check if already claimed today
	existing, _ := s.xpRepo.GetDailyReward(ctx, userID, today)
	if existing != nil {
		return &DailyRewardResponse{
			Reward:         existing,
			AlreadyClaimed: true,
		}, nil
	}

	// Get last reward to calculate streak
	lastReward, _ := s.xpRepo.GetLastDailyReward(ctx, userID)

	consecutiveDays := 1
	if lastReward != nil {
		// Check if last reward was yesterday
		yesterday := today.AddDate(0, 0, -1)
		if lastReward.LoginDate.Truncate(24*time.Hour).Equal(yesterday) {
			consecutiveDays = lastReward.ConsecutiveDays + 1
		}
	}

	// Calculate XP reward
	xpAwarded := model.GetDailyRewardXP(consecutiveDays)
	bonusAwarded := consecutiveDays == 7 || consecutiveDays == 14 || consecutiveDays == 30

	// Create reward record
	reward := &model.DailyReward{
		UserID:          userID,
		LoginDate:       today,
		ConsecutiveDays: consecutiveDays,
		XPAwarded:       xpAwarded,
		BonusAwarded:    bonusAwarded,
	}

	if err := s.xpRepo.CreateDailyReward(ctx, reward); err != nil {
		return nil, fmt.Errorf("failed to create daily reward: %w", err)
	}

	// Award XP
	xp, leveledUp, err := s.AddXP(ctx, userID, xpAwarded, "Daily login reward", model.XPSourceLogin, nil)
	if err != nil {
		log.Error().Err(err).Msg("Failed to award daily XP")
	}

	response := &DailyRewardResponse{
		Reward:    reward,
		LeveledUp: leveledUp,
	}

	if leveledUp && xp != nil {
		response.NewLevel = &xp.CurrentLevel
	}

	return response, nil
}

// DailyRewardStatus represents the current daily reward status
type DailyRewardStatus struct {
	ClaimedToday    bool `json:"claimed_today"`
	ConsecutiveDays int  `json:"consecutive_days"`
	NextRewardXP    int  `json:"next_reward_xp"`
}

// GetDailyRewardStatus checks if daily reward is available
func (s *XPService) GetDailyRewardStatus(ctx context.Context, userID uuid.UUID) (*DailyRewardStatus, error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)

	// Check if already claimed today
	existing, _ := s.xpRepo.GetDailyReward(ctx, userID, today)
	claimedToday := existing != nil

	// Get last reward for streak info
	lastReward, _ := s.xpRepo.GetLastDailyReward(ctx, userID)

	consecutiveDays := 0
	if lastReward != nil {
		yesterday := today.AddDate(0, 0, -1)
		if lastReward.LoginDate.UTC().Truncate(24*time.Hour).Equal(yesterday) {
			consecutiveDays = lastReward.ConsecutiveDays
		} else if lastReward.LoginDate.UTC().Truncate(24*time.Hour).Equal(today) {
			consecutiveDays = lastReward.ConsecutiveDays
		}
	}

	// Calculate XP for next reward
	nextDay := consecutiveDays + 1

	return &DailyRewardStatus{
		ClaimedToday:    claimedToday,
		ConsecutiveDays: consecutiveDays,
		NextRewardXP:    model.GetDailyRewardXP(nextDay),
	}, nil
}

// GetLeaderboard returns top users by XP
func (s *XPService) GetLeaderboard(ctx context.Context, limit int) ([]model.UserXP, error) {
	return s.xpRepo.GetLeaderboard(ctx, limit)
}

// AwardTransactionXP awards XP for logging a transaction
func (s *XPService) AwardTransactionXP(ctx context.Context, userID uuid.UUID, transactionID uuid.UUID) (*model.UserXP, bool, error) {
	return s.AddXP(ctx, userID, model.XPLogTransaction, "Logged transaction", model.XPSourceTransaction, &transactionID)
}

// AwardBadgeXP awards XP for earning a badge
func (s *XPService) AwardBadgeXP(ctx context.Context, userID uuid.UUID, badgeID uuid.UUID) (*model.UserXP, bool, error) {
	return s.AddXP(ctx, userID, model.XPBadgeEarned, "Earned badge", model.XPSourceBadge, &badgeID)
}

// AwardGoalXP awards XP for achieving a goal
func (s *XPService) AwardGoalXP(ctx context.Context, userID uuid.UUID, goalID uuid.UUID) (*model.UserXP, bool, error) {
	return s.AddXP(ctx, userID, model.XPGoalAchieved, "Achieved goal", model.XPSourceGoal, &goalID)
}

// AwardChallengeXP awards XP for completing a challenge
func (s *XPService) AwardChallengeXP(ctx context.Context, userID uuid.UUID, challengeID uuid.UUID, xpAmount int) (*model.UserXP, bool, error) {
	return s.AddXP(ctx, userID, xpAmount, "Completed challenge", model.XPSourceChallenge, &challengeID)
}
