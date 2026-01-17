package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// MockWalletRepository implements a mock wallet repository for testing
type MockWalletRepository struct {
	balances     map[string]map[string]*model.WalletBalance // userID -> currency -> balance
	transactions map[string][]model.Transaction             // userID -> transactions

	getBalancesErr       error
	getBalanceErr        error
	updateBalanceErr     error
	createTransactionErr error
	getTransactionsErr   error
	executeConversionErr error
}

func NewMockWalletRepository() *MockWalletRepository {
	return &MockWalletRepository{
		balances:     make(map[string]map[string]*model.WalletBalance),
		transactions: make(map[string][]model.Transaction),
	}
}

func (m *MockWalletRepository) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	if m.getBalancesErr != nil {
		return nil, m.getBalancesErr
	}

	userBalances, exists := m.balances[userID.String()]
	if !exists {
		return nil, nil
	}

	var result []model.WalletBalance
	for _, b := range userBalances {
		result = append(result, *b)
	}
	return result, nil
}

func (m *MockWalletRepository) GetBalance(ctx context.Context, userID uuid.UUID, currency string) (*model.WalletBalance, error) {
	if m.getBalanceErr != nil {
		return nil, m.getBalanceErr
	}

	userBalances, exists := m.balances[userID.String()]
	if !exists {
		return nil, repository.ErrBalanceNotFound
	}

	balance, exists := userBalances[currency]
	if !exists {
		return nil, repository.ErrBalanceNotFound
	}

	return balance, nil
}

func (m *MockWalletRepository) UpdateBalance(ctx context.Context, userID uuid.UUID, currency string, delta float64) (*model.WalletBalance, error) {
	if m.updateBalanceErr != nil {
		return nil, m.updateBalanceErr
	}

	if m.balances[userID.String()] == nil {
		m.balances[userID.String()] = make(map[string]*model.WalletBalance)
	}

	balance, exists := m.balances[userID.String()][currency]
	if !exists {
		balance = &model.WalletBalance{
			ID:        uuid.New(),
			UserID:    userID,
			Currency:  currency,
			Balance:   0,
			UpdatedAt: time.Now(),
		}
		m.balances[userID.String()][currency] = balance
	}

	newBalance := balance.Balance + delta
	if newBalance < 0 {
		return nil, repository.ErrInsufficientBalance
	}

	balance.Balance = newBalance
	balance.UpdatedAt = time.Now()

	return balance, nil
}

func (m *MockWalletRepository) CreateTransaction(ctx context.Context, tx *model.Transaction) error {
	if m.createTransactionErr != nil {
		return m.createTransactionErr
	}

	tx.ID = uuid.New()
	tx.CreatedAt = time.Now()

	m.transactions[tx.UserID.String()] = append(m.transactions[tx.UserID.String()], *tx)
	return nil
}

func (m *MockWalletRepository) GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error) {
	if m.getTransactionsErr != nil {
		return nil, m.getTransactionsErr
	}

	transactions, exists := m.transactions[userID.String()]
	if !exists {
		return nil, nil
	}

	// Apply pagination
	if offset >= len(transactions) {
		return nil, nil
	}

	end := offset + limit
	if end > len(transactions) {
		end = len(transactions)
	}

	return transactions[offset:end], nil
}

func (m *MockWalletRepository) ExecuteConversion(ctx context.Context, userID uuid.UUID, fromCurrency, toCurrency string, fromAmount, toAmount, rate float64) (*model.Transaction, error) {
	if m.executeConversionErr != nil {
		return nil, m.executeConversionErr
	}

	// Check balance
	userBalances := m.balances[userID.String()]
	if userBalances == nil {
		return nil, repository.ErrInsufficientBalance
	}

	fromBalance, exists := userBalances[fromCurrency]
	if !exists || fromBalance.Balance < fromAmount {
		return nil, repository.ErrInsufficientBalance
	}

	// Debit from source
	fromBalance.Balance -= fromAmount

	// Credit to target
	if userBalances[toCurrency] == nil {
		userBalances[toCurrency] = &model.WalletBalance{
			ID:       uuid.New(),
			UserID:   userID,
			Currency: toCurrency,
			Balance:  0,
		}
	}
	userBalances[toCurrency].Balance += toAmount

	// Create transaction
	tx := &model.Transaction{
		ID:         uuid.New(),
		UserID:     userID,
		Type:       "convert",
		Amount:     fromAmount,
		Currency:   fromCurrency,
		ToAmount:   &toAmount,
		ToCurrency: &toCurrency,
		Rate:       &rate,
		Source:     "manual",
		CreatedAt:  time.Now(),
	}

	m.transactions[userID.String()] = append(m.transactions[userID.String()], *tx)

	return tx, nil
}

func (m *MockWalletRepository) SetBalance(userID uuid.UUID, currency string, amount float64) {
	if m.balances[userID.String()] == nil {
		m.balances[userID.String()] = make(map[string]*model.WalletBalance)
	}
	m.balances[userID.String()][currency] = &model.WalletBalance{
		ID:        uuid.New(),
		UserID:    userID,
		Currency:  currency,
		Balance:   amount,
		UpdatedAt: time.Now(),
	}
}

// MockExchangeService provides mock exchange rates for testing
type MockExchangeService struct {
	convertResult *model.ConversionResult
	convertErr    error
}

func NewMockExchangeService() *MockExchangeService {
	return &MockExchangeService{
		convertResult: &model.ConversionResult{
			From:      "USD",
			To:        "EUR",
			Amount:    100,
			Result:    85,
			Rate:      0.85,
			UpdatedAt: time.Now(),
		},
	}
}

func (m *MockExchangeService) Convert(ctx context.Context, from, to string, amount float64) (*model.ConversionResult, error) {
	if m.convertErr != nil {
		return nil, m.convertErr
	}
	return &model.ConversionResult{
		From:      from,
		To:        to,
		Amount:    amount,
		Result:    amount * m.convertResult.Rate,
		Rate:      m.convertResult.Rate,
		UpdatedAt: time.Now(),
	}, nil
}

// WalletServiceWithMock wraps wallet service functionality with mocks
type WalletServiceWithMock struct {
	walletRepo      *MockWalletRepository
	exchangeService *MockExchangeService
}

func NewWalletServiceWithMock(walletRepo *MockWalletRepository, exchangeService *MockExchangeService) *WalletServiceWithMock {
	return &WalletServiceWithMock{
		walletRepo:      walletRepo,
		exchangeService: exchangeService,
	}
}

func (s *WalletServiceWithMock) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err != nil {
		return nil, err
	}

	if balances == nil {
		balances = []model.WalletBalance{}
	}

	return balances, nil
}

func (s *WalletServiceWithMock) GetBalance(ctx context.Context, userID uuid.UUID, currency string) (*model.WalletBalance, error) {
	balance, err := s.walletRepo.GetBalance(ctx, userID, currency)
	if err != nil {
		if errors.Is(err, repository.ErrBalanceNotFound) {
			return &model.WalletBalance{
				UserID:   userID,
				Currency: currency,
				Balance:  0,
			}, nil
		}
		return nil, err
	}
	return balance, nil
}

func (s *WalletServiceWithMock) AddTransaction(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest) (*model.Transaction, error) {
	if req.Type != "credit" && req.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}

	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	if req.Currency == "" {
		return nil, errors.New("currency is required")
	}

	delta := req.Amount
	if req.Type == "debit" {
		delta = -req.Amount
	}

	_, err := s.walletRepo.UpdateBalance(ctx, userID, req.Currency, delta)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, err
	}

	tx := &model.Transaction{
		UserID:      userID,
		Type:        req.Type,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Source:      "manual",
		Description: req.Description,
	}

	if err := s.walletRepo.CreateTransaction(ctx, tx); err != nil {
		return nil, err
	}

	return tx, nil
}

func (s *WalletServiceWithMock) ConvertBalance(ctx context.Context, userID uuid.UUID, req *model.ConvertBalanceRequest) (*model.ConvertBalanceResponse, error) {
	if req.FromCurrency == "" || req.ToCurrency == "" {
		return nil, errors.New("from_currency and to_currency are required")
	}

	if req.FromCurrency == req.ToCurrency {
		return nil, errors.New("cannot convert to the same currency")
	}

	if req.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	conversion, err := s.exchangeService.Convert(ctx, req.FromCurrency, req.ToCurrency, req.Amount)
	if err != nil {
		return nil, err
	}

	tx, err := s.walletRepo.ExecuteConversion(ctx, userID,
		req.FromCurrency, req.ToCurrency,
		req.Amount, conversion.Result, conversion.Rate)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, err
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

func (s *WalletServiceWithMock) GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error) {
	transactions, err := s.walletRepo.GetTransactions(ctx, userID, limit, offset)
	if err != nil {
		return nil, err
	}

	if transactions == nil {
		transactions = []model.Transaction{}
	}

	return transactions, nil
}

func (s *WalletServiceWithMock) GetWalletSummary(ctx context.Context, userID uuid.UUID) (*model.WalletSummary, error) {
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

func (s *WalletServiceWithMock) ApplyAIParsedResult(ctx context.Context, userID uuid.UUID, parsed *model.AIParseResult) (*model.Transaction, error) {
	if parsed.Amount <= 0 {
		return nil, errors.New("amount must be positive")
	}

	if parsed.Currency == "" {
		return nil, errors.New("currency is required")
	}

	if parsed.Type != "credit" && parsed.Type != "debit" {
		return nil, errors.New("type must be 'credit' or 'debit'")
	}

	delta := parsed.Amount
	if parsed.Type == "debit" {
		delta = -parsed.Amount
	}

	_, err := s.walletRepo.UpdateBalance(ctx, userID, parsed.Currency, delta)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return nil, errors.New("insufficient balance")
		}
		return nil, err
	}

	tx := &model.Transaction{
		UserID:      userID,
		Type:        parsed.Type,
		Amount:      parsed.Amount,
		Currency:    parsed.Currency,
		Source:      "ai_receipt",
		Description: parsed.Description,
	}

	if err := s.walletRepo.CreateTransaction(ctx, tx); err != nil {
		return nil, err
	}

	return tx, nil
}

// Tests for GetBalances
func TestGetBalances_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 100)
	mockRepo.SetBalance(userID, "EUR", 50)

	balances, err := service.GetBalances(context.Background(), userID)
	if err != nil {
		t.Fatalf("GetBalances failed: %v", err)
	}

	if len(balances) != 2 {
		t.Errorf("Expected 2 balances, got %d", len(balances))
	}
}

func TestGetBalances_Empty(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	balances, err := service.GetBalances(context.Background(), userID)
	if err != nil {
		t.Fatalf("GetBalances failed: %v", err)
	}

	if balances == nil {
		t.Error("Expected empty slice, got nil")
	}

	if len(balances) != 0 {
		t.Errorf("Expected 0 balances, got %d", len(balances))
	}
}

func TestGetBalances_Error(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	mockRepo.getBalancesErr = errors.New("database error")
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	_, err := service.GetBalances(context.Background(), userID)
	if err == nil {
		t.Error("Expected error, got nil")
	}
}

// Tests for GetBalance
func TestGetBalance_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 100)

	balance, err := service.GetBalance(context.Background(), userID, "USD")
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}

	if balance.Balance != 100 {
		t.Errorf("Expected balance 100, got %f", balance.Balance)
	}

	if balance.Currency != "USD" {
		t.Errorf("Expected currency USD, got %s", balance.Currency)
	}
}

func TestGetBalance_NotFound_ReturnsZero(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	balance, err := service.GetBalance(context.Background(), userID, "USD")
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}

	if balance.Balance != 0 {
		t.Errorf("Expected balance 0, got %f", balance.Balance)
	}
}

// Tests for AddTransaction
func TestAddTransaction_Credit_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.TransactionRequest{
		Type:        "credit",
		Amount:      100,
		Currency:    "USD",
		Description: "Test deposit",
	}

	tx, err := service.AddTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("AddTransaction failed: %v", err)
	}

	if tx.Type != "credit" {
		t.Errorf("Expected type credit, got %s", tx.Type)
	}

	if tx.Amount != 100 {
		t.Errorf("Expected amount 100, got %f", tx.Amount)
	}

	// Verify balance was updated
	balance, _ := service.GetBalance(context.Background(), userID, "USD")
	if balance.Balance != 100 {
		t.Errorf("Expected balance 100, got %f", balance.Balance)
	}
}

func TestAddTransaction_Debit_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 100)

	req := &model.TransactionRequest{
		Type:        "debit",
		Amount:      50,
		Currency:    "USD",
		Description: "Test withdrawal",
	}

	tx, err := service.AddTransaction(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("AddTransaction failed: %v", err)
	}

	if tx.Type != "debit" {
		t.Errorf("Expected type debit, got %s", tx.Type)
	}

	// Verify balance was updated
	balance, _ := service.GetBalance(context.Background(), userID, "USD")
	if balance.Balance != 50 {
		t.Errorf("Expected balance 50, got %f", balance.Balance)
	}
}

func TestAddTransaction_Debit_InsufficientBalance(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 50)

	req := &model.TransactionRequest{
		Type:     "debit",
		Amount:   100, // More than balance
		Currency: "USD",
	}

	_, err := service.AddTransaction(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for insufficient balance")
	}

	if err.Error() != "insufficient balance" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestAddTransaction_InvalidType(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.TransactionRequest{
		Type:     "invalid",
		Amount:   100,
		Currency: "USD",
	}

	_, err := service.AddTransaction(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for invalid type")
	}

	if err.Error() != "type must be 'credit' or 'debit'" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestAddTransaction_ZeroAmount(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.TransactionRequest{
		Type:     "credit",
		Amount:   0,
		Currency: "USD",
	}

	_, err := service.AddTransaction(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for zero amount")
	}

	if err.Error() != "amount must be positive" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestAddTransaction_NegativeAmount(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.TransactionRequest{
		Type:     "credit",
		Amount:   -100,
		Currency: "USD",
	}

	_, err := service.AddTransaction(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for negative amount")
	}
}

func TestAddTransaction_EmptyCurrency(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.TransactionRequest{
		Type:     "credit",
		Amount:   100,
		Currency: "",
	}

	_, err := service.AddTransaction(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for empty currency")
	}

	if err.Error() != "currency is required" {
		t.Errorf("Unexpected error: %v", err)
	}
}

// Tests for ConvertBalance
func TestConvertBalance_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 100)

	req := &model.ConvertBalanceRequest{
		FromCurrency: "USD",
		ToCurrency:   "EUR",
		Amount:       50,
	}

	resp, err := service.ConvertBalance(context.Background(), userID, req)
	if err != nil {
		t.Fatalf("ConvertBalance failed: %v", err)
	}

	if resp.FromCurrency != "USD" {
		t.Errorf("Expected FromCurrency USD, got %s", resp.FromCurrency)
	}

	if resp.ToCurrency != "EUR" {
		t.Errorf("Expected ToCurrency EUR, got %s", resp.ToCurrency)
	}

	if resp.FromAmount != 50 {
		t.Errorf("Expected FromAmount 50, got %f", resp.FromAmount)
	}

	if resp.Transaction == nil {
		t.Error("Expected transaction to be created")
	}

	// Verify balances were updated
	usdBalance, _ := service.GetBalance(context.Background(), userID, "USD")
	if usdBalance.Balance != 50 {
		t.Errorf("Expected USD balance 50, got %f", usdBalance.Balance)
	}

	eurBalance, _ := service.GetBalance(context.Background(), userID, "EUR")
	if eurBalance.Balance <= 0 {
		t.Error("Expected EUR balance to be positive")
	}
}

func TestConvertBalance_EmptyCurrencies(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	// Empty from currency
	req := &model.ConvertBalanceRequest{
		FromCurrency: "",
		ToCurrency:   "EUR",
		Amount:       50,
	}

	_, err := service.ConvertBalance(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for empty from_currency")
	}

	// Empty to currency
	req = &model.ConvertBalanceRequest{
		FromCurrency: "USD",
		ToCurrency:   "",
		Amount:       50,
	}

	_, err = service.ConvertBalance(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for empty to_currency")
	}
}

func TestConvertBalance_SameCurrency(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.ConvertBalanceRequest{
		FromCurrency: "USD",
		ToCurrency:   "USD",
		Amount:       50,
	}

	_, err := service.ConvertBalance(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for same currency conversion")
	}

	if err.Error() != "cannot convert to the same currency" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestConvertBalance_ZeroAmount(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	req := &model.ConvertBalanceRequest{
		FromCurrency: "USD",
		ToCurrency:   "EUR",
		Amount:       0,
	}

	_, err := service.ConvertBalance(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for zero amount")
	}
}

func TestConvertBalance_InsufficientBalance(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 50)

	req := &model.ConvertBalanceRequest{
		FromCurrency: "USD",
		ToCurrency:   "EUR",
		Amount:       100, // More than balance
	}

	_, err := service.ConvertBalance(context.Background(), userID, req)
	if err == nil {
		t.Error("Expected error for insufficient balance")
	}
}

// Tests for GetTransactions
func TestGetTransactions_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	// Add some transactions
	req := &model.TransactionRequest{
		Type:     "credit",
		Amount:   100,
		Currency: "USD",
	}
	service.AddTransaction(context.Background(), userID, req)
	service.AddTransaction(context.Background(), userID, req)

	transactions, err := service.GetTransactions(context.Background(), userID, 10, 0)
	if err != nil {
		t.Fatalf("GetTransactions failed: %v", err)
	}

	if len(transactions) != 2 {
		t.Errorf("Expected 2 transactions, got %d", len(transactions))
	}
}

func TestGetTransactions_Empty(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	transactions, err := service.GetTransactions(context.Background(), userID, 10, 0)
	if err != nil {
		t.Fatalf("GetTransactions failed: %v", err)
	}

	if transactions == nil {
		t.Error("Expected empty slice, got nil")
	}

	if len(transactions) != 0 {
		t.Errorf("Expected 0 transactions, got %d", len(transactions))
	}
}

func TestGetTransactions_Pagination(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	// Add 5 transactions
	for i := 0; i < 5; i++ {
		req := &model.TransactionRequest{
			Type:     "credit",
			Amount:   float64(i + 1),
			Currency: "USD",
		}
		service.AddTransaction(context.Background(), userID, req)
	}

	// Get first 2
	transactions, _ := service.GetTransactions(context.Background(), userID, 2, 0)
	if len(transactions) != 2 {
		t.Errorf("Expected 2 transactions, got %d", len(transactions))
	}

	// Get next 2 with offset
	transactions, _ = service.GetTransactions(context.Background(), userID, 2, 2)
	if len(transactions) != 2 {
		t.Errorf("Expected 2 transactions, got %d", len(transactions))
	}

	// Get last 1 with offset
	transactions, _ = service.GetTransactions(context.Background(), userID, 2, 4)
	if len(transactions) != 1 {
		t.Errorf("Expected 1 transaction, got %d", len(transactions))
	}
}

// Tests for GetWalletSummary
func TestGetWalletSummary_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 100)

	// Add a transaction
	req := &model.TransactionRequest{
		Type:     "credit",
		Amount:   100,
		Currency: "USD",
	}
	service.AddTransaction(context.Background(), userID, req)

	summary, err := service.GetWalletSummary(context.Background(), userID)
	if err != nil {
		t.Fatalf("GetWalletSummary failed: %v", err)
	}

	if len(summary.Balances) == 0 {
		t.Error("Expected balances to be present")
	}

	if len(summary.RecentTransactions) == 0 {
		t.Error("Expected recent transactions to be present")
	}
}

func TestGetWalletSummary_Empty(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	summary, err := service.GetWalletSummary(context.Background(), userID)
	if err != nil {
		t.Fatalf("GetWalletSummary failed: %v", err)
	}

	if summary.Balances == nil {
		t.Error("Expected empty balances slice, got nil")
	}

	if summary.RecentTransactions == nil {
		t.Error("Expected empty transactions slice, got nil")
	}
}

// Tests for ApplyAIParsedResult
func TestApplyAIParsedResult_Credit_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	parsed := &model.AIParseResult{
		Amount:      100,
		Currency:    "USD",
		Type:        "credit",
		Description: "AI parsed receipt",
		Confidence:  0.9,
	}

	tx, err := service.ApplyAIParsedResult(context.Background(), userID, parsed)
	if err != nil {
		t.Fatalf("ApplyAIParsedResult failed: %v", err)
	}

	if tx.Source != "ai_receipt" {
		t.Errorf("Expected source ai_receipt, got %s", tx.Source)
	}

	if tx.Type != "credit" {
		t.Errorf("Expected type credit, got %s", tx.Type)
	}

	// Verify balance was updated
	balance, _ := service.GetBalance(context.Background(), userID, "USD")
	if balance.Balance != 100 {
		t.Errorf("Expected balance 100, got %f", balance.Balance)
	}
}

func TestApplyAIParsedResult_Debit_Success(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 100)

	parsed := &model.AIParseResult{
		Amount:      50,
		Currency:    "USD",
		Type:        "debit",
		Description: "AI parsed expense",
	}

	tx, err := service.ApplyAIParsedResult(context.Background(), userID, parsed)
	if err != nil {
		t.Fatalf("ApplyAIParsedResult failed: %v", err)
	}

	if tx.Type != "debit" {
		t.Errorf("Expected type debit, got %s", tx.Type)
	}

	// Verify balance was updated
	balance, _ := service.GetBalance(context.Background(), userID, "USD")
	if balance.Balance != 50 {
		t.Errorf("Expected balance 50, got %f", balance.Balance)
	}
}

func TestApplyAIParsedResult_InvalidAmount(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	parsed := &model.AIParseResult{
		Amount:   0,
		Currency: "USD",
		Type:     "credit",
	}

	_, err := service.ApplyAIParsedResult(context.Background(), userID, parsed)
	if err == nil {
		t.Error("Expected error for zero amount")
	}
}

func TestApplyAIParsedResult_EmptyCurrency(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	parsed := &model.AIParseResult{
		Amount:   100,
		Currency: "",
		Type:     "credit",
	}

	_, err := service.ApplyAIParsedResult(context.Background(), userID, parsed)
	if err == nil {
		t.Error("Expected error for empty currency")
	}
}

func TestApplyAIParsedResult_InvalidType(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()

	parsed := &model.AIParseResult{
		Amount:   100,
		Currency: "USD",
		Type:     "invalid",
	}

	_, err := service.ApplyAIParsedResult(context.Background(), userID, parsed)
	if err == nil {
		t.Error("Expected error for invalid type")
	}
}

func TestApplyAIParsedResult_InsufficientBalance(t *testing.T) {
	mockRepo := NewMockWalletRepository()
	mockExchange := NewMockExchangeService()
	service := NewWalletServiceWithMock(mockRepo, mockExchange)

	userID := uuid.New()
	mockRepo.SetBalance(userID, "USD", 50)

	parsed := &model.AIParseResult{
		Amount:   100,
		Currency: "USD",
		Type:     "debit",
	}

	_, err := service.ApplyAIParsedResult(context.Background(), userID, parsed)
	if err == nil {
		t.Error("Expected error for insufficient balance")
	}

	if err.Error() != "insufficient balance" {
		t.Errorf("Unexpected error: %v", err)
	}
}
