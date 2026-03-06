package service

import (
	"context"
	"testing"
	"time"
)

func TestParseISODateRange_UsesTurkishDayBounds(t *testing.T) {
	start, end, err := parseISODateRange(context.Background(), "2026-03-01", "2026-03-01")
	if err != nil {
		t.Fatalf("parseISODateRange returned error: %v", err)
	}

	expectedStart := time.Date(2026, time.February, 28, 21, 0, 0, 0, time.UTC)
	expectedEnd := time.Date(2026, time.March, 1, 20, 59, 59, int(time.Second-time.Nanosecond), time.UTC)

	if !start.Equal(expectedStart) {
		t.Fatalf("expected Turkish start %s, got %s", expectedStart.Format(time.RFC3339Nano), start.Format(time.RFC3339Nano))
	}
	if !end.Equal(expectedEnd) {
		t.Fatalf("expected Turkish end %s, got %s", expectedEnd.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	}
}

func TestReportMonthBounds_UsesTurkishMonthStart(t *testing.T) {
	start, end := reportMonthBounds(2026, time.March)

	expectedStart := time.Date(2026, time.February, 28, 21, 0, 0, 0, time.UTC)
	expectedEnd := time.Date(2026, time.March, 31, 20, 59, 59, int(time.Second-time.Nanosecond), time.UTC)

	if !start.Equal(expectedStart) {
		t.Fatalf("expected Turkish month start %s, got %s", expectedStart.Format(time.RFC3339Nano), start.Format(time.RFC3339Nano))
	}
	if !end.Equal(expectedEnd) {
		t.Fatalf("expected Turkish month end %s, got %s", expectedEnd.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	}
}

func TestReportMonthBoundsForContext_UsesRequestedTimeZone(t *testing.T) {
	ctx := WithReportTimeZone(context.Background(), "UTC")

	start, end := reportMonthBoundsForContext(ctx, 2026, time.March)

	expectedStart := time.Date(2026, time.March, 1, 0, 0, 0, 0, time.UTC)
	expectedEnd := time.Date(2026, time.March, 31, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC)

	if !start.Equal(expectedStart) {
		t.Fatalf("expected UTC month start %s, got %s", expectedStart.Format(time.RFC3339Nano), start.Format(time.RFC3339Nano))
	}
	if !end.Equal(expectedEnd) {
		t.Fatalf("expected UTC month end %s, got %s", expectedEnd.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	}
}
