package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// SocialService handles shared spaces and collaborative finance
type SocialService struct {
	repo *repository.SocialRepository
}

// NewSocialService creates a new social service
func NewSocialService(repo *repository.SocialRepository) *SocialService {
	return &SocialService{repo: repo}
}

// CreateSpace creates a new shared space and adds creator as owner
func (s *SocialService) CreateSpace(ctx context.Context, userID uuid.UUID, req *model.CreateSpaceRequest) (*model.SharedSpace, error) {
	// Set defaults
	if req.Settings.DefaultSplitMethod == "" {
		req.Settings.DefaultSplitMethod = "equal"
	}

	space := &model.SharedSpace{
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Currency:    req.Currency,
		IconEmoji:   req.IconEmoji,
		Settings:    req.Settings,
		CreatedBy:   userID,
	}

	if err := s.repo.CreateSpace(ctx, space); err != nil {
		return nil, fmt.Errorf("create space: %w", err)
	}

	// Add creator as owner
	member := &model.SpaceMember{
		SpaceID: space.ID,
		UserID:  userID,
		Role:    model.SpaceRoleOwner,
	}
	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, fmt.Errorf("add owner: %w", err)
	}

	// Log activity
	s.logActivity(ctx, space.ID, userID, "space_created", space.ID, fmt.Sprintf("Created space \"%s\"", space.Name), nil)

	space.MemberCount = 1
	return space, nil
}

// GetSpace retrieves a space with access check
func (s *SocialService) GetSpace(ctx context.Context, userID, spaceID uuid.UUID) (*model.SharedSpace, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member of this space")
	}

	space, err := s.repo.GetSpace(ctx, spaceID)
	if err != nil {
		return nil, err
	}
	if space == nil {
		return nil, errors.New("space not found")
	}

	// Get members
	members, err := s.repo.GetSpaceMembers(ctx, spaceID)
	if err != nil {
		return nil, err
	}
	space.Members = members
	return space, nil
}

// GetUserSpaces lists all spaces for a user
func (s *SocialService) GetUserSpaces(ctx context.Context, userID uuid.UUID) ([]model.SharedSpace, error) {
	return s.repo.GetUserSpaces(ctx, userID)
}

// UpdateSpace updates a space (owner/admin only)
func (s *SocialService) UpdateSpace(ctx context.Context, userID, spaceID uuid.UUID, name, description, iconEmoji string, settings model.SpaceSettings) error {
	isAdmin, err := s.repo.IsOwnerOrAdmin(ctx, spaceID, userID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return errors.New("only owner or admin can update space")
	}

	space := &model.SharedSpace{
		ID:          spaceID,
		Name:        name,
		Description: description,
		IconEmoji:   iconEmoji,
		Settings:    settings,
	}
	return s.repo.UpdateSpace(ctx, space)
}

// DeleteSpace deletes a space (owner only)
func (s *SocialService) DeleteSpace(ctx context.Context, userID, spaceID uuid.UUID) error {
	member, err := s.repo.GetMember(ctx, spaceID, userID)
	if err != nil {
		return err
	}
	if member == nil || member.Role != model.SpaceRoleOwner {
		return errors.New("only owner can delete space")
	}
	return s.repo.DeleteSpace(ctx, spaceID)
}

// InviteMember invites someone to a space
func (s *SocialService) InviteMember(ctx context.Context, userID, spaceID uuid.UUID, email string, role model.SpaceRole) (*model.SpaceInvite, error) {
	// Check permission
	isAdmin, err := s.repo.IsOwnerOrAdmin(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}

	space, err := s.repo.GetSpace(ctx, spaceID)
	if err != nil {
		return nil, err
	}

	if !isAdmin && !space.Settings.AllowMemberInvites {
		return nil, errors.New("only admins can invite members")
	}

	// Prevent inviting as owner
	if role == model.SpaceRoleOwner {
		role = model.SpaceRoleAdmin
	}

	invite := &model.SpaceInvite{
		SpaceID:      spaceID,
		InviterID:    userID,
		InviteeEmail: email,
		Role:         role,
	}

	if err := s.repo.CreateInvite(ctx, invite); err != nil {
		return nil, err
	}

	s.logActivity(ctx, spaceID, userID, "member_invited", invite.ID, fmt.Sprintf("Invited %s to join", email), nil)
	return invite, nil
}

// AcceptInvite accepts an invitation
func (s *SocialService) AcceptInvite(ctx context.Context, userID uuid.UUID, code string) (*model.SharedSpace, error) {
	invite, err := s.repo.GetInviteByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if invite == nil {
		return nil, errors.New("invite not found")
	}
	if invite.AcceptedAt != nil {
		return nil, errors.New("invite already accepted")
	}
	if invite.RejectedAt != nil {
		return nil, errors.New("invite was rejected")
	}
	if time.Now().After(invite.ExpiresAt) {
		return nil, errors.New("invite expired")
	}

	// Check if already a member
	isMember, err := s.repo.IsMember(ctx, invite.SpaceID, userID)
	if err != nil {
		return nil, err
	}
	if isMember {
		return nil, errors.New("already a member")
	}

	// Add member
	member := &model.SpaceMember{
		SpaceID:   invite.SpaceID,
		UserID:    userID,
		Role:      invite.Role,
		InvitedBy: invite.InviterID,
	}
	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	// Mark invite as accepted
	if err := s.repo.AcceptInvite(ctx, invite.ID); err != nil {
		return nil, err
	}

	s.logActivity(ctx, invite.SpaceID, userID, "member_joined", member.ID, "Joined the space", nil)

	return s.GetSpace(ctx, userID, invite.SpaceID)
}

// GetPendingInvites gets pending invites for a user
func (s *SocialService) GetPendingInvites(ctx context.Context, email string) ([]model.SpaceInvite, error) {
	return s.repo.GetPendingInvites(ctx, email)
}

// LeaveSpace removes the user from a space
func (s *SocialService) LeaveSpace(ctx context.Context, userID, spaceID uuid.UUID) error {
	member, err := s.repo.GetMember(ctx, spaceID, userID)
	if err != nil {
		return err
	}
	if member == nil {
		return errors.New("not a member")
	}
	if member.Role == model.SpaceRoleOwner {
		return errors.New("owner cannot leave; transfer ownership or delete space")
	}

	s.logActivity(ctx, spaceID, userID, "member_left", member.ID, "Left the space", nil)
	return s.repo.RemoveMember(ctx, spaceID, userID)
}

// RemoveMember removes a member (admin only)
func (s *SocialService) RemoveMember(ctx context.Context, adminID, spaceID, targetUserID uuid.UUID) error {
	isAdmin, err := s.repo.IsOwnerOrAdmin(ctx, spaceID, adminID)
	if err != nil {
		return err
	}
	if !isAdmin {
		return errors.New("only admin can remove members")
	}

	target, err := s.repo.GetMember(ctx, spaceID, targetUserID)
	if err != nil {
		return err
	}
	if target == nil {
		return errors.New("member not found")
	}
	if target.Role == model.SpaceRoleOwner {
		return errors.New("cannot remove owner")
	}

	s.logActivity(ctx, spaceID, adminID, "member_removed", target.ID, fmt.Sprintf("Removed %s from the space", target.UserName), nil)
	return s.repo.RemoveMember(ctx, spaceID, targetUserID)
}

// AddExpense adds a shared expense
func (s *SocialService) AddExpense(ctx context.Context, userID, spaceID uuid.UUID, req *model.CreateExpenseRequest) (*model.SharedExpense, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}

	// Get space for currency
	space, err := s.repo.GetSpace(ctx, spaceID)
	if err != nil {
		return nil, err
	}

	// Default currency to space currency
	if req.Currency == "" {
		req.Currency = space.Currency
	}

	// Calculate splits
	members, err := s.repo.GetSpaceMembers(ctx, spaceID)
	if err != nil {
		return nil, err
	}

	var splits []model.ExpenseSplit
	switch req.SplitMethod {
	case "equal":
		splitAmount := req.Amount / float64(len(members))
		for _, m := range members {
			splits = append(splits, model.ExpenseSplit{
				UserID:  m.UserID,
				Amount:  splitAmount,
				IsPaid:  m.UserID == userID,
			})
		}
	case "percentage", "shares", "exact":
		// Use provided splits
		for _, rs := range req.Splits {
			splits = append(splits, model.ExpenseSplit{
				UserID:     rs.UserID,
				Amount:     rs.Amount,
				Percentage: rs.Percentage,
				Shares:     rs.Shares,
				IsPaid:     rs.UserID == userID,
			})
		}
	default:
		return nil, errors.New("invalid split method")
	}

	expense := &model.SharedExpense{
		SpaceID:      spaceID,
		PaidByUserID: userID,
		Amount:       req.Amount,
		Currency:     req.Currency,
		Description:  req.Description,
		Category:     req.Category,
		SplitMethod:  req.SplitMethod,
		Splits:       splits,
		ReceiptURL:   req.ReceiptURL,
		Notes:        req.Notes,
		ExpenseDate:  req.ExpenseDate,
	}

	if expense.ExpenseDate.IsZero() {
		expense.ExpenseDate = time.Now()
	}

	if err := s.repo.CreateExpense(ctx, expense); err != nil {
		return nil, err
	}

	s.logActivity(ctx, spaceID, userID, "expense_added", expense.ID, 
		fmt.Sprintf("Added expense: %s (%.2f %s)", req.Description, req.Amount, req.Currency), nil)

	return expense, nil
}

// GetExpense retrieves an expense
func (s *SocialService) GetExpense(ctx context.Context, userID, expenseID uuid.UUID) (*model.SharedExpense, error) {
	expense, err := s.repo.GetExpense(ctx, expenseID)
	if err != nil {
		return nil, err
	}
	if expense == nil {
		return nil, errors.New("expense not found")
	}

	isMember, err := s.repo.IsMember(ctx, expense.SpaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}
	return expense, nil
}

// ListExpenses lists expenses in a space
func (s *SocialService) ListExpenses(ctx context.Context, userID, spaceID uuid.UUID, limit, offset int) ([]model.SharedExpense, int, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, 0, err
	}
	if !isMember {
		return nil, 0, errors.New("not a member")
	}
	return s.repo.ListSpaceExpenses(ctx, spaceID, limit, offset)
}

// DeleteExpense deletes an expense
func (s *SocialService) DeleteExpense(ctx context.Context, userID, expenseID uuid.UUID) error {
	expense, err := s.repo.GetExpense(ctx, expenseID)
	if err != nil {
		return err
	}
	if expense == nil {
		return errors.New("expense not found")
	}

	// Only payer or admin can delete
	if expense.PaidByUserID != userID {
		isAdmin, err := s.repo.IsOwnerOrAdmin(ctx, expense.SpaceID, userID)
		if err != nil {
			return err
		}
		if !isAdmin {
			return errors.New("only payer or admin can delete expense")
		}
	}

	s.logActivity(ctx, expense.SpaceID, userID, "expense_deleted", expense.ID,
		fmt.Sprintf("Deleted expense: %s", expense.Description), nil)
	return s.repo.DeleteExpense(ctx, expenseID)
}

// RecordSettlement records a settlement between members
func (s *SocialService) RecordSettlement(ctx context.Context, userID, spaceID uuid.UUID, req *model.CreateSettlementRequest) (*model.Settlement, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}

	// Verify recipient is also a member
	isMember, err = s.repo.IsMember(ctx, spaceID, req.ToUserID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("recipient is not a member")
	}

	space, err := s.repo.GetSpace(ctx, spaceID)
	if err != nil {
		return nil, err
	}

	if req.Currency == "" {
		req.Currency = space.Currency
	}

	settlement := &model.Settlement{
		SpaceID:    spaceID,
		FromUserID: userID,
		ToUserID:   req.ToUserID,
		Amount:     req.Amount,
		Currency:   req.Currency,
		Method:     req.Method,
		Notes:      req.Notes,
		SettledAt:  time.Now(),
	}

	if err := s.repo.CreateSettlement(ctx, settlement); err != nil {
		return nil, err
	}

	s.logActivity(ctx, spaceID, userID, "settlement_recorded", settlement.ID,
		fmt.Sprintf("Recorded settlement of %.2f %s", req.Amount, req.Currency), nil)

	return settlement, nil
}

// ConfirmSettlement confirms a settlement was received
func (s *SocialService) ConfirmSettlement(ctx context.Context, userID, settlementID uuid.UUID) error {
	// Only the recipient can confirm
	// (Would need to add GetSettlement method to verify)
	return s.repo.ConfirmSettlement(ctx, settlementID)
}

// ListSettlements lists settlements in a space
func (s *SocialService) ListSettlements(ctx context.Context, userID, spaceID uuid.UUID, limit, offset int) ([]model.Settlement, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}
	return s.repo.ListSpaceSettlements(ctx, spaceID, limit, offset)
}

// GetBalances gets balance summary for a space
func (s *SocialService) GetBalances(ctx context.Context, userID, spaceID uuid.UUID) (*model.BalanceSummary, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}

	summary, err := s.repo.GetBalanceSummary(ctx, spaceID)
	if err != nil {
		return nil, err
	}

	// Generate simplified settlements
	summary.Simplify = s.simplifyDebts(summary.Balances)
	return summary, nil
}

// simplifyDebts calculates minimum number of transactions to settle all debts
func (s *SocialService) simplifyDebts(balances []model.MemberBalance) []model.Settlement {
	// Find creditors (positive balance) and debtors (negative balance)
	var creditors, debtors []model.MemberBalance
	for _, b := range balances {
		if b.Balance > 0.01 {
			creditors = append(creditors, b)
		} else if b.Balance < -0.01 {
			debtors = append(debtors, model.MemberBalance{
				UserID:   b.UserID,
				UserName: b.UserName,
				Balance:  -b.Balance, // Make positive for easier calculation
			})
		}
	}

	var settlements []model.Settlement
	
	// Greedy algorithm to simplify debts
	for len(creditors) > 0 && len(debtors) > 0 {
		c := &creditors[0]
		d := &debtors[0]

		amount := c.Balance
		if d.Balance < amount {
			amount = d.Balance
		}

		settlements = append(settlements, model.Settlement{
			FromUserID:   d.UserID,
			ToUserID:     c.UserID,
			Amount:       amount,
			FromUserName: d.UserName,
			ToUserName:   c.UserName,
		})

		c.Balance -= amount
		d.Balance -= amount

		if c.Balance < 0.01 {
			creditors = creditors[1:]
		}
		if d.Balance < 0.01 {
			debtors = debtors[1:]
		}
	}

	return settlements
}

// CreateBudget creates a shared budget
func (s *SocialService) CreateBudget(ctx context.Context, userID, spaceID uuid.UUID, name, category, currency string, amount float64, period string, startDate time.Time) (*model.SharedBudget, error) {
	isAdmin, err := s.repo.IsOwnerOrAdmin(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isAdmin {
		return nil, errors.New("only admin can create budgets")
	}

	budget := &model.SharedBudget{
		SpaceID:   spaceID,
		Name:      name,
		Category:  category,
		Amount:    amount,
		Currency:  currency,
		Period:    period,
		StartDate: startDate,
		CreatedBy: userID,
	}

	if err := s.repo.CreateSharedBudget(ctx, budget); err != nil {
		return nil, err
	}

	s.logActivity(ctx, spaceID, userID, "budget_created", budget.ID,
		fmt.Sprintf("Created budget: %s (%.2f %s)", name, amount, currency), nil)

	return budget, nil
}

// ListBudgets lists budgets in a space
func (s *SocialService) ListBudgets(ctx context.Context, userID, spaceID uuid.UUID) ([]model.SharedBudget, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}
	return s.repo.ListSpaceBudgets(ctx, spaceID)
}

// GetActivities gets recent activities in a space
func (s *SocialService) GetActivities(ctx context.Context, userID, spaceID uuid.UUID, limit int) ([]model.SpaceActivity, error) {
	isMember, err := s.repo.IsMember(ctx, spaceID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("not a member")
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return s.repo.GetSpaceActivities(ctx, spaceID, limit)
}

// logActivity logs an activity (fire and forget)
func (s *SocialService) logActivity(ctx context.Context, spaceID, userID uuid.UUID, actType string, refID uuid.UUID, message string, data map[string]interface{}) {
	activity := &model.SpaceActivity{
		SpaceID: spaceID,
		UserID:  userID,
		Type:    actType,
		RefID:   refID,
		Message: message,
		Data:    data,
	}
	_ = s.repo.CreateActivity(ctx, activity)
}
