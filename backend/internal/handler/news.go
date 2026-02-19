package handler

import (
	"net/http"
	"strconv"

	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// NewsHandler handles financial news endpoints
type NewsHandler struct {
	newsService *service.NewsService
}

// NewNewsHandler creates a new NewsHandler
func NewNewsHandler(newsService *service.NewsService) *NewsHandler {
	return &NewsHandler{newsService: newsService}
}

// GetNews handles GET /api/v1/news
func (h *NewsHandler) GetNews(w http.ResponseWriter, r *http.Request) {
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	items, err := h.newsService.GetNews(r.Context(), limit)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to fetch news", err)
		return
	}

	httputil.Success(w, items)
}
