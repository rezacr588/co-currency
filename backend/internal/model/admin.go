package model

import "time"

// AdminOverview is the read-only operator dashboard payload returned by
// GET /api/v1/admin/overview. Counts are point-in-time; recent slices are
// capped at small limits so this stays fast even on large databases.
type AdminOverview struct {
	GeneratedAt time.Time         `json:"generated_at"`
	App         AdminAppStats     `json:"app"`
	DB          AdminDBStats      `json:"db"`
	Recent      AdminRecentEvents `json:"recent"`
}

type AdminAppStats struct {
	UsersTotal           int64 `json:"users_total"`
	UsersSignedUp24h     int64 `json:"users_signed_up_24h"`
	TransactionsTotal    int64 `json:"transactions_total"`
	TransactionsLast24h  int64 `json:"transactions_last_24h"`
	ConversionsTotal     int64 `json:"conversions_total"`
	ActivePlans          int64 `json:"active_plans"`
	PendingApprovals     int64 `json:"pending_approvals"`
	ChatMessagesTotal    int64 `json:"chat_messages_total"`
	ChatMessagesLast24h  int64 `json:"chat_messages_last_24h"`
}

type AdminDBStats struct {
	SizeBytes int64                 `json:"size_bytes"`
	Tables    []AdminDBTableSummary `json:"tables"`
}

// AdminDBTableSummary is `pg_stat_user_tables.n_live_tup` — the planner's
// estimate of live rows. Cheap to read on any size DB; not exact, but fine
// for an operator overview.
type AdminDBTableSummary struct {
	Name string `json:"name"`
	Rows int64  `json:"rows"`
}

type AdminRecentEvents struct {
	Signups []AdminRecentSignup `json:"signups"`
}

type AdminRecentSignup struct {
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}
