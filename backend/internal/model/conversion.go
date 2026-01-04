package model

import "time"

// ConversionResult is the response for convert endpoint
type ConversionResult struct {
	From      string    `json:"from"`
	To        string    `json:"to"`
	Amount    float64   `json:"amount"`
	Result    float64   `json:"result"`
	Rate      float64   `json:"rate"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConversionRequest represents the request parameters for conversion
type ConversionRequest struct {
	From   string  `json:"from"`
	To     string  `json:"to"`
	Amount float64 `json:"amount"`
}
