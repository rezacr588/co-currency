package model

import (
	"time"

	"github.com/google/uuid"
)

// Tag represents a transaction tag
type Tag struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateTagRequest represents a request to create a tag
type CreateTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color,omitempty"`
}

// TransactionWithTags extends Transaction with tags
type TransactionWithTags struct {
	Transaction
	Tags  []Tag  `json:"tags,omitempty"`
	Notes string `json:"notes,omitempty"`
}
