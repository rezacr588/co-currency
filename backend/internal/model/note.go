package model

import (
	"time"

	"github.com/google/uuid"
)

// Note represents a user's note
type Note struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Title     string     `json:"title"`
	Content   string     `json:"content"`
	Color     string     `json:"color,omitempty"`
	IsPinned  bool       `json:"is_pinned"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// CreateNoteRequest represents a request to create a note
type CreateNoteRequest struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	Color    string `json:"color,omitempty"`
	IsPinned bool   `json:"is_pinned,omitempty"`
}

// UpdateNoteRequest represents a request to update a note
type UpdateNoteRequest struct {
	Title    *string `json:"title,omitempty"`
	Content  *string `json:"content,omitempty"`
	Color    *string `json:"color,omitempty"`
	IsPinned *bool   `json:"is_pinned,omitempty"`
}

// NoteColors represents available note colors
var NoteColors = []string{
	"default",
	"red",
	"orange",
	"yellow",
	"green",
	"blue",
	"purple",
	"pink",
}
