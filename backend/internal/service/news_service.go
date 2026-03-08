package service

import (
	"context"
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
	{URL: "https://feeds.content.dowjones.io/public/rss/mw_topstories", Name: "MarketWatch", Category: "markets"},
	{URL: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US", Name: "Yahoo Finance", Category: "finance"},
	{URL: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", Name: "CNBC", Category: "finance"},
}

// NewsService fetches and caches financial news from RSS feeds
type NewsService struct {
	cache    *gocache.Cache
	cacheTTL time.Duration
	client   *http.Client
}

// NewNewsService creates a new NewsService
func NewNewsService(cacheTTL time.Duration) *NewsService {
	return &NewsService{
		cache:    gocache.New(cacheTTL, 10*time.Minute),
		cacheTTL: cacheTTL,
		client:   &http.Client{Timeout: 10 * time.Second},
	}
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
