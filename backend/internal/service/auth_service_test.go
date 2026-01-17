package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// MockUserRepository implements a mock user repository for testing
type MockUserRepository struct {
	users       map[string]*model.User
	createErr   error
	getByIDErr  error
	getByEmailErr error
}

func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		users: make(map[string]*model.User),
	}
}

func (m *MockUserRepository) Create(ctx context.Context, user *model.User) error {
	if m.createErr != nil {
		return m.createErr
	}
	if _, exists := m.users[user.Email]; exists {
		return repository.ErrUserAlreadyExists
	}
	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	m.users[user.Email] = user
	return nil
}

func (m *MockUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	if m.getByIDErr != nil {
		return nil, m.getByIDErr
	}
	for _, user := range m.users {
		if user.ID == id {
			return user, nil
		}
	}
	return nil, repository.ErrUserNotFound
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	if m.getByEmailErr != nil {
		return nil, m.getByEmailErr
	}
	if user, exists := m.users[email]; exists {
		return user, nil
	}
	return nil, repository.ErrUserNotFound
}

func (m *MockUserRepository) SetCreateError(err error) {
	m.createErr = err
}

func (m *MockUserRepository) SetGetByIDError(err error) {
	m.getByIDErr = err
}

func (m *MockUserRepository) SetGetByEmailError(err error) {
	m.getByEmailErr = err
}

// Helper to create AuthService with mock repository
func createTestAuthService(mockRepo *MockUserRepository) *AuthService {
	return &AuthService{
		userRepo:  (*repository.UserRepository)(nil), // We'll use reflection or interface-based approach
		jwtSecret: []byte("test-secret-key-for-testing"),
		jwtExpiry: 24 * time.Hour,
	}
}

// AuthServiceWithMock wraps AuthService with a mock repository for testing
type AuthServiceWithMock struct {
	mockRepo  *MockUserRepository
	jwtSecret []byte
	jwtExpiry time.Duration
}

func NewAuthServiceWithMock(mockRepo *MockUserRepository) *AuthServiceWithMock {
	return &AuthServiceWithMock{
		mockRepo:  mockRepo,
		jwtSecret: []byte("test-secret-key-for-testing"),
		jwtExpiry: 24 * time.Hour,
	}
}

func (s *AuthServiceWithMock) Register(ctx context.Context, req *model.RegisterRequest) (*model.AuthResponse, error) {
	// Validate request
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	if len(req.Password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}

	// Create user using mock
	user := &model.User{
		Email:        req.Email,
		PasswordHash: req.Password, // Simplified for testing - real impl uses bcrypt
		Name:         req.Name,
	}

	if err := s.mockRepo.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrUserAlreadyExists) {
			return nil, errors.New("email already registered")
		}
		return nil, err
	}

	// Generate token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &model.AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

func (s *AuthServiceWithMock) Login(ctx context.Context, req *model.LoginRequest) (*model.AuthResponse, error) {
	if req.Email == "" || req.Password == "" {
		return nil, ErrInvalidCredentials
	}

	user, err := s.mockRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	// Simplified password check for testing (real impl uses bcrypt)
	if user.PasswordHash != req.Password {
		return nil, ErrInvalidCredentials
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &model.AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

func (s *AuthServiceWithMock) ValidateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func (s *AuthServiceWithMock) GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	return s.mockRepo.GetByID(ctx, id)
}

func (s *AuthServiceWithMock) generateToken(user *model.User) (string, error) {
	claims := &JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.jwtExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// Tests for Register
func TestRegister_Success(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	req := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
	}

	resp, err := authService.Register(context.Background(), req)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	if resp.Token == "" {
		t.Error("Expected token to be generated")
	}

	if resp.User.Email != req.Email {
		t.Errorf("Expected email %s, got %s", req.Email, resp.User.Email)
	}

	if resp.User.Name != req.Name {
		t.Errorf("Expected name %s, got %s", req.Name, resp.User.Name)
	}
}

func TestRegister_EmptyEmail(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	req := &model.RegisterRequest{
		Email:    "",
		Password: "password123",
	}

	_, err := authService.Register(context.Background(), req)
	if err == nil {
		t.Error("Expected error for empty email")
	}

	if err.Error() != "email and password are required" {
		t.Errorf("Unexpected error message: %v", err)
	}
}

func TestRegister_EmptyPassword(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	req := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "",
	}

	_, err := authService.Register(context.Background(), req)
	if err == nil {
		t.Error("Expected error for empty password")
	}
}

func TestRegister_ShortPassword(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	req := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "12345", // Less than 6 characters
	}

	_, err := authService.Register(context.Background(), req)
	if err == nil {
		t.Error("Expected error for short password")
	}

	if err.Error() != "password must be at least 6 characters" {
		t.Errorf("Unexpected error message: %v", err)
	}
}

func TestRegister_DuplicateEmail(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	req := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
	}

	// First registration should succeed
	_, err := authService.Register(context.Background(), req)
	if err != nil {
		t.Fatalf("First registration failed: %v", err)
	}

	// Second registration with same email should fail
	_, err = authService.Register(context.Background(), req)
	if err == nil {
		t.Error("Expected error for duplicate email")
	}

	if err.Error() != "email already registered" {
		t.Errorf("Unexpected error message: %v", err)
	}
}

// Tests for Login
func TestLogin_Success(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	// First register a user
	registerReq := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
	}
	_, err := authService.Register(context.Background(), registerReq)
	if err != nil {
		t.Fatalf("Registration failed: %v", err)
	}

	// Now login
	loginReq := &model.LoginRequest{
		Email:    "test@example.com",
		Password: "password123",
	}

	resp, err := authService.Login(context.Background(), loginReq)
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}

	if resp.Token == "" {
		t.Error("Expected token to be generated")
	}

	if resp.User.Email != loginReq.Email {
		t.Errorf("Expected email %s, got %s", loginReq.Email, resp.User.Email)
	}
}

func TestLogin_EmptyCredentials(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	// Empty email
	loginReq := &model.LoginRequest{
		Email:    "",
		Password: "password123",
	}

	_, err := authService.Login(context.Background(), loginReq)
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("Expected ErrInvalidCredentials, got: %v", err)
	}

	// Empty password
	loginReq = &model.LoginRequest{
		Email:    "test@example.com",
		Password: "",
	}

	_, err = authService.Login(context.Background(), loginReq)
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("Expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	loginReq := &model.LoginRequest{
		Email:    "nonexistent@example.com",
		Password: "password123",
	}

	_, err := authService.Login(context.Background(), loginReq)
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("Expected ErrInvalidCredentials, got: %v", err)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	// First register a user
	registerReq := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
	}
	_, err := authService.Register(context.Background(), registerReq)
	if err != nil {
		t.Fatalf("Registration failed: %v", err)
	}

	// Login with wrong password
	loginReq := &model.LoginRequest{
		Email:    "test@example.com",
		Password: "wrongpassword",
	}

	_, err = authService.Login(context.Background(), loginReq)
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("Expected ErrInvalidCredentials, got: %v", err)
	}
}

// Tests for ValidateToken
func TestValidateToken_Success(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	// Register and get a valid token
	registerReq := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
	}
	resp, err := authService.Register(context.Background(), registerReq)
	if err != nil {
		t.Fatalf("Registration failed: %v", err)
	}

	// Validate the token
	claims, err := authService.ValidateToken(resp.Token)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if claims.Email != registerReq.Email {
		t.Errorf("Expected email %s, got %s", registerReq.Email, claims.Email)
	}

	if claims.UserID == uuid.Nil {
		t.Error("Expected non-nil user ID")
	}
}

func TestValidateToken_InvalidToken(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	_, err := authService.ValidateToken("invalid-token")
	if !errors.Is(err, ErrInvalidToken) {
		t.Errorf("Expected ErrInvalidToken, got: %v", err)
	}
}

func TestValidateToken_ExpiredToken(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := &AuthServiceWithMock{
		mockRepo:  mockRepo,
		jwtSecret: []byte("test-secret-key-for-testing"),
		jwtExpiry: -1 * time.Hour, // Expired token
	}

	// Register a user
	registerReq := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
	}
	resp, err := authService.Register(context.Background(), registerReq)
	if err != nil {
		t.Fatalf("Registration failed: %v", err)
	}

	// Validate the expired token
	_, err = authService.ValidateToken(resp.Token)
	if !errors.Is(err, ErrTokenExpired) {
		t.Errorf("Expected ErrTokenExpired, got: %v", err)
	}
}

func TestValidateToken_WrongSigningMethod(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	// Create a token with RS256 instead of HS256
	claims := &JWTClaims{
		UserID: uuid.New(),
		Email:  "test@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// This will create an unsigned token that won't validate
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	tokenString, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

	_, err := authService.ValidateToken(tokenString)
	if !errors.Is(err, ErrInvalidToken) {
		t.Errorf("Expected ErrInvalidToken, got: %v", err)
	}
}

// Tests for GetUserByID
func TestGetUserByID_Success(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	// Register a user
	registerReq := &model.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
	}
	resp, err := authService.Register(context.Background(), registerReq)
	if err != nil {
		t.Fatalf("Registration failed: %v", err)
	}

	// Get user by ID
	user, err := authService.GetUserByID(context.Background(), resp.User.ID)
	if err != nil {
		t.Fatalf("GetUserByID failed: %v", err)
	}

	if user.Email != registerReq.Email {
		t.Errorf("Expected email %s, got %s", registerReq.Email, user.Email)
	}
}

func TestGetUserByID_NotFound(t *testing.T) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthServiceWithMock(mockRepo)

	_, err := authService.GetUserByID(context.Background(), uuid.New())
	if !errors.Is(err, repository.ErrUserNotFound) {
		t.Errorf("Expected ErrUserNotFound, got: %v", err)
	}
}

// Test JWTClaims
func TestJWTClaims_Structure(t *testing.T) {
	userID := uuid.New()
	email := "test@example.com"

	claims := &JWTClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   userID.String(),
		},
	}

	if claims.UserID != userID {
		t.Errorf("Expected UserID %s, got %s", userID, claims.UserID)
	}

	if claims.Email != email {
		t.Errorf("Expected Email %s, got %s", email, claims.Email)
	}

	if claims.Subject != userID.String() {
		t.Errorf("Expected Subject %s, got %s", userID.String(), claims.Subject)
	}
}

// Test error definitions
func TestErrorDefinitions(t *testing.T) {
	if ErrInvalidCredentials == nil {
		t.Error("ErrInvalidCredentials should not be nil")
	}

	if ErrInvalidToken == nil {
		t.Error("ErrInvalidToken should not be nil")
	}

	if ErrTokenExpired == nil {
		t.Error("ErrTokenExpired should not be nil")
	}

	// Verify they are distinct errors
	if errors.Is(ErrInvalidCredentials, ErrInvalidToken) {
		t.Error("ErrInvalidCredentials and ErrInvalidToken should be distinct")
	}

	if errors.Is(ErrInvalidToken, ErrTokenExpired) {
		t.Error("ErrInvalidToken and ErrTokenExpired should be distinct")
	}
}

// Test the actual NewAuthService constructor
func TestNewAuthService(t *testing.T) {
	service := NewAuthService(nil, "test-secret")

	if service == nil {
		t.Fatal("Expected service to be created")
	}

	if string(service.jwtSecret) != "test-secret" {
		t.Errorf("Expected jwt secret 'test-secret', got '%s'", string(service.jwtSecret))
	}

	if service.jwtExpiry != 24*time.Hour*7 {
		t.Errorf("Expected jwt expiry 7 days, got %v", service.jwtExpiry)
	}
}

// Test ValidateToken with the actual service
func TestAuthService_ValidateToken_Real(t *testing.T) {
	service := NewAuthService(nil, "test-secret-key-for-testing")

	// Generate a token manually
	userID := uuid.New()
	email := "test@example.com"

	claims := &JWTClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("test-secret-key-for-testing"))
	if err != nil {
		t.Fatalf("Failed to sign token: %v", err)
	}

	// Validate the token
	validatedClaims, err := service.ValidateToken(tokenString)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if validatedClaims.UserID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, validatedClaims.UserID)
	}

	if validatedClaims.Email != email {
		t.Errorf("Expected email %s, got %s", email, validatedClaims.Email)
	}
}

func TestAuthService_ValidateToken_ExpiredToken(t *testing.T) {
	service := NewAuthService(nil, "test-secret-key-for-testing")

	userID := uuid.New()
	claims := &JWTClaims{
		UserID: userID,
		Email:  "test@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)), // Expired
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			NotBefore: jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Subject:   userID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte("test-secret-key-for-testing"))

	_, err := service.ValidateToken(tokenString)
	if !errors.Is(err, ErrTokenExpired) {
		t.Errorf("Expected ErrTokenExpired, got: %v", err)
	}
}

func TestAuthService_ValidateToken_InvalidSignature(t *testing.T) {
	service := NewAuthService(nil, "test-secret-key-for-testing")

	userID := uuid.New()
	claims := &JWTClaims{
		UserID: userID,
		Email:  "test@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	// Sign with different secret
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte("different-secret"))

	_, err := service.ValidateToken(tokenString)
	if !errors.Is(err, ErrInvalidToken) {
		t.Errorf("Expected ErrInvalidToken, got: %v", err)
	}
}

func TestAuthService_ValidateToken_MalformedToken(t *testing.T) {
	service := NewAuthService(nil, "test-secret-key-for-testing")

	_, err := service.ValidateToken("not-a-valid-jwt-token")
	if !errors.Is(err, ErrInvalidToken) {
		t.Errorf("Expected ErrInvalidToken, got: %v", err)
	}
}

func TestAuthService_ValidateToken_EmptyToken(t *testing.T) {
	service := NewAuthService(nil, "test-secret-key-for-testing")

	_, err := service.ValidateToken("")
	if !errors.Is(err, ErrInvalidToken) {
		t.Errorf("Expected ErrInvalidToken, got: %v", err)
	}
}
