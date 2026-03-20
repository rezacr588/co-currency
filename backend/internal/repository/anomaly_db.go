package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AnomalyRepository handles database operations for detected anomalies
type AnomalyRepository struct {
	pool *pgxpool.Pool
}

// NewAnomalyRepository creates a new AnomalyRepository
func NewAnomalyRepository(pool *pgxpool.Pool) *AnomalyRepository {
	return &AnomalyRepository{pool: pool}
}

// StoredAnomaly represents a detected anomaly stored in the database
type StoredAnomaly struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	DetectedAt      time.Time       `json:"detected_at"`
	TransactionDate time.Time       `json:"transaction_date"`
	Category        string          `json:"category"`
	Amount          float64         `json:"amount"`
	ExpectedMin     *float64        `json:"expected_min,omitempty"`
	ExpectedMax     *float64        `json:"expected_max,omitempty"`
	ZScore          float64         `json:"z_score"`
	Severity        string          `json:"severity"`
	Message         string          `json:"message"`
	Acknowledged    bool            `json:"acknowledged"`
	AcknowledgedAt  *time.Time      `json:"acknowledged_at,omitempty"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
}

// SaveAnomaly stores a detected anomaly
func (r *AnomalyRepository) SaveAnomaly(ctx context.Context, a *StoredAnomaly) error {
	query := `
		INSERT INTO anomalies (user_id, transaction_date, category, amount, expected_min, expected_max, z_score, severity, message, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, detected_at
	`
	return r.pool.QueryRow(ctx, query,
		a.UserID, a.TransactionDate, a.Category, a.Amount,
		a.ExpectedMin, a.ExpectedMax, a.ZScore, a.Severity, a.Message, a.Metadata,
	).Scan(&a.ID, &a.DetectedAt)
}

// SaveAnomalies bulk inserts multiple anomalies
func (r *AnomalyRepository) SaveAnomalies(ctx context.Context, anomalies []StoredAnomaly) error {
	if len(anomalies) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for i := range anomalies {
		query := `
			INSERT INTO anomalies (user_id, transaction_date, category, amount, expected_min, expected_max, z_score, severity, message, metadata)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, detected_at
		`
		a := &anomalies[i]
		err := tx.QueryRow(ctx, query,
			a.UserID, a.TransactionDate, a.Category, a.Amount,
			a.ExpectedMin, a.ExpectedMax, a.ZScore, a.Severity, a.Message, a.Metadata,
		).Scan(&a.ID, &a.DetectedAt)
		if err != nil {
			return fmt.Errorf("inserting anomaly: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// GetUnacknowledgedAnomalies retrieves all unacknowledged anomalies for a user
func (r *AnomalyRepository) GetUnacknowledgedAnomalies(ctx context.Context, userID uuid.UUID) ([]StoredAnomaly, error) {
	query := `
		SELECT id, user_id, detected_at, transaction_date, category, amount, 
		       expected_min, expected_max, z_score, severity, message, 
		       acknowledged, acknowledged_at, metadata
		FROM anomalies
		WHERE user_id = $1 AND acknowledged = FALSE
		ORDER BY detected_at DESC
	`
	return r.queryAnomalies(ctx, query, userID)
}

// GetRecentAnomalies retrieves recent anomalies for a user
func (r *AnomalyRepository) GetRecentAnomalies(ctx context.Context, userID uuid.UUID, days int, limit int) ([]StoredAnomaly, error) {
	if days <= 0 {
		days = 30
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	query := `
		SELECT id, user_id, detected_at, transaction_date, category, amount, 
		       expected_min, expected_max, z_score, severity, message, 
		       acknowledged, acknowledged_at, metadata
		FROM anomalies
		WHERE user_id = $1 AND detected_at >= NOW() - INTERVAL '1 day' * $2
		ORDER BY detected_at DESC
		LIMIT $3
	`
	return r.queryAnomalies(ctx, query, userID, days, limit)
}

// GetAnomaliesBySeverity retrieves anomalies filtered by severity
func (r *AnomalyRepository) GetAnomaliesBySeverity(ctx context.Context, userID uuid.UUID, severity string, limit int) ([]StoredAnomaly, error) {
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, user_id, detected_at, transaction_date, category, amount, 
		       expected_min, expected_max, z_score, severity, message, 
		       acknowledged, acknowledged_at, metadata
		FROM anomalies
		WHERE user_id = $1 AND severity = $2
		ORDER BY detected_at DESC
		LIMIT $3
	`
	return r.queryAnomalies(ctx, query, userID, severity, limit)
}

// AcknowledgeAnomaly marks an anomaly as acknowledged
func (r *AnomalyRepository) AcknowledgeAnomaly(ctx context.Context, userID uuid.UUID, anomalyID uuid.UUID) error {
	query := `
		UPDATE anomalies
		SET acknowledged = TRUE, acknowledged_at = NOW()
		WHERE id = $1 AND user_id = $2
	`
	result, err := r.pool.Exec(ctx, query, anomalyID, userID)
	if err != nil {
		return fmt.Errorf("acknowledging anomaly: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("anomaly not found")
	}
	return nil
}

// AcknowledgeAllAnomalies marks all unacknowledged anomalies as acknowledged
func (r *AnomalyRepository) AcknowledgeAllAnomalies(ctx context.Context, userID uuid.UUID) (int64, error) {
	query := `
		UPDATE anomalies
		SET acknowledged = TRUE, acknowledged_at = NOW()
		WHERE user_id = $1 AND acknowledged = FALSE
	`
	result, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return 0, fmt.Errorf("acknowledging all anomalies: %w", err)
	}
	return result.RowsAffected(), nil
}

// GetAnomalyStats retrieves anomaly statistics for a user
func (r *AnomalyRepository) GetAnomalyStats(ctx context.Context, userID uuid.UUID, days int) (*AnomalyStats, error) {
	if days <= 0 {
		days = 30
	}

	query := `
		SELECT 
			COUNT(*) as total_count,
			COUNT(*) FILTER (WHERE acknowledged = FALSE) as unacknowledged_count,
			COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
			COUNT(*) FILTER (WHERE severity = 'high') as high_count,
			COUNT(*) FILTER (WHERE severity = 'medium') as medium_count,
			COUNT(*) FILTER (WHERE severity = 'low') as low_count,
			COALESCE(AVG(z_score), 0) as avg_z_score
		FROM anomalies
		WHERE user_id = $1 AND detected_at >= NOW() - INTERVAL '1 day' * $2
	`

	var stats AnomalyStats
	err := r.pool.QueryRow(ctx, query, userID, days).Scan(
		&stats.TotalCount, &stats.UnacknowledgedCount,
		&stats.CriticalCount, &stats.HighCount, &stats.MediumCount, &stats.LowCount,
		&stats.AvgZScore,
	)
	if err != nil {
		return nil, fmt.Errorf("getting anomaly stats: %w", err)
	}
	stats.Days = days
	return &stats, nil
}

// AnomalyStats holds aggregated anomaly statistics
type AnomalyStats struct {
	Days                int     `json:"days"`
	TotalCount          int     `json:"total_count"`
	UnacknowledgedCount int     `json:"unacknowledged_count"`
	CriticalCount       int     `json:"critical_count"`
	HighCount           int     `json:"high_count"`
	MediumCount         int     `json:"medium_count"`
	LowCount            int     `json:"low_count"`
	AvgZScore           float64 `json:"avg_z_score"`
}

// DeleteOldAnomalies removes anomalies older than the specified days
func (r *AnomalyRepository) DeleteOldAnomalies(ctx context.Context, userID uuid.UUID, olderThanDays int) (int64, error) {
	query := `
		DELETE FROM anomalies
		WHERE user_id = $1 AND detected_at < NOW() - INTERVAL '1 day' * $2
	`
	result, err := r.pool.Exec(ctx, query, userID, olderThanDays)
	if err != nil {
		return 0, fmt.Errorf("deleting old anomalies: %w", err)
	}
	return result.RowsAffected(), nil
}

// queryAnomalies is a helper function to query anomalies with different filters
func (r *AnomalyRepository) queryAnomalies(ctx context.Context, query string, args ...interface{}) ([]StoredAnomaly, error) {
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying anomalies: %w", err)
	}
	defer rows.Close()

	var anomalies []StoredAnomaly
	for rows.Next() {
		var a StoredAnomaly
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.DetectedAt, &a.TransactionDate, &a.Category, &a.Amount,
			&a.ExpectedMin, &a.ExpectedMax, &a.ZScore, &a.Severity, &a.Message,
			&a.Acknowledged, &a.AcknowledgedAt, &a.Metadata,
		); err != nil {
			return nil, fmt.Errorf("scanning anomaly: %w", err)
		}
		anomalies = append(anomalies, a)
	}

	return anomalies, rows.Err()
}
