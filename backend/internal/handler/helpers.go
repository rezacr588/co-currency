package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/middleware"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

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
