package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// Common errors for agent repository
var (
	ErrPlanNotFound     = errors.New("agent plan not found")
	ErrStepNotFound     = errors.New("plan step not found")
	ErrApprovalNotFound = errors.New("action approval not found")
	ErrConfigNotFound   = errors.New("agent config not found")
)

// AgentPlanRepository handles agent plan database operations
type AgentPlanRepository struct {
	db *pgxpool.Pool
}

// NewAgentPlanRepository creates a new agent plan repository
func NewAgentPlanRepository(db *pgxpool.Pool) *AgentPlanRepository {
	return &AgentPlanRepository{db: db}
}

// CreatePlan creates a new agent plan
func (r *AgentPlanRepository) CreatePlan(ctx context.Context, plan *model.AgentPlan) error {
	query := `
		INSERT INTO agent_plans (
			id, user_id, title, description, goal_type, status, priority,
			target_amount, target_currency, target_date, ai_reasoning, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at`

	if plan.ID == uuid.Nil {
		plan.ID = uuid.New()
	}

	return r.db.QueryRow(ctx, query,
		plan.ID,
		plan.UserID,
		plan.Title,
		plan.Description,
		plan.GoalType,
		plan.Status,
		plan.Priority,
		plan.TargetAmount,
		plan.TargetCurrency,
		plan.TargetDate,
		plan.AIReasoning,
		plan.Metadata,
	).Scan(&plan.CreatedAt, &plan.UpdatedAt)
}

// GetPlanByID retrieves a plan by ID
func (r *AgentPlanRepository) GetPlanByID(ctx context.Context, planID uuid.UUID) (*model.AgentPlan, error) {
	query := `
		SELECT id, user_id, title, description, goal_type, status, priority,
			target_amount, target_currency, target_date, ai_reasoning, metadata,
			created_at, updated_at, completed_at
		FROM agent_plans
		WHERE id = $1`

	plan := &model.AgentPlan{}
	err := r.db.QueryRow(ctx, query, planID).Scan(
		&plan.ID,
		&plan.UserID,
		&plan.Title,
		&plan.Description,
		&plan.GoalType,
		&plan.Status,
		&plan.Priority,
		&plan.TargetAmount,
		&plan.TargetCurrency,
		&plan.TargetDate,
		&plan.AIReasoning,
		&plan.Metadata,
		&plan.CreatedAt,
		&plan.UpdatedAt,
		&plan.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	return plan, nil
}

// GetPlansByUser retrieves all plans for a user with optional status filter
func (r *AgentPlanRepository) GetPlansByUser(ctx context.Context, userID uuid.UUID, status string, limit, offset int) ([]*model.AgentPlan, int, error) {
	// Count query
	countQuery := `SELECT COUNT(*) FROM agent_plans WHERE user_id = $1`
	args := []interface{}{userID}

	if status != "" {
		countQuery += ` AND status = $2`
		args = append(args, status)
	}

	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Data query
	dataQuery := `
		SELECT id, user_id, title, description, goal_type, status, priority,
			target_amount, target_currency, target_date, ai_reasoning, metadata,
			created_at, updated_at, completed_at
		FROM agent_plans
		WHERE user_id = $1`

	if status != "" {
		dataQuery += ` AND status = $2`
	}
	dataQuery += ` ORDER BY created_at DESC LIMIT $` + string(rune('0'+len(args)+1)) + ` OFFSET $` + string(rune('0'+len(args)+2))

	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var plans []*model.AgentPlan
	for rows.Next() {
		plan := &model.AgentPlan{}
		if err := rows.Scan(
			&plan.ID,
			&plan.UserID,
			&plan.Title,
			&plan.Description,
			&plan.GoalType,
			&plan.Status,
			&plan.Priority,
			&plan.TargetAmount,
			&plan.TargetCurrency,
			&plan.TargetDate,
			&plan.AIReasoning,
			&plan.Metadata,
			&plan.CreatedAt,
			&plan.UpdatedAt,
			&plan.CompletedAt,
		); err != nil {
			return nil, 0, err
		}
		plans = append(plans, plan)
	}

	return plans, total, rows.Err()
}

// UpdatePlanStatus updates a plan's status
func (r *AgentPlanRepository) UpdatePlanStatus(ctx context.Context, planID uuid.UUID, status string) error {
	query := `UPDATE agent_plans SET status = $1, updated_at = NOW()`
	if status == "completed" {
		query += `, completed_at = NOW()`
	}
	query += ` WHERE id = $2`

	result, err := r.db.Exec(ctx, query, status, planID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrPlanNotFound
	}
	return nil
}

// DeletePlan deletes a plan (soft delete by setting status to cancelled)
func (r *AgentPlanRepository) DeletePlan(ctx context.Context, planID uuid.UUID) error {
	return r.UpdatePlanStatus(ctx, planID, "cancelled")
}

// GetActivePlansCount returns count of active plans for a user
func (r *AgentPlanRepository) GetActivePlansCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM agent_plans WHERE user_id = $1 AND status = 'active'`,
		userID,
	).Scan(&count)
	return count, err
}

// =========================================
// Plan Steps
// =========================================

// CreateStep creates a new step for a plan
func (r *AgentPlanRepository) CreateStep(ctx context.Context, step *model.PlanStep) error {
	query := `
		INSERT INTO plan_steps (
			id, plan_id, step_order, title, description, action_type, action_params,
			status, requires_approval, estimated_impact, scheduled_at, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at`

	if step.ID == uuid.Nil {
		step.ID = uuid.New()
	}

	return r.db.QueryRow(ctx, query,
		step.ID,
		step.PlanID,
		step.StepOrder,
		step.Title,
		step.Description,
		step.ActionType,
		step.ActionParams,
		step.Status,
		step.RequiresApproval,
		step.EstimatedImpact,
		step.ScheduledAt,
		step.Metadata,
	).Scan(&step.CreatedAt, &step.UpdatedAt)
}

// GetStepsByPlan retrieves all steps for a plan
func (r *AgentPlanRepository) GetStepsByPlan(ctx context.Context, planID uuid.UUID) ([]*model.PlanStep, error) {
	query := `
		SELECT id, plan_id, step_order, title, description, action_type, action_params,
			status, requires_approval, estimated_impact, actual_impact,
			scheduled_at, executed_at, error_message, metadata, created_at, updated_at
		FROM plan_steps
		WHERE plan_id = $1
		ORDER BY step_order ASC`

	rows, err := r.db.Query(ctx, query, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []*model.PlanStep
	for rows.Next() {
		step := &model.PlanStep{}
		if err := rows.Scan(
			&step.ID,
			&step.PlanID,
			&step.StepOrder,
			&step.Title,
			&step.Description,
			&step.ActionType,
			&step.ActionParams,
			&step.Status,
			&step.RequiresApproval,
			&step.EstimatedImpact,
			&step.ActualImpact,
			&step.ScheduledAt,
			&step.ExecutedAt,
			&step.ErrorMessage,
			&step.Metadata,
			&step.CreatedAt,
			&step.UpdatedAt,
		); err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}

	return steps, rows.Err()
}

// GetStepByID retrieves a step by ID
func (r *AgentPlanRepository) GetStepByID(ctx context.Context, stepID uuid.UUID) (*model.PlanStep, error) {
	query := `
		SELECT id, plan_id, step_order, title, description, action_type, action_params,
			status, requires_approval, estimated_impact, actual_impact,
			scheduled_at, executed_at, error_message, metadata, created_at, updated_at
		FROM plan_steps
		WHERE id = $1`

	step := &model.PlanStep{}
	err := r.db.QueryRow(ctx, query, stepID).Scan(
		&step.ID,
		&step.PlanID,
		&step.StepOrder,
		&step.Title,
		&step.Description,
		&step.ActionType,
		&step.ActionParams,
		&step.Status,
		&step.RequiresApproval,
		&step.EstimatedImpact,
		&step.ActualImpact,
		&step.ScheduledAt,
		&step.ExecutedAt,
		&step.ErrorMessage,
		&step.Metadata,
		&step.CreatedAt,
		&step.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrStepNotFound
		}
		return nil, err
	}
	return step, nil
}

// UpdateStepStatus updates a step's status
func (r *AgentPlanRepository) UpdateStepStatus(ctx context.Context, stepID uuid.UUID, status string, errMsg *string) error {
	query := `UPDATE plan_steps SET status = $1`
	args := []interface{}{status}

	if status == "completed" || status == "failed" {
		query += `, executed_at = NOW()`
	}
	if errMsg != nil {
		query += `, error_message = $2`
		args = append(args, *errMsg)
	}
	query += `, updated_at = NOW() WHERE id = $` + string(rune('0'+len(args)+1))
	args = append(args, stepID)

	result, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrStepNotFound
	}
	return nil
}

// UpdateStepActualImpact updates the actual impact after execution
func (r *AgentPlanRepository) UpdateStepActualImpact(ctx context.Context, stepID uuid.UUID, actualImpact float64) error {
	query := `UPDATE plan_steps SET actual_impact = $1, updated_at = NOW() WHERE id = $2`
	result, err := r.db.Exec(ctx, query, actualImpact, stepID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrStepNotFound
	}
	return nil
}

// GetPendingSteps gets all pending steps that are due for execution
func (r *AgentPlanRepository) GetPendingSteps(ctx context.Context, userID uuid.UUID) ([]*model.PlanStep, error) {
	query := `
		SELECT ps.id, ps.plan_id, ps.step_order, ps.title, ps.description, 
			ps.action_type, ps.action_params, ps.status, ps.requires_approval,
			ps.estimated_impact, ps.actual_impact, ps.scheduled_at, ps.executed_at,
			ps.error_message, ps.metadata, ps.created_at, ps.updated_at
		FROM plan_steps ps
		JOIN agent_plans ap ON ps.plan_id = ap.id
		WHERE ap.user_id = $1 
			AND ap.status = 'active'
			AND ps.status IN ('pending', 'approved')
			AND (ps.scheduled_at IS NULL OR ps.scheduled_at <= NOW())
		ORDER BY ps.scheduled_at ASC NULLS FIRST, ps.step_order ASC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []*model.PlanStep
	for rows.Next() {
		step := &model.PlanStep{}
		if err := rows.Scan(
			&step.ID,
			&step.PlanID,
			&step.StepOrder,
			&step.Title,
			&step.Description,
			&step.ActionType,
			&step.ActionParams,
			&step.Status,
			&step.RequiresApproval,
			&step.EstimatedImpact,
			&step.ActualImpact,
			&step.ScheduledAt,
			&step.ExecutedAt,
			&step.ErrorMessage,
			&step.Metadata,
			&step.CreatedAt,
			&step.UpdatedAt,
		); err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}

	return steps, rows.Err()
}

// =========================================
// Action Approvals
// =========================================

// CreateApproval creates a new approval request
func (r *AgentPlanRepository) CreateApproval(ctx context.Context, approval *model.ActionApproval) error {
	query := `
		INSERT INTO action_approvals (id, step_id, user_id, approval_status, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at`

	if approval.ID == uuid.Nil {
		approval.ID = uuid.New()
	}

	return r.db.QueryRow(ctx, query,
		approval.ID,
		approval.StepID,
		approval.UserID,
		approval.ApprovalStatus,
		approval.ExpiresAt,
	).Scan(&approval.CreatedAt)
}

// GetPendingApprovals gets all pending approvals for a user
func (r *AgentPlanRepository) GetPendingApprovals(ctx context.Context, userID uuid.UUID) ([]*model.ActionApproval, error) {
	query := `
		SELECT aa.id, aa.step_id, aa.user_id, aa.approval_status, aa.approval_method,
			aa.approved_at, aa.expires_at, aa.rejection_reason, aa.device_info, aa.created_at,
			ps.title as step_title, ps.action_type, ps.estimated_impact,
			ap.title as plan_title
		FROM action_approvals aa
		JOIN plan_steps ps ON aa.step_id = ps.id
		JOIN agent_plans ap ON ps.plan_id = ap.id
		WHERE aa.user_id = $1 
			AND aa.approval_status = 'pending'
			AND aa.expires_at > NOW()
		ORDER BY aa.created_at ASC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var approvals []*model.ActionApproval
	for rows.Next() {
		approval := &model.ActionApproval{}
		var stepTitle, actionType, planTitle string
		var estimatedImpact *float64
		if err := rows.Scan(
			&approval.ID,
			&approval.StepID,
			&approval.UserID,
			&approval.ApprovalStatus,
			&approval.ApprovalMethod,
			&approval.ApprovedAt,
			&approval.ExpiresAt,
			&approval.RejectionReason,
			&approval.DeviceInfo,
			&approval.CreatedAt,
			&stepTitle,
			&actionType,
			&estimatedImpact,
			&planTitle,
		); err != nil {
			return nil, err
		}
		// Store context info in approval for display
		approval.Metadata = map[string]interface{}{
			"step_title":       stepTitle,
			"action_type":      actionType,
			"estimated_impact": estimatedImpact,
			"plan_title":       planTitle,
		}
		approvals = append(approvals, approval)
	}

	return approvals, rows.Err()
}

// ApproveAction approves an action
func (r *AgentPlanRepository) ApproveAction(ctx context.Context, approvalID uuid.UUID, method string, deviceInfo map[string]interface{}) error {
	query := `
		UPDATE action_approvals 
		SET approval_status = 'approved', approval_method = $1, approved_at = NOW(), device_info = $2
		WHERE id = $3 AND approval_status = 'pending'`

	result, err := r.db.Exec(ctx, query, method, deviceInfo, approvalID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrApprovalNotFound
	}

	// Also update the step status
	_, err = r.db.Exec(ctx, `
		UPDATE plan_steps SET status = 'approved', updated_at = NOW()
		WHERE id = (SELECT step_id FROM action_approvals WHERE id = $1)`,
		approvalID)
	return err
}

// RejectAction rejects an action
func (r *AgentPlanRepository) RejectAction(ctx context.Context, approvalID uuid.UUID, reason string) error {
	query := `
		UPDATE action_approvals 
		SET approval_status = 'rejected', rejection_reason = $1, approved_at = NOW()
		WHERE id = $2 AND approval_status = 'pending'`

	result, err := r.db.Exec(ctx, query, reason, approvalID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrApprovalNotFound
	}

	// Also update the step status to skipped
	_, err = r.db.Exec(ctx, `
		UPDATE plan_steps SET status = 'skipped', updated_at = NOW()
		WHERE id = (SELECT step_id FROM action_approvals WHERE id = $1)`,
		approvalID)
	return err
}

// ExpireOldApprovals marks old pending approvals as expired
func (r *AgentPlanRepository) ExpireOldApprovals(ctx context.Context) (int, error) {
	query := `
		UPDATE action_approvals 
		SET approval_status = 'expired'
		WHERE approval_status = 'pending' AND expires_at < NOW()`

	result, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// =========================================
// Agent Configuration
// =========================================

// GetConfig gets user's agent configuration
func (r *AgentPlanRepository) GetConfig(ctx context.Context, userID uuid.UUID) (*model.AgentConfig, error) {
	query := `
		SELECT user_id, enabled, auto_approve_threshold, auto_approve_currency,
			require_biometric_above, daily_autopilot_enabled, autopilot_time,
			autopilot_timezone, allowed_action_types, notification_preferences,
			created_at, updated_at
		FROM agent_config
		WHERE user_id = $1`

	config := &model.AgentConfig{}
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&config.UserID,
		&config.Enabled,
		&config.AutoApproveThreshold,
		&config.AutoApproveCurrency,
		&config.RequireBiometricAbove,
		&config.DailyAutopilotEnabled,
		&config.AutopilotTime,
		&config.AutopilotTimezone,
		&config.AllowedActionTypes,
		&config.NotificationPreferences,
		&config.CreatedAt,
		&config.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrConfigNotFound
		}
		return nil, err
	}
	return config, nil
}

// UpsertConfig creates or updates user's agent configuration
func (r *AgentPlanRepository) UpsertConfig(ctx context.Context, config *model.AgentConfig) error {
	query := `
		INSERT INTO agent_config (
			user_id, enabled, auto_approve_threshold, auto_approve_currency,
			require_biometric_above, daily_autopilot_enabled, autopilot_time,
			autopilot_timezone, allowed_action_types, notification_preferences
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			auto_approve_threshold = EXCLUDED.auto_approve_threshold,
			auto_approve_currency = EXCLUDED.auto_approve_currency,
			require_biometric_above = EXCLUDED.require_biometric_above,
			daily_autopilot_enabled = EXCLUDED.daily_autopilot_enabled,
			autopilot_time = EXCLUDED.autopilot_time,
			autopilot_timezone = EXCLUDED.autopilot_timezone,
			allowed_action_types = EXCLUDED.allowed_action_types,
			notification_preferences = EXCLUDED.notification_preferences,
			updated_at = NOW()
		RETURNING created_at, updated_at`

	return r.db.QueryRow(ctx, query,
		config.UserID,
		config.Enabled,
		config.AutoApproveThreshold,
		config.AutoApproveCurrency,
		config.RequireBiometricAbove,
		config.DailyAutopilotEnabled,
		config.AutopilotTime,
		config.AutopilotTimezone,
		config.AllowedActionTypes,
		config.NotificationPreferences,
	).Scan(&config.CreatedAt, &config.UpdatedAt)
}

// =========================================
// Action Logs
// =========================================

// CreateLog creates an action log entry
func (r *AgentPlanRepository) CreateLog(ctx context.Context, log *model.ActionLog) error {
	query := `
		INSERT INTO action_logs (
			id, user_id, plan_id, step_id, action_type, action_description,
			status, request_payload, response_payload, error_details,
			execution_time_ms, ip_address, user_agent
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING created_at`

	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}

	return r.db.QueryRow(ctx, query,
		log.ID,
		log.UserID,
		log.PlanID,
		log.StepID,
		log.ActionType,
		log.ActionDescription,
		log.Status,
		log.RequestPayload,
		log.ResponsePayload,
		log.ErrorDetails,
		log.ExecutionTimeMS,
		log.IPAddress,
		log.UserAgent,
	).Scan(&log.CreatedAt)
}

// GetLogsByUser retrieves action logs for a user
func (r *AgentPlanRepository) GetLogsByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*model.ActionLog, int, error) {
	countQuery := `SELECT COUNT(*) FROM action_logs WHERE user_id = $1`
	var total int
	if err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataQuery := `
		SELECT id, user_id, plan_id, step_id, action_type, action_description,
			status, request_payload, response_payload, error_details,
			execution_time_ms, ip_address, user_agent, created_at
		FROM action_logs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, dataQuery, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []*model.ActionLog
	for rows.Next() {
		log := &model.ActionLog{}
		if err := rows.Scan(
			&log.ID,
			&log.UserID,
			&log.PlanID,
			&log.StepID,
			&log.ActionType,
			&log.ActionDescription,
			&log.Status,
			&log.RequestPayload,
			&log.ResponsePayload,
			&log.ErrorDetails,
			&log.ExecutionTimeMS,
			&log.IPAddress,
			&log.UserAgent,
			&log.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}

	return logs, total, rows.Err()
}

// =========================================
// Daily Autopilot
// =========================================

// GetOrCreateAutopilotResult gets or creates today's autopilot result
func (r *AgentPlanRepository) GetOrCreateAutopilotResult(ctx context.Context, userID uuid.UUID, runDate time.Time) (*model.DailyAutopilotResult, error) {
	date := runDate.Truncate(24 * time.Hour)

	// Try to get existing
	query := `
		SELECT id, user_id, run_date, status, upcoming_bills, balance_predictions,
			goal_opportunities, subscription_insights, anomalies_detected,
			proposed_actions, auto_approved_actions, pending_approvals,
			analysis_duration_ms, error_message, created_at, completed_at
		FROM daily_autopilot_results
		WHERE user_id = $1 AND run_date = $2`

	result := &model.DailyAutopilotResult{}
	err := r.db.QueryRow(ctx, query, userID, date).Scan(
		&result.ID,
		&result.UserID,
		&result.RunDate,
		&result.Status,
		&result.UpcomingBills,
		&result.BalancePredictions,
		&result.GoalOpportunities,
		&result.SubscriptionInsights,
		&result.AnomaliesDetected,
		&result.ProposedActions,
		&result.AutoApprovedActions,
		&result.PendingApprovals,
		&result.AnalysisDurationMS,
		&result.ErrorMessage,
		&result.CreatedAt,
		&result.CompletedAt,
	)
	if err == nil {
		return result, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	// Create new
	result = &model.DailyAutopilotResult{
		ID:      uuid.New(),
		UserID:  userID,
		RunDate: date,
		Status:  "pending",
	}

	insertQuery := `
		INSERT INTO daily_autopilot_results (id, user_id, run_date, status)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at`

	err = r.db.QueryRow(ctx, insertQuery,
		result.ID, result.UserID, result.RunDate, result.Status,
	).Scan(&result.CreatedAt)

	return result, err
}

// UpdateAutopilotResult updates an autopilot result
func (r *AgentPlanRepository) UpdateAutopilotResult(ctx context.Context, result *model.DailyAutopilotResult) error {
	query := `
		UPDATE daily_autopilot_results SET
			status = $1,
			upcoming_bills = $2,
			balance_predictions = $3,
			goal_opportunities = $4,
			subscription_insights = $5,
			anomalies_detected = $6,
			proposed_actions = $7,
			auto_approved_actions = $8,
			pending_approvals = $9,
			analysis_duration_ms = $10,
			error_message = $11,
			completed_at = $12
		WHERE id = $13`

	_, err := r.db.Exec(ctx, query,
		result.Status,
		result.UpcomingBills,
		result.BalancePredictions,
		result.GoalOpportunities,
		result.SubscriptionInsights,
		result.AnomaliesDetected,
		result.ProposedActions,
		result.AutoApprovedActions,
		result.PendingApprovals,
		result.AnalysisDurationMS,
		result.ErrorMessage,
		result.CompletedAt,
		result.ID,
	)
	return err
}
