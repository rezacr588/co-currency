package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// MessageType represents different types of WebSocket messages
type MessageType string

const (
	MessageTypeAgentUpdate  MessageType = "agent_update"
	MessageTypeSocialUpdate MessageType = "social_update"
	MessageTypeSpaceUpdate  MessageType = "space_update"
	MessageTypeCryptoPrice  MessageType = "crypto_price"
	MessageTypeNotification MessageType = "notification"
	MessageTypePing         MessageType = "ping"
	MessageTypePong         MessageType = "pong"
)

// Message represents a WebSocket message
type Message struct {
	Type      MessageType     `json:"type"`
	UserID    uuid.UUID       `json:"user_id,omitempty"`
	Data      json.RawMessage `json:"data"`
	Timestamp time.Time       `json:"timestamp"`
}

// Client represents a connected WebSocket client
type Client struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Send   chan Message
	Hub    *Hub
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	// Registered clients (keyed by user ID for easy lookup)
	clients map[uuid.UUID]map[*Client]bool

	// Inbound messages from clients
	broadcast chan Message

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Context for shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	ctx, cancel := context.WithCancel(context.Background())
	return &Hub{
		clients:    make(map[uuid.UUID]map[*Client]bool),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		ctx:        ctx,
		cancel:     cancel,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-h.ctx.Done():
			log.Info().Msg("WebSocket hub shutting down")
			h.closeAllConnections()
			return

		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)

		case <-ticker.C:
			h.sendPingToAll()
		}
	}
}

// registerClient adds a client to the hub
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[client.UserID] == nil {
		h.clients[client.UserID] = make(map[*Client]bool)
	}
	h.clients[client.UserID][client] = true

	log.Info().
		Str("client_id", client.ID.String()).
		Str("user_id", client.UserID.String()).
		Int("total_clients", h.getTotalClients()).
		Msg("WebSocket client registered")
}

// RegisterClient enqueues a client registration
func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

// unregisterClient removes a client from the hub
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.clients[client.UserID]; ok {
		if _, exists := clients[client]; exists {
			delete(clients, client)
			close(client.Send)

			// Remove user entry if no more clients
			if len(clients) == 0 {
				delete(h.clients, client.UserID)
			}

			log.Info().
				Str("client_id", client.ID.String()).
				Str("user_id", client.UserID.String()).
				Int("total_clients", h.getTotalClients()).
				Msg("WebSocket client unregistered")
		}
	}
}

// UnregisterClient enqueues a client removal
func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

// broadcastMessage sends a message to all relevant clients
func (h *Hub) broadcastMessage(message Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	message.Timestamp = time.Now()

	// If message has a specific user ID, send only to that user's clients
	if message.UserID != uuid.Nil {
		if clients, ok := h.clients[message.UserID]; ok {
			for client := range clients {
				select {
				case client.Send <- message:
				default:
					// Client's send channel is full, skip
					log.Warn().
						Str("client_id", client.ID.String()).
						Msg("Client send buffer full, message dropped")
				}
			}
		}
	} else {
		// Broadcast to all clients
		for _, clients := range h.clients {
			for client := range clients {
				select {
				case client.Send <- message:
				default:
					log.Warn().
						Str("client_id", client.ID.String()).
						Msg("Client send buffer full, message dropped")
				}
			}
		}
	}
}

// SendToUser sends a message to all connections of a specific user
func (h *Hub) SendToUser(userID uuid.UUID, msgType MessageType, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	message := Message{
		Type:   msgType,
		UserID: userID,
		Data:   jsonData,
	}

	select {
	case h.broadcast <- message:
		return nil
	case <-h.ctx.Done():
		return context.Canceled
	}
}

// DispatchMessage enqueues a pre-serialized message for delivery.
func (h *Hub) DispatchMessage(message Message) error {
	select {
	case h.broadcast <- message:
		return nil
	case <-h.ctx.Done():
		return context.Canceled
	}
}

// BroadcastToAll sends a message to all connected clients
func (h *Hub) BroadcastToAll(msgType MessageType, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	message := Message{
		Type: msgType,
		Data: jsonData,
	}

	select {
	case h.broadcast <- message:
		return nil
	case <-h.ctx.Done():
		return context.Canceled
	}
}

// sendPingToAll sends ping messages to all clients
func (h *Hub) sendPingToAll() {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ping := Message{
		Type:      MessageTypePing,
		Timestamp: time.Now(),
	}

	for _, clients := range h.clients {
		for client := range clients {
			select {
			case client.Send <- ping:
			default:
				// Skip if buffer full
			}
		}
	}
}

// closeAllConnections closes all client connections
func (h *Hub) closeAllConnections() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for userID, clients := range h.clients {
		for client := range clients {
			close(client.Send)
		}
		delete(h.clients, userID)
	}
}

// Shutdown gracefully shuts down the hub
func (h *Hub) Shutdown() {
	h.cancel()
}

// getTotalClients returns the total number of connected clients (must be called with lock held)
func (h *Hub) getTotalClients() int {
	total := 0
	for _, clients := range h.clients {
		total += len(clients)
	}
	return total
}

// GetStats returns hub statistics
func (h *Hub) GetStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return map[string]interface{}{
		"total_clients":      h.getTotalClients(),
		"total_users":        len(h.clients),
		"broadcast_capacity": cap(h.broadcast),
		"broadcast_queued":   len(h.broadcast),
	}
}
