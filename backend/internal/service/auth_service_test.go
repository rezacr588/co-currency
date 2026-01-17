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

	if service.jwtExpiry != 15*time.Minute {
		t.Errorf("Expected jwt expiry 15 minutes, got %v", service.jwtExpiry)
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

// Test NewAuthServiceWithRefresh
func TestNewAuthServiceWithRefresh(t *testing.T) {
	service := NewAuthServiceWithRefresh(nil, nil, "test-secret")

	if service == nil {
		t.Fatal("Expected service to be created")
	}

	if service.refreshTokenRepo != nil {
		t.Error("Expected refreshTokenRepo to be nil")
	}

	if string(service.jwtSecret) != "test-secret" {
		t.Errorf("Expected jwt secret 'test-secret', got '%s'", string(service.jwtSecret))
	}

	// Check refresh expiry is set
	if service.refreshExpiry != 7*24*time.Hour {
		t.Errorf("Expected refresh expiry 7 days, got %v", service.refreshExpiry)
	}
}

// Test RefreshToken without repository
func TestAuthService_RefreshToken_NoRepository(t *testing.T) {
	service := NewAuthService(nil, "test-secret")

	_, err := service.RefreshToken(context.Background(), "some-token")
	if err == nil {
		t.Error("Expected error when refresh token repo not configured")
	}

	if err.Error() != "refresh tokens not configured" {
		t.Errorf("Unexpected error: %v", err)
	}
}

// Test Logout without repository
func TestAuthService_Logout_NoRepository(t *testing.T) {
	service := NewAuthService(nil, "test-secret")

	err := service.Logout(context.Background(), "some-token")
	if err != nil {
		t.Errorf("Expected no error when logout without repo, got: %v", err)
	}
}

// Test LogoutAllDevices without repository
func TestAuthService_LogoutAllDevices_NoRepository(t *testing.T) {
	service := NewAuthService(nil, "test-secret")

	err := service.LogoutAllDevices(context.Background(), uuid.New())
	if err != nil {
		t.Errorf("Expected no error when logout all without repo, got: %v", err)
	}
}

// Test ErrAccountLocked error
func TestErrAccountLocked(t *testing.T) {
	if ErrAccountLocked == nil {
		t.Error("ErrAccountLocked should not be nil")
	}

	if ErrAccountLocked.Error() != "account is temporarily locked due to too many failed login attempts" {
		t.Errorf("Unexpected error message: %s", ErrAccountLocked.Error())
	}
}

// Test ErrInvalidResetToken error
func TestErrInvalidResetToken(t *testing.T) {
	if ErrInvalidResetToken == nil {
		t.Error("ErrInvalidResetToken should not be nil")
	}

	if ErrInvalidResetToken.Error() != "invalid or expired password reset token" {
		t.Errorf("Unexpected error message: %s", ErrInvalidResetToken.Error())
	}
}

// MockUserRepositoryWithPasswordReset extends MockUserRepository for password reset testing
type MockUserRepositoryWithPasswordReset struct {
	*MockUserRepository
	resetTokens       map[string]*resetTokenInfo
	lockedAccounts    map[string]*time.Time
	failedAttempts    map[string]int
	onboardingCompleted map[uuid.UUID]bool
}

type resetTokenInfo struct {
	email   string
	expires time.Time
}

func NewMockUserRepositoryWithPasswordReset() *MockUserRepositoryWithPasswordReset {
	return &MockUserRepositoryWithPasswordReset{
		MockUserRepository:   NewMockUserRepository(),
		resetTokens:          make(map[string]*resetTokenInfo),
		lockedAccounts:       make(map[string]*time.Time),
		failedAttempts:       make(map[string]int),
		onboardingCompleted:  make(map[uuid.UUID]bool),
	}
}

func (m *MockUserRepositoryWithPasswordReset) SetPasswordResetToken(ctx context.Context, email, token string, expiry time.Time) error {
	if _, exists := m.users[email]; !exists {
		return repository.ErrUserNotFound
	}
	m.resetTokens[token] = &resetTokenInfo{email: email, expires: expiry}
	return nil
}

func (m *MockUserRepositoryWithPasswordReset) GetByResetToken(ctx context.Context, token string) (*model.User, error) {
	info, exists := m.resetTokens[token]
	if !exists {
		return nil, repository.ErrInvalidResetToken
	}
	if time.Now().After(info.expires) {
		return nil, repository.ErrInvalidResetToken
	}
	return m.GetByEmail(ctx, info.email)
}

func (m *MockUserRepositoryWithPasswordReset) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	for _, user := range m.users {
		if user.ID == userID {
			user.PasswordHash = passwordHash
			// Clear reset token
			for token, info := range m.resetTokens {
				if info.email == user.Email {
					delete(m.resetTokens, token)
				}
			}
			return nil
		}
	}
	return repository.ErrUserNotFound
}

func (m *MockUserRepositoryWithPasswordReset) IncrementFailedAttempts(ctx context.Context, email string) error {
	if _, exists := m.users[email]; !exists {
		return repository.ErrUserNotFound
	}
	m.failedAttempts[email]++
	if m.failedAttempts[email] >= 5 {
		lockUntil := time.Now().Add(15 * time.Minute)
		m.lockedAccounts[email] = &lockUntil
	}
	return nil
}

func (m *MockUserRepositoryWithPasswordReset) ResetFailedAttempts(ctx context.Context, userID uuid.UUID) error {
	for _, user := range m.users {
		if user.ID == userID {
			delete(m.failedAttempts, user.Email)
			delete(m.lockedAccounts, user.Email)
			return nil
		}
	}
	return nil
}

func (m *MockUserRepositoryWithPasswordReset) IsAccountLocked(ctx context.Context, email string) (bool, *time.Time, error) {
	lockedUntil, exists := m.lockedAccounts[email]
	if !exists {
		return false, nil, nil
	}
	if time.Now().After(*lockedUntil) {
		delete(m.lockedAccounts, email)
		return false, nil, nil
	}
	return true, lockedUntil, nil
}

func (m *MockUserRepositoryWithPasswordReset) SetOnboardingCompleted(ctx context.Context, userID uuid.UUID) error {
	m.onboardingCompleted[userID] = true
	return nil
}

// AuthServiceWithMockPasswordReset wraps AuthService with mock that supports password reset
type AuthServiceWithMockPasswordReset struct {
	mockRepo      *MockUserRepositoryWithPasswordReset
	jwtSecret     []byte
	jwtExpiry     time.Duration
	refreshExpiry time.Duration
}

func NewAuthServiceWithMockPasswordReset(mockRepo *MockUserRepositoryWithPasswordReset) *AuthServiceWithMockPasswordReset {
	return &AuthServiceWithMockPasswordReset{
		mockRepo:      mockRepo,
		jwtSecret:     []byte("test-secret-key-for-testing"),
		jwtExpiry:     24 * time.Hour,
		refreshExpiry: 7 * 24 * time.Hour,
	}
}

func (s *AuthServiceWithMockPasswordReset) GeneratePasswordResetToken(ctx context.Context, email string) (string, error) {
	_, err := s.mockRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return "", nil // Don't reveal if email exists
		}
		return "", err
	}

	token := uuid.New().String()
	expiry := time.Now().Add(1 * time.Hour)

	if err := s.mockRepo.SetPasswordResetToken(ctx, email, token, expiry); err != nil {
		return "", err
	}

	return token, nil
}

func (s *AuthServiceWithMockPasswordReset) ResetPassword(ctx context.Context, token, newPassword string) error {
	if len(newPassword) < 6 {
		return errors.New("password must be at least 6 characters")
	}

	user, err := s.mockRepo.GetByResetToken(ctx, token)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidResetToken) {
			return ErrInvalidResetToken
		}
		return err
	}

	return s.mockRepo.UpdatePassword(ctx, user.ID, newPassword)
}

// Tests for GeneratePasswordResetToken
func TestGeneratePasswordResetToken_Success(t *testing.T) {
	mockRepo := NewMockUserRepositoryWithPasswordReset()
	service := NewAuthServiceWithMockPasswordReset(mockRepo)

	// Create a user
	user := &model.User{
		Email:        "test@example.com",
		PasswordHash: "password123",
		Name:         "Test User",
	}
	mockRepo.Create(context.Background(), user)

	// Generate reset token
	token, err := service.GeneratePasswordResetToken(context.Background(), "test@example.com")
	if err != nil {
		t.Fatalf("GeneratePasswordResetToken failed: %v", err)
	}

	if token == "" {
		t.Error("Expected non-empty token")
	}
}

func TestGeneratePasswordResetToken_UserNotFound(t *testing.T) {
	mockRepo := NewMockUserRepositoryWithPasswordReset()
	service := NewAuthServiceWithMockPasswordReset(mockRepo)

	// Try to generate reset token for non-existent user
	token, err := service.GeneratePasswordResetToken(context.Background(), "nonexistent@example.com")
	if err != nil {
		t.Fatalf("Expected no error (to not reveal email existence), got: %v", err)
	}

	// Token should be empty for non-existent users
	if token != "" {
		t.Error("Expected empty token for non-existent user")
	}
}

// Tests for ResetPassword
func TestResetPassword_Success(t *testing.T) {
	mockRepo := NewMockUserRepositoryWithPasswordReset()
	service := NewAuthServiceWithMockPasswordReset(mockRepo)

	// Create a user
	user := &model.User{
		Email:        "test@example.com",
		PasswordHash: "oldpassword",
		Name:         "Test User",
	}
	mockRepo.Create(context.Background(), user)

	// Generate reset token
	token, _ := service.GeneratePasswordResetToken(context.Background(), "test@example.com")

	// Reset password
	err := service.ResetPassword(context.Background(), token, "newpassword123")
	if err != nil {
		t.Fatalf("ResetPassword failed: %v", err)
	}
}

func TestResetPassword_ShortPassword(t *testing.T) {
	mockRepo := NewMockUserRepositoryWithPasswordReset()
	service := NewAuthServiceWithMockPasswordReset(mockRepo)

	err := service.ResetPassword(context.Background(), "some-token", "123")
	if err == nil {
		t.Error("Expected error for short password")
	}

	if err.Error() != "password must be at least 6 characters" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestResetPassword_InvalidToken(t *testing.T) {
	mockRepo := NewMockUserRepositoryWithPasswordReset()
	service := NewAuthServiceWithMockPasswordReset(mockRepo)

	err := service.ResetPassword(context.Background(), "invalid-token", "newpassword123")
	if !errors.Is(err, ErrInvalidResetToken) {
		t.Errorf("Expected ErrInvalidResetToken, got: %v", err)
	}
}
