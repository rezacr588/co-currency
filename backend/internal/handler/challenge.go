package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
)

type ChallengeHandler struct {
	service *service.ChallengeService
}

func NewChallengeHandler(service *service.ChallengeService) *ChallengeHandler {
	return &ChallengeHandler{service: service}
}

// GetAllChallenges returns all available challenges
func (h *ChallengeHandler) GetAllChallenges(w http.ResponseWriter, r *http.Request) {
	challenges, err := h.service.GetAllChallenges(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"challenges": challenges})
}

// GetFeaturedChallenges returns featured challenges
func (h *ChallengeHandler) GetFeaturedChallenges(w http.ResponseWriter, r *http.Request) {
	challenges, err := h.service.GetFeaturedChallenges(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"challenges": challenges})
}

// GetChallengesWithStatus returns all challenges with user's participation status
func (h *ChallengeHandler) GetChallengesWithStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	challenges, err := h.service.GetChallengesWithUserStatus(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"challenges": challenges})
}

// JoinChallenge allows a user to join a challenge
func (h *ChallengeHandler) JoinChallenge(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	var req model.JoinChallengeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	userChallenge, err := h.service.JoinChallenge(r.Context(), userID, req.ChallengeID)
	if err != nil {
		if err.Error() == "already participating in this challenge" {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"user_challenge": userChallenge})
}

// GetActiveChallenges returns user's active challenges
func (h *ChallengeHandler) GetActiveChallenges(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	challenges, err := h.service.GetUserActiveChallenges(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"challenges": challenges})
}

// GetChallengeHistory returns user's challenge history
func (h *ChallengeHandler) GetChallengeHistory(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	challenges, err := h.service.GetUserChallengeHistory(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"challenges": challenges})
}

// AbandonChallenge allows a user to abandon an active challenge
func (h *ChallengeHandler) AbandonChallenge(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)
	challengeID := chi.URLParam(r, "id")

	err := h.service.AbandonChallenge(r.Context(), userID, challengeID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetChallengeStats returns user's challenge statistics
func (h *ChallengeHandler) GetChallengeStats(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	stats, err := h.service.GetUserChallengeStats(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"stats": stats})
}

// CheckProgress manually triggers progress check for user's challenges
func (h *ChallengeHandler) CheckProgress(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(string)

	err := h.service.CheckAndUpdateProgress(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Progress checked successfully"})
}
