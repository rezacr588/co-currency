package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrBalanceNotFound     = errors.New("balance not found")
	ErrTransactionNotFound = errors.New("transaction not found")
)

type transactionScanner interface {
	Scan(dest ...interface{}) error
}

func scanTransaction(scanner transactionScanner) (*model.Transaction, error) {
	var t model.Transaction
	var aiData []byte
	var category *string
	var icon *string
	var description *string

	if err := scanner.Scan(
		&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Currency,
		&t.ToAmount, &t.ToCurrency, &t.Rate, &t.Source, &category, &icon, &aiData, &description, &t.CreatedAt,
	); err != nil {
		return nil, err
	}

	if aiData != nil {
		t.AIExtractedData = json.RawMessage(aiData)
	}
	if category != nil {
		t.Category = *category
	}
	if icon != nil {
		t.Icon = *icon
	}
	if description != nil {
		t.Description = *description
	}

	return &t, nil
}

// isBalanceConstraintError checks if the error is a CHECK constraint violation for non-negative balance
func isBalanceConstraintError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// PostgreSQL error code 23514 is check_violation
		if pgErr.Code == "23514" && strings.Contains(pgErr.ConstraintName, "non_negative") {
			return true
		}
	}
	return false
}

func (r *WalletRepository) lockBalanceForUpdate(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string) (float64, bool, error) {
	var balance float64
	err := tx.QueryRow(ctx, `
		SELECT balance FROM wallet_balances
		WHERE user_id = $1 AND currency = $2
		FOR UPDATE
	`, userID, currency).Scan(&balance)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return balance, true, nil
}

func (r *WalletRepository) applyBalanceDelta(ctx context.Context, tx pgx.Tx, userID uuid.UUID, currency string, delta float64, now time.Time, allowInsert bool) error {
	var err error
	if allowInsert {
		_, err = tx.Exec(ctx, `
			INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, currency) DO UPDATE SET
				balance = wallet_balances.balance + EXCLUDED.balance,
				updated_at = EXCLUDED.updated_at
		`, uuid.New(), userID, currency, delta, now)
	} else {
		_, err = tx.Exec(ctx, `
			UPDATE wallet_balances
			SET balance = balance + $1, updated_at = $2
			WHERE user_id = $3 AND currency = $4
		`, delta, now, userID, currency)
	}

	if err != nil {
		if isBalanceConstraintError(err) {
			return ErrInsufficientBalance
		}
		return fmt.Errorf("updating balance: %w", err)
	}
	return nil
}

// WalletRepository handles database operations for wallet balances and transactions
type WalletRepository struct {
	pool *pgxpool.Pool
}

// NewWalletRepository creates a new WalletRepository
func NewWalletRepository(db *Database) *WalletRepository {
	return &WalletRepository{pool: db.Pool()}
}

// GetBalances retrieves all balances for a user
func (r *WalletRepository) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	query := `
		SELECT id, user_id, currency, balance, updated_at
		FROM wallet_balances
		WHERE user_id = $1
		ORDER BY currency
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("querying balances: %w", err)
	}
	defer rows.Close()

	var balances []model.WalletBalance
	for rows.Next() {
		var b model.WalletBalance
		if err := rows.Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning balance: %w", err)
		}
		balances = append(balances, b)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating balances: %w", err)
	}

	return balances, nil
}

// GetBalance retrieves a specific currency balance for a user
func (r *WalletRepository) GetBalance(ctx context.Context, userID uuid.UUID, currency string) (*model.WalletBalance, error) {
	query := `
		SELECT id, user_id, currency, balance, updated_at
		FROM wallet_balances
		WHERE user_id = $1 AND currency = $2
	`

	b := &model.WalletBalance{}
	err := r.pool.QueryRow(ctx, query, userID, currency).Scan(
		&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBalanceNotFound
		}
		return nil, fmt.Errorf("getting balance: %w", err)
	}

	return b, nil
}

// UpdateBalance updates or creates a balance for a user
func (r *WalletRepository) UpdateBalance(ctx context.Context, userID uuid.UUID, currency string, delta float64) (*model.WalletBalance, error) {
	// Use upsert with returning
	query := `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, currency) DO UPDATE SET
			balance = wallet_balances.balance + EXCLUDED.balance,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, currency, balance, updated_at
	`

	now := time.Now()
	b := &model.WalletBalance{}

	err := r.pool.QueryRow(ctx, query,
		uuid.New(),
		userID,
		currency,
		delta,
		now,
	).Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("updating balance: %w", err)
	}

	// Check if balance went negative (shouldn't happen for debits)
	if b.Balance < 0 {
		// Rollback by reversing the delta
		_, err := r.pool.Exec(ctx, `
			UPDATE wallet_balances
			SET balance = balance - $1, updated_at = $2
			WHERE user_id = $3 AND currency = $4
		`, delta, now, userID, currency)
		if err != nil {
			return nil, fmt.Errorf("rolling back negative balance: %w", err)
		}
		return nil, ErrInsufficientBalance
	}

	return b, nil
}

// SetBalance sets an absolute balance for a user (used for corrections)
func (r *WalletRepository) SetBalance(ctx context.Context, userID uuid.UUID, currency string, balance float64) (*model.WalletBalance, error) {
	query := `
		INSERT INTO wallet_balances (id, user_id, currency, balance, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, currency) DO UPDATE SET
			balance = EXCLUDED.balance,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, currency, balance, updated_at
	`

	now := time.Now()
	b := &model.WalletBalance{}

	err := r.pool.QueryRow(ctx, query,
		uuid.New(),
		userID,
		currency,
		balance,
		now,
	).Scan(&b.ID, &b.UserID, &b.Currency, &b.Balance, &b.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("setting balance: %w", err)
	}

	return b, nil
}

// CreateTransaction records a new transaction
func (r *WalletRepository) CreateTransaction(ctx context.Context, tx *model.Transaction) error {
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
	err := r.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT currency) FROM transactions WHERE user_id = $1`, userID).Scan(&count)
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
			argCount++
			query += fmt.Sprintf(" AND currency = $%d", argCount)
			countQuery += fmt.Sprintf(" AND currency = $%d", argCount)
			args = append(args, filter.Currency)
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

// ExecuteConversion performs an atomic currency conversion
func (r *WalletRepository) ExecuteConversion(ctx context.Context, userID uuid.UUID, fromCurrency, toCurrency string, fromAmount, toAmount, rate float64) (*model.Transaction, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			log.Error().Err(rbErr).Msg("Failed to rollback ExecuteConversion")
		}
	}()

	now := time.Now()

	// Check if user has sufficient balance with row-level lock to prevent race conditions
	currentBalance, _, err := r.lockBalanceForUpdate(ctx, tx, userID, fromCurrency)
	if err != nil {
		return nil, fmt.Errorf("checking balance: %w", err)
	}
	if currentBalance < fromAmount {
		return nil, ErrInsufficientBalance
	}

	if err := r.applyBalanceDelta(ctx, tx, userID, fromCurrency, -fromAmount, now, false); err != nil {
		if errors.Is(err, ErrInsufficientBalance) {
			return nil, ErrInsufficientBalance
		}
		return nil, fmt.Errorf("debiting source currency: %w", err)
	}

	if err := r.applyBalanceDelta(ctx, tx, userID, toCurrency, toAmount, now, true); err != nil {
		return nil, fmt.Errorf("crediting target currency: %w", err)
	}

	// Record the transaction
	transaction := &model.Transaction{
		ID:         uuid.New(),
		UserID:     userID,
		Type:       model.TransactionTypeConvert,
		Amount:     fromAmount,
		Currency:   fromCurrency,
		ToAmount:   &toAmount,
		ToCurrency: &toCurrency,
		Rate:       &rate,
		Source:     "manual",
		CreatedAt:  now,
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (id, user_id, type, amount, currency, to_amount, to_currency, rate, source, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, transaction.ID, transaction.UserID, transaction.Type, transaction.Amount, transaction.Currency,
		transaction.ToAmount, transaction.ToCurrency, transaction.Rate, transaction.Source, transaction.CreatedAt)
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
		newCurrency = req.Currency
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
		// First, reverse the old transaction's impact
		if oldTx.Type == "credit" {
			currentBalance, _, err := r.lockBalanceForUpdate(ctx, tx, userID, oldTx.Currency)
			if err != nil {
				return nil, fmt.Errorf("checking balance: %w", err)
			}
			if currentBalance < oldTx.Amount {
				return nil, ErrInsufficientBalance
			}
			err = r.applyBalanceDelta(ctx, tx, userID, oldTx.Currency, -oldTx.Amount, now, false)
			if err != nil {
				if errors.Is(err, ErrInsufficientBalance) {
					return nil, ErrInsufficientBalance
				}
				return nil, fmt.Errorf("reversing old balance: %w", err)
			}
		} else if oldTx.Type == "debit" {
			if err := r.applyBalanceDelta(ctx, tx, userID, oldTx.Currency, oldTx.Amount, now, true); err != nil {
				if errors.Is(err, ErrInsufficientBalance) {
					return nil, ErrInsufficientBalance
				}
				return nil, fmt.Errorf("reversing old balance: %w", err)
			}
		}

		// Apply the new transaction's impact
		if newType == "credit" {
			if err := r.applyBalanceDelta(ctx, tx, userID, newCurrency, newAmount, now, true); err != nil {
				if errors.Is(err, ErrInsufficientBalance) {
					return nil, ErrInsufficientBalance
				}
				return nil, fmt.Errorf("applying new balance: %w", err)
			}
		} else if newType == "debit" {
			currentBalance, _, err := r.lockBalanceForUpdate(ctx, tx, userID, newCurrency)
			if err != nil {
				return nil, fmt.Errorf("checking balance: %w", err)
			}
			if currentBalance < newAmount {
				return nil, ErrInsufficientBalance
			}
			if err := r.applyBalanceDelta(ctx, tx, userID, newCurrency, -newAmount, now, false); err != nil {
				if errors.Is(err, ErrInsufficientBalance) {
					return nil, ErrInsufficientBalance
				}
				return nil, fmt.Errorf("applying new balance: %w", err)
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
