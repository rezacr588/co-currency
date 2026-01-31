package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// NoteService handles business logic for notes
type NoteService struct {
	noteRepo   *repository.NoteRepository
	walletRepo *repository.WalletRepository
}

// NewNoteService creates a new NoteService
func NewNoteService(noteRepo *repository.NoteRepository, walletRepo *repository.WalletRepository) *NoteService {
	return &NoteService{
		noteRepo:   noteRepo,
		walletRepo: walletRepo,
	}
}

// GetNotes retrieves all notes for a user
func (s *NoteService) GetNotes(ctx context.Context, userID uuid.UUID) ([]model.Note, error) {
	notes, err := s.noteRepo.GetByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting notes: %w", err)
	}

	if notes == nil {
		notes = []model.Note{}
	}

	return notes, nil
}

// GetNote retrieves a specific note
func (s *NoteService) GetNote(ctx context.Context, userID, noteID uuid.UUID) (*model.Note, error) {
	note, err := s.noteRepo.GetByID(ctx, userID, noteID)
	if err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			return nil, repository.ErrNoteNotFound
		}
		return nil, fmt.Errorf("getting note: %w", err)
	}
	return note, nil
}

// CreateNote creates a new note
func (s *NoteService) CreateNote(ctx context.Context, userID uuid.UUID, req *model.CreateNoteRequest) (*model.Note, error) {
	// Validate request
	if req.Title == "" {
		return nil, errors.New("title is required")
	}

	// Validate color if provided
	if req.Color != "" && !isValidColor(req.Color) {
		return nil, errors.New("invalid color")
	}

	note := &model.Note{
		UserID:   userID,
		Title:    req.Title,
		Content:  req.Content,
		Color:    req.Color,
		IsPinned: req.IsPinned,
	}

	// Parse and validate transaction ID if provided
	if req.TransactionID != nil && *req.TransactionID != "" {
		txID, err := uuid.Parse(*req.TransactionID)
		if err != nil {
			return nil, errors.New("invalid transaction ID")
		}
		// Verify transaction belongs to user
		if s.walletRepo != nil {
			tx, err := s.walletRepo.GetTransaction(ctx, userID, txID)
			if err != nil || tx == nil {
				return nil, errors.New("transaction not found or does not belong to user")
			}
		}
		note.TransactionID = &txID
	}

	if err := s.noteRepo.Create(ctx, note); err != nil {
		return nil, fmt.Errorf("creating note: %w", err)
	}

	return note, nil
}

// UpdateNote updates an existing note
func (s *NoteService) UpdateNote(ctx context.Context, userID, noteID uuid.UUID, req *model.UpdateNoteRequest) (*model.Note, error) {
	// Get existing note
	note, err := s.noteRepo.GetByID(ctx, userID, noteID)
	if err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			return nil, repository.ErrNoteNotFound
		}
		return nil, fmt.Errorf("getting note: %w", err)
	}

	// Apply updates
	if req.Title != nil {
		if *req.Title == "" {
			return nil, errors.New("title cannot be empty")
		}
		note.Title = *req.Title
	}
	if req.Content != nil {
		note.Content = *req.Content
	}
	if req.Color != nil {
		if *req.Color != "" && !isValidColor(*req.Color) {
			return nil, errors.New("invalid color")
		}
		note.Color = *req.Color
	}
	if req.IsPinned != nil {
		note.IsPinned = *req.IsPinned
	}
	if req.TransactionID != nil {
		if *req.TransactionID == "" {
			note.TransactionID = nil
		} else {
			txID, err := uuid.Parse(*req.TransactionID)
			if err != nil {
				return nil, errors.New("invalid transaction ID")
			}
			// Verify transaction belongs to user
			if s.walletRepo != nil {
				tx, err := s.walletRepo.GetTransaction(ctx, userID, txID)
				if err != nil || tx == nil {
					return nil, errors.New("transaction not found or does not belong to user")
				}
			}
			note.TransactionID = &txID
		}
	}

	if err := s.noteRepo.Update(ctx, note); err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			return nil, repository.ErrNoteNotFound
		}
		return nil, fmt.Errorf("updating note: %w", err)
	}

	return note, nil
}

// DeleteNote deletes a note
func (s *NoteService) DeleteNote(ctx context.Context, userID, noteID uuid.UUID) error {
	if err := s.noteRepo.Delete(ctx, userID, noteID); err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			return repository.ErrNoteNotFound
		}
		return fmt.Errorf("deleting note: %w", err)
	}
	return nil
}

// SearchNotes searches notes by title or content
func (s *NoteService) SearchNotes(ctx context.Context, userID uuid.UUID, query string) ([]model.Note, error) {
	if query == "" {
		return s.GetNotes(ctx, userID)
	}

	notes, err := s.noteRepo.Search(ctx, userID, query)
	if err != nil {
		return nil, fmt.Errorf("searching notes: %w", err)
	}

	if notes == nil {
		notes = []model.Note{}
	}

	return notes, nil
}

// TogglePin toggles the pinned status of a note
func (s *NoteService) TogglePin(ctx context.Context, userID, noteID uuid.UUID) (*model.Note, error) {
	note, err := s.noteRepo.TogglePin(ctx, userID, noteID)
	if err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			return nil, repository.ErrNoteNotFound
		}
		return nil, fmt.Errorf("toggling note pin: %w", err)
	}
	return note, nil
}

// GetNotesByTransaction retrieves notes linked to a specific transaction
func (s *NoteService) GetNotesByTransaction(ctx context.Context, userID, transactionID uuid.UUID) ([]model.Note, error) {
	notes, err := s.noteRepo.GetByTransaction(ctx, userID, transactionID)
	if err != nil {
		return nil, fmt.Errorf("getting notes by transaction: %w", err)
	}

	if notes == nil {
		notes = []model.Note{}
	}

	return notes, nil
}

// isValidColor checks if the color is in the allowed list
func isValidColor(color string) bool {
	for _, c := range model.NoteColors {
		if c == color {
			return true
		}
	}
	return false
}
