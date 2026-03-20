package main

import (
	"context"

	"github.com/rs/zerolog/log"

	"github.com/rezacr588/currency-converter/internal/config"
	"github.com/rezacr588/currency-converter/internal/handler"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rezacr588/currency-converter/internal/repository"
	"github.com/rezacr588/currency-converter/internal/router"
	"github.com/rezacr588/currency-converter/internal/service"
)

// databases holds database connections and related background workers.
type databases struct {
	mainDB           *repository.Database
	irrDB            *repository.IRRDatabase
	irrCrawler       *repository.IRRCrawler
	inflationRepo    *repository.InflationRepository
	inflationCrawler *repository.InflationCrawler
	userRepo         *repository.UserRepository
	walletRepo       *repository.WalletRepository
	loanRepo         *repository.LoanRepository
	goalRepo         *repository.GoalRepository
	budgetRepo       *repository.BudgetRepository
}

// services holds all initialized services.
type services struct {
	exchange     *service.ExchangeService
	auth         *service.AuthService
	linkedInAuth *service.LinkedInOAuthService
	googleAuth   *service.GoogleOAuthService
	wallet       *service.WalletService
	coai         *service.CoAIService
	ai           *service.AIService
	aiChat       *service.AIChatService
	goal         *service.GoalService
	task         *service.TaskService
	todo         *service.TodoService
	planner      *service.PlannerService
	tag          *service.TagService
	category     *service.CategoryService
	budget       *service.BudgetService
	recurring    *service.RecurringService
	reports      *service.ReportsService
	subscription *service.SubscriptionService
	badge        *service.BadgeService
	note         *service.NoteService
	loan         *service.LoanService
	notification *service.NotificationService
	challenge    *service.ChallengeService
	xp            *service.XPService
	advice        *service.AdviceService
	wealth        *service.WealthService
	news          *service.NewsService
	mlForecaster  *service.MLForecasterService
	mlAnomalies   *service.AnomalyDetectorService
	planEngine    *service.PlanningEngineService
	actionExecutor *service.ActionExecutor

	// Shutdown handles
	memoryService *service.MemoryService
	qdrantClient  *repository.QdrantClient
}

func initDatabase(cfg *config.Config) *databases {
	db := &databases{}

	// Initialize IRR database (if DATABASE_URL is configured)
	var irrClient *repository.IRRClient

	if cfg.DatabaseURL != "" {
		var err error

		// Initialize main database for users/wallet
		db.mainDB, err = repository.NewDatabase(cfg.DatabaseURL, &repository.DBPoolConfig{
			MaxConns:          cfg.DBMaxConns,
			MinConns:          cfg.DBMinConns,
			MaxConnLifetime:   cfg.DBMaxConnLifetime,
			MaxConnIdleTime:   cfg.DBMaxConnIdleTime,
			HealthCheckPeriod: cfg.DBHealthCheckPeriod,
		})
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to main database, user/wallet features disabled")
		} else {
			log.Info().Msg("Connected to main database for users/wallet")
			db.userRepo = repository.NewUserRepository(db.mainDB)
			db.walletRepo = repository.NewWalletRepository(db.mainDB)
		}

		// Initialize IRR database
		db.irrDB, err = repository.NewIRRDatabase(cfg.DatabaseURL)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to IRR database, continuing without persistent storage")
		} else {
			log.Info().Msg("Connected to IRR rates database")
		}
	} else {
		log.Info().Msg("DATABASE_URL not configured, user/wallet features and IRR rates will use in-memory cache only")
	}

	// Initialize IRR client with database
	irrClient = repository.NewIRRClient(db.irrDB)

	// Start IRR crawler if enabled and database is available
	if cfg.IRRCrawlerEnabled && db.irrDB != nil {
		db.irrCrawler = repository.NewIRRCrawler(irrClient, db.irrDB, cfg.IRRCrawlerInterval)
		db.irrCrawler.Start()
		log.Info().
			Dur("interval", cfg.IRRCrawlerInterval).
			Msg("IRR rate crawler started")
	}

	// Initialize inflation repository and crawler
	if db.mainDB != nil {
		db.inflationRepo = repository.NewInflationRepository(db.mainDB)
		log.Info().Msg("Inflation repository initialized")

		if cfg.InflationCrawlerEnabled {
			db.inflationCrawler = repository.NewInflationCrawler(db.inflationRepo, cfg.InflationCrawlerInterval)
			db.inflationCrawler.Start()
			log.Info().
				Dur("interval", cfg.InflationCrawlerInterval).
				Msg("Inflation crawler started")
		}
	}

	return db
}

func initServices(cfg *config.Config, db *databases) *services {
	svc := &services{}

	initCoreServices(cfg, db, svc)
	initAuthServices(cfg, db, svc)
	initFeatureServices(cfg, db, svc)
	initAIServices(cfg, db, svc)

	// Initialize advice service
	if svc.ai != nil && db.walletRepo != nil {
		svc.advice = service.NewAdviceService(svc.ai, db.walletRepo, db.userRepo, svc.exchange, db.goalRepo, db.budgetRepo)
		log.Info().Msg("Advice service initialized")
	}

	if db.userRepo != nil {
		svc.coai = service.NewCoAIService(
			db.userRepo,
			db.walletRepo,
			db.goalRepo,
			db.budgetRepo,
			repository.NewSubscriptionRepository(db.mainDB),
			svc.reports,
			svc.advice,
			svc.wealth,
		)
		log.Info().Msg("CoAI service initialized")
	}

	// Initialize news service (always available)
	svc.news = service.NewNewsService(cfg.NewsCacheTTL, svc.ai)
	log.Info().Msg("News service initialized")

	// Initialize ML services (if ML_SERVICE_URL is configured)
	if cfg.MLServiceURL != "" {
		svc.mlForecaster = service.NewMLForecasterService(cfg.MLServiceURL)
		svc.mlAnomalies = service.NewAnomalyDetectorService(cfg.MLServiceURL)
		log.Info().Str("url", cfg.MLServiceURL).Msg("ML services initialized")
	} else {
		log.Info().Msg("ML services not configured (ML_SERVICE_URL not set)")
	}

	// Initialize planning engine service (autonomous agent)
	if db.mainDB != nil {
		agentPlanRepo := repository.NewAgentPlanRepository(db.mainDB.Pool())
		svc.planEngine = service.NewPlanningEngineService(agentPlanRepo, svc.aiChat)
		log.Info().Msg("Planning engine service initialized")
		
		// Initialize action executor
		svc.actionExecutor = service.NewActionExecutor(
			agentPlanRepo,
			svc.wallet,
			svc.goal,
			svc.budget,
			svc.recurring,
		)
		log.Info().Msg("Action executor service initialized")
	}

	return svc
}

// initCoreServices sets up the exchange service and cache.
func initCoreServices(cfg *config.Config, db *databases, svc *services) {
	cache := repository.NewInMemoryCache(cfg.CacheTTL)

	var irrClient *repository.IRRClient
	if db.irrDB != nil {
		irrClient = repository.NewIRRClient(db.irrDB)
	} else {
		irrClient = repository.NewIRRClient(nil)
	}

	frankfurterClient := repository.NewFrankfurterClient(cfg.FrankfurterURL)
	svc.exchange = service.NewExchangeService(cfg, frankfurterClient, cache, irrClient)
}

// initAuthServices sets up authentication and OAuth providers.
func initAuthServices(cfg *config.Config, db *databases, svc *services) {
	if db.userRepo == nil {
		log.Warn().Msg("Authentication service not available - no database connection")
		return
	}

	emailService := service.NewEmailService(cfg.ResendAPIKey, cfg.FrontendURL)
	refreshTokenRepo := repository.NewRefreshTokenRepository(db.mainDB)
	svc.auth = service.NewAuthServiceWithRefresh(db.userRepo, refreshTokenRepo, emailService, cfg.JWTSecret)
	log.Info().Msg("Authentication service initialized")

	oauthStateRepo := repository.NewOAuthStateRepository(db.mainDB)

	if cfg.LinkedInClientID != "" && cfg.LinkedInClientSecret != "" {
		linkedInConfig := &service.LinkedInConfig{
			ClientID:     cfg.LinkedInClientID,
			ClientSecret: cfg.LinkedInClientSecret,
			RedirectURI:  cfg.LinkedInRedirectURI,
			FrontendURL:  cfg.FrontendURL,
		}
		svc.linkedInAuth = service.NewLinkedInOAuthService(svc.auth, db.userRepo, oauthStateRepo, linkedInConfig)
		log.Info().Msg("LinkedIn OAuth service initialized with database-backed state storage")
	} else {
		log.Info().Msg("LinkedIn OAuth not configured (LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET not set)")
	}

	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		googleConfig := &service.GoogleConfig{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURI:  cfg.GoogleRedirectURI,
			FrontendURL:  cfg.FrontendURL,
		}
		svc.googleAuth = service.NewGoogleOAuthService(svc.auth, db.userRepo, oauthStateRepo, googleConfig)
		log.Info().Msg("Google OAuth service initialized with database-backed state storage")
	} else {
		log.Info().Msg("Google OAuth not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set)")
	}
}

// initFeatureServices sets up all domain feature services (wallet, goals, tasks, etc.).
func initFeatureServices(cfg *config.Config, db *databases, svc *services) {
	// Wallet service
	if db.walletRepo != nil {
		svc.wallet = service.NewWalletService(db.walletRepo, svc.exchange)
		log.Info().Msg("Wallet service initialized")
	} else {
		log.Warn().Msg("Wallet service not available - no database connection")
	}

	if db.mainDB == nil {
		return
	}

	// Goal, task, todo, planner
	db.goalRepo = repository.NewGoalRepository(db.mainDB)
	svc.goal = service.NewGoalService(db.goalRepo)
	log.Info().Msg("Goal service initialized")

	taskRepo := repository.NewTaskRepository(db.mainDB)
	svc.task = service.NewTaskService(taskRepo, db.goalRepo, db.walletRepo)
	log.Info().Msg("Task service initialized")

	svc.todo = service.NewTodoService(taskRepo, db.goalRepo)
	log.Info().Msg("Todo service initialized")

	// Tags
	tagRepo := repository.NewTagRepository(db.mainDB)
	svc.tag = service.NewTagService(tagRepo)
	log.Info().Msg("Tag service initialized")
	svc.task.SetTagRepository(tagRepo)
	if svc.wallet != nil {
		svc.wallet.SetTagRepository(tagRepo)
	}

	svc.planner = service.NewPlannerService(taskRepo, db.goalRepo, svc.task)
	log.Info().Msg("Planner service initialized")

	// Categories
	categoryRepo := repository.NewCategoryRepository(db.mainDB)
	if err := categoryRepo.InitDefaultCategories(context.Background()); err != nil {
		log.Warn().Err(err).Msg("Failed to initialize default categories")
	}
	svc.category = service.NewCategoryService(categoryRepo)
	log.Info().Msg("Category service initialized")

	// Budget
	db.budgetRepo = repository.NewBudgetRepository(db.mainDB)
	svc.budget = service.NewBudgetService(db.budgetRepo)
	log.Info().Msg("Budget service initialized")

	// Recurring & subscriptions
	recurringRepo := repository.NewRecurringRepository(db.mainDB)
	svc.recurring = service.NewRecurringService(recurringRepo)
	log.Info().Msg("Recurring transaction service initialized")

	subscriptionRepo := repository.NewSubscriptionRepository(db.mainDB)
	svc.subscription = service.NewSubscriptionService(subscriptionRepo)
	log.Info().Msg("Subscription service initialized")

	// Reports
	if db.walletRepo != nil {
		svc.reports = service.NewReportsService(db.walletRepo, svc.exchange, svc.ai, recurringRepo, subscriptionRepo)
		log.Info().Msg("Reports service initialized")
	}

	// Badges
	badgeRepo := repository.NewBadgeRepository(db.mainDB)
	if err := badgeRepo.InitDefaultBadges(context.Background()); err != nil {
		log.Warn().Err(err).Msg("Failed to initialize default badges")
	}
	svc.badge = service.NewBadgeService(badgeRepo, db.walletRepo, db.budgetRepo, db.goalRepo, subscriptionRepo)
	log.Info().Msg("Badge service initialized")

	// Notes
	noteRepo := repository.NewNoteRepository(db.mainDB)
	svc.note = service.NewNoteService(noteRepo, db.walletRepo)
	log.Info().Msg("Note service initialized")

	// Loans
	db.loanRepo = repository.NewLoanRepository(db.mainDB.Pool())
	svc.loan = service.NewLoanService(db.loanRepo)
	log.Info().Msg("Loan service initialized")

	// Notifications
	notificationRepo := repository.NewNotificationRepository(db.mainDB.Pool())
	svc.notification = service.NewNotificationService(notificationRepo, db.budgetRepo, db.loanRepo)
	log.Info().Msg("Notification service initialized")

	// Challenges
	challengeRepo := repository.NewChallengeRepository(db.mainDB)
	svc.challenge = service.NewChallengeService(challengeRepo, db.walletRepo, db.budgetRepo)
	log.Info().Msg("Challenge service initialized")

	// XP
	xpRepo := repository.NewXPRepository(db.mainDB.Pool())
	svc.xp = service.NewXPService(xpRepo)
	log.Info().Msg("XP service initialized")

	// Wealth
	if db.walletRepo != nil && db.inflationRepo != nil {
		svc.wealth = service.NewWealthService(db.walletRepo, svc.exchange, db.inflationRepo)
		log.Info().Msg("Wealth service initialized")
	}
}

// initAIServices sets up AI, memory, embeddings, and chat services.
func initAIServices(cfg *config.Config, db *databases, svc *services) {
	if cfg.AIAPIKey == "" {
		log.Info().Msg("AI_API_KEY not configured, AI features disabled")
		return
	}

	var err error
	svc.ai, err = service.NewAIService(cfg.AIProvider, cfg.AIAPIKey, cfg.AIModel, cfg.AIVisionModel, cfg.AICloudProject)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to initialize AI service")
		return
	}
	log.Info().
		Str("provider", svc.ai.GetProvider()).
		Str("project", cfg.AICloudProject).
		Msg("AI service initialized")

	if db.mainDB == nil {
		return
	}

	chatRepo := repository.NewChatRepository(db.mainDB.Pool())
	memoryRepo := repository.NewMemoryRepository(db.mainDB)
	if err := memoryRepo.InitSchema(context.Background()); err != nil {
		log.Warn().Err(err).Msg("Failed to initialize memory schema")
	}

	memoryService := initMemoryService(cfg, memoryRepo, svc)
	svc.memoryService = memoryService

	// Retrieve repos created in initFeatureServices by querying the db directly.
	// These repos are needed by the AI chat service constructor.
	recurringRepo := repository.NewRecurringRepository(db.mainDB)
	categoryRepo := repository.NewCategoryRepository(db.mainDB)
	subscriptionRepo := repository.NewSubscriptionRepository(db.mainDB)
	noteRepo := repository.NewNoteRepository(db.mainDB)

	svc.aiChat = service.NewAIChatService(service.AIChatServiceConfig{
		AIService:        svc.ai,
		ExchangeService:  svc.exchange,
		ChatRepo:         chatRepo,
		WalletRepo:       db.walletRepo,
		GoalRepo:         db.goalRepo,
		BudgetRepo:       db.budgetRepo,
		UserRepo:         db.userRepo,
		RecurringRepo:    recurringRepo,
		MemoryRepo:       memoryRepo,
		MemoryService:    memoryService,
		LoanRepo:         db.loanRepo,
		CategoryRepo:     categoryRepo,
		ReportsService:   svc.reports,
		SubscriptionRepo: subscriptionRepo,
		NoteRepo:         noteRepo,
		TavilyAPIKey:     cfg.TavilyAPIKey,
	})
	svc.aiChat.SetThinkingConfig(
		cfg.AIFastModel, cfg.AIThinkingModel,
		model.ChatThinkingMode(cfg.AIThinkingModeDefault),
	)
	if svc.wealth != nil {
		svc.aiChat.SetWealthService(svc.wealth)
	}
	log.Info().Msg("AI Chat service initialized with full context")
}

// initMemoryService creates the memory service, optionally with Qdrant-backed semantic search.
func initMemoryService(cfg *config.Config, memoryRepo *repository.MemoryRepository, svc *services) *service.MemoryService {
	if cfg.QdrantEnabled && cfg.QdrantURL != "" {
		qdrantClient, err := repository.NewQdrantClient(repository.QdrantConfig{
			URL:        cfg.QdrantURL,
			APIKey:     cfg.QdrantAPIKey,
			Dimensions: uint64(cfg.EmbeddingDimensions),
		})
		if err != nil {
			log.Warn().Err(err).Msg("Failed to initialize Qdrant client, semantic memory disabled")
		} else {
			log.Info().
				Str("url", cfg.QdrantURL).
				Int("dimensions", cfg.EmbeddingDimensions).
				Msg("Qdrant client initialized")

			embeddingService, err := service.NewEmbeddingService(service.EmbeddingConfig{
				Provider:   service.EmbeddingProvider(cfg.EmbeddingProvider),
				APIKey:     cfg.EmbeddingAPIKey,
				Model:      cfg.EmbeddingModel,
				Dimensions: cfg.EmbeddingDimensions,
				OllamaURL:  cfg.OllamaURL,
			})
			if err != nil {
				log.Warn().Err(err).Msg("Failed to initialize embedding service, semantic memory disabled")
				qdrantClient.Close()
			} else {
				log.Info().
					Str("provider", cfg.EmbeddingProvider).
					Str("model", cfg.EmbeddingModel).
					Msg("Embedding service initialized")

				vectorMemoryRepo := repository.NewVectorMemoryRepository(qdrantClient, cfg.ShortTermMemoryTTL)
				ms := service.NewMemoryService(memoryRepo, vectorMemoryRepo, embeddingService, cfg.MaxMemoryResults)
				svc.qdrantClient = qdrantClient
				log.Info().Msg("Memory service initialized with semantic search (Qdrant)")
				return ms
			}
		}
	}

	if cfg.QdrantEnabled && cfg.QdrantURL != "" {
		log.Warn().Msg("Falling back to PostgreSQL-only memory service")
	} else {
		log.Info().Msg("Memory service initialized (PostgreSQL only, Qdrant disabled)")
	}
	return service.NewMemoryService(memoryRepo, nil, nil, cfg.MaxMemoryResults)
}

func initHandlers(cfg *config.Config, db *databases, svc *services) *router.Handlers {
	exchangeHandler := handler.New(svc.exchange)
	authHandler := handler.NewAuthHandler(svc.auth)
	walletHandler := handler.NewWalletHandler(svc.wallet)
	if svc.category != nil {
		walletHandler = handler.NewWalletHandlerWithCategories(svc.wallet, svc.category)
	}
	walletHandler.SetPaginationLimits(cfg.PaginationMaxAPILimit, cfg.PaginationMaxFilterLimit)
	aiHandler := handler.NewAIHandler(svc.ai, svc.wallet)
	var coaiHandler *handler.CoAIHandler
	if svc.coai != nil {
		coaiHandler = handler.NewCoAIHandler(svc.coai)
	}

	if svc.recurring != nil {
		aiHandler.SetRecurringService(svc.recurring)
	}
	if svc.goal != nil {
		aiHandler.SetGoalService(svc.goal)
	}
	if svc.advice != nil {
		aiHandler.SetAdviceService(svc.advice)
	}

	var goalHandler *handler.GoalHandler
	if svc.goal != nil {
		goalHandler = handler.NewGoalHandler(svc.goal)
	}
	var taskHandler *handler.TaskHandler
	if svc.task != nil {
		taskHandler = handler.NewTaskHandler(svc.task)
	}
	var todoHandler *handler.TodoHandler
	if svc.todo != nil {
		todoHandler = handler.NewTodoHandler(svc.todo)
	}
	var plannerHandler *handler.PlannerHandler
	if svc.planner != nil {
		plannerHandler = handler.NewPlannerHandler(svc.planner)
	}
	var tagHandler *handler.TagHandler
	if svc.tag != nil {
		tagHandler = handler.NewTagHandler(svc.tag)
	}
	var budgetHandler *handler.BudgetHandler
	if svc.budget != nil {
		budgetHandler = handler.NewBudgetHandler(svc.budget)
	}
	var recurringHandler *handler.RecurringHandler
	if svc.recurring != nil {
		recurringHandler = handler.NewRecurringHandler(svc.recurring)
	}
	var reportsHandler *handler.ReportsHandler
	if svc.reports != nil {
		reportsHandler = handler.NewReportsHandler(svc.reports)
	}
	var subscriptionHandler *handler.SubscriptionHandler
	if svc.subscription != nil {
		subscriptionHandler = handler.NewSubscriptionHandler(svc.subscription)
	}
	var badgeHandler *handler.BadgeHandler
	if svc.badge != nil {
		badgeHandler = handler.NewBadgeHandler(svc.badge)
	}
	var noteHandler *handler.NoteHandler
	if svc.note != nil {
		noteHandler = handler.NewNoteHandler(svc.note)
	}
	var loanHandler *handler.LoanHandler
	if svc.loan != nil {
		loanHandler = handler.NewLoanHandler(svc.loan)
	}
	var notificationHandler *handler.NotificationHandler
	if svc.notification != nil {
		notificationHandler = handler.NewNotificationHandler(svc.notification)
	}
	var challengeHandler *handler.ChallengeHandler
	if svc.challenge != nil {
		challengeHandler = handler.NewChallengeHandler(svc.challenge)
	}
	var xpHandler *handler.XPHandler
	if svc.xp != nil {
		xpHandler = handler.NewXPHandler(svc.xp)
	}
	var wealthHandler *handler.WealthHandler
	if svc.wealth != nil {
		wealthHandler = handler.NewWealthHandler(svc.wealth)
	}

	var aiChatHandler *handler.AIChatHandler
	if svc.aiChat != nil {
		aiChatHandler = handler.NewAIChatHandler(svc.aiChat, svc.auth)
	}

	var linkedInProvider handler.OAuthProvider
	if svc.linkedInAuth != nil {
		linkedInProvider = svc.linkedInAuth
	}
	var googleProvider handler.OAuthProvider
	if svc.googleAuth != nil {
		googleProvider = svc.googleAuth
	}
	linkedInOAuthHandler := handler.NewOAuthHandler(linkedInProvider, "LinkedIn", "/auth/linkedin/callback", cfg.FrontendURL)
	googleOAuthHandler := handler.NewOAuthHandler(googleProvider, "Google", "/auth/google/callback", cfg.FrontendURL)

	newsHandler := handler.NewNewsHandler(svc.news)

	var forecastingHandler *handler.ForecastingHandler
	if svc.mlForecaster != nil && svc.mlAnomalies != nil && db.walletRepo != nil {
		forecastingHandler = handler.NewForecastingHandler(svc.mlForecaster, svc.mlAnomalies, db.walletRepo)
	}

	var agentHandler *handler.AgentHandler
	if svc.planEngine != nil && svc.actionExecutor != nil {
		agentHandler = handler.NewAgentHandler(svc.planEngine, svc.actionExecutor)
	}

	return &router.Handlers{
		Exchange:      exchangeHandler,
		Auth:          authHandler,
		LinkedInOAuth: linkedInOAuthHandler,
		GoogleOAuth:   googleOAuthHandler,
		Wallet:        walletHandler,
		CoAI:          coaiHandler,
		AI:            aiHandler,
		AIChat:        aiChatHandler,
		Goal:          goalHandler,
		Todo:          todoHandler,
		Task:          taskHandler,
		Planner:       plannerHandler,
		Tag:           tagHandler,
		Budget:        budgetHandler,
		Recurring:     recurringHandler,
		Reports:       reportsHandler,
		Subscription:  subscriptionHandler,
		Badge:         badgeHandler,
		Note:          noteHandler,
		Loan:          loanHandler,
		Notification:  notificationHandler,
		Challenge:     challengeHandler,
		XP:            xpHandler,
		Wealth:        wealthHandler,
		News:          newsHandler,
		Forecasting:   forecastingHandler,
		Agent:         agentHandler,
	}
}
