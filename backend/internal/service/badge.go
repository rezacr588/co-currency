package service

import (
	"context"

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

	// Get transaction count
	if s.walletRepo != nil {
		transactions, err := s.walletRepo.GetTransactions(ctx, userID, 0, 0)
		if err == nil {
			stats.TransactionCount = len(transactions)

			// Count unique currencies
			currencies := make(map[string]bool)
			for _, t := range transactions {
				currencies[t.Currency] = true
			}
			stats.CurrencyCount = len(currencies)

			// Calculate total saved (credits minus debits)
			var totalCredits, totalDebits float64
			for _, t := range transactions {
				if t.Type == "credit" {
					totalCredits += t.Amount
				} else if t.Type == "debit" {
					totalDebits += t.Amount
				}
			}
			stats.TotalSaved = totalCredits - totalDebits
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

			// Check months under budget (simplified - just count budgets not exceeded)
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

	// Calculate streak days (simplified - count consecutive days with transactions)
	// This is a basic implementation; a more sophisticated version would track daily activity
	stats.StreakDays = s.calculateStreak(ctx, userID)

	return stats, nil
}

// calculateStreak calculates the current tracking streak
func (s *BadgeService) calculateStreak(ctx context.Context, userID uuid.UUID) int {
	// Simplified implementation - in production, you'd track daily activity
	// For now, we'll just return a basic count based on recent activity
	if s.walletRepo == nil {
		return 0
	}

	// Get recent transactions
	transactions, err := s.walletRepo.GetTransactions(ctx, userID, 30, 0)
	if err != nil || len(transactions) == 0 {
		return 0
	}

	// Count unique days in the last 30 days
	days := make(map[string]bool)
	for _, t := range transactions {
		day := t.CreatedAt.Format("2006-01-02")
		days[day] = true
	}

	return len(days)
}

// AwardSpecialBadge awards a special badge manually
func (s *BadgeService) AwardSpecialBadge(ctx context.Context, userID uuid.UUID, badgeName string) (*model.UserBadge, error) {
	return s.badgeRepo.AwardBadgeByName(ctx, userID, badgeName)
}
