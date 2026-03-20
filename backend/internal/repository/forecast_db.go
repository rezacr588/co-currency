package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ForecastRepository handles database operations for forecasts
type ForecastRepository struct {
	pool *pgxpool.Pool
}

// NewForecastRepository creates a new ForecastRepository
func NewForecastRepository(pool *pgxpool.Pool) *ForecastRepository {
	return &ForecastRepository{pool: pool}
}

// Forecast represents a stored forecast
type Forecast struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	Currency        string          `json:"currency"`
	ForecastDate    time.Time       `json:"forecast_date"`
	DaysAhead       int             `json:"days_ahead"`
	Predictions     json.RawMessage `json:"predictions"`
	ConfidenceScore float64         `json:"confidence_score"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// SaveForecast stores a forecast in the database
func (r *ForecastRepository) SaveForecast(ctx context.Context, f *Forecast) error {
	query := `
		INSERT INTO forecasts (user_id, currency, forecast_date, days_ahead, predictions, confidence_score, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, currency, forecast_date, days_ahead) 
		DO UPDATE SET predictions = EXCLUDED.predictions, 
		              confidence_score = EXCLUDED.confidence_score,
		              metadata = EXCLUDED.metadata,
		              created_at = NOW()
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		f.UserID, f.Currency, f.ForecastDate, f.DaysAhead,
		f.Predictions, f.ConfidenceScore, f.Metadata,
	).Scan(&f.ID, &f.CreatedAt)
}

// GetLatestForecast retrieves the most recent forecast for a user and currency
func (r *ForecastRepository) GetLatestForecast(ctx context.Context, userID uuid.UUID, currency string) (*Forecast, error) {
	query := `
		SELECT id, user_id, currency, forecast_date, days_ahead, predictions, confidence_score, metadata, created_at
		FROM forecasts
		WHERE user_id = $1 AND currency = $2
		ORDER BY forecast_date DESC, created_at DESC
		LIMIT 1
	`

	var f Forecast
	err := r.pool.QueryRow(ctx, query, userID, currency).Scan(
		&f.ID, &f.UserID, &f.Currency, &f.ForecastDate, &f.DaysAhead,
		&f.Predictions, &f.ConfidenceScore, &f.Metadata, &f.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting latest forecast: %w", err)
	}
	return &f, nil
}

// GetForecastHistory retrieves forecast history for a user
func (r *ForecastRepository) GetForecastHistory(ctx context.Context, userID uuid.UUID, currency string, limit int) ([]Forecast, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT id, user_id, currency, forecast_date, days_ahead, predictions, confidence_score, metadata, created_at
		FROM forecasts
		WHERE user_id = $1 AND currency = $2
		ORDER BY forecast_date DESC, created_at DESC
		LIMIT $3
	`

	rows, err := r.pool.Query(ctx, query, userID, currency, limit)
	if err != nil {
		return nil, fmt.Errorf("querying forecast history: %w", err)
	}
	defer rows.Close()

	var forecasts []Forecast
	for rows.Next() {
		var f Forecast
		if err := rows.Scan(
			&f.ID, &f.UserID, &f.Currency, &f.ForecastDate, &f.DaysAhead,
			&f.Predictions, &f.ConfidenceScore, &f.Metadata, &f.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning forecast: %w", err)
		}
		forecasts = append(forecasts, f)
	}

	return forecasts, rows.Err()
}

// DeleteOldForecasts removes forecasts older than the specified days
func (r *ForecastRepository) DeleteOldForecasts(ctx context.Context, userID uuid.UUID, olderThanDays int) (int64, error) {
	query := `
		DELETE FROM forecasts
		WHERE user_id = $1 AND created_at < NOW() - INTERVAL '1 day' * $2
	`
	result, err := r.pool.Exec(ctx, query, userID, olderThanDays)
	if err != nil {
		return 0, fmt.Errorf("deleting old forecasts: %w", err)
	}
	return result.RowsAffected(), nil
}
