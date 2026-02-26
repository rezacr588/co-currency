package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
)

// ChatRepository handles database operations for chat conversations and messages
type ChatRepository struct {
	pool *pgxpool.Pool
}

type ChatMessageMeta struct {
	Provider         string
	Model            string
	ThinkingMode     string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	EstimatedCostUSD *float64
	BilledCostUSD    *float64
	BillingSource    string
}

// NewChatRepository creates a new ChatRepository
func NewChatRepository(pool *pgxpool.Pool) *ChatRepository {
	return &ChatRepository{pool: pool}
}

// CreateConversation creates a new chat conversation
func (r *ChatRepository) CreateConversation(ctx context.Context, userID uuid.UUID, title string) (*model.ChatConversation, error) {
	conv := &model.ChatConversation{
		ID:        uuid.New(),
		UserID:    userID,
		Title:     title,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `
		INSERT INTO chat_conversations (id, user_id, title, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.pool.Exec(ctx, query, conv.ID, conv.UserID, conv.Title, conv.CreatedAt, conv.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating conversation: %w", err)
	}

	return conv, nil
}

// GetConversation retrieves a conversation by ID
func (r *ChatRepository) GetConversation(ctx context.Context, id uuid.UUID) (*model.ChatConversation, error) {
	query := `
		SELECT id, user_id, title, created_at, updated_at
		FROM chat_conversations
		WHERE id = $1
	`
	var conv model.ChatConversation
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&conv.ID, &conv.UserID, &conv.Title, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("getting conversation: %w", err)
	}
	return &conv, nil
}

// ListConversations lists all conversations for a user
func (r *ChatRepository) ListConversations(ctx context.Context, userID uuid.UUID) ([]model.ChatConversation, error) {
	query := `
		SELECT id, user_id, title, created_at, updated_at
		FROM chat_conversations
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT 50
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("listing conversations: %w", err)
	}
	defer rows.Close()

	var conversations []model.ChatConversation
	for rows.Next() {
		var conv model.ChatConversation
		if err := rows.Scan(&conv.ID, &conv.UserID, &conv.Title, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning conversation: %w", err)
		}
		conversations = append(conversations, conv)
	}

	return conversations, nil
}

// DeleteConversation deletes a conversation and its messages
func (r *ChatRepository) DeleteConversation(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`
	result, err := r.pool.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("deleting conversation: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("conversation not found")
	}
	return nil
}

// UpdateConversationTitle updates the title and updated_at timestamp
func (r *ChatRepository) UpdateConversationTitle(ctx context.Context, id uuid.UUID, title string) error {
	query := `UPDATE chat_conversations SET title = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, title, id)
	return err
}

// AddMessage adds a message to a conversation
func (r *ChatRepository) AddMessage(ctx context.Context, conversationID uuid.UUID, role, content string, tokensUsed int) (*model.ChatMessage, error) {
	return r.AddMessageWithMeta(ctx, conversationID, role, content, tokensUsed, nil)
}

// AddMessageWithMeta adds a message with optional usage metadata.
func (r *ChatRepository) AddMessageWithMeta(ctx context.Context, conversationID uuid.UUID, role, content string, tokensUsed int, meta *ChatMessageMeta) (*model.ChatMessage, error) {
	msg := &model.ChatMessage{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		TokensUsed:     tokensUsed,
		CreatedAt:      time.Now(),
	}
	if meta != nil {
		msg.Provider = meta.Provider
		msg.Model = meta.Model
		msg.ThinkingMode = meta.ThinkingMode
		msg.PromptTokens = meta.PromptTokens
		msg.CompletionTokens = meta.CompletionTokens
		msg.TotalTokens = meta.TotalTokens
		msg.EstimatedCostUSD = meta.EstimatedCostUSD
		msg.BilledCostUSD = meta.BilledCostUSD
		msg.BillingSource = meta.BillingSource
	}
	if msg.BillingSource == "" {
		msg.BillingSource = "estimated"
	}

	query := `
		INSERT INTO chat_messages (
			id, conversation_id, role, content, tokens_used, provider, model, thinking_mode,
			prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, billed_cost_usd, billing_source, created_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14, $15
		)
	`
	_, err := r.pool.Exec(
		ctx,
		query,
		msg.ID,
		msg.ConversationID,
		msg.Role,
		msg.Content,
		msg.TokensUsed,
		nullableChatText(msg.Provider),
		nullableChatText(msg.Model),
		nullableChatText(msg.ThinkingMode),
		msg.PromptTokens,
		msg.CompletionTokens,
		msg.TotalTokens,
		msg.EstimatedCostUSD,
		msg.BilledCostUSD,
		msg.BillingSource,
		msg.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("adding message: %w", err)
	}

	// Update conversation updated_at (log error but don't fail the message save)
	if _, err := r.pool.Exec(ctx, `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`, conversationID); err != nil {
		// Log the error but don't return it - the message was saved successfully
		log.Warn().Err(err).Str("conversation_id", conversationID.String()).Msg("Failed to update conversation timestamp")
	}

	return msg, nil
}

// GetMessages retrieves all messages for a conversation
func (r *ChatRepository) GetMessages(ctx context.Context, conversationID uuid.UUID) ([]model.ChatMessage, error) {
	query := `
		SELECT
			id, conversation_id, role, content, COALESCE(tokens_used, 0), COALESCE(provider, ''), COALESCE(model, ''),
			COALESCE(thinking_mode, ''), COALESCE(prompt_tokens, 0), COALESCE(completion_tokens, 0), COALESCE(total_tokens, 0),
			estimated_cost_usd, billed_cost_usd, COALESCE(billing_source, ''), created_at
		FROM chat_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, conversationID)
	if err != nil {
		return nil, fmt.Errorf("getting messages: %w", err)
	}
	defer rows.Close()

	var messages []model.ChatMessage
	for rows.Next() {
		var msg model.ChatMessage
		if err := rows.Scan(
			&msg.ID,
			&msg.ConversationID,
			&msg.Role,
			&msg.Content,
			&msg.TokensUsed,
			&msg.Provider,
			&msg.Model,
			&msg.ThinkingMode,
			&msg.PromptTokens,
			&msg.CompletionTokens,
			&msg.TotalTokens,
			&msg.EstimatedCostUSD,
			&msg.BilledCostUSD,
			&msg.BillingSource,
			&msg.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// GetRecentMessages retrieves the last N messages for context
func (r *ChatRepository) GetRecentMessages(ctx context.Context, conversationID uuid.UUID, limit int) ([]model.ChatMessage, error) {
	query := `
		SELECT
			id, conversation_id, role, content, COALESCE(tokens_used, 0), COALESCE(provider, ''), COALESCE(model, ''),
			COALESCE(thinking_mode, ''), COALESCE(prompt_tokens, 0), COALESCE(completion_tokens, 0), COALESCE(total_tokens, 0),
			estimated_cost_usd, billed_cost_usd, COALESCE(billing_source, ''), created_at
		FROM chat_messages
		WHERE conversation_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.pool.Query(ctx, query, conversationID, limit)
	if err != nil {
		return nil, fmt.Errorf("getting recent messages: %w", err)
	}
	defer rows.Close()

	var messages []model.ChatMessage
	for rows.Next() {
		var msg model.ChatMessage
		if err := rows.Scan(
			&msg.ID,
			&msg.ConversationID,
			&msg.Role,
			&msg.Content,
			&msg.TokensUsed,
			&msg.Provider,
			&msg.Model,
			&msg.ThinkingMode,
			&msg.PromptTokens,
			&msg.CompletionTokens,
			&msg.TotalTokens,
			&msg.EstimatedCostUSD,
			&msg.BilledCostUSD,
			&msg.BillingSource,
			&msg.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning message: %w", err)
		}
		messages = append(messages, msg)
	}

	// Reverse to get chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// GetUsageSummary returns aggregated token and cost usage for assistant messages.
func (r *ChatRepository) GetUsageSummary(ctx context.Context, userID uuid.UUID, days int) (*model.ChatUsageSummary, error) {
	if days <= 0 {
		days = 7
	}

	summary := &model.ChatUsageSummary{
		Days:     days,
		Currency: "USD",
		Daily:    []model.ChatUsageDaily{},
		ByModel:  []model.ChatUsageByModel{},
	}

	totalsQuery := `
		SELECT
			COUNT(*)::int,
			COALESCE(SUM(m.prompt_tokens), 0)::int,
			COALESCE(SUM(m.completion_tokens), 0)::int,
			COALESCE(SUM(m.total_tokens), 0)::int,
			COALESCE(SUM(m.estimated_cost_usd), 0)::float8,
			COALESCE(SUM(m.billed_cost_usd), 0)::float8
		FROM chat_messages m
		INNER JOIN chat_conversations c ON c.id = m.conversation_id
		WHERE c.user_id = $1
			AND m.role = 'assistant'
			AND m.created_at >= NOW() - ($2::text || ' days')::interval
	`

	if err := r.pool.QueryRow(ctx, totalsQuery, userID, days).Scan(
		&summary.Totals.Messages,
		&summary.Totals.PromptTokens,
		&summary.Totals.CompletionTokens,
		&summary.Totals.TotalTokens,
		&summary.Totals.EstimatedCostUSD,
		&summary.Totals.BilledCostUSD,
	); err != nil {
		return nil, fmt.Errorf("getting usage totals: %w", err)
	}

	dailyQuery := `
		SELECT
			DATE_TRUNC('day', m.created_at)::date::text AS day,
			COUNT(*)::int,
			COALESCE(SUM(m.prompt_tokens), 0)::int,
			COALESCE(SUM(m.completion_tokens), 0)::int,
			COALESCE(SUM(m.total_tokens), 0)::int,
			COALESCE(SUM(m.estimated_cost_usd), 0)::float8,
			COALESCE(SUM(m.billed_cost_usd), 0)::float8
		FROM chat_messages m
		INNER JOIN chat_conversations c ON c.id = m.conversation_id
		WHERE c.user_id = $1
			AND m.role = 'assistant'
			AND m.created_at >= NOW() - ($2::text || ' days')::interval
		GROUP BY DATE_TRUNC('day', m.created_at)::date
		ORDER BY day ASC
	`

	dailyRows, err := r.pool.Query(ctx, dailyQuery, userID, days)
	if err != nil {
		return nil, fmt.Errorf("getting daily usage: %w", err)
	}
	defer dailyRows.Close()

	for dailyRows.Next() {
		var day model.ChatUsageDaily
		if err := dailyRows.Scan(
			&day.Day,
			&day.Messages,
			&day.PromptTokens,
			&day.CompletionTokens,
			&day.TotalTokens,
			&day.EstimatedCostUSD,
			&day.BilledCostUSD,
		); err != nil {
			return nil, fmt.Errorf("scanning daily usage: %w", err)
		}
		summary.Daily = append(summary.Daily, day)
	}

	byModelQuery := `
		SELECT
			COALESCE(NULLIF(m.provider, ''), 'unknown') AS provider,
			COALESCE(NULLIF(m.model, ''), 'unknown') AS model,
			COUNT(*)::int,
			COALESCE(SUM(m.prompt_tokens), 0)::int,
			COALESCE(SUM(m.completion_tokens), 0)::int,
			COALESCE(SUM(m.total_tokens), 0)::int,
			COALESCE(SUM(m.estimated_cost_usd), 0)::float8,
			COALESCE(SUM(m.billed_cost_usd), 0)::float8,
			CASE
				WHEN BOOL_OR(m.billing_source = 'hybrid') OR (BOOL_OR(m.billing_source = 'exact') AND BOOL_OR(m.billing_source = 'estimated')) THEN 'hybrid'
				WHEN BOOL_OR(m.billing_source = 'exact') THEN 'exact'
				ELSE 'estimated'
			END AS billing_source
		FROM chat_messages m
		INNER JOIN chat_conversations c ON c.id = m.conversation_id
		WHERE c.user_id = $1
			AND m.role = 'assistant'
			AND m.created_at >= NOW() - ($2::text || ' days')::interval
		GROUP BY provider, model
		ORDER BY COALESCE(SUM(m.total_tokens), 0) DESC, provider ASC, model ASC
	`

	modelRows, err := r.pool.Query(ctx, byModelQuery, userID, days)
	if err != nil {
		return nil, fmt.Errorf("getting model usage: %w", err)
	}
	defer modelRows.Close()

	for modelRows.Next() {
		var row model.ChatUsageByModel
		if err := modelRows.Scan(
			&row.Provider,
			&row.Model,
			&row.Messages,
			&row.PromptTokens,
			&row.CompletionTokens,
			&row.TotalTokens,
			&row.EstimatedCostUSD,
			&row.BilledCostUSD,
			&row.BillingSource,
		); err != nil {
			return nil, fmt.Errorf("scanning model usage: %w", err)
		}
		summary.ByModel = append(summary.ByModel, row)
	}

	return summary, nil
}

func nullableChatText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
