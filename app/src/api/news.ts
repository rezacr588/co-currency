import { fetchAPI } from './base';

export interface NewsItem {
  title: string;
  description: string;
  source: string;
  url: string;
  image_url?: string;
  published_at: string;
  category: string;
}

export interface AINewsSummary {
  date: string;
  summary: string;
  recommendations: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'volatile';
  has_breaking_news: boolean;
}

export const news = {
  list: (limit?: number) => fetchAPI<NewsItem[]>(`/news${limit ? `?limit=${limit}` : ''}`),
  summary: () => fetchAPI<AINewsSummary>('/news/summary'),
};
