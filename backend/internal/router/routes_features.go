package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/rezacr588/currency-converter/internal/middleware"
)

// registerFeatureRoutes registers all remaining protected route groups:
// AI, goals, tasks, todo, planner, tags, budgets, recurring, reports,
// subscriptions, badges, notes, loans, notifications, challenges, and XP.
func registerFeatureRoutes(r chi.Router, h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth) {
	registerCoAIRoutes(r, h, authMiddleware)
	registerAIRoutes(r, h, rateLimiter, authMiddleware)
	registerGoalRoutes(r, h, authMiddleware)
	registerTaskRoutes(r, h, authMiddleware)
	registerTodoRoutes(r, h, authMiddleware)
	registerPlannerRoutes(r, h, authMiddleware)
	registerTagRoutes(r, h, authMiddleware)
	registerBudgetRoutes(r, h, authMiddleware)
	registerRecurringRoutes(r, h, authMiddleware)
	registerReportRoutes(r, h, authMiddleware)
	registerSubscriptionRoutes(r, h, authMiddleware)
	registerBadgeRoutes(r, h, authMiddleware)
	registerNoteRoutes(r, h, authMiddleware)
	registerLoanRoutes(r, h, authMiddleware)
	registerNotificationRoutes(r, h, authMiddleware)
	registerChallengeRoutes(r, h, authMiddleware)
	registerXPRoutes(r, h, authMiddleware)
	registerWealthRoutes(r, h, authMiddleware)
	registerForecastingRoutes(r, h, rateLimiter, authMiddleware)
	registerAgentRoutes(r, h, authMiddleware)
	registerDNARoutes(r, h, authMiddleware)
	registerSocialRoutes(r, h, authMiddleware)
	registerCryptoRoutes(r, h, authMiddleware)
	registerWebSocketRoutes(r, h, authMiddleware)
}

func registerCoAIRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.CoAI == nil {
		return
	}

	r.Route("/coai", func(r chi.Router) {
		r.Use(authMiddleware.Middleware)
		r.Get("/brief", h.CoAI.GetBrief)
		r.Get("/preferences", h.CoAI.GetPreferences)
		r.Put("/preferences", h.CoAI.UpdatePreferences)
	})
}

func registerAIRoutes(r chi.Router, h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth) {
	r.Route("/ai", func(r chi.Router) {
		// Status endpoint is public
		r.Get("/status", h.AI.GetStatus)

		// All other AI endpoints require authentication and AI rate limiting
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			if rateLimiter != nil {
				r.Use(rateLimiter.AIMiddleware)
			}
			// Parse endpoints now require auth to prevent abuse
			r.Post("/parse-receipt", h.AI.ParseReceipt)
			r.Post("/parse-text", h.AI.ParseReceiptText)
			r.Post("/detect-intent", h.AI.DetectIntent)
			r.Post("/smart-parse", h.AI.SmartParse)
			r.Post("/apply-parsed", h.AI.ApplyParsed)
			r.Post("/apply-recurring", h.AI.ApplyRecurring)
			r.Post("/apply-goal-contribution", h.AI.ApplyGoalContribution)
			r.Get("/advice", h.AI.GetPersonalizedAdvice)

			// AI Chat routes (protected)
			if h.AIChat != nil {
				h.AIChat.RegisterRoutes(r)
			}
		})
	})
}

func registerGoalRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Goal != nil {
		r.Route("/goals", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Goal.GetGoals)
			r.Post("/", h.Goal.CreateGoal)
			r.Get("/types", h.Goal.GetGoalTypes)
			r.Get("/categories", h.Goal.GetGoalCategories)
			r.Get("/{id}", h.Goal.GetGoal)
			r.Put("/{id}", h.Goal.UpdateGoal)
			r.Delete("/{id}", h.Goal.DeleteGoal)
			r.Post("/{id}/contribute", h.Goal.ContributeToGoal)
		})
	}
}

func registerTaskRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Task != nil {
		r.Route("/tasks", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Task.GetTasks)
			r.Post("/", h.Task.CreateTask)
			r.Get("/statuses", h.Task.GetTaskStatuses)
			r.Get("/priorities", h.Task.GetTaskPriorities)
			r.Get("/{id}", h.Task.GetTask)
			r.Put("/{id}", h.Task.UpdateTask)
			r.Delete("/{id}", h.Task.DeleteTask)
			r.Post("/{id}/complete", h.Task.CompleteTask)
			r.Get("/{id}/tags", h.Task.GetTaskTags)
			r.Post("/{id}/tags", h.Task.AddTaskTag)
			r.Delete("/{id}/tags/{tagID}", h.Task.RemoveTaskTag)
		})
	}
}

func registerTodoRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Todo != nil {
		r.Route("/todo", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Todo.GetTodoList)
		})
	}
}

func registerPlannerRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Planner != nil {
		r.Route("/planner", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/board", h.Planner.GetBoard)
			r.Patch("/items/{type}/{id}/move", h.Planner.MoveItem)
			r.Post("/goals/{id}/mark-done", h.Planner.MarkGoalDone)
		})
	}
}

func registerTagRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Tag != nil {
		r.Route("/tags", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Tag.GetTags)
			r.Post("/", h.Tag.CreateTag)
			r.Delete("/{id}", h.Tag.DeleteTag)
		})
	}
}

func registerBudgetRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Budget != nil {
		r.Route("/budgets", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Budget.GetBudgets)
			r.Post("/", h.Budget.CreateBudget)
			r.Put("/{id}", h.Budget.UpdateBudget)
			r.Delete("/{id}", h.Budget.DeleteBudget)
		})
	}
}

func registerRecurringRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Recurring != nil {
		r.Route("/recurring", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Recurring.GetRecurring)
			r.Get("/frequencies", h.Recurring.GetFrequencies)
			r.Post("/", h.Recurring.CreateRecurring)
			r.Put("/{id}", h.Recurring.UpdateRecurring)
			r.Delete("/{id}", h.Recurring.DeleteRecurring)
			r.Post("/{id}/execute", h.Recurring.ExecuteRecurring)
		})
	}
}

func registerReportRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Reports != nil {
		r.Route("/reports", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/monthly", h.Reports.GetMonthlyReport)
			r.Get("/yearly", h.Reports.GetYearlyReport)
			r.Get("/coverage", h.Reports.GetReportCoverage)
			r.Get("/category", h.Reports.GetCategoryReport)
			r.Get("/trends", h.Reports.GetTrendsReport)
			r.Get("/networth", h.Reports.GetNetWorthReport)
			r.Get("/forecast", h.Reports.GetForecast)
			r.Get("/insights", h.Reports.GetInsights)
			r.Get("/health-score", h.Reports.GetHealthScore)
			r.Get("/weekly-recap", h.Reports.GetWeeklyRecap)
			r.Get("/cashflow", h.Reports.GetCashFlowProjection)
			r.Get("/anomalies", h.Reports.GetSpendingAnomalies)
			r.Get("/date-range", h.Reports.GetDateRangeReport)
		})
	}
}

func registerSubscriptionRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Subscription != nil {
		r.Route("/subscriptions", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Subscription.GetSubscriptions)
			r.Post("/", h.Subscription.CreateSubscription)
			r.Get("/summary", h.Subscription.GetSubscriptionSummary)
			r.Get("/upcoming", h.Subscription.GetUpcomingRenewals)
			r.Get("/billing-cycles", h.Subscription.GetBillingCycles)
			r.Get("/categories", h.Subscription.GetCategories)
			r.Get("/{id}", h.Subscription.GetSubscription)
			r.Put("/{id}", h.Subscription.UpdateSubscription)
			r.Delete("/{id}", h.Subscription.DeleteSubscription)
		})
	}
}

func registerBadgeRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Badge != nil {
		r.Route("/badges", func(r chi.Router) {
			// Public: list all badges
			r.Get("/", h.Badge.GetAllBadges)

			// Protected: user-specific badge routes
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/earned", h.Badge.GetEarnedBadges)
				r.Get("/progress", h.Badge.GetBadgeProgress)
				r.Post("/check", h.Badge.CheckBadges)
			})
		})
	}
}

func registerNoteRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Note != nil {
		r.Route("/notes", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Note.GetNotes)
			r.Post("/", h.Note.CreateNote)
			r.Get("/colors", h.Note.GetColors)
			r.Get("/transaction/{transactionId}", h.Note.GetNotesByTransaction)
			r.Get("/{id}", h.Note.GetNote)
			r.Put("/{id}", h.Note.UpdateNote)
			r.Delete("/{id}", h.Note.DeleteNote)
			r.Post("/{id}/pin", h.Note.TogglePin)
		})
	}
}

func registerLoanRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Loan != nil {
		r.Route("/loans", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/", h.Loan.GetAllLoans)
			r.Post("/", h.Loan.CreateLoan)
			r.Get("/summary", h.Loan.GetSummary)
			r.Get("/upcoming", h.Loan.GetUpcoming)
			r.Get("/{id}", h.Loan.GetLoan)
			r.Put("/{id}", h.Loan.UpdateLoan)
			r.Delete("/{id}", h.Loan.DeleteLoan)
			r.Post("/{id}/payment", h.Loan.MakePayment)
			r.Get("/{id}/payments", h.Loan.GetPayments)
		})
	}
}

func registerNotificationRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Notification != nil {
		r.Route("/notifications", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Post("/register", h.Notification.RegisterToken)
			r.Post("/unregister", h.Notification.UnregisterToken)
			r.Get("/preferences", h.Notification.GetPreferences)
			r.Put("/preferences", h.Notification.UpdatePreferences)
			r.Post("/check-budgets", h.Notification.CheckBudgets)
			r.Post("/check-loans", h.Notification.CheckLoans)
		})
	}
}

func registerChallengeRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Challenge != nil {
		r.Route("/challenges", func(r chi.Router) {
			// Public: list all challenges
			r.Get("/", h.Challenge.GetAllChallenges)
			r.Get("/featured", h.Challenge.GetFeaturedChallenges)

			// Protected: user-specific challenge routes
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.Middleware)
				r.Get("/browse", h.Challenge.GetChallengesWithStatus)
				r.Post("/join", h.Challenge.JoinChallenge)
				r.Get("/active", h.Challenge.GetActiveChallenges)
				r.Get("/history", h.Challenge.GetChallengeHistory)
				r.Get("/stats", h.Challenge.GetChallengeStats)
				r.Post("/check-progress", h.Challenge.CheckProgress)
				r.Delete("/{id}/abandon", h.Challenge.AbandonChallenge)
			})
		})
	}
}

func registerXPRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.XP != nil {
		r.Route("/xp", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/stats", h.XP.GetStats)
			r.Get("/history", h.XP.GetHistory)
			r.Get("/level", h.XP.GetLevelInfo)
			r.Post("/daily-reward", h.XP.ClaimDailyReward)
			r.Get("/daily-reward/status", h.XP.GetDailyRewardStatus)
			r.Get("/leaderboard", h.XP.GetLeaderboard)
		})
	}
}

func registerWealthRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Wealth != nil {
		r.Route("/wealth", func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			r.Get("/overview", h.Wealth.GetOverview)
			r.Get("/history", h.Wealth.GetHistory)
			r.Get("/what-if", h.Wealth.GetWhatIf)
			r.Get("/alerts", h.Wealth.GetAlerts)
			r.Post("/alerts/{id}/read", h.Wealth.MarkAlertRead)
		})
	}
}

func registerForecastingRoutes(r chi.Router, h *Handlers, rateLimiter *middleware.RateLimiter, authMiddleware *middleware.Auth) {
	if h.Forecasting == nil {
		return
	}

	r.Route("/forecasting", func(r chi.Router) {
		// Public health check endpoint
		r.Get("/health", h.Forecasting.HealthCheck)

		// Protected endpoints with AI rate limiting
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Middleware)
			if rateLimiter != nil {
				r.Use(rateLimiter.AIMiddleware)
			}
			r.Get("/predict", h.Forecasting.GetForecast)
			r.Get("/anomalies", h.Forecasting.DetectAnomalies)
		})
	})
}

func registerAgentRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Agent == nil {
		return
	}

	r.Route("/agent", func(r chi.Router) {
		r.Use(authMiddleware.Middleware)

		// Plans CRUD
		r.Get("/plans", h.Agent.ListPlans)
		r.Post("/plans", h.Agent.CreatePlan)
		r.Post("/plans/generate", h.Agent.GenerateAIPlan)
		r.Get("/plans/{id}", h.Agent.GetPlan)
		r.Delete("/plans/{id}", h.Agent.CancelPlan)

		// Plan actions
		r.Post("/plans/{id}/activate", h.Agent.ActivatePlan)
		r.Post("/plans/{id}/pause", h.Agent.PausePlan)
		r.Post("/plans/{id}/resume", h.Agent.ResumePlan)

		// Step approval
		r.Post("/plans/{id}/steps/{stepId}/approve", h.Agent.ApproveStep)
		r.Post("/plans/{id}/steps/{stepId}/reject", h.Agent.RejectStep)

		// Approvals
		r.Get("/approvals/pending", h.Agent.GetPendingApprovals)

		// Config
		r.Get("/config", h.Agent.GetConfig)
		r.Post("/config", h.Agent.UpdateConfig)

		// Logs
		r.Get("/logs", h.Agent.GetActionLogs)

		// Daily briefing
		r.Get("/briefing", h.Agent.GetDailyBriefing)
	})
}

func registerDNARoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.DNA == nil {
		return
	}

	r.Route("/dna", func(r chi.Router) {
		r.Use(authMiddleware.Middleware)

		// Financial DNA profile
		r.Get("/", h.DNA.GetDNA)
		r.Post("/refresh", h.DNA.RefreshDNA)

		// Behavioral insights
		r.Get("/insights", h.DNA.GetInsights)
		r.Post("/insights/generate", h.DNA.GenerateInsights)
		r.Post("/insights/read", h.DNA.MarkInsightRead)

		// Assessment quiz
		r.Get("/quiz", h.DNA.GetQuizQuestions)
	})
}

func registerSocialRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Social == nil {
		return
	}

	r.Route("/spaces", func(r chi.Router) {
		r.Use(authMiddleware.Middleware)

		// Spaces CRUD
		r.Post("/", h.Social.CreateSpace)
		r.Get("/", h.Social.ListSpaces)

		// Invitations
		r.Get("/invites", h.Social.GetPendingInvites)
		r.Post("/invites/{code}/accept", h.Social.AcceptInvite)
		r.Post("/invites/{code}/respond", h.Social.RespondInvite)

		// Single space operations
		r.Route("/{spaceId}", func(r chi.Router) {
			r.Get("/", h.Social.GetSpace)
			r.Put("/", h.Social.UpdateSpace)
			r.Delete("/", h.Social.DeleteSpace)
			r.Post("/leave", h.Social.LeaveSpace)

			// Members
			r.Post("/invite", h.Social.InviteMember)
			r.Delete("/members/{memberId}", h.Social.RemoveMember)

			// Expenses
			r.Route("/expenses", func(r chi.Router) {
				r.Post("/", h.Social.AddExpense)
				r.Get("/", h.Social.ListExpenses)
			})

			// Settlements
			r.Route("/settlements", func(r chi.Router) {
				r.Post("/", h.Social.RecordSettlement)
				r.Get("/", h.Social.ListSettlements)
			})

			// Balances
			r.Get("/balances", h.Social.GetBalances)

			// Budgets
			r.Route("/budgets", func(r chi.Router) {
				r.Post("/", h.Social.CreateBudget)
				r.Get("/", h.Social.ListBudgets)
			})

			// Activities
			r.Get("/activities", h.Social.GetActivities)
		})

		// Expense operations (outside space context)
		r.Get("/expenses/{expenseId}", h.Social.GetExpense)
		r.Delete("/expenses/{expenseId}", h.Social.DeleteExpense)

		// Settlement confirmation
		r.Post("/settlements/{settlementId}/confirm", h.Social.ConfirmSettlement)
	})
}

func registerCryptoRoutes(r chi.Router, h *Handlers, authMiddleware *middleware.Auth) {
	if h.Crypto == nil {
		return
	}

	r.Route("/crypto", func(r chi.Router) {
		// Public endpoints
		r.Get("/networks", h.Crypto.GetSupportedNetworks)
		r.Get("/prices", h.Crypto.GetTokenPrice)
		r.Get("/gas", h.Crypto.GetGasPrices)

		// Protected endpoints
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.Middleware)

			// Portfolio
			r.Get("/portfolio", h.Crypto.GetPortfolioSummary)
			r.Get("/defi", h.Crypto.GetDeFiOverview)
			r.Post("/sync", h.Crypto.SyncAllWallets)

			// Wallets
			r.Get("/wallets", h.Crypto.ListWallets)
			r.Post("/wallets", h.Crypto.AddWallet)
			r.Get("/wallets/{id}", h.Crypto.GetWallet)
			r.Delete("/wallets/{id}", h.Crypto.DeleteWallet)
			r.Post("/wallets/{id}/sync", h.Crypto.SyncWallet)
			r.Get("/wallets/{id}/transactions", h.Crypto.GetWalletTransactions)

			// Alerts
			r.Get("/alerts", h.Crypto.ListAlerts)
			r.Post("/alerts", h.Crypto.CreateAlert)
			r.Delete("/alerts/{id}", h.Crypto.DeleteAlert)
		})
	})
}

// registerWebSocketRoutes registers WebSocket routes
func registerWebSocketRoutes(r chi.Router, h *Handlers, _ *middleware.Auth) {
	if h.WebSocket == nil {
		return
	}

	r.Route("/ws", func(r chi.Router) {
		r.Get("/", h.WebSocket.HandleConnection)
		r.Get("/stats", h.WebSocket.HandleStats)
	})
}
