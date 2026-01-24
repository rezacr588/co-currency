package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/rezacr588/currency-converter/pkg/ctxkeys"
	"github.com/rezacr588/currency-converter/pkg/httputil"
	"github.com/rs/zerolog/log"
)

// Recovery middleware recovers from panics and logs the error with stack trace
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				traceID := ctxkeys.GetTraceID(r.Context())
				stack := string(debug.Stack())

				log.Error().
					Interface("error", err).
					Str("trace_id", traceID).
					Str("stack", stack).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("Panic recovered")

				var internalErr error
				if e, ok := err.(error); ok {
					internalErr = e
				} else {
					internalErr = fmt.Errorf("%v", err)
				}

				httputil.InternalServerErrorWithContext(r.Context(), w, "an unexpected error occurred", internalErr)
			}
		}()

		next.ServeHTTP(w, r)
	})
}
