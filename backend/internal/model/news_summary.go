package model

import "time"

// AINewsSummary represents a daily AI-generated summary of worldwide news.
type AINewsSummary struct {
	Date            time.Time `json:"date"`
	Summary         string    `json:"summary"`
	Recommendations []string  `json:"recommendations"`
	Sentiment       string    `json:"sentiment"`          // e.g., positive, negative, neutral, volatile
	HasBreakingNews bool      `json:"has_breaking_news"` // AI determines if there is a globally critical breaking event
}
