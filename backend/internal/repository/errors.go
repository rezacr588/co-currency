package repository

import "errors"

// Sentinel errors for repository operations.
var (
	// User errors
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrAccountLocked     = errors.New("account is temporarily locked")
	ErrInvalidResetToken = errors.New("invalid or expired reset token")

	// Auth token errors
	ErrRefreshTokenNotFound = errors.New("refresh token not found")
	ErrRefreshTokenExpired  = errors.New("refresh token expired")

	// OAuth errors
	ErrOAuthStateNotFound = errors.New("oauth state not found")
	ErrOAuthStateExpired  = errors.New("oauth state expired")

	// Wallet errors
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrBalanceNotFound     = errors.New("balance not found")
	ErrTransactionNotFound = errors.New("transaction not found")

	// Category errors
	ErrCategoryNotFound         = errors.New("category not found")
	ErrCategoryDefaultProtected = errors.New("default category cannot be deleted")
	ErrCategoryAlreadyExists    = errors.New("category already exists")

	// Tag errors
	ErrTagNotFound = errors.New("tag not found")
	ErrTagExists   = errors.New("tag already exists")

	// Goal errors
	ErrGoalNotFound = errors.New("goal not found")

	// Budget errors
	ErrBudgetNotFound = errors.New("budget not found")
	ErrBudgetExists   = errors.New("budget already exists for this category and period")

	// Recurring errors
	ErrRecurringNotFound = errors.New("recurring transaction not found")

	// Subscription errors
	ErrSubscriptionNotFound = errors.New("subscription not found")

	// Note errors
	ErrNoteNotFound = errors.New("note not found")

	// Task errors
	ErrTaskNotFound = errors.New("task not found")
)
