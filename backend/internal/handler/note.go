package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/service"
	"github.com/rezacr588/currency-converter/pkg/httputil"
)

// NoteHandler handles note endpoints
type NoteHandler struct {
	noteService *service.NoteService
}

// NewNoteHandler creates a new NoteHandler
func NewNoteHandler(noteService *service.NoteService) *NoteHandler {
	return &NoteHandler{noteService: noteService}
}

// GetNotes handles GET /api/v1/notes
func (h *NoteHandler) GetNotes(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Check for search query
	query := r.URL.Query().Get("q")
	var notes []model.Note
	var err error

	if query != "" {
		notes, err = h.noteService.SearchNotes(r.Context(), userID, query)
	} else {
		notes, err = h.noteService.GetNotes(r.Context(), userID)
	}

	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get notes")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"notes": notes,
	})
}

// GetNote handles GET /api/v1/notes/{id}
func (h *NoteHandler) GetNote(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	noteIDStr := chi.URLParam(r, "id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid note ID")
		return
	}

	note, err := h.noteService.GetNote(r.Context(), userID, noteID)
	if err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "note not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get note")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"note": note,
	})
}

// CreateNote handles POST /api/v1/notes
func (h *NoteHandler) CreateNote(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req model.CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	note, err := h.noteService.CreateNote(r.Context(), userID, &req)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, err.Error())
		return
	}

	httputil.Created(w, map[string]interface{}{
		"note": note,
	})
}

// UpdateNote handles PUT /api/v1/notes/{id}
func (h *NoteHandler) UpdateNote(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	noteIDStr := chi.URLParam(r, "id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid note ID")
		return
	}

	var req model.UpdateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid request body")
		return
	}

	note, err := h.noteService.UpdateNote(r.Context(), userID, noteID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "note not found")
			return
		}
		httputil.BadRequestWithContext(r.Context(), w, err.Error())
		return
	}

	httputil.Success(w, map[string]interface{}{
		"note": note,
	})
}

// DeleteNote handles DELETE /api/v1/notes/{id}
func (h *NoteHandler) DeleteNote(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	noteIDStr := chi.URLParam(r, "id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid note ID")
		return
	}

	if err := h.noteService.DeleteNote(r.Context(), userID, noteID); err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "note not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to delete note")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"message": "note deleted successfully",
	})
}

// TogglePin handles POST /api/v1/notes/{id}/pin
func (h *NoteHandler) TogglePin(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	noteIDStr := chi.URLParam(r, "id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid note ID")
		return
	}

	note, err := h.noteService.TogglePin(r.Context(), userID, noteID)
	if err != nil {
		if errors.Is(err, repository.ErrNoteNotFound) {
			httputil.NotFoundWithContext(r.Context(), w, "note not found")
			return
		}
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to toggle pin")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"note": note,
	})
}

// GetColors handles GET /api/v1/notes/colors
func (h *NoteHandler) GetColors(w http.ResponseWriter, r *http.Request) {
	httputil.Success(w, map[string]interface{}{
		"colors": model.NoteColors,
	})
}

// GetNotesByTransaction handles GET /api/v1/notes/transaction/{transactionId}
func (h *NoteHandler) GetNotesByTransaction(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	transactionIDStr := chi.URLParam(r, "transactionId")
	transactionID, err := uuid.Parse(transactionIDStr)
	if err != nil {
		httputil.BadRequestWithContext(r.Context(), w, "invalid transaction ID")
		return
	}

	notes, err := h.noteService.GetNotesByTransaction(r.Context(), userID, transactionID)
	if err != nil {
		httputil.InternalServerErrorWithContext(r.Context(), w, "failed to get notes")
		return
	}

	httputil.Success(w, map[string]interface{}{
		"notes": notes,
	})
}
