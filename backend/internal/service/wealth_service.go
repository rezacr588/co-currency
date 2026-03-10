package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// WealthService provides purchasing power analysis
type WealthService struct {
	walletRepo      *repository.WalletRepository
	exchangeService *ExchangeService
	inflationRepo   *repository.InflationRepository
	cache           *gocache.Cache
}

// NewWealthService creates a new WealthService
func NewWealthService(
	walletRepo *repository.WalletRepository,
	exchangeService *ExchangeService,
	inflationRepo *repository.InflationRepository,
) *WealthService {
	return &WealthService{
		walletRepo:      walletRepo,
		exchangeService: exchangeService,
		inflationRepo:   inflationRepo,
		cache:           gocache.New(5*time.Minute, 10*time.Minute),
	}
}

// GetOverview returns the full purchasing power analysis for a user
func (s *WealthService) GetOverview(ctx context.Context, userID uuid.UUID, baseCurrency string) (*model.WealthOverview, error) {
	if baseCurrency == "" {
		baseCurrency = "USD"
	}

	cacheKey := fmt.Sprintf("wealth-overview:%s:%s", userID, baseCurrency)
	if cached, found := s.cache.Get(cacheKey); found {
		if overview, ok := cached.(*model.WealthOverview); ok {
			return overview, nil
		}
	}

	overview, err := s.computeOverview(ctx, userID, baseCurrency)
	if err != nil {
		return nil, err
	}

	s.cache.Set(cacheKey, overview, 5*time.Minute)
	return overview, nil
}

func (s *WealthService) computeOverview(ctx context.Context, userID uuid.UUID, baseCurrency string) (*model.WealthOverview, error) {
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting balances: %w", err)
	}

	overview := &model.WealthOverview{
		Currency:               baseCurrency,
		InflationDataAvailable: true,
	}

	if len(balances) == 0 {
		overview.ShieldScore = 50
		overview.ShieldLabel = model.GetShieldLabel(50)
		overview.ShieldTrend = "stable"
		overview.Headline = "Add balances to see your purchasing power analysis"
		return overview, nil
	}

	var exposures []model.CurrencyExposure
	rateCache := make(map[string]float64)
	convertCurrency := s.currencyConverterFunc()
	nominalTotal := 0.0
	realTotal := 0.0
	hasInflationData := false

	for _, b := range balances {
		currency := b.Currency
		nominalInBase, ok := convertAmountWithRateCache(ctx, b.Balance, currency, baseCurrency, rateCache, convertCurrency)
		if !ok {
			log.Warn().Str("from", currency).Str("to", baseCurrency).Msg("Skipping balance: currency conversion failed")
			continue
		}
		nominalTotal += nominalInBase

		// Get inflation rate for this currency
		inflationRate := s.inflationRepo.GetInflationRateForCurrency(ctx, currency)
		if inflationRate > 0 {
			hasInflationData = true
		}

		// Calculate real value: adjusted for 1 month of inflation (compound)
		monthlyInflation := inflationRate / 100.0 / 12.0
		realBalance := nominalInBase * math.Pow(1-monthlyInflation, 1)
		erosion := nominalInBase - realBalance
		realTotal += realBalance

		exposures = append(exposures, model.CurrencyExposure{
			Currency:        currency,
			NominalBalance:  nominalInBase,
			RealBalance:     realBalance,
			AnnualInflation: inflationRate,
			ErosionAmount:   erosion,
		})
	}

	// Calculate share percentages
	for i := range exposures {
		if nominalTotal > 0 {
			exposures[i].SharePercentage = (exposures[i].NominalBalance / nominalTotal) * 100
		}
	}

	overview.NominalTotal = math.Round(nominalTotal*100) / 100
	overview.RealTotal = math.Round(realTotal*100) / 100
	overview.ErosionAmount = math.Round((nominalTotal-realTotal)*100) / 100
	if nominalTotal > 0 {
		overview.ErosionRate = math.Round(((nominalTotal-realTotal)/nominalTotal)*10000) / 100
	}
	overview.CurrencyBreakdown = exposures
	overview.InflationDataAvailable = hasInflationData

	// Fetch transactions once for shield score computation
	transactions, _ := s.walletRepo.GetTransactions(ctx, userID, 100, 0)

	// Compute shield score
	score := s.computeShieldScore(ctx, userID, balances, exposures, baseCurrency, transactions)
	overview.ShieldScore = score.Total
	overview.ShieldLabel = score.Label
	overview.ShieldTrend = "stable" // Default, could be computed from historical data

	// Generate headline
	if overview.ErosionAmount > 0 {
		overview.Headline = fmt.Sprintf("Your money lost %.2f %s in purchasing power this month", overview.ErosionAmount, baseCurrency)
	} else {
		overview.Headline = "Your purchasing power is well protected"
	}

	return overview, nil
}

// computeShieldScore calculates the Wealth Shield Score
func (s *WealthService) computeShieldScore(
	_ context.Context,
	_ uuid.UUID,
	_ []model.WalletBalance,
	exposures []model.CurrencyExposure,
	_ string,
	transactions []model.Transaction,
) model.WealthShieldScore {
	score := model.WealthShieldScore{}

	// 1. Diversification (30%) - inverse of HHI
	nominalTotal := 0.0
	for _, e := range exposures {
		nominalTotal += e.NominalBalance
	}
	hhi := 0.0
	if nominalTotal > 0 {
		for _, e := range exposures {
			share := e.NominalBalance / nominalTotal
			hhi += share * share
		}
	}
	// HHI ranges from 1/n to 1. Convert to 0-100 score (1 = worst, 0 = impossible but ideal)
	score.Diversification = math.Max(0, math.Min(100, (1-hhi)*100))

	// 2. Low-inflation exposure (25%) - % of wealth in currencies with <5% inflation
	lowInflationTotal := 0.0
	for _, e := range exposures {
		if e.AnnualInflation < 5.0 {
			lowInflationTotal += e.NominalBalance
		}
	}
	if nominalTotal > 0 {
		score.LowInflation = (lowInflationTotal / nominalTotal) * 100
	}

	// 3. Savings rate (25%) - approximate from pre-fetched transaction history
	score.SavingsRate = 50.0 // Default
	if len(transactions) > 0 {
		now := time.Now()
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		income := 0.0
		expenses := 0.0
		for _, tx := range transactions {
			if tx.CreatedAt.After(startOfMonth) {
				if tx.Type == "credit" {
					income += tx.Amount
				} else if tx.Type == "debit" {
					expenses += tx.Amount
				}
			}
		}
		if income > 0 {
			savingsRate := ((income - expenses) / income) * 100
			score.SavingsRate = math.Max(0, math.Min(100, savingsRate))
		}
	}

	// 4. Active hedging (20%) - based on currency diversity and recent conversions
	numCurrencies := len(exposures)
	switch {
	case numCurrencies >= 3:
		score.ActiveHedging = 100
	case numCurrencies == 2:
		score.ActiveHedging = 60
	default:
		score.ActiveHedging = 20
	}

	// Weighted total
	total := score.Diversification*0.30 +
		score.LowInflation*0.25 +
		score.SavingsRate*0.25 +
		score.ActiveHedging*0.20

	score.Total = int(math.Round(total))
	score.Label = model.GetShieldLabel(score.Total)

	return score
}

// GetHistory returns historical purchasing power data
func (s *WealthService) GetHistory(ctx context.Context, userID uuid.UUID, baseCurrency string, months int) (*model.WealthHistory, error) {
	if baseCurrency == "" {
		baseCurrency = "USD"
	}
	if months <= 0 || months > 24 {
		months = 6
	}

	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting balances: %w", err)
	}

	rateCache := make(map[string]float64)
	convertCurrency := s.currencyConverterFunc()

	// Calculate current total in base currency
	currentTotal := 0.0
	for _, b := range balances {
		converted, _ := convertAmountWithRateCache(ctx, b.Balance, b.Currency, baseCurrency, rateCache, convertCurrency)
		currentTotal += converted
	}

	// Build historical data points using average inflation
	var dataPoints []model.WealthHistoryPoint
	now := time.Now()
	totalErosion := 0.0

	// Get weighted average inflation for user's portfolio
	avgInflation := s.getWeightedInflation(ctx, balances, rateCache, convertCurrency, baseCurrency)

	for i := months; i >= 0; i-- {
		date := now.AddDate(0, -i, 0)
		// The further back, the higher the nominal value was in real terms (compound)
		monthsFromNow := float64(i)
		monthlyRate := avgInflation / 100.0 / 12.0
		realValue := currentTotal * math.Pow(1-monthlyRate, monthsFromNow)

		dataPoints = append(dataPoints, model.WealthHistoryPoint{
			Date:          date.Format("2006-01"),
			NominalValue:  math.Round(currentTotal*100) / 100,
			RealValue:     math.Round(realValue*100) / 100,
			InflationRate: avgInflation,
		})
	}

	if len(dataPoints) > 0 {
		totalErosion = dataPoints[0].NominalValue - dataPoints[0].RealValue
	}

	return &model.WealthHistory{
		DataPoints:   dataPoints,
		Currency:     baseCurrency,
		TotalErosion: math.Round(totalErosion*100) / 100,
	}, nil
}

// GetWhatIf performs counterfactual currency analysis
func (s *WealthService) GetWhatIf(ctx context.Context, userID uuid.UUID, fromCurrency, toCurrency string, amount float64, monthsAgo int) (*model.WhatIfResult, error) {
	if monthsAgo <= 0 || monthsAgo > 60 {
		monthsAgo = 3
	}
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	// Get exchange rate (convert 1 unit to get the rate, then multiply)
	unitResult, err := s.exchangeService.Convert(ctx, fromCurrency, toCurrency, 1)
	if err != nil {
		return nil, fmt.Errorf("getting exchange rate: %w", err)
	}
	rate := unitResult.Result
	currentValue := amount * rate

	// Get inflation rates for both currencies
	fromInflation := s.inflationRepo.GetInflationRateForCurrency(ctx, fromCurrency)
	toInflation := s.inflationRepo.GetInflationRateForCurrency(ctx, toCurrency)

	// If user had held the original currency, apply compound inflation erosion
	monthlyFromInflation := fromInflation / 100.0 / 12.0
	actualValue := amount * math.Pow(1-monthlyFromInflation, float64(monthsAgo))
	actualConverted := actualValue * rate

	// If user had converted months ago and held target currency
	monthlyToInflation := toInflation / 100.0 / 12.0
	hypotheticalValue := currentValue * math.Pow(1-monthlyToInflation, float64(monthsAgo))

	difference := hypotheticalValue - actualConverted
	diffPct := 0.0
	if actualConverted > 0 {
		diffPct = (difference / actualConverted) * 100
	}

	explanation := fmt.Sprintf(
		"If you had converted %.2f %s to %s %d months ago, you would have %.2f %s (inflation-adjusted) vs %.2f %s by holding %s.",
		amount, fromCurrency, toCurrency, monthsAgo,
		math.Round(hypotheticalValue*100)/100, toCurrency,
		math.Round(actualConverted*100)/100, toCurrency, fromCurrency,
	)
	if difference > 0 {
		explanation += fmt.Sprintf(" You would have gained %.2f %s (%.1f%%).", math.Abs(difference), toCurrency, math.Abs(diffPct))
	} else if difference < 0 {
		explanation += fmt.Sprintf(" Holding was better by %.2f %s (%.1f%%).", math.Abs(difference), toCurrency, math.Abs(diffPct))
	}

	return &model.WhatIfResult{
		ActualValue:          math.Round(actualConverted*100) / 100,
		HypotheticalValue:    math.Round(hypotheticalValue*100) / 100,
		Difference:           math.Round(difference*100) / 100,
		DifferencePercentage: math.Round(diffPct*100) / 100,
		Explanation:          explanation,
		FromCurrency:         fromCurrency,
		ToCurrency:           toCurrency,
		Amount:               amount,
		MonthsAgo:            monthsAgo,
	}, nil
}

// GetAlerts returns unread wealth alerts for a user
func (s *WealthService) GetAlerts(ctx context.Context, userID uuid.UUID) ([]model.WealthAlert, error) {
	return s.inflationRepo.GetUnreadAlerts(ctx, userID)
}

// MarkAlertRead marks an alert as read, scoped to the user
func (s *WealthService) MarkAlertRead(ctx context.Context, alertID uuid.UUID, userID uuid.UUID) error {
	return s.inflationRepo.MarkAlertRead(ctx, alertID, userID)
}

// getWeightedInflation calculates the weighted average inflation for a user's portfolio
func (s *WealthService) getWeightedInflation(
	ctx context.Context,
	balances []model.WalletBalance,
	rateCache map[string]float64,
	convert currencyConverterFunc,
	baseCurrency string,
) float64 {
	totalValue := 0.0
	weightedRate := 0.0

	for _, b := range balances {
		converted, ok := convertAmountWithRateCache(ctx, b.Balance, b.Currency, baseCurrency, rateCache, convert)
		if !ok {
			converted = b.Balance
		}
		inflationRate := s.inflationRepo.GetInflationRateForCurrency(ctx, b.Currency)
		weightedRate += converted * inflationRate
		totalValue += converted
	}

	if totalValue > 0 {
		return weightedRate / totalValue
	}
	return 3.0 // Default
}

func (s *WealthService) currencyConverterFunc() currencyConverterFunc {
	if s.exchangeService == nil {
		return nil
	}
	return s.exchangeService.Convert
}

// GetOverviewForAI returns a simplified overview for AI context
func (s *WealthService) GetOverviewForAI(ctx context.Context, userID uuid.UUID, baseCurrency string) (*model.WealthOverview, error) {
	return s.GetOverview(ctx, userID, baseCurrency)
}

// CheckAlerts generates alerts based on user's currency exposure
func (s *WealthService) CheckAlerts(ctx context.Context, userID uuid.UUID) ([]model.WealthAlert, error) {
	balances, err := s.walletRepo.GetBalances(ctx, userID)
	if err != nil {
		return nil, err
	}

	var alerts []model.WealthAlert
	for _, b := range balances {
		inflationRate := s.inflationRepo.GetInflationRateForCurrency(ctx, b.Currency)

		// Alert if inflation > 10%
		if inflationRate > 10 {
			// Check for existing unread alert to avoid duplicates
			exists, err := s.inflationRepo.HasUnreadAlert(ctx, userID, "inflation_spike", b.Currency)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to check existing alert")
			}
			if exists {
				continue
			}

			alert := model.WealthAlert{
				UserID:       userID,
				AlertType:    "inflation_spike",
				CurrencyCode: b.Currency,
				Message:      fmt.Sprintf("%s has %.1f%% annual inflation. Consider diversifying to protect your %.2f %s.", b.Currency, inflationRate, b.Balance, b.Currency),
			}
			thresholdVal := inflationRate
			alert.ThresholdValue = &thresholdVal
			if err := s.inflationRepo.SaveWealthAlert(ctx, alert); err != nil {
				log.Warn().Err(err).Msg("Failed to save wealth alert")
			}
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}
