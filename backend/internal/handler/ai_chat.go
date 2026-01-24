package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// AIChatHandler handles AI chat endpoints
type AIChatHandler struct {
	chatService *service.AIChatService
	authService *service.AuthService
}

// NewAIChatHandler creates a new AIChatHandler
func NewAIChatHandler(chatService *service.AIChatService, authService *service.AuthService) *AIChatHandler {
	return &AIChatHandler{
		chatService: chatService,
		authService: authService,
	}
}

// RegisterRoutes registers the AI chat routes
func (h *AIChatHandler) RegisterRoutes(r chi.Router) {
	r.Get("/conversations", h.ListConversations)
	r.Post("/conversations", h.CreateConversation)
	r.Get("/conversations/{id}", h.GetConversation)
	r.Delete("/conversations/{id}", h.DeleteConversation)
	r.Post("/chat", h.Chat)
}

// ListConversations returns all conversations for the user
func (h *AIChatHandler) ListConversations(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	conversations, err := h.chatService.ListConversations(r.Context(), userID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "Failed to list conversations", err)
		return
	}

	if conversations == nil {
		conversations = []model.ChatConversation{}
	}

	httputil.JSON(w, http.StatusOK, map[string]interface{}{
		"conversations": conversations,
	})
}

// CreateConversation creates a new conversation
func (h *AIChatHandler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Title = "New Conversation"
	}
	if req.Title == "" {
		req.Title = "New Conversation"
	}

	// Get user name for context
	user, err := h.authService.GetUserByID(r.Context(), userID)
	userName := "User"
	if err == nil && user != nil && user.Name != "" {
		userName = user.Name
	}

	// Create conversation by sending an initial system message
	response, err := h.chatService.Chat(r.Context(), userID, userName, "", "Hello! I'm ready to help with my finances.")
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "Failed to create conversation", err)
		return
	}

	httputil.JSON(w, http.StatusCreated, map[string]interface{}{
		"conversation_id": response.ConversationID,
	})
}

// GetConversation returns a conversation with its messages
func (h *AIChatHandler) GetConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	conversationID := chi.URLParam(r, "id")
	if conversationID == "" {
		httputil.BadRequestWithContext(r.Context(), w, "conversation ID is required", nil)
		return
	}

	result, err := h.chatService.GetConversation(r.Context(), userID, conversationID)
	if err != nil {
		httputil.NotFoundWithContext(r.Context(), w, "Conversation not found", err)
		return
	}

	httputil.JSON(w, http.StatusOK, result)
}

// DeleteConversation deletes a conversation
func (h *AIChatHandler) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	conversationID := chi.URLParam(r, "id")
	if conversationID == "" {
		httputil.BadRequestWithContext(r.Context(), w, "conversation ID is required", nil)
		return
	}

	err := h.chatService.DeleteConversation(r.Context(), userID, conversationID)
	if err != nil {
		httputil.NotFoundWithContext(r.Context(), w, "Conversation not found", err)
		return
	}

	httputil.JSON(w, http.StatusOK, map[string]string{
		"message": "Conversation deleted",
	})
}

// Chat handles a chat message and returns AI response
func (h *AIChatHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "Invalid request body", err)
		return
	}

	if req.Message == "" {
		httputil.BadRequestWithContext(r.Context(), w, "Message is required", nil)
		return
	}

	// Get user name for personalization
	user, err := h.authService.GetUserByID(r.Context(), userID)
	userName := "User"
	if err == nil && user != nil && user.Name != "" {
		userName = user.Name
	}

	response, err := h.chatService.Chat(r.Context(), userID, userName, req.ConversationID, req.Message)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "Failed to process chat", err)
		return
	}

	httputil.JSON(w, http.StatusOK, response)
}
