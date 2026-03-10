package model

import (
	"time"

	"github.com/google/uuid"
)

// InflationRate represents a historical inflation record
type InflationRate struct {
	ID           uuid.UUID `json:"id"`
	CountryCode  string    `json:"country_code"`
	CurrencyCode string    `json:"currency_code"`
	Year         int       `json:"year"`
	Month        int       `json:"month"`
	AnnualRate   float64   `json:"annual_rate"`
	MonthlyRate  *float64  `json:"monthly_rate,omitempty"`
	CPIIndex     *float64  `json:"cpi_index,omitempty"`
	Source       string    `json:"source"`
	FetchedAt    time.Time `json:"fetched_at"`
	CreatedAt    time.Time `json:"created_at"`
}

// InflationLatest represents the current inflation rate for a currency
type InflationLatest struct {
	CurrencyCode string    `json:"currency_code"`
	CountryCode  string    `json:"country_code"`
	AnnualRate   float64   `json:"annual_rate"`
	MonthlyRate  *float64  `json:"monthly_rate,omitempty"`
	Source       string    `json:"source"`
	DataDate     time.Time `json:"data_date"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// WealthAlert represents a user-facing alert for currency/inflation events
type WealthAlert struct {
	ID             uuid.UUID `json:"id"`
	UserID         uuid.UUID `json:"user_id"`
	AlertType      string    `json:"alert_type"`
	CurrencyCode   string    `json:"currency_code,omitempty"`
	ThresholdValue *float64  `json:"threshold_value,omitempty"`
	Message        string    `json:"message"`
	IsRead         bool      `json:"is_read"`
	CreatedAt      time.Time `json:"created_at"`
}

// WealthOverview is the API response for purchasing power analysis
type WealthOverview struct {
	NominalTotal           float64            `json:"nominal_total"`
	RealTotal              float64            `json:"real_total"`
	ErosionAmount          float64            `json:"erosion_amount"`
	ErosionRate            float64            `json:"erosion_rate"`
	ShieldScore            int                `json:"shield_score"`
	ShieldLabel            string             `json:"shield_label"`
	ShieldTrend            string             `json:"shield_trend"`
	Currency               string             `json:"currency"`
	Headline               string             `json:"headline"`
	CurrencyBreakdown      []CurrencyExposure `json:"currency_breakdown"`
	InflationDataAvailable bool               `json:"inflation_data_available"`
}

// CurrencyExposure represents per-currency inflation exposure
type CurrencyExposure struct {
	Currency        string  `json:"currency"`
	NominalBalance  float64 `json:"nominal_balance"`
	RealBalance     float64 `json:"real_balance"`
	AnnualInflation float64 `json:"annual_inflation"`
	SharePercentage float64 `json:"share_percentage"`
	ErosionAmount   float64 `json:"erosion_amount"`
}

// WealthHistoryPoint represents a single data point in wealth history
type WealthHistoryPoint struct {
	Date          string  `json:"date"`
	NominalValue  float64 `json:"nominal_value"`
	RealValue     float64 `json:"real_value"`
	InflationRate float64 `json:"inflation_rate"`
}

// WealthHistory is the API response for historical purchasing power
type WealthHistory struct {
	DataPoints   []WealthHistoryPoint `json:"data_points"`
	Currency     string               `json:"currency"`
	TotalErosion float64              `json:"total_erosion"`
}

// WhatIfResult is the API response for counterfactual analysis
type WhatIfResult struct {
	ActualValue          float64 `json:"actual_value"`
	HypotheticalValue    float64 `json:"hypothetical_value"`
	Difference           float64 `json:"difference"`
	DifferencePercentage float64 `json:"difference_percentage"`
	Explanation          string  `json:"explanation"`
	FromCurrency         string  `json:"from_currency"`
	ToCurrency           string  `json:"to_currency"`
	Amount               float64 `json:"amount"`
	MonthsAgo            int     `json:"months_ago"`
}

// CurrencyInflation provides per-currency inflation info for AI context
type CurrencyInflation struct {
	Currency      string  `json:"currency"`
	Balance       float64 `json:"balance"`
	AnnualRate    float64 `json:"annual_rate"`
	RealBalance   float64 `json:"real_balance"`
	ErosionAmount float64 `json:"erosion_amount"`
}

// WealthShieldScore contains the composite score breakdown
type WealthShieldScore struct {
	Total            int     `json:"total"`
	Label            string  `json:"label"`
	Diversification  float64 `json:"diversification"`
	LowInflation     float64 `json:"low_inflation"`
	SavingsRate      float64 `json:"savings_rate"`
	ActiveHedging    float64 `json:"active_hedging"`
}

// CurrencyCountryMap maps currency codes to country codes for inflation lookups
var CurrencyCountryMap = map[string]string{
	"USD": "US", "EUR": "DE", "GBP": "GB", "JPY": "JP", "CHF": "CH",
	"CAD": "CA", "AUD": "AU", "TRY": "TR", "IRR": "IR", "AED": "AE",
	"SAR": "SA", "QAR": "QA", "KWD": "KW", "BHD": "BH", "EGP": "EG",
	"IQD": "IQ", "JOD": "JO", "LBP": "LB", "OMR": "OM", "CNY": "CN",
	"INR": "IN", "KRW": "KR", "SGD": "SG", "HKD": "HK", "THB": "TH",
	"MYR": "MY", "BRL": "BR", "MXN": "MX", "ZAR": "ZA", "RUB": "RU",
	"SEK": "SE", "NOK": "NO", "DKK": "DK", "NZD": "NZ", "PLN": "PL",
	"IDR": "ID", "HUF": "HU", "CZK": "CZ", "ILS": "IL", "PHP": "PH",
	"RON": "RO", "BGN": "BG", "ISK": "IS",
}

// DefaultInflationRates provides fallback rates when API is unavailable
var DefaultInflationRates = map[string]float64{
	"USD": 3.0, "EUR": 2.5, "GBP": 3.5, "JPY": 3.0, "CHF": 1.5,
	"CAD": 3.0, "AUD": 3.5, "TRY": 50.0, "IRR": 40.0, "AED": 2.5,
	"SAR": 2.0, "CNY": 1.5, "INR": 5.0, "KRW": 3.5, "SGD": 3.0,
	"HKD": 2.5, "THB": 2.0, "MYR": 3.0, "BRL": 4.5, "MXN": 5.0,
	"ZAR": 5.5, "RUB": 8.0, "SEK": 2.5, "NOK": 3.0, "DKK": 2.5,
}

// GetShieldLabel returns a human-readable label for a shield score
func GetShieldLabel(score int) string {
	switch {
	case score >= 80:
		return "Excellent"
	case score >= 60:
		return "Good"
	case score >= 40:
		return "Fair"
	case score >= 20:
		return "Weak"
	default:
		return "Critical"
	}
}
