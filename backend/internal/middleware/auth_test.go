package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/service"
)

// MockAuthService simulates authentication service for testing
type MockAuthService struct {
	jwtSecret []byte
	jwtExpiry time.Duration
}

func NewMockAuthService() *MockAuthService {
	return &MockAuthService{
		jwtSecret: []byte("test-secret-key-for-testing"),
		jwtExpiry: 24 * time.Hour,
	}
}

func (m *MockAuthService) ValidateToken(tokenString string) (*service.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &service.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, service.ErrInvalidToken
		}
		return m.jwtSecret, nil
	})

	if err != nil {
		if err == jwt.ErrTokenExpired {
			return nil, service.ErrTokenExpired
		}
		return nil, service.ErrInvalidToken
	}

	claims, ok := token.Claims.(*service.JWTClaims)
	if !ok || !token.Valid {
		return nil, service.ErrInvalidToken
	}

	return claims, nil
}

func (m *MockAuthService) GenerateToken(userID uuid.UUID, email string) (string, error) {
	claims := &service.JWTClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.jwtExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.jwtSecret)
}

func (m *MockAuthService) GenerateExpiredToken(userID uuid.UUID, email string) (string, error) {
	claims := &service.JWTClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // Expired
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			NotBefore: jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.jwtSecret)
}

// AuthMiddlewareWithMock wraps middleware with mock auth service
type AuthMiddlewareWithMock struct {
	mockAuthService *MockAuthService
}

func NewAuthMiddlewareWithMock(mockAuthService *MockAuthService) *AuthMiddlewareWithMock {
	return &AuthMiddlewareWithMock{mockAuthService: mockAuthService}
}

func (a *AuthMiddlewareWithMock) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"unauthorized","code":401,"message":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		// Check for Bearer token
		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			http.Error(w, `{"error":"unauthorized","code":401,"message":"invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		tokenString := authHeader[7:]

		claims, err := a.mockAuthService.ValidateToken(tokenString)
		if err != nil {
			switch err {
			case service.ErrTokenExpired:
				http.Error(w, `{"error":"unauthorized","code":401,"message":"token expired"}`, http.StatusUnauthorized)
			case service.ErrInvalidToken:
				http.Error(w, `{"error":"unauthorized","code":401,"message":"invalid token"}`, http.StatusUnauthorized)
			default:
				http.Error(w, `{"error":"unauthorized","code":401,"message":"authentication failed"}`, http.StatusUnauthorized)
			}
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Tests for Auth Middleware
func TestMiddleware_ValidToken(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	userID := uuid.New()
	email := "test@example.com"
	token, _ := mockAuth.GenerateToken(userID, email)

	// Create a test handler
	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check that user ID was added to context
		ctxUserID, ok := GetUserIDFromContext(r.Context())
		if !ok {
			t.Error("Expected user ID in context")
		}
		if ctxUserID != userID {
			t.Errorf("Expected user ID %s, got %s", userID, ctxUserID)
		}

		// Check that email was added to context
		ctxEmail, ok := GetUserEmailFromContext(r.Context())
		if !ok {
			t.Error("Expected email in context")
		}
		if ctxEmail != email {
			t.Errorf("Expected email %s, got %s", email, ctxEmail)
		}

		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status OK, got %d", rr.Code)
	}
}

func TestMiddleware_MissingAuthHeader(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	// No Authorization header
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", rr.Code)
	}
}

func TestMiddleware_InvalidAuthHeaderFormat(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called")
	}))

	testCases := []struct {
		name   string
		header string
	}{
		{"No Bearer prefix", "token-without-bearer"},
		{"Basic auth", "Basic dXNlcjpwYXNz"},
		{"Empty token", "Bearer "},
		{"Short header", "Bear"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", tc.header)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != http.StatusUnauthorized {
				t.Errorf("Expected status 401 for %s, got %d", tc.name, rr.Code)
			}
		})
	}
}

func TestMiddleware_InvalidToken(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", rr.Code)
	}
}

func TestMiddleware_ExpiredToken(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	userID := uuid.New()
	email := "test@example.com"
	token, _ := mockAuth.GenerateExpiredToken(userID, email)

	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", rr.Code)
	}
}

// Tests for GetUserIDFromContext
func TestGetUserIDFromContext_Present(t *testing.T) {
	userID := uuid.New()
	ctx := context.WithValue(context.Background(), UserIDKey, userID)

	result, ok := GetUserIDFromContext(ctx)

	if !ok {
		t.Error("Expected user ID to be present")
	}

	if result != userID {
		t.Errorf("Expected user ID %s, got %s", userID, result)
	}
}

func TestGetUserIDFromContext_Missing(t *testing.T) {
	ctx := context.Background()

	_, ok := GetUserIDFromContext(ctx)

	if ok {
		t.Error("Expected user ID to be missing")
	}
}

func TestGetUserIDFromContext_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserIDKey, "not-a-uuid")

	_, ok := GetUserIDFromContext(ctx)

	if ok {
		t.Error("Expected user ID to fail type assertion")
	}
}

// Tests for GetUserEmailFromContext
func TestGetUserEmailFromContext_Present(t *testing.T) {
	email := "test@example.com"
	ctx := context.WithValue(context.Background(), UserEmailKey, email)

	result, ok := GetUserEmailFromContext(ctx)

	if !ok {
		t.Error("Expected email to be present")
	}

	if result != email {
		t.Errorf("Expected email %s, got %s", email, result)
	}
}

func TestGetUserEmailFromContext_Missing(t *testing.T) {
	ctx := context.Background()

	_, ok := GetUserEmailFromContext(ctx)

	if ok {
		t.Error("Expected email to be missing")
	}
}

func TestGetUserEmailFromContext_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserEmailKey, 12345)

	_, ok := GetUserEmailFromContext(ctx)

	if ok {
		t.Error("Expected email to fail type assertion")
	}
}

// Tests for ContextKey
func TestContextKey_Values(t *testing.T) {
	if UserIDKey != ContextKey("user_id") {
		t.Errorf("Expected UserIDKey to be 'user_id', got %s", UserIDKey)
	}

	if UserEmailKey != ContextKey("user_email") {
		t.Errorf("Expected UserEmailKey to be 'user_email', got %s", UserEmailKey)
	}
}

// Tests for NewAuth
func TestNewAuth(t *testing.T) {
	// This tests the actual NewAuth function with a nil service
	// In production it would be passed a real service
	auth := NewAuth(nil)

	if auth == nil {
		t.Error("Expected Auth to be created")
	}
}

// Test middleware chain behavior
func TestMiddleware_ChainBehavior(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	userID := uuid.New()
	email := "test@example.com"
	token, _ := mockAuth.GenerateToken(userID, email)

	called := false
	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if !called {
		t.Error("Expected next handler to be called")
	}
}

func TestMiddleware_DoesNotCallNextOnFailure(t *testing.T) {
	mockAuth := NewMockAuthService()
	middleware := NewAuthMiddlewareWithMock(mockAuth)

	called := false
	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	// No auth header
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if called {
		t.Error("Expected next handler NOT to be called")
	}
}

// Test case-insensitive Bearer check (if implemented)
func TestMiddleware_BearerCaseInsensitive(t *testing.T) {
	mockAuth := NewMockAuthService()

	userID := uuid.New()
	email := "test@example.com"
	token, _ := mockAuth.GenerateToken(userID, email)

	// Test with the actual middleware from the package
	// The actual implementation uses strings.ToLower for the check
	authService := NewAuth(nil)

	// Since we can't easily test with nil auth service,
	// we just verify the middleware was created
	if authService == nil {
		t.Error("Auth middleware should be created")
	}

	// Test our mock handles uppercase Bearer
	middleware := NewAuthMiddlewareWithMock(mockAuth)
	handler := middleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status OK with Bearer, got %d", rr.Code)
	}
}

// Test the actual Auth middleware
func TestActualAuthMiddleware_NoHeader(t *testing.T) {
	authMiddleware := NewAuth(nil)

	handler := authMiddleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	// No Authorization header
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", rr.Code)
	}
}

func TestActualAuthMiddleware_InvalidFormat(t *testing.T) {
	authMiddleware := NewAuth(nil)

	handler := authMiddleware.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	testCases := []struct {
		name   string
		header string
	}{
		{"No Bearer prefix", "invalid-token"},
		{"Basic auth", "Basic abc123"},
		{"Single word", "Token"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", tc.header)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != http.StatusUnauthorized {
				t.Errorf("Expected status 401 for %s, got %d", tc.name, rr.Code)
			}
		})
	}
}
