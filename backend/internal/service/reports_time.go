package service

import (
	"context"
	"strings"
	"time"
)

const reportsTimeZoneName = "Europe/Istanbul"

type reportTimeZoneContextKey struct{}

type reportTimeZoneContextValue struct {
	name     string
	location *time.Location
}

var reportsLocation = loadDefaultReportsLocation()

func loadDefaultReportsLocation() *time.Location {
	loc, err := time.LoadLocation(reportsTimeZoneName)
	if err != nil {
		return time.FixedZone(reportsTimeZoneName, 3*60*60)
	}
	return loc
}

func resolveReportTimeZone(timeZone string) reportTimeZoneContextValue {
	normalized := strings.TrimSpace(timeZone)
	if normalized == "" {
		return reportTimeZoneContextValue{name: reportsTimeZoneName, location: reportsLocation}
	}

	if normalized == "UTC" {
		return reportTimeZoneContextValue{name: "UTC", location: time.UTC}
	}

	loc, err := time.LoadLocation(normalized)
	if err != nil {
		return reportTimeZoneContextValue{name: reportsTimeZoneName, location: reportsLocation}
	}

	return reportTimeZoneContextValue{name: normalized, location: loc}
}

func WithReportTimeZone(ctx context.Context, timeZone string) context.Context {
	return context.WithValue(ctx, reportTimeZoneContextKey{}, resolveReportTimeZone(timeZone))
}

func ReportLocation(ctx context.Context) *time.Location {
	if value, ok := ctx.Value(reportTimeZoneContextKey{}).(reportTimeZoneContextValue); ok && value.location != nil {
		return value.location
	}
	return reportsLocation
}

func ReportTimeZone(ctx context.Context) string {
	if value, ok := ctx.Value(reportTimeZoneContextKey{}).(reportTimeZoneContextValue); ok && value.location != nil {
		return value.name
	}
	return reportsTimeZoneName
}

// ReportNow returns the current time in the default analytics timezone.
func ReportNow() time.Time {
	return reportNowInLocation(reportsLocation)
}

func ReportNowForContext(ctx context.Context) time.Time {
	return reportNowInLocation(ReportLocation(ctx))
}

func reportNow() time.Time {
	return ReportNow()
}

func reportNowInLocation(loc *time.Location) time.Time {
	return time.Now().In(loc)
}

func reportDayStart(t time.Time) time.Time {
	return reportDayStartInLocation(t, reportsLocation)
}

func reportDayStartForContext(ctx context.Context, t time.Time) time.Time {
	return reportDayStartInLocation(t, ReportLocation(ctx))
}

func reportDayStartInLocation(t time.Time, loc *time.Location) time.Time {
	local := t.In(loc)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
}

func reportDayEnd(t time.Time) time.Time {
	return reportDayEndInLocation(t, reportsLocation)
}

func reportDayEndForContext(ctx context.Context, t time.Time) time.Time {
	return reportDayEndInLocation(t, ReportLocation(ctx))
}

func reportDayEndInLocation(t time.Time, loc *time.Location) time.Time {
	return reportDayStartInLocation(t, loc).AddDate(0, 0, 1).Add(-time.Nanosecond)
}

func reportMonthBounds(year int, month time.Month) (time.Time, time.Time) {
	return reportMonthBoundsInLocation(year, month, reportsLocation)
}

func reportMonthBoundsForContext(ctx context.Context, year int, month time.Month) (time.Time, time.Time) {
	return reportMonthBoundsInLocation(year, month, ReportLocation(ctx))
}

func reportMonthBoundsInLocation(year int, month time.Month, loc *time.Location) (time.Time, time.Time) {
	start := time.Date(year, month, 1, 0, 0, 0, 0, loc)
	end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	return start.UTC(), end.UTC()
}

func reportWeekday(t time.Time) time.Weekday {
	return reportWeekdayInLocation(t, reportsLocation)
}

func reportWeekdayInLocation(t time.Time, loc *time.Location) time.Weekday {
	return t.In(loc).Weekday()
}

func reportDateString(t time.Time) string {
	return reportDateStringInLocation(t, reportsLocation)
}

func reportDateStringInLocation(t time.Time, loc *time.Location) string {
	return t.In(loc).Format("2006-01-02")
}

func reportDayDiff(anchor, day time.Time) int {
	return reportDayDiffInLocation(anchor, day, reportsLocation)
}

func reportDayDiffInLocation(anchor, day time.Time, loc *time.Location) int {
	return int(reportDayStartInLocation(day, loc).Sub(reportDayStartInLocation(anchor, loc)).Hours() / 24)
}

func reportMonthDiff(anchor, day time.Time) int {
	return reportMonthDiffInLocation(anchor, day, reportsLocation)
}

func reportMonthDiffInLocation(anchor, day time.Time, loc *time.Location) int {
	anchorLocal := anchor.In(loc)
	dayLocal := day.In(loc)
	return (dayLocal.Year()-anchorLocal.Year())*12 + int(dayLocal.Month()) - int(anchorLocal.Month())
}
