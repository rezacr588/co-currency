package service

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"github.com/rezacr588/currency-converter/internal/model"
	"github.com/rs/zerolog/log"
	"github.com/tmc/langchaingo/llms"
)

// RSS feed structures
type rssFeed struct {
	XMLName xml.Name   `xml:"rss"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title string    `xml:"title"`
	Items []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	Enclosure   struct {
		URL  string `xml:"url,attr"`
		Type string `xml:"type,attr"`
	} `xml:"enclosure"`
	MediaContent struct {
		URL string `xml:"url,attr"`
	} `xml:"http://search.yahoo.com/mrss/ content"`
}

type feedSource struct {
	URL      string
	Name     string
	Category string
}

var defaultFeeds = []feedSource{
	// Markets & Financial
	{URL: "https://feeds.content.dowjones.io/public/rss/mw_topstories", Name: "MarketWatch", Category: "markets"},
	{URL: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US", Name: "Yahoo Finance", Category: "finance"},
	{URL: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", Name: "CNBC", Category: "finance"},
	// Global Breaking News
	{URL: "http://rss.cnn.com/rss/cnn_topstories.rss", Name: "CNN Top Stories", Category: "world"},
	{URL: "http://rss.cnn.com/rss/cnn_latest.rss", Name: "CNN Latest", Category: "breaking"},
	{URL: "http://feeds.bbci.co.uk/news/world/rss.xml", Name: "BBC World", Category: "world"},
	{URL: "https://news.google.com/rss/search?q=source:reuters+breaking", Name: "Reuters Breaking", Category: "breaking"},
	{URL: "https://moxie.foxnews.com/google-publisher/latest.xml", Name: "Fox News", Category: "breaking"},
}

// NewsService fetches and caches financial news from RSS feeds
type NewsService struct {
	cache     *gocache.Cache
	cacheTTL  time.Duration
	client    *http.Client
	aiService *AIService
}

// NewNewsService creates a new NewsService
func NewNewsService(cacheTTL time.Duration, aiService *AIService) *NewsService {
	return &NewsService{
		cache:     gocache.New(cacheTTL, 10*time.Minute),
		cacheTTL:  cacheTTL,
		client:    &http.Client{Timeout: 10 * time.Second},
		aiService: aiService,
	}
}

// GetDailySummary returns an AI-generated daily summary of worldwide and financial news
func (s *NewsService) GetDailySummary(ctx context.Context) (*model.AINewsSummary, error) {
	cacheKey := "news:daily_summary"
	if cached, found := s.cache.Get(cacheKey); found {
		if summary, ok := cached.(*model.AINewsSummary); ok {
			return summary, nil
		}
	}

	if s.aiService == nil {
		return nil, fmt.Errorf("AI service not configured")
	}

	// Fetch top news items (up to 30)
	items, err := s.GetNews(ctx, 30)
	if err != nil {
		return nil, fmt.Errorf("fetching news for summary: %w", err)
	}

	if len(items) == 0 {
		return nil, fmt.Errorf("no news items available to summarize")
	}

	// Prepare data for the LLM
	var newsText strings.Builder
	for i, item := range items {
		newsText.WriteString(fmt.Sprintf("%d. [%s - %s] %s\n", i+1, item.Source, item.Category, item.Title))
		if item.Description != "" {
			newsText.WriteString(fmt.Sprintf("   %s\n", item.Description))
		}
	}

	llm, err := s.aiService.getLLM(ctx)
	if err != nil {
		return nil, fmt.Errorf("getting LLM: %w", err)
	}

	prompt := fmt.Sprintf(`You are a world-class financial and global news analyst creating a "Daily Briefing". 
Analyze the following recent news headlines and output a JSON response. 

Recent News:
%s

Instructions:
1. Provide a cohesive, 3-4 sentence summary of the major global events and market movements of the day.
2. Provide 3-5 brief, actionable recommendations for the user based on these events (e.g., "Market volatility suggests diversifying," or "Consider reviewing tech sector exposure").
3. Determine the overall sentiment (positive, negative, neutral, volatile).
4. Determine if there is a highly critical breaking event (set has_breaking_news to true or false).
5. Return ONLY a valid JSON object with the following structure:
{
  "summary": "The global summary text...",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "sentiment": "positive/negative/neutral/volatile",
  "has_breaking_news": true/false
}
`, newsText.String())

	response, err := llm.GenerateContent(ctx, []llms.MessageContent{
		{
			Parts: []llms.ContentPart{llms.TextPart(prompt)},
			Role:  llms.ChatMessageTypeHuman,
		},
	})

	if err != nil {
		return nil, fmt.Errorf("AI generation failed: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response from AI")
	}

	responseText := cleanAIJSON(response.Choices[0].Content)

	var summary model.AINewsSummary
	if err := json.Unmarshal([]byte(responseText), &summary); err != nil {
		return nil, fmt.Errorf("parsing AI response: %w", err)
	}

	summary.Date = time.Now()

	// Cache summary for 4 hours to avoid running the prompt continuously but keep it fresh
	s.cache.Set(cacheKey, &summary, 4*time.Hour)

	return &summary, nil
}

// GetNews returns cached or freshly fetched financial news
func (s *NewsService) GetNews(ctx context.Context, limit int) ([]model.NewsItem, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	cacheKey := "news:all"
	if cached, found := s.cache.Get(cacheKey); found {
		if items, ok := cached.([]model.NewsItem); ok {
			if len(items) > limit {
				return items[:limit], nil
			}
			return items, nil
		}
	}

	items, err := s.fetchAllFeeds(ctx)
	if err != nil {
		return nil, err
	}

	s.cache.Set(cacheKey, items, s.cacheTTL)

	if len(items) > limit {
		return items[:limit], nil
	}
	return items, nil
}

func (s *NewsService) fetchAllFeeds(ctx context.Context) ([]model.NewsItem, error) {
	var allItems []model.NewsItem

	for _, feed := range defaultFeeds {
		items, err := s.fetchFeed(ctx, feed)
		if err != nil {
			log.Warn().Err(err).Str("source", feed.Name).Msg("Failed to fetch RSS feed")
			continue
		}
		allItems = append(allItems, items...)
	}

	if len(allItems) == 0 {
		return nil, fmt.Errorf("no news items fetched from any feed")
	}

	// Sort by published date descending
	sort.Slice(allItems, func(i, j int) bool {
		return allItems[i].PublishedAt.After(allItems[j].PublishedAt)
	})

	// Cap at 30 items
	if len(allItems) > 30 {
		allItems = allItems[:30]
	}

	return allItems, nil
}

func (s *NewsService) fetchFeed(ctx context.Context, source feedSource) ([]model.NewsItem, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "CoAI/1.0 RSS Reader")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RSS feed returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, err
	}

	var feed rssFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("parsing RSS XML: %w", err)
	}

	var items []model.NewsItem
	for _, item := range feed.Channel.Items {
		pubDate := parseRSSDate(item.PubDate)

		// Clean description
		desc := stripHTML(html.UnescapeString(item.Description))
		if len(desc) > 200 {
			desc = desc[:200] + "..."
		}

		imageURL := item.Enclosure.URL
		if imageURL == "" {
			imageURL = item.MediaContent.URL
		}

		items = append(items, model.NewsItem{
			Title:       html.UnescapeString(item.Title),
			Description: desc,
			Source:      source.Name,
			URL:         item.Link,
			ImageURL:    imageURL,
			PublishedAt: pubDate,
			Category:    source.Category,
		})
	}

	return items, nil
}

func parseRSSDate(dateStr string) time.Time {
	formats := []string{
		time.RFC1123Z,
		time.RFC1123,
		"Mon, 02 Jan 2006 15:04:05 -0700",
		"Mon, 02 Jan 2006 15:04:05 MST",
		"2006-01-02T15:04:05Z",
		time.RFC3339,
	}
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t
		}
	}
	return time.Now()
}

func stripHTML(s string) string {
	var result strings.Builder
	inTag := false
	for _, r := range s {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			result.WriteRune(r)
		}
	}
	return strings.TrimSpace(result.String())
}
