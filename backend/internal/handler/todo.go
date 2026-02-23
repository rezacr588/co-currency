package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

type TodoHandler struct {
	todoService *service.TodoService
}

func NewTodoHandler(todoService *service.TodoService) *TodoHandler {
	return &TodoHandler{todoService: todoService}
}

// GetTodoList handles GET /api/v1/todo
func (h *TodoHandler) GetTodoList(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	status := model.TodoStatus(strings.TrimSpace(r.URL.Query().Get("status")))

	includeArchived := false
	if raw := strings.TrimSpace(r.URL.Query().Get("include_archived")); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			httputil.BadRequestWithContext(r.Context(), w, "invalid include_archived value, expected true/false", err)
			return
		}
		includeArchived = parsed
	}

	list, err := h.todoService.GetTodoList(r.Context(), userID, status, includeArchived)
	if err != nil {
		if errors.Is(err, service.ErrInvalidTodoStatus) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get todo list", err)
		return
	}

	httputil.Success(w, list)
}
