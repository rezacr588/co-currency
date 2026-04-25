package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// AdminRepository surfaces operator-dashboard read queries. All queries run
// against the main pool. Counts use cheap variants (table-level aggregates,
// pg_stat_user_tables for table sizing) so the dashboard is fast even on a
// large database.
type AdminRepository struct {
	pool *pgxpool.Pool
}

// NewAdminRepository wires the admin repo to the main connection pool.
func NewAdminRepository(pool *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{pool: pool}
}

// GetOverview returns the consolidated operator dashboard. Each section runs
// independently; if any single section fails, the whole call fails — we want
// to surface DB issues clearly rather than silently degrade.
func (r *AdminRepository) GetOverview(ctx context.Context) (*model.AdminOverview, error) {
	if r == nil || r.pool == nil {
		return nil, errors.New("admin repository: nil pool")
	}

	app, err := r.appStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("app stats: %w", err)
	}
	db, err := r.dbStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("db stats: %w", err)
	}
	signups, err := r.recentSignups(ctx, 5)
	if err != nil {
		return nil, fmt.Errorf("recent signups: %w", err)
	}

	return &model.AdminOverview{
		GeneratedAt: time.Now().UTC(),
		App:         app,
		DB:          db,
		Recent:      model.AdminRecentEvents{Signups: signups},
	}, nil
}

func (r *AdminRepository) appStats(ctx context.Context) (model.AdminAppStats, error) {
	var s model.AdminAppStats

	// COUNT(*) per table is fine here — these are operator metrics, not
	// hot-path queries. Each runs in its own round-trip; total ~9 trips, all
	// fast on indexes.
	queries := []struct {
		dst *int64
		sql string
	}{
		{&s.UsersTotal, `SELECT COUNT(*) FROM users`},
		{&s.UsersSignedUp24h, `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'`},
		{&s.TransactionsTotal, `SELECT COUNT(*) FROM transactions`},
		{&s.TransactionsLast24h, `SELECT COUNT(*) FROM transactions WHERE created_at >= NOW() - INTERVAL '24 hours'`},
		{&s.ConversionsTotal, `SELECT COUNT(*) FROM transactions WHERE type = 'convert'`},
		{&s.ActivePlans, `SELECT COUNT(*) FROM agent_plans WHERE status = 'active'`},
		{&s.PendingApprovals, `SELECT COUNT(*) FROM action_approvals WHERE approval_status = 'pending'`},
		{&s.ChatMessagesTotal, `SELECT COUNT(*) FROM chat_messages`},
		{&s.ChatMessagesLast24h, `SELECT COUNT(*) FROM chat_messages WHERE created_at >= NOW() - INTERVAL '24 hours'`},
	}
	for _, q := range queries {
		if err := r.pool.QueryRow(ctx, q.sql).Scan(q.dst); err != nil {
			return s, fmt.Errorf("%s: %w", q.sql, err)
		}
	}
	return s, nil
}

func (r *AdminRepository) dbStats(ctx context.Context) (model.AdminDBStats, error) {
	var s model.AdminDBStats

	if err := r.pool.QueryRow(ctx, `SELECT pg_database_size(current_database())`).Scan(&s.SizeBytes); err != nil {
		return s, fmt.Errorf("db size: %w", err)
	}

	// Top 20 tables by live row estimate. n_live_tup is updated by the autovacuum
	// daemon — close enough for an operator dashboard, no full table scan needed.
	rows, err := r.pool.Query(ctx, `
		SELECT relname, n_live_tup
		FROM pg_stat_user_tables
		WHERE schemaname = 'public'
		ORDER BY n_live_tup DESC NULLS LAST
		LIMIT 20
	`)
	if err != nil {
		return s, fmt.Errorf("table sizes: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var t model.AdminDBTableSummary
		if err := rows.Scan(&t.Name, &t.Rows); err != nil {
			return s, fmt.Errorf("scan table summary: %w", err)
		}
		s.Tables = append(s.Tables, t)
	}
	if err := rows.Err(); err != nil {
		return s, fmt.Errorf("iterate table summaries: %w", err)
	}
	return s, nil
}

func (r *AdminRepository) recentSignups(ctx context.Context, limit int) ([]model.AdminRecentSignup, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT email, created_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.AdminRecentSignup, 0, limit)
	for rows.Next() {
		var s model.AdminRecentSignup
		if err := rows.Scan(&s.Email, &s.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
