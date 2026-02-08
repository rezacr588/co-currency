package migrations

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed sql/main/*.sql sql/irr/*.sql
var migrationsFS embed.FS

// ApplyMain applies migrations for the main application database.
func ApplyMain(ctx context.Context, pool *pgxpool.Pool) error {
	return apply(ctx, pool, "sql/main", "schema_migrations")
}

// ApplyIRR applies migrations for the IRR rates database.
func ApplyIRR(ctx context.Context, pool *pgxpool.Pool) error {
	return apply(ctx, pool, "sql/irr", "schema_migrations_irr")
}

func apply(ctx context.Context, pool *pgxpool.Pool, dir, table string) error {
	if pool == nil {
		return fmt.Errorf("nil database pool")
	}

	if _, err := pool.Exec(ctx, fmt.Sprintf(
		"CREATE TABLE IF NOT EXISTS %s (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
		table,
	)); err != nil {
		return fmt.Errorf("creating migrations table: %w", err)
	}

	paths, err := fs.Glob(migrationsFS, dir+"/*.sql")
	if err != nil {
		return fmt.Errorf("listing migrations: %w", err)
	}

	sort.Strings(paths)
	for _, path := range paths {
		version := strings.TrimPrefix(path, dir+"/")
		applied, err := isApplied(ctx, pool, table, version)
		if err != nil {
			return err
		}
		if applied {
			continue
		}

		contents, err := fs.ReadFile(migrationsFS, path)
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", version, err)
		}

		if strings.TrimSpace(string(contents)) == "" {
			return fmt.Errorf("migration %s is empty", version)
		}

		if err := applyOne(ctx, pool, table, version, string(contents)); err != nil {
			return err
		}
	}

	return nil
}

func isApplied(ctx context.Context, pool *pgxpool.Pool, table, version string) (bool, error) {
	query := fmt.Sprintf("SELECT 1 FROM %s WHERE version = $1", table)
	var marker int
	if err := pool.QueryRow(ctx, query, version).Scan(&marker); err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("checking migration %s: %w", version, err)
	}
	return true, nil
}

// stripGooseDown removes any -- +goose Down section and everything after it,
// so only the Up migration is executed.
func stripGooseDown(sql string) string {
	lower := strings.ToLower(sql)
	if idx := strings.Index(lower, "-- +goose down"); idx >= 0 {
		return strings.TrimSpace(sql[:idx])
	}
	return sql
}

func applyOne(ctx context.Context, pool *pgxpool.Pool, table, version, sql string) error {
	// Only execute the Up section — strip goose Down markers
	sql = stripGooseDown(sql)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning migration %s: %w", version, err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, sql); err != nil {
		return fmt.Errorf("executing migration %s: %w", version, err)
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf("INSERT INTO %s (version) VALUES ($1)", table), version); err != nil {
		return fmt.Errorf("recording migration %s: %w", version, err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing migration %s: %w", version, err)
	}

	return nil
}
