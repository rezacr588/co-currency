package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
)

// TagService handles business logic for tags
type TagService struct {
	tagRepo *repository.TagRepository
}

// NewTagService creates a new TagService
func NewTagService(tagRepo *repository.TagRepository) *TagService {
	return &TagService{
		tagRepo: tagRepo,
	}
}

// GetTags retrieves all tags for a user
func (s *TagService) GetTags(ctx context.Context, userID uuid.UUID) ([]model.Tag, error) {
	tags, err := s.tagRepo.GetByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("getting tags: %w", err)
	}

	if tags == nil {
		tags = []model.Tag{}
	}

	return tags, nil
}

// CreateTag creates a new tag
func (s *TagService) CreateTag(ctx context.Context, userID uuid.UUID, req *model.CreateTagRequest) (*model.Tag, error) {
	if req.Name == "" {
		return nil, errors.New("name is required")
	}

	tag := &model.Tag{
		UserID: userID,
		Name:   req.Name,
		Color:  req.Color,
	}

	if err := s.tagRepo.Create(ctx, tag); err != nil {
		if errors.Is(err, repository.ErrTagExists) {
			return nil, errors.New("tag already exists")
		}
		return nil, fmt.Errorf("creating tag: %w", err)
	}

	return tag, nil
}

// DeleteTag deletes a tag
func (s *TagService) DeleteTag(ctx context.Context, userID, tagID uuid.UUID) error {
	if err := s.tagRepo.Delete(ctx, userID, tagID); err != nil {
		if errors.Is(err, repository.ErrTagNotFound) {
			return errors.New("tag not found")
		}
		return fmt.Errorf("deleting tag: %w", err)
	}
	return nil
}

// GetTagsForTransaction retrieves tags for a transaction
func (s *TagService) GetTagsForTransaction(ctx context.Context, transactionID uuid.UUID) ([]model.Tag, error) {
	tags, err := s.tagRepo.GetTagsForTransaction(ctx, transactionID)
	if err != nil {
		return nil, fmt.Errorf("getting transaction tags: %w", err)
	}

	if tags == nil {
		tags = []model.Tag{}
	}

	return tags, nil
}
