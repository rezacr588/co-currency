package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
)

// ============================================================================
// matchesDayOfMonth tests
// ============================================================================

func TestMatchesDayOfMonth_NormalDay(t *testing.T) {
	// 15th on a 31-day month (January)
	day := time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(15, day) {
		t.Error("Expected 15th to match January 15")
	}
}

func TestMatchesDayOfMonth_NonMatchingDay(t *testing.T) {
	day := time.Date(2026, time.January, 10, 0, 0, 0, 0, time.UTC)
	if matchesDayOfMonth(15, day) {
		t.Error("Expected 15th not to match January 10")
	}
}

func TestMatchesDayOfMonth_Day31On30DayMonth(t *testing.T) {
	// Day 31 on April (30 days) should match the 30th
	day := time.Date(2026, time.April, 30, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(31, day) {
		t.Error("Expected target day 31 to match April 30 (last day of 30-day month)")
	}
}

func TestMatchesDayOfMonth_Day31On30DayMonth_NotLast(t *testing.T) {
	// Day 31 on April 29 should NOT match
	day := time.Date(2026, time.April, 29, 0, 0, 0, 0, time.UTC)
	if matchesDayOfMonth(31, day) {
		t.Error("Expected target day 31 not to match April 29")
	}
}

func TestMatchesDayOfMonth_Day31OnFebruary(t *testing.T) {
	// Day 31 on February 28 (non-leap year 2026) should match 28th
	day := time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(31, day) {
		t.Error("Expected target day 31 to match February 28 (last day of Feb in non-leap year)")
	}
}

func TestMatchesDayOfMonth_Day31OnFebruary_NotLast(t *testing.T) {
	day := time.Date(2026, time.February, 27, 0, 0, 0, 0, time.UTC)
	if matchesDayOfMonth(31, day) {
		t.Error("Expected target day 31 not to match February 27")
	}
}

func TestMatchesDayOfMonth_Day29OnNonLeapFebruary(t *testing.T) {
	// Day 29 on February in a non-leap year (2026) should match 28th
	day := time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(29, day) {
		t.Error("Expected target day 29 to match February 28 in non-leap year")
	}
}

func TestMatchesDayOfMonth_Day29OnLeapFebruary(t *testing.T) {
	// Day 29 on February in a leap year (2028) should match 29th exactly
	day := time.Date(2028, time.February, 29, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(29, day) {
		t.Error("Expected target day 29 to match February 29 in leap year")
	}
}

func TestMatchesDayOfMonth_Day29OnLeapFebruary_NotLast(t *testing.T) {
	// Day 29 on February 28 in a leap year should NOT match (28 != 29)
	day := time.Date(2028, time.February, 28, 0, 0, 0, 0, time.UTC)
	if matchesDayOfMonth(29, day) {
		t.Error("Expected target day 29 not to match February 28 in leap year")
	}
}

func TestMatchesDayOfMonth_Day1OnAnyMonth(t *testing.T) {
	months := []time.Month{
		time.January, time.February, time.March, time.April,
		time.May, time.June, time.July, time.August,
		time.September, time.October, time.November, time.December,
	}
	for _, m := range months {
		day := time.Date(2026, m, 1, 0, 0, 0, 0, time.UTC)
		if !matchesDayOfMonth(1, day) {
			t.Errorf("Expected day 1 to match %s 1", m)
		}
	}
}

func TestMatchesDayOfMonth_Day30OnFebruary(t *testing.T) {
	// Day 30 on February 28 (non-leap) should clamp to 28th
	day := time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(30, day) {
		t.Error("Expected target day 30 to match February 28 in non-leap year")
	}
}

// ============================================================================
// matchesRecurringDate tests
// ============================================================================

func TestMatchesRecurringDate_Daily(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "daily",
		NextExecution: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
	}

	// Daily should match any day
	testDays := []time.Time{
		time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC),
		time.Date(2026, time.December, 31, 0, 0, 0, 0, time.UTC),
	}

	for _, day := range testDays {
		if !matchesRecurringDate(rec, day) {
			t.Errorf("Expected daily recurring to match %s", day.Format("2006-01-02"))
		}
	}
}

func TestMatchesRecurringDate_Weekly_Matching(t *testing.T) {
	// NextExecution is a Monday (2026-02-16 is Monday)
	rec := model.RecurringTransaction{
		Frequency:     "weekly",
		NextExecution: time.Date(2026, time.February, 16, 0, 0, 0, 0, time.UTC),
	}

	// Another Monday
	day := time.Date(2026, time.February, 23, 0, 0, 0, 0, time.UTC)
	if !matchesRecurringDate(rec, day) {
		t.Error("Expected weekly recurring to match same weekday (Monday)")
	}
}

func TestMatchesRecurringDate_Weekly_NonMatching(t *testing.T) {
	// NextExecution is a Monday
	rec := model.RecurringTransaction{
		Frequency:     "weekly",
		NextExecution: time.Date(2026, time.February, 16, 0, 0, 0, 0, time.UTC),
	}

	// A Tuesday
	day := time.Date(2026, time.February, 17, 0, 0, 0, 0, time.UTC)
	if matchesRecurringDate(rec, day) {
		t.Error("Expected weekly recurring not to match different weekday (Tuesday vs Monday)")
	}
}

func TestMatchesRecurringDate_Monthly_MatchingDay(t *testing.T) {
	// NextExecution is on the 15th
	rec := model.RecurringTransaction{
		Frequency:     "monthly",
		NextExecution: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	// 15th of a different month
	day := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)
	if !matchesRecurringDate(rec, day) {
		t.Error("Expected monthly recurring to match same day of month")
	}
}

func TestMatchesRecurringDate_Monthly_NonMatchingDay(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "monthly",
		NextExecution: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.March, 10, 0, 0, 0, 0, time.UTC)
	if matchesRecurringDate(rec, day) {
		t.Error("Expected monthly recurring not to match different day of month")
	}
}

func TestMatchesRecurringDate_Monthly_Day31InShorterMonth(t *testing.T) {
	// NextExecution is on the 31st
	rec := model.RecurringTransaction{
		Frequency:     "monthly",
		NextExecution: time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
	}

	// April has 30 days, so 31st should clamp to 30th
	day := time.Date(2026, time.April, 30, 0, 0, 0, 0, time.UTC)
	if !matchesRecurringDate(rec, day) {
		t.Error("Expected monthly recurring (31st) to match April 30 (last day of shorter month)")
	}
}

func TestMatchesRecurringDate_Monthly_Day31InFebruary(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "monthly",
		NextExecution: time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
	}

	// February 28 (non-leap year)
	day := time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC)
	if !matchesRecurringDate(rec, day) {
		t.Error("Expected monthly recurring (31st) to match February 28 in non-leap year")
	}
}

func TestMatchesRecurringDate_Yearly_MatchingDayAndMonth(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "yearly",
		NextExecution: time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC),
	}

	// Same day and month, different year
	day := time.Date(2027, time.March, 15, 0, 0, 0, 0, time.UTC)
	if !matchesRecurringDate(rec, day) {
		t.Error("Expected yearly recurring to match same day and month")
	}
}

func TestMatchesRecurringDate_Yearly_NonMatchingMonth(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "yearly",
		NextExecution: time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC),
	}

	// Same day, different month
	day := time.Date(2026, time.April, 15, 0, 0, 0, 0, time.UTC)
	if matchesRecurringDate(rec, day) {
		t.Error("Expected yearly recurring not to match different month")
	}
}

func TestMatchesRecurringDate_Yearly_NonMatchingDay(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "yearly",
		NextExecution: time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC),
	}

	// Same month, different day
	day := time.Date(2026, time.March, 10, 0, 0, 0, 0, time.UTC)
	if matchesRecurringDate(rec, day) {
		t.Error("Expected yearly recurring not to match different day")
	}
}

func TestMatchesRecurringDate_Yearly_Day31Clamping(t *testing.T) {
	// Yearly on Jan 31st
	rec := model.RecurringTransaction{
		Frequency:     "yearly",
		NextExecution: time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
	}

	// January 31 in another year
	day := time.Date(2027, time.January, 31, 0, 0, 0, 0, time.UTC)
	if !matchesRecurringDate(rec, day) {
		t.Error("Expected yearly recurring (Jan 31) to match Jan 31")
	}

	// Should NOT match February at all (wrong month)
	day = time.Date(2027, time.February, 28, 0, 0, 0, 0, time.UTC)
	if matchesRecurringDate(rec, day) {
		t.Error("Expected yearly recurring (Jan 31) not to match Feb 28 (wrong month)")
	}
}

func TestMatchesRecurringDate_UnknownFrequency(t *testing.T) {
	rec := model.RecurringTransaction{
		Frequency:     "biweekly",
		NextExecution: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	if matchesRecurringDate(rec, day) {
		t.Error("Expected unknown frequency to not match")
	}
}

// ============================================================================
// matchesSubscriptionDate tests
// ============================================================================

func TestMatchesSubscriptionDate_Weekly_Matching(t *testing.T) {
	// NextBillingDate is a Wednesday (2026-02-18 is Wednesday)
	sub := model.Subscription{
		BillingCycle:    "weekly",
		NextBillingDate: time.Date(2026, time.February, 18, 0, 0, 0, 0, time.UTC),
	}

	// Another Wednesday
	day := time.Date(2026, time.February, 25, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected weekly subscription to match same weekday")
	}
}

func TestMatchesSubscriptionDate_Weekly_NonMatching(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "weekly",
		NextBillingDate: time.Date(2026, time.February, 18, 0, 0, 0, 0, time.UTC), // Wednesday
	}

	// A Thursday
	day := time.Date(2026, time.February, 19, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected weekly subscription not to match different weekday")
	}
}

func TestMatchesSubscriptionDate_Monthly_Matching(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "monthly",
		NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected monthly subscription to match same day of month")
	}
}

func TestMatchesSubscriptionDate_Monthly_NonMatching(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "monthly",
		NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.March, 10, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected monthly subscription not to match different day of month")
	}
}

func TestMatchesSubscriptionDate_Monthly_Day31Clamping(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "monthly",
		NextBillingDate: time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
	}

	// April 30 should match (clamped from 31)
	day := time.Date(2026, time.April, 30, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected monthly subscription (31st) to match April 30")
	}
}

func TestMatchesSubscriptionDate_Quarterly_Matching(t *testing.T) {
	// NextBillingDate is January 15
	sub := model.Subscription{
		BillingCycle:    "quarterly",
		NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	// April 15 is 3 months later (monthDiff % 3 == 0)
	day := time.Date(2026, time.April, 15, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription to match 3 months later (April)")
	}

	// July 15 is 6 months later (monthDiff % 3 == 0)
	day = time.Date(2026, time.July, 15, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription to match 6 months later (July)")
	}

	// October 15 is 9 months later (monthDiff % 3 == 0)
	day = time.Date(2026, time.October, 15, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription to match 9 months later (October)")
	}

	// January 15 next year is 12 months later (monthDiff % 3 == 0, since (12)%12=0 and 0%3==0)
	day = time.Date(2027, time.January, 15, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription to match 12 months later (January next year)")
	}
}

func TestMatchesSubscriptionDate_Quarterly_NonMatching(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "quarterly",
		NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	// February is 1 month later (1 % 3 != 0) -- wrong quarter
	day := time.Date(2026, time.February, 15, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription not to match 1 month later")
	}

	// March is 2 months later (2 % 3 != 0)
	day = time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription not to match 2 months later")
	}

	// May is 4 months later (4 % 3 != 0)
	day = time.Date(2026, time.May, 15, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription not to match 4 months later")
	}
}

func TestMatchesSubscriptionDate_Quarterly_WrongDay(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "quarterly",
		NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
	}

	// Correct quarter month (April), but wrong day
	day := time.Date(2026, time.April, 10, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription not to match correct month but wrong day")
	}
}

func TestMatchesSubscriptionDate_Yearly_Matching(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "yearly",
		NextBillingDate: time.Date(2026, time.June, 20, 0, 0, 0, 0, time.UTC),
	}

	// Same month and day, different year
	day := time.Date(2027, time.June, 20, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected yearly subscription to match same month and day")
	}
}

func TestMatchesSubscriptionDate_Yearly_NonMatching_WrongMonth(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "yearly",
		NextBillingDate: time.Date(2026, time.June, 20, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.July, 20, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected yearly subscription not to match wrong month")
	}
}

func TestMatchesSubscriptionDate_Yearly_NonMatching_WrongDay(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "yearly",
		NextBillingDate: time.Date(2026, time.June, 20, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.June, 15, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected yearly subscription not to match wrong day")
	}
}

func TestMatchesSubscriptionDate_UnknownBillingCycle(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "biannual",
		NextBillingDate: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
	}

	day := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected unknown billing cycle to not match")
	}
}

// ============================================================================
// Table-driven tests for matchesDayOfMonth edge cases
// ============================================================================

func TestMatchesDayOfMonth_TableDriven(t *testing.T) {
	tests := []struct {
		name      string
		targetDay int
		date      time.Time
		expected  bool
	}{
		{
			name:      "exact match day 1",
			targetDay: 1,
			date:      time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "exact match day 28",
			targetDay: 28,
			date:      time.Date(2026, time.March, 28, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 31 on 31-day month (match)",
			targetDay: 31,
			date:      time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 31 on 31-day month (no match on day 30)",
			targetDay: 31,
			date:      time.Date(2026, time.January, 30, 0, 0, 0, 0, time.UTC),
			expected:  false,
		},
		{
			name:      "day 31 clamped to 30 on June",
			targetDay: 31,
			date:      time.Date(2026, time.June, 30, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 31 clamped to 28 on Feb non-leap",
			targetDay: 31,
			date:      time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 31 clamped to 29 on Feb leap",
			targetDay: 31,
			date:      time.Date(2028, time.February, 29, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 30 clamped to 29 on Feb leap",
			targetDay: 30,
			date:      time.Date(2028, time.February, 29, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 30 clamped to 28 on Feb non-leap",
			targetDay: 30,
			date:      time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
		{
			name:      "day 15 does not match day 16",
			targetDay: 15,
			date:      time.Date(2026, time.January, 16, 0, 0, 0, 0, time.UTC),
			expected:  false,
		},
		{
			name:      "day 29 exact match on March 29",
			targetDay: 29,
			date:      time.Date(2026, time.March, 29, 0, 0, 0, 0, time.UTC),
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := matchesDayOfMonth(tt.targetDay, tt.date)
			if got != tt.expected {
				t.Errorf("matchesDayOfMonth(%d, %s) = %v, want %v",
					tt.targetDay, tt.date.Format("2006-01-02"), got, tt.expected)
			}
		})
	}
}

// ============================================================================
// Table-driven tests for matchesRecurringDate
// ============================================================================

func TestMatchesRecurringDate_TableDriven(t *testing.T) {
	tests := []struct {
		name     string
		rec      model.RecurringTransaction
		day      time.Time
		expected bool
	}{
		{
			name: "daily always matches",
			rec: model.RecurringTransaction{
				Frequency:     "daily",
				NextExecution: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.June, 15, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "weekly same weekday",
			rec: model.RecurringTransaction{
				Frequency:     "weekly",
				NextExecution: time.Date(2026, time.February, 14, 0, 0, 0, 0, time.UTC), // Saturday
			},
			day:      time.Date(2026, time.February, 21, 0, 0, 0, 0, time.UTC), // also Saturday
			expected: true,
		},
		{
			name: "weekly different weekday",
			rec: model.RecurringTransaction{
				Frequency:     "weekly",
				NextExecution: time.Date(2026, time.February, 14, 0, 0, 0, 0, time.UTC), // Saturday
			},
			day:      time.Date(2026, time.February, 15, 0, 0, 0, 0, time.UTC), // Sunday
			expected: false,
		},
		{
			name: "monthly same day",
			rec: model.RecurringTransaction{
				Frequency:     "monthly",
				NextExecution: time.Date(2026, time.January, 5, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.August, 5, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "monthly day 31 on Sep (30 days)",
			rec: model.RecurringTransaction{
				Frequency:     "monthly",
				NextExecution: time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.September, 30, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "yearly correct date",
			rec: model.RecurringTransaction{
				Frequency:     "yearly",
				NextExecution: time.Date(2026, time.December, 25, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2027, time.December, 25, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "yearly wrong month",
			rec: model.RecurringTransaction{
				Frequency:     "yearly",
				NextExecution: time.Date(2026, time.December, 25, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2027, time.November, 25, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name: "yearly wrong day",
			rec: model.RecurringTransaction{
				Frequency:     "yearly",
				NextExecution: time.Date(2026, time.December, 25, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2027, time.December, 26, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := matchesRecurringDate(tt.rec, tt.day)
			if got != tt.expected {
				t.Errorf("matchesRecurringDate(%s, %s) = %v, want %v",
					tt.rec.Frequency, tt.day.Format("2006-01-02"), got, tt.expected)
			}
		})
	}
}

// ============================================================================
// Table-driven tests for matchesSubscriptionDate
// ============================================================================

func TestMatchesSubscriptionDate_TableDriven(t *testing.T) {
	tests := []struct {
		name     string
		sub      model.Subscription
		day      time.Time
		expected bool
	}{
		{
			name: "weekly matching weekday",
			sub: model.Subscription{
				BillingCycle:    "weekly",
				NextBillingDate: time.Date(2026, time.February, 14, 0, 0, 0, 0, time.UTC), // Saturday
			},
			day:      time.Date(2026, time.March, 7, 0, 0, 0, 0, time.UTC), // also Saturday
			expected: true,
		},
		{
			name: "weekly non-matching weekday",
			sub: model.Subscription{
				BillingCycle:    "weekly",
				NextBillingDate: time.Date(2026, time.February, 14, 0, 0, 0, 0, time.UTC), // Saturday
			},
			day:      time.Date(2026, time.March, 6, 0, 0, 0, 0, time.UTC), // Friday
			expected: false,
		},
		{
			name: "monthly matching day",
			sub: model.Subscription{
				BillingCycle:    "monthly",
				NextBillingDate: time.Date(2026, time.January, 10, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.May, 10, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "monthly non-matching day",
			sub: model.Subscription{
				BillingCycle:    "monthly",
				NextBillingDate: time.Date(2026, time.January, 10, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.May, 11, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name: "monthly day 31 clamped to Feb 28",
			sub: model.Subscription{
				BillingCycle:    "monthly",
				NextBillingDate: time.Date(2026, time.January, 31, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "quarterly 0-month offset (same month as billing)",
			sub: model.Subscription{
				BillingCycle:    "quarterly",
				NextBillingDate: time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "quarterly 3-month offset",
			sub: model.Subscription{
				BillingCycle:    "quarterly",
				NextBillingDate: time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "quarterly 6-month offset",
			sub: model.Subscription{
				BillingCycle:    "quarterly",
				NextBillingDate: time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "quarterly 1-month offset (non-matching)",
			sub: model.Subscription{
				BillingCycle:    "quarterly",
				NextBillingDate: time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2026, time.April, 1, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name: "yearly matching month and day",
			sub: model.Subscription{
				BillingCycle:    "yearly",
				NextBillingDate: time.Date(2026, time.November, 5, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2028, time.November, 5, 0, 0, 0, 0, time.UTC),
			expected: true,
		},
		{
			name: "yearly wrong month",
			sub: model.Subscription{
				BillingCycle:    "yearly",
				NextBillingDate: time.Date(2026, time.November, 5, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2028, time.October, 5, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
		{
			name: "yearly wrong day",
			sub: model.Subscription{
				BillingCycle:    "yearly",
				NextBillingDate: time.Date(2026, time.November, 5, 0, 0, 0, 0, time.UTC),
			},
			day:      time.Date(2028, time.November, 6, 0, 0, 0, 0, time.UTC),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := matchesSubscriptionDate(tt.sub, tt.day)
			if got != tt.expected {
				t.Errorf("matchesSubscriptionDate(%s on %s, %s) = %v, want %v",
					tt.sub.BillingCycle,
					tt.sub.NextBillingDate.Format("2006-01-02"),
					tt.day.Format("2006-01-02"),
					got, tt.expected)
			}
		})
	}
}

// ============================================================================
// CashFlowProjection type tests
// ============================================================================

func TestCashFlowProjectionTypes(t *testing.T) {
	// Verify the types are properly constructed
	event := CashFlowEvent{
		Type:        "recurring",
		Description: "Salary",
		Amount:      5000,
		Category:    "income",
	}

	if event.Type != "recurring" {
		t.Errorf("Expected type 'recurring', got '%s'", event.Type)
	}
	if event.Amount != 5000 {
		t.Errorf("Expected amount 5000, got %f", event.Amount)
	}

	projection := CashFlowProjection{
		Date:    "2026-03-01",
		Balance: 10000,
		Income:  5000,
		Expense: 2000,
		Events:  []CashFlowEvent{event},
	}

	if projection.Date != "2026-03-01" {
		t.Errorf("Expected date '2026-03-01', got '%s'", projection.Date)
	}
	if len(projection.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(projection.Events))
	}

	summary := CashFlowSummary{
		ExpectedIncome:   10000,
		ExpectedExpenses: 5000,
		NetProjected:     5000,
		RecurringIncome:  8000,
		RecurringExpense: 3000,
		SubscriptionCost: 500,
	}

	if summary.NetProjected != 5000 {
		t.Errorf("Expected net projected 5000, got %f", summary.NetProjected)
	}

	dangerDateStr := "2026-04-15"
	report := CashFlowReport{
		Currency:       "USD",
		CurrentBalance: 10000,
		Projections:    []CashFlowProjection{projection},
		DaysProjected:  30,
		LowestBalance:  -500,
		LowestDate:     "2026-03-25",
		DangerZone:     true,
		DangerDate:     &dangerDateStr,
		Summary:        summary,
	}

	if report.Currency != "USD" {
		t.Errorf("Expected currency 'USD', got '%s'", report.Currency)
	}
	if !report.DangerZone {
		t.Error("Expected DangerZone to be true")
	}
	if report.DangerDate == nil {
		t.Error("Expected DangerDate to be set")
	}
	if *report.DangerDate != "2026-04-15" {
		t.Errorf("Expected DangerDate '2026-04-15', got '%s'", *report.DangerDate)
	}
}

// ============================================================================
// SpendingAnomaly type tests
// ============================================================================

func TestSpendingAnomalyTypes(t *testing.T) {
	anomaly := SpendingAnomaly{
		TransactionID: uuid.New().String(),
		Description:   "Expensive dinner",
		Amount:        500,
		Currency:      "USD",
		Category:      "food",
		Date:          "2026-02-10",
		AverageAmount: 50,
		Deviation:     10.0,
		Message:       "Your food spend of 500.00 is 10.0x your average",
	}

	if anomaly.Amount != 500 {
		t.Errorf("Expected amount 500, got %f", anomaly.Amount)
	}
	if anomaly.AverageAmount != 50 {
		t.Errorf("Expected average amount 50, got %f", anomaly.AverageAmount)
	}
	if anomaly.Deviation != 10.0 {
		t.Errorf("Expected deviation 10.0, got %f", anomaly.Deviation)
	}

	report := AnomalyReport{
		Anomalies: []SpendingAnomaly{anomaly},
		Period:    "last_7_days",
		Currency:  "USD",
	}

	if len(report.Anomalies) != 1 {
		t.Errorf("Expected 1 anomaly, got %d", len(report.Anomalies))
	}
	if report.Period != "last_7_days" {
		t.Errorf("Expected period 'last_7_days', got '%s'", report.Period)
	}
}

// ============================================================================
// CashFlowReport with no danger zone
// ============================================================================

func TestCashFlowReport_NoDangerZone(t *testing.T) {
	report := CashFlowReport{
		Currency:       "EUR",
		CurrentBalance: 50000,
		DaysProjected:  30,
		LowestBalance:  48000,
		LowestDate:     "2026-03-15",
		DangerZone:     false,
		DangerDate:     nil,
		Summary: CashFlowSummary{
			ExpectedIncome:   10000,
			ExpectedExpenses: 8000,
			NetProjected:     2000,
		},
	}

	if report.DangerZone {
		t.Error("Expected DangerZone to be false for healthy balance")
	}
	if report.DangerDate != nil {
		t.Error("Expected DangerDate to be nil when not in danger zone")
	}
	if report.LowestBalance < 0 {
		t.Error("Expected LowestBalance to be positive for healthy projection")
	}
}

// ============================================================================
// Integration-like tests combining recurring + subscription matching
// ============================================================================

func TestMultipleRecurringOnSameDay(t *testing.T) {
	day := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC) // Sunday

	recs := []model.RecurringTransaction{
		{
			Frequency:     "daily",
			NextExecution: time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC),
			IsActive:      true,
		},
		{
			Frequency:     "monthly",
			NextExecution: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
			IsActive:      true,
		},
		{
			Frequency:     "weekly",
			NextExecution: time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC), // Sunday
			IsActive:      true,
		},
	}

	matchCount := 0
	for _, rec := range recs {
		if matchesRecurringDate(rec, day) {
			matchCount++
		}
	}

	if matchCount != 3 {
		t.Errorf("Expected 3 matches on March 15, got %d", matchCount)
	}
}

func TestMultipleSubscriptionsOnSameDay(t *testing.T) {
	day := time.Date(2026, time.April, 15, 0, 0, 0, 0, time.UTC) // Wednesday

	subs := []model.Subscription{
		{
			Name:            "Netflix",
			BillingCycle:    "monthly",
			NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
		},
		{
			Name:            "Spotify",
			BillingCycle:    "weekly",
			NextBillingDate: time.Date(2026, time.April, 15, 0, 0, 0, 0, time.UTC), // Wednesday
		},
		{
			Name:            "Adobe",
			BillingCycle:    "yearly",
			NextBillingDate: time.Date(2025, time.April, 15, 0, 0, 0, 0, time.UTC),
		},
		{
			Name:            "Gym",
			BillingCycle:    "quarterly",
			NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC), // 3 months later = April
		},
	}

	matchCount := 0
	matchedNames := []string{}
	for _, sub := range subs {
		if matchesSubscriptionDate(sub, day) {
			matchCount++
			matchedNames = append(matchedNames, sub.Name)
		}
	}

	if matchCount != 4 {
		t.Errorf("Expected 4 matches on April 15, got %d (matched: %v)", matchCount, matchedNames)
	}
}

// ============================================================================
// Edge case: subscription quarterly across year boundary
// ============================================================================

func TestMatchesSubscriptionDate_Quarterly_AcrossYearBoundary(t *testing.T) {
	sub := model.Subscription{
		BillingCycle:    "quarterly",
		NextBillingDate: time.Date(2026, time.November, 10, 0, 0, 0, 0, time.UTC),
	}

	// February next year: (2 - 11 + 12) % 12 = 3, 3 % 3 == 0 -> should match
	day := time.Date(2027, time.February, 10, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription to match across year boundary (Nov -> Feb)")
	}

	// May next year: (5 - 11 + 12) % 12 = 6, 6 % 3 == 0 -> should match
	day = time.Date(2027, time.May, 10, 0, 0, 0, 0, time.UTC)
	if !matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription to match across year boundary (Nov -> May)")
	}

	// December same year: (12 - 11 + 12) % 12 = 1, 1 % 3 != 0 -> should not match
	day = time.Date(2026, time.December, 10, 0, 0, 0, 0, time.UTC)
	if matchesSubscriptionDate(sub, day) {
		t.Error("Expected quarterly subscription not to match 1 month after billing (Dec)")
	}
}

// ============================================================================
// Edge case: Recurring with inactive status (tested at caller level)
// ============================================================================

func TestRecurringActiveFilter(t *testing.T) {
	// This tests the pattern used in GetCashFlowProjection where IsActive is checked
	recs := []model.RecurringTransaction{
		{
			Frequency:     "monthly",
			NextExecution: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
			IsActive:      true,
			Type:          "debit",
			Amount:        100,
		},
		{
			Frequency:     "monthly",
			NextExecution: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
			IsActive:      false,
			Type:          "debit",
			Amount:        200,
		},
	}

	day := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)
	activeMatches := 0
	for _, rec := range recs {
		if rec.IsActive && matchesRecurringDate(rec, day) {
			activeMatches++
		}
	}

	if activeMatches != 1 {
		t.Errorf("Expected 1 active match, got %d", activeMatches)
	}
}

// ============================================================================
// Edge case: subscription with status filtering
// ============================================================================

func TestSubscriptionActiveFilter(t *testing.T) {
	subs := []model.Subscription{
		{
			Name:            "Active Sub",
			BillingCycle:    "monthly",
			NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
			Status:          "active",
			Amount:          10,
		},
		{
			Name:            "Paused Sub",
			BillingCycle:    "monthly",
			NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
			Status:          "paused",
			Amount:          20,
		},
		{
			Name:            "Cancelled Sub",
			BillingCycle:    "monthly",
			NextBillingDate: time.Date(2026, time.January, 15, 0, 0, 0, 0, time.UTC),
			Status:          "cancelled",
			Amount:          30,
		},
	}

	day := time.Date(2026, time.March, 15, 0, 0, 0, 0, time.UTC)

	// Filter active subs like the service does
	var activeSubs []model.Subscription
	for _, sub := range subs {
		if sub.Status == "active" {
			activeSubs = append(activeSubs, sub)
		}
	}

	activeMatches := 0
	for _, sub := range activeSubs {
		if matchesSubscriptionDate(sub, day) {
			activeMatches++
		}
	}

	if activeMatches != 1 {
		t.Errorf("Expected 1 active subscription match, got %d", activeMatches)
	}
	if len(activeSubs) != 1 {
		t.Errorf("Expected 1 active subscription, got %d", len(activeSubs))
	}
}

// ============================================================================
// NewReportsService tests
// ============================================================================

func TestNewReportsService(t *testing.T) {
	svc := NewReportsService(nil, nil, nil, nil, nil)
	if svc == nil {
		t.Fatal("Expected service to be created, got nil")
	}
	if svc.walletRepo != nil {
		t.Error("Expected walletRepo to be nil")
	}
	if svc.exchangeService != nil {
		t.Error("Expected exchangeService to be nil")
	}
	if svc.recurringRepo != nil {
		t.Error("Expected recurringRepo to be nil")
	}
	if svc.subscriptionRepo != nil {
		t.Error("Expected subscriptionRepo to be nil")
	}
}

func TestNewReportsService_WithNilRecurringAndSubscription(t *testing.T) {
	// Verifies the constructor handles nil recurring/subscription repos gracefully
	svc := NewReportsService(nil, nil, nil, nil, nil)
	if svc == nil {
		t.Fatal("Expected service to be created with nil repos")
	}
}

// ============================================================================
// matchesDayOfMonth - February leap year specifics
// ============================================================================

func TestMatchesDayOfMonth_LeapYearSpecifics(t *testing.T) {
	// 2028 is a leap year

	// Day 29 on Feb 29 leap year -> exact match
	day := time.Date(2028, time.February, 29, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(29, day) {
		t.Error("Day 29 should match Feb 29 in leap year")
	}

	// Day 29 on Feb 28 leap year -> NOT a match (since Feb has 29 days, 29 <= 29, so exact match needed)
	day = time.Date(2028, time.February, 28, 0, 0, 0, 0, time.UTC)
	if matchesDayOfMonth(29, day) {
		t.Error("Day 29 should NOT match Feb 28 in leap year (29 <= 29, so exact match needed)")
	}

	// Day 30 on Feb 29 leap year -> clamped (30 > 29, so matches last day = 29)
	day = time.Date(2028, time.February, 29, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(30, day) {
		t.Error("Day 30 should match Feb 29 in leap year (clamped to last day)")
	}

	// Day 28 on Feb 28 in any year -> exact match
	day = time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC)
	if !matchesDayOfMonth(28, day) {
		t.Error("Day 28 should match Feb 28")
	}

	// Day 28 on Feb 29 in leap year -> NOT a match
	day = time.Date(2028, time.February, 29, 0, 0, 0, 0, time.UTC)
	if matchesDayOfMonth(28, day) {
		t.Error("Day 28 should NOT match Feb 29 in leap year")
	}
}

// ============================================================================
// Recurring date matching edge cases with specific weekdays
// ============================================================================

func TestMatchesRecurringDate_Weekly_AllWeekdays(t *testing.T) {
	// Test that weekly matching works for each day of the week
	// 2026-02-16 is Monday, 2026-02-17 is Tuesday, etc.
	for wd := time.Sunday; wd <= time.Saturday; wd++ {
		// Create a recurring with NextExecution on a known date for this weekday
		// 2026-02-15 is Sunday, 2026-02-16 is Monday, ..., 2026-02-21 is Saturday
		baseDate := time.Date(2026, time.February, 15, 0, 0, 0, 0, time.UTC) // Sunday
		nextExec := baseDate.AddDate(0, 0, int(wd))

		rec := model.RecurringTransaction{
			Frequency:     "weekly",
			NextExecution: nextExec,
		}

		// Test matching on same weekday, 7 days later
		matchDay := nextExec.AddDate(0, 0, 7)
		if !matchesRecurringDate(rec, matchDay) {
			t.Errorf("Expected weekly recurring on %s to match %s",
				nextExec.Weekday(), matchDay.Weekday())
		}

		// Test non-matching on next day
		nonMatchDay := nextExec.AddDate(0, 0, 1)
		if nextExec.Weekday() != time.Saturday && matchesRecurringDate(rec, nonMatchDay) {
			// Saturday+1 = Sunday which is a different weekday
			t.Errorf("Expected weekly recurring on %s not to match %s",
				nextExec.Weekday(), nonMatchDay.Weekday())
		}
	}
}
