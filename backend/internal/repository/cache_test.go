package repository

import (
	"testing"
	"time"
)

func TestInMemoryCache(t *testing.T) {
	cache := NewInMemoryCache(5 * time.Minute)

	// Test Set and Get
	cache.Set("key1", "value1", 5*time.Minute)
	got, found := cache.Get("key1")
	if !found {
		t.Error("Get() found = false, want true")
	}
	if got != "value1" {
		t.Errorf("Get() = %v, want %v", got, "value1")
	}

	// Test non-existent key
	_, found = cache.Get("nonexistent")
	if found {
		t.Error("Get() found = true for non-existent key, want false")
	}

	// Test Delete
	cache.Delete("key1")
	_, found = cache.Get("key1")
	if found {
		t.Error("Get() found = true after Delete(), want false")
	}
}

func TestInMemoryCache_Expiration(t *testing.T) {
	cache := NewInMemoryCache(50 * time.Millisecond)

	cache.Set("expiring", "value", 50*time.Millisecond)

	// Should exist immediately
	_, found := cache.Get("expiring")
	if !found {
		t.Error("Get() found = false immediately after Set(), want true")
	}

	// Wait for expiration
	time.Sleep(100 * time.Millisecond)

	_, found = cache.Get("expiring")
	if found {
		t.Error("Get() found = true after expiration, want false")
	}
}

func TestInMemoryCache_DifferentTypes(t *testing.T) {
	cache := NewInMemoryCache(5 * time.Minute)

	// Test with different types
	cache.Set("string", "hello", 5*time.Minute)
	cache.Set("int", 42, 5*time.Minute)
	cache.Set("struct", struct{ Name string }{"test"}, 5*time.Minute)

	if got, _ := cache.Get("string"); got != "hello" {
		t.Errorf("Get(string) = %v, want hello", got)
	}
	if got, _ := cache.Get("int"); got != 42 {
		t.Errorf("Get(int) = %v, want 42", got)
	}
	if got, _ := cache.Get("struct"); got.(struct{ Name string }).Name != "test" {
		t.Errorf("Get(struct).Name = %v, want test", got)
	}
}
