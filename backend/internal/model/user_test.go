package model

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestUserToProfile(t *testing.T) {
	userID := uuid.New()
	now := time.Now()

	user := &User{
		ID:           userID,
		Email:        "test@example.com",
		PasswordHash: "hashedpassword",
		Name:         "Test User",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	profile := user.ToProfile()

	if profile.ID != userID {
		t.Errorf("Expected ID %s, got %s", userID, profile.ID)
	}

	if profile.Email != "test@example.com" {
		t.Errorf("Expected email test@example.com, got %s", profile.Email)
	}

	if profile.Name != "Test User" {
		t.Errorf("Expected name 'Test User', got %s", profile.Name)
	}

	if profile.CreatedAt != now {
		t.Errorf("Expected CreatedAt %v, got %v", now, profile.CreatedAt)
	}
}

func TestUserToProfile_EmptyName(t *testing.T) {
	userID := uuid.New()
	now := time.Now()

	user := &User{
		ID:           userID,
		Email:        "test@example.com",
		PasswordHash: "hashedpassword",
		Name:         "",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	profile := user.ToProfile()

	if profile.Name != "" {
		t.Errorf("Expected empty name, got %s", profile.Name)
	}
}

func TestUserStructure(t *testing.T) {
	user := &User{
		ID:           uuid.New(),
		Email:        "test@example.com",
		PasswordHash: "hashedpassword",
		Name:         "Test",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if user.ID == uuid.Nil {
		t.Error("Expected non-nil UUID")
	}

	if user.Email == "" {
		t.Error("Expected non-empty email")
	}

	if user.PasswordHash == "" {
		t.Error("Expected non-empty password hash")
	}
}

func TestUserProfileStructure(t *testing.T) {
	profile := &UserProfile{
		ID:        uuid.New(),
		Email:     "test@example.com",
		Name:      "Test",
		CreatedAt: time.Now(),
	}

	if profile.ID == uuid.Nil {
		t.Error("Expected non-nil UUID")
	}

	if profile.Email == "" {
		t.Error("Expected non-empty email")
	}
}

func TestRegisterRequest(t *testing.T) {
	req := &RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Name:     "Test User",
	}

	if req.Email != "test@example.com" {
		t.Errorf("Expected email test@example.com, got %s", req.Email)
	}

	if req.Password != "password123" {
		t.Errorf("Expected password password123, got %s", req.Password)
	}

	if req.Name != "Test User" {
		t.Errorf("Expected name 'Test User', got %s", req.Name)
	}
}

func TestLoginRequest(t *testing.T) {
	req := &LoginRequest{
		Email:    "test@example.com",
		Password: "password123",
	}

	if req.Email != "test@example.com" {
		t.Errorf("Expected email test@example.com, got %s", req.Email)
	}

	if req.Password != "password123" {
		t.Errorf("Expected password password123, got %s", req.Password)
	}
}

func TestAuthResponse(t *testing.T) {
	user := &User{
		ID:    uuid.New(),
		Email: "test@example.com",
		Name:  "Test",
	}

	resp := &AuthResponse{
		Token: "jwt-token",
		User:  user,
	}

	if resp.Token != "jwt-token" {
		t.Errorf("Expected token jwt-token, got %s", resp.Token)
	}

	if resp.User == nil {
		t.Error("Expected user to be set")
	}

	if resp.User.Email != "test@example.com" {
		t.Errorf("Expected user email test@example.com, got %s", resp.User.Email)
	}
}
