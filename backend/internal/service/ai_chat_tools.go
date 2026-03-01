package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
)

// executeToolWithTrace executes a tool call and emits trace events for observability.
func (s *AIChatService) executeToolWithTrace(
	ctx context.Context,
	userID uuid.UUID,
	currency string,
	conversationID string,
	tc *ToolCall,
	onTrace chatTraceCallback,
	logContext string,
	toolUsageTracker *chatToolUsageTracker,
) string {
	toolUsageTracker.add(tc.Name)
	toolStartedAt := time.Now()
	result, execErr := s.toolExecutor.Execute(ctx, userID, currency, tc)
	if execErr != nil {
		log.Warn().
			Err(execErr).
			Str("tool", tc.Name).
			Str("user_id", userID.String()).
			Str("context", logContext).
			Str("error_type", fmt.Sprintf("%T", execErr)).
			Msg("Tool execution failed")
		result = fmt.Sprintf("Tool '%s' failed: %v. Please answer based on the available context.", tc.Name, execErr)
		emitChatTrace(ctx, userID, conversationID, "tool_execution_failed", map[string]interface{}{
			"tool":        tc.Name,
			"tool_args":   tc.Params,
			"duration_ms": time.Since(toolStartedAt).Milliseconds(),
			"error":       execErr.Error(),
		}, onTrace)
		return result
	}

	emitChatTrace(ctx, userID, conversationID, "tool_execution_completed", map[string]interface{}{
		"tool":        tc.Name,
		"tool_args":   tc.Params,
		"duration_ms": time.Since(toolStartedAt).Milliseconds(),
		"result_size": len(result),
	}, onTrace)
	return result
}

// resolveToolCalls runs the LLM and resolves any tool calls (max 3 iterations)
func (s *AIChatService) resolveToolCalls(
	ctx context.Context,
	llm llms.Model,
	messages []llms.MessageContent,
	userID uuid.UUID,
	currency string,
	conversationID string,
	onTrace chatTraceCallback,
	usageTracker *chatUsageTracker,
	toolUsageTracker *chatToolUsageTracker,
) (string, error) {
	return s.resolveToolCallsWithLimit(ctx, llm, messages, userID, currency, conversationID, onTrace, 3, usageTracker, toolUsageTracker)
}

func (s *AIChatService) resolveToolCallsWithLimit(
	ctx context.Context,
	llm llms.Model,
	messages []llms.MessageContent,
	userID uuid.UUID,
	currency string,
	conversationID string,
	onTrace chatTraceCallback,
	maxIterations int,
	usageTracker *chatUsageTracker,
	toolUsageTracker *chatToolUsageTracker,
) (string, error) {
	for i := 0; i < maxIterations; i++ {
		iterationStartedAt := time.Now()
		response, err := llm.GenerateContent(ctx, messages)
		if err != nil {
			emitChatTrace(ctx, userID, conversationID, "llm_iteration_failed", map[string]interface{}{
				"iteration": i + 1,
				"error":     err.Error(),
			}, onTrace)
			return "", fmt.Errorf("generating content: %w", err)
		}
		if usageTracker != nil {
			usageTracker.addResponse(response)
		}
		if len(response.Choices) == 0 {
			emitChatTrace(ctx, userID, conversationID, "llm_iteration_failed", map[string]interface{}{
				"iteration": i + 1,
				"error":     errNoAIResponse.Error(),
			}, onTrace)
			return "", errNoAIResponse
		}

		text := response.Choices[0].Content
		tc := parseToolCall(text)
		emitChatTrace(ctx, userID, conversationID, "llm_iteration_completed", map[string]interface{}{
			"iteration":       i + 1,
			"duration_ms":     time.Since(iterationStartedAt).Milliseconds(),
			"tool_call_found": tc != nil,
		}, onTrace)

		if tc == nil {
			// No tool call — return the final response
			return stripToolCallMarkers(text), nil
		}

		// Execute the tool
		result := s.executeToolWithTrace(ctx, userID, currency, conversationID, tc, onTrace, "resolve_tool_calls", toolUsageTracker)

		// Append the AI response and tool result to messages for the next iteration
		messages = append(messages, llms.MessageContent{
			Parts: []llms.ContentPart{llms.TextPart(text)},
			Role:  llms.ChatMessageTypeAI,
		})
		messages = appendToolResultMessage(messages, tc.Name, result)
	}

	// If we exhausted iterations, make one final call
	response, err := llm.GenerateContent(ctx, messages)
	if err != nil {
		emitChatTrace(ctx, userID, conversationID, "llm_final_failed", map[string]interface{}{
			"error": err.Error(),
		}, onTrace)
		return "", fmt.Errorf("generating final content: %w", err)
	}
	if usageTracker != nil {
		usageTracker.addResponse(response)
	}
	if len(response.Choices) == 0 {
		emitChatTrace(ctx, userID, conversationID, "llm_final_failed", map[string]interface{}{
			"error": errNoAIResponse.Error(),
		}, onTrace)
		return "", errNoAIResponse
	}
	emitChatTrace(ctx, userID, conversationID, "llm_final_completed", map[string]interface{}{
		"response_length": len(response.Choices[0].Content),
	}, onTrace)
	return stripToolCallMarkers(response.Choices[0].Content), nil
}

func buildToolResultPrompt(toolName, result string) string {
	return fmt.Sprintf(
		"Tool '%s' returned:\n%s\n\nNow provide your final answer to the user based on this data. Keep a natural personal-advisor tone. Do not use tables in the main body; only an optional final Summary table if needed.",
		toolName,
		result,
	)
}

func appendToolResultMessage(messages []llms.MessageContent, toolName, result string) []llms.MessageContent {
	return append(messages, llms.MessageContent{
		Parts: []llms.ContentPart{llms.TextPart(buildToolResultPrompt(toolName, result))},
		Role:  llms.ChatMessageTypeHuman,
	})
}
