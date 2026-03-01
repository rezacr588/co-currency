package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// registerWalletRoutes registers the /wallet route group including balances,
// summary, transactions CRUD, import/export, tags, categories, and convert.
func registerWalletRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	r.Route("/wallet", func(r chi.Router) {
		r.Use(authMiddleware.Middleware)
		r.Get("/balances", h.Wallet.GetBalances)
		r.Get("/summary", h.Wallet.GetSummary)
		r.Post("/transaction", h.Wallet.AddTransaction)
		r.Post("/convert", h.Wallet.ConvertBalance)
		r.Get("/transactions", h.Wallet.GetTransactions)
		r.Post("/transactions/import", h.Wallet.ImportTransactions)
		r.Get("/transactions/export", h.Wallet.ExportTransactions)
		r.Get("/transactions/{id}", h.Wallet.GetTransaction)
		r.Put("/transactions/{id}", h.Wallet.UpdateTransaction)
		r.Delete("/transactions/{id}", h.Wallet.DeleteTransaction)
		r.Get("/transactions/{id}/tags", h.Wallet.GetTransactionTags)
		r.Post("/transactions/{id}/tags", h.Wallet.AddTransactionTag)
		r.Delete("/transactions/{id}/tags/{tagID}", h.Wallet.RemoveTransactionTag)
		r.Get("/categories", h.Wallet.GetCategories)
		r.Post("/categories", h.Wallet.CreateCategory)
		r.Delete("/categories/{id}", h.Wallet.DeleteCategory)
	})
}
