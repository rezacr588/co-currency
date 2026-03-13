package service

import "strings"

// categoryKeywords maps keywords to categories for smart inference.
var categoryKeywords = map[string][]string{
	"food":           {"coffee", "lunch", "dinner", "breakfast", "restaurant", "cafe", "food", "eat", "meal", "snack", "grocery", "groceries", "pizza", "burger", "sushi", "takeout", "delivery"},
	"transportation": {"uber", "lyft", "taxi", "gas", "fuel", "parking", "metro", "bus", "train", "flight", "airline", "car", "transit", "commute"},
	"entertainment":  {"movie", "netflix", "spotify", "game", "concert", "show", "theater", "museum", "subscription", "stream"},
	"shopping":       {"amazon", "store", "shop", "clothes", "shoes", "electronics", "purchase", "buy", "bought"},
	"bills":          {"rent", "electricity", "water", "internet", "phone", "utility", "insurance", "bill"},
	"income":         {"salary", "paycheck", "paid", "income", "bonus", "freelance", "dividend", "interest"},
	"transfer":       {"transfer", "send", "wire", "venmo", "paypal", "zelle"},
}

// inferCategory infers a category from description text.
func inferCategory(description string) string {
	lowerDesc := strings.ToLower(description)
	for category, keywords := range categoryKeywords {
		for _, keyword := range keywords {
			if strings.Contains(lowerDesc, keyword) {
				return category
			}
		}
	}
	return "other"
}
