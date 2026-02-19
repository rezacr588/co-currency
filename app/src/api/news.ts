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

export const news = {
  list: (limit?: number) =>
    fetchAPI<NewsItem[]>(`/news${limit ? `?limit=${limit}` : ''}`),
};
