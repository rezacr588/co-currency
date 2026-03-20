package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// AIAgentToolExecutor handles agent-specific tool executions for AI
type AIAgentToolExecutor struct {
	agentRepo      *repository.AgentPlanRepository
	planEngine     *PlanningEngineService
	autopilot      *DailyAutopilotService
	actionExecutor *ActionExecutor
}

// NewAIAgentToolExecutor creates a new agent tool executor
func NewAIAgentToolExecutor(
	agentRepo *repository.AgentPlanRepository,
	planEngine *PlanningEngineService,
	autopilot *DailyAutopilotService,
	actionExecutor *ActionExecutor,
) *AIAgentToolExecutor {
	return &AIAgentToolExecutor{
		agentRepo:      agentRepo,
		planEngine:     planEngine,
		autopilot:      autopilot,
		actionExecutor: actionExecutor,
	}
}

// Execute runs an agent-specific tool
func (e *AIAgentToolExecutor) Execute(ctx context.Context, userID uuid.UUID, tc *ToolCall) (string, error) {
	if e == nil {
		return "", fmt.Errorf("agent tools not available")
	}

	switch tc.Name {
	case "get_agent_plans":
		return e.getAgentPlans(ctx, userID, tc.Params)
	case "create_agent_plan":
		return e.createAgentPlan(ctx, userID, tc.Params)
	case "get_pending_approvals":
		return e.getPendingApprovals(ctx, userID)
	case "approve_action":
		return e.approveAction(ctx, userID, tc.Params)
	case "get_daily_briefing":
		return e.getDailyBriefing(ctx, userID)
	case "run_financial_scan":
		return e.runFinancialScan(ctx, userID)
	case "preview_action":
		return e.previewAction(ctx, userID, tc.Params)
	case "get_agent_config":
		return e.getAgentConfig(ctx, userID)
	case "update_agent_config":
		return e.updateAgentConfig(ctx, userID, tc.Params)
	default:
		return "", fmt.Errorf("unknown agent tool: %s", tc.Name)
	}
}

// getAgentPlans returns the user's active financial plans
func (e *AIAgentToolExecutor) getAgentPlans(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.planEngine == nil {
		return "Agent service not available", nil
	}

	status := ""
	if s, ok := params["status"].(string); ok {
		status = s
	}

	plans, _, err := e.planEngine.ListPlans(ctx, userID, status, 20, 0)
	if err != nil {
		return "", fmt.Errorf("failed to list plans: %w", err)
	}

	if len(plans) == 0 {
		return "No financial plans found. I can help you create one based on your goals.", nil
	}

	result := fmt.Sprintf("Found %d financial plan(s):\n\n", len(plans))
	for _, plan := range plans {
		result += fmt.Sprintf("- **%s** (%s)\n", plan.Title, plan.Status)
		if plan.Description != nil {
			result += fmt.Sprintf("  %s\n", *plan.Description)
		}
		if plan.TargetAmount != nil && plan.TargetCurrency != nil {
			result += fmt.Sprintf("  Target: %.2f %s\n", *plan.TargetAmount, *plan.TargetCurrency)
		}
		result += fmt.Sprintf("  Priority: %s\n\n", plan.Priority)
	}

	return result, nil
}

// createAgentPlan creates a new financial plan
func (e *AIAgentToolExecutor) createAgentPlan(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.planEngine == nil {
		return "Agent service not available", nil
	}

	title, _ := params["title"].(string)
	description, _ := params["description"].(string)
	goalType, _ := params["goal_type"].(string)
	priority, _ := params["priority"].(string)

	if title == "" {
		return "Please provide a title for the plan.", nil
	}
	if goalType == "" {
		goalType = "savings"
	}
	if priority == "" {
		priority = "medium"
	}

	req := &model.CreatePlanRequest{
		Title:       title,
		Description: &description,
		GoalType:    goalType,
		Priority:    priority,
	}

	if amt, ok := params["target_amount"].(float64); ok {
		req.TargetAmount = &amt
	}
	if curr, ok := params["target_currency"].(string); ok {
		req.TargetCurrency = &curr
	}

	plan, err := e.planEngine.CreatePlan(ctx, userID, req)
	if err != nil {
		return fmt.Sprintf("Failed to create plan: %v", err), nil
	}

	return fmt.Sprintf("Created financial plan: **%s** (ID: %s)\n\nThe plan is in 'draft' status. Would you like me to:\n1. Add specific action steps?\n2. Generate AI-suggested steps based on your goal?\n3. Activate the plan to start execution?", plan.Title, plan.ID.String()), nil
}

// getPendingApprovals returns actions waiting for user approval
func (e *AIAgentToolExecutor) getPendingApprovals(ctx context.Context, userID uuid.UUID) (string, error) {
	if e.planEngine == nil {
		return "Agent service not available", nil
	}

	approvals, err := e.planEngine.GetPendingApprovals(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get pending approvals: %w", err)
	}

	if len(approvals) == 0 {
		return "No pending approvals. All your financial actions are up to date!", nil
	}

	result := fmt.Sprintf("You have %d action(s) waiting for approval:\n\n", len(approvals))
	for i, approval := range approvals {
		result += fmt.Sprintf("%d. Step ID: %s\n", i+1, approval.StepID.String())
		result += fmt.Sprintf("   Status: %s\n", approval.ApprovalStatus)
		result += fmt.Sprintf("   Expires: %s\n\n", approval.ExpiresAt.Format("Jan 2, 3:04 PM"))
	}

	result += "Say 'approve action [step_id]' or 'reject action [step_id]' to proceed."
	return result, nil
}

// approveAction approves a pending action
func (e *AIAgentToolExecutor) approveAction(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.planEngine == nil {
		return "Agent service not available", nil
	}

	stepIDStr, ok := params["step_id"].(string)
	if !ok {
		return "Please specify which action to approve (step_id required).", nil
	}

	stepID, err := uuid.Parse(stepIDStr)
	if err != nil {
		return "Invalid step ID format.", nil
	}

	step, err := e.agentRepo.GetStepByID(ctx, stepID)
	if err != nil {
		return fmt.Sprintf("Step not found: %v", err), nil
	}

	err = e.planEngine.ApproveStep(ctx, userID, step.PlanID, stepID, "ai_chat", nil)
	if err != nil {
		return fmt.Sprintf("Failed to approve action: %v", err), nil
	}

	return fmt.Sprintf("Action approved! The step '%s' will be executed according to its schedule.", step.Title), nil
}

// getDailyBriefing returns the user's daily financial briefing
func (e *AIAgentToolExecutor) getDailyBriefing(ctx context.Context, userID uuid.UUID) (string, error) {
	if e.planEngine == nil {
		return "Agent service not available", nil
	}

	briefing, err := e.planEngine.GetDailyBriefing(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get daily briefing: %w", err)
	}

	result := "📊 **Daily Financial Briefing**\n\n"

	// Balance health
	result += "**Balance Health:**\n"
	result += fmt.Sprintf("- Status: %s\n", briefing.BalanceHealth.Status)
	result += fmt.Sprintf("- Projected Balance: %.2f %s\n", briefing.BalanceHealth.ProjectedBalance, briefing.BalanceHealth.Currency)
	if briefing.BalanceHealth.DaysUntilLow != nil {
		result += fmt.Sprintf("- Days Until Low: %d\n", *briefing.BalanceHealth.DaysUntilLow)
	}
	result += "\n"

	// Upcoming bills
	if len(briefing.UpcomingBills) > 0 {
		result += "**Upcoming Bills:**\n"
		for _, bill := range briefing.UpcomingBills {
			result += fmt.Sprintf("- %s: %.2f %s (in %d days)\n", bill.Title, bill.Amount, bill.Currency, bill.DaysUntil)
		}
		result += "\n"
	}

	// Goal opportunities
	if len(briefing.GoalOpportunities) > 0 {
		result += "**Goal Opportunities:**\n"
		for _, opp := range briefing.GoalOpportunities {
			result += fmt.Sprintf("- %s: %.2f %s suggested\n", opp.GoalTitle, opp.SuggestedAmount, opp.Currency)
		}
		result += "\n"
	}

	// Pending approvals
	if briefing.PendingApprovals > 0 {
		result += fmt.Sprintf("⚠️ You have **%d pending approval(s)**. Say 'show pending approvals' to review.\n\n", briefing.PendingApprovals)
	}

	// Insights
	if len(briefing.Insights) > 0 {
		result += "**Insights:**\n"
		for _, insight := range briefing.Insights {
			result += fmt.Sprintf("- %s\n", insight)
		}
		result += "\n"
	}

	// Recommended action
	if briefing.RecommendedAction != nil {
		result += fmt.Sprintf("**Top Recommendation:** %s - %s\n", briefing.RecommendedAction.Title, briefing.RecommendedAction.Description)
	}

	return result, nil
}

// runFinancialScan triggers an immediate financial health scan
func (e *AIAgentToolExecutor) runFinancialScan(ctx context.Context, userID uuid.UUID) (string, error) {
	if e.autopilot == nil {
		return "Autopilot service not available", nil
	}

	analysis, err := e.autopilot.RunDailyScan(ctx, userID)
	if err != nil {
		return fmt.Sprintf("Failed to run financial scan: %v", err), nil
	}

	if analysis == nil {
		return "Financial agent is not enabled for your account. Enable it in settings to use this feature.", nil
	}

	result := "🔍 **Financial Health Scan Complete**\n\n"

	if len(analysis.UpcomingBills) > 0 {
		result += fmt.Sprintf("**Upcoming Bills (%d):**\n", len(analysis.UpcomingBills))
		for _, bill := range analysis.UpcomingBills {
			result += fmt.Sprintf("- %s: %.2f %s (in %d days)\n", bill.Name, bill.Amount, bill.Currency, bill.DaysUntil)
		}
		result += "\n"
	}

	if len(analysis.BalancePredictions) > 0 {
		result += "**Balance Predictions:**\n"
		for _, pred := range analysis.BalancePredictions {
			result += fmt.Sprintf("- %s: %.2f → %.2f in 7 days (%s risk)\n",
				pred.Currency, pred.CurrentBalance, pred.PredictedIn7Days, pred.RiskLevel)
		}
		result += "\n"
	}

	if len(analysis.GoalOpportunities) > 0 {
		result += "**Goal Opportunities:**\n"
		for _, opp := range analysis.GoalOpportunities {
			result += fmt.Sprintf("- %s: Suggest contributing %.2f %s\n", opp.GoalName, opp.SuggestedAmount, opp.Currency)
		}
		result += "\n"
	}

	if len(analysis.Recommendations) > 0 {
		result += fmt.Sprintf("**Recommendations (%d):**\n", len(analysis.Recommendations))
		for _, rec := range analysis.Recommendations {
			result += fmt.Sprintf("- %s: %s\n", rec.Title, rec.Description)
		}
	}

	if analysis.RequiresAttention {
		result += fmt.Sprintf("\n⚠️ **Attention Required:** %s", analysis.AttentionReason)
	}

	return result, nil
}

// previewAction shows what an action would do without executing it
func (e *AIAgentToolExecutor) previewAction(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.actionExecutor == nil {
		return "Action executor not available", nil
	}

	stepIDStr, ok := params["step_id"].(string)
	if !ok {
		return "Please specify which action to preview (step_id required).", nil
	}

	stepID, err := uuid.Parse(stepIDStr)
	if err != nil {
		return "Invalid step ID format.", nil
	}

	result, err := e.actionExecutor.ExecuteStep(ctx, userID, stepID, true)
	if err != nil {
		return fmt.Sprintf("Failed to preview action: %v", err), nil
	}

	output := "🔮 **Action Preview (Dry Run)**\n\n"
	output += fmt.Sprintf("**Would execute:** %s\n", result.Message)
	output += fmt.Sprintf("**Estimated impact:** %.2f\n", result.Impact)

	if result.Details != nil {
		detailsJSON, _ := json.MarshalIndent(result.Details, "", "  ")
		output += fmt.Sprintf("**Details:**\n```json\n%s\n```\n", string(detailsJSON))
	}

	output += "\nSay 'approve action' to execute this action for real."
	return output, nil
}

// getAgentConfig returns the user's agent configuration
func (e *AIAgentToolExecutor) getAgentConfig(ctx context.Context, userID uuid.UUID) (string, error) {
	if e.agentRepo == nil {
		return "Agent service not available", nil
	}

	config, err := e.agentRepo.GetConfig(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("failed to get agent config: %w", err)
	}

	if config == nil {
		return "Your financial agent is not configured yet. Would you like me to set it up with default settings?", nil
	}

	result := "⚙️ **Agent Configuration**\n\n"
	result += fmt.Sprintf("- **Enabled:** %v\n", config.Enabled)
	result += fmt.Sprintf("- **Auto-approve threshold:** %.2f %s\n", config.AutoApproveThreshold, config.AutoApproveCurrency)
	result += fmt.Sprintf("- **Require biometric above:** %.2f\n", config.RequireBiometricAbove)
	result += fmt.Sprintf("- **Daily autopilot:** %v\n", config.DailyAutopilotEnabled)
	if config.AutopilotTime != "" {
		result += fmt.Sprintf("- **Autopilot time:** %s (%s)\n", config.AutopilotTime, config.AutopilotTimezone)
	}
	if len(config.AllowedActionTypes) > 0 {
		result += fmt.Sprintf("- **Allowed actions:** %v\n", config.AllowedActionTypes)
	}

	return result, nil
}

// updateAgentConfig updates the user's agent configuration
func (e *AIAgentToolExecutor) updateAgentConfig(ctx context.Context, userID uuid.UUID, params map[string]interface{}) (string, error) {
	if e.planEngine == nil {
		return "Agent service not available", nil
	}

	req := &model.UpdateConfigRequest{}

	if enabled, ok := params["enabled"].(bool); ok {
		req.Enabled = &enabled
	}
	if threshold, ok := params["auto_approve_threshold"].(float64); ok {
		req.AutoApproveThreshold = &threshold
	}
	if currency, ok := params["auto_approve_currency"].(string); ok {
		req.AutoApproveCurrency = &currency
	}
	if biometric, ok := params["require_biometric_above"].(float64); ok {
		req.RequireBiometricAbove = &biometric
	}
	if autopilot, ok := params["daily_autopilot_enabled"].(bool); ok {
		req.DailyAutopilotEnabled = &autopilot
	}
	if autopilotTime, ok := params["autopilot_time"].(string); ok {
		req.AutopilotTime = &autopilotTime
	}

	config, err := e.planEngine.UpdateConfig(ctx, userID, req)
	if err != nil {
		return fmt.Sprintf("Failed to update config: %v", err), nil
	}

	return fmt.Sprintf("Agent configuration updated!\n- Enabled: %v\n- Auto-approve threshold: %.2f %s\n- Daily autopilot: %v",
		config.Enabled, config.AutoApproveThreshold, config.AutoApproveCurrency, config.DailyAutopilotEnabled), nil
}

// GetAgentToolDefinitions returns the tool definitions for agent-related tools
func GetAgentToolDefinitions() string {
	return `
## Agent Financial Planning Tools

You have access to the following agent tools for financial planning and automation:

### get_agent_plans
List the user's financial plans.
Parameters:
- status (optional): Filter by status (draft, active, paused, completed, cancelled)

### create_agent_plan
Create a new financial plan for the user.
Parameters:
- title (required): Name of the plan
- description (optional): Detailed description
- goal_type (optional): Type of goal (savings, debt_payment, investment, budget_optimization, emergency_fund)
- priority (optional): Priority level (low, medium, high, urgent)
- target_amount (optional): Target amount to achieve
- target_currency (optional): Currency for the target

### get_pending_approvals
Get all actions waiting for user approval.

### approve_action
Approve a pending action for execution.
Parameters:
- step_id (required): The ID of the step to approve

### get_daily_briefing
Get the user's daily financial briefing with balance summary, upcoming actions, and recommendations.

### run_financial_scan
Run an immediate financial health scan to detect upcoming bills, predict balance trends, and find opportunities.

### preview_action
Preview what an action would do without actually executing it (dry run).
Parameters:
- step_id (required): The ID of the step to preview

### get_agent_config
Get the user's agent configuration settings.

### update_agent_config
Update the user's agent configuration.
Parameters:
- enabled (optional): Enable/disable the agent
- auto_approve_threshold (optional): Amount below which actions are auto-approved
- auto_approve_currency (optional): Currency for the threshold
- require_biometric_above (optional): Amount above which biometric auth is required
- daily_autopilot_enabled (optional): Enable/disable daily autopilot scans
- autopilot_time (optional): Time for daily autopilot (HH:MM:SS format)

When the user asks about financial planning, automation, or wants to set up automatic actions, use these tools to help them.
`
}

// Ensure imports are used
var _ = time.Now
