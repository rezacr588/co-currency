package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var (
	ErrInvalidPlannerItemType = errors.New("invalid planner item type")
	ErrGoalFundingRequired    = errors.New("goal funding required")
)

type GoalFundingRequiredError struct {
	GoalID    uuid.UUID
	Remaining float64
	Currency  string
}

func (e *GoalFundingRequiredError) Error() string {
	return ErrGoalFundingRequired.Error()
}

type PlannerService struct {
	taskRepo    *repository.TaskRepository
	goalRepo    *repository.GoalRepository
	taskService *TaskService
}

func NewPlannerService(taskRepo *repository.TaskRepository, goalRepo *repository.GoalRepository, taskService *TaskService) *PlannerService {
	return &PlannerService{
		taskRepo:    taskRepo,
		goalRepo:    goalRepo,
		taskService: taskService,
	}
}

func (s *PlannerService) GetBoard(ctx context.Context, userID uuid.UUID) (*model.PlannerBoardResponse, error) {
	items := make([]model.TodoItem, 0)

	tasks, err := s.taskRepo.GetByUser(ctx, userID, model.TaskListFilter{})
	if err != nil {
		return nil, fmt.Errorf("getting tasks: %w", err)
	}
	for _, task := range tasks {
		items = append(items, mapTaskToTodo(task))
	}

	goals, err := s.goalRepo.GetByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting goals: %w", err)
	}
	for _, goal := range goals {
		items = append(items, mapGoalToTodo(goal))
	}

	columns := []model.PlannerColumn{
		{Status: model.TodoStatusTodo, Items: []model.TodoItem{}},
		{Status: model.TodoStatusInProgress, Items: []model.TodoItem{}},
		{Status: model.TodoStatusDone, Items: []model.TodoItem{}},
		{Status: model.TodoStatusArchived, Items: []model.TodoItem{}},
	}
	indexByStatus := map[model.TodoStatus]int{
		model.TodoStatusTodo:       0,
		model.TodoStatusInProgress: 1,
		model.TodoStatusDone:       2,
		model.TodoStatusArchived:   3,
	}
	for _, item := range items {
		idx, ok := indexByStatus[item.Status]
		if !ok {
			idx = 0
		}
		columns[idx].Items = append(columns[idx].Items, item)
	}
	for i := range columns {
		sort.Slice(columns[i].Items, func(a, b int) bool {
			left := columns[i].Items[a]
			right := columns[i].Items[b]
			if left.SortOrder != right.SortOrder {
				return left.SortOrder < right.SortOrder
			}
			return left.UpdatedAt.After(right.UpdatedAt)
		})
	}

	return &model.PlannerBoardResponse{
		Columns: columns,
		Summary: summarizePlannerTodo(items),
	}, nil
}

func (s *PlannerService) MoveItem(ctx context.Context, userID uuid.UUID, itemType string, itemID uuid.UUID, req *model.MovePlannerItemRequest) (*model.TodoItem, error) {
	if !req.Status.IsValid() {
		return nil, ErrInvalidTodoStatus
	}
	switch strings.ToLower(strings.TrimSpace(itemType)) {
	case string(model.TodoItemTypeTask):
		status := todoToTaskStatus(req.Status)
		updateReq := &model.UpdateTaskRequest{
			Status:    &status,
			SortOrder: &req.SortOrder,
		}
		task, err := s.taskService.UpdateTask(ctx, userID, itemID, updateReq)
		if err != nil {
			return nil, err
		}
		item := mapTaskToTodo(*task)
		return &item, nil
	case string(model.TodoItemTypeGoal):
		goal, err := s.goalRepo.GetByID(ctx, userID, itemID)
		if err != nil {
			if errors.Is(err, repository.ErrGoalNotFound) {
				return nil, repository.ErrGoalNotFound
			}
			return nil, fmt.Errorf("getting goal: %w", err)
		}
		if req.Status == model.TodoStatusDone {
			if goal.IsFinancial() && goal.CurrentAmount < goal.TargetAmount {
				return nil, &GoalFundingRequiredError{
					GoalID:    goal.ID,
					Remaining: goal.TargetAmount - goal.CurrentAmount,
					Currency:  goal.Currency,
				}
			}
			if !goal.IsFinancial() {
				goal.CurrentAmount = goal.TargetAmount
			}
		}
		goal.WorkflowStatus = model.GoalWorkflowStatus(req.Status)
		goal.SortOrder = req.SortOrder
		if err := s.goalRepo.Update(ctx, goal); err != nil {
			return nil, fmt.Errorf("updating goal: %w", err)
		}
		updated, err := s.goalRepo.GetByID(ctx, userID, goal.ID)
		if err != nil {
			return nil, fmt.Errorf("getting updated goal: %w", err)
		}
		item := mapGoalToTodo(*updated)
		return &item, nil
	default:
		return nil, ErrInvalidPlannerItemType
	}
}

func (s *PlannerService) MarkGoalDone(ctx context.Context, userID, goalID uuid.UUID) (*model.Goal, error) {
	goal, err := s.goalRepo.GetByID(ctx, userID, goalID)
	if err != nil {
		if errors.Is(err, repository.ErrGoalNotFound) {
			return nil, repository.ErrGoalNotFound
		}
		return nil, fmt.Errorf("getting goal: %w", err)
	}
	if goal.IsFinancial() && goal.CurrentAmount < goal.TargetAmount {
		return nil, &GoalFundingRequiredError{
			GoalID:    goal.ID,
			Remaining: goal.TargetAmount - goal.CurrentAmount,
			Currency:  goal.Currency,
		}
	}
	if !goal.IsFinancial() {
		goal.CurrentAmount = goal.TargetAmount
	}
	goal.WorkflowStatus = model.GoalWorkflowStatusDone
	if err := s.goalRepo.Update(ctx, goal); err != nil {
		return nil, fmt.Errorf("updating goal: %w", err)
	}
	updated, err := s.goalRepo.GetByID(ctx, userID, goalID)
	if err != nil {
		return nil, fmt.Errorf("getting updated goal: %w", err)
	}
	return updated, nil
}

func mapTaskToTodo(task model.Task) model.TodoItem {
	return model.TodoItem{
		ID:            task.ID,
		Type:          model.TodoItemTypeTask,
		GoalID:        task.GoalID,
		TransactionID: task.TransactionID,
		Title:         task.Title,
		Description:   task.Description,
		Status:        mapTaskStatusToTodo(task.Status),
		Priority:      string(task.Priority),
		SortOrder:     task.SortOrder,
		DueDate:       task.DueDate,
		CreatedAt:     task.CreatedAt,
		UpdatedAt:     task.UpdatedAt,
	}
}

func mapGoalToTodo(goal model.Goal) model.TodoItem {
	status := mapGoalStatusToTodo(goal)
	return model.TodoItem{
		ID:          goal.ID,
		Type:        model.TodoItemTypeGoal,
		Title:       goal.Name,
		Description: goal.Description,
		Status:      status,
		Priority:    derivePlannerGoalPriority(goal),
		SortOrder:   goal.SortOrder,
		DueDate:     goal.Deadline,
		Progress:    goal.Progress(),
		GoalType:    goal.Type,
		Category:    goal.Category,
		Unit:        goal.Unit,
		CreatedAt:   goal.CreatedAt,
		UpdatedAt:   goal.UpdatedAt,
	}
}

func mapTaskStatusToTodo(status model.TaskStatus) model.TodoStatus {
	switch status {
	case model.TaskStatusInProgress:
		return model.TodoStatusInProgress
	case model.TaskStatusDone:
		return model.TodoStatusDone
	case model.TaskStatusArchived:
		return model.TodoStatusArchived
	default:
		return model.TodoStatusTodo
	}
}

func mapGoalStatusToTodo(goal model.Goal) model.TodoStatus {
	if goal.WorkflowStatus.IsValid() {
		return model.TodoStatus(goal.WorkflowStatus)
	}
	if goal.IsCompleted() {
		return model.TodoStatusDone
	}
	if goal.CurrentAmount > 0 {
		return model.TodoStatusInProgress
	}
	return model.TodoStatusTodo
}

func todoToTaskStatus(status model.TodoStatus) model.TaskStatus {
	switch status {
	case model.TodoStatusInProgress:
		return model.TaskStatusInProgress
	case model.TodoStatusDone:
		return model.TaskStatusDone
	case model.TodoStatusArchived:
		return model.TaskStatusArchived
	default:
		return model.TaskStatusTodo
	}
}

func summarizePlannerTodo(items []model.TodoItem) model.TodoSummary {
	summary := model.TodoSummary{Total: len(items)}
	for _, item := range items {
		switch item.Status {
		case model.TodoStatusTodo:
			summary.Todo++
		case model.TodoStatusInProgress:
			summary.InProgress++
		case model.TodoStatusDone:
			summary.Done++
		case model.TodoStatusArchived:
			summary.Archived++
		}
	}
	return summary
}

func derivePlannerGoalPriority(goal model.Goal) string {
	if goal.IsCompleted() {
		return string(model.TaskPriorityLow)
	}
	if goal.Deadline == nil {
		return string(model.TaskPriorityMedium)
	}
	now := time.Now()
	if goal.Deadline.Before(now) || goal.Deadline.Sub(now) <= 7*24*time.Hour {
		return string(model.TaskPriorityHigh)
	}
	return string(model.TaskPriorityMedium)
}
