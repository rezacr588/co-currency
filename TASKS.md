# AI Chat Fix Tasks

## Backend
- [x] Create conversations without LLM invocation (use the provided title).
- [x] Add typed errors for invalid/not-found conversation IDs and map them to 400/404 in chat handlers.
- [x] Build LLM history by skipping only the current message ID (preserve repeated questions).
- [x] Prevent partial streaming responses from being saved; only fallback when no chunks stream.

## Web
- [x] Add AI status guard and offline messaging in chat UI.
- [x] Surface send errors and disable send when AI is not configured.
- [x] Roll back optimistic user messages on send error.

## Mobile
- [x] Roll back optimistic user messages on send error.
- [x] Remove temp conversations from the list on send error.
