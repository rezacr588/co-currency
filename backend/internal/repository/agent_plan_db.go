package repository

import (
	"context"
	"errors"
	"fmt"
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

// UpdatePlanStatus updates a plan's status with ownership enforcement.
// The `user_id = $3` guard is defense-in-depth: service callers already run
// GetPlan(ctx, userID, planID) first, but enforcing ownership at the repo
// boundary means a future caller that forgets to check can't silently mutate
// another user's plan.
func (r *AgentPlanRepository) UpdatePlanStatus(ctx context.Context, userID, planID uuid.UUID, status string) error {
	query := `UPDATE agent_plans SET status = $1, updated_at = NOW()`
	if status == "completed" {
		query += `, completed_at = NOW()`
	}
	query += ` WHERE id = $2 AND user_id = $3`

	result, err := r.db.Exec(ctx, query, status, planID, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrPlanNotFound
	}
	return nil
}

// DeletePlan deletes a plan (soft delete by setting status to cancelled)
func (r *AgentPlanRepository) DeletePlan(ctx context.Context, userID, planID uuid.UUID) error {
	return r.UpdatePlanStatus(ctx, userID, planID, "cancelled")
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

// ArchiveActiveAutopilotPlans cancels any still-open plans that were created
// by the daily autopilot pipeline for the given user. Used to prevent plan
// sprawl: each daily scan archives its predecessor before creating a fresh
// plan. Returns the number of plans archived.
//
// Autopilot-created plans are identified by the metadata marker
// {"source": "autopilot"}; the service layer sets this when inserting.
func (r *AgentPlanRepository) ArchiveActiveAutopilotPlans(ctx context.Context, userID uuid.UUID) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE agent_plans
		SET status = 'cancelled', updated_at = NOW()
		WHERE user_id = $1
		  AND status IN ('draft', 'active', 'paused')
		  AND metadata ->> 'source' = 'autopilot'
	`, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
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

// GetPendingApprovalByStepID returns the pending approval ID for a given
// step, scoped to the caller's user_id. Returns ErrApprovalNotFound if no
// pending approval exists or the step is not owned by the user.
//
// This replaces the previous pattern of fetching all pending approvals for a
// user and scanning in-memory for the matching step (O(n) per approval
// action). Direct lookup is O(1) with the existing
// idx_action_approvals_user_pending index.
func (r *AgentPlanRepository) GetPendingApprovalByStepID(ctx context.Context, userID, stepID uuid.UUID) (uuid.UUID, error) {
	var approvalID uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT id FROM action_approvals
		WHERE step_id = $1
		  AND user_id = $2
		  AND approval_status = 'pending'
		LIMIT 1`, stepID, userID).Scan(&approvalID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrApprovalNotFound
		}
		return uuid.Nil, err
	}
	return approvalID, nil
}

// ApproveAction approves an action and flips the step status to 'approved'
// atomically. Both writes share a transaction, so a partial commit cannot
// leave us with an approved approval row pointing at a still-pending step.
//
// The action_approvals WHERE clause guards against duplicate approvals: the
// first caller to win the `approval_status = 'pending'` race flips the row;
// any concurrent caller sees `RowsAffected() == 0` and receives
// ErrApprovalNotFound (semantically "already resolved"). The step update is
// guarded by the approval_status = 'pending' subquery so even if someone
// races directly against plan_steps outside this method, we only promote it
// when the approval is still authoritative.
func (r *AgentPlanRepository) ApproveAction(ctx context.Context, approvalID uuid.UUID, method string, deviceInfo map[string]interface{}) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after Commit

	tag, err := tx.Exec(ctx, `
		UPDATE action_approvals
		SET approval_status = 'approved', approval_method = $1, approved_at = NOW(), device_info = $2
		WHERE id = $3 AND approval_status = 'pending'`,
		method, deviceInfo, approvalID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrApprovalNotFound
	}

	if _, err := tx.Exec(ctx, `
		UPDATE plan_steps SET status = 'approved', updated_at = NOW()
		WHERE id = (SELECT step_id FROM action_approvals WHERE id = $1)`,
		approvalID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// RejectAction rejects an action and flips the step status to 'skipped'
// atomically. Same transactional guarantees as ApproveAction.
func (r *AgentPlanRepository) RejectAction(ctx context.Context, approvalID uuid.UUID, reason string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after Commit

	tag, err := tx.Exec(ctx, `
		UPDATE action_approvals
		SET approval_status = 'rejected', rejection_reason = $1, approved_at = NOW()
		WHERE id = $2 AND approval_status = 'pending'`,
		reason, approvalID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrApprovalNotFound
	}

	if _, err := tx.Exec(ctx, `
		UPDATE plan_steps SET status = 'skipped', updated_at = NOW()
		WHERE id = (SELECT step_id FROM action_approvals WHERE id = $1)`,
		approvalID); err != nil {
		return err
	}

	return tx.Commit(ctx)
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

// GetConfig gets user's agent configuration.
//
// `autopilot_time::text` cast is intentional: pgx v5 has no default binary
// decoder for Postgres TIME (OID 1083) into Go string, and we want to keep
// AgentConfig.AutopilotTime as a plain "HH:MM:SS" string on the JSON surface.
// Without the cast, Scan fails with "cannot scan time (OID 1083) in binary
// format into *string" and every GetConfig/UpdateConfig call 500s.
func (r *AgentPlanRepository) GetConfig(ctx context.Context, userID uuid.UUID) (*model.AgentConfig, error) {
	query := `
		SELECT user_id, enabled, auto_approve_threshold, auto_approve_currency,
			require_biometric_above, daily_autopilot_enabled, autopilot_time::text,
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

// GetLatestAutopilotResult returns the most recent autopilot result for a user.
// Returns ErrNoRows wrapped if the user has never run an autopilot scan.
func (r *AgentPlanRepository) GetLatestAutopilotResult(ctx context.Context, userID uuid.UUID) (*model.DailyAutopilotResult, error) {
	query := `
		SELECT id, user_id, run_date, status, upcoming_bills, balance_predictions,
			goal_opportunities, subscription_insights, anomalies_detected,
			proposed_actions, auto_approved_actions, pending_approvals,
			analysis_duration_ms, error_message, created_at, completed_at
		FROM daily_autopilot_results
		WHERE user_id = $1
		ORDER BY run_date DESC, created_at DESC
		LIMIT 1`

	result := &model.DailyAutopilotResult{}
	err := r.db.QueryRow(ctx, query, userID).Scan(
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
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetUsersWithDailyAutopilotEnabled returns user IDs that have opted in to
// the daily autopilot scheduler — regardless of whether they're due now.
// Kept for admin/reporting use; the scheduler itself uses
// GetUsersDueForAutopilot which also applies the timezone + dedup filters.
func (r *AgentPlanRepository) GetUsersWithDailyAutopilotEnabled(ctx context.Context) ([]uuid.UUID, error) {
	query := `
		SELECT user_id
		FROM agent_config
		WHERE enabled = TRUE AND daily_autopilot_enabled = TRUE`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		users = append(users, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

// GetUsersDueForAutopilot returns users whose daily autopilot should fire now.
// A user is "due" when:
//  1. They have autopilot + daily_autopilot enabled
//  2. The current wall-clock time in their configured timezone has reached
//     or passed their preferred autopilot_time (time-of-day)
//  3. They have not had an autopilot result recorded in the last `minGap`.
//     This dedup is gap-based rather than calendar-date-based because
//     daily_autopilot_results.run_date is stored as a UTC-midnight date, which
//     doesn't align cleanly with per-user local days. A 20h gap guarantees
//     at most one run per ~day without risking day-skip near boundaries.
//
// The query handles malformed timezones gracefully — Postgres raises an error
// for unknown timezone strings, so callers should ensure agent_config.autopilot_timezone
// is a valid IANA zone (e.g. "America/New_York"). Unknown zones cause the row
// to be skipped via a WHERE clause guard.
func (r *AgentPlanRepository) GetUsersDueForAutopilot(ctx context.Context, minGap time.Duration) ([]uuid.UUID, error) {
	// Build the interval as a string so pgx sends a normal parameter; Postgres
	// parses "<n> seconds" reliably even for sub-minute gaps in tests.
	gapSeconds := int64(minGap.Seconds())
	if gapSeconds < 1 {
		gapSeconds = 1
	}
	gapStr := fmt.Sprintf("%d seconds", gapSeconds)

	// The pg_timezone_names join is defensive — the HTTP handler already
	// rejects invalid zones on save, but a bad row (imported, manual edit,
	// dropped OS tzdata entry) would otherwise raise and abort the whole
	// scheduler tick. Filtering here silently skips the offending user;
	// they'll surface next tick if their zone comes back.
	query := `
		SELECT ac.user_id
		FROM agent_config ac
		LEFT JOIN LATERAL (
			SELECT created_at
			FROM daily_autopilot_results
			WHERE user_id = ac.user_id
			ORDER BY created_at DESC
			LIMIT 1
		) last_run ON TRUE
		WHERE ac.enabled = TRUE
		  AND ac.daily_autopilot_enabled = TRUE
		  AND (last_run.created_at IS NULL OR last_run.created_at < NOW() - $1::interval)
		  AND COALESCE(NULLIF(ac.autopilot_timezone, ''), 'UTC') IN (
		    SELECT name FROM pg_timezone_names
		  )
		  AND (NOW() AT TIME ZONE COALESCE(NULLIF(ac.autopilot_timezone, ''), 'UTC'))::time
		      >= COALESCE(ac.autopilot_time, '09:00:00'::time)`

	rows, err := r.db.Query(ctx, query, gapStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		users = append(users, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}
