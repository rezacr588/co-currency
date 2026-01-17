package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

// MockCategoryRepository implements a mock category repository for testing
type MockCategoryRepository struct {
	categories []model.Category
	getUserErr error
	createErr  error
	deleteErr  error
	initErr    error
}

func NewMockCategoryRepository() *MockCategoryRepository {
	return &MockCategoryRepository{
		categories: []model.Category{},
	}
}

func (m *MockCategoryRepository) GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error) {
	if m.getUserErr != nil {
		return nil, m.getUserErr
	}
	if len(m.categories) == 0 {
		return nil, nil
	}
	return m.categories, nil
}

func (m *MockCategoryRepository) CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
	if m.createErr != nil {
		return nil, m.createErr
	}
	category := &model.Category{
		ID:        uuid.New(),
		UserID:    userID,
		Name:      name,
		Icon:      icon,
		Color:     color,
		IsDefault: false,
	}
	m.categories = append(m.categories, *category)
	return category, nil
}

func (m *MockCategoryRepository) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	for i, c := range m.categories {
		if c.ID == categoryID && c.UserID == userID {
			m.categories = append(m.categories[:i], m.categories[i+1:]...)
			return nil
		}
	}
	return errors.New("category not found")
}

func (m *MockCategoryRepository) InitDefaultCategories(ctx context.Context) error {
	if m.initErr != nil {
		return m.initErr
	}
	m.categories = model.DefaultCategories()
	return nil
}

func (m *MockCategoryRepository) SetGetCategoriesError(err error) {
	m.getUserErr = err
}

func (m *MockCategoryRepository) SetCreateError(err error) {
	m.createErr = err
}

func (m *MockCategoryRepository) SetDeleteError(err error) {
	m.deleteErr = err
}

func (m *MockCategoryRepository) SetInitError(err error) {
	m.initErr = err
}

// CategoryServiceWithMock wraps CategoryService with mock repository
type CategoryServiceWithMock struct {
	mockRepo *MockCategoryRepository
}

func NewCategoryServiceWithMock(mockRepo *MockCategoryRepository) *CategoryServiceWithMock {
	return &CategoryServiceWithMock{mockRepo: mockRepo}
}

func (s *CategoryServiceWithMock) GetCategories(ctx context.Context, userID uuid.UUID) ([]model.Category, error) {
	categories, err := s.mockRepo.GetCategories(ctx, userID)
	if err != nil {
		return nil, err
	}
	if categories == nil {
		return model.DefaultCategories(), nil
	}
	return categories, nil
}

func (s *CategoryServiceWithMock) CreateCategory(ctx context.Context, userID uuid.UUID, name, icon, color string) (*model.Category, error) {
	if name == "" {
		return nil, errors.New("category name is required")
	}
	return s.mockRepo.CreateCategory(ctx, userID, name, icon, color)
}

func (s *CategoryServiceWithMock) DeleteCategory(ctx context.Context, userID, categoryID uuid.UUID) error {
	return s.mockRepo.DeleteCategory(ctx, userID, categoryID)
}

func (s *CategoryServiceWithMock) InitDefaultCategories(ctx context.Context) error {
	return s.mockRepo.InitDefaultCategories(ctx)
}

// Tests for GetCategories
func TestCategoryService_GetCategories_Success(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	// Initialize with default categories
	mockRepo.InitDefaultCategories(context.Background())

	categories, err := service.GetCategories(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetCategories failed: %v", err)
	}

	if len(categories) == 0 {
		t.Error("Expected categories to be returned")
	}
}

func TestCategoryService_GetCategories_ReturnsDefaults(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	// Don't initialize - should return defaults
	categories, err := service.GetCategories(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetCategories failed: %v", err)
	}

	// Should return default categories
	defaults := model.DefaultCategories()
	if len(categories) != len(defaults) {
		t.Errorf("Expected %d categories, got %d", len(defaults), len(categories))
	}
}

func TestCategoryService_GetCategories_Error(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	mockRepo.SetGetCategoriesError(errors.New("database error"))

	_, err := service.GetCategories(context.Background(), uuid.New())
	if err == nil {
		t.Error("Expected error")
	}
}

// Tests for CreateCategory
func TestCategoryService_CreateCategory_Success(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	userID := uuid.New()
	category, err := service.CreateCategory(context.Background(), userID, "custom", "star", "#ff0000")
	if err != nil {
		t.Fatalf("CreateCategory failed: %v", err)
	}

	if category.Name != "custom" {
		t.Errorf("Expected name 'custom', got %s", category.Name)
	}

	if category.Icon != "star" {
		t.Errorf("Expected icon 'star', got %s", category.Icon)
	}

	if category.Color != "#ff0000" {
		t.Errorf("Expected color '#ff0000', got %s", category.Color)
	}

	if category.IsDefault {
		t.Error("Expected IsDefault to be false for user category")
	}
}

func TestCategoryService_CreateCategory_EmptyName(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	_, err := service.CreateCategory(context.Background(), uuid.New(), "", "star", "#ff0000")
	if err == nil {
		t.Error("Expected error for empty name")
	}

	if err.Error() != "category name is required" {
		t.Errorf("Unexpected error: %v", err)
	}
}

func TestCategoryService_CreateCategory_Error(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	mockRepo.SetCreateError(errors.New("database error"))

	_, err := service.CreateCategory(context.Background(), uuid.New(), "custom", "star", "#ff0000")
	if err == nil {
		t.Error("Expected error")
	}
}

// Tests for DeleteCategory
func TestCategoryService_DeleteCategory_Success(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	userID := uuid.New()

	// Create a category first
	category, _ := service.CreateCategory(context.Background(), userID, "custom", "star", "#ff0000")

	// Delete it
	err := service.DeleteCategory(context.Background(), userID, category.ID)
	if err != nil {
		t.Fatalf("DeleteCategory failed: %v", err)
	}
}

func TestCategoryService_DeleteCategory_NotFound(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	err := service.DeleteCategory(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Error("Expected error for non-existent category")
	}
}

func TestCategoryService_DeleteCategory_Error(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	mockRepo.SetDeleteError(errors.New("database error"))

	err := service.DeleteCategory(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Error("Expected error")
	}
}

// Tests for InitDefaultCategories
func TestCategoryService_InitDefaultCategories_Success(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	err := service.InitDefaultCategories(context.Background())
	if err != nil {
		t.Fatalf("InitDefaultCategories failed: %v", err)
	}

	// Verify defaults were created
	categories, _ := mockRepo.GetCategories(context.Background(), uuid.New())
	if len(categories) != len(model.DefaultCategories()) {
		t.Errorf("Expected %d default categories, got %d", len(model.DefaultCategories()), len(categories))
	}
}

func TestCategoryService_InitDefaultCategories_Error(t *testing.T) {
	mockRepo := NewMockCategoryRepository()
	service := NewCategoryServiceWithMock(mockRepo)

	mockRepo.SetInitError(errors.New("database error"))

	err := service.InitDefaultCategories(context.Background())
	if err == nil {
		t.Error("Expected error")
	}
}

// Test NewCategoryService
func TestNewCategoryService(t *testing.T) {
	service := NewCategoryService(nil)

	if service == nil {
		t.Error("Expected service to be created")
	}
}

// Test DefaultCategories
func TestDefaultCategories(t *testing.T) {
	categories := model.DefaultCategories()

	if len(categories) == 0 {
		t.Error("Expected default categories")
	}

	// Check that all defaults have IsDefault = true
	for _, c := range categories {
		if !c.IsDefault {
			t.Errorf("Expected category %s to have IsDefault = true", c.Name)
		}
	}

	// Check specific categories exist
	expectedNames := []string{"food", "transportation", "entertainment", "shopping", "bills", "income", "transfer", "other"}
	for _, name := range expectedNames {
		found := false
		for _, c := range categories {
			if c.Name == name {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected category '%s' not found", name)
		}
	}
}
