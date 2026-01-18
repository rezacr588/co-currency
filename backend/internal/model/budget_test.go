package model

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestBudget_Remaining(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
		spent  float64
		want   float64
	}{
		{"positive remaining", 1000, 300, 700},
		{"zero remaining", 500, 500, 0},
		{"negative remaining (over budget)", 500, 600, -100},
		{"no spending", 1000, 0, 1000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &Budget{Amount: tt.amount, Spent: tt.spent}
			if got := b.Remaining(); got != tt.want {
				t.Errorf("Remaining() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBudget_Progress(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
		spent  float64
		want   float64
	}{
		{"50% progress", 1000, 500, 50},
		{"0% progress", 1000, 0, 0},
		{"100% progress", 1000, 1000, 100},
		{"over budget", 1000, 1500, 150},
		{"zero amount", 0, 100, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &Budget{Amount: tt.amount, Spent: tt.spent}
			if got := b.Progress(); got != tt.want {
				t.Errorf("Progress() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBudget_IsOverBudget(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
		spent  float64
		want   bool
	}{
		{"not over budget", 1000, 500, false},
		{"exactly at budget", 1000, 1000, false},
		{"over budget", 1000, 1001, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &Budget{Amount: tt.amount, Spent: tt.spent}
			if got := b.IsOverBudget(); got != tt.want {
				t.Errorf("IsOverBudget() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBudget_IsNearLimit(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
		spent  float64
		want   bool
	}{
		{"not near limit (50%)", 1000, 500, false},
		{"not near limit (79%)", 1000, 790, false},
		{"at limit (80%)", 1000, 800, true},
		{"over limit (90%)", 1000, 900, true},
		{"over budget (150%)", 1000, 1500, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := &Budget{Amount: tt.amount, Spent: tt.spent}
			if got := b.IsNearLimit(); got != tt.want {
				t.Errorf("IsNearLimit() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBudget_PeriodDates(t *testing.T) {
	now := time.Now()

	t.Run("monthly period", func(t *testing.T) {
		b := &Budget{Period: "monthly"}
		start, end := b.PeriodDates()

		expectedStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		if !start.Equal(expectedStart) {
			t.Errorf("PeriodDates() start = %v, want %v", start, expectedStart)
		}

		// End should be last moment of the month
		nextMonth := expectedStart.AddDate(0, 1, 0)
		expectedEnd := nextMonth.Add(-time.Nanosecond)
		if !end.Equal(expectedEnd) {
			t.Errorf("PeriodDates() end = %v, want %v", end, expectedEnd)
		}
	})

	t.Run("yearly period", func(t *testing.T) {
		b := &Budget{Period: "yearly"}
		start, end := b.PeriodDates()

		expectedStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		if !start.Equal(expectedStart) {
			t.Errorf("PeriodDates() start = %v, want %v", start, expectedStart)
		}

		expectedEnd := time.Date(now.Year(), 12, 31, 23, 59, 59, 999999999, now.Location())
		if !end.Equal(expectedEnd) {
			t.Errorf("PeriodDates() end = %v, want %v", end, expectedEnd)
		}
	})

	t.Run("unknown period defaults to monthly", func(t *testing.T) {
		b := &Budget{Period: "unknown"}
		start, _ := b.PeriodDates()

		expectedStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		if !start.Equal(expectedStart) {
			t.Errorf("PeriodDates() start = %v, want %v", start, expectedStart)
		}
	})
}

func TestBudget_RemainingDays(t *testing.T) {
	now := time.Now()

	t.Run("monthly period returns days until month end", func(t *testing.T) {
		b := &Budget{Period: "monthly"}
		days := b.RemainingDays()

		// Calculate expected days
		_, end := b.PeriodDates()
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endDay := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())
		expected := int(endDay.Sub(today).Hours()/24) + 1

		if days != expected {
			t.Errorf("RemainingDays() = %v, want %v", days, expected)
		}

		// Should be at least 1
		if days < 1 {
			t.Errorf("RemainingDays() should be at least 1, got %v", days)
		}
	})

	t.Run("yearly period returns days until year end", func(t *testing.T) {
		b := &Budget{Period: "yearly"}
		days := b.RemainingDays()

		// Should be at least 1
		if days < 1 {
			t.Errorf("RemainingDays() should be at least 1, got %v", days)
		}

		// Should be at most 365/366
		if days > 366 {
			t.Errorf("RemainingDays() should be at most 366, got %v", days)
		}
	})
}

func TestBudget_DailyAllowance(t *testing.T) {
	t.Run("calculates daily allowance with remaining budget", func(t *testing.T) {
		b := &Budget{
			Amount: 1000,
			Spent:  0,
			Period: "monthly",
		}
		allowance := b.DailyAllowance()

		// Should be positive
		if allowance <= 0 {
			t.Errorf("DailyAllowance() should be positive, got %v", allowance)
		}

		// Allowance * remaining days should approximately equal remaining budget
		remainingDays := b.RemainingDays()
		totalAllowance := allowance * float64(remainingDays)
		remaining := b.Remaining()

		// Allow for small rounding differences
		diff := totalAllowance - remaining
		if diff < -1 || diff > 1 {
			t.Errorf("DailyAllowance() * RemainingDays() = %v, should be close to %v", totalAllowance, remaining)
		}
	})

	t.Run("returns 0 when over budget", func(t *testing.T) {
		b := &Budget{
			Amount: 1000,
			Spent:  1500,
			Period: "monthly",
		}
		allowance := b.DailyAllowance()

		if allowance != 0 {
			t.Errorf("DailyAllowance() = %v, want 0 when over budget", allowance)
		}
	})

	t.Run("returns 0 when exactly at budget", func(t *testing.T) {
		b := &Budget{
			Amount: 1000,
			Spent:  1000,
			Period: "monthly",
		}
		allowance := b.DailyAllowance()

		if allowance != 0 {
			t.Errorf("DailyAllowance() = %v, want 0 when at budget", allowance)
		}
	})

	t.Run("increases when unspent days carry over", func(t *testing.T) {
		// Simulate a scenario where user hasn't spent much
		// If remaining days is 10 and remaining budget is 1000,
		// daily allowance should be 100
		b := &Budget{
			Amount: 1000,
			Spent:  0,
			Period: "monthly",
		}

		remainingDays := b.RemainingDays()
		if remainingDays <= 0 {
			t.Skip("Cannot test carry-over at end of period")
		}

		// Calculate expected allowance based on remaining budget and days
		expectedAllowance := b.Remaining() / float64(remainingDays)
		actualAllowance := b.DailyAllowance()

		// Allow small rounding difference
		diff := actualAllowance - expectedAllowance
		if diff < -0.01 || diff > 0.01 {
			t.Errorf("DailyAllowance() = %v, expected approximately %v", actualAllowance, expectedAllowance)
		}
	})
}

func TestBudget_ToBudgetResponse(t *testing.T) {
	b := &Budget{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		Category:  "food",
		Amount:    1000,
		Currency:  "USD",
		Period:    "monthly",
		Spent:     300,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	resp := b.ToBudgetResponse()

	// Verify embedded budget
	if resp.Budget.ID != b.ID {
		t.Errorf("ToBudgetResponse() ID = %v, want %v", resp.Budget.ID, b.ID)
	}

	// Verify computed fields
	if resp.Remaining != 700 {
		t.Errorf("ToBudgetResponse() Remaining = %v, want 700", resp.Remaining)
	}

	if resp.Progress != 30 {
		t.Errorf("ToBudgetResponse() Progress = %v, want 30", resp.Progress)
	}

	if resp.IsOverBudget {
		t.Error("ToBudgetResponse() IsOverBudget should be false")
	}

	if resp.IsNearLimit {
		t.Error("ToBudgetResponse() IsNearLimit should be false for 30%")
	}

	if resp.DailyAllowance <= 0 {
		t.Errorf("ToBudgetResponse() DailyAllowance should be positive, got %v", resp.DailyAllowance)
	}

	if resp.RemainingDays < 1 {
		t.Errorf("ToBudgetResponse() RemainingDays should be at least 1, got %v", resp.RemainingDays)
	}

	if resp.PeriodStart.IsZero() {
		t.Error("ToBudgetResponse() PeriodStart should not be zero")
	}

	if resp.PeriodEnd.IsZero() {
		t.Error("ToBudgetResponse() PeriodEnd should not be zero")
	}

	// Verify period end is after period start
	if !resp.PeriodEnd.After(resp.PeriodStart) {
		t.Error("ToBudgetResponse() PeriodEnd should be after PeriodStart")
	}
}
