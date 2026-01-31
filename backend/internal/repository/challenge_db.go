package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rezacr588/currency-converter/internal/model"
)

// ChallengeRepository handles challenge database operations
type ChallengeRepository struct {
	db *Database
}

// NewChallengeRepository creates a new ChallengeRepository
func NewChallengeRepository(db *Database) *ChallengeRepository {
	return &ChallengeRepository{db: db}
}

// GetAllChallenges returns all active challenges
func (r *ChallengeRepository) GetAllChallenges(ctx context.Context) ([]model.Challenge, error) {
	query := `
		SELECT id, name, description, type, icon, difficulty, duration_days,
			   target_value, target_category, target_percentage, points_reward,
			   is_active, is_featured, created_at
		FROM challenges
		WHERE is_active = true
		ORDER BY is_featured DESC, difficulty, name`

	rows, err := r.db.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying challenges: %w", err)
	}
	defer rows.Close()

	var challenges []model.Challenge
	for rows.Next() {
		c, err := scanChallenge(rows)
		if err != nil {
			return nil, err
		}
		challenges = append(challenges, c)
	}

	return challenges, nil
}

// GetFeaturedChallenges returns featured challenges
func (r *ChallengeRepository) GetFeaturedChallenges(ctx context.Context) ([]model.Challenge, error) {
	query := `
		SELECT id, name, description, type, icon, difficulty, duration_days,
			   target_value, target_category, target_percentage, points_reward,
			   is_active, is_featured, created_at
		FROM challenges
		WHERE is_active = true AND is_featured = true
		ORDER BY difficulty, name`

	rows, err := r.db.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("querying featured challenges: %w", err)
	}
	defer rows.Close()

	var challenges []model.Challenge
	for rows.Next() {
		c, err := scanChallenge(rows)
		if err != nil {
			return nil, err
		}
		challenges = append(challenges, c)
	}

	return challenges, nil
}

// GetChallenge returns a challenge by ID
func (r *ChallengeRepository) GetChallenge(ctx context.Context, id uuid.UUID) (*model.Challenge, error) {
	query := `
		SELECT id, name, description, type, icon, difficulty, duration_days,
			   target_value, target_category, target_percentage, points_reward,
			   is_active, is_featured, created_at
		FROM challenges
		WHERE id = $1`

	row := r.db.pool.QueryRow(ctx, query, id)
	c, err := scanChallengeRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("challenge not found")
		}
		return nil, fmt.Errorf("querying challenge: %w", err)
	}

	return &c, nil
}

// GetChallengesWithUserStatus returns all challenges with user's participation status
func (r *ChallengeRepository) GetChallengesWithUserStatus(ctx context.Context, userID uuid.UUID) ([]model.ChallengeWithUserStatus, error) {
	query := `
		SELECT c.id, c.name, c.description, c.type, c.icon, c.difficulty, c.duration_days,
			   c.target_value, c.target_category, c.target_percentage, c.points_reward,
			   c.is_active, c.is_featured, c.created_at,
			   uc.id as user_challenge_id, uc.status, uc.progress,
			   uc.started_at + (c.duration_days || ' days')::interval as ends_at
		FROM challenges c
		LEFT JOIN user_challenges uc ON c.id = uc.challenge_id
			AND uc.user_id = $1
			AND uc.status = 'active'
		WHERE c.is_active = true
		ORDER BY uc.status IS NOT NULL DESC, c.is_featured DESC, c.difficulty, c.name`

	rows, err := r.db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying challenges with status: %w", err)
	}
	defer rows.Close()

	var result []model.ChallengeWithUserStatus
	for rows.Next() {
		var cws model.ChallengeWithUserStatus
		var targetValue, targetPercentage *float64
		var targetCategory *string
		var userChallengeID *string
		var userStatus *string
		var userProgress *float64
		var endsAt *time.Time

		err := rows.Scan(
			&cws.ID, &cws.Name, &cws.Description, &cws.Type, &cws.Icon,
			&cws.Difficulty, &cws.DurationDays, &targetValue, &targetCategory,
			&targetPercentage, &cws.PointsReward, &cws.IsActive, &cws.IsFeatured,
			&cws.CreatedAt, &userChallengeID, &userStatus, &userProgress, &endsAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning challenge with status: %w", err)
		}

		cws.TargetValue = targetValue
		cws.TargetCategory = targetCategory
		cws.TargetPercentage = targetPercentage
		cws.UserChallengeID = userChallengeID
		if userStatus != nil {
			status := model.UserChallengeStatus(*userStatus)
			cws.UserStatus = &status
		}
		cws.UserProgress = userProgress
		cws.EndsAt = endsAt

		result = append(result, cws)
	}

	return result, nil
}

// JoinChallenge creates a new user challenge entry
func (r *ChallengeRepository) JoinChallenge(ctx context.Context, userID, challengeID uuid.UUID) (*model.UserChallenge, error) {
	// Check if user already has an active challenge
	var exists bool
	err := r.db.pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM user_challenges
			WHERE user_id = $1 AND challenge_id = $2 AND status = 'active'
		)`,
		userID, challengeID,
	).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("checking existing challenge: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("already participating in this challenge")
	}

	var uc model.UserChallenge
	err = r.db.pool.QueryRow(ctx, `
		INSERT INTO user_challenges (user_id, challenge_id, status, progress, current_value, streak_days)
		VALUES ($1, $2, 'active', 0, 0, 0)
		RETURNING id, user_id, challenge_id, status, progress, current_value, started_at, completed_at, streak_days`,
		userID, challengeID,
	).Scan(&uc.ID, &uc.UserID, &uc.ChallengeID, &uc.Status, &uc.Progress, &uc.CurrentValue, &uc.StartedAt, &uc.CompletedAt, &uc.StreakDays)
	if err != nil {
		return nil, fmt.Errorf("joining challenge: %w", err)
	}

	// Fetch the challenge details
	challenge, err := r.GetChallenge(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	uc.Challenge = challenge
	uc.EndsAt = uc.StartedAt.AddDate(0, 0, challenge.DurationDays)

	return &uc, nil
}

// GetUserChallenge returns a specific user challenge
func (r *ChallengeRepository) GetUserChallenge(ctx context.Context, userID, challengeID uuid.UUID) (*model.UserChallenge, error) {
	query := `
		SELECT uc.id, uc.user_id, uc.challenge_id, uc.status, uc.progress, uc.current_value,
			   uc.started_at, uc.completed_at, uc.streak_days,
			   c.id, c.name, c.description, c.type, c.icon, c.difficulty, c.duration_days,
			   c.target_value, c.target_category, c.target_percentage, c.points_reward,
			   c.is_active, c.is_featured, c.created_at
		FROM user_challenges uc
		JOIN challenges c ON uc.challenge_id = c.id
		WHERE uc.user_id = $1 AND uc.challenge_id = $2 AND uc.status = 'active'`

	var uc model.UserChallenge
	var c model.Challenge
	var targetValue, targetPercentage *float64
	var targetCategory *string

	err := r.db.pool.QueryRow(ctx, query, userID, challengeID).Scan(
		&uc.ID, &uc.UserID, &uc.ChallengeID, &uc.Status, &uc.Progress, &uc.CurrentValue,
		&uc.StartedAt, &uc.CompletedAt, &uc.StreakDays,
		&c.ID, &c.Name, &c.Description, &c.Type, &c.Icon, &c.Difficulty, &c.DurationDays,
		&targetValue, &targetCategory, &targetPercentage, &c.PointsReward,
		&c.IsActive, &c.IsFeatured, &c.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user challenge not found")
		}
		return nil, fmt.Errorf("querying user challenge: %w", err)
	}

	c.TargetValue = targetValue
	c.TargetCategory = targetCategory
	c.TargetPercentage = targetPercentage
	uc.Challenge = &c
	uc.EndsAt = uc.StartedAt.AddDate(0, 0, c.DurationDays)

	return &uc, nil
}

// GetUserActiveChallenges returns all active challenges for a user
func (r *ChallengeRepository) GetUserActiveChallenges(ctx context.Context, userID uuid.UUID) ([]model.UserChallenge, error) {
	query := `
		SELECT uc.id, uc.user_id, uc.challenge_id, uc.status, uc.progress, uc.current_value,
			   uc.started_at, uc.completed_at, uc.streak_days,
			   c.id, c.name, c.description, c.type, c.icon, c.difficulty, c.duration_days,
			   c.target_value, c.target_category, c.target_percentage, c.points_reward,
			   c.is_active, c.is_featured, c.created_at
		FROM user_challenges uc
		JOIN challenges c ON uc.challenge_id = c.id
		WHERE uc.user_id = $1 AND uc.status = 'active'
		ORDER BY uc.started_at DESC`

	rows, err := r.db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying active challenges: %w", err)
	}
	defer rows.Close()

	var challenges []model.UserChallenge
	for rows.Next() {
		uc, err := scanUserChallengeWithChallenge(rows)
		if err != nil {
			return nil, err
		}
		challenges = append(challenges, uc)
	}

	return challenges, nil
}

// GetUserChallengeHistory returns all challenges for a user (including completed/failed)
func (r *ChallengeRepository) GetUserChallengeHistory(ctx context.Context, userID uuid.UUID) ([]model.UserChallenge, error) {
	query := `
		SELECT uc.id, uc.user_id, uc.challenge_id, uc.status, uc.progress, uc.current_value,
			   uc.started_at, uc.completed_at, uc.streak_days,
			   c.id, c.name, c.description, c.type, c.icon, c.difficulty, c.duration_days,
			   c.target_value, c.target_category, c.target_percentage, c.points_reward,
			   c.is_active, c.is_featured, c.created_at
		FROM user_challenges uc
		JOIN challenges c ON uc.challenge_id = c.id
		WHERE uc.user_id = $1
		ORDER BY uc.started_at DESC`

	rows, err := r.db.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying challenge history: %w", err)
	}
	defer rows.Close()

	var challenges []model.UserChallenge
	for rows.Next() {
		uc, err := scanUserChallengeWithChallenge(rows)
		if err != nil {
			return nil, err
		}
		challenges = append(challenges, uc)
	}

	return challenges, nil
}

// UpdateUserChallengeProgress updates progress for a user challenge
func (r *ChallengeRepository) UpdateUserChallengeProgress(ctx context.Context, id uuid.UUID, progress, currentValue float64, streakDays int) error {
	_, err := r.db.pool.Exec(ctx, `
		UPDATE user_challenges
		SET progress = $1, current_value = $2, streak_days = $3
		WHERE id = $4`,
		progress, currentValue, streakDays, id,
	)
	if err != nil {
		return fmt.Errorf("updating challenge progress: %w", err)
	}
	return nil
}

// CompleteUserChallenge marks a challenge as completed
func (r *ChallengeRepository) CompleteUserChallenge(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.pool.Exec(ctx, `
		UPDATE user_challenges
		SET status = 'completed', progress = 100, completed_at = NOW()
		WHERE id = $1`,
		id,
	)
	if err != nil {
		return fmt.Errorf("completing challenge: %w", err)
	}
	return nil
}

// FailUserChallenge marks a challenge as failed
func (r *ChallengeRepository) FailUserChallenge(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.pool.Exec(ctx, `
		UPDATE user_challenges
		SET status = 'failed'
		WHERE id = $1`,
		id,
	)
	if err != nil {
		return fmt.Errorf("failing challenge: %w", err)
	}
	return nil
}

// AbandonUserChallenge marks a challenge as abandoned
func (r *ChallengeRepository) AbandonUserChallenge(ctx context.Context, userID, challengeID uuid.UUID) error {
	_, err := r.db.pool.Exec(ctx, `
		UPDATE user_challenges
		SET status = 'abandoned'
		WHERE user_id = $1 AND challenge_id = $2 AND status = 'active'`,
		userID, challengeID,
	)
	if err != nil {
		return fmt.Errorf("abandoning challenge: %w", err)
	}
	return nil
}

// GetUserChallengeStats returns challenge statistics for a user
func (r *ChallengeRepository) GetUserChallengeStats(ctx context.Context, userID uuid.UUID) (*model.ChallengeStats, error) {
	query := `
		SELECT
			COUNT(*) as total_joined,
			COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
			COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
			COUNT(*) FILTER (WHERE status = 'active') as active_challenges,
			COALESCE(SUM(c.points_reward) FILTER (WHERE uc.status = 'completed'), 0) as total_points,
			COALESCE(MAX(uc.streak_days), 0) as longest_streak
		FROM user_challenges uc
		JOIN challenges c ON uc.challenge_id = c.id
		WHERE uc.user_id = $1`

	var stats model.ChallengeStats
	err := r.db.pool.QueryRow(ctx, query, userID).Scan(
		&stats.TotalJoined,
		&stats.TotalCompleted,
		&stats.TotalFailed,
		&stats.ActiveChallenges,
		&stats.TotalPoints,
		&stats.LongestStreak,
	)
	if err != nil {
		return nil, fmt.Errorf("querying challenge stats: %w", err)
	}

	if stats.TotalJoined > 0 {
		stats.CompletionRate = float64(stats.TotalCompleted) / float64(stats.TotalJoined) * 100
	}

	// Get current streak from active challenges
	var currentStreak int
	err = r.db.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(streak_days), 0)
		FROM user_challenges
		WHERE user_id = $1 AND status = 'active'`,
		userID,
	).Scan(&currentStreak)
	if err != nil {
		return nil, fmt.Errorf("querying current streak: %w", err)
	}
	stats.CurrentStreak = currentStreak

	return &stats, nil
}

// CheckExpiredChallenges finds and marks expired challenges as failed
func (r *ChallengeRepository) CheckExpiredChallenges(ctx context.Context) (int, error) {
	result, err := r.db.pool.Exec(ctx, `
		UPDATE user_challenges uc
		SET status = 'failed'
		FROM challenges c
		WHERE uc.challenge_id = c.id
		  AND uc.status = 'active'
		  AND uc.started_at + (c.duration_days || ' days')::interval < NOW()`)
	if err != nil {
		return 0, fmt.Errorf("checking expired challenges: %w", err)
	}
	return int(result.RowsAffected()), nil
}

// Helper functions for scanning

func scanChallenge(rows pgx.Rows) (model.Challenge, error) {
	var c model.Challenge
	var targetValue, targetPercentage *float64
	var targetCategory *string

	err := rows.Scan(
		&c.ID, &c.Name, &c.Description, &c.Type, &c.Icon,
		&c.Difficulty, &c.DurationDays, &targetValue, &targetCategory,
		&targetPercentage, &c.PointsReward, &c.IsActive, &c.IsFeatured, &c.CreatedAt,
	)
	if err != nil {
		return c, fmt.Errorf("scanning challenge: %w", err)
	}

	c.TargetValue = targetValue
	c.TargetCategory = targetCategory
	c.TargetPercentage = targetPercentage

	return c, nil
}

func scanChallengeRow(row pgx.Row) (model.Challenge, error) {
	var c model.Challenge
	var targetValue, targetPercentage *float64
	var targetCategory *string

	err := row.Scan(
		&c.ID, &c.Name, &c.Description, &c.Type, &c.Icon,
		&c.Difficulty, &c.DurationDays, &targetValue, &targetCategory,
		&targetPercentage, &c.PointsReward, &c.IsActive, &c.IsFeatured, &c.CreatedAt,
	)
	if err != nil {
		return c, err
	}

	c.TargetValue = targetValue
	c.TargetCategory = targetCategory
	c.TargetPercentage = targetPercentage

	return c, nil
}

func scanUserChallengeWithChallenge(rows pgx.Rows) (model.UserChallenge, error) {
	var uc model.UserChallenge
	var c model.Challenge
	var targetValue, targetPercentage *float64
	var targetCategory *string

	err := rows.Scan(
		&uc.ID, &uc.UserID, &uc.ChallengeID, &uc.Status, &uc.Progress, &uc.CurrentValue,
		&uc.StartedAt, &uc.CompletedAt, &uc.StreakDays,
		&c.ID, &c.Name, &c.Description, &c.Type, &c.Icon, &c.Difficulty, &c.DurationDays,
		&targetValue, &targetCategory, &targetPercentage, &c.PointsReward,
		&c.IsActive, &c.IsFeatured, &c.CreatedAt,
	)
	if err != nil {
		return uc, fmt.Errorf("scanning user challenge: %w", err)
	}

	c.TargetValue = targetValue
	c.TargetCategory = targetCategory
	c.TargetPercentage = targetPercentage
	uc.Challenge = &c
	uc.EndsAt = uc.StartedAt.AddDate(0, 0, c.DurationDays)

	return uc, nil
}
