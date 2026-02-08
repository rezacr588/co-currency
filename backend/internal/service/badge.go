package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// BadgeService handles badge business logic
type BadgeService struct {
	badgeRepo        *repository.BadgeRepository
	walletRepo       *repository.WalletRepository
	budgetRepo       *repository.BudgetRepository
	goalRepo         *repository.GoalRepository
	subscriptionRepo *repository.SubscriptionRepository
}

// NewBadgeService creates a new BadgeService
func NewBadgeService(
	badgeRepo *repository.BadgeRepository,
	walletRepo *repository.WalletRepository,
	budgetRepo *repository.BudgetRepository,
	goalRepo *repository.GoalRepository,
	subscriptionRepo *repository.SubscriptionRepository,
) *BadgeService {
	return &BadgeService{
		badgeRepo:        badgeRepo,
		walletRepo:       walletRepo,
		budgetRepo:       budgetRepo,
		goalRepo:         goalRepo,
		subscriptionRepo: subscriptionRepo,
	}
}

// InitBadges seeds the default badges
func (s *BadgeService) InitBadges(ctx context.Context) error {
	return s.badgeRepo.InitDefaultBadges(ctx)
}

// GetAllBadges returns all available badges
func (s *BadgeService) GetAllBadges(ctx context.Context) ([]model.Badge, error) {
	return s.badgeRepo.GetAllBadges(ctx)
}

// GetUserBadges returns badges earned by a user
func (s *BadgeService) GetUserBadges(ctx context.Context, userID uuid.UUID) ([]model.UserBadge, error) {
	return s.badgeRepo.GetUserBadges(ctx, userID)
}

// GetBadgeProgress returns progress toward all badges
func (s *BadgeService) GetBadgeProgress(ctx context.Context, userID uuid.UUID) ([]model.BadgeProgress, error) {
	stats, err := s.getUserStats(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.badgeRepo.GetBadgeProgress(ctx, userID, stats)
}

// CheckAndAwardBadges checks all badge conditions and awards new ones
func (s *BadgeService) CheckAndAwardBadges(ctx context.Context, userID uuid.UUID) (*model.BadgeCheckResult, error) {
	stats, err := s.getUserStats(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Get all badges
	badges, err := s.badgeRepo.GetAllBadges(ctx)
	if err != nil {
		return nil, err
	}

	result := &model.BadgeCheckResult{
		NewlyEarned: []model.UserBadge{},
	}

	for _, badge := range badges {
		// Check if already earned
		has, err := s.badgeRepo.HasBadge(ctx, userID, badge.ID)
		if err != nil {
			log.Error().Err(err).Str("badge", badge.Name).Msg("Error checking badge")
			continue
		}
		if has {
			result.TotalEarned++
			continue
		}

		// Check if requirement is met
		currentValue := stats.GetValueForRequirement(badge.RequirementType)
		if currentValue >= badge.RequirementValue {
			// Award the badge
			userBadge, err := s.badgeRepo.AwardBadge(ctx, userID, badge.ID)
			if err != nil {
				log.Error().Err(err).Str("badge", badge.Name).Msg("Error awarding badge")
				continue
			}
			result.NewlyEarned = append(result.NewlyEarned, *userBadge)
			result.TotalEarned++
			log.Info().Str("badge", badge.Name).Str("user_id", userID.String()).Msg("Badge awarded")
		}
	}

	return result, nil
}

// getUserStats gathers all statistics needed for badge calculations
func (s *BadgeService) getUserStats(ctx context.Context, userID uuid.UUID) (*repository.UserStats, error) {
	stats := &repository.UserStats{}

	// Get transaction count and calculate stats
	if s.walletRepo != nil {
		count, err := s.walletRepo.CountTransactions(ctx, userID)
		if err == nil {
			stats.TransactionCount = count
		}

		currCount, err := s.walletRepo.CountDistinctCurrencies(ctx, userID)
		if err == nil {
			stats.CurrencyCount = currCount
		}

		// Use wallet balances for TotalSaved (already correctly calculated per currency)
		// This is more accurate than summing transactions which may be in different currencies
		balances, err := s.walletRepo.GetBalances(ctx, userID)
		if err == nil {
			var totalBalance float64
			for _, b := range balances {
				// Sum all balances (they're already in their respective currencies)
				// For a more accurate comparison, you'd convert to a single currency
				// but for badge purposes, we use the sum as a rough indicator
				totalBalance += b.Balance
			}
			stats.TotalSaved = totalBalance
			if stats.TotalSaved < 0 {
				stats.TotalSaved = 0
			}
		}
	}

	// Get budget count
	if s.budgetRepo != nil {
		budgets, err := s.budgetRepo.GetByUser(ctx, userID)
		if err == nil {
			stats.BudgetCount = len(budgets)

			// Count budgets that are currently under their limit
			// Note: This counts budget categories, not historical months.
			// A proper implementation would track budget compliance over time.
			underBudgetCount := 0
			for _, b := range budgets {
				if b.Spent <= b.Amount {
					underBudgetCount++
				}
			}
			stats.MonthsUnderBudget = underBudgetCount
		}
	}

	// Get goal count
	if s.goalRepo != nil {
		goals, err := s.goalRepo.GetByUser(ctx, userID)
		if err == nil {
			stats.GoalCount = len(goals)
		}
	}

	// Get subscription count
	if s.subscriptionRepo != nil {
		count, err := s.subscriptionRepo.CountActiveSubscriptions(ctx, userID)
		if err == nil {
			stats.SubscriptionCount = count
		}
	}

	// Calculate streak days - actual consecutive days with transactions
	stats.StreakDays = s.calculateStreak(ctx, userID)

	return stats, nil
}

// calculateStreak calculates the current tracking streak (consecutive days with transactions)
func (s *BadgeService) calculateStreak(ctx context.Context, userID uuid.UUID) int {
	if s.walletRepo == nil {
		return 0
	}

	// Get all distinct transaction dates (sorted ascending)
	days, err := s.walletRepo.GetTransactionDates(ctx, userID)
	if err != nil || len(days) == 0 {
		return 0
	}

	// Check if today or yesterday has activity (streak must be current)
	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

	lastActivityDay := days[len(days)-1]
	if lastActivityDay != today && lastActivityDay != yesterday {
		// Streak is broken - no recent activity
		return 0
	}

	// Count consecutive days backwards from the most recent activity day
	streak := 1
	for i := len(days) - 2; i >= 0; i-- {
		currentDay, _ := time.Parse("2006-01-02", days[i+1])

		// Check if days are consecutive
		expectedPrev := currentDay.AddDate(0, 0, -1).Format("2006-01-02")
		if days[i] == expectedPrev {
			streak++
		} else {
			// Gap found, streak ends
			break
		}
	}

	return streak
}

// AwardSpecialBadge awards a special badge manually
func (s *BadgeService) AwardSpecialBadge(ctx context.Context, userID uuid.UUID, badgeName string) (*model.UserBadge, error) {
	return s.badgeRepo.AwardBadgeByName(ctx, userID, badgeName)
}
