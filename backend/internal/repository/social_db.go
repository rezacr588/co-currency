package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rezacr588/currency-converter/internal/model"
)

// SocialRepository handles shared spaces and collaborative finance
type SocialRepository struct {
	pool *pgxpool.Pool
}

// NewSocialRepository creates a new social repository
func NewSocialRepository(pool *pgxpool.Pool) *SocialRepository {
	return &SocialRepository{pool: pool}
}

// CreateSpace creates a new shared space
func (r *SocialRepository) CreateSpace(ctx context.Context, space *model.SharedSpace) error {
	query := `
		INSERT INTO shared_spaces (id, name, description, type, currency, icon_emoji, settings, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at`

	space.ID = uuid.New()
	return r.pool.QueryRow(ctx, query,
		space.ID,
		space.Name,
		space.Description,
		space.Type,
		space.Currency,
		space.IconEmoji,
		space.Settings,
		space.CreatedBy,
	).Scan(&space.CreatedAt, &space.UpdatedAt)
}

// GetSpace retrieves a space by ID
func (r *SocialRepository) GetSpace(ctx context.Context, spaceID uuid.UUID) (*model.SharedSpace, error) {
	query := `
		SELECT id, name, description, type, currency, icon_emoji, settings, created_by, created_at, updated_at,
			(SELECT COUNT(*) FROM space_members WHERE space_id = s.id) as member_count
		FROM shared_spaces s
		WHERE id = $1`

	var space model.SharedSpace
	err := r.pool.QueryRow(ctx, query, spaceID).Scan(
		&space.ID, &space.Name, &space.Description, &space.Type, &space.Currency,
		&space.IconEmoji, &space.Settings, &space.CreatedBy, &space.CreatedAt, &space.UpdatedAt,
		&space.MemberCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &space, err
}

// GetUserSpaces lists all spaces a user is a member of
func (r *SocialRepository) GetUserSpaces(ctx context.Context, userID uuid.UUID) ([]model.SharedSpace, error) {
	query := `
		SELECT s.id, s.name, s.description, s.type, s.currency, s.icon_emoji, s.settings, 
			   s.created_by, s.created_at, s.updated_at,
			   (SELECT COUNT(*) FROM space_members WHERE space_id = s.id) as member_count
		FROM shared_spaces s
		INNER JOIN space_members m ON m.space_id = s.id
		WHERE m.user_id = $1
		ORDER BY s.updated_at DESC`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spaces []model.SharedSpace
	for rows.Next() {
		var s model.SharedSpace
		if err := rows.Scan(
			&s.ID, &s.Name, &s.Description, &s.Type, &s.Currency, &s.IconEmoji, &s.Settings,
			&s.CreatedBy, &s.CreatedAt, &s.UpdatedAt, &s.MemberCount,
		); err != nil {
			return nil, err
		}
		spaces = append(spaces, s)
	}
	return spaces, rows.Err()
}

// UpdateSpace updates a space
func (r *SocialRepository) UpdateSpace(ctx context.Context, space *model.SharedSpace) error {
	query := `
		UPDATE shared_spaces 
		SET name = $2, description = $3, icon_emoji = $4, settings = $5
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query,
		space.ID, space.Name, space.Description, space.IconEmoji, space.Settings)
	return err
}

// DeleteSpace deletes a space
func (r *SocialRepository) DeleteSpace(ctx context.Context, spaceID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM shared_spaces WHERE id = $1", spaceID)
	return err
}

// AddMember adds a member to a space
func (r *SocialRepository) AddMember(ctx context.Context, member *model.SpaceMember) error {
	query := `
		INSERT INTO space_members (id, space_id, user_id, role, nickname, invited_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING joined_at`

	member.ID = uuid.New()
	return r.pool.QueryRow(ctx, query,
		member.ID, member.SpaceID, member.UserID, member.Role, member.Nickname, member.InvitedBy,
	).Scan(&member.JoinedAt)
}

// GetSpaceMembers lists all members of a space
func (r *SocialRepository) GetSpaceMembers(ctx context.Context, spaceID uuid.UUID) ([]model.SpaceMember, error) {
	query := `
		SELECT m.id, m.space_id, m.user_id, m.role, m.nickname, m.joined_at, m.invited_by,
			   u.name, u.email, u.avatar_url
		FROM space_members m
		INNER JOIN users u ON u.id = m.user_id
		WHERE m.space_id = $1
		ORDER BY m.role, m.joined_at`

	rows, err := r.pool.Query(ctx, query, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []model.SpaceMember
	for rows.Next() {
		var m model.SpaceMember
		var avatarURL *string
		if err := rows.Scan(
			&m.ID, &m.SpaceID, &m.UserID, &m.Role, &m.Nickname, &m.JoinedAt, &m.InvitedBy,
			&m.UserName, &m.UserEmail, &avatarURL,
		); err != nil {
			return nil, err
		}
		if avatarURL != nil {
			m.AvatarURL = *avatarURL
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

// GetMember gets a specific member
func (r *SocialRepository) GetMember(ctx context.Context, spaceID, userID uuid.UUID) (*model.SpaceMember, error) {
	query := `
		SELECT m.id, m.space_id, m.user_id, m.role, m.nickname, m.joined_at, m.invited_by,
			   u.name, u.email
		FROM space_members m
		INNER JOIN users u ON u.id = m.user_id
		WHERE m.space_id = $1 AND m.user_id = $2`

	var m model.SpaceMember
	err := r.pool.QueryRow(ctx, query, spaceID, userID).Scan(
		&m.ID, &m.SpaceID, &m.UserID, &m.Role, &m.Nickname, &m.JoinedAt, &m.InvitedBy,
		&m.UserName, &m.UserEmail,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &m, err
}

// UpdateMemberRole updates a member's role
func (r *SocialRepository) UpdateMemberRole(ctx context.Context, spaceID, userID uuid.UUID, role model.SpaceRole) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE space_members SET role = $3 WHERE space_id = $1 AND user_id = $2",
		spaceID, userID, role)
	return err
}

// RemoveMember removes a member from a space
func (r *SocialRepository) RemoveMember(ctx context.Context, spaceID, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"DELETE FROM space_members WHERE space_id = $1 AND user_id = $2",
		spaceID, userID)
	return err
}

// CreateInvite creates a space invitation
func (r *SocialRepository) CreateInvite(ctx context.Context, invite *model.SpaceInvite) error {
	// Generate random invite code
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return err
	}
	invite.Code = hex.EncodeToString(b)
	invite.ID = uuid.New()
	invite.ExpiresAt = time.Now().Add(7 * 24 * time.Hour)

	query := `
		INSERT INTO space_invites (id, space_id, inviter_id, invitee_email, invitee_id, code, role, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at`

	return r.pool.QueryRow(ctx, query,
		invite.ID, invite.SpaceID, invite.InviterID, invite.InviteeEmail, invite.InviteeID,
		invite.Code, invite.Role, invite.ExpiresAt,
	).Scan(&invite.CreatedAt)
}

// GetInviteByCode retrieves an invite by code
func (r *SocialRepository) GetInviteByCode(ctx context.Context, code string) (*model.SpaceInvite, error) {
	query := `
		SELECT i.id, i.space_id, i.inviter_id, i.invitee_email, i.invitee_id, i.code, i.role,
			   i.expires_at, i.accepted_at, i.rejected_at, i.created_at,
			   s.name, u.name
		FROM space_invites i
		INNER JOIN shared_spaces s ON s.id = i.space_id
		INNER JOIN users u ON u.id = i.inviter_id
		WHERE i.code = $1`

	var invite model.SpaceInvite
	err := r.pool.QueryRow(ctx, query, code).Scan(
		&invite.ID, &invite.SpaceID, &invite.InviterID, &invite.InviteeEmail, &invite.InviteeID,
		&invite.Code, &invite.Role, &invite.ExpiresAt, &invite.AcceptedAt, &invite.RejectedAt,
		&invite.CreatedAt, &invite.SpaceName, &invite.InviterName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &invite, err
}

// AcceptInvite marks an invite as accepted
func (r *SocialRepository) AcceptInvite(ctx context.Context, inviteID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE space_invites SET accepted_at = NOW() WHERE id = $1",
		inviteID)
	return err
}

// RejectInvite marks an invite as rejected.
func (r *SocialRepository) RejectInvite(ctx context.Context, inviteID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE space_invites SET rejected_at = NOW() WHERE id = $1",
		inviteID)
	return err
}

// GetPendingInvites gets pending invites for a user
func (r *SocialRepository) GetPendingInvites(ctx context.Context, email string) ([]model.SpaceInvite, error) {
	query := `
		SELECT i.id, i.space_id, i.inviter_id, i.invitee_email, i.code, i.role,
			   i.expires_at, i.created_at, s.name, u.name
		FROM space_invites i
		INNER JOIN shared_spaces s ON s.id = i.space_id
		INNER JOIN users u ON u.id = i.inviter_id
		WHERE i.invitee_email = $1 
		  AND i.accepted_at IS NULL 
		  AND i.rejected_at IS NULL
		  AND i.expires_at > NOW()
		ORDER BY i.created_at DESC`

	rows, err := r.pool.Query(ctx, query, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invites []model.SpaceInvite
	for rows.Next() {
		var i model.SpaceInvite
		if err := rows.Scan(
			&i.ID, &i.SpaceID, &i.InviterID, &i.InviteeEmail, &i.Code, &i.Role,
			&i.ExpiresAt, &i.CreatedAt, &i.SpaceName, &i.InviterName,
		); err != nil {
			return nil, err
		}
		invites = append(invites, i)
	}
	return invites, rows.Err()
}

// CreateExpense creates a shared expense
func (r *SocialRepository) CreateExpense(ctx context.Context, expense *model.SharedExpense) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	expense.ID = uuid.New()
	query := `
		INSERT INTO shared_expenses (id, space_id, paid_by_user_id, amount, currency, description, 
									category, split_method, receipt_url, notes, expense_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at`

	if err := tx.QueryRow(ctx, query,
		expense.ID, expense.SpaceID, expense.PaidByUserID, expense.Amount, expense.Currency,
		expense.Description, expense.Category, expense.SplitMethod, expense.ReceiptURL,
		expense.Notes, expense.ExpenseDate,
	).Scan(&expense.CreatedAt, &expense.UpdatedAt); err != nil {
		return err
	}

	// Insert splits
	for i := range expense.Splits {
		expense.Splits[i].ID = uuid.New()
		expense.Splits[i].ExpenseID = expense.ID
		_, err := tx.Exec(ctx, `
			INSERT INTO expense_splits (id, expense_id, user_id, amount, percentage, shares, is_paid)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			expense.Splits[i].ID, expense.ID, expense.Splits[i].UserID,
			expense.Splits[i].Amount, expense.Splits[i].Percentage, expense.Splits[i].Shares,
			expense.Splits[i].UserID == expense.PaidByUserID, // Payer's split is auto-paid
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// GetExpense retrieves an expense by ID
func (r *SocialRepository) GetExpense(ctx context.Context, expenseID uuid.UUID) (*model.SharedExpense, error) {
	query := `
		SELECT e.id, e.space_id, e.paid_by_user_id, e.amount, e.currency, e.description,
			   e.category, e.split_method, e.receipt_url, e.notes, e.expense_date,
			   e.created_at, e.updated_at, u.name
		FROM shared_expenses e
		INNER JOIN users u ON u.id = e.paid_by_user_id
		WHERE e.id = $1`

	var expense model.SharedExpense
	err := r.pool.QueryRow(ctx, query, expenseID).Scan(
		&expense.ID, &expense.SpaceID, &expense.PaidByUserID, &expense.Amount, &expense.Currency,
		&expense.Description, &expense.Category, &expense.SplitMethod, &expense.ReceiptURL,
		&expense.Notes, &expense.ExpenseDate, &expense.CreatedAt, &expense.UpdatedAt, &expense.PaidByName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Get splits
	splits, err := r.GetExpenseSplits(ctx, expenseID)
	if err != nil {
		return nil, err
	}
	expense.Splits = splits
	return &expense, nil
}

// GetExpenseSplits gets splits for an expense
func (r *SocialRepository) GetExpenseSplits(ctx context.Context, expenseID uuid.UUID) ([]model.ExpenseSplit, error) {
	query := `
		SELECT s.id, s.expense_id, s.user_id, s.amount, s.percentage, s.shares, s.is_paid, s.paid_at, u.name
		FROM expense_splits s
		INNER JOIN users u ON u.id = s.user_id
		WHERE s.expense_id = $1`

	rows, err := r.pool.Query(ctx, query, expenseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var splits []model.ExpenseSplit
	for rows.Next() {
		var s model.ExpenseSplit
		if err := rows.Scan(
			&s.ID, &s.ExpenseID, &s.UserID, &s.Amount, &s.Percentage, &s.Shares, &s.IsPaid, &s.PaidAt, &s.UserName,
		); err != nil {
			return nil, err
		}
		splits = append(splits, s)
	}
	return splits, rows.Err()
}

// ListSpaceExpenses lists expenses in a space
func (r *SocialRepository) ListSpaceExpenses(ctx context.Context, spaceID uuid.UUID, limit, offset int) ([]model.SharedExpense, int, error) {
	countQuery := `SELECT COUNT(*) FROM shared_expenses WHERE space_id = $1`
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, spaceID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT e.id, e.space_id, e.paid_by_user_id, e.amount, e.currency, e.description,
			   e.category, e.split_method, e.expense_date, e.created_at, u.name
		FROM shared_expenses e
		INNER JOIN users u ON u.id = e.paid_by_user_id
		WHERE e.space_id = $1
		ORDER BY e.expense_date DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.pool.Query(ctx, query, spaceID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var expenses []model.SharedExpense
	for rows.Next() {
		var e model.SharedExpense
		if err := rows.Scan(
			&e.ID, &e.SpaceID, &e.PaidByUserID, &e.Amount, &e.Currency, &e.Description,
			&e.Category, &e.SplitMethod, &e.ExpenseDate, &e.CreatedAt, &e.PaidByName,
		); err != nil {
			return nil, 0, err
		}
		expenses = append(expenses, e)
	}
	return expenses, total, rows.Err()
}

// DeleteExpense deletes an expense
func (r *SocialRepository) DeleteExpense(ctx context.Context, expenseID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM shared_expenses WHERE id = $1", expenseID)
	return err
}

// CreateSettlement creates a settlement record
func (r *SocialRepository) CreateSettlement(ctx context.Context, settlement *model.Settlement) error {
	settlement.ID = uuid.New()
	query := `
		INSERT INTO settlements (id, space_id, from_user_id, to_user_id, amount, currency, method, notes, settled_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at`

	return r.pool.QueryRow(ctx, query,
		settlement.ID, settlement.SpaceID, settlement.FromUserID, settlement.ToUserID,
		settlement.Amount, settlement.Currency, settlement.Method, settlement.Notes, settlement.SettledAt,
	).Scan(&settlement.CreatedAt)
}

// ListSpaceSettlements lists settlements in a space
func (r *SocialRepository) ListSpaceSettlements(ctx context.Context, spaceID uuid.UUID, limit, offset int) ([]model.Settlement, error) {
	query := `
		SELECT s.id, s.space_id, s.from_user_id, s.to_user_id, s.amount, s.currency,
			   s.method, s.notes, s.settled_at, s.confirmed_at, s.created_at,
			   fu.name, tu.name
		FROM settlements s
		INNER JOIN users fu ON fu.id = s.from_user_id
		INNER JOIN users tu ON tu.id = s.to_user_id
		WHERE s.space_id = $1
		ORDER BY s.settled_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.pool.Query(ctx, query, spaceID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settlements []model.Settlement
	for rows.Next() {
		var s model.Settlement
		if err := rows.Scan(
			&s.ID, &s.SpaceID, &s.FromUserID, &s.ToUserID, &s.Amount, &s.Currency,
			&s.Method, &s.Notes, &s.SettledAt, &s.ConfirmedAt, &s.CreatedAt,
			&s.FromUserName, &s.ToUserName,
		); err != nil {
			return nil, err
		}
		settlements = append(settlements, s)
	}
	return settlements, rows.Err()
}

// ConfirmSettlement marks a settlement as confirmed
func (r *SocialRepository) ConfirmSettlement(ctx context.Context, settlementID uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE settlements SET confirmed_at = NOW() WHERE id = $1",
		settlementID)
	return err
}

// GetSettlement retrieves a settlement by ID.
func (r *SocialRepository) GetSettlement(ctx context.Context, settlementID uuid.UUID) (*model.Settlement, error) {
	query := `
		SELECT s.id, s.space_id, s.from_user_id, s.to_user_id, s.amount, s.currency,
			   s.method, s.notes, s.settled_at, s.confirmed_at, s.created_at,
			   fu.name, tu.name
		FROM settlements s
		INNER JOIN users fu ON fu.id = s.from_user_id
		INNER JOIN users tu ON tu.id = s.to_user_id
		WHERE s.id = $1`

	var settlement model.Settlement
	err := r.pool.QueryRow(ctx, query, settlementID).Scan(
		&settlement.ID, &settlement.SpaceID, &settlement.FromUserID, &settlement.ToUserID, &settlement.Amount, &settlement.Currency,
		&settlement.Method, &settlement.Notes, &settlement.SettledAt, &settlement.ConfirmedAt, &settlement.CreatedAt,
		&settlement.FromUserName, &settlement.ToUserName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &settlement, nil
}

// GetBalanceSummary calculates balances for all members in a space
func (r *SocialRepository) GetBalanceSummary(ctx context.Context, spaceID uuid.UUID) (*model.BalanceSummary, error) {
	// Get all members with their balances
	query := `
		WITH expense_totals AS (
			-- Amount each person owes from expense splits
			SELECT s.user_id, SUM(s.amount) as total_owed
			FROM expense_splits s
			INNER JOIN shared_expenses e ON e.id = s.expense_id
			WHERE e.space_id = $1 AND s.is_paid = FALSE AND s.user_id != e.paid_by_user_id
			GROUP BY s.user_id
		),
		paid_totals AS (
			-- Amount each person has paid for others
			SELECT e.paid_by_user_id as user_id, 
				   SUM(s.amount) as total_paid_for_others
			FROM shared_expenses e
			INNER JOIN expense_splits s ON s.expense_id = e.id
			WHERE e.space_id = $1 AND s.user_id != e.paid_by_user_id
			GROUP BY e.paid_by_user_id
		),
		settlement_sent AS (
			SELECT from_user_id as user_id, SUM(amount) as total_sent
			FROM settlements
			WHERE space_id = $1
			GROUP BY from_user_id
		),
		settlement_received AS (
			SELECT to_user_id as user_id, SUM(amount) as total_received
			FROM settlements
			WHERE space_id = $1
			GROUP BY to_user_id
		)
		SELECT m.user_id, u.name,
			   COALESCE(pt.total_paid_for_others, 0) - COALESCE(et.total_owed, 0) + 
			   COALESCE(sr.total_received, 0) - COALESCE(ss.total_sent, 0) as net_balance
		FROM space_members m
		INNER JOIN users u ON u.id = m.user_id
		LEFT JOIN expense_totals et ON et.user_id = m.user_id
		LEFT JOIN paid_totals pt ON pt.user_id = m.user_id
		LEFT JOIN settlement_sent ss ON ss.user_id = m.user_id
		LEFT JOIN settlement_received sr ON sr.user_id = m.user_id
		WHERE m.space_id = $1`

	rows, err := r.pool.Query(ctx, query, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summary := &model.BalanceSummary{SpaceID: spaceID}
	for rows.Next() {
		var mb model.MemberBalance
		if err := rows.Scan(&mb.UserID, &mb.UserName, &mb.Balance); err != nil {
			return nil, err
		}
		summary.Balances = append(summary.Balances, mb)
		if mb.Balance > 0 {
			summary.TotalOwed += mb.Balance
		} else {
			summary.TotalOwes += -mb.Balance
		}
	}
	summary.NetBalance = summary.TotalOwed - summary.TotalOwes
	return summary, rows.Err()
}

// CreateSharedBudget creates a shared budget
func (r *SocialRepository) CreateSharedBudget(ctx context.Context, budget *model.SharedBudget) error {
	budget.ID = uuid.New()
	query := `
		INSERT INTO shared_budgets (id, space_id, name, category, amount, currency, period, start_date, end_date, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at`

	return r.pool.QueryRow(ctx, query,
		budget.ID, budget.SpaceID, budget.Name, budget.Category, budget.Amount,
		budget.Currency, budget.Period, budget.StartDate, budget.EndDate, budget.CreatedBy,
	).Scan(&budget.CreatedAt, &budget.UpdatedAt)
}

// ListSpaceBudgets lists budgets in a space
func (r *SocialRepository) ListSpaceBudgets(ctx context.Context, spaceID uuid.UUID) ([]model.SharedBudget, error) {
	query := `
		SELECT b.id, b.space_id, b.name, b.category, b.amount, b.currency, b.period,
			   b.start_date, b.end_date, b.created_by, b.created_at, b.updated_at,
			   COALESCE(spent.total, 0) as spent
		FROM shared_budgets b
		LEFT JOIN (
			SELECT e.space_id, 
				   CASE WHEN b2.category IS NOT NULL THEN e.category ELSE NULL END as category,
				   SUM(e.amount) as total
			FROM shared_expenses e
			LEFT JOIN shared_budgets b2 ON b2.space_id = e.space_id AND b2.category = e.category
			WHERE e.expense_date >= CURRENT_DATE - INTERVAL '30 days'
			GROUP BY e.space_id, CASE WHEN b2.category IS NOT NULL THEN e.category ELSE NULL END
		) spent ON spent.space_id = b.space_id AND (spent.category = b.category OR (spent.category IS NULL AND b.category IS NULL))
		WHERE b.space_id = $1
		ORDER BY b.name`

	rows, err := r.pool.Query(ctx, query, spaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var budgets []model.SharedBudget
	for rows.Next() {
		var b model.SharedBudget
		if err := rows.Scan(
			&b.ID, &b.SpaceID, &b.Name, &b.Category, &b.Amount, &b.Currency, &b.Period,
			&b.StartDate, &b.EndDate, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt, &b.Spent,
		); err != nil {
			return nil, err
		}
		b.Remaining = b.Amount - b.Spent
		if b.Amount > 0 {
			b.Percentage = b.Spent / b.Amount * 100
		}
		budgets = append(budgets, b)
	}
	return budgets, rows.Err()
}

// CreateActivity logs an activity in a space
func (r *SocialRepository) CreateActivity(ctx context.Context, activity *model.SpaceActivity) error {
	activity.ID = uuid.New()
	query := `
		INSERT INTO space_activities (id, space_id, user_id, type, ref_id, message, data)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING created_at`

	return r.pool.QueryRow(ctx, query,
		activity.ID, activity.SpaceID, activity.UserID, activity.Type,
		activity.RefID, activity.Message, activity.Data,
	).Scan(&activity.CreatedAt)
}

// GetSpaceActivities lists recent activities
func (r *SocialRepository) GetSpaceActivities(ctx context.Context, spaceID uuid.UUID, limit int) ([]model.SpaceActivity, error) {
	query := `
		SELECT a.id, a.space_id, a.user_id, a.type, a.ref_id, a.message, a.data, a.created_at,
			   u.name, u.avatar_url
		FROM space_activities a
		INNER JOIN users u ON u.id = a.user_id
		WHERE a.space_id = $1
		ORDER BY a.created_at DESC
		LIMIT $2`

	rows, err := r.pool.Query(ctx, query, spaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []model.SpaceActivity
	for rows.Next() {
		var a model.SpaceActivity
		var avatarURL *string
		if err := rows.Scan(
			&a.ID, &a.SpaceID, &a.UserID, &a.Type, &a.RefID, &a.Message, &a.Data, &a.CreatedAt,
			&a.UserName, &avatarURL,
		); err != nil {
			return nil, err
		}
		if avatarURL != nil {
			a.AvatarURL = *avatarURL
		}
		activities = append(activities, a)
	}
	return activities, rows.Err()
}

// IsMember checks if a user is a member of a space
func (r *SocialRepository) IsMember(ctx context.Context, spaceID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM space_members WHERE space_id = $1 AND user_id = $2)",
		spaceID, userID).Scan(&exists)
	return exists, err
}

// IsOwnerOrAdmin checks if user is owner or admin
func (r *SocialRepository) IsOwnerOrAdmin(ctx context.Context, spaceID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM space_members WHERE space_id = $1 AND user_id = $2 AND role IN ('owner', 'admin'))",
		spaceID, userID).Scan(&exists)
	return exists, err
}
