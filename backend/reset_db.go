package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Println("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(ctx)

	fmt.Println("Resetting database...")

	// Disable triggers to ignore foreign key constraints during truncate if needed, 
	// but TRUNCATE CASCADE is cleaner.
tables := []string{
		"users",
		"wallet_balances",
		"transactions",
		"categories",
		"refresh_tokens",
		"goals",
		"tags",
		"transaction_tags",
		"budgets",
		"recurring_transactions",
		"subscriptions",
		"badges",
		"user_badges",
		"chat_conversations",
		"chat_messages",
	}

	for _, table := range tables {
		query := fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table)
		_, err := conn.Exec(ctx, query)
		if err != nil {
			fmt.Printf("Warning: failed to truncate %s: %v\n", table, err)
		} else {
			fmt.Printf("Truncated %s\n", table)
		}
	}

	fmt.Println("\nDatabase reset complete! All data has been wiped.")
}
