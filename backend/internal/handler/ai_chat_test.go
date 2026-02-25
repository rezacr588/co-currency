package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// chatHandlerCall invokes the Chat or ChatStream handler and returns the response code.
// If the handler panics (e.g., because authService is nil after passing validation),
// we recover and return -1, meaning validation passed but the service call panicked.
func chatHandlerCall(handler *AIChatHandler, method string, path string, body []byte, userID uuid.UUID) (statusCode int) {
	defer func() {
		if r := recover(); r != nil {
			// Panic means we got past validation into service logic
			statusCode = -1
		}
	}()

	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	if path == "/api/v1/ai/chat/stream" {
		handler.ChatStream(rr, req)
	} else {
		handler.Chat(rr, req)
	}

	return rr.Code
}

// TestChatHandler_RejectsMessageOver5000Chars verifies that the Chat handler
// rejects messages exceeding the maxChatMessageLength limit (5000 chars).
func TestChatHandler_RejectsMessageOver5000Chars(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	longMessage := strings.Repeat("a", 5001)
	body, _ := json.Marshal(map[string]string{
		"message": longMessage,
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.Chat(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for message > 5000 chars, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	// Verify the error message mentions the length
	var errResp map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err == nil {
		msg, _ := errResp["message"].(string)
		if !strings.Contains(msg, "5001") || !strings.Contains(msg, "5000") {
			t.Errorf("Expected error message to mention message length and limit, got %q", msg)
		}
	}
}

// TestChatHandler_AcceptsMessageAtExactLimit verifies that the Chat handler
// accepts a message at exactly the maxChatMessageLength (5000 chars).
// The handler gets past validation and panics on nil authService, which proves
// the length check passed.
func TestChatHandler_AcceptsMessageAtExactLimit(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	exactMessage := strings.Repeat("a", 5000)
	body, _ := json.Marshal(map[string]string{
		"message": exactMessage,
	})
	userID := uuid.New()

	statusCode := chatHandlerCall(handler, "POST", "/api/v1/ai/chat", body, userID)

	// Status -1 means it panicked past validation (nil authService), or a non-400 status
	// Either way, it should NOT be 400 for message length
	if statusCode == http.StatusBadRequest {
		t.Errorf("Message at exact limit (5000) should not be rejected for length, got status 400")
	}
}

// TestChatHandler_AcceptsMessageUnderLimit verifies that a normal short message
// passes the length validation.
func TestChatHandler_AcceptsMessageUnderLimit(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": "Hello, how are my finances?",
	})
	userID := uuid.New()

	statusCode := chatHandlerCall(handler, "POST", "/api/v1/ai/chat", body, userID)

	// Should not be rejected for length
	if statusCode == http.StatusBadRequest {
		t.Errorf("Short message should not be rejected for length, got status 400")
	}
}

// TestChatHandler_RejectsEmptyMessage verifies that the Chat handler
// rejects empty messages with 400.
func TestChatHandler_RejectsEmptyMessage(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": "",
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.Chat(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for empty message, got %d", rr.Code)
	}
}

// TestChatHandler_RejectsWhitespaceOnlyMessage verifies that whitespace-only
// messages are treated as empty and rejected with 400.
func TestChatHandler_RejectsWhitespaceOnlyMessage(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": " \n\t  ",
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.Chat(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for whitespace-only message, got %d", rr.Code)
	}
}

// TestChatStreamHandler_RejectsMessageOver5000Chars verifies that the ChatStream
// handler rejects messages exceeding the maxChatMessageLength limit (5000 chars).
func TestChatStreamHandler_RejectsMessageOver5000Chars(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	longMessage := strings.Repeat("b", 5001)
	body, _ := json.Marshal(map[string]string{
		"message": longMessage,
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat/stream", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ChatStream(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for message > 5000 chars in ChatStream, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	// Verify the error message mentions the length
	var errResp map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err == nil {
		msg, _ := errResp["message"].(string)
		if !strings.Contains(msg, "5001") || !strings.Contains(msg, "5000") {
			t.Errorf("Expected error message to mention message length and limit, got %q", msg)
		}
	}
}

// TestChatStreamHandler_RejectsEmptyMessage verifies that the ChatStream handler
// rejects empty messages with 400.
func TestChatStreamHandler_RejectsEmptyMessage(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": "",
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat/stream", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ChatStream(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for empty message in ChatStream, got %d", rr.Code)
	}
}

// TestChatStreamHandler_RejectsWhitespaceOnlyMessage verifies that ChatStream
// rejects messages containing only spaces/newlines.
func TestChatStreamHandler_RejectsWhitespaceOnlyMessage(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": "   \n   ",
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat/stream", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ChatStream(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for whitespace-only message in ChatStream, got %d", rr.Code)
	}
}

// TestChatHandler_NoUserInContext verifies that the Chat handler returns 401
// when no user ID is in the context.
func TestChatHandler_NoUserInContext(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": "Hello",
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.Chat(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 when no user in context, got %d", rr.Code)
	}
}

// TestChatStreamHandler_NoUserInContext verifies that the ChatStream handler
// returns 401 when no user ID is in the context.
func TestChatStreamHandler_NoUserInContext(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	body, _ := json.Marshal(map[string]string{
		"message": "Hello",
	})

	req := httptest.NewRequest("POST", "/api/v1/ai/chat/stream", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handler.ChatStream(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 when no user in context, got %d", rr.Code)
	}
}

// TestChatHandler_InvalidJSON verifies that the Chat handler rejects invalid JSON.
func TestChatHandler_InvalidJSON(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	req := httptest.NewRequest("POST", "/api/v1/ai/chat", bytes.NewBufferString("{invalid json}"))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.Chat(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid JSON, got %d", rr.Code)
	}
}

// TestChatStreamHandler_InvalidJSON verifies that the ChatStream handler rejects invalid JSON.
func TestChatStreamHandler_InvalidJSON(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	req := httptest.NewRequest("POST", "/api/v1/ai/chat/stream", bytes.NewBufferString("{invalid json}"))
	req.Header.Set("Content-Type", "application/json")
	userID := uuid.New()
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)
	rr := httptest.NewRecorder()

	handler.ChatStream(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for invalid JSON in ChatStream, got %d", rr.Code)
	}
}

// TestMaxChatMessageLength_Constant verifies that the constant is set to 5000.
func TestMaxChatMessageLength_Constant(t *testing.T) {
	if maxChatMessageLength != 5000 {
		t.Errorf("Expected maxChatMessageLength to be 5000, got %d", maxChatMessageLength)
	}
}

// TestChatHandler_MessageSizeValidation_TableDriven uses a table-driven approach
// to test various message sizes against the Chat handler.
func TestChatHandler_MessageSizeValidation_TableDriven(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	tests := []struct {
		name           string
		messageLen     int
		expectRejected bool
	}{
		{"1 char message", 1, false},
		{"100 chars", 100, false},
		{"4999 chars - under limit", 4999, false},
		{"5000 chars - at limit", 5000, false},
		{"5001 chars - over limit", 5001, true},
		{"10000 chars - well over limit", 10000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			message := strings.Repeat("x", tt.messageLen)
			body, _ := json.Marshal(map[string]string{
				"message": message,
			})
			userID := uuid.New()

			statusCode := chatHandlerCall(handler, "POST", "/api/v1/ai/chat", body, userID)

			if tt.expectRejected {
				if statusCode != http.StatusBadRequest {
					t.Errorf("Expected status 400 for %d char message, got %d", tt.messageLen, statusCode)
				}
			} else {
				// Should not be 400 for length validation
				if statusCode == http.StatusBadRequest {
					t.Errorf("Message of %d chars should not be rejected, got status 400", tt.messageLen)
				}
			}
		})
	}
}

// TestChatStreamHandler_MessageSizeValidation_TableDriven uses a table-driven approach
// to test various message sizes against the ChatStream handler.
func TestChatStreamHandler_MessageSizeValidation_TableDriven(t *testing.T) {
	handler := NewAIChatHandler(nil, nil)

	tests := []struct {
		name           string
		messageLen     int
		expectRejected bool
	}{
		{"1 char message", 1, false},
		{"5000 chars - at limit", 5000, false},
		{"5001 chars - over limit", 5001, true},
		{"10000 chars - well over limit", 10000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			message := strings.Repeat("x", tt.messageLen)
			body, _ := json.Marshal(map[string]string{
				"message": message,
			})
			userID := uuid.New()

			statusCode := chatHandlerCall(handler, "POST", "/api/v1/ai/chat/stream", body, userID)

			if tt.expectRejected {
				if statusCode != http.StatusBadRequest {
					t.Errorf("Expected status 400 for %d char message in ChatStream, got %d", tt.messageLen, statusCode)
				}
			} else {
				if statusCode == http.StatusBadRequest {
					t.Errorf("Message of %d chars should not be rejected in ChatStream, got status 400", tt.messageLen)
				}
			}
		})
	}
}

func TestNormalizeChatFileMIME_DetectsFromFileContent(t *testing.T) {
	pdfData := []byte("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")
	mimeType := normalizeChatFileMIME("application/octet-stream", pdfData, "receipt.pdf")
	if mimeType != "application/pdf" {
		t.Errorf("Expected detected MIME type application/pdf, got %q", mimeType)
	}
}

func TestNormalizeChatFileMIME_CSVFallbackByExtension(t *testing.T) {
	csvData := []byte("date,amount\n2026-01-01,120.50\n")
	mimeType := normalizeChatFileMIME("text/plain; charset=utf-8", csvData, "report.csv")
	if mimeType != "text/csv" {
		t.Errorf("Expected MIME type text/csv for .csv fallback, got %q", mimeType)
	}
}

func TestNormalizeChatFileMIME_CSVFallbackForOctetStream(t *testing.T) {
	csvData := []byte("date,amount\n2026-01-01,120.50\n")
	mimeType := normalizeChatFileMIME("application/octet-stream", csvData, "report.csv")
	if mimeType != "text/csv" {
		t.Errorf("Expected MIME type text/csv for octet-stream .csv fallback, got %q", mimeType)
	}
}

func TestIsCSVChatFile_AcceptsCommonCSVMIMEs(t *testing.T) {
	if !isCSVChatFile("text/csv", "report.csv") {
		t.Fatal("Expected text/csv to be accepted as CSV")
	}
	if !isCSVChatFile("application/vnd.ms-excel", "report.csv") {
		t.Fatal("Expected application/vnd.ms-excel to be accepted as CSV")
	}
	if !isCSVChatFile("text/plain", "report.csv") {
		t.Fatal("Expected text/plain with .csv extension to be accepted as CSV")
	}
}

func TestAppendChatContext_DoesNotPrefixNewlines(t *testing.T) {
	got := appendChatContext("", "[Attached CSV data]")
	if got != "[Attached CSV data]" {
		t.Errorf("Expected context without leading newlines, got %q", got)
	}

	got = appendChatContext("How much did I spend?", "[Attached CSV data]")
	if got != "How much did I spend?\n\n[Attached CSV data]" {
		t.Errorf("Unexpected combined context format: %q", got)
	}
}
