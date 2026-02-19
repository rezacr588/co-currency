package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
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
	r.Post("/chat/stream", h.ChatStream)
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

	conversation, err := h.chatService.CreateConversation(r.Context(), userID, req.Title)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "Failed to create conversation", err)
		return
	}

	httputil.JSON(w, http.StatusCreated, map[string]interface{}{
		"conversation_id": conversation.ID.String(),
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

// maxChatMessageLength is the maximum allowed length for a chat message
const maxChatMessageLength = 5000

// Chat handles a chat message and returns AI response
func (h *AIChatHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.ChatRequest
	contentType := r.Header.Get("Content-Type")

	if strings.HasPrefix(contentType, "multipart/form-data") {
		// Parse multipart form (max 10MB)
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			httputil.BadRequestWithContext(r.Context(), w, "Failed to parse multipart form", err)
			return
		}
		req.Message = r.FormValue("message")
		req.ConversationID = r.FormValue("conversation_id")

		// Handle file attachment
		file, header, err := r.FormFile("file")
		if err == nil {
			defer file.Close()
			fileData := make([]byte, header.Size)
			if _, err := file.Read(fileData); err != nil {
				httputil.BadRequestWithContext(r.Context(), w, "Failed to read file", err)
				return
			}
			req.FileData = fileData
			req.FileMimeType = header.Header.Get("Content-Type")
			req.FileName = header.Filename

			// Validate MIME type
			validTypes := []string{"image/", "application/pdf", "text/csv", "audio/"}
			isValid := false
			for _, prefix := range validTypes {
				if strings.HasPrefix(req.FileMimeType, prefix) {
					isValid = true
					break
				}
			}
			if !isValid {
				httputil.BadRequestWithContext(r.Context(), w, "Unsupported file type: "+req.FileMimeType, nil)
				return
			}
		}
	} else {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.BadRequestWithContext(r.Context(), w, "Invalid request body", err)
			return
		}
	}

	if req.Message == "" && len(req.FileData) == 0 {
		httputil.BadRequestWithContext(r.Context(), w, "Message or file is required", nil)
		return
	}

	if len(req.Message) > maxChatMessageLength {
		httputil.BadRequestWithContext(r.Context(), w, fmt.Sprintf("Message too long: %d characters, maximum is %d", len(req.Message), maxChatMessageLength), nil)
		return
	}

	// Get user name for personalization
	user, err := h.authService.GetUserByID(r.Context(), userID)
	userName := "User"
	if err == nil && user != nil && user.Name != "" {
		userName = user.Name
	}

	// Handle file attachment - process based on type
	if len(req.FileData) > 0 {
		if strings.HasPrefix(req.FileMimeType, "image/") {
			// For images, use vision model to analyze
			result, err := h.chatService.GetAIService().ParseReceipt(r.Context(), req.FileData, req.FileMimeType)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to analyze image with vision model")
				// Append note about image to message
				if req.Message == "" {
					req.Message = "[User attached an image that could not be analyzed]"
				}
			} else {
				// Append extracted info to the message
				imgContext := fmt.Sprintf("\n\n[Attached image analysis: Amount=%.2f %s, Type=%s, Description=%s]",
					result.Amount, result.Currency, result.Type, result.Description)
				req.Message += imgContext
			}
		} else if strings.HasPrefix(req.FileMimeType, "audio/") {
			// For audio, transcribe first
			transcript, err := h.chatService.GetAIService().TranscribeAudio(r.Context(), req.FileData, req.FileMimeType)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to transcribe audio")
				if req.Message == "" {
					req.Message = "[User sent a voice message that could not be transcribed]"
				}
			} else {
				if req.Message == "" {
					req.Message = transcript
				} else {
					req.Message += "\n\n[Voice message transcript: " + transcript + "]"
				}
			}
		} else if req.FileMimeType == "text/csv" {
			// For CSV, read content and include in message
			csvContent := string(req.FileData)
			lines := strings.Split(csvContent, "\n")
			if len(lines) > 50 {
				lines = lines[:50]
			}
			csvPreview := strings.Join(lines, "\n")
			req.Message += "\n\n[Attached CSV data (first 50 rows):\n" + csvPreview + "]"
		} else if req.FileMimeType == "application/pdf" {
			// For PDF, include a note (full extraction would need pdfcpu)
			req.Message += "\n\n[User attached a PDF document: " + req.FileName + "]"
		}
	}

	response, err := h.chatService.Chat(r.Context(), userID, userName, req.ConversationID, req.Message)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidConversationID):
			httputil.BadRequestWithContext(r.Context(), w, "Invalid conversation ID", err)
		case errors.Is(err, service.ErrConversationNotFound):
			httputil.NotFoundWithContext(r.Context(), w, "Conversation not found", err)
		case isAIProviderError(err):
			httputil.ServiceUnavailableWithContext(r.Context(), w, "AI service is unavailable. Please try again later.", err)
		default:
			httputil.InternalServerErrorWithContext(r.Context(), w, "Failed to process chat", err)
		}
		return
	}

	httputil.JSON(w, http.StatusOK, response)
}

// ChatStream streams the AI response using Server-Sent Events.
func (h *AIChatHandler) ChatStream(w http.ResponseWriter, r *http.Request) {
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

	if len(req.Message) > maxChatMessageLength {
		httputil.BadRequestWithContext(r.Context(), w, fmt.Sprintf("Message too long: %d characters, maximum is %d", len(req.Message), maxChatMessageLength), nil)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httputil.InternalServerErrorWithContext(r.Context(), w, "Streaming not supported", nil)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	sendEvent := func(payload any) error {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	// Get user name for personalization
	user, err := h.authService.GetUserByID(r.Context(), userID)
	userName := "User"
	if err == nil && user != nil && user.Name != "" {
		userName = user.Name
	}

	response, err := h.chatService.ChatStream(
		r.Context(),
		userID,
		userName,
		req.ConversationID,
		req.Message,
		func(conversationID string) {
			if err := sendEvent(map[string]interface{}{
				"type":            "start",
				"conversation_id": conversationID,
			}); err != nil {
				log.Error().Err(err).Str("conversation_id", conversationID).Msg("Failed to send SSE start event")
			}
		},
		func(chunk string) error {
			return sendEvent(map[string]interface{}{
				"type":    "delta",
				"content": chunk,
			})
		},
	)
	if err != nil {
		message := err.Error()
		if errors.Is(err, service.ErrInvalidConversationID) {
			message = "Invalid conversation ID"
		} else if errors.Is(err, service.ErrConversationNotFound) {
			message = "Conversation not found"
		} else if isAIProviderError(err) {
			message = "AI service is unavailable. Please try again later."
		}
		if sseErr := sendEvent(map[string]interface{}{
			"type":  "error",
			"error": message,
		}); sseErr != nil {
			log.Error().Err(sseErr).Str("message", message).Msg("Failed to send SSE error event")
		}
		return
	}

	if err := sendEvent(map[string]interface{}{
		"type":            "done",
		"conversation_id": response.ConversationID,
		"message":         response.Message,
	}); err != nil {
		log.Error().Err(err).Str("conversation_id", response.ConversationID).Msg("Failed to send SSE done event")
	}
}

func isAIProviderError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "getting llm") ||
		strings.Contains(msg, "calling ai") ||
		strings.Contains(msg, "ai service") ||
		strings.Contains(msg, "api key") ||
		strings.Contains(msg, "unauthorized") ||
		strings.Contains(msg, "quota") ||
		strings.Contains(msg, "rate limit") ||
		strings.Contains(msg, "429")
}
