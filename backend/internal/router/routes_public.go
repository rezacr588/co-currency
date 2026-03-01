package router

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	httpSwagger "github.com/swaggo/http-swagger"
)

// registerPublicRoutes registers health endpoints, exchange rate routes,
// news routes, swagger documentation, and static file serving.
func registerPublicRoutes(r *chi.Mux, h *Handlers, staticFS fs.FS) {
	// Health check (no rate limiting)
	r.Get("/health", h.Exchange.Health)
	r.Get("/health/detailed", h.Exchange.HealthDetailed)

	// Swagger documentation
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"), //The url pointing to API definition
	))

	// Serve embedded static files (Expo web export)
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
}

// registerPublicAPIRoutes registers public API routes within the /api/v1 group
// (exchange rates and news).
func registerPublicAPIRoutes(r chi.Router, h *Handlers) {
	// Public exchange routes
	r.Get("/currencies", h.Exchange.GetCurrencies)
	r.Get("/rates/{base}", h.Exchange.GetRates)
	r.Get("/convert", h.Exchange.Convert)
	r.Get("/historical/{date}", h.Exchange.GetHistorical)

	// News routes (public)
	if h.News != nil {
		r.Get("/news", h.News.GetNews)
	}
}
