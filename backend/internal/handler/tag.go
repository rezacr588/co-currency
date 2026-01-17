package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// TagHandler handles tag endpoints
type TagHandler struct {
	tagService *service.TagService
}

// NewTagHandler creates a new TagHandler
func NewTagHandler(tagService *service.TagService) *TagHandler {
	return &TagHandler{tagService: tagService}
}

// GetTags handles GET /api/v1/tags
func (h *TagHandler) GetTags(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	tags, err := h.tagService.GetTags(r.Context(), userID)
	if err != nil {
		httputil.InternalServerError(w, "failed to get tags")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"tags": tags,
	})
}

// CreateTag handles POST /api/v1/tags
func (h *TagHandler) CreateTag(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	var req model.CreateTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequest(w, "invalid request body")
		return
	}

	tag, err := h.tagService.CreateTag(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequest(w, err.Error())
		return
	}

	httputil.Created(w, tag)
}

// DeleteTag handles DELETE /api/v1/tags/{id}
func (h *TagHandler) DeleteTag(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.Unauthorized(w, "user not found in context")
		return
	}

	tagIDStr := chi.URLParam(r, "id")
	tagID, err := uuid.Parse(tagIDStr)
	if err != nil {
		httputil.BadRequest(w, "invalid tag ID")
		return
	}

	if err := h.tagService.DeleteTag(r.Context(), userID, tagID); err != nil {
		if err.Error() == "tag not found" {
			httputil.NotFound(w, "tag not found")
			return
		}
		httputil.InternalServerError(w, "failed to delete tag")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "tag deleted successfully",
	})
}
