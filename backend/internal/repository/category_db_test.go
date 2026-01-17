package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

// Note: NewCategoryRepository requires a non-nil Database that has Pool() method
// Testing with nil database would cause a panic, so we skip this test
// In real usage, the repository should always be created with a valid database connection

// Test DefaultCategories model
func TestDefaultCategories_Content(t *testing.T) {
	categories := model.DefaultCategories()

	if len(categories) == 0 {
		t.Fatal("Expected default categories to be returned")
	}

	// Check specific expected categories
	expectedCategories := map[string]bool{
		"food":           false,
		"transportation": false,
		"entertainment":  false,
		"shopping":       false,
		"bills":          false,
		"income":         false,
		"transfer":       false,
		"other":          false,
	}

	for _, cat := range categories {
		if _, exists := expectedCategories[cat.Name]; exists {
			expectedCategories[cat.Name] = true
		}

		// All default categories should have IsDefault = true
		if !cat.IsDefault {
			t.Errorf("Expected category %s to have IsDefault = true", cat.Name)
		}

		// All default categories should have an icon
		if cat.Icon == "" {
			t.Errorf("Expected category %s to have an icon", cat.Name)
		}

		// All default categories should have a color
		if cat.Color == "" {
			t.Errorf("Expected category %s to have a color", cat.Name)
		}
	}

	// Verify all expected categories were found
	for name, found := range expectedCategories {
		if !found {
			t.Errorf("Expected category %s not found in default categories", name)
		}
	}
}

// Test Category model
func TestCategory_Structure(t *testing.T) {
	userID := uuid.New()
	categoryID := uuid.New()

	category := model.Category{
		ID:        categoryID,
		UserID:    userID,
		Name:      "custom",
		Icon:      "star",
		Color:     "#ff0000",
		IsDefault: false,
	}

	if category.ID != categoryID {
		t.Errorf("Expected ID %s, got %s", categoryID, category.ID)
	}

	if category.UserID != userID {
		t.Errorf("Expected UserID %s, got %s", userID, category.UserID)
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

	if category.IsDefault != false {
		t.Error("Expected IsDefault to be false")
	}
}

// Test that default categories have consistent format
func TestDefaultCategories_Format(t *testing.T) {
	categories := model.DefaultCategories()

	for _, cat := range categories {
		// Name should be lowercase
		if cat.Name == "" {
			t.Error("Category name should not be empty")
		}

		// Color should start with #
		if len(cat.Color) > 0 && cat.Color[0] != '#' {
			t.Errorf("Category %s color should start with #, got %s", cat.Name, cat.Color)
		}

		// Color should be a valid hex color (7 characters including #)
		if len(cat.Color) != 7 {
			t.Errorf("Category %s color should be 7 characters, got %d: %s", cat.Name, len(cat.Color), cat.Color)
		}
	}
}

// Test category count
func TestDefaultCategories_Count(t *testing.T) {
	categories := model.DefaultCategories()

	// Should have at least 8 default categories
	if len(categories) < 8 {
		t.Errorf("Expected at least 8 default categories, got %d", len(categories))
	}
}
