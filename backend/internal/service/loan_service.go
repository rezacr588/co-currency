package service

import (
	"context"
	"fmt"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

type LoanService struct {
	repo *repository.LoanRepository
}

func NewLoanService(repo *repository.LoanRepository) *LoanService {
	return &LoanService{repo: repo}
}

func (s *LoanService) CreateLoan(ctx context.Context, userID string, req model.CreateLoanRequest) (*model.Loan, error) {
	return s.repo.Create(ctx, userID, req)
}

func (s *LoanService) GetLoan(ctx context.Context, id, userID string) (*model.Loan, error) {
	loan, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if loan == nil {
		return nil, nil
	}
	if loan.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}
	return loan, nil
}

func (s *LoanService) GetAllLoans(ctx context.Context, userID string, status string, loanType string) ([]model.Loan, error) {
	return s.repo.GetAllByUser(ctx, userID, status, loanType)
}

func (s *LoanService) UpdateLoan(ctx context.Context, id, userID string, req model.UpdateLoanRequest) (*model.Loan, error) {
	loan, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if loan == nil {
		return nil, fmt.Errorf("loan not found")
	}
	if loan.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	return s.repo.Update(ctx, id, req)
}

func (s *LoanService) DeleteLoan(ctx context.Context, id, userID string) error {
	loan, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if loan == nil {
		return fmt.Errorf("loan not found")
	}
	if loan.UserID != userID {
		return fmt.Errorf("unauthorized")
	}

	return s.repo.Delete(ctx, id)
}

func (s *LoanService) MakePayment(ctx context.Context, loanID, userID string, req model.CreatePaymentRequest) (*model.LoanPayment, error) {
	// Use atomic transaction to prevent concurrent payments from causing negative balances.
	// All validation (ownership, status, amount) and mutations (create payment, update remaining)
	// happen within a single DB transaction with SELECT FOR UPDATE row locking.
	return s.repo.MakePaymentTx(ctx, loanID, userID, req)
}

func (s *LoanService) GetPayments(ctx context.Context, loanID, userID string) ([]model.LoanPayment, error) {
	loan, err := s.repo.GetByID(ctx, loanID)
	if err != nil {
		return nil, err
	}
	if loan == nil {
		return nil, fmt.Errorf("loan not found")
	}
	if loan.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	return s.repo.GetPaymentsByLoan(ctx, loanID)
}

func (s *LoanService) GetSummary(ctx context.Context, userID, currency string) (*model.LoanSummary, error) {
	if currency == "" {
		currency = "USD"
	}
	return s.repo.GetSummary(ctx, userID, currency)
}

func (s *LoanService) GetUpcomingDue(ctx context.Context, userID string, daysAhead int) ([]model.Loan, error) {
	if daysAhead <= 0 {
		daysAhead = 30
	}
	return s.repo.GetUpcomingDue(ctx, userID, daysAhead)
}

// GetLoansForAI returns loan data formatted for AI context
func (s *LoanService) GetLoansForAI(ctx context.Context, userID string) (map[string]interface{}, error) {
	loans, err := s.repo.GetAllByUser(ctx, userID, "", "")
	if err != nil {
		return nil, err
	}

	activeLoans := make([]map[string]interface{}, 0)
	totalDebt := 0.0
	totalReceivable := 0.0

	for _, loan := range loans {
		if loan.Status == model.LoanStatusActive {
			loanInfo := map[string]interface{}{
				"name":             loan.Name,
				"type":             loan.Type,
				"remaining_amount": loan.RemainingAmount,
				"currency":         loan.Currency,
				"counterparty":     loan.Counterparty,
			}
			if loan.DueDate != nil {
				loanInfo["due_date"] = loan.DueDate.Format("2006-01-02")
			}
			activeLoans = append(activeLoans, loanInfo)

			if loan.Type == model.LoanTypeBorrowed {
				totalDebt += loan.RemainingAmount
			} else {
				totalReceivable += loan.RemainingAmount
			}
		}
	}

	return map[string]interface{}{
		"active_loans":     activeLoans,
		"total_debt":       totalDebt,
		"total_receivable": totalReceivable,
		"net_debt":         totalDebt - totalReceivable,
		"loan_count":       len(activeLoans),
	}, nil
}
