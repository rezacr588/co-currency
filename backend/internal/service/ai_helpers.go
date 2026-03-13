package service

import "strings"

// cleanAIJSON strips markdown code fences and extracts the first JSON object
// from an AI response. This avoids duplicating the cleanup logic across every
// parsing function.
func cleanAIJSON(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)

	if start := strings.Index(s, "{"); start != -1 {
		if end := strings.LastIndex(s, "}"); end > start {
			return s[start : end+1]
		}
	}
	return s
}
