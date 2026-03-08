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
	tagRepo         *repository.TagRepository
}

// NewWalletService creates a new WalletService
func NewWalletService(walletRepo *repository.WalletRepository, exchangeService *ExchangeService) *WalletService {
	return &WalletService{
		walletRepo:      walletRepo,
		exchangeService: exchangeService,
	}
}

func normalizedTransactionCurrencies(req *model.TransactionRequest) (string, string) {
	transactionCurrency := normalizeCurrencyCode(req.Currency)
	walletCurrency := normalizeCurrencyCode(req.WalletCurrency)
	if walletCurrency == "" {
		walletCurrency = transactionCurrency
	}
	return transactionCurrency, walletCurrency
}

func normalizedConversionCurrencies(req *model.ConvertBalanceRequest) (string, string) {
	return normalizeCurrencyCode(req.FromCurrency), normalizeCurrencyCode(req.ToCurrency)
}

func normalizeUpdateTransactionRequest(req *model.UpdateTransactionRequest) {
	if req.Currency != "" {
		req.Currency = normalizeCurrencyCode(req.Currency)
	}
}

func (s *WalletService) SetTagRepository(tagRepo *repository.TagRepository) {
	s.tagRepo = tagRepo
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
	currency = normalizeCurrencyCode(currency)
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

// AddTransaction adds a credit or debit transaction atomically
// Supports cross-currency transactions when wallet_currency differs from currency
func (s *WalletService) AddTransaction(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest) (*model.Transaction, error) {
	// Validate request
	if req.Type != "credit" && req.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}

	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	currency, walletCurrency := normalizedTransactionCurrencies(req)

	if currency == "" {
		return nil, errors.New("currency is required")
	}

	// If wallet currency differs from transaction currency, perform cross-currency transaction
	if walletCurrency != currency {
		return s.addCrossCurrencyTransaction(ctx, userID, req, currency, walletCurrency)
	}

	// Use atomic transaction method for same-currency transaction
	tx, err := s.walletRepo.AddTransactionAtomic(ctx, userID, req.Type, req.Amount, currency, "manual", req.Description, req.Category, req.Icon, nil)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, repository.ErrInsufficientBalance
		}
		return nil, fmt.Errorf("adding transaction: %w", err)
	}

	return tx, nil
}

// addCrossCurrencyTransaction handles transactions where the transaction currency differs from wallet currency
func (s *WalletService) addCrossCurrencyTransaction(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest, transactionCurrency, walletCurrency string) (*model.Transaction, error) {
	// Get exchange rate from transaction currency to wallet currency
	// For debit: we need to deduct walletAmount from walletCurrency balance
	// For credit: we need to add walletAmount to walletCurrency balance
	var fromCurrency, toCurrency string
	if req.Type == "debit" {
		// Paying in transaction currency, deducting from wallet currency
		// Convert: transaction currency -> wallet currency (how much wallet currency needed)
		fromCurrency = transactionCurrency
		toCurrency = walletCurrency
	} else {
		// Receiving in transaction currency, adding to wallet currency
		// Convert: transaction currency -> wallet currency (how much wallet currency to add)
		fromCurrency = transactionCurrency
		toCurrency = walletCurrency
	}

	conversion, err := s.exchangeService.Convert(ctx, fromCurrency, toCurrency, req.Amount)
	if err != nil {
		return nil, fmt.Errorf("getting exchange rate: %w", err)
	}

	walletAmount := conversion.Result
	rate := conversion.Rate

	// Use atomic cross-currency transaction method
	tx, err := s.walletRepo.AddCrossCurrencyTransactionAtomic(ctx, userID, req.Type,
		req.Amount, transactionCurrency, // Transaction amount and currency (what user sees)
		walletAmount, walletCurrency, // Wallet amount and currency (what affects balance)
		rate, "manual", req.Description, req.Category, req.Icon, nil)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, repository.ErrInsufficientBalance
		}
		return nil, fmt.Errorf("adding cross-currency transaction: %w", err)
	}

	return tx, nil
}

// ConvertBalance converts currency within the wallet
func (s *WalletService) ConvertBalance(ctx context.Context, userID uuid.UUID, req *model.ConvertBalanceRequest) (*model.ConvertBalanceResponse, error) {
	fromCurrency, toCurrency := normalizedConversionCurrencies(req)

	// Validate request
	if fromCurrency == "" || toCurrency == "" {
		return nil, errors.New("from_currency and to_currency are required")
	}

	if fromCurrency == toCurrency {
		return nil, errors.New("cannot convert to the same currency")
	}

	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	// Get exchange rate using existing converter
	conversion, err := s.exchangeService.Convert(ctx, fromCurrency, toCurrency, req.Amount)
	if err != nil {
		return nil, fmt.Errorf("getting exchange rate: %w", err)
	}

	// Execute the conversion atomically
	tx, err := s.walletRepo.ExecuteConversion(ctx, userID,
		fromCurrency, toCurrency,
		req.Amount, conversion.Result, conversion.Rate)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, repository.ErrInsufficientBalance
		}
		return nil, fmt.Errorf("executing conversion: %w", err)
	}

	return &model.ConvertBalanceResponse{
		FromCurrency: fromCurrency,
		ToCurrency:   toCurrency,
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

// CountTransactions returns the total number of transactions for a user
func (s *WalletService) CountTransactions(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.walletRepo.CountTransactions(ctx, userID)
}

// GetTransactionsFiltered retrieves transaction history with filters
func (s *WalletService) GetTransactionsFiltered(ctx context.Context, userID uuid.UUID, filter *model.TransactionFilter, limit, offset int) ([]model.Transaction, int, error) {
	transactions, total, err := s.walletRepo.GetTransactionsFiltered(ctx, userID, filter, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("getting filtered transactions: %w", err)
	}

	if transactions == nil {
		transactions = []model.Transaction{}
	}

	return transactions, total, nil
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

	// Calculate total balance in USD
	var totalUSD float64
	for _, balance := range balances {
		if balance.Currency == "USD" {
			totalUSD += balance.Balance
		} else if s.exchangeService != nil && balance.Balance > 0 {
			// Convert to USD
			result, err := s.exchangeService.Convert(ctx, balance.Currency, "USD", balance.Balance)
			if err == nil && result != nil {
				totalUSD += result.Result
			}
		}
	}

	return &model.WalletSummary{
		TotalBalanceUSD:    totalUSD,
		Balances:           balances,
		RecentTransactions: transactions,
	}, nil
}

// ApplyAIParsedResult applies the result of AI parsing to the wallet atomically
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

	// Store the AI extracted data
	aiData, _ := json.Marshal(parsed)

	// Use atomic transaction method
	tx, err := s.walletRepo.AddTransactionAtomic(ctx, userID, parsed.Type, parsed.Amount, parsed.Currency, "ai_receipt", parsed.Description, "", "", aiData)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, repository.ErrInsufficientBalance
		}
		return nil, fmt.Errorf("applying AI parsed result: %w", err)
	}

	return tx, nil
}

// GetTransaction retrieves a single transaction by ID
func (s *WalletService) GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*model.Transaction, error) {
	tx, err := s.walletRepo.GetTransaction(ctx, userID, txID)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, repository.ErrTransactionNotFound
		}
		return nil, fmt.Errorf("getting transaction: %w", err)
	}
	return tx, nil
}

// DeleteTransaction deletes a transaction and reverses its balance impact
func (s *WalletService) DeleteTransaction(ctx context.Context, userID, txID uuid.UUID) error {
	err := s.walletRepo.DeleteTransactionAtomic(ctx, userID, txID)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return repository.ErrTransactionNotFound
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return repository.ErrInsufficientBalance
		}
		return fmt.Errorf("deleting transaction: %w", err)
	}
	return nil
}

// UpdateTransaction updates an existing transaction
func (s *WalletService) UpdateTransaction(ctx context.Context, userID, txID uuid.UUID, req *model.UpdateTransactionRequest) (*model.Transaction, error) {
	// Validate type if provided
	if req.Type != "" && req.Type != "credit" && req.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}
	normalizeUpdateTransactionRequest(req)

	tx, err := s.walletRepo.UpdateTransactionAtomic(ctx, userID, txID, req)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, repository.ErrTransactionNotFound
		}
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, repository.ErrInsufficientBalance
		}
		return nil, fmt.Errorf("updating transaction: %w", err)
	}
	return tx, nil
}

// ImportTransactions adds multiple transactions atomically
func (s *WalletService) ImportTransactions(ctx context.Context, userID uuid.UUID, transactions []model.TransactionRequest) (int, error) {
	count := 0
	for _, req := range transactions {
		_, err := s.AddTransaction(ctx, userID, &req)
		if err != nil {
			// Continue with others even if one fails (e.g. insufficient balance)
			continue
		}
		count++
	}
	return count, nil
}

func (s *WalletService) GetTransactionTags(ctx context.Context, userID, txID uuid.UUID) ([]model.Tag, error) {
	if s.tagRepo == nil {
		return nil, errors.New("tag repository is not configured")
	}
	if _, err := s.walletRepo.GetTransaction(ctx, userID, txID); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, repository.ErrTransactionNotFound
		}
		return nil, fmt.Errorf("getting transaction: %w", err)
	}
	tags, err := s.tagRepo.GetTagsForTransaction(ctx, txID)
	if err != nil {
		return nil, fmt.Errorf("getting transaction tags: %w", err)
	}
	if tags == nil {
		tags = []model.Tag{}
	}
	return tags, nil
}

func (s *WalletService) AddTransactionTag(ctx context.Context, userID, txID, tagID uuid.UUID) error {
	if s.tagRepo == nil {
		return errors.New("tag repository is not configured")
	}
	if _, err := s.walletRepo.GetTransaction(ctx, userID, txID); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return repository.ErrTransactionNotFound
		}
		return fmt.Errorf("getting transaction: %w", err)
	}
	if _, err := s.tagRepo.GetByID(ctx, userID, tagID); err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			return repository.ErrTagNotFound
		}
		return fmt.Errorf("getting tag: %w", err)
	}
	if err := s.tagRepo.AddTagToTransaction(ctx, txID, tagID); err != nil {
		return fmt.Errorf("adding transaction tag: %w", err)
	}
	return nil
}

func (s *WalletService) RemoveTransactionTag(ctx context.Context, userID, txID, tagID uuid.UUID) error {
	if s.tagRepo == nil {
		return errors.New("tag repository is not configured")
	}
	if _, err := s.walletRepo.GetTransaction(ctx, userID, txID); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return repository.ErrTransactionNotFound
		}
		return fmt.Errorf("getting transaction: %w", err)
	}
	if _, err := s.tagRepo.GetByID(ctx, userID, tagID); err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			return repository.ErrTagNotFound
		}
		return fmt.Errorf("getting tag: %w", err)
	}
	if err := s.tagRepo.RemoveTagFromTransaction(ctx, txID, tagID); err != nil {
		return fmt.Errorf("removing transaction tag: %w", err)
	}
	return nil
}
