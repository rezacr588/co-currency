package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// ChatRepository handles database operations for chat conversations and messages
type ChatRepository struct {
	pool *pgxpool.Pool
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
	msg := &model.ChatMessage{
		ID:             uuid.New(),
		ConversationID: conversationID,
		Role:           role,
		Content:        content,
		TokensUsed:     tokensUsed,
		CreatedAt:      time.Now(),
	}

	query := `
		INSERT INTO chat_messages (id, conversation_id, role, content, tokens_used, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.pool.Exec(ctx, query, msg.ID, msg.ConversationID, msg.Role, msg.Content, msg.TokensUsed, msg.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("adding message: %w", err)
	}

	// Update conversation updated_at
	r.pool.Exec(ctx, `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`, conversationID)

	return msg, nil
}

// GetMessages retrieves all messages for a conversation
func (r *ChatRepository) GetMessages(ctx context.Context, conversationID uuid.UUID) ([]model.ChatMessage, error) {
	query := `
		SELECT id, conversation_id, role, content, COALESCE(tokens_used, 0), created_at
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
		if err := rows.Scan(&msg.ID, &msg.ConversationID, &msg.Role, &msg.Content, &msg.TokensUsed, &msg.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning message: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// GetRecentMessages retrieves the last N messages for context
func (r *ChatRepository) GetRecentMessages(ctx context.Context, conversationID uuid.UUID, limit int) ([]model.ChatMessage, error) {
	query := `
		SELECT id, conversation_id, role, content, COALESCE(tokens_used, 0), created_at
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
		if err := rows.Scan(&msg.ID, &msg.ConversationID, &msg.Role, &msg.Content, &msg.TokensUsed, &msg.CreatedAt); err != nil {
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
