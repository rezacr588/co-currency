package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

type TaskHandler struct {
	taskService *service.TaskService
}

func NewTaskHandler(taskService *service.TaskService) *TaskHandler {
	return &TaskHandler{taskService: taskService}
}

// GetTasks handles GET /api/v1/tasks
func (h *TaskHandler) GetTasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	filter := model.TaskListFilter{}

	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		filter.Status = model.TaskStatus(status)
	}
	if priority := strings.TrimSpace(r.URL.Query().Get("priority")); priority != "" {
		filter.Priority = model.TaskPriority(priority)
	}
	if goalID := strings.TrimSpace(r.URL.Query().Get("goal_id")); goalID != "" {
		parsed, err := uuid.Parse(goalID)
		if err != nil {
			httputil.BadRequestWithContext(r.Context(), w, "invalid goal_id")
			return
		}
		filter.GoalID = &parsed
	}
	if transactionID := strings.TrimSpace(r.URL.Query().Get("transaction_id")); transactionID != "" {
		parsed, err := uuid.Parse(transactionID)
		if err != nil {
			httputil.BadRequestWithContext(r.Context(), w, "invalid transaction_id")
			return
		}
		filter.TransactionID = &parsed
	}

	tasks, err := h.taskService.GetTasks(r.Context(), userID, filter)
	if err != nil {
		if errors.Is(err, service.ErrInvalidTaskStatus) || errors.Is(err, service.ErrInvalidTaskPriority) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get tasks", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"tasks": tasks,
	})
}

// GetTask handles GET /api/v1/tasks/{id}
func (h *TaskHandler) GetTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid task ID")
		return
	}

	task, err := h.taskService.GetTask(r.Context(), userID, taskID)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "task not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get task", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"task": task,
	})
}

// CreateTask handles POST /api/v1/tasks
func (h *TaskHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	task, err := h.taskService.CreateTask(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "transaction not found")
			return
		}
		if errors.Is(err, service.ErrTaskTitleRequired) ||
			errors.Is(err, service.ErrInvalidTaskStatus) ||
			errors.Is(err, service.ErrInvalidTaskPriority) ||
			isTaskValidationError(err) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to create task", err)
		return
	}

	httputil.Created(w, map[string]interface{}{
		"task": task,
	})
}

// UpdateTask handles PUT /api/v1/tasks/{id}
func (h *TaskHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid task ID")
		return
	}

	var req model.UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body", err)
		return
	}

	task, err := h.taskService.UpdateTask(r.Context(), userID, taskID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "task not found")
			return
		}
		if errors.Is(err, repository.ErrGoalNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "goal not found")
			return
		}
		if errors.Is(err, repository.ErrTransactionNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "transaction not found")
			return
		}
		if errors.Is(err, service.ErrTaskTitleRequired) ||
			errors.Is(err, service.ErrInvalidTaskStatus) ||
			errors.Is(err, service.ErrInvalidTaskPriority) ||
			isTaskValidationError(err) {
			httputil.BadRequestWithContext(r.Context(), w, err.Error(), err)
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to update task", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"task": task,
	})
}

// CompleteTask handles POST /api/v1/tasks/{id}/complete
func (h *TaskHandler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid task ID")
		return
	}

	task, err := h.taskService.CompleteTask(r.Context(), userID, taskID)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "task not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to complete task", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"task": task,
	})
}

// DeleteTask handles DELETE /api/v1/tasks/{id}
func (h *TaskHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid task ID")
		return
	}

	if err := h.taskService.DeleteTask(r.Context(), userID, taskID); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "task not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete task", err)
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "task deleted successfully",
	})
}

// GetTaskStatuses handles GET /api/v1/tasks/statuses
func (h *TaskHandler) GetTaskStatuses(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"statuses": model.TaskStatuses,
	})
}

// GetTaskPriorities handles GET /api/v1/tasks/priorities
func (h *TaskHandler) GetTaskPriorities(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"priorities": model.TaskPriorities,
	})
}

func isTaskValidationError(err error) bool {
	msg := err.Error()
	for _, marker := range []string{
		"invalid goal_id format",
		"invalid transaction_id format",
		"invalid due_date format",
		"goal repository is not configured",
		"wallet repository is not configured",
	} {
		if strings.Contains(msg, marker) {
			return true
		}
	}
	return false
}
