package model

// PersonalizedAdvice represents an AI-generated financial advice tip
type PersonalizedAdvice struct {
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	Category string `json:"category"` // spending, saving, budgeting, investing, general
	IsAI     bool   `json:"is_ai"`
}
