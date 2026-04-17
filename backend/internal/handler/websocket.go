package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/internal/service"
	ws "github.com/rezacr588/currency-converter/internal/websocket"
	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			// Non-browser clients (native mobile, server-to-server) don't send Origin.
			return true
		}
		return middleware.IsOriginAllowed(origin, middleware.AllowedOrigins())
	},
}

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	hub         *ws.Hub
	authService *service.AuthService
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(hub *ws.Hub, authService *service.AuthService) *WebSocketHandler {
	return &WebSocketHandler{
		hub:         hub,
		authService: authService,
	}
}

func (h *WebSocketHandler) authenticateRequest(r *http.Request) (uuid.UUID, bool) {
	// If auth middleware already set context user, prefer that.
	if userID, ok := middleware.GetUserIDFromContext(r.Context()); ok {
		return userID, true
	}

	if h.authService == nil {
		return uuid.Nil, false
	}

	// Prefer a single-use ticket on query string — used by web clients that
	// can't attach headers to a native WebSocket. Full JWTs must never be
	// placed on a query string because they end up in access logs.
	if ticket := strings.TrimSpace(r.URL.Query().Get("ticket")); ticket != "" {
		if userID, ok := h.authService.ConsumeWSTicket(ticket); ok {
			return userID, true
		}
	}

	// Native clients keep using the Authorization header.
	token := ""
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	// Query-string JWT kept as a transitional fallback; remove after web
	// clients fully migrate to the ticket flow.
	if token == "" {
		token = strings.TrimSpace(r.URL.Query().Get("token"))
	}
	if token == "" {
		return uuid.Nil, false
	}

	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		return uuid.Nil, false
	}
	return claims.UserID, true
}

// HandleConnection upgrades HTTP to WebSocket and manages the connection
func (h *WebSocketHandler) HandleConnection(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	traceID := ctxkeys.GetTraceID(ctx)

	userID, ok := h.authenticateRequest(r)
	if !ok {
		httputil.UnauthorizedWithContext(ctx, w, "Authentication required")
		return
	}

	// Upgrade connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to upgrade WebSocket connection")
		return
	}

	// Create client
	client := &ws.Client{
		ID:     uuid.New(),
		UserID: userID,
		Send:   make(chan ws.Message, 256),
		Hub:    h.hub,
	}

	// Register client
	h.hub.RegisterClient(client)

	// Start goroutines for reading and writing
	go h.writePump(client, conn)
	go h.readPump(client, conn)
}

// readPump handles incoming messages from the WebSocket connection
func (h *WebSocketHandler) readPump(client *ws.Client, conn *websocket.Conn) {
	defer func() {
		h.hub.UnregisterClient(client)
		conn.Close()
	}()

	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg ws.Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error().
					Err(err).
					Str("client_id", client.ID.String()).
					Msg("WebSocket read error")
			}
			break
		}

		// Handle different message types
		switch msg.Type {
		case ws.MessageTypePong:
			// Client responded to ping
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		default:
			// Log unhandled message types
			log.Debug().
				Str("type", string(msg.Type)).
				Str("client_id", client.ID.String()).
				Msg("Received WebSocket message")
		}
	}
}

// writePump handles outgoing messages to the WebSocket connection
func (h *WebSocketHandler) writePump(client *ws.Client, conn *websocket.Conn) {
	ticker := time.NewTicker(45 * time.Second)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Channel closed
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if message.Type == ws.MessageTypePing {
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			} else {
				if err := conn.WriteJSON(message); err != nil {
					log.Error().
						Err(err).
						Str("client_id", client.ID.String()).
						Msg("Failed to write WebSocket message")
					return
				}
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// HandleStats returns WebSocket hub statistics
func (h *WebSocketHandler) HandleStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if _, ok := h.authenticateRequest(r); !ok {
		httputil.UnauthorizedWithContext(ctx, w, "Authentication required")
		return
	}
	stats := h.hub.GetStats()
	httputil.Success(w, stats)

	log.Info().
		Interface("stats", stats).
		Str("trace_id", ctxkeys.GetTraceID(ctx)).
		Msg("WebSocket stats requested")
}
