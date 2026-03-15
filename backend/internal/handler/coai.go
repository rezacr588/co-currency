package handler

import (
	"encoding/json"
	"net/http"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

type CoAIHandler struct {
	service *service.CoAIService
}

func NewCoAIHandler(service *service.CoAIService) *CoAIHandler {
	return &CoAIHandler{service: service}
}

func (h *CoAIHandler) GetBrief(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.service != nil, "CoAI service not available") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	brief, err := h.service.GetBrief(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to load CoAI brief", err)
		return
	}

	httputil.Success(w, brief)
}

func (h *CoAIHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.service != nil, "CoAI service not available") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	prefs, err := h.service.GetPreferences(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to load CoAI preferences", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"preferences": prefs,
	})
}

func (h *CoAIHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	if !requireService(w, h.service != nil, "CoAI service not available") {
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.UpdateCoAIPreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	prefs, err := h.service.UpdatePreferences(r.Context(), userID, req)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "failed to update CoAI preferences", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"preferences": prefs,
	})
}
