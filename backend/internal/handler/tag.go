package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
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
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	tags, err := h.tagService.GetTags(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get tags")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"tags": tags,
	})
}

// CreateTag handles POST /api/v1/tags
func (h *TagHandler) CreateTag(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.CreateTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	tag, err := h.tagService.CreateTag(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrTagExists) {
			httputil.BadRequest(w, "tag already exists")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, "failed to create tag")
		return
	}

	httputil.Created(w, tag)
}

// DeleteTag handles DELETE /api/v1/tags/{id}
func (h *TagHandler) DeleteTag(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	tagIDStr := chi.URLParam(r, "id")
	tagID, err := uuid.Parse(tagIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid tag ID")
		return
	}

	if err := h.tagService.DeleteTag(r.Context(), userID, tagID); err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "tag not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete tag")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "tag deleted successfully",
	})
}
