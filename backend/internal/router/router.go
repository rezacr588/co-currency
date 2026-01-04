package router

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// New creates a new router with all routes configured
func New(h *handler.Handler, rateLimiter *middleware.RateLimiter, staticFS fs.FS) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logging)
	r.Use(middleware.CORS)

	// Health check (no rate limiting)
	r.Get("/health", h.Health)

	// API routes with rate limiting
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(rateLimiter.Middleware)

		r.Get("/currencies", h.GetCurrencies)
		r.Get("/rates/{base}", h.GetRates)
		r.Get("/convert", h.Convert)
		r.Get("/historical/{date}", h.GetHistorical)
	})

	// Serve static files (frontend)
	if staticFS != nil {
		fileServer := http.FileServer(http.FS(staticFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			// Try to serve the file directly
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}

			// Check if file exists
			if _, err := fs.Stat(staticFS, path); err != nil {
				// File doesn't exist, serve index.html for SPA routing
				r.URL.Path = "/"
				path = "index.html"
			}

			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}
