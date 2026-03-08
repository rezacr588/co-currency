package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/rezacr588/currency-converter/internal/model"
)

type LoanRepository struct {
	pool *pgxpool.Pool
}

func NewLoanRepository(pool *pgxpool.Pool) *LoanRepository {
	return &LoanRepository{pool: pool}
}

func (r *LoanRepository) Create(ctx context.Context, userID string, req model.CreateLoanRequest) (*model.Loan, error) {
	query := `
		INSERT INTO loans (user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date)
		VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)
		RETURNING id, user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date, status, created_at, updated_at`

	var loan model.Loan
	err := r.pool.QueryRow(ctx, query,
		userID,
		req.Type,
		req.Name,
		req.Description,
		req.PrincipalAmount,
		req.Currency,
		req.InterestRate,
		req.Counterparty,
		req.DueDate,
	).Scan(
		&loan.ID,
		&loan.UserID,
		&loan.Type,
		&loan.Name,
		&loan.Description,
		&loan.PrincipalAmount,
		&loan.RemainingAmount,
		&loan.Currency,
		&loan.InterestRate,
		&loan.Counterparty,
		&loan.DueDate,
		&loan.Status,
		&loan.CreatedAt,
		&loan.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create loan: %w", err)
	}

	return &loan, nil
}

func (r *LoanRepository) GetByID(ctx context.Context, id string) (*model.Loan, error) {
	query := `
		SELECT id, user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date, status, created_at, updated_at
		FROM loans
		WHERE id = $1`

	var loan model.Loan
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&loan.ID,
		&loan.UserID,
		&loan.Type,
		&loan.Name,
		&loan.Description,
		&loan.PrincipalAmount,
		&loan.RemainingAmount,
		&loan.Currency,
		&loan.InterestRate,
		&loan.Counterparty,
		&loan.DueDate,
		&loan.Status,
		&loan.CreatedAt,
		&loan.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get loan: %w", err)
	}

	return &loan, nil
}

func (r *LoanRepository) GetAllByUser(ctx context.Context, userID string, status string, loanType string) ([]model.Loan, error) {
	query := `
		SELECT id, user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date, status, created_at, updated_at
		FROM loans
		WHERE user_id = $1`
	args := []interface{}{userID}
	argIndex := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}

	if loanType != "" {
		query += fmt.Sprintf(" AND type = $%d", argIndex)
		args = append(args, loanType)
		argIndex++
	}

	query += " ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get loans: %w", err)
	}
	defer rows.Close()

	var loans []model.Loan
	for rows.Next() {
		var loan model.Loan
		if err := rows.Scan(
			&loan.ID,
			&loan.UserID,
			&loan.Type,
			&loan.Name,
			&loan.Description,
			&loan.PrincipalAmount,
			&loan.RemainingAmount,
			&loan.Currency,
			&loan.InterestRate,
			&loan.Counterparty,
			&loan.DueDate,
			&loan.Status,
			&loan.CreatedAt,
			&loan.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan loan: %w", err)
		}
		loans = append(loans, loan)
	}

	return loans, nil
}

func (r *LoanRepository) Update(ctx context.Context, id string, req model.UpdateLoanRequest) (*model.Loan, error) {
	query := `
		UPDATE loans SET updated_at = NOW()`
	args := []interface{}{}
	argIndex := 1

	if req.Name != "" {
		query += fmt.Sprintf(", name = $%d", argIndex)
		args = append(args, req.Name)
		argIndex++
	}
	if req.Description != "" {
		query += fmt.Sprintf(", description = $%d", argIndex)
		args = append(args, req.Description)
		argIndex++
	}
	if req.InterestRate != nil {
		query += fmt.Sprintf(", interest_rate = $%d", argIndex)
		args = append(args, *req.InterestRate)
		argIndex++
	}
	if req.Counterparty != "" {
		query += fmt.Sprintf(", counterparty = $%d", argIndex)
		args = append(args, req.Counterparty)
		argIndex++
	}
	if req.DueDate != nil {
		query += fmt.Sprintf(", due_date = $%d", argIndex)
		args = append(args, req.DueDate)
		argIndex++
	}
	if req.Status != "" {
		query += fmt.Sprintf(", status = $%d", argIndex)
		args = append(args, req.Status)
		argIndex++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIndex)
	args = append(args, id)
	query += ` RETURNING id, user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date, status, created_at, updated_at`

	var loan model.Loan
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&loan.ID,
		&loan.UserID,
		&loan.Type,
		&loan.Name,
		&loan.Description,
		&loan.PrincipalAmount,
		&loan.RemainingAmount,
		&loan.Currency,
		&loan.InterestRate,
		&loan.Counterparty,
		&loan.DueDate,
		&loan.Status,
		&loan.CreatedAt,
		&loan.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to update loan: %w", err)
	}

	return &loan, nil
}

func (r *LoanRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM loans WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete loan: %w", err)
	}
	return nil
}

func (r *LoanRepository) UpdateRemainingAmount(ctx context.Context, id string, amount float64) error {
	query := `
		UPDATE loans
		SET remaining_amount = remaining_amount - $1,
			updated_at = NOW(),
			status = CASE WHEN remaining_amount - $1 <= 0 THEN 'paid_off' ELSE status END
		WHERE id = $2`

	_, err := r.pool.Exec(ctx, query, amount, id)
	if err != nil {
		return fmt.Errorf("failed to update remaining amount: %w", err)
	}
	return nil
}

func (r *LoanRepository) CreatePayment(ctx context.Context, loanID string, req model.CreatePaymentRequest, currency string) (*model.LoanPayment, error) {
	query := `
		INSERT INTO loan_payments (loan_id, amount, currency, payment_type, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, loan_id, amount, currency, payment_type, notes, created_at`

	var payment model.LoanPayment
	err := r.pool.QueryRow(ctx, query, loanID, req.Amount, currency, req.PaymentType, req.Notes).Scan(
		&payment.ID,
		&payment.LoanID,
		&payment.Amount,
		&payment.Currency,
		&payment.PaymentType,
		&payment.Notes,
		&payment.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	return &payment, nil
}

func (r *LoanRepository) GetPaymentsByLoan(ctx context.Context, loanID string) ([]model.LoanPayment, error) {
	query := `
		SELECT id, loan_id, amount, currency, payment_type, notes, created_at
		FROM loan_payments
		WHERE loan_id = $1
		ORDER BY created_at DESC`

	rows, err := r.pool.Query(ctx, query, loanID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payments: %w", err)
	}
	defer rows.Close()

	var payments []model.LoanPayment
	for rows.Next() {
		var payment model.LoanPayment
		if err := rows.Scan(
			&payment.ID,
			&payment.LoanID,
			&payment.Amount,
			&payment.Currency,
			&payment.PaymentType,
			&payment.Notes,
			&payment.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}
		payments = append(payments, payment)
	}

	return payments, nil
}

func (r *LoanRepository) GetSummary(ctx context.Context, userID string, currency string) (*model.LoanSummary, error) {
	query := `
		SELECT
			COALESCE(SUM(CASE WHEN type = 'borrowed' THEN principal_amount ELSE 0 END), 0) as total_borrowed,
			COALESCE(SUM(CASE WHEN type = 'lent' THEN principal_amount ELSE 0 END), 0) as total_lent,
			COALESCE(SUM(CASE WHEN type = 'borrowed' AND status = 'active' THEN remaining_amount ELSE 0 END), 0) as remaining_borrowed,
			COALESCE(SUM(CASE WHEN type = 'lent' AND status = 'active' THEN remaining_amount ELSE 0 END), 0) as remaining_lent,
			COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
		FROM loans
		WHERE user_id = $1 AND currency = $2`

	var summary model.LoanSummary
	summary.Currency = currency

	err := r.pool.QueryRow(ctx, query, userID, currency).Scan(
		&summary.TotalBorrowed,
		&summary.TotalLent,
		&summary.RemainingBorrowed,
		&summary.RemainingLent,
		&summary.ActiveLoansCount,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get loan summary: %w", err)
	}

	// Net debt = what you owe - what you're owed
	summary.NetDebt = summary.RemainingBorrowed - summary.RemainingLent

	return &summary, nil
}

func (r *LoanRepository) GetUpcomingDue(ctx context.Context, userID string, daysAhead int) ([]model.Loan, error) {
	query := `
		SELECT id, user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date, status, created_at, updated_at
		FROM loans
		WHERE user_id = $1 AND status = 'active' AND due_date IS NOT NULL AND due_date <= NOW() + INTERVAL '1 day' * $2
		ORDER BY due_date ASC`

	rows, err := r.pool.Query(ctx, query, userID, daysAhead)
	if err != nil {
		return nil, fmt.Errorf("failed to get upcoming loans: %w", err)
	}
	defer rows.Close()

	var loans []model.Loan
	for rows.Next() {
		var loan model.Loan
		if err := rows.Scan(
			&loan.ID,
			&loan.UserID,
			&loan.Type,
			&loan.Name,
			&loan.Description,
			&loan.PrincipalAmount,
			&loan.RemainingAmount,
			&loan.Currency,
			&loan.InterestRate,
			&loan.Counterparty,
			&loan.DueDate,
			&loan.Status,
			&loan.CreatedAt,
			&loan.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan loan: %w", err)
		}
		loans = append(loans, loan)
	}

	return loans, nil
}

// MakePaymentTx atomically creates a payment record and updates the loan's remaining amount
// within a single database transaction, using SELECT FOR UPDATE to prevent concurrent
// payment race conditions that could cause negative balances.
func (r *LoanRepository) MakePaymentTx(ctx context.Context, loanID, userID string, req model.CreatePaymentRequest) (*model.LoanPayment, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			log.Error().Err(rbErr).Msg("Failed to rollback MakePaymentTx")
		}
	}()

	// Lock the loan row to prevent concurrent modifications
	lockQuery := `
		SELECT id, user_id, type, name, description, principal_amount, remaining_amount, currency, interest_rate, counterparty, due_date, status, created_at, updated_at
		FROM loans
		WHERE id = $1
		FOR UPDATE`

	var loan model.Loan
	err = tx.QueryRow(ctx, lockQuery, loanID).Scan(
		&loan.ID,
		&loan.UserID,
		&loan.Type,
		&loan.Name,
		&loan.Description,
		&loan.PrincipalAmount,
		&loan.RemainingAmount,
		&loan.Currency,
		&loan.InterestRate,
		&loan.Counterparty,
		&loan.DueDate,
		&loan.Status,
		&loan.CreatedAt,
		&loan.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("loan not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to lock loan: %w", err)
	}

	// Validate ownership
	if loan.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	// Validate loan status
	if loan.Status != model.LoanStatusActive {
		return nil, fmt.Errorf("cannot make payment on inactive loan")
	}

	// Validate payment amount won't cause negative remaining balance
	if req.PaymentType == model.PaymentTypePayment || req.PaymentType == model.PaymentTypeForgiveness {
		if req.Amount > loan.RemainingAmount {
			return nil, fmt.Errorf("payment amount %.2f exceeds remaining balance %.2f", req.Amount, loan.RemainingAmount)
		}
	}

	// Create payment record within the transaction
	paymentQuery := `
		INSERT INTO loan_payments (loan_id, amount, currency, payment_type, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, loan_id, amount, currency, payment_type, notes, created_at`

	var payment model.LoanPayment
	err = tx.QueryRow(ctx, paymentQuery, loanID, req.Amount, loan.Currency, req.PaymentType, req.Notes).Scan(
		&payment.ID,
		&payment.LoanID,
		&payment.Amount,
		&payment.Currency,
		&payment.PaymentType,
		&payment.Notes,
		&payment.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	// Update remaining amount within the same transaction
	if req.PaymentType == model.PaymentTypePayment || req.PaymentType == model.PaymentTypeForgiveness {
		updateQuery := `
			UPDATE loans
			SET remaining_amount = remaining_amount - $1,
				updated_at = NOW(),
				status = CASE WHEN remaining_amount - $1 <= 0 THEN 'paid_off' ELSE status END
			WHERE id = $2`

		_, err = tx.Exec(ctx, updateQuery, req.Amount, loanID)
		if err != nil {
			return nil, fmt.Errorf("failed to update remaining amount: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit payment transaction: %w", err)
	}

	return &payment, nil
}
