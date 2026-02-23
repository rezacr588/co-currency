package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

var (
	ErrInvalidTodoStatus = errors.New("invalid todo status")
)

// TodoService combines goals and tasks into a unified todo-style view.
type TodoService struct {
	taskRepo *repository.TaskRepository
	goalRepo *repository.GoalRepository
}

func NewTodoService(taskRepo *repository.TaskRepository, goalRepo *repository.GoalRepository) *TodoService {
	return &TodoService{
		taskRepo: taskRepo,
		goalRepo: goalRepo,
	}
}

func (s *TodoService) GetTodoList(ctx context.Context, userID uuid.UUID, status model.TodoStatus, includeArchived bool) (*model.TodoListResponse, error) {
	if status != "" && !status.IsValid() {
		return nil, ErrInvalidTodoStatus
	}

	items := make([]model.TodoItem, 0)

	if s.taskRepo != nil {
		tasks, err := s.taskRepo.GetByUser(ctx, userID, model.TaskListFilter{})
		if err != nil {
			return nil, fmt.Errorf("getting tasks: %w", err)
		}

		for _, task := range tasks {
			todoStatus := mapTaskStatus(task.Status)
			if todoStatus == model.TodoStatusArchived && !includeArchived {
				continue
			}
			if status != "" && status != todoStatus {
				continue
			}

			items = append(items, model.TodoItem{
				ID:          task.ID,
				Type:        model.TodoItemTypeTask,
				GoalID:      task.GoalID,
				Title:       task.Title,
				Description: task.Description,
				Status:      todoStatus,
				Priority:    string(task.Priority),
				DueDate:     task.DueDate,
				CreatedAt:   task.CreatedAt,
				UpdatedAt:   task.UpdatedAt,
			})
		}
	}

	if s.goalRepo != nil {
		goals, err := s.goalRepo.GetByUser(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("getting goals: %w", err)
		}

		for _, goal := range goals {
			todoStatus := mapGoalStatus(goal)
			if status != "" && status != todoStatus {
				continue
			}

			items = append(items, model.TodoItem{
				ID:          goal.ID,
				Type:        model.TodoItemTypeGoal,
				Title:       goal.Name,
				Description: goal.Description,
				Status:      todoStatus,
				Priority:    deriveGoalPriority(goal),
				DueDate:     goal.Deadline,
				Progress:    goal.Progress(),
				GoalType:    goal.Type,
				Category:    goal.Category,
				Unit:        goal.Unit,
				CreatedAt:   goal.CreatedAt,
				UpdatedAt:   goal.UpdatedAt,
			})
		}
	}

	sort.Slice(items, func(i, j int) bool {
		left := items[i]
		right := items[j]

		leftRank := todoStatusRank(left.Status)
		rightRank := todoStatusRank(right.Status)
		if leftRank != rightRank {
			return leftRank < rightRank
		}

		switch {
		case left.DueDate == nil && right.DueDate != nil:
			return false
		case left.DueDate != nil && right.DueDate == nil:
			return true
		case left.DueDate != nil && right.DueDate != nil && !left.DueDate.Equal(*right.DueDate):
			return left.DueDate.Before(*right.DueDate)
		}

		return left.UpdatedAt.After(right.UpdatedAt)
	})

	resp := &model.TodoListResponse{
		Summary: summarizeTodo(items),
		Items:   items,
	}

	if resp.Items == nil {
		resp.Items = []model.TodoItem{}
	}

	return resp, nil
}

func mapTaskStatus(status model.TaskStatus) model.TodoStatus {
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

func mapGoalStatus(goal model.Goal) model.TodoStatus {
	if goal.IsCompleted() {
		return model.TodoStatusDone
	}
	if goal.CurrentAmount > 0 {
		return model.TodoStatusInProgress
	}
	return model.TodoStatusTodo
}

func deriveGoalPriority(goal model.Goal) string {
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

func summarizeTodo(items []model.TodoItem) model.TodoSummary {
	summary := model.TodoSummary{
		Total: len(items),
	}

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

func todoStatusRank(status model.TodoStatus) int {
	switch status {
	case model.TodoStatusTodo:
		return 1
	case model.TodoStatusInProgress:
		return 2
	case model.TodoStatusDone:
		return 3
	case model.TodoStatusArchived:
		return 4
	default:
		return 5
	}
}
