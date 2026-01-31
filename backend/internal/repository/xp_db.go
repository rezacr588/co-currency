package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// XPRepository handles XP data access
type XPRepository struct {
	pool *pgxpool.Pool
}

// NewXPRepository creates a new XPRepository
func NewXPRepository(pool *pgxpool.Pool) *XPRepository {
	return &XPRepository{pool: pool}
}

// GetUserXP retrieves user's XP stats
func (r *XPRepository) GetUserXP(ctx context.Context, userID uuid.UUID) (*model.UserXP, error) {
	var xp model.UserXP
	var lastActivityDate *time.Time

	err := r.pool.QueryRow(ctx, `
		SELECT user_id, total_xp, current_level, xp_to_next_level, streak_days,
		       last_activity_date, created_at, updated_at
		FROM user_xp
		WHERE user_id = $1
	`, userID).Scan(
		&xp.UserID, &xp.TotalXP, &xp.CurrentLevel, &xp.XPToNextLevel,
		&xp.StreakDays, &lastActivityDate, &xp.CreatedAt, &xp.UpdatedAt,
	)

	if err != nil {
		// Return default if not found
		return &model.UserXP{
			UserID:        userID,
			TotalXP:       0,
			CurrentLevel:  1,
			XPToNextLevel: 100,
			StreakDays:    0,
		}, nil
	}

	xp.LastActivityDate = lastActivityDate
	return &xp, nil
}

// UpsertUserXP creates or updates user XP
func (r *XPRepository) UpsertUserXP(ctx context.Context, xp *model.UserXP) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO user_xp (user_id, total_xp, current_level, xp_to_next_level, streak_days, last_activity_date, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			total_xp = EXCLUDED.total_xp,
			current_level = EXCLUDED.current_level,
			xp_to_next_level = EXCLUDED.xp_to_next_level,
			streak_days = EXCLUDED.streak_days,
			last_activity_date = EXCLUDED.last_activity_date,
			updated_at = NOW()
	`, xp.UserID, xp.TotalXP, xp.CurrentLevel, xp.XPToNextLevel, xp.StreakDays, xp.LastActivityDate)

	return err
}

// AddXPTransaction logs an XP award
func (r *XPRepository) AddXPTransaction(ctx context.Context, tx *model.XPTransaction) error {
	tx.ID = uuid.New()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO xp_transactions (id, user_id, amount, reason, source_type, source_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, tx.ID, tx.UserID, tx.Amount, tx.Reason, tx.SourceType, tx.SourceID)

	return err
}

// GetXPTransactions gets recent XP transactions for a user
func (r *XPRepository) GetXPTransactions(ctx context.Context, userID uuid.UUID, limit int) ([]model.XPTransaction, error) {
	if limit <= 0 {
		limit = 20
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, amount, reason, source_type, source_id, created_at
		FROM xp_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []model.XPTransaction
	for rows.Next() {
		var tx model.XPTransaction
		err := rows.Scan(&tx.ID, &tx.UserID, &tx.Amount, &tx.Reason, &tx.SourceType, &tx.SourceID, &tx.CreatedAt)
		if err != nil {
			continue
		}
		transactions = append(transactions, tx)
	}

	return transactions, nil
}

// GetDailyReward retrieves today's daily reward for a user
func (r *XPRepository) GetDailyReward(ctx context.Context, userID uuid.UUID, date time.Time) (*model.DailyReward, error) {
	var reward model.DailyReward
	dateStr := date.Format("2006-01-02")

	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, login_date, consecutive_days, xp_awarded, bonus_awarded, created_at
		FROM daily_rewards
		WHERE user_id = $1 AND login_date = $2
	`, userID, dateStr).Scan(
		&reward.ID, &reward.UserID, &reward.LoginDate, &reward.ConsecutiveDays,
		&reward.XPAwarded, &reward.BonusAwarded, &reward.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &reward, nil
}

// GetLastDailyReward gets the user's most recent daily reward
func (r *XPRepository) GetLastDailyReward(ctx context.Context, userID uuid.UUID) (*model.DailyReward, error) {
	var reward model.DailyReward

	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, login_date, consecutive_days, xp_awarded, bonus_awarded, created_at
		FROM daily_rewards
		WHERE user_id = $1
		ORDER BY login_date DESC
		LIMIT 1
	`, userID).Scan(
		&reward.ID, &reward.UserID, &reward.LoginDate, &reward.ConsecutiveDays,
		&reward.XPAwarded, &reward.BonusAwarded, &reward.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &reward, nil
}

// CreateDailyReward creates a new daily reward record
func (r *XPRepository) CreateDailyReward(ctx context.Context, reward *model.DailyReward) error {
	reward.ID = uuid.New()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO daily_rewards (id, user_id, login_date, consecutive_days, xp_awarded, bonus_awarded, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
	`, reward.ID, reward.UserID, reward.LoginDate.Format("2006-01-02"), reward.ConsecutiveDays, reward.XPAwarded, reward.BonusAwarded)

	return err
}

// GetLeaderboard returns top users by XP
func (r *XPRepository) GetLeaderboard(ctx context.Context, limit int) ([]model.UserXP, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := r.pool.Query(ctx, `
		SELECT x.user_id, x.total_xp, x.current_level, x.streak_days
		FROM user_xp x
		ORDER BY x.total_xp DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.UserXP
	for rows.Next() {
		var xp model.UserXP
		err := rows.Scan(&xp.UserID, &xp.TotalXP, &xp.CurrentLevel, &xp.StreakDays)
		if err != nil {
			continue
		}
		users = append(users, xp)
	}

	return users, nil
}
