package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// CategoryService handles category operations
type CategoryService struct {
	categoryRepo *repository.CategoryRepository
}

// NewCategoryService creates a new CategoryService
func NewCategoryService(categoryRepo *repository.CategoryRepository) *CategoryService {
	return &CategoryService{categoryRepo: categoryRepo}
}

// GetCategories retrieves all categories for a user
func (s *CategoryService) GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error) {
	categories, err := s.categoryRepo.GetCategories(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting categories: %w", err)
	}

	if categories == nil {
		categories = model.DefaultCategories()
	}

	return categories, nil
}

// CreateCategory creates a new user category
func (s *CategoryService) CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
	if name == "" {
		return nil, fmt.Errorf("category name is required")
	}

	category, err := s.categoryRepo.CreateCategory(ctx, userID, name, icon, color)
	if err != nil {
		return nil, fmt.Errorf("creating category: %w", err)
	}

	return category, nil
}

// DeleteCategory deletes a user category
func (s *CategoryService) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	if err := s.categoryRepo.DeleteCategory(ctx, userID, categoryID); err != nil {
		return fmt.Errorf("deleting category: %w", err)
	}
	return nil
}

// InitDefaultCategories initializes default categories
func (s *CategoryService) InitDefaultCategories(ctx context.Context) error {
	return s.categoryRepo.InitDefaultCategories(ctx)
}
