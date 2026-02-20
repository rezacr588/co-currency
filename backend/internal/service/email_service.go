package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/resend/resend-go/v2"
	"github.com/rs/zerolog/log"
)

type EmailService struct {
	client      *resend.Client
	frontendURL string
	senderEmail string
}

func NewEmailService(apiKey string, frontendURL string) *EmailService {
	// If no API key is provided, we simulate the email service.
	var client *resend.Client
	if apiKey != "" {
		client = resend.NewClient(apiKey)
	}

	return &EmailService{
		client:      client,
		frontendURL: frontendURL,
		senderEmail: "support@cofinance.app", // Adjust if you have a verified domain via Resend
	}
}

func (s *EmailService) SendPasswordResetEmail(ctx context.Context, toEmail, token string) error {
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", strings.TrimRight(s.frontendURL, "/"), token)

	// Simulate email sending if no client is configured.
	if s.client == nil {
		log.Info().
			Str("to", toEmail).
			Str("link", resetLink).
			Msg("Simulated Email Sent (Configured without Resend API Key)")
		return nil
	}

	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("Co-Finance Support <%s>", s.senderEmail),
		To:      []string{toEmail},
		Subject: "Reset Your Password - Co-Finance",
		Html: fmt.Sprintf(`
			<h1>Password Reset Request</h1>
			<p>You requested a password reset for your Co-Finance account.</p>
			<p>Click the link below to set a new password:</p>
			<a href="%s" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
			<p>If you did not request this, please ignore this email.</p>
			<p>This link will expire in 15 minutes.</p>
		`, resetLink),
	}

	_, err := s.client.Emails.SendWithContext(ctx, params)
	if err != nil {
		log.Error().Err(err).Str("to", toEmail).Msg("Failed to send password reset email via Resend")
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Info().Str("to", toEmail).Msg("Password reset email sent successfully via Resend")
	return nil
}
