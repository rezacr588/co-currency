package model

import "time"

// Rate represents an exchange rate
type Rate struct {
	Code   string  `json:"code"`
	Name   string  `json:"name"`
	Rate   float64 `json:"rate"`
	Change float64 `json:"change,omitempty"`
}

// RatesResponse is the response for rates endpoints
type RatesResponse struct {
	Base      string    `json:"base"`
	Date      string    `json:"date"`
	Rates     []Rate    `json:"rates"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FrankfurterRatesResponse represents the API response from Frankfurter
type FrankfurterRatesResponse struct {
	Amount float64            `json:"amount"`
	Base   string             `json:"base"`
	Date   string             `json:"date"`
	Rates  map[string]float64 `json:"rates"`
}
