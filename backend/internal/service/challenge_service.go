package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

type ChallengeService struct {
	repo       *repository.ChallengeRepository
	walletRepo *repository.WalletRepository
	budgetRepo *repository.BudgetRepository
}

func NewChallengeService(repo *repository.ChallengeRepository, walletRepo *repository.WalletRepository, budgetRepo *repository.BudgetRepository) *ChallengeService {
	return &ChallengeService{
		repo:       repo,
		walletRepo: walletRepo,
		budgetRepo: budgetRepo,
	}
}

// GetAllChallenges returns all available challenges
func (s *ChallengeService) GetAllChallenges(ctx context.Context) ([]model.Challenge, error) {
	return s.repo.GetAllChallenges(ctx)
}

// GetFeaturedChallenges returns featured challenges
func (s *ChallengeService) GetFeaturedChallenges(ctx context.Context) ([]model.Challenge, error) {
	return s.repo.GetFeaturedChallenges(ctx)
}

// GetChallengesWithUserStatus returns all challenges with the user's participation status
func (s *ChallengeService) GetChallengesWithUserStatus(ctx context.Context, userID string) ([]model.ChallengeWithUserStatus, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetChallengesWithUserStatus(ctx, uid)
}

// JoinChallenge allows a user to join a challenge
func (s *ChallengeService) JoinChallenge(ctx context.Context, userID, challengeID string) (*model.UserChallenge, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	cid, err := uuid.Parse(challengeID)
	if err != nil {
		return nil, err
	}
	return s.repo.JoinChallenge(ctx, uid, cid)
}

// GetUserActiveChallenges returns all active challenges for a user
func (s *ChallengeService) GetUserActiveChallenges(ctx context.Context, userID string) ([]model.UserChallenge, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetUserActiveChallenges(ctx, uid)
}

// GetUserChallengeHistory returns all challenges for a user
func (s *ChallengeService) GetUserChallengeHistory(ctx context.Context, userID string) ([]model.UserChallenge, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetUserChallengeHistory(ctx, uid)
}

// AbandonChallenge allows a user to abandon an active challenge
func (s *ChallengeService) AbandonChallenge(ctx context.Context, userID, challengeID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return err
	}
	cid, err := uuid.Parse(challengeID)
	if err != nil {
		return err
	}
	return s.repo.AbandonUserChallenge(ctx, uid, cid)
}

// GetUserChallengeStats returns challenge statistics for a user
func (s *ChallengeService) GetUserChallengeStats(ctx context.Context, userID string) (*model.ChallengeStats, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetUserChallengeStats(ctx, uid)
}

// CheckAndUpdateProgress checks user's spending/saving and updates challenge progress
// This should be called after transactions are made
func (s *ChallengeService) CheckAndUpdateProgress(ctx context.Context, userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return err
	}

	// Get active challenges
	activeChallenges, err := s.repo.GetUserActiveChallenges(ctx, uid)
	if err != nil {
		return err
	}

	for _, uc := range activeChallenges {
		if uc.Challenge == nil {
			continue
		}

		var progress, currentValue float64
		var streakDays int

		switch uc.Challenge.Type {
		case model.ChallengeTypeNoSpend:
			// Check if user has spent money since challenge started
			spent, err := s.getSpendingSinceDate(ctx, userID, uc.StartedAt.Format("2006-01-02"), uc.Challenge.TargetCategory)
			if err != nil {
				continue
			}
			if spent == 0 {
				// Calculate progress based on days passed
				daysTotal := uc.Challenge.DurationDays
				daysPassed := int(time.Now().Sub(uc.StartedAt).Hours() / 24)
				progress = float64(daysPassed) / float64(daysTotal) * 100
				streakDays = daysPassed
			} else {
				// Failed - user spent money
				if err := s.repo.FailUserChallenge(ctx, uuid.MustParse(uc.ID)); err != nil {
					log.Error().Err(err).Str("challenge_id", uc.ID).Msg("Failed to mark challenge as failed")
				}
				continue
			}

		case model.ChallengeTypeSaveAmount:
			// Check savings since challenge started
			if uc.Challenge.TargetValue != nil {
				saved, err := s.getSavingsSinceDate(ctx, userID, uc.StartedAt.Format("2006-01-02"))
				if err != nil {
					continue
				}
				currentValue = saved
				progress = (saved / *uc.Challenge.TargetValue) * 100
				if progress > 100 {
					progress = 100
				}
			}

		case model.ChallengeTypeLimitDaily:
			// Check daily spending limit
			if uc.Challenge.TargetValue != nil {
				dailySpent, err := s.getDailySpending(ctx, userID)
				if err != nil {
					continue
				}
				currentValue = dailySpent
				if dailySpent <= *uc.Challenge.TargetValue {
					streakDays = uc.StreakDays + 1
					progress = float64(streakDays) / float64(uc.Challenge.DurationDays) * 100
				} else {
					// Reset streak
					streakDays = 0
				}
			}

		case model.ChallengeTypeReduceCategory:
			// Check category spending reduction
			if uc.Challenge.TargetCategory != nil && uc.Challenge.TargetPercentage != nil {
				// Compare with previous period
				currentSpent, err := s.getCategorySpendingSinceDate(ctx, userID, uc.StartedAt.Format("2006-01-02"), *uc.Challenge.TargetCategory)
				if err != nil {
					continue
				}
				currentValue = currentSpent
				// Calculate progress: if user spends less than target percentage of baseline, progress increases
				// Baseline is stored in TargetValue if available, otherwise assume they're on track
				if uc.Challenge.TargetValue != nil && *uc.Challenge.TargetValue > 0 {
					targetSpend := *uc.Challenge.TargetValue * (1 - *uc.Challenge.TargetPercentage/100)
					if currentSpent <= targetSpend {
						// User is under target - calculate based on time elapsed
						daysTotal := uc.Challenge.DurationDays
						daysPassed := int(time.Now().Sub(uc.StartedAt).Hours() / 24)
						progress = float64(daysPassed) / float64(daysTotal) * 100
					} else {
						// User exceeded target - progress based on how close they are
						progress = (targetSpend / currentSpent) * 100
					}
				}
			}

		case model.ChallengeTypeStreak:
			// Check if under budget for consecutive days
			underBudget, err := s.isUnderBudgetToday(ctx, userID)
			if err != nil {
				continue
			}
			if underBudget {
				streakDays = uc.StreakDays + 1
			} else {
				streakDays = 0
			}
			progress = float64(streakDays) / float64(uc.Challenge.DurationDays) * 100
		}

		// Update progress
		if err := s.repo.UpdateUserChallengeProgress(ctx, uuid.MustParse(uc.ID), progress, currentValue, streakDays); err != nil {
			continue
		}

		// Check for completion
		if progress >= 100 {
			if err := s.repo.CompleteUserChallenge(ctx, uuid.MustParse(uc.ID)); err != nil {
				log.Error().Err(err).Str("challenge_id", uc.ID).Msg("Failed to mark challenge as completed")
			}
		}
	}

	// Also check for expired challenges
	if _, err := s.repo.CheckExpiredChallenges(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to check expired challenges")
	}

	return nil
}

// GetChallengesForAI returns challenge data formatted for AI context
func (s *ChallengeService) GetChallengesForAI(ctx context.Context, userID string) (map[string]interface{}, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}

	activeChallenges, err := s.repo.GetUserActiveChallenges(ctx, uid)
	if err != nil {
		return nil, err
	}

	stats, err := s.repo.GetUserChallengeStats(ctx, uid)
	if err != nil {
		return nil, err
	}

	challenges := make([]map[string]interface{}, 0, len(activeChallenges))
	for _, uc := range activeChallenges {
		if uc.Challenge == nil {
			continue
		}
		challenges = append(challenges, map[string]interface{}{
			"name":        uc.Challenge.Name,
			"type":        uc.Challenge.Type,
			"progress":    uc.Progress,
			"streak_days": uc.StreakDays,
			"ends_at":     uc.EndsAt.Format("2006-01-02"),
		})
	}

	return map[string]interface{}{
		"active_challenges": challenges,
		"total_completed":   stats.TotalCompleted,
		"total_points":      stats.TotalPoints,
		"current_streak":    stats.CurrentStreak,
		"completion_rate":   stats.CompletionRate,
	}, nil
}

// Helper methods for checking progress

func (s *ChallengeService) getSpendingSinceDate(ctx context.Context, userID, since string, category *string) (float64, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, err
	}

	filter := &model.TransactionFilter{
		Type: "debit",
	}
	if category != nil {
		filter.Category = *category
	}

	txns, _, err := s.walletRepo.GetTransactionsFiltered(ctx, uid, filter, 1000, 0)
	if err != nil {
		return 0, err
	}

	var total float64
	for _, tx := range txns {
		if tx.CreatedAt.Format("2006-01-02") >= since {
			total += tx.Amount
		}
	}
	return total, nil
}

func (s *ChallengeService) getSavingsSinceDate(ctx context.Context, userID, since string) (float64, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, err
	}

	incomeFilter := &model.TransactionFilter{Type: "credit"}
	txns, _, err := s.walletRepo.GetTransactionsFiltered(ctx, uid, incomeFilter, 1000, 0)
	if err != nil {
		return 0, err
	}

	expenseFilter := &model.TransactionFilter{Type: "debit"}
	expTxns, _, err := s.walletRepo.GetTransactionsFiltered(ctx, uid, expenseFilter, 1000, 0)
	if err != nil {
		return 0, err
	}

	var income, expense float64
	for _, tx := range txns {
		if tx.CreatedAt.Format("2006-01-02") >= since {
			income += tx.Amount
		}
	}
	for _, tx := range expTxns {
		if tx.CreatedAt.Format("2006-01-02") >= since {
			expense += tx.Amount
		}
	}
	return income - expense, nil
}

func (s *ChallengeService) getDailySpending(ctx context.Context, userID string) (float64, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, err
	}

	today := time.Now().Format("2006-01-02")
	filter := &model.TransactionFilter{Type: "debit"}
	txns, _, err := s.walletRepo.GetTransactionsFiltered(ctx, uid, filter, 100, 0)
	if err != nil {
		return 0, err
	}

	var total float64
	for _, tx := range txns {
		if tx.CreatedAt.Format("2006-01-02") == today {
			total += tx.Amount
		}
	}
	return total, nil
}

func (s *ChallengeService) getCategorySpendingSinceDate(ctx context.Context, userID, since, category string) (float64, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, err
	}

	filter := &model.TransactionFilter{
		Type:     "debit",
		Category: category,
	}
	txns, _, err := s.walletRepo.GetTransactionsFiltered(ctx, uid, filter, 1000, 0)
	if err != nil {
		return 0, err
	}

	var total float64
	for _, tx := range txns {
		if tx.CreatedAt.Format("2006-01-02") >= since {
			total += tx.Amount
		}
	}
	return total, nil
}

func (s *ChallengeService) isUnderBudgetToday(ctx context.Context, userID string) (bool, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return false, err
	}

	budgets, err := s.budgetRepo.GetByUser(ctx, uid)
	if err != nil {
		return false, err
	}

	for _, b := range budgets {
		if b.Spent > b.Amount {
			return false, nil
		}
	}
	return true, nil
}
