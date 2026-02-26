package handler

import (
	"context"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

type walletServiceStub struct {
	getBalancesFn             func(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error)
	getWalletSummaryFn        func(ctx context.Context, userID uuid.UUID) (*model.WalletSummary, error)
	addTransactionFn          func(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest) (*model.Transaction, error)
	convertBalanceFn          func(ctx context.Context, userID uuid.UUID, req *model.ConvertBalanceRequest) (*model.ConvertBalanceResponse, error)
	getTransactionsFn         func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error)
	countTransactionsFn       func(ctx context.Context, userID uuid.UUID) (int, error)
	getTransactionsFilteredFn func(ctx context.Context, userID uuid.UUID, filter *model.TransactionFilter, limit, offset int) ([]model.Transaction, int, error)
	getTransactionFn          func(ctx context.Context, userID, txID uuid.UUID) (*model.Transaction, error)
	deleteTransactionFn       func(ctx context.Context, userID, txID uuid.UUID) error
	updateTransactionFn       func(ctx context.Context, userID, txID uuid.UUID, req *model.UpdateTransactionRequest) (*model.Transaction, error)
	importTransactionsFn      func(ctx context.Context, userID uuid.UUID, req []model.TransactionRequest) (int, error)
	getTransactionTagsFn      func(ctx context.Context, userID, txID uuid.UUID) ([]model.Tag, error)
	addTransactionTagFn       func(ctx context.Context, userID, txID, tagID uuid.UUID) error
	removeTransactionTagFn    func(ctx context.Context, userID, txID, tagID uuid.UUID) error
}

func (s *walletServiceStub) GetBalances(ctx context.Context, userID uuid.UUID) ([]model.WalletBalance, error) {
	if s.getBalancesFn != nil {
		return s.getBalancesFn(ctx, userID)
	}
	return []model.WalletBalance{}, nil
}

func (s *walletServiceStub) GetWalletSummary(ctx context.Context, userID uuid.UUID) (*model.WalletSummary, error) {
	if s.getWalletSummaryFn != nil {
		return s.getWalletSummaryFn(ctx, userID)
	}
	return &model.WalletSummary{}, nil
}

func (s *walletServiceStub) AddTransaction(ctx context.Context, userID uuid.UUID, req *model.TransactionRequest) (*model.Transaction, error) {
	if s.addTransactionFn != nil {
		return s.addTransactionFn(ctx, userID, req)
	}
	return &model.Transaction{}, nil
}

func (s *walletServiceStub) ConvertBalance(ctx context.Context, userID uuid.UUID, req *model.ConvertBalanceRequest) (*model.ConvertBalanceResponse, error) {
	if s.convertBalanceFn != nil {
		return s.convertBalanceFn(ctx, userID, req)
	}
	return &model.ConvertBalanceResponse{}, nil
}

func (s *walletServiceStub) GetTransactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]model.Transaction, error) {
	if s.getTransactionsFn != nil {
		return s.getTransactionsFn(ctx, userID, limit, offset)
	}
	return []model.Transaction{}, nil
}

func (s *walletServiceStub) CountTransactions(ctx context.Context, userID uuid.UUID) (int, error) {
	if s.countTransactionsFn != nil {
		return s.countTransactionsFn(ctx, userID)
	}
	return 0, nil
}

func (s *walletServiceStub) GetTransactionsFiltered(ctx context.Context, userID uuid.UUID, filter *model.TransactionFilter, limit, offset int) ([]model.Transaction, int, error) {
	if s.getTransactionsFilteredFn != nil {
		return s.getTransactionsFilteredFn(ctx, userID, filter, limit, offset)
	}
	return []model.Transaction{}, 0, nil
}

func (s *walletServiceStub) GetTransaction(ctx context.Context, userID, txID uuid.UUID) (*model.Transaction, error) {
	if s.getTransactionFn != nil {
		return s.getTransactionFn(ctx, userID, txID)
	}
	return &model.Transaction{}, nil
}

func (s *walletServiceStub) DeleteTransaction(ctx context.Context, userID, txID uuid.UUID) error {
	if s.deleteTransactionFn != nil {
		return s.deleteTransactionFn(ctx, userID, txID)
	}
	return nil
}

func (s *walletServiceStub) UpdateTransaction(ctx context.Context, userID, txID uuid.UUID, req *model.UpdateTransactionRequest) (*model.Transaction, error) {
	if s.updateTransactionFn != nil {
		return s.updateTransactionFn(ctx, userID, txID, req)
	}
	return &model.Transaction{}, nil
}

func (s *walletServiceStub) ImportTransactions(ctx context.Context, userID uuid.UUID, req []model.TransactionRequest) (int, error) {
	if s.importTransactionsFn != nil {
		return s.importTransactionsFn(ctx, userID, req)
	}
	return 0, nil
}

func (s *walletServiceStub) GetTransactionTags(ctx context.Context, userID, txID uuid.UUID) ([]model.Tag, error) {
	if s.getTransactionTagsFn != nil {
		return s.getTransactionTagsFn(ctx, userID, txID)
	}
	return []model.Tag{}, nil
}

func (s *walletServiceStub) AddTransactionTag(ctx context.Context, userID, txID, tagID uuid.UUID) error {
	if s.addTransactionTagFn != nil {
		return s.addTransactionTagFn(ctx, userID, txID, tagID)
	}
	return nil
}

func (s *walletServiceStub) RemoveTransactionTag(ctx context.Context, userID, txID, tagID uuid.UUID) error {
	if s.removeTransactionTagFn != nil {
		return s.removeTransactionTagFn(ctx, userID, txID, tagID)
	}
	return nil
}

type categoryServiceStub struct {
	getCategoriesFn  func(ctx context.Context, userID uuid.UUID) ([]model.Category, error)
	createCategoryFn func(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error)
	deleteCategoryFn func(ctx context.Context, userID, categoryID uuid.UUID) error
}

func (s *categoryServiceStub) GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error) {
	if s.getCategoriesFn != nil {
		return s.getCategoriesFn(ctx, userID)
	}
	return []model.Category{}, nil
}

func (s *categoryServiceStub) CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
	if s.createCategoryFn != nil {
		return s.createCategoryFn(ctx, userID, name, icon, color)
	}
	return &model.Category{}, nil
}

func (s *categoryServiceStub) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	if s.deleteCategoryFn != nil {
		return s.deleteCategoryFn(ctx, userID, categoryID)
	}
	return nil
}
