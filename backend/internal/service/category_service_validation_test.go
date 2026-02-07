package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestCategoryService_CreateCategory_WhitespaceName(t *testing.T) {
	svc := NewCategoryService(nil)

	_, err := svc.CreateCategory(context.Background(), uuid.New(), "   ", "", "")
	if !errors.Is(err, ErrCategoryNameRequired) {
		t.Fatalf("expected ErrCategoryNameRequired, got %v", err)
	}
}
