package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

// InflationRepository handles inflation rate data persistence
type InflationRepository struct {
	db *Database
}

// NewInflationRepository creates a new InflationRepository
func NewInflationRepository(db *Database) *InflationRepository {
	return &InflationRepository{db: db}
}

// SaveRate upserts an inflation rate record
func (r *InflationRepository) SaveRate(ctx context.Context, rate model.InflationRate) error {
	query := `
		INSERT INTO inflation_rates (country_code, currency_code, year, month, annual_rate, monthly_rate, cpi_index, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (country_code, year, month)
		DO UPDATE SET
			currency_code = EXCLUDED.currency_code,
			annual_rate = EXCLUDED.annual_rate,
			monthly_rate = EXCLUDED.monthly_rate,
			cpi_index = EXCLUDED.cpi_index,
			source = EXCLUDED.source,
			fetched_at = NOW()
	`
	_, err := r.db.Pool().Exec(ctx, query,
		rate.CountryCode, rate.CurrencyCode, rate.Year, rate.Month,
		rate.AnnualRate, rate.MonthlyRate, rate.CPIIndex, rate.Source,
	)
	return err
}

// UpsertLatest updates or inserts the latest inflation rate for a currency
func (r *InflationRepository) UpsertLatest(ctx context.Context, latest model.InflationLatest) error {
	query := `
		INSERT INTO inflation_latest (currency_code, country_code, annual_rate, monthly_rate, source, data_date)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (currency_code)
		DO UPDATE SET
			country_code = EXCLUDED.country_code,
			annual_rate = EXCLUDED.annual_rate,
			monthly_rate = EXCLUDED.monthly_rate,
			source = EXCLUDED.source,
			data_date = EXCLUDED.data_date,
			updated_at = NOW()
	`
	_, err := r.db.Pool().Exec(ctx, query,
		latest.CurrencyCode, latest.CountryCode, latest.AnnualRate,
		latest.MonthlyRate, latest.Source, latest.DataDate,
	)
	return err
}

// GetLatestByCurrency returns the latest inflation rate for a specific currency
func (r *InflationRepository) GetLatestByCurrency(ctx context.Context, currencyCode string) (*model.InflationLatest, error) {
	query := `
		SELECT currency_code, country_code, annual_rate, monthly_rate, source, data_date, updated_at
		FROM inflation_latest
		WHERE currency_code = $1
	`
	row := r.db.Pool().QueryRow(ctx, query, currencyCode)

	var latest model.InflationLatest
	err := row.Scan(
		&latest.CurrencyCode, &latest.CountryCode, &latest.AnnualRate,
		&latest.MonthlyRate, &latest.Source, &latest.DataDate, &latest.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &latest, nil
}

// GetAllLatest returns all latest inflation rates
func (r *InflationRepository) GetAllLatest(ctx context.Context) ([]model.InflationLatest, error) {
	query := `
		SELECT currency_code, country_code, annual_rate, monthly_rate, source, data_date, updated_at
		FROM inflation_latest
		ORDER BY currency_code
	`
	rows, err := r.db.Pool().Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []model.InflationLatest
	for rows.Next() {
		var latest model.InflationLatest
		if err := rows.Scan(
			&latest.CurrencyCode, &latest.CountryCode, &latest.AnnualRate,
			&latest.MonthlyRate, &latest.Source, &latest.DataDate, &latest.UpdatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, latest)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

// GetHistoricalRates returns historical inflation rates for a country
func (r *InflationRepository) GetHistoricalRates(ctx context.Context, countryCode string, fromYear, toYear int) ([]model.InflationRate, error) {
	query := `
		SELECT id, country_code, currency_code, year, month, annual_rate, monthly_rate, cpi_index, source, fetched_at, created_at
		FROM inflation_rates
		WHERE country_code = $1 AND year >= $2 AND year <= $3
		ORDER BY year DESC, month DESC
	`
	rows, err := r.db.Pool().Query(ctx, query, countryCode, fromYear, toYear)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []model.InflationRate
	for rows.Next() {
		var rate model.InflationRate
		if err := rows.Scan(
			&rate.ID, &rate.CountryCode, &rate.CurrencyCode, &rate.Year, &rate.Month,
			&rate.AnnualRate, &rate.MonthlyRate, &rate.CPIIndex, &rate.Source,
			&rate.FetchedAt, &rate.CreatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, rate)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

// SaveWealthAlert saves a wealth alert for a user
func (r *InflationRepository) SaveWealthAlert(ctx context.Context, alert model.WealthAlert) error {
	query := `
		INSERT INTO wealth_alerts (user_id, alert_type, currency_code, threshold_value, message)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.db.Pool().Exec(ctx, query,
		alert.UserID, alert.AlertType, alert.CurrencyCode,
		alert.ThresholdValue, alert.Message,
	)
	return err
}

// GetUnreadAlerts returns unread alerts for a user
func (r *InflationRepository) GetUnreadAlerts(ctx context.Context, userID uuid.UUID) ([]model.WealthAlert, error) {
	query := `
		SELECT id, user_id, alert_type, currency_code, threshold_value, message, is_read, created_at
		FROM wealth_alerts
		WHERE user_id = $1 AND is_read = FALSE
		ORDER BY created_at DESC
		LIMIT 50
	`
	rows, err := r.db.Pool().Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []model.WealthAlert
	for rows.Next() {
		var alert model.WealthAlert
		if err := rows.Scan(
			&alert.ID, &alert.UserID, &alert.AlertType, &alert.CurrencyCode,
			&alert.ThresholdValue, &alert.Message, &alert.IsRead, &alert.CreatedAt,
		); err != nil {
			return nil, err
		}
		alerts = append(alerts, alert)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return alerts, nil
}

// MarkAlertRead marks a specific alert as read, scoped to user for security
func (r *InflationRepository) MarkAlertRead(ctx context.Context, alertID uuid.UUID, userID uuid.UUID) error {
	query := `UPDATE wealth_alerts SET is_read = TRUE WHERE id = $1 AND user_id = $2`
	_, err := r.db.Pool().Exec(ctx, query, alertID, userID)
	return err
}

// HasUnreadAlert checks if an unread alert of the given type already exists for a user+currency
func (r *InflationRepository) HasUnreadAlert(ctx context.Context, userID uuid.UUID, alertType, currencyCode string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM wealth_alerts WHERE user_id = $1 AND alert_type = $2 AND currency_code = $3 AND is_read = FALSE)`
	var exists bool
	err := r.db.Pool().QueryRow(ctx, query, userID, alertType, currencyCode).Scan(&exists)
	return exists, err
}

// CleanupOldRates removes inflation rate records older than the given duration
func (r *InflationRepository) CleanupOldRates(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoff := time.Now().Add(-olderThan)
	query := `DELETE FROM inflation_rates WHERE created_at < $1`
	result, err := r.db.Pool().Exec(ctx, query, cutoff)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// GetInflationRateForCurrency returns the inflation rate for a currency, falling back to defaults
func (r *InflationRepository) GetInflationRateForCurrency(ctx context.Context, currencyCode string) float64 {
	latest, err := r.GetLatestByCurrency(ctx, currencyCode)
	if err == nil && latest != nil {
		return latest.AnnualRate
	}

	// Fallback to default rates
	if rate, ok := model.DefaultInflationRates[currencyCode]; ok {
		return rate
	}

	log.Debug().Str("currency", currencyCode).Msg("No inflation rate found, using global average")
	return 3.5 // Global average fallback
}
