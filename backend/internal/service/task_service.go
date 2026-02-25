package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var (
	ErrTaskTitleRequired   = errors.New("title is required")
	ErrInvalidTaskStatus   = errors.New("invalid task status")
	ErrInvalidTaskPriority = errors.New("invalid task priority")
)

type TaskService struct {
	taskRepo   *repository.TaskRepository
	goalRepo   *repository.GoalRepository
	walletRepo *repository.WalletRepository
}

func NewTaskService(taskRepo *repository.TaskRepository, goalRepo *repository.GoalRepository, walletRepo *repository.WalletRepository) *TaskService {
	return &TaskService{
		taskRepo:   taskRepo,
		goalRepo:   goalRepo,
		walletRepo: walletRepo,
	}
}

func (s *TaskService) GetTasks(ctx context.Context, userID uuid.UUID, filter model.TaskListFilter) ([]model.Task, error) {
	if filter.Status != "" && !filter.Status.IsValid() {
		return nil, ErrInvalidTaskStatus
	}
	if filter.Priority != "" && !filter.Priority.IsValid() {
		return nil, ErrInvalidTaskPriority
	}

	tasks, err := s.taskRepo.GetByUser(ctx, userID, filter)
	if err != nil {
		return nil, fmt.Errorf("getting tasks: %w", err)
	}
	if tasks == nil {
		tasks = []model.Task{}
	}
	return tasks, nil
}

func (s *TaskService) GetTask(ctx context.Context, userID, taskID uuid.UUID) (*model.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, userID, taskID)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return nil, repository.ErrTaskNotFound
		}
		return nil, fmt.Errorf("getting task: %w", err)
	}
	return task, nil
}

func (s *TaskService) CreateTask(ctx context.Context, userID uuid.UUID, req *model.CreateTaskRequest) (*model.Task, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, ErrTaskTitleRequired
	}

	status := req.Status
	if status == "" {
		status = model.TaskStatusTodo
	}
	if !status.IsValid() {
		return nil, ErrInvalidTaskStatus
	}

	priority := req.Priority
	if priority == "" {
		priority = model.TaskPriorityMedium
	}
	if !priority.IsValid() {
		return nil, ErrInvalidTaskPriority
	}

	goalID, err := s.parseAndValidateGoalID(ctx, userID, req.GoalID)
	if err != nil {
		return nil, err
	}
	transactionID, err := s.parseAndValidateTransactionID(ctx, userID, req.TransactionID)
	if err != nil {
		return nil, err
	}

	dueDate, err := parseTaskDate(req.DueDate)
	if err != nil {
		return nil, err
	}

	task := &model.Task{
		UserID:        userID,
		GoalID:        goalID,
		TransactionID: transactionID,
		Title:         title,
		Description:   strings.TrimSpace(req.Description),
		Status:        status,
		Priority:      priority,
		DueDate:       dueDate,
	}

	if task.Status == model.TaskStatusDone {
		now := time.Now()
		task.CompletedAt = &now
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("creating task: %w", err)
	}

	return task, nil
}

func (s *TaskService) UpdateTask(ctx context.Context, userID, taskID uuid.UUID, req *model.UpdateTaskRequest) (*model.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, userID, taskID)
	if err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return nil, repository.ErrTaskNotFound
		}
		return nil, fmt.Errorf("getting task: %w", err)
	}

	if req.GoalID != nil {
		goalID, err := s.parseAndValidateGoalID(ctx, userID, *req.GoalID)
		if err != nil {
			return nil, err
		}
		task.GoalID = goalID
	}
	if req.TransactionID != nil {
		transactionID, err := s.parseAndValidateTransactionID(ctx, userID, *req.TransactionID)
		if err != nil {
			return nil, err
		}
		task.TransactionID = transactionID
	}
	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, ErrTaskTitleRequired
		}
		task.Title = title
	}
	if req.Description != nil {
		task.Description = strings.TrimSpace(*req.Description)
	}
	if req.Status != nil {
		if !req.Status.IsValid() {
			return nil, ErrInvalidTaskStatus
		}
		task.Status = *req.Status
	}
	if req.Priority != nil {
		if !req.Priority.IsValid() {
			return nil, ErrInvalidTaskPriority
		}
		task.Priority = *req.Priority
	}
	if req.DueDate != nil {
		dueDate, err := parseTaskDate(*req.DueDate)
		if err != nil {
			return nil, err
		}
		task.DueDate = dueDate
	}

	if task.Status == model.TaskStatusDone {
		if task.CompletedAt == nil {
			now := time.Now()
			task.CompletedAt = &now
		}
	} else {
		task.CompletedAt = nil
	}

	if err := s.taskRepo.Update(ctx, task); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return nil, repository.ErrTaskNotFound
		}
		return nil, fmt.Errorf("updating task: %w", err)
	}

	return task, nil
}

func (s *TaskService) CompleteTask(ctx context.Context, userID, taskID uuid.UUID) (*model.Task, error) {
	status := model.TaskStatusDone
	req := &model.UpdateTaskRequest{
		Status: &status,
	}
	return s.UpdateTask(ctx, userID, taskID, req)
}

func (s *TaskService) DeleteTask(ctx context.Context, userID, taskID uuid.UUID) error {
	if err := s.taskRepo.Delete(ctx, userID, taskID); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return repository.ErrTaskNotFound
		}
		return fmt.Errorf("deleting task: %w", err)
	}
	return nil
}

func (s *TaskService) parseAndValidateGoalID(ctx context.Context, userID uuid.UUID, raw string) (*uuid.UUID, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	goalID, err := uuid.Parse(raw)
	if err != nil {
		return nil, errors.New("invalid goal_id format")
	}

	if s.goalRepo == nil {
		return nil, errors.New("goal repository is not configured")
	}

	if _, err := s.goalRepo.GetByID(ctx, userID, goalID); err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return nil, repository.ErrGoalNotFound
		}
		return nil, fmt.Errorf("validating goal: %w", err)
	}

	return &goalID, nil
}

func (s *TaskService) parseAndValidateTransactionID(ctx context.Context, userID uuid.UUID, raw string) (*uuid.UUID, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	transactionID, err := uuid.Parse(raw)
	if err != nil {
		return nil, errors.New("invalid transaction_id format")
	}

	if s.walletRepo == nil {
		return nil, errors.New("wallet repository is not configured")
	}

	if _, err := s.walletRepo.GetTransaction(ctx, userID, transactionID); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, repository.ErrTransactionNotFound
		}
		return nil, fmt.Errorf("validating transaction: %w", err)
	}

	return &transactionID, nil
}

func parseTaskDate(raw string) (*time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	dueDate, err := time.Parse("2006-01-02", raw)
	if err != nil {
		return nil, errors.New("invalid due_date format, use YYYY-MM-DD")
	}
	return &dueDate, nil
}
