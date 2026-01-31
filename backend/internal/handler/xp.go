package handler

import (
	"net/http"
	"strconv"

	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// XPHandler handles XP and gamification endpoints
type XPHandler struct {
	xpService *service.XPService
}

// NewXPHandler creates a new XPHandler
func NewXPHandler(xpService *service.XPService) *XPHandler {
	return &XPHandler{xpService: xpService}
}

// GetStats handles GET /api/v1/xp/stats
func (h *XPHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	xp, err := h.xpService.GetUserXP(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get XP stats")
		return
	}

	httputil.Success(w, xp)
}

// GetHistory handles GET /api/v1/xp/history
func (h *XPHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	transactions, err := h.xpService.GetXPHistory(r.Context(), userID, limit)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get XP history")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"transactions": transactions,
	})
}

// GetLevelInfo handles GET /api/v1/xp/level
func (h *XPHandler) GetLevelInfo(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var level *int
	if l := r.URL.Query().Get("level"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			level = &parsed
		}
	}

	info, err := h.xpService.GetLevelInfo(r.Context(), userID, level)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get level info")
		return
	}

	httputil.Success(w, info)
}

// ClaimDailyReward handles POST /api/v1/xp/daily-reward
func (h *XPHandler) ClaimDailyReward(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	response, err := h.xpService.ClaimDailyReward(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to claim daily reward")
		return
	}

	httputil.Success(w, response)
}

// GetDailyRewardStatus handles GET /api/v1/xp/daily-reward/status
func (h *XPHandler) GetDailyRewardStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	status, err := h.xpService.GetDailyRewardStatus(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get reward status")
		return
	}

	httputil.Success(w, status)
}

// GetLeaderboard handles GET /api/v1/xp/leaderboard
func (h *XPHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	users, err := h.xpService.GetLeaderboard(r.Context(), limit)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get leaderboard")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"users": users,
	})
}
