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

// AutopilotScheduler manages scheduled execution of daily autopilot scans
type AutopilotScheduler struct {
autopilot *DailyAutopilotService
agentRepo *repository.AgentPlanRepository

ticker   *time.Ticker
stopChan chan struct{}
wg       sync.WaitGroup
running  bool
mu       sync.RWMutex
}

// NewAutopilotScheduler creates a new autopilot scheduler
func NewAutopilotScheduler(
autopilot *DailyAutopilotService,
agentRepo *repository.AgentPlanRepository,
) *AutopilotScheduler {
return &AutopilotScheduler{
autopilot: autopilot,
agentRepo: agentRepo,
stopChan:  make(chan struct{}),
}
}

// Start begins the autopilot scheduler
func (s *AutopilotScheduler) Start() {
s.mu.Lock()
if s.running {
s.mu.Unlock()
return
}
s.running = true
s.mu.Unlock()

// Run daily at configured time (for now, every 24 hours)
interval := 24 * time.Hour
s.ticker = time.NewTicker(interval)

s.wg.Add(1)
go s.runLoop()

log.Info().Dur("interval", interval).Msg("Autopilot scheduler started")
}

// Stop gracefully stops the scheduler
func (s *AutopilotScheduler) Stop() {
s.mu.Lock()
defer s.mu.Unlock()

if !s.running {
return
}

close(s.stopChan)
if s.ticker != nil {
s.ticker.Stop()
}
s.wg.Wait()
s.running = false

log.Info().Msg("Autopilot scheduler stopped")
}

// runLoop is the main scheduler loop
func (s *AutopilotScheduler) runLoop() {
defer s.wg.Done()

for {
select {
case <-s.ticker.C:
s.runDailyScans()
case <-s.stopChan:
return
}
}
}

// runDailyScans executes autopilot for all enabled users
func (s *AutopilotScheduler) runDailyScans() {
ctx := context.Background()
log.Info().Msg("Starting daily autopilot scans for all users")

// Get all users with agent enabled
users, err := s.getEnabledUsers(ctx)
if err != nil {
log.Error().Err(err).Msg("Failed to get enabled users")
return
}

log.Info().Int("user_count", len(users)).Msg("Running autopilot for users")

// Process users concurrently with rate limiting
sem := make(chan struct{}, 10) // Max 10 concurrent scans
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
log.Info().Msg("Daily autopilot scans completed")
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

// getEnabledUsers returns all users with daily autopilot enabled
func (s *AutopilotScheduler) getEnabledUsers(ctx context.Context) ([]uuid.UUID, error) {
// TODO: Add repository method to get users with agent enabled
// For now, return empty slice as placeholder
return []uuid.UUID{}, nil
}

// sendAttentionNotification sends a push notification to the user
func (s *AutopilotScheduler) sendAttentionNotification(ctx context.Context, userID uuid.UUID, analysis *AutopilotAnalysis) {
// TODO: Integrate with notification service
log.Info().
Str("user_id", userID.String()).
Str("reason", analysis.AttentionReason).
Msg("Would send attention notification")
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

// createPlanFromRecommendations creates an agent plan from a list of recommendations
func (s *AutopilotScheduler) createPlanFromRecommendations(
ctx context.Context,
userID uuid.UUID,
priority string,
title string,
recommendations []model.AgentRecommendedAction,
) {
// TODO: Use PlanningEngineService to create the plan
log.Info().
Str("user_id", userID.String()).
Str("priority", priority).
Str("title", title).
Int("action_count", len(recommendations)).
Msg("Would create agent plan")
}

// RunManualScan triggers an immediate scan for a specific user (for testing)
func (s *AutopilotScheduler) RunManualScan(ctx context.Context, userID uuid.UUID) (*AutopilotAnalysis, error) {
return s.autopilot.RunDailyScan(ctx, userID)
}
