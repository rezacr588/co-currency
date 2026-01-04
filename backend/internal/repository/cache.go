package repository

import (
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// Cache defines the cache interface
type Cache interface {
	Get(key string) (interface{}, bool)
	Set(key string, value interface{}, ttl time.Duration)
	Delete(key string)
}

// InMemoryCache implements Cache using go-cache
type InMemoryCache struct {
	cache *gocache.Cache
}

// NewInMemoryCache creates a new in-memory cache
func NewInMemoryCache(defaultTTL time.Duration) *InMemoryCache {
	return &InMemoryCache{
		cache: gocache.New(defaultTTL, defaultTTL*2),
	}
}

// Get retrieves a value from cache
func (c *InMemoryCache) Get(key string) (interface{}, bool) {
	return c.cache.Get(key)
}

// Set stores a value in cache
func (c *InMemoryCache) Set(key string, value interface{}, ttl time.Duration) {
	c.cache.Set(key, value, ttl)
}

// Delete removes a value from cache
func (c *InMemoryCache) Delete(key string) {
	c.cache.Delete(key)
}
