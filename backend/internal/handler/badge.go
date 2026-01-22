package handler

import (
	"net/http"

	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// BadgeHandler handles badge endpoints
type BadgeHandler struct {
	badgeService *service.BadgeService
}

// NewBadgeHandler creates a new BadgeHandler
func NewBadgeHandler(badgeService *service.BadgeService) *BadgeHandler {
	return &BadgeHandler{badgeService: badgeService}
}

// GetAllBadges handles GET /api/v1/badges
// @Summary      List all available badges
// @Description  Get a list of all system badges
// @Tags         Badges
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}  "badges: []model.Badge"
// @Failure      500  {object}  map[string]string       "Internal Server Error"
// @Router       /badges [get]
func (h *BadgeHandler) GetAllBadges(w http.ResponseWriter, r *http.Request) {
	badges, err := h.badgeService.GetAllBadges(r.Context())
	if err != nil {
		httputil.InternalServerError(w, "failed to get badges")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"badges": badges,
	})
}

// GetEarnedBadges handles GET /api/v1/badges/earned
// @Summary      Get earned badges
// @Description  Get badges earned by the authenticated user
// @Tags         Badges
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "badges: []model.UserBadge, count: int"
// @Failure      401  {object}  map[string]string       "Unauthorized"
// @Failure      500  {object}  map[string]string       "Internal Server Error"
// @Router       /badges/earned [get]
func (h *BadgeHandler) GetEarnedBadges(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	badges, err := h.badgeService.GetUserBadges(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get earned badges")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"badges": badges,
		"count":  len(badges),
	})
}

// GetBadgeProgress handles GET /api/v1/badges/progress
// @Summary      Get badge progress
// @Description  Get progress towards all badges for the authenticated user
// @Tags         Badges
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "progress: []model.BadgeProgress, total_badges: int, earned_count: int"
// @Failure      401  {object}  map[string]string       "Unauthorized"
// @Failure      500  {object}  map[string]string       "Internal Server Error"
// @Router       /badges/progress [get]
func (h *BadgeHandler) GetBadgeProgress(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	progress, err := h.badgeService.GetBadgeProgress(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get badge progress")
		return
	}

	// Count earned badges
	earnedCount := 0
	for _, p := range progress {
		if p.IsEarned {
			earnedCount++
		}
	}

	httputil.Success(w, map[string]interface{}{
		"progress":     progress,
		"total_badges": len(progress),
		"earned_count": earnedCount,
	})
}

// CheckBadges handles POST /api/v1/badges/check
// @Summary      Check for new badges
// @Description  Trigger a check for newly earned badges based on user stats
// @Tags         Badges
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}  "newly_earned: []model.UserBadge, total_earned: int"
// @Failure      401  {object}  map[string]string       "Unauthorized"
// @Failure      500  {object}  map[string]string       "Internal Server Error"
// @Router       /badges/check [post]
func (h *BadgeHandler) CheckBadges(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	result, err := h.badgeService.CheckAndAwardBadges(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to check badges")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"newly_earned": result.NewlyEarned,
		"total_earned": result.TotalEarned,
	})
}
