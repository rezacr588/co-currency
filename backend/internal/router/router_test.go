package router

import (
	"context"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
)

func setupTestRouter() (*Handlers, *middleware.RateLimiter, *middleware.Auth) {
	cfg := &config.Config{
		Port:            "8080",
		Environment:     "test",
		CacheTTL:        5 * time.Minute,
		RateLimitPerMin: 100,
		FrankfurterURL:  "https://api.frankfurter.app",
	}

	cache := repository.NewInMemoryCache(cfg.CacheTTL)
	client := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	exchangeService := service.NewExchangeService(cfg, client, cache, nil)

	handlers := &Handlers{
		Exchange: handler.New(exchangeService),
		Auth:     handler.NewAuthHandler(nil),
		Wallet:   handler.NewWalletHandler(nil),
		AI:       handler.NewAIHandler(nil, nil),
		Goal:     handler.NewGoalHandler(nil),
		Task:     handler.NewTaskHandler(nil),
		Todo:     handler.NewTodoHandler(nil),
	}

	rateLimiter := middleware.NewRateLimiter(cfg.RateLimitPerMin)
	authMiddleware := middleware.NewAuth(nil)

	return handlers, rateLimiter, authMiddleware
}

func TestNew_CreatesRouter(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()

	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	if r == nil {
		t.Fatal("Expected router to be created")
	}
}

func TestRouter_HealthEndpoint(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Health endpoint status = %v, want %v", rr.Code, http.StatusOK)
	}
}

func TestRouter_CurrenciesEndpoint(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/currencies", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Should return OK (may need network)
	if rr.Code != http.StatusOK && rr.Code != http.StatusInternalServerError {
		t.Errorf("Currencies endpoint status = %v, unexpected", rr.Code)
	}
}

func TestRouter_RatesEndpoint(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/rates/USD", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// May succeed or fail based on network, just shouldn't be 404
	if rr.Code == http.StatusNotFound {
		t.Errorf("Rates endpoint should not return 404")
	}
}

func TestRouter_ConvertEndpoint_MissingParams(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/convert", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Convert endpoint without params status = %v, want %v", rr.Code, http.StatusBadRequest)
	}
}

func TestRouter_HistoricalEndpoint_InvalidDate(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/historical/invalid", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Historical endpoint with invalid date status = %v, want %v", rr.Code, http.StatusBadRequest)
	}
}

func TestRouter_AuthRegisterEndpoint_ServiceUnavailable(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/auth/register", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// With nil auth service, should return 503 Service Unavailable
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("Register endpoint with nil auth service status = %v, want %v", rr.Code, http.StatusServiceUnavailable)
	}
}

func TestRouter_AuthLoginEndpoint_ServiceUnavailable(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// With nil auth service, should return 503 Service Unavailable
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("Login endpoint with nil auth service status = %v, want %v", rr.Code, http.StatusServiceUnavailable)
	}
}

func TestRouter_AuthProfileEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/auth/profile", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Profile endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_WalletBalancesEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/wallet/balances", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Wallet balances endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_WalletSummaryEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/wallet/summary", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Wallet summary endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_WalletTransactionEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/wallet/transaction", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Wallet transaction endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_WalletConvertEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/wallet/convert", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Wallet convert endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_WalletTransactionsEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/wallet/transactions", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Wallet transactions endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_AIStatusEndpoint(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/ai/status", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("AI status endpoint status = %v, want %v", rr.Code, http.StatusOK)
	}
}

func TestRouter_AIParseReceiptEndpoint(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/ai/parse-receipt", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Should return 401 (unauthorized) since parse endpoints now require auth
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("AI parse-receipt endpoint status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_AIParseTextEndpoint(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/ai/parse-text", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Should return 401 (unauthorized) since parse endpoints now require auth
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("AI parse-text endpoint status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_AIApplyParsedEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("POST", "/api/v1/ai/apply-parsed", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("AI apply-parsed endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_GoalTypesEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/goals/types", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Goal types endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_TasksEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/tasks", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Tasks endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_TodoEndpoint_Unauthorized(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/api/v1/todo", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Todo endpoint without auth status = %v, want %v", rr.Code, http.StatusUnauthorized)
	}
}

func TestRouter_WithStaticFS(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()

	// Create a mock filesystem
	mockFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<html><body>Hello</body></html>"),
		},
		"assets/main.js": &fstest.MapFile{
			Data: []byte("console.log('test');"),
		},
	}

	r := New(handlers, rateLimiter, authMiddleware, "", mockFS)

	// Test root path serves index.html
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Root path status = %v, want %v", rr.Code, http.StatusOK)
	}

	// Test static file serving
	req = httptest.NewRequest("GET", "/assets/main.js", nil)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Static file status = %v, want %v", rr.Code, http.StatusOK)
	}
}

func TestRouter_SPARouting(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()

	// Create a mock filesystem with only index.html
	mockFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<html><body>SPA</body></html>"),
		},
	}

	r := New(handlers, rateLimiter, authMiddleware, "", mockFS)

	// Request non-existent path should fallback to index.html for SPA routing
	req := httptest.NewRequest("GET", "/some/spa/route", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Should serve index.html for SPA
	if rr.Code != http.StatusOK {
		t.Errorf("SPA route status = %v, want %v", rr.Code, http.StatusOK)
	}
}

func TestRouter_LandingPageIsPublic(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()

	mockFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<html><body>Landing</body></html>"),
		},
	}

	r := New(handlers, rateLimiter, authMiddleware, "", mockFS)

	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("landing page status = %v, want %v", rr.Code, http.StatusOK)
	}

	if body := rr.Body.String(); body != "<html><body>Landing</body></html>" {
		t.Fatalf("landing page body = %q, want %q", body, "<html><body>Landing</body></html>")
	}
}

func TestRouter_GoogleVerificationFileIsPublic(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()

	mockFS := fstest.MapFS{
		"google7bc42b08d60d96d7.html": &fstest.MapFile{
			Data: []byte("google-site-verification: google7bc42b08d60d96d7.html"),
		},
	}

	r := New(handlers, rateLimiter, authMiddleware, "", mockFS)

	req := httptest.NewRequest("GET", "/google7bc42b08d60d96d7.html", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("verification file status = %v, want %v", rr.Code, http.StatusOK)
	}

	if body := rr.Body.String(); body != "google-site-verification: google7bc42b08d60d96d7.html" {
		t.Fatalf("verification file body = %q, want %q", body, "google-site-verification: google7bc42b08d60d96d7.html")
	}
}

func TestRouter_RobotsTxtIncludesSitemapAndPrivateDisallows(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/robots.txt", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("robots.txt status = %v, want %v", rr.Code, http.StatusOK)
	}

	body := rr.Body.String()
	for _, expected := range []string{
		"Sitemap: https://coai.koyeb.app/sitemap.xml",
		"Disallow: /login",
		"Disallow: /register",
		"Disallow: /finapp",
		"Disallow: /api/",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("robots.txt missing %q in body %q", expected, body)
		}
	}
}

func TestRouter_SitemapXMLListsPublicPages(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/sitemap.xml", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("sitemap.xml status = %v, want %v", rr.Code, http.StatusOK)
	}

	body := rr.Body.String()
	for _, expected := range []string{
		"<loc>https://coai.koyeb.app/</loc>",
		"<loc>https://coai.koyeb.app/converter</loc>",
		"<loc>https://coai.koyeb.app/about</loc>",
		"<image:image>",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("sitemap.xml missing %q in body %q", expected, body)
		}
	}

	for _, unexpected := range []string{
		"https://coai.koyeb.app/login",
		"https://coai.koyeb.app/register",
	} {
		if strings.Contains(body, unexpected) {
			t.Fatalf("sitemap.xml unexpectedly contains %q", unexpected)
		}
	}
}

func TestRouter_CORSHeaders(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("Expected CORS header Access-Control-Allow-Origin to be http://localhost:5173, got %q", got)
	}
}

func TestRouter_CORSPreflight(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("OPTIONS", "/api/v1/currencies", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("OPTIONS request status = %v, want %v", rr.Code, http.StatusOK)
	}
}

// MockAuthService for testing protected routes
type MockAuthServiceForRouter struct {
	userID uuid.UUID
}

func (m *MockAuthServiceForRouter) ValidateToken(token string) (*service.JWTClaims, error) {
	return &service.JWTClaims{
		UserID: m.userID,
		Email:  "test@example.com",
	}, nil
}

func (m *MockAuthServiceForRouter) Register(ctx context.Context, req *model.RegisterRequest) (*model.AuthResponse, error) {
	return nil, nil
}

func (m *MockAuthServiceForRouter) Login(ctx context.Context, req *model.LoginRequest) (*model.AuthResponse, error) {
	return nil, nil
}

func (m *MockAuthServiceForRouter) GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	return nil, nil
}

// Test Handlers struct
func TestHandlers_Structure(t *testing.T) {
	h := &Handlers{}

	if h.Exchange != nil {
		t.Error("Expected Exchange to be nil initially")
	}
	if h.Auth != nil {
		t.Error("Expected Auth to be nil initially")
	}
	if h.Wallet != nil {
		t.Error("Expected Wallet to be nil initially")
	}
	if h.AI != nil {
		t.Error("Expected AI to be nil initially")
	}
}

func TestRouter_NotFoundRoute(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()
	r := New(handlers, rateLimiter, authMiddleware, "", nil)

	req := httptest.NewRequest("GET", "/nonexistent/api/route", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Without staticFS, non-matching routes return 404
	if rr.Code != http.StatusNotFound {
		t.Errorf("Non-existent route status = %v, want %v", rr.Code, http.StatusNotFound)
	}
}

// Test sub-filesystem functionality
type subFS struct {
	fs.FS
}

func TestRouter_StaticFS_EmptyPath(t *testing.T) {
	handlers, rateLimiter, authMiddleware := setupTestRouter()

	mockFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<html></html>"),
		},
	}

	r := New(handlers, rateLimiter, authMiddleware, "", mockFS)

	// Empty path should serve index.html
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Empty path status = %v, want %v", rr.Code, http.StatusOK)
	}
}
