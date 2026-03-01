package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

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
