package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// maxJSONBodyBytes caps request bodies for JSON handlers. 1 MiB comfortably
// fits any legitimate payload (including AI chat turns with base64 images are
// routed through multipart, not JSON).
const maxJSONBodyBytes = 1 << 20

func requireUserID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	userID, ok := middleware.GetUserIDFromContext(r.Context())
	if !ok {
		httputil.UnauthorizedWithContext(r.Context(), w, "user not found in context")
		return uuid.Nil, false
	}
	return userID, true
}

func requireService(w http.ResponseWriter, available bool, message string) bool {
	if !available {
		httputil.ServiceUnavailable(w, message)
		return false
	}
	return true
}

// decodeJSON reads the request body into a value of type T.
// Returns the decoded value and true on success, or writes a 400 response and returns false.
// The body is capped at maxJSONBodyBytes to prevent memory exhaustion.
func decodeJSON[T any](w http.ResponseWriter, r *http.Request) (*T, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodyBytes)
	var v T
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			httputil.BadRequestWithContext(r.Context(), w, "request body too large", err)
			return nil, false
		}
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return nil, false
	}
	return &v, true
}

// parseUUIDParam extracts and parses a UUID URL parameter.
// resourceName is used in the error message (e.g. "goal" → "invalid goal ID").
func parseUUIDParam(w http.ResponseWriter, r *http.Request, paramName, resourceName string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, paramName))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, fmt.Sprintf("invalid %s ID", resourceName), err)
		return uuid.Nil, false
	}
	return id, true
}

func parsePaginationParams(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	return parsePaginationParamsWithMax(w, r, 500)
}

func parsePaginationParamsWithMax(w http.ResponseWriter, r *http.Request, maxLimit int) (int, int, bool) {
	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		parsed, err := strconv.Atoi(l)
		if err != nil {
			httputil.BadRequest(w, "invalid limit parameter")
			return 0, 0, false
		}
		if parsed <= 0 || parsed > maxLimit {
			httputil.BadRequest(w, fmt.Sprintf("limit must be between 1 and %d", maxLimit))
			return 0, 0, false
		}
		limit = parsed
	}

	if o := r.URL.Query().Get("offset"); o != "" {
		parsed, err := strconv.Atoi(o)
		if err != nil || parsed < 0 {
			httputil.BadRequest(w, "invalid offset parameter")
			return 0, 0, false
		}
		offset = parsed
	}

	return limit, offset, true
}
