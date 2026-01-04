package service

import (
	"context"
	"fmt"
	"time"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// ExchangeService handles currency exchange operations
type ExchangeService struct {
	client    *repository.FrankfurterClient
	irrClient *repository.IRRClient
	cache     repository.Cache
	config    *config.Config
}

// NewExchangeService creates a new exchange service
func NewExchangeService(cfg *config.Config, client *repository.FrankfurterClient, cache repository.Cache) *ExchangeService {
	return &ExchangeService{
		client:    client,
		irrClient: repository.NewIRRClient(),
		cache:     cache,
		config:    cfg,
	}
}

// GetLatestRates returns the latest exchange rates for a base currency
func (s *ExchangeService) GetLatestRates(ctx context.Context, base string) (*model.RatesResponse, error) {
	cacheKey := fmt.Sprintf("rates:latest:%s", base)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		if rates, ok := cached.(*model.RatesResponse); ok {
			return rates, nil
		}
	}

	// Fetch from API
	apiRates, err := s.client.GetLatestRates(ctx, base)
	if err != nil {
		return nil, fmt.Errorf("fetching rates: %w", err)
	}

	// Transform to our response format
	rates := s.transformRates(apiRates)

	// Cache the result
	s.cache.Set(cacheKey, rates, s.config.CacheTTL)

	return rates, nil
}

// GetHistoricalRates returns historical exchange rates for a specific date
func (s *ExchangeService) GetHistoricalRates(ctx context.Context, date, base string) (*model.RatesResponse, error) {
	cacheKey := fmt.Sprintf("rates:historical:%s:%s", date, base)

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		if rates, ok := cached.(*model.RatesResponse); ok {
			return rates, nil
		}
	}

	// Fetch from API
	apiRates, err := s.client.GetHistoricalRates(ctx, date, base)
	if err != nil {
		return nil, fmt.Errorf("fetching historical rates: %w", err)
	}

	// Transform to our response format
	rates := s.transformRates(apiRates)

	// Cache the result (historical rates can be cached longer)
	s.cache.Set(cacheKey, rates, s.config.CacheTTL*12) // 1 hour for historical

	return rates, nil
}

// Convert performs a currency conversion
func (s *ExchangeService) Convert(ctx context.Context, from, to string, amount float64) (*model.ConversionResult, error) {
	// Handle IRR conversions separately
	if repository.IsIRRCurrency(from) || repository.IsIRRCurrency(to) {
		return s.convertWithIRR(ctx, from, to, amount)
	}

	// Get latest rates for conversion
	rates, err := s.GetLatestRates(ctx, from)
	if err != nil {
		return nil, fmt.Errorf("getting rates for conversion: %w", err)
	}

	// Find the target rate
	var rate float64
	for _, r := range rates.Rates {
		if r.Code == to {
			rate = r.Rate
			break
		}
	}

	if rate == 0 {
		return nil, fmt.Errorf("rate not found for currency: %s", to)
	}

	result := &model.ConversionResult{
		From:      from,
		To:        to,
		Amount:    amount,
		Result:    amount * rate,
		Rate:      rate,
		UpdatedAt: rates.UpdatedAt,
	}

	return result, nil
}

// convertWithIRR handles conversions involving Iranian Rial
func (s *ExchangeService) convertWithIRR(ctx context.Context, from, to string, amount float64) (*model.ConversionResult, error) {
	var resultAmount, rate float64
	var err error

	if repository.IsIRRCurrency(from) {
		// Converting FROM IRR to another currency
		if !repository.IsSupportedForIRR(to) {
			// Need to convert IRR -> USD -> target
			// First convert IRR to USD
			usdAmount, usdRate, err := s.irrClient.ConvertFromIRR(ctx, "USD", amount)
			if err != nil {
				return nil, fmt.Errorf("converting from IRR to USD: %w", err)
			}

			if to == "USD" {
				resultAmount = usdAmount
				rate = usdRate
			} else {
				// Then convert USD to target currency using Frankfurter
				rates, err := s.GetLatestRates(ctx, "USD")
				if err != nil {
					return nil, fmt.Errorf("getting rates for USD: %w", err)
				}

				var targetRate float64
				for _, r := range rates.Rates {
					if r.Code == to {
						targetRate = r.Rate
						break
					}
				}

				if targetRate == 0 {
					return nil, fmt.Errorf("rate not found for currency: %s", to)
				}

				resultAmount = usdAmount * targetRate
				rate = usdRate * targetRate
			}
		} else {
			// Direct IRR -> USD/EUR/GBP conversion
			resultAmount, rate, err = s.irrClient.ConvertFromIRR(ctx, to, amount)
			if err != nil {
				return nil, fmt.Errorf("converting from IRR: %w", err)
			}
		}
	} else {
		// Converting TO IRR from another currency
		if !repository.IsSupportedForIRR(from) {
			// Need to convert source -> USD -> IRR
			// First convert source to USD using Frankfurter
			rates, err := s.GetLatestRates(ctx, from)
			if err != nil {
				return nil, fmt.Errorf("getting rates for %s: %w", from, err)
			}

			var usdRate float64
			for _, r := range rates.Rates {
				if r.Code == "USD" {
					usdRate = r.Rate
					break
				}
			}

			if usdRate == 0 {
				return nil, fmt.Errorf("USD rate not found for currency: %s", from)
			}

			usdAmount := amount * usdRate

			// Then convert USD to IRR
			var irrRate float64
			resultAmount, irrRate, err = s.irrClient.ConvertToIRR(ctx, "USD", usdAmount)
			if err != nil {
				return nil, fmt.Errorf("converting USD to IRR: %w", err)
			}

			rate = usdRate * irrRate
		} else {
			// Direct USD/EUR/GBP -> IRR conversion
			resultAmount, rate, err = s.irrClient.ConvertToIRR(ctx, from, amount)
			if err != nil {
				return nil, fmt.Errorf("converting to IRR: %w", err)
			}
		}
	}

	return &model.ConversionResult{
		From:      from,
		To:        to,
		Amount:    amount,
		Result:    resultAmount,
		Rate:      rate,
		UpdatedAt: time.Now(),
	}, nil
}

// GetCurrencies returns all available currencies
func (s *ExchangeService) GetCurrencies(ctx context.Context) ([]model.Currency, error) {
	cacheKey := "currencies:all"

	// Check cache first
	if cached, found := s.cache.Get(cacheKey); found {
		if currencies, ok := cached.([]model.Currency); ok {
			return currencies, nil
		}
	}

	// Use our static currency list with metadata
	currencies := model.GetAllCurrencies()

	// Cache the result
	s.cache.Set(cacheKey, currencies, s.config.CacheTTL*12) // 1 hour

	return currencies, nil
}

func (s *ExchangeService) transformRates(apiRates *model.FrankfurterRatesResponse) *model.RatesResponse {
	rates := make([]model.Rate, 0, len(apiRates.Rates))

	for code, rate := range apiRates.Rates {
		currency, ok := model.GetCurrency(code)
		name := code
		if ok {
			name = currency.Name
		}

		rates = append(rates, model.Rate{
			Code: code,
			Name: name,
			Rate: rate,
		})
	}

	// Sort rates by currency code
	for i := 0; i < len(rates)-1; i++ {
		for j := i + 1; j < len(rates); j++ {
			if rates[i].Code > rates[j].Code {
				rates[i], rates[j] = rates[j], rates[i]
			}
		}
	}

	return &model.RatesResponse{
		Base:      apiRates.Base,
		Date:      apiRates.Date,
		Rates:     rates,
		UpdatedAt: time.Now(),
	}
}
