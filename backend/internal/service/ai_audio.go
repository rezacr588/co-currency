package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

// TranscribeAudio transcribes audio using Groq's Whisper API.
func (s *AIService) TranscribeAudio(ctx context.Context, audioData []byte, mimeType string) (string, error) {
	if s.provider != "groq" {
		return "", fmt.Errorf("audio transcription requires Groq provider (current: %s)", s.provider)
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if err := writer.WriteField("model", "whisper-large-v3"); err != nil {
		return "", fmt.Errorf("writing model field: %w", err)
	}

	ext := "m4a"
	if strings.Contains(mimeType, "wav") {
		ext = "wav"
	} else if strings.Contains(mimeType, "mp3") || strings.Contains(mimeType, "mpeg") {
		ext = "mp3"
	} else if strings.Contains(mimeType, "webm") {
		ext = "webm"
	}
	part, err := writer.CreateFormFile("file", "audio."+ext)
	if err != nil {
		return "", fmt.Errorf("creating form file: %w", err)
	}
	if _, err := part.Write(audioData); err != nil {
		return "", fmt.Errorf("writing audio data: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("closing writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.groq.com/openai/v1/audio/transcriptions", body)
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("transcription request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", fmt.Errorf("transcription API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("parsing transcription response: %w", err)
	}

	return result.Text, nil
}
