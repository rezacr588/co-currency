package repository

import (
"context"
"encoding/json"
"time"

"github.com/google/uuid"
"github.com/jackc/pgx/v5/pgxpool"
"github.com/rezacr588/currency-converter/internal/model"
)

// FinancialDNARepository handles financial DNA data persistence
type FinancialDNARepository struct {
pool *pgxpool.Pool
}

// NewFinancialDNARepository creates a new repository instance
func NewFinancialDNARepository(pool *pgxpool.Pool) *FinancialDNARepository {
return &FinancialDNARepository{pool: pool}
}

// GetDNA retrieves the user's financial DNA profile
func (r *FinancialDNARepository) GetDNA(ctx context.Context, userID uuid.UUID) (*model.FinancialDNA, error) {
query := `
SELECT id, user_id, archetype, spending_temperament, planning_horizon,
   risk_tolerance, financial_stress, impulse_control, dimensions,
   strengths, growth_areas, transactions_analyzed, analysis_period_days,
   confidence_score, last_updated, created_at
FROM financial_dna
WHERE user_id = $1
`

var dna model.FinancialDNA
var dimensionsJSON, strengthsJSON, growthAreasJSON []byte

err := r.pool.QueryRow(ctx, query, userID).Scan(
&dna.ID, &dna.UserID, &dna.Archetype, &dna.SpendingTemperament,
&dna.PlanningHorizon, &dna.RiskTolerance, &dna.FinancialStress,
&dna.ImpulseControl, &dimensionsJSON, &strengthsJSON, &growthAreasJSON,
&dna.TransactionsAnalyzed, &dna.AnalysisPeriodDays, &dna.ConfidenceScore,
&dna.LastUpdated, &dna.CreatedAt,
)
if err != nil {
return nil, err
}

json.Unmarshal(dimensionsJSON, &dna.Dimensions)
json.Unmarshal(strengthsJSON, &dna.Strengths)
json.Unmarshal(growthAreasJSON, &dna.GrowthAreas)

// Set display labels
dna.ArchetypeLabel, dna.ArchetypeEmoji, _ = model.GetArchetypeDetails(dna.Archetype)

return &dna, nil
}

// UpsertDNA creates or updates a user's financial DNA profile
func (r *FinancialDNARepository) UpsertDNA(ctx context.Context, dna *model.FinancialDNA) error {
dimensionsJSON, _ := json.Marshal(dna.Dimensions)
strengthsJSON, _ := json.Marshal(dna.Strengths)
growthAreasJSON, _ := json.Marshal(dna.GrowthAreas)

query := `
INSERT INTO financial_dna (
id, user_id, archetype, spending_temperament, planning_horizon,
risk_tolerance, financial_stress, impulse_control, dimensions,
strengths, growth_areas, transactions_analyzed, analysis_period_days,
confidence_score, last_updated, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
ON CONFLICT (user_id) DO UPDATE SET
archetype = EXCLUDED.archetype,
spending_temperament = EXCLUDED.spending_temperament,
planning_horizon = EXCLUDED.planning_horizon,
risk_tolerance = EXCLUDED.risk_tolerance,
financial_stress = EXCLUDED.financial_stress,
impulse_control = EXCLUDED.impulse_control,
dimensions = EXCLUDED.dimensions,
strengths = EXCLUDED.strengths,
growth_areas = EXCLUDED.growth_areas,
transactions_analyzed = EXCLUDED.transactions_analyzed,
analysis_period_days = EXCLUDED.analysis_period_days,
confidence_score = EXCLUDED.confidence_score,
last_updated = EXCLUDED.last_updated
`

if dna.ID == uuid.Nil {
dna.ID = uuid.New()
}

_, err := r.pool.Exec(ctx, query,
dna.ID, dna.UserID, dna.Archetype, dna.SpendingTemperament,
dna.PlanningHorizon, dna.RiskTolerance, dna.FinancialStress,
dna.ImpulseControl, dimensionsJSON, strengthsJSON, growthAreasJSON,
dna.TransactionsAnalyzed, dna.AnalysisPeriodDays, dna.ConfidenceScore,
dna.LastUpdated, time.Now(),
)
return err
}

// GetInsights retrieves behavioral insights for a user
func (r *FinancialDNARepository) GetInsights(ctx context.Context, userID uuid.UUID, limit int) ([]model.BehavioralInsight, error) {
query := `
SELECT id, user_id, type, category, title, description, impact, severity,
   data, action_url, is_read, created_at
FROM behavioral_insights
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2
`

rows, err := r.pool.Query(ctx, query, userID, limit)
if err != nil {
return nil, err
}
defer rows.Close()

var insights []model.BehavioralInsight
for rows.Next() {
var insight model.BehavioralInsight
var dataJSON []byte

err := rows.Scan(
&insight.ID, &insight.UserID, &insight.Type, &insight.Category,
&insight.Title, &insight.Description, &insight.Impact, &insight.Severity,
&dataJSON, &insight.ActionURL, &insight.IsRead, &insight.CreatedAt,
)
if err != nil {
return nil, err
}

if len(dataJSON) > 0 {
json.Unmarshal(dataJSON, &insight.Data)
}
insights = append(insights, insight)
}

return insights, nil
}

// CreateInsight stores a new behavioral insight
func (r *FinancialDNARepository) CreateInsight(ctx context.Context, insight *model.BehavioralInsight) error {
dataJSON, _ := json.Marshal(insight.Data)

query := `
INSERT INTO behavioral_insights (
id, user_id, type, category, title, description, impact, severity,
data, action_url, is_read, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
`

if insight.ID == uuid.Nil {
insight.ID = uuid.New()
}
insight.CreatedAt = time.Now()

_, err := r.pool.Exec(ctx, query,
insight.ID, insight.UserID, insight.Type, insight.Category,
insight.Title, insight.Description, insight.Impact, insight.Severity,
dataJSON, insight.ActionURL, insight.IsRead, insight.CreatedAt,
)
return err
}

// MarkInsightRead marks an insight as read
func (r *FinancialDNARepository) MarkInsightRead(ctx context.Context, userID, insightID uuid.UUID) error {
query := `UPDATE behavioral_insights SET is_read = true WHERE id = $1 AND user_id = $2`
_, err := r.pool.Exec(ctx, query, insightID, userID)
return err
}

// SaveQuizResponse stores a user's quiz answer
func (r *FinancialDNARepository) SaveQuizResponse(ctx context.Context, response *model.DNAQuizResponse) error {
query := `
INSERT INTO dna_quiz_responses (user_id, question_id, answer, created_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, question_id) DO UPDATE SET
answer = EXCLUDED.answer,
created_at = EXCLUDED.created_at
`
_, err := r.pool.Exec(ctx, query, response.UserID, response.QuestionID, response.Answer, time.Now())
return err
}

// GetQuizResponses retrieves all quiz responses for a user
func (r *FinancialDNARepository) GetQuizResponses(ctx context.Context, userID uuid.UUID) ([]model.DNAQuizResponse, error) {
query := `
SELECT user_id, question_id, answer, created_at
FROM dna_quiz_responses
WHERE user_id = $1
ORDER BY created_at
`

rows, err := r.pool.Query(ctx, query, userID)
if err != nil {
return nil, err
}
defer rows.Close()

var responses []model.DNAQuizResponse
for rows.Next() {
var resp model.DNAQuizResponse
if err := rows.Scan(&resp.UserID, &resp.QuestionID, &resp.Answer, &resp.CreatedAt); err != nil {
return nil, err
}
responses = append(responses, resp)
}

return responses, nil
}

// GetUnreadInsightCount returns count of unread insights
func (r *FinancialDNARepository) GetUnreadInsightCount(ctx context.Context, userID uuid.UUID) (int, error) {
var count int
query := `SELECT COUNT(*) FROM behavioral_insights WHERE user_id = $1 AND is_read = false`
err := r.pool.QueryRow(ctx, query, userID).Scan(&count)
return count, err
}
