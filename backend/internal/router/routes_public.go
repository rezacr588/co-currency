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

type sitemapURL struct {
	loc        string
	changefreq string
	priority   string
	imageLoc   string
	imageTitle string
}

func publicSitemapURLs() []sitemapURL {
	return []sitemapURL{
		{
			loc:        "/",
			changefreq: "weekly",
			priority:   "1.0",
			imageLoc:   baseURL + "/assets/images/icon.png",
			imageTitle: "CoAI home",
		},
		{
			loc:        "/converter",
			changefreq: "weekly",
			priority:   "0.9",
			imageLoc:   baseURL + "/assets/images/icon.png",
			imageTitle: "CoAI converter",
		},
		{
			loc:        "/about",
			changefreq: "monthly",
			priority:   "0.7",
			imageLoc:   baseURL + "/assets/images/icon.png",
			imageTitle: "About CoAI",
		},
	}
}

// registerPublicRoutes registers health endpoints, exchange rate routes,
// news routes, swagger documentation, SEO files, and static file serving.
func registerPublicRoutes(r *chi.Mux, h *Handlers, staticFS fs.FS) {
	// Health check (no rate limiting). Accept HEAD as well so uptime
	// monitors that default to HEAD (UptimeRobot, Pingdom) don't get 405.
	r.Get("/health", h.Exchange.Health)
	r.Head("/health", h.Exchange.Health)
	r.Get("/health/detailed", h.Exchange.HealthDetailed)
	r.Head("/health/detailed", h.Exchange.HealthDetailed)

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
			if resolved == "index.html" && path != "index.html" {
				// Avoid FileServer redirecting unknown SPA paths to /index.html.
				r.URL.Path = "/"
			} else if resolved != path {
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
Disallow: /finapp
Disallow: /todo
Disallow: /profile
Disallow: /budgets
Disallow: /recurring
Disallow: /subscriptions
Disallow: /badges
Disallow: /historical
Disallow: /notes
Disallow: /note/
Disallow: /loans
Disallow: /notification-settings
Disallow: /challenges
Disallow: /onboarding
Disallow: /transaction-create
Disallow: /api/
Disallow: /auth/
Disallow: /swagger/
Disallow: /health

Sitemap: %s/sitemap.xml
`, baseURL)
}

func serveSitemapXML(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	urls := publicSitemapURLs()

	fmt.Fprint(w, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`)
	for _, u := range urls {
		fmt.Fprintf(w, "  <url>\n    <loc>%s%s</loc>\n    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n",
			baseURL, u.loc, u.changefreq, u.priority)
		if u.imageLoc != "" {
			fmt.Fprintf(w, "    <image:image>\n      <image:loc>%s</image:loc>\n", u.imageLoc)
			if u.imageTitle != "" {
				fmt.Fprintf(w, "      <image:title>%s</image:title>\n", u.imageTitle)
			}
			fmt.Fprint(w, "    </image:image>\n")
		}
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
		r.Get("/news/summary", h.News.GetDailySummary)
	}
}
