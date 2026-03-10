package router

import (
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	httpSwagger "github.com/swaggo/http-swagger"
)

const baseURL = "https://coai.koyeb.app"

// registerPublicRoutes registers health endpoints, exchange rate routes,
// news routes, swagger documentation, SEO files, and static file serving.
func registerPublicRoutes(r *chi.Mux, h *Handlers, staticFS fs.FS) {
	// Health check (no rate limiting)
	r.Get("/health", h.Exchange.Health)
	r.Get("/health/detailed", h.Exchange.HealthDetailed)

	// Swagger documentation
	r.Get("/swagger/*", httpSwagger.Handler(
		httpSwagger.URL("/swagger/doc.json"),
	))

	// SEO files (registered before static catch-all)
	r.Get("/robots.txt", serveRobotsTxt)
	r.Get("/sitemap.xml", serveSitemapXML)
	r.Get("/manifest.json", serveManifestJSON)

	// Serve embedded static files (Expo web export)
	if staticFS != nil {
		fileServer := http.FileServer(http.FS(staticFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}

			// Resolve path: try exact → .html → /index.html → fallback to index.html
			resolved := resolveStaticPath(staticFS, path)
			if resolved != path {
				r.URL.Path = "/" + resolved
			}

			fileServer.ServeHTTP(w, r)
		})
	}
}

// resolveStaticPath tries multiple path variations to find the correct static file.
// Expo static export generates route.html files (e.g., converter.html, about.html).
func resolveStaticPath(staticFS fs.FS, path string) string {
	// Exact match (e.g., favicon.ico, assets/...)
	if _, err := fs.Stat(staticFS, path); err == nil {
		return path
	}
	// Try with .html extension (e.g., converter → converter.html)
	if _, err := fs.Stat(staticFS, path+".html"); err == nil {
		return path + ".html"
	}
	// Try as directory with index.html (e.g., (public)/ → (public)/index.html)
	if _, err := fs.Stat(staticFS, path+"/index.html"); err == nil {
		return path + "/index.html"
	}
	// Fallback to index.html for SPA routing
	return "index.html"
}

func serveRobotsTxt(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	fmt.Fprintf(w, `User-agent: *
Allow: /
Allow: /converter
Allow: /about
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /api/
Disallow: /swagger/
Disallow: /health

Sitemap: %s/sitemap.xml
`, baseURL)
}

func serveSitemapXML(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")

	type sitemapURL struct {
		loc        string
		changefreq string
		priority   string
	}
	urls := []sitemapURL{
		{"/", "weekly", "1.0"},
		{"/converter", "weekly", "0.9"},
		{"/about", "monthly", "0.7"},
	}
	langs := []string{"en", "fa", "ar", "tr"}

	fmt.Fprint(w, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`)
	for _, u := range urls {
		fmt.Fprintf(w, "  <url>\n    <loc>%s%s</loc>\n    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n",
			baseURL, u.loc, u.changefreq, u.priority)
		for _, lang := range langs {
			fmt.Fprintf(w, "    <xhtml:link rel=\"alternate\" hreflang=\"%s\" href=\"%s%s\"/>\n", lang, baseURL, u.loc)
		}
		fmt.Fprintf(w, "    <xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"%s%s\"/>\n", baseURL, u.loc)
		fmt.Fprint(w, "  </url>\n")
	}
	fmt.Fprint(w, "</urlset>\n")
}

func serveManifestJSON(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/manifest+json; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=604800")
	fmt.Fprint(w, `{
  "name": "CoAI - Personal Finance",
  "short_name": "CoAI",
  "description": "Track spending across 160+ currencies, get AI-powered insights, and protect your purchasing power.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "orientation": "portrait",
  "icons": [
    {"src": "/favicon.ico", "sizes": "48x48", "type": "image/x-icon"},
    {"src": "/assets/images/icon.png", "sizes": "1024x1024", "type": "image/png", "purpose": "any maskable"}
  ],
  "categories": ["finance", "utilities"],
  "lang": "en"
}
`)
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
