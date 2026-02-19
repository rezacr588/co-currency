package model

import "time"

// NewsItem represents a financial news article
type NewsItem struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Source      string    `json:"source"`
	URL         string    `json:"url"`
	ImageURL    string    `json:"image_url,omitempty"`
	PublishedAt time.Time `json:"published_at"`
	Category    string    `json:"category"`
}
