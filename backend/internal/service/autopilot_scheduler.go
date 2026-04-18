package service

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rs/zerolog/log"
)

// Default cadence constants. Can be overridden via NewAutopilotScheduler args.
const (
	defaultTickInterval    = 10 * time.Minute
	defaultDueGap          = 20 * time.Hour // min time between scans per user
	maxConcurrentUserScans = 10
)

// AutopilotScheduler manages scheduled execution of daily autopilot scans.
// On each tick it queries the DB for users whose local autopilot_time has
// arrived since their last scan and runs the pipeline for them. Cold-start
// recovery is automatic: the first tick fires immediately (not after tickInterval),
// so a restart won't skip users who became due while the process was down.
type AutopilotScheduler struct {
	autopilot  *DailyAutopilotService
	agentRepo  *repository.AgentPlanRepository
	notifier   *NotificationService
	planEngine *PlanningEngineService

	tickInterval time.Duration
	dueGap       time.Duration

	ticker   *time.Ticker
	stopChan chan struct{}
	wg       sync.WaitGroup
	running  bool
	mu       sync.RWMutex
}

// NewAutopilotScheduler creates a new autopilot scheduler. The notifier and
// planEngine arguments are optional — pass nil to disable those side effects.
// A zero tickInterval falls back to defaultTickInterval (10m).
func NewAutopilotScheduler(
	autopilot *DailyAutopilotService,
	agentRepo *repository.AgentPlanRepository,
	notifier *NotificationService,
	planEngine *PlanningEngineService,
	tickInterval time.Duration,
) *AutopilotScheduler {
	if tickInterval <= 0 {
		tickInterval = defaultTickInterval
	}
	return &AutopilotScheduler{
		autopilot:    autopilot,
		agentRepo:    agentRepo,
		notifier:     notifier,
		planEngine:   planEngine,
		tickInterval: tickInterval,
		dueGap:       defaultDueGap,
		stopChan:     make(chan struct{}),
	}
}

// Start begins the autopilot scheduler. Safe to call once; subsequent calls are
// no-ops until Stop is invoked.
func (s *AutopilotScheduler) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	// Re-create stopChan in case Start is called after a prior Stop.
	s.stopChan = make(chan struct{})
	s.mu.Unlock()

	s.ticker = time.NewTicker(s.tickInterval)

	s.wg.Add(1)
	go s.runLoop()

	log.Info().
		Dur("tick_interval", s.tickInterval).
		Dur("due_gap", s.dueGap).
		Msg("Autopilot scheduler started")
}

// Stop gracefully stops the scheduler
func (s *AutopilotScheduler) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}

	close(s.stopChan)
	if s.ticker != nil {
		s.ticker.Stop()
	}
	s.running = false
	s.mu.Unlock()

	// Wait outside the lock so Stop doesn't deadlock if the loop is mid-scan.
	s.wg.Wait()

	log.Info().Msg("Autopilot scheduler stopped")
}

// runLoop is the main scheduler loop. The first scan fires immediately after
// Start so cold-starts don't delay users by a full tick interval; subsequent
// scans fire on the ticker cadence.
func (s *AutopilotScheduler) runLoop() {
	defer s.wg.Done()

	// Immediate first pass so restarts don't stall due users.
	s.runDailyScans()

	for {
		select {
		case <-s.ticker.C:
			s.runDailyScans()
		case <-s.stopChan:
			return
		}
	}
}

// runDailyScans executes autopilot for all users whose local time has caught
// up to their preferred autopilot_time and who haven't run in the last dueGap.
func (s *AutopilotScheduler) runDailyScans() {
	ctx := context.Background()

	users, err := s.getDueUsers(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list users due for autopilot")
		return
	}
	if len(users) == 0 {
		return
	}

	log.Info().Int("user_count", len(users)).Msg("Running autopilot for due users")

	// Process users concurrently with rate limiting
	sem := make(chan struct{}, maxConcurrentUserScans)
	var wg sync.WaitGroup

	for _, userID := range users {
		wg.Add(1)
		go func(uid uuid.UUID) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire
			defer func() { <-sem }() // Release

			s.runUserScan(ctx, uid)
		}(userID)
	}

	wg.Wait()
	log.Info().Msg("Autopilot scan batch completed")
}

// runUserScan executes a scan for a single user
func (s *AutopilotScheduler) runUserScan(ctx context.Context, userID uuid.UUID) {
	startTime := time.Now()

	analysis, err := s.autopilot.RunDailyScan(ctx, userID)
	if err != nil {
		log.Error().
			Err(err).
			Str("user_id", userID.String()).
			Msg("Autopilot scan failed")
		return
	}

	if analysis == nil {
		return
	}

	duration := time.Since(startTime)

	log.Info().
		Str("user_id", userID.String()).
		Dur("duration", duration).
		Int("bills", len(analysis.UpcomingBills)).
		Int("opportunities", len(analysis.GoalOpportunities)).
		Int("recommendations", len(analysis.Recommendations)).
		Bool("requires_attention", analysis.RequiresAttention).
		Msg("User autopilot scan completed")

	// If attention required, send notification
	if analysis.RequiresAttention {
		s.sendAttentionNotification(ctx, userID, analysis)
	}

	// If there are actionable recommendations, create proposals
	if len(analysis.Recommendations) > 0 {
		s.createActionProposals(ctx, userID, analysis)
	}
}

// getDueUsers returns users whose local autopilot_time has arrived and who
// haven't had a scan in the last dueGap. This is the scheduler's inner query.
func (s *AutopilotScheduler) getDueUsers(ctx context.Context) ([]uuid.UUID, error) {
	return s.agentRepo.GetUsersDueForAutopilot(ctx, s.dueGap)
}

// sendAttentionNotification sends a push notification to the user when the
// daily scan flags something that needs their attention.
func (s *AutopilotScheduler) sendAttentionNotification(ctx context.Context, userID uuid.UUID, analysis *AutopilotAnalysis) {
	reason := analysis.AttentionReason
	if reason == "" {
		reason = "Your finances need a quick look"
	}

	if s.notifier == nil {
		log.Info().
			Str("user_id", userID.String()).
			Str("reason", reason).
			Msg("Autopilot attention required (notifier disabled)")
		return
	}

	data := map[string]interface{}{
		"source":          "autopilot",
		"run_date":        analysis.Date.Format(time.RFC3339),
		"bills":           len(analysis.UpcomingBills),
		"opportunities":   len(analysis.GoalOpportunities),
		"recommendations": len(analysis.Recommendations),
	}
	if err := s.notifier.SendPushNotification(
		ctx,
		userID.String(),
		"CoAI Autopilot",
		reason,
		data,
		"autopilot_attention",
	); err != nil {
		log.Warn().
			Err(err).
			Str("user_id", userID.String()).
			Msg("Failed to deliver autopilot attention notification")
	}
}

// createActionProposals creates agent plans from recommendations
func (s *AutopilotScheduler) createActionProposals(ctx context.Context, userID uuid.UUID, analysis *AutopilotAnalysis) {
	log.Info().
		Str("user_id", userID.String()).
		Int("count", len(analysis.Recommendations)).
		Msg("Creating action proposals from recommendations")

	// Group recommendations by priority
	urgentActions := []model.AgentRecommendedAction{}
	highActions := []model.AgentRecommendedAction{}
	mediumActions := []model.AgentRecommendedAction{}

	for _, rec := range analysis.Recommendations {
		// Default to medium priority since AgentRecommendedAction doesn't have Priority field
		mediumActions = append(mediumActions, rec)
	}

	// Create a plan for urgent actions if any
	if len(urgentActions) > 0 {
		s.createPlanFromRecommendations(ctx, userID, "urgent", "Urgent Financial Actions", urgentActions)
	}

	// Create a plan for high-priority actions
	if len(highActions) > 0 {
		s.createPlanFromRecommendations(ctx, userID, "high", "Daily Financial Optimizations", highActions)
	}

	// Create medium-priority plan if no higher priority
	if len(urgentActions) == 0 && len(highActions) == 0 && len(mediumActions) > 0 {
		s.createPlanFromRecommendations(ctx, userID, "medium", "Financial Improvement Opportunities", mediumActions)
	}
}

// createPlanFromRecommendations creates an agent plan from a list of recommendations.
// The plan is created in "pending" status so the user can review it via the
// existing /agent/plans approval surface before any action executes.
func (s *AutopilotScheduler) createPlanFromRecommendations(
	ctx context.Context,
	userID uuid.UUID,
	priority string,
	title string,
	recommendations []model.AgentRecommendedAction,
) {
	if s.planEngine == nil {
		log.Info().
			Str("user_id", userID.String()).
			Str("priority", priority).
			Str("title", title).
			Int("action_count", len(recommendations)).
			Msg("Autopilot recommendations ready (plan engine disabled)")
		return
	}

	// Archive any still-open autopilot plans from prior scans so the user
	// doesn't accumulate 10 daily "Financial Improvement Opportunities" plans
	// that eventually hit MaxActivePlans and block future inserts.
	if archived, err := s.agentRepo.ArchiveActiveAutopilotPlans(ctx, userID); err != nil {
		log.Warn().
			Err(err).
			Str("user_id", userID.String()).
			Msg("Failed to archive prior autopilot plans; proceeding anyway")
	} else if archived > 0 {
		log.Info().
			Str("user_id", userID.String()).
			Int64("archived", archived).
			Msg("Archived prior autopilot plans before creating fresh one")
	}

	desc := "Auto-generated by daily autopilot scan"
	req := &model.CreatePlanRequest{
		Title:       title,
		Description: &desc,
		GoalType:    "custom",
		Priority:    priority,
		Metadata: map[string]interface{}{
			"source":       "autopilot",
			"run_date":     time.Now().UTC().Format(time.RFC3339),
			"step_urgency": priority,
		},
	}
	plan, err := s.planEngine.CreatePlan(ctx, userID, req)
	if err != nil {
		log.Warn().
			Err(err).
			Str("user_id", userID.String()).
			Str("title", title).
			Msg("Failed to create autopilot plan")
		return
	}

	for idx, rec := range recommendations {
		actionType := rec.Type
		if actionType == "" {
			actionType = "recommendation"
		}
		stepDesc := rec.Description
		params := map[string]interface{}{
			"impact":   rec.Impact,
			"currency": rec.Currency,
			"urgency":  rec.Urgency,
		}
		estimatedImpact := rec.Impact
		step := &model.PlanStep{
			PlanID:           plan.ID,
			StepOrder:        idx + 1,
			Title:            rec.Title,
			Description:      &stepDesc,
			ActionType:       actionType,
			ActionParams:     params,
			Status:           "pending",
			RequiresApproval: true,
			EstimatedImpact:  &estimatedImpact,
		}
		if err := s.planEngine.AddStep(ctx, userID, plan.ID, step); err != nil {
			log.Warn().
				Err(err).
				Str("user_id", userID.String()).
				Str("plan_id", plan.ID.String()).
				Int("step_order", step.StepOrder).
				Msg("Failed to add autopilot step")
		}
	}

	log.Info().
		Str("user_id", userID.String()).
		Str("plan_id", plan.ID.String()).
		Str("priority", priority).
		Int("steps", len(recommendations)).
		Msg("Autopilot plan created from recommendations")
}

// RunManualScan triggers an immediate scan for a specific user (for testing)
func (s *AutopilotScheduler) RunManualScan(ctx context.Context, userID uuid.UUID) (*AutopilotAnalysis, error) {
	return s.autopilot.RunDailyScan(ctx, userID)
}
