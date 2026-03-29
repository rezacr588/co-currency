package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var (
	ErrCategoryNameRequired = errors.New("category name is required")
)

// CategoryService handles category operations
type CategoryService struct {
	categoryRepo *repository.CategoryRepository
	cache        *gocache.Cache
}

// NewCategoryService creates a new CategoryService
func NewCategoryService(categoryRepo *repository.CategoryRepository) *CategoryService {
	return &CategoryService{
		categoryRepo: categoryRepo,
		cache:        gocache.New(5*time.Minute, 10*time.Minute),
	}
}

// GetCategories retrieves all categories for a user
func (s *CategoryService) GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error) {
	cacheKey := "categories:" + userID.String()
	if cached, found := s.cache.Get(cacheKey); found {
		if categories, ok := cached.([]model.Category); ok {
			return categories, nil
		}
	}

	categories, err := s.categoryRepo.GetCategories(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting categories: %w", err)
	}

	if categories == nil {
		categories = model.DefaultCategories()
	}

	s.cache.Set(cacheKey, categories, gocache.DefaultExpiration)
	return categories, nil
}

// CreateCategory creates a new user category
func (s *CategoryService) CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
	normalized := strings.TrimSpace(name)
	if normalized == "" {
		return nil, ErrCategoryNameRequired
	}

	category, err := s.categoryRepo.CreateCategory(ctx, userID, normalized, icon, color)
	if err != nil {
		return nil, fmt.Errorf("creating category: %w", err)
	}

	s.cache.Delete("categories:" + userID.String())
	return category, nil
}

// DeleteCategory deletes a user category
func (s *CategoryService) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	if err := s.categoryRepo.DeleteCategory(ctx, userID, categoryID); err != nil {
		return fmt.Errorf("deleting category: %w", err)
	}
	s.cache.Delete("categories:" + userID.String())
	return nil
}

// InitDefaultCategories initializes default categories
func (s *CategoryService) InitDefaultCategories(ctx context.Context) error {
	return s.categoryRepo.InitDefaultCategories(ctx)
}
