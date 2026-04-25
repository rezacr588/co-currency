package handler

import (
	"net/http"

	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AdminHandler exposes the read-only operator dashboard endpoints. The
// routes are gated by middleware.RequireAdmin at registration time; this
// handler doesn't re-check authorization.
type AdminHandler struct {
	adminRepo *repository.AdminRepository
}

// NewAdminHandler returns a handler wired to the given admin repository.
// Pass nil if the database is unavailable — registration will skip the
// routes (mirrors how other optional handlers behave).
func NewAdminHandler(adminRepo *repository.AdminRepository) *AdminHandler {
	return &AdminHandler{adminRepo: adminRepo}
}

// GetOverview handles GET /api/v1/admin/overview.
func (h *AdminHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.adminRepo != nil, "admin repository unavailable") {
		return
	}
	overview, err := h.adminRepo.GetOverview(r.Context())
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to load admin overview", err)
		return
	}
	httputil.Success(w, overview)
}
