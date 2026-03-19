package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

// AggregatedTypeTotal holds aggregated transaction totals by type and currency.
type AggregatedTypeTotal struct {
	Type     string
	Currency string
	Total    float64
}

// AggregatedCategoryTotal holds aggregated debit totals by category and currency.
type AggregatedCategoryTotal struct {
	Category string
	Currency string
	Total    float64
	Count    int
}

// AggregatedMonthlyTypeTotal holds monthly aggregated totals by type and currency.
type AggregatedMonthlyTypeTotal struct {
	Period   time.Time
	Type     string
	Currency string
	Total    float64
}

func signedTransactionBalanceDelta(txType string, amount float64) float64 {
	switch txType {
	case model.TransactionTypeCredit:
		return amount
	case model.TransactionTypeDebit:
		return -amount
	default:
		return 0
	}
}

func buildTransactionUpdateBalanceDeltas(oldTx *model.Transaction, newType string, newAmount float64, newCurrency string) map[string]float64 {
	deltas := map[string]float64{}

	addDelta := func(currency string, delta float64) {
		if delta == 0 {
			return
		}
		deltas[currency] += delta
		if deltas[currency] == 0 {
			delete(deltas, currency)
		}
	}

	addDelta(oldTx.Currency, -signedTransactionBalanceDelta(oldTx.Type, oldTx.Amount))
	addDelta(newCurrency, signedTransactionBalanceDelta(newType, newAmount))

	return deltas
}

// CreateTransaction records a new transaction
func (r *WalletRepository) CreateTransaction(ctx context.Context, tx *model.Transaction) error {
	tx.Currency = normalizeWalletCurrencyCode(tx.Currency)
	if tx.ToCurrency != nil {
		normalizedToCurrency := normalizeWalletCurrencyCode(*tx.ToCurrency)
		tx.ToCurrency = &normalizedToCurrency
	}

	query := `
		INSERT INTO transactions (id, user_id, type, amount, currency, to_amount, to_currency, rate, source, ai_extracted_data, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	tx.ID = uuid.New()
	tx.CreatedAt = time.Now()

	_, err := r.pool.Exec(ctx, query,
		tx.ID,
		tx.UserID,
		tx.Type,
		tx.Amount,
		tx.Currency,
		tx.ToAmount,
		tx.ToCurrency,
		tx.Rate,
		tx.Source,
		tx.AIExtractedData,
		tx.Description,
		tx.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("creating transaction: %w", err)
	}

	return nil
}

// GetTransactions retrieves transactions for a user with pagination
func (r *WalletRepository) GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	query := `
		SELECT id, user_id, type, amount, currency, to_amount, to_currency, rate, source, category, icon, ai_extracted_data, description, created_at
		FROM transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("querying transactions: %w", err)
	}
	defer rows.Close()

	var transactions []model.Transaction
	for rows.Next() {
		tx, err := scanTransaction(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning transaction: %w", err)
		}
		transactions = append(transactions, *tx)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating transactions: %w", err)
	}

	return transactions, nil
}

// CountTransactions returns the total number of transactions for a user
func (r *WalletRepository) CountTransactions(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM transactions WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting transactions: %w", err)
	}
	return count, nil
}

// CountDistinctCurrencies returns the number of distinct currencies used in transactions
func (r *WalletRepository) CountDistinctCurrencies(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT UPPER(TRIM(currency))) FROM transactions WHERE user_id = $1`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting currencies: %w", err)
	}
	return count, nil
}

// GetTransactionDates returns distinct dates (as YYYY-MM-DD strings) that have transactions, sorted ascending
func (r *WalletRepository) GetTransactionDates(ctx context.Context, userID uuid.UUID) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT DATE(created_at)::text AS tx_date
		FROM transactions
		WHERE user_id = $1
		ORDER BY tx_date
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("querying transaction dates: %w", err)
	}
	defer rows.Close()

	var dates []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			continue
		}
		dates = append(dates, d)
	}
	return dates, nil
}

// GetTransactionBounds returns the first and last transaction timestamps for a user.
func (r *WalletRepository) GetTransactionBounds(ctx context.Context, userID uuid.UUID) (*time.Time, *time.Time, error) {
	var first pgtype.Timestamptz
	var last pgtype.Timestamptz

	err := r.pool.QueryRow(ctx, `
		SELECT MIN(created_at), MAX(created_at)
		FROM transactions
		WHERE user_id = $1
	`, userID).Scan(&first, &last)
	if err != nil {
		return nil, nil, fmt.Errorf("querying transaction bounds: %w", err)
	}

	var firstTime *time.Time
	if first.Valid {
		t := first.Time
		firstTime = &t
	}

	var lastTime *time.Time
	if last.Valid {
		t := last.Time
		lastTime = &t
	}

	return firstTime, lastTime, nil
}

// GetTransactionsFiltered retrieves transactions for a user with filters
func (r *WalletRepository) GetTransactionsFiltered(ctx context.Context, userID uuid.UUID, filter *model.TransactionFilter, limit, offset int) ([]model.Transaction, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 10000 {
		limit = 10000
	}

	// Build dynamic query
	query := `
		SELECT id, user_id, type, amount, currency, to_amount, to_currency, rate, source, category, icon, ai_extracted_data, description, created_at
		FROM transactions
		WHERE user_id = $1
	`
	countQuery := `SELECT COUNT(*) FROM transactions WHERE user_id = $1`

	args := []interface{}{userID}
	argCount := 1

	// Add filters
	if filter != nil {
		if filter.Category != "" {
			argCount++
			query += fmt.Sprintf(" AND category = $%d", argCount)
			countQuery += fmt.Sprintf(" AND category = $%d", argCount)
			args = append(args, filter.Category)
		}
		if filter.Type != "" {
			argCount++
			query += fmt.Sprintf(" AND type = $%d", argCount)
			countQuery += fmt.Sprintf(" AND type = $%d", argCount)
			args = append(args, filter.Type)
		}
		if filter.Currency != "" {
			normalizedCurrency := normalizeWalletCurrencyCode(filter.Currency)
			argCount++
			query += fmt.Sprintf(" AND UPPER(TRIM(currency)) = $%d", argCount)
			countQuery += fmt.Sprintf(" AND UPPER(TRIM(currency)) = $%d", argCount)
			args = append(args, normalizedCurrency)
		}
		if filter.Search != "" {
			argCount++
			query += fmt.Sprintf(" AND (description ILIKE $%d OR category ILIKE $%d)", argCount, argCount)
			countQuery += fmt.Sprintf(" AND (description ILIKE $%d OR category ILIKE $%d)", argCount, argCount)
			args = append(args, "%"+filter.Search+"%")
		}
		// Prefer exact timestamps when provided. Fallback to date-only filters otherwise.
		if filter.FromTimestamp != "" {
			argCount++
			query += fmt.Sprintf(" AND created_at >= $%d", argCount)
			countQuery += fmt.Sprintf(" AND created_at >= $%d", argCount)
			args = append(args, filter.FromTimestamp)
		} else if filter.FromDate != "" {
			argCount++
			query += fmt.Sprintf(" AND created_at >= $%d", argCount)
			countQuery += fmt.Sprintf(" AND created_at >= $%d", argCount)
			args = append(args, filter.FromDate)
		}
		if filter.ToTimestamp != "" {
			argCount++
			query += fmt.Sprintf(" AND created_at <= $%d", argCount)
			countQuery += fmt.Sprintf(" AND created_at <= $%d", argCount)
			args = append(args, filter.ToTimestamp)
		} else if filter.ToDate != "" {
			argCount++
			query += fmt.Sprintf(" AND created_at <= $%d", argCount)
			countQuery += fmt.Sprintf(" AND created_at <= $%d", argCount)
			args = append(args, filter.ToDate+"T23:59:59Z")
		}
	}

	// Get total count
	var total int
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("counting transactions: %w", err)
	}

	// Add ordering and pagination
	query += " ORDER BY created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount+1, argCount+2)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying transactions: %w", err)
	}
	defer rows.Close()

	var transactions []model.Transaction
	for rows.Next() {
		tx, err := scanTransaction(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scanning transaction: %w", err)
		}
		transactions = append(transactions, *tx)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating transactions: %w", err)
	}

	return transactions, total, nil
}

// GetTypeTotalsByCurrency returns aggregated transaction totals by type and currency for a date range.
func (r *WalletRepository) GetTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]AggregatedTypeTotal, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT type, UPPER(TRIM(currency)) AS currency, COALESCE(SUM(amount), 0)::float8 AS total
		FROM transactions
		WHERE user_id = $1
			AND created_at >= $2
			AND created_at <= $3
		GROUP BY type, UPPER(TRIM(currency))
	`, userID, from, to)
	if err != nil {
		return nil, fmt.Errorf("querying type totals: %w", err)
	}
	defer rows.Close()

	totals := make([]AggregatedTypeTotal, 0)
	for rows.Next() {
		var row AggregatedTypeTotal
		if err := rows.Scan(&row.Type, &row.Currency, &row.Total); err != nil {
			return nil, fmt.Errorf("scanning type total: %w", err)
		}
		totals = append(totals, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating type totals: %w", err)
	}
	return totals, nil
}

// GetCategoryTotalsByCurrency returns aggregated debit totals by category and currency for a date range.
func (r *WalletRepository) GetCategoryTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time) ([]AggregatedCategoryTotal, error) {
	rows, err := r.pool.Query(ctx, `
			SELECT
				COALESCE(NULLIF(BTRIM(category), ''), 'other') AS category,
				UPPER(TRIM(currency)) AS currency,
				COALESCE(SUM(amount), 0)::float8 AS total,
				COUNT(*)::int AS count
			FROM transactions
			WHERE user_id = $1
				AND type = 'debit'
				AND created_at >= $2
				AND created_at <= $3
			GROUP BY COALESCE(NULLIF(BTRIM(category), ''), 'other'), UPPER(TRIM(currency))
	`, userID, from, to)
	if err != nil {
		return nil, fmt.Errorf("querying category totals: %w", err)
	}
	defer rows.Close()

	totals := make([]AggregatedCategoryTotal, 0)
	for rows.Next() {
		var row AggregatedCategoryTotal
		if err := rows.Scan(&row.Category, &row.Currency, &row.Total, &row.Count); err != nil {
			return nil, fmt.Errorf("scanning category total: %w", err)
		}
		totals = append(totals, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating category totals: %w", err)
	}
	return totals, nil
}

// GetMonthlyTypeTotalsByCurrency returns monthly aggregated totals by type and currency for a date range.
func (r *WalletRepository) GetMonthlyTypeTotalsByCurrency(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) ([]AggregatedMonthlyTypeTotal, error) {
	rows, err := r.pool.Query(ctx, `
			SELECT
				DATE_TRUNC('month', created_at AT TIME ZONE $4)::date AS period,
				type,
				UPPER(TRIM(currency)) AS currency,
				COALESCE(SUM(amount), 0)::float8 AS total
			FROM transactions
			WHERE user_id = $1
				AND created_at >= $2
				AND created_at <= $3
			GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE $4)::date, type, UPPER(TRIM(currency))
			ORDER BY period ASC
		`, userID, from, to, timeZone)
	if err != nil {
		return nil, fmt.Errorf("querying monthly type totals: %w", err)
	}
	defer rows.Close()

	totals := make([]AggregatedMonthlyTypeTotal, 0)
	for rows.Next() {
		var row AggregatedMonthlyTypeTotal
		if err := rows.Scan(&row.Period, &row.Type, &row.Currency, &row.Total); err != nil {
			return nil, fmt.Errorf("scanning monthly type total: %w", err)
		}
		totals = append(totals, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating monthly type totals: %w", err)
	}
	return totals, nil
}

// CountActiveTransactionDays returns the number of distinct days with at least one transaction in the range.
func (r *WalletRepository) CountActiveTransactionDays(ctx context.Context, userID uuid.UUID, from, to time.Time, timeZone string) (int, error) {
	var dayCount int
	if err := r.pool.QueryRow(ctx, `
			SELECT COUNT(DISTINCT (created_at AT TIME ZONE $4)::date)::int
			FROM transactions
			WHERE user_id = $1
				AND created_at >= $2
			AND created_at <= $3
	`, userID, from, to, timeZone).Scan(&dayCount); err != nil {
		return 0, fmt.Errorf("counting active transaction days: %w", err)
	}
	return dayCount, nil
}

// GetTransaction retrieves a single transaction by ID
func (r *WalletRepository) GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*model.Transaction, error) {
	query := `
		SELECT id, user_id, type, amount, currency, to_amount, to_currency, rate, source, category, icon, ai_extracted_data, description, created_at
		FROM transactions
		WHERE id = $1 AND user_id = $2
	`

	tx, err := scanTransaction(r.pool.QueryRow(ctx, query, txID, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, fmt.Errorf("getting transaction: %w", err)
	}

	return tx, nil
}

// AddTransactionAtomic performs a balance update and transaction creation atomically
func (r *WalletRepository) AddTransactionAtomic(ctx context.Context, userID uuid.UUID, txType string, amount float64, currency, source, description, category, icon string, aiData json.RawMessage) (*model.Transaction, error) {
	currency = normalizeWalletCurrencyCode(currency)

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			log.Error().Err(rbErr).Msg("Failed to rollback AddTransactionAtomic")
		}
	}()

	now := time.Now()

	// Calculate delta
	delta := amount
	if txType == "debit" {
		delta = -amount
	}

	// Check current balance for debits with row-level lock
	if txType == "debit" {
		currentBalance, exists, err := r.lockBalanceForUpdate(ctx, tx, userID, currency)
		if err != nil {
			return nil, fmt.Errorf("checking balance: %w", err)
		}
		if !exists {
			log.Debug().
				Str("user_id", userID.String()).
				Str("currency", currency).
				Msg("no balance record found for debit")
		} else {
			log.Debug().
				Str("user_id", userID.String()).
				Str("currency", currency).
				Float64("balance", currentBalance).
				Float64("amount", amount).
				Msg("balance check")
		}

		if currentBalance < amount {
			return nil, ErrInsufficientBalance
		}
	}

	if err := r.applyBalanceDelta(ctx, tx, userID, currency, delta, now, txType != "debit"); err != nil {
		return nil, err
	}
	log.Debug().
		Str("user_id", userID.String()).
		Str("currency", currency).
		Float64("delta", delta).
		Msg("balance updated")

	// Create transaction record
	transaction := &model.Transaction{
		ID:              uuid.New(),
		UserID:          userID,
		Type:            txType,
		Amount:          amount,
		Currency:        currency,
		Source:          source,
		Description:     description,
		Category:        category,
		Icon:            icon,
		AIExtractedData: aiData,
		CreatedAt:       now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, user_id, type, amount, currency, source, category, icon, ai_extracted_data, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, transaction.ID, transaction.UserID, transaction.Type, transaction.Amount, transaction.Currency,
		transaction.Source, transaction.Category, transaction.Icon, transaction.AIExtractedData, transaction.Description, transaction.CreatedAt)
	if err != nil {
		log.Error().Err(err).Msg("transaction record insert failed")
		return nil, fmt.Errorf("recording transaction: %w", err)
	}
	log.Debug().Str("transaction_id", transaction.ID.String()).Msg("transaction recorded")

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("transaction commit failed")
		return nil, fmt.Errorf("committing transaction: %w", err)
	}
	log.Debug().Str("transaction_id", transaction.ID.String()).Msg("transaction committed")

	return transaction, nil
}

// AddCrossCurrencyTransactionAtomic performs a cross-currency transaction atomically
// txAmount/txCurrency = what the user sees (e.g., paid 100 TRY for coffee)
// walletAmount/walletCurrency = what affects the balance (e.g., deducted 3 USD from wallet)
func (r *WalletRepository) AddCrossCurrencyTransactionAtomic(ctx context.Context, userID uuid.UUID, txType string,
	txAmount float64, txCurrency string,
	walletAmount float64, walletCurrency string,
	rate float64, source, description, category, icon string, aiData json.RawMessage) (*model.Transaction, error) {
	txCurrency = normalizeWalletCurrencyCode(txCurrency)
	walletCurrency = normalizeWalletCurrencyCode(walletCurrency)

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			log.Error().Err(rbErr).Msg("Failed to rollback AddCrossCurrencyTransactionAtomic")
		}
	}()

	now := time.Now()

	// Calculate delta for wallet currency
	delta := walletAmount
	if txType == "debit" {
		delta = -walletAmount
	}

	// Check current balance for debits with row-level lock
	if txType == "debit" {
		currentBalance, exists, err := r.lockBalanceForUpdate(ctx, tx, userID, walletCurrency)
		if err != nil {
			return nil, fmt.Errorf("checking balance: %w", err)
		}
		if !exists {
			log.Debug().
				Str("user_id", userID.String()).
				Str("currency", walletCurrency).
				Msg("no balance record found for debit")
		}
		if currentBalance < walletAmount {
			return nil, ErrInsufficientBalance
		}
	}

	if err := r.applyBalanceDelta(ctx, tx, userID, walletCurrency, delta, now, txType != "debit"); err != nil {
		return nil, err
	}

	// Create transaction record with both currencies
	// Store transaction currency in Currency field, wallet currency in ToCurrency field
	// Rate stores the conversion rate from transaction currency to wallet currency
	transaction := &model.Transaction{
		ID:              uuid.New(),
		UserID:          userID,
		Type:            txType,
		Amount:          txAmount,        // Transaction amount (e.g., 100 TRY)
		Currency:        txCurrency,      // Transaction currency (e.g., TRY)
		ToAmount:        &walletAmount,   // Wallet amount (e.g., 3 USD)
		ToCurrency:      &walletCurrency, // Wallet currency (e.g., USD)
		Rate:            &rate,           // Conversion rate
		Source:          source,
		Description:     description,
		Category:        category,
		Icon:            icon,
		AIExtractedData: aiData,
		CreatedAt:       now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, user_id, type, amount, currency, to_amount, to_currency, rate, source, category, icon, ai_extracted_data, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`, transaction.ID, transaction.UserID, transaction.Type, transaction.Amount, transaction.Currency,
		transaction.ToAmount, transaction.ToCurrency, transaction.Rate, transaction.Source,
		transaction.Category, transaction.Icon, transaction.AIExtractedData, transaction.Description, transaction.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("recording transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return transaction, nil
}

// DeleteTransactionAtomic deletes a transaction and reverses its balance impact atomically
func (r *WalletRepository) DeleteTransactionAtomic(ctx context.Context, userID, txID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			log.Error().Err(rbErr).Msg("Failed to rollback DeleteTransactionAtomic")
		}
	}()

	// Get the transaction to reverse
	var txType, currency string
	var amount float64
	var toAmount *float64
	var toCurrency *string

	err = tx.QueryRow(ctx, `
		SELECT type, amount, currency, to_amount, to_currency
		FROM transactions
		WHERE id = $1 AND user_id = $2
	`, txID, userID).Scan(&txType, &amount, &currency, &toAmount, &toCurrency)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrTransactionNotFound
		}
		return fmt.Errorf("getting transaction: %w", err)
	}
	currency = normalizeWalletCurrencyCode(currency)
	if toCurrency != nil {
		normalizedToCurrency := normalizeWalletCurrencyCode(*toCurrency)
		toCurrency = &normalizedToCurrency
	}

	now := time.Now()

	// Reverse the balance impact based on transaction type
	var balanceErr error
	switch txType {
	case model.TransactionTypeCredit:
		// Original was credit (added money), so subtract

		// Handle cross-currency credit (added to wallet in ToCurrency)
		targetAmount := amount
		targetCurrency := currency
		if toAmount != nil && toCurrency != nil {
			targetAmount = *toAmount
			targetCurrency = *toCurrency
		}

		currentBalance, _, err := r.lockBalanceForUpdate(ctx, tx, userID, targetCurrency)
		if err != nil {
			return fmt.Errorf("checking balance: %w", err)
		}
		if currentBalance < targetAmount {
			return ErrInsufficientBalance
		}
		balanceErr = r.applyBalanceDelta(ctx, tx, userID, targetCurrency, -targetAmount, now, false)
	case model.TransactionTypeDebit:
		// Original was debit (removed money), so add back

		// Handle cross-currency debit (removed from wallet in ToCurrency)
		targetAmount := amount
		targetCurrency := currency
		if toAmount != nil && toCurrency != nil {
			targetAmount = *toAmount
			targetCurrency = *toCurrency
		}

		balanceErr = r.applyBalanceDelta(ctx, tx, userID, targetCurrency, targetAmount, now, true)
	case model.TransactionTypeConvert:
		// Reverse conversion: add back to source, subtract from target
		balanceErr = r.applyBalanceDelta(ctx, tx, userID, currency, amount, now, true)
		if balanceErr != nil {
			break
		}
		if toAmount != nil && toCurrency != nil {
			targetBalance, _, err := r.lockBalanceForUpdate(ctx, tx, userID, *toCurrency)
			if err != nil {
				return fmt.Errorf("checking target balance: %w", err)
			}
			if targetBalance < *toAmount {
				return ErrInsufficientBalance
			}
			balanceErr = r.applyBalanceDelta(ctx, tx, userID, *toCurrency, -*toAmount, now, false)
		}
	}
	if balanceErr != nil {
		if errors.Is(balanceErr, ErrInsufficientBalance) {
			return ErrInsufficientBalance
		}
		return fmt.Errorf("reversing balance: %w", balanceErr)
	}

	// Delete the transaction
	result, err := tx.Exec(ctx, `
		DELETE FROM transactions WHERE id = $1 AND user_id = $2
	`, txID, userID)
	if err != nil {
		return fmt.Errorf("deleting transaction: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrTransactionNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing deletion: %w", err)
	}

	return nil
}

// UpdateTransactionAtomic updates a transaction and adjusts the balance accordingly
func (r *WalletRepository) UpdateTransactionAtomic(ctx context.Context, userID, txID uuid.UUID, req *model.UpdateTransactionRequest) (*model.Transaction, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			log.Error().Err(rbErr).Msg("Failed to rollback UpdateTransactionAtomic")
		}
	}()

	// Get the current transaction
	var oldTx model.Transaction
	var category, icon *string
	var toAmount *float64
	var toCurrency *string

	err = tx.QueryRow(ctx, `
		SELECT id, user_id, type, amount, currency, to_amount, to_currency, category, icon, description
		FROM transactions
		WHERE id = $1 AND user_id = $2
		FOR UPDATE
	`, txID, userID).Scan(&oldTx.ID, &oldTx.UserID, &oldTx.Type, &oldTx.Amount, &oldTx.Currency, &toAmount, &toCurrency, &category, &icon, &oldTx.Description)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTransactionNotFound
		}
		return nil, fmt.Errorf("getting transaction: %w", err)
	}
	if category != nil {
		oldTx.Category = *category
	}
	if icon != nil {
		oldTx.Icon = *icon
	}
	oldTx.Currency = normalizeWalletCurrencyCode(oldTx.Currency)
	if toCurrency != nil {
		normalizedToCurrency := normalizeWalletCurrencyCode(*toCurrency)
		toCurrency = &normalizedToCurrency
	}

	// Don't allow editing conversion transactions
	if oldTx.Type == "convert" {
		return nil, errors.New("cannot edit conversion transactions")
	}

	// Check if it's a cross-currency transaction (has ToAmount/ToCurrency but not convert type)
	isCrossCurrency := toAmount != nil && toCurrency != nil

	// For cross-currency transactions, block editing of amount, currency, or type
	if isCrossCurrency {
		if (req.Amount > 0 && req.Amount != oldTx.Amount) ||
			(req.Currency != "" && req.Currency != oldTx.Currency) ||
			(req.Type != "" && req.Type != oldTx.Type) {
			return nil, errors.New("cannot edit amount, currency, or type of cross-currency transactions")
		}
	}

	now := time.Now()

	// Determine new values (use old values if not specified in request)
	newType := oldTx.Type
	if req.Type != "" {
		newType = req.Type
	}
	newAmount := oldTx.Amount
	if req.Amount > 0 {
		newAmount = req.Amount
	}
	newCurrency := oldTx.Currency
	if req.Currency != "" {
		newCurrency = normalizeWalletCurrencyCode(req.Currency)
	}
	newCategory := oldTx.Category
	if req.Category != "" {
		newCategory = req.Category
	}
	newIcon := oldTx.Icon
	if req.Icon != "" {
		newIcon = req.Icon
	}
	newDescription := oldTx.Description
	if req.Description != "" {
		newDescription = req.Description
	}

	// Calculate balance adjustments ONLY if critical fields changed
	// Since we blocked these for cross-currency, we know we are dealing with single-currency here
	// if critical fields changed.

	// If it's cross-currency, we skipped the check above, so newAmount == oldTx.Amount etc.
	// So we can skip balance updates entirely if it is cross-currency OR if no critical fields changed.

	criticalFieldsChanged := newType != oldTx.Type || newAmount != oldTx.Amount || newCurrency != oldTx.Currency

	if criticalFieldsChanged {
		deltas := buildTransactionUpdateBalanceDeltas(&oldTx, newType, newAmount, newCurrency)
		affectedCurrencies := make([]string, 0, len(deltas))
		for currency := range deltas {
			affectedCurrencies = append(affectedCurrencies, currency)
		}
		sort.Strings(affectedCurrencies)

		for _, currency := range affectedCurrencies {
			currentBalance, exists, err := r.lockBalanceForUpdate(ctx, tx, userID, currency)
			if err != nil {
				return nil, fmt.Errorf("checking balance: %w", err)
			}
			delta := deltas[currency]
			if delta < 0 && (!exists || currentBalance < -delta) {
				return nil, ErrInsufficientBalance
			}
		}

		for _, currency := range affectedCurrencies {
			delta := deltas[currency]
			if err := r.applyBalanceDelta(ctx, tx, userID, currency, delta, now, delta > 0); err != nil {
				if errors.Is(err, ErrInsufficientBalance) {
					return nil, ErrInsufficientBalance
				}
				return nil, fmt.Errorf("applying balance adjustment: %w", err)
			}
		}
	}

	// Update the transaction record
	_, err = tx.Exec(ctx, `
		UPDATE transactions
		SET type = $1, amount = $2, currency = $3, category = $4, icon = $5, description = $6
		WHERE id = $7 AND user_id = $8
	`, newType, newAmount, newCurrency, newCategory, newIcon, newDescription, txID, userID)
	if err != nil {
		return nil, fmt.Errorf("updating transaction: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing update: %w", err)
	}

	// Return the updated transaction
	return r.GetTransaction(ctx, userID, txID)
}

// TransactionForML represents a minimal transaction for ML forecasting
type TransactionForML struct {
	CreatedAt time.Time
	Type      string
	Amount    float64
	Category  string
}

// GetTransactionsForForecasting retrieves transactions for ML forecasting
func (r *WalletRepository) GetTransactionsForForecasting(ctx context.Context, userID uuid.UUID, days int) ([]TransactionForML, error) {
	if days <= 0 {
		days = 90
	}

	startDate := time.Now().AddDate(0, 0, -days)

	query := `
		SELECT created_at, type, amount, COALESCE(category, 'uncategorized') as category
		FROM transactions
		WHERE user_id = $1 AND created_at >= $2
		ORDER BY created_at ASC
	`

	rows, err := r.pool.Query(ctx, query, userID, startDate)
	if err != nil {
		return nil, fmt.Errorf("querying transactions for forecasting: %w", err)
	}
	defer rows.Close()

	var transactions []TransactionForML
	for rows.Next() {
		var t TransactionForML
		if err := rows.Scan(&t.CreatedAt, &t.Type, &t.Amount, &t.Category); err != nil {
			return nil, fmt.Errorf("scanning transaction: %w", err)
		}
		transactions = append(transactions, t)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating transactions: %w", err)
	}

	return transactions, nil
}
