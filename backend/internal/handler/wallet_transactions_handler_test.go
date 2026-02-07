package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
)

func withUser(req *http.Request) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, uuid.New())
	return req.WithContext(ctx)
}

func TestWalletHandler_GetTransactions_FilteredHighLimitAllowed(t *testing.T) {
	calledFiltered := false
	stub := &walletServiceStub{
		getTransactionsFilteredFn: func(ctx context.Context, userID uuid.UUID, filter *model.TransactionFilter, limit, offset int) ([]model.Transaction, int, error) {
			calledFiltered = true
			if limit != 1000 {
				t.Fatalf("expected limit 1000, got %d", limit)
			}
			if filter.FromDate == "" || filter.ToDate == "" {
				t.Fatalf("expected from/to date filters to be set")
			}
			return []model.Transaction{}, 0, nil
		},
	}
	w := &WalletHandler{walletService: stub}

	req := withUser(httptest.NewRequest(http.MethodGet, "/api/v1/wallet/transactions?from_date=2026-01-01&to_date=2026-01-31&limit=1000", nil))
	rr := httptest.NewRecorder()

	w.GetTransactions(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if !calledFiltered {
		t.Fatal("expected filtered transaction path to be called")
	}
}

func TestWalletHandler_GetTransactions_UnfilteredHighLimitRejected(t *testing.T) {
	w := &WalletHandler{walletService: &walletServiceStub{}}
	req := withUser(httptest.NewRequest(http.MethodGet, "/api/v1/wallet/transactions?limit=1000", nil))
	rr := httptest.NewRecorder()

	w.GetTransactions(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestWalletHandler_GetTransactions_InvalidOffsetRejected(t *testing.T) {
	w := &WalletHandler{walletService: &walletServiceStub{}}
	req := withUser(httptest.NewRequest(http.MethodGet, "/api/v1/wallet/transactions?offset=-1", nil))
	rr := httptest.NewRecorder()

	w.GetTransactions(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestWalletHandler_GetTransactions_InvalidFromTimestampRejected(t *testing.T) {
	w := &WalletHandler{walletService: &walletServiceStub{}}
	req := withUser(httptest.NewRequest(http.MethodGet, "/api/v1/wallet/transactions?from_ts=not-a-time", nil))
	rr := httptest.NewRecorder()

	w.GetTransactions(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}

func TestWalletHandler_GetTransactions_InvalidTimestampRangeRejected(t *testing.T) {
	w := &WalletHandler{walletService: &walletServiceStub{}}
	req := withUser(httptest.NewRequest(http.MethodGet, "/api/v1/wallet/transactions?from_ts=2026-02-01T00:00:00Z&to_ts=2026-01-01T00:00:00Z", nil))
	rr := httptest.NewRecorder()

	w.GetTransactions(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rr.Code)
	}
}
