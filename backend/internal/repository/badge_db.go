package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rezacr588/currency-converter/internal/model"
)

// BadgeRepository handles badge database operations
type BadgeRepository struct {
	db *Database
}

// NewBadgeRepository creates a new BadgeRepository
func NewBadgeRepository(db *Database) *BadgeRepository {
	return &BadgeRepository{db: db}
}

// InitDefaultBadges seeds the default system badges
func (r *BadgeRepository) InitDefaultBadges(ctx context.Context) error {
	for _, badge := range model.DefaultBadges {
		_, err := r.db.pool.Exec(ctx, `
			INSERT INTO badges (name, description, icon, category, requirement_type, requirement_value, rarity)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (name) DO NOTHING`,
			badge.Name, badge.Description, badge.Icon, badge.Category,
			badge.RequirementType, badge.RequirementValue, badge.Rarity,
		)
		if err != nil {
			return fmt.Errorf("inserting badge %s: %w", badge.Name, err)
		}
	}
	return nil
}

// GetAllBadges returns all available badges
func (r *BadgeRepository) GetAllBadges(ctx context.Context) ([]model.Badge, error) {
	query := `
		SELECT id, name, description, icon, category, requirement_type, requirement_value, rarity, created_at
		FROM badges
		ORDER BY 
			CASE rarity 
				WHEN 'common' THEN 1 
				WHEN 'rare' THEN 2 
				WHEN 'epic' THEN 3 
				WHEN 'legendary' THEN 4 
			END,
			name`

	rows, err := r.db.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying badges: %w", err)
	}
	defer rows.Close()

	var badges []model.Badge
	for rows.Next() {
		var b model.Badge
		var description, icon, category *string
		var reqValue *float64
		err := rows.Scan(
			&b.ID, &b.Name, &description, &icon, &category,
			&b.RequirementType, &reqValue, &b.Rarity, &b.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning badge: %w", err)
		}
		if description != nil {
			b.Description = *description
		}
		if icon != nil {
			b.Icon = *icon
		}
		if category != nil {
			b.Category = *category
		}
		if reqValue != nil {
			b.RequirementValue = *reqValue
		}
		badges = append(badges, b)
	}

	return badges, nil
}

// GetBadge returns a single badge by ID
func (r *BadgeRepository) GetBadge(ctx context.Context, badgeID uuid.UUID) (*model.Badge, error) {
	query := `
		SELECT id, name, description, icon, category, requirement_type, requirement_value, rarity, created_at
		FROM badges
		WHERE id = $1`

	var b model.Badge
	var description, icon, category *string
	var reqValue *float64
	err := r.db.pool.QueryRow(ctx, query, badgeID).Scan(
		&b.ID, &b.Name, &description, &icon, &category,
		&b.RequirementType, &reqValue, &b.Rarity, &b.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("badge not found")
		}
		return nil, fmt.Errorf("querying badge: %w", err)
	}

	if description != nil {
		b.Description = *description
	}
	if icon != nil {
		b.Icon = *icon
	}
	if category != nil {
		b.Category = *category
	}
	if reqValue != nil {
		b.RequirementValue = *reqValue
	}

	return &b, nil
}

// GetUserBadges returns all badges earned by a user
func (r *BadgeRepository) GetUserBadges(ctx context.Context, userID uuid.UUID) ([]model.UserBadge, error) {
	query := `
		SELECT ub.id, ub.user_id, ub.badge_id, ub.earned_at,
			   b.id, b.name, b.description, b.icon, b.category, 
			   b.requirement_type, b.requirement_value, b.rarity, b.created_at
		FROM user_badges ub
		JOIN badges b ON ub.badge_id = b.id
		WHERE ub.user_id = $1
		ORDER BY ub.earned_at DESC`

	rows, err := r.db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying user badges: %w", err)
	}
	defer rows.Close()

	var userBadges []model.UserBadge
	for rows.Next() {
		var ub model.UserBadge
		var b model.Badge
		var description, icon, category *string
		var reqValue *float64
		err := rows.Scan(
			&ub.ID, &ub.UserID, &ub.BadgeID, &ub.EarnedAt,
			&b.ID, &b.Name, &description, &icon, &category,
			&b.RequirementType, &reqValue, &b.Rarity, &b.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning user badge: %w", err)
		}
		if description != nil {
			b.Description = *description
		}
		if icon != nil {
			b.Icon = *icon
		}
		if category != nil {
			b.Category = *category
		}
		if reqValue != nil {
			b.RequirementValue = *reqValue
		}
		ub.Badge = &b
		userBadges = append(userBadges, ub)
	}

	return userBadges, nil
}

// HasBadge checks if a user has earned a specific badge
func (r *BadgeRepository) HasBadge(ctx context.Context, userID, badgeID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2)`,
		userID, badgeID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("checking badge: %w", err)
	}
	return exists, nil
}

// HasBadgeByName checks if a user has earned a badge by name
func (r *BadgeRepository) HasBadgeByName(ctx context.Context, userID uuid.UUID, badgeName string) (bool, error) {
	var exists bool
	err := r.db.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM user_badges ub 
			JOIN badges b ON ub.badge_id = b.id 
			WHERE ub.user_id = $1 AND b.name = $2
		)`,
		userID, badgeName,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("checking badge by name: %w", err)
	}
	return exists, nil
}

// AwardBadge grants a badge to a user
func (r *BadgeRepository) AwardBadge(ctx context.Context, userID, badgeID uuid.UUID) (*model.UserBadge, error) {
	// Check if already earned
	has, err := r.HasBadge(ctx, userID, badgeID)
	if err != nil {
		return nil, err
	}
	if has {
		return nil, fmt.Errorf("badge already earned")
	}

	var ub model.UserBadge
	err = r.db.pool.QueryRow(ctx, `
		INSERT INTO user_badges (user_id, badge_id)
		VALUES ($1, $2)
		RETURNING id, user_id, badge_id, earned_at`,
		userID, badgeID,
	).Scan(&ub.ID, &ub.UserID, &ub.BadgeID, &ub.EarnedAt)
	if err != nil {
		return nil, fmt.Errorf("awarding badge: %w", err)
	}

	// Fetch the badge details
	badge, err := r.GetBadge(ctx, badgeID)
	if err != nil {
		return nil, err
	}
	ub.Badge = badge

	return &ub, nil
}

// AwardBadgeByName grants a badge by name
func (r *BadgeRepository) AwardBadgeByName(ctx context.Context, userID uuid.UUID, badgeName string) (*model.UserBadge, error) {
	// Get badge ID by name
	var badgeID uuid.UUID
	err := r.db.pool.QueryRow(ctx,
		`SELECT id FROM badges WHERE name = $1`,
		badgeName,
	).Scan(&badgeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("badge not found: %s", badgeName)
		}
		return nil, fmt.Errorf("finding badge: %w", err)
	}

	return r.AwardBadge(ctx, userID, badgeID)
}

// GetBadgeProgress returns progress toward all badges for a user
func (r *BadgeRepository) GetBadgeProgress(ctx context.Context, userID uuid.UUID, stats *UserStats) ([]model.BadgeProgress, error) {
	// Get all badges
	badges, err := r.GetAllBadges(ctx)
	if err != nil {
		return nil, err
	}

	// Get user's earned badges
	earnedBadges, err := r.GetUserBadges(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Create a map of earned badge IDs to earned time
	earnedMap := make(map[uuid.UUID]model.UserBadge)
	for _, ub := range earnedBadges {
		earnedMap[ub.BadgeID] = ub
	}

	var progress []model.BadgeProgress
	for _, badge := range badges {
		bp := model.BadgeProgress{
			Badge:         badge,
			RequiredValue: badge.RequirementValue,
		}

		// Check if earned
		if ub, ok := earnedMap[badge.ID]; ok {
			bp.IsEarned = true
			bp.EarnedAt = &ub.EarnedAt
			bp.CurrentValue = badge.RequirementValue
			bp.ProgressPercent = 100
		} else {
			// Calculate progress based on requirement type
			bp.CurrentValue = stats.GetValueForRequirement(badge.RequirementType)
			if badge.RequirementValue > 0 {
				bp.ProgressPercent = (bp.CurrentValue / badge.RequirementValue) * 100
				if bp.ProgressPercent > 100 {
					bp.ProgressPercent = 100
				}
			}
		}

		progress = append(progress, bp)
	}

	return progress, nil
}

// CountUserBadges returns the count of badges earned by a user
func (r *BadgeRepository) CountUserBadges(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM user_badges WHERE user_id = $1`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting badges: %w", err)
	}
	return count, nil
}

// UserStats holds statistics used for badge calculations
type UserStats struct {
	TransactionCount  int
	BudgetCount       int
	GoalCount         int
	TotalSaved        float64
	StreakDays        int
	MonthsUnderBudget int
	CurrencyCount     int
	SubscriptionCount int
	AIUsageCount      int
}

// GetValueForRequirement returns the stat value for a given requirement type
func (s *UserStats) GetValueForRequirement(reqType string) float64 {
	switch reqType {
	case model.BadgeReqTransactionCount:
		return float64(s.TransactionCount)
	case model.BadgeReqBudgetCount:
		return float64(s.BudgetCount)
	case model.BadgeReqGoalCount:
		return float64(s.GoalCount)
	case model.BadgeReqTotalSaved:
		return s.TotalSaved
	case model.BadgeReqStreakDays:
		return float64(s.StreakDays)
	case model.BadgeReqMonthsUnderBudget:
		return float64(s.MonthsUnderBudget)
	case model.BadgeReqCurrencyCount:
		return float64(s.CurrencyCount)
	case model.BadgeReqSubscriptionCount:
		return float64(s.SubscriptionCount)
	case model.BadgeReqAIUsage:
		return float64(s.AIUsageCount)
	default:
		return 0
	}
}
