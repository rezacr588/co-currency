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
	ErrTaskTitleRequired       = errors.New("title is required")
	ErrInvalidTaskStatus       = errors.New("invalid task status")
	ErrInvalidTaskPriority     = errors.New("invalid task priority")
	ErrInvalidTaskReminderMode = errors.New("invalid task reminder mode")
	ErrInvalidTaskLedgerType   = errors.New("invalid ledger type")
)

type TaskService struct {
	taskRepo   *repository.TaskRepository
	goalRepo   *repository.GoalRepository
	walletRepo *repository.WalletRepository
	tagRepo    *repository.TagRepository
}

func NewTaskService(taskRepo *repository.TaskRepository, goalRepo *repository.GoalRepository, walletRepo *repository.WalletRepository, tagRepo ...*repository.TagRepository) *TaskService {
	s := &TaskService{
		taskRepo:   taskRepo,
		goalRepo:   goalRepo,
		walletRepo: walletRepo,
	}
	if len(tagRepo) > 0 {
		s.tagRepo = tagRepo[0]
	}
	return s
}

func (s *TaskService) SetTagRepository(tagRepo *repository.TagRepository) {
	s.tagRepo = tagRepo
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
	reminderMode := req.ReminderMode
	if reminderMode == "" {
		// Aggressive reminders are the default when a task has a due date.
		if dueDate != nil {
			reminderMode = model.TaskReminderModeAggressive
		} else {
			reminderMode = model.TaskReminderModeOff
		}
	}
	if !reminderMode.IsValid() {
		return nil, ErrInvalidTaskReminderMode
	}
	if err := validateTaskSubtasks(req.Subtasks); err != nil {
		return nil, err
	}
	sortOrder := float64(time.Now().UnixNano()) / 1_000_000
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	if err := validateLedgerFields(req.AutoLedgerEnabled, req.LedgerType, req.LedgerAmount, req.LedgerCurrency); err != nil {
		return nil, err
	}

	task := &model.Task{
		UserID:               userID,
		GoalID:               goalID,
		TransactionID:        transactionID,
		Title:                title,
		Description:          strings.TrimSpace(req.Description),
		Status:               status,
		Priority:             priority,
		SortOrder:            sortOrder,
		Subtasks:             req.Subtasks,
		DueDate:              dueDate,
		ReminderMode:         reminderMode,
		ReminderNextAt:       nextReminderAt(dueDate, reminderMode),
		AutoLedgerEnabled:    req.AutoLedgerEnabled,
		LedgerType:           strings.TrimSpace(req.LedgerType),
		LedgerAmount:         req.LedgerAmount,
		LedgerCurrency:       strings.ToUpper(strings.TrimSpace(req.LedgerCurrency)),
		LedgerWalletCurrency: strings.ToUpper(strings.TrimSpace(req.LedgerWalletCurrency)),
		LedgerCategory:       strings.TrimSpace(req.LedgerCategory),
		LedgerDescription:    strings.TrimSpace(req.LedgerDescription),
	}

	if task.Status == model.TaskStatusDone {
		if err := s.applyAutoLedgerTransaction(ctx, task); err != nil {
			return nil, err
		}
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
	prevStatus := task.Status

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
	if req.SortOrder != nil {
		task.SortOrder = *req.SortOrder
	}
	if req.Subtasks != nil {
		if err := validateTaskSubtasks(*req.Subtasks); err != nil {
			return nil, err
		}
		task.Subtasks = *req.Subtasks
	}
	if req.DueDate != nil {
		dueDate, err := parseTaskDate(*req.DueDate)
		if err != nil {
			return nil, err
		}
		task.DueDate = dueDate
	}
	if req.ReminderMode != nil {
		if !req.ReminderMode.IsValid() {
			return nil, ErrInvalidTaskReminderMode
		}
		task.ReminderMode = *req.ReminderMode
	}
	if req.AutoLedgerEnabled != nil {
		task.AutoLedgerEnabled = *req.AutoLedgerEnabled
	}
	if req.LedgerType != nil {
		task.LedgerType = strings.TrimSpace(*req.LedgerType)
	}
	if req.LedgerAmount != nil {
		task.LedgerAmount = req.LedgerAmount
	}
	if req.LedgerCurrency != nil {
		task.LedgerCurrency = strings.ToUpper(strings.TrimSpace(*req.LedgerCurrency))
	}
	if req.LedgerWalletCurrency != nil {
		task.LedgerWalletCurrency = strings.ToUpper(strings.TrimSpace(*req.LedgerWalletCurrency))
	}
	if req.LedgerCategory != nil {
		task.LedgerCategory = strings.TrimSpace(*req.LedgerCategory)
	}
	if req.LedgerDescription != nil {
		task.LedgerDescription = strings.TrimSpace(*req.LedgerDescription)
	}
	if err := validateLedgerFields(task.AutoLedgerEnabled, task.LedgerType, task.LedgerAmount, task.LedgerCurrency); err != nil {
		return nil, err
	}

	if task.Status == model.TaskStatusDone {
		if prevStatus != model.TaskStatusDone {
			if err := s.applyAutoLedgerTransaction(ctx, task); err != nil {
				return nil, err
			}
		}
		if task.CompletedAt == nil {
			now := time.Now()
			task.CompletedAt = &now
		}
		task.ReminderNextAt = nil
	} else {
		task.CompletedAt = nil
		task.ReminderNextAt = nextReminderAt(task.DueDate, task.ReminderMode)
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

func (s *TaskService) GetTaskTags(ctx context.Context, userID, taskID uuid.UUID) ([]model.Tag, error) {
	if s.tagRepo == nil {
		return nil, errors.New("tag repository is not configured")
	}
	if _, err := s.taskRepo.GetByID(ctx, userID, taskID); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return nil, repository.ErrTaskNotFound
		}
		return nil, fmt.Errorf("getting task: %w", err)
	}
	tags, err := s.tagRepo.GetTagsForTask(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("getting task tags: %w", err)
	}
	if tags == nil {
		tags = []model.Tag{}
	}
	return tags, nil
}

func (s *TaskService) AddTaskTag(ctx context.Context, userID, taskID, tagID uuid.UUID) error {
	if s.tagRepo == nil {
		return errors.New("tag repository is not configured")
	}
	if _, err := s.taskRepo.GetByID(ctx, userID, taskID); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return repository.ErrTaskNotFound
		}
		return fmt.Errorf("getting task: %w", err)
	}
	if _, err := s.tagRepo.GetByID(ctx, userID, tagID); err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			return repository.ErrTagNotFound
		}
		return fmt.Errorf("getting tag: %w", err)
	}
	if err := s.tagRepo.AddTagToTask(ctx, taskID, tagID); err != nil {
		return fmt.Errorf("adding tag to task: %w", err)
	}
	return nil
}

func (s *TaskService) RemoveTaskTag(ctx context.Context, userID, taskID, tagID uuid.UUID) error {
	if s.tagRepo == nil {
		return errors.New("tag repository is not configured")
	}
	if _, err := s.taskRepo.GetByID(ctx, userID, taskID); err != nil {
		if errors.Is(err, repository.ErrTaskNotFound) {
			return repository.ErrTaskNotFound
		}
		return fmt.Errorf("getting task: %w", err)
	}
	if _, err := s.tagRepo.GetByID(ctx, userID, tagID); err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			return repository.ErrTagNotFound
		}
		return fmt.Errorf("getting tag: %w", err)
	}
	if err := s.tagRepo.RemoveTagFromTask(ctx, taskID, tagID); err != nil {
		return fmt.Errorf("removing tag from task: %w", err)
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

func validateTaskSubtasks(subtasks []model.TaskSubtask) error {
	if len(subtasks) == 0 {
		return nil
	}
	if len(subtasks) > 50 {
		return errors.New("subtasks cannot exceed 50 items")
	}
	for i, st := range subtasks {
		if strings.TrimSpace(st.Title) == "" {
			return fmt.Errorf("subtask #%d title is required", i+1)
		}
	}
	return nil
}

func validateLedgerFields(enabled bool, ledgerType string, ledgerAmount *float64, ledgerCurrency string) error {
	if !enabled {
		return nil
	}
	ledgerType = strings.TrimSpace(ledgerType)
	if ledgerType != "credit" && ledgerType != "debit" {
		return ErrInvalidTaskLedgerType
	}
	if ledgerAmount == nil || *ledgerAmount <= 0 {
		return errors.New("ledger_amount must be positive when auto_ledger_enabled is true")
	}
	if strings.TrimSpace(ledgerCurrency) == "" {
		return errors.New("ledger_currency is required when auto_ledger_enabled is true")
	}
	return nil
}

func nextReminderAt(dueDate *time.Time, mode model.TaskReminderMode) *time.Time {
	if dueDate == nil || mode != model.TaskReminderModeAggressive {
		return nil
	}
	t := dueDate.Add(-24 * time.Hour)
	return &t
}

func (s *TaskService) applyAutoLedgerTransaction(ctx context.Context, task *model.Task) error {
	if !task.AutoLedgerEnabled || task.TransactionID != nil {
		return nil
	}
	if s.walletRepo == nil {
		return errors.New("wallet repository is not configured")
	}
	amount := 0.0
	if task.LedgerAmount != nil {
		amount = *task.LedgerAmount
	}
	if amount <= 0 {
		return errors.New("ledger_amount must be positive for auto-ledger tasks")
	}
	txType := strings.TrimSpace(task.LedgerType)
	currency := strings.ToUpper(strings.TrimSpace(task.LedgerCurrency))
	tx, err := s.walletRepo.AddTransactionAtomic(
		ctx,
		task.UserID,
		txType,
		amount,
		currency,
		"task_auto_ledger",
		defaultTaskLedgerDescription(task),
		task.LedgerCategory,
		"",
		nil,
	)
	if err != nil {
		if errors.Is(err, repository.ErrInsufficientBalance) {
			return repository.ErrInsufficientBalance
		}
		return fmt.Errorf("creating auto-ledger transaction: %w", err)
	}
	if tx != nil {
		task.TransactionID = &tx.ID
	}
	return nil
}

func defaultTaskLedgerDescription(task *model.Task) string {
	if task.LedgerDescription != "" {
		return task.LedgerDescription
	}
	return fmt.Sprintf("Task completion: %s", task.Title)
}
