package model

// Currency represents a currency with metadata
type Currency struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Priority int    `json:"priority"`
}

// CurrencyList contains metadata for supported currencies
var CurrencyList = map[string]Currency{
	"USD": {Code: "USD", Name: "US Dollar", Symbol: "$", Priority: 1},
	"EUR": {Code: "EUR", Name: "Euro", Symbol: "€", Priority: 2},
	"GBP": {Code: "GBP", Name: "British Pound", Symbol: "£", Priority: 3},
	"JPY": {Code: "JPY", Name: "Japanese Yen", Symbol: "¥", Priority: 4},
	"CHF": {Code: "CHF", Name: "Swiss Franc", Symbol: "Fr", Priority: 5},
	"CAD": {Code: "CAD", Name: "Canadian Dollar", Symbol: "C$", Priority: 6},
	"AUD": {Code: "AUD", Name: "Australian Dollar", Symbol: "A$", Priority: 7},
	"CNY": {Code: "CNY", Name: "Chinese Yuan", Symbol: "¥", Priority: 8},
	"INR": {Code: "INR", Name: "Indian Rupee", Symbol: "₹", Priority: 9},
	"MXN": {Code: "MXN", Name: "Mexican Peso", Symbol: "$", Priority: 10},
	"BRL": {Code: "BRL", Name: "Brazilian Real", Symbol: "R$", Priority: 11},
	"KRW": {Code: "KRW", Name: "South Korean Won", Symbol: "₩", Priority: 12},
	"SGD": {Code: "SGD", Name: "Singapore Dollar", Symbol: "S$", Priority: 13},
	"HKD": {Code: "HKD", Name: "Hong Kong Dollar", Symbol: "HK$", Priority: 14},
	"NOK": {Code: "NOK", Name: "Norwegian Krone", Symbol: "kr", Priority: 15},
	"SEK": {Code: "SEK", Name: "Swedish Krona", Symbol: "kr", Priority: 16},
	"DKK": {Code: "DKK", Name: "Danish Krone", Symbol: "kr", Priority: 17},
	"NZD": {Code: "NZD", Name: "New Zealand Dollar", Symbol: "NZ$", Priority: 18},
	"ZAR": {Code: "ZAR", Name: "South African Rand", Symbol: "R", Priority: 19},
	"RUB": {Code: "RUB", Name: "Russian Ruble", Symbol: "₽", Priority: 20},
	"TRY": {Code: "TRY", Name: "Turkish Lira", Symbol: "₺", Priority: 21},
	"PLN": {Code: "PLN", Name: "Polish Zloty", Symbol: "zł", Priority: 22},
	"THB": {Code: "THB", Name: "Thai Baht", Symbol: "฿", Priority: 23},
	"IDR": {Code: "IDR", Name: "Indonesian Rupiah", Symbol: "Rp", Priority: 24},
	"HUF": {Code: "HUF", Name: "Hungarian Forint", Symbol: "Ft", Priority: 25},
	"CZK": {Code: "CZK", Name: "Czech Koruna", Symbol: "Kč", Priority: 26},
	"ILS": {Code: "ILS", Name: "Israeli Shekel", Symbol: "₪", Priority: 27},
	"PHP": {Code: "PHP", Name: "Philippine Peso", Symbol: "₱", Priority: 28},
	"MYR": {Code: "MYR", Name: "Malaysian Ringgit", Symbol: "RM", Priority: 29},
	"RON": {Code: "RON", Name: "Romanian Leu", Symbol: "lei", Priority: 30},
	"BGN": {Code: "BGN", Name: "Bulgarian Lev", Symbol: "лв", Priority: 31},
	"ISK": {Code: "ISK", Name: "Icelandic Krona", Symbol: "kr", Priority: 32},
}

// GetCurrency returns currency metadata by code
func GetCurrency(code string) (Currency, bool) {
	c, ok := CurrencyList[code]
	return c, ok
}

// GetAllCurrencies returns all currencies as a slice sorted by priority
func GetAllCurrencies() []Currency {
	currencies := make([]Currency, 0, len(CurrencyList))
	for _, c := range CurrencyList {
		currencies = append(currencies, c)
	}
	// Sort by priority
	for i := 0; i < len(currencies)-1; i++ {
		for j := i + 1; j < len(currencies); j++ {
			if currencies[i].Priority > currencies[j].Priority {
				currencies[i], currencies[j] = currencies[j], currencies[i]
			}
		}
	}
	return currencies
}
