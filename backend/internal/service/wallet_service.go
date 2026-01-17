package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// WalletService handles wallet operations
type WalletService struct {
	walletRepo      *repository.WalletRepository
	exchangeService *ExchangeService
}

// NewWalletService creates a new WalletService
func NewWalletService(walletRepo *repository.WalletRepository, exchangeService *ExchangeService) *WalletService {
	return &WalletService{
		walletRepo:      walletRepo,
		exchangeService: exchangeService,
	}
}

// GetBalances retrieves all balances for a user
func (s *WalletService) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting balances: %w", err)
	}

	// Return empty slice instead of nil
	if balances == nil {
		balances = []model.WalletBalance{}
	}

	return balances, nil
}

// GetBalance retrieves a specific currency balance
func (s *WalletService) GetBalance(ctx context.Context, userID uuid.UUID, currency string) (*model.WalletBalance, error) {
	balance, err := s.walletRepo.GetBalance(ctx, userID, currency)
	if err != nil {
		if errors.Is(err, repository.ErrBalanceNotFound) {
			// Return zero balance if not found
			return &model.WalletBalance{
				UserID:   userID,
				Currency: currency,
				Balance:  0,
			}, nil
		}
		return nil, fmt.Errorf("getting balance: %w", err)
	}
	return balance, nil
}

// AddTransaction adds a credit or debit transaction
func (s *WalletService) AddTransaction(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest) (*model.Transaction, error) {
	// Validate request
	if req.Type != "credit" && req.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}

	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	if req.Currency == "" {
		return nil, errors.New("currency is required")
	}

	// Calculate delta based on type
	delta := req.Amount
	if req.Type == "debit" {
		delta = -req.Amount
	}

	// Update balance
	_, err := s.walletRepo.UpdateBalance(ctx, userID, req.Currency, delta)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, fmt.Errorf("updating balance: %w", err)
	}

	// Create transaction record
	tx := &model.Transaction{
		UserID:      userID,
		Type:        req.Type,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Source:      "manual",
		Description: req.Description,
	}

	if err := s.walletRepo.CreateTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("creating transaction: %w", err)
	}

	return tx, nil
}

// ConvertBalance converts currency within the wallet
func (s *WalletService) ConvertBalance(ctx context.Context, userID uuid.UUID, req *model.ConvertBalanceRequest) (*model.ConvertBalanceResponse, error) {
	// Validate request
	if req.FromCurrency == "" || req.ToCurrency == "" {
		return nil, errors.New("from_currency and to_currency are required")
	}

	if req.FromCurrency == req.ToCurrency {
		return nil, errors.New("cannot convert to the same currency")
	}

	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	// Get exchange rate using existing converter
	conversion, err := s.exchangeService.Convert(ctx, req.FromCurrency, req.ToCurrency, req.Amount)
	if err != nil {
		return nil, fmt.Errorf("getting exchange rate: %w", err)
	}

	// Execute the conversion atomically
	tx, err := s.walletRepo.ExecuteConversion(ctx, userID,
		req.FromCurrency, req.ToCurrency,
		req.Amount, conversion.Result, conversion.Rate)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, fmt.Errorf("executing conversion: %w", err)
	}

	return &model.ConvertBalanceResponse{
		FromCurrency: req.FromCurrency,
		ToCurrency:   req.ToCurrency,
		FromAmount:   req.Amount,
		ToAmount:     conversion.Result,
		Rate:         conversion.Rate,
		Transaction:  tx,
	}, nil
}

// GetTransactions retrieves transaction history
func (s *WalletService) GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error) {
	transactions, err := s.walletRepo.GetTransactions(ctx, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("getting transactions: %w", err)
	}

	if transactions == nil {
		transactions = []model.Transaction{}
	}

	return transactions, nil
}

// GetWalletSummary retrieves a summary of the user's wallet
func (s *WalletService) GetWalletSummary(ctx context.Context, userID uuid.UUID) (*model.WalletSummary, error) {
	balances, err := s.GetBalances(ctx, userID)
	if err != nil {
		return nil, err
	}

	transactions, err := s.GetTransactions(ctx, userID, 10, 0)
	if err != nil {
		return nil, err
	}

	return &model.WalletSummary{
		Balances:           balances,
		RecentTransactions: transactions,
	}, nil
}

// ApplyAIParsedResult applies the result of AI parsing to the wallet
func (s *WalletService) ApplyAIParsedResult(ctx context.Context, userID uuid.UUID, parsed *model.AIParseResult) (*model.Transaction, error) {
	// Validate
	if parsed.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	if parsed.Currency == "" {
		return nil, errors.New("currency is required")
	}

	if parsed.Type != "credit" && parsed.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}

	// Calculate delta
	delta := parsed.Amount
	if parsed.Type == "debit" {
		delta = -parsed.Amount
	}

	// Update balance
	_, err := s.walletRepo.UpdateBalance(ctx, userID, parsed.Currency, delta)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, fmt.Errorf("updating balance: %w", err)
	}

	// Store the AI extracted data
	aiData, _ := json.Marshal(parsed)

	// Create transaction record
	tx := &model.Transaction{
		UserID:          userID,
		Type:            parsed.Type,
		Amount:          parsed.Amount,
		Currency:        parsed.Currency,
		Source:          "ai_receipt",
		AIExtractedData: aiData,
		Description:     parsed.Description,
	}

	if err := s.walletRepo.CreateTransaction(ctx, tx); err != nil {
		return nil, fmt.Errorf("creating transaction: %w", err)
	}

	return tx, nil
}
