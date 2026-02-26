package middleware

import (
	"bufio"
	"bytes"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestLogging_Success(t *testing.T) {
	handlerCalled := false
	handler := Logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if !handlerCalled {
		t.Error("Expected handler to be called")
	}

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}
}

func TestLogging_DifferentStatusCodes(t *testing.T) {
	testCases := []struct {
		name   string
		status int
	}{
		{"OK", http.StatusOK},
		{"Created", http.StatusCreated},
		{"BadRequest", http.StatusBadRequest},
		{"NotFound", http.StatusNotFound},
		{"InternalError", http.StatusInternalServerError},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			handler := Logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
			}))

			req := httptest.NewRequest("GET", "/test", nil)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != tc.status {
				t.Errorf("Expected status %d, got %d", tc.status, rr.Code)
			}
		})
	}
}

func TestLogging_DifferentMethods(t *testing.T) {
	methods := []string{"GET", "POST", "PUT", "DELETE", "PATCH"}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			handler := Logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(method, "/test", nil)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Errorf("Expected status 200 for %s, got %d", method, rr.Code)
			}
		})
	}
}

func TestResponseWriter_WriteHeader(t *testing.T) {
	rr := httptest.NewRecorder()
	rw := &responseWriter{
		ResponseWriter: rr,
		status:         http.StatusOK,
	}

	rw.WriteHeader(http.StatusNotFound)

	if rw.status != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", rw.status)
	}

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected underlying status 404, got %d", rr.Code)
	}
}

func TestLogging_DefaultStatus(t *testing.T) {
	// Test that when WriteHeader is not explicitly called, status defaults to 200
	handler := Logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't call WriteHeader, just write body
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	// Default should be 200
	if rr.Code != http.StatusOK {
		t.Errorf("Expected default status 200, got %d", rr.Code)
	}
}

type hijackableTestWriter struct {
	header      http.Header
	conn        net.Conn
	brw         *bufio.ReadWriter
	hijackCalls int
}

func (w *hijackableTestWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *hijackableTestWriter) Write(p []byte) (int, error) {
	return len(p), nil
}

func (w *hijackableTestWriter) WriteHeader(_ int) {}

func (w *hijackableTestWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	w.hijackCalls++
	return w.conn, w.brw, nil
}

type basicTestWriter struct {
	header http.Header
}

func (w *basicTestWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *basicTestWriter) Write(p []byte) (int, error) {
	return len(p), nil
}

func (w *basicTestWriter) WriteHeader(_ int) {}

func TestResponseWriter_HijackDelegatesToUnderlyingWriter(t *testing.T) {
	serverConn, clientConn := net.Pipe()
	defer serverConn.Close()
	defer clientConn.Close()

	expectedBRW := bufio.NewReadWriter(bufio.NewReader(bytes.NewReader(nil)), bufio.NewWriter(bytes.NewBuffer(nil)))
	underlying := &hijackableTestWriter{
		conn: serverConn,
		brw:  expectedBRW,
	}
	rw := &responseWriter{
		ResponseWriter: underlying,
		status:         http.StatusOK,
	}

	conn, brw, err := rw.Hijack()
	if err != nil {
		t.Fatalf("expected hijack passthrough without error, got: %v", err)
	}
	if underlying.hijackCalls != 1 {
		t.Fatalf("expected underlying hijack to be called once, got %d", underlying.hijackCalls)
	}
	if conn != serverConn {
		t.Fatalf("expected hijacked conn to match underlying conn")
	}
	if brw != expectedBRW {
		t.Fatalf("expected hijacked readwriter to match underlying readwriter")
	}
}

func TestResponseWriter_HijackReturnsErrorWithoutUnderlyingHijacker(t *testing.T) {
	rw := &responseWriter{
		ResponseWriter: &basicTestWriter{},
		status:         http.StatusOK,
	}

	conn, brw, err := rw.Hijack()
	if err == nil {
		t.Fatalf("expected hijack error when underlying writer does not implement http.Hijacker")
	}
	if conn != nil || brw != nil {
		t.Fatalf("expected nil conn and readwriter on hijack error")
	}
	if !strings.Contains(err.Error(), "http.Hijacker") {
		t.Fatalf("expected hijack error to mention http.Hijacker, got: %v", err)
	}
}

func TestLogging_AllowsWebSocketUpgrade(t *testing.T) {
	serverErrCh := make(chan error, 1)
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	server := httptest.NewServer(Logging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			serverErrCh <- err
			return
		}
		defer conn.Close()

		msgType, payload, err := conn.ReadMessage()
		if err != nil {
			serverErrCh <- err
			return
		}
		if err := conn.WriteMessage(msgType, payload); err != nil {
			serverErrCh <- err
			return
		}

		serverErrCh <- nil
	})))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("expected websocket dial to succeed through logging middleware, got: %v", err)
	}
	defer clientConn.Close()

	wantPayload := "ping"
	if err := clientConn.WriteMessage(websocket.TextMessage, []byte(wantPayload)); err != nil {
		t.Fatalf("failed to send websocket payload: %v", err)
	}

	msgType, gotPayload, err := clientConn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read websocket payload: %v", err)
	}
	if msgType != websocket.TextMessage {
		t.Fatalf("expected websocket text message, got type=%d", msgType)
	}
	if string(gotPayload) != wantPayload {
		t.Fatalf("expected echoed payload %q, got %q", wantPayload, string(gotPayload))
	}

	select {
	case err := <-serverErrCh:
		if err != nil {
			t.Fatalf("server websocket handler failed: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server websocket handler")
	}
}
