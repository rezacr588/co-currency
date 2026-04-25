package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// registerAdminRoutes mounts the read-only operator dashboard endpoints under
// /api/v1/admin. Skipped entirely when the admin handler is nil (DB unavailable).
// Authorization: chained Auth → RequireAdmin(adminEmail). Empty adminEmail
// disables all admin endpoints (RequireAdmin returns 403 for everyone).
func registerAdminRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth, adminEmail string) {
	if h.Admin == nil {
		return
	}
	r.Route("/admin", func(admin chi.Router) {
		admin.Use(authMiddleware.Middleware)
		admin.Use(middleware.RequireAdmin(adminEmail))
		admin.Get("/overview", h.Admin.GetOverview)
	})
}
