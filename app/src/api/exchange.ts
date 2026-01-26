import type { Currency, RatesResponse, ConversionResult, ConversionRequest } from '../types';
import { fetchAPI } from './base';
import { buildQuery } from './utils';

export const currencies = {
  list: () => fetchAPI<Currency[]>('/currencies'),
};

export const rates = {
  latest: (base: string) => fetchAPI<RatesResponse>(`/rates/${base}`),
  historical: (date: string, base: string) =>
    fetchAPI<RatesResponse>(`/historical/${date}${buildQuery({ base })}`),
};

export const convert = (params: ConversionRequest) =>
  fetchAPI<ConversionResult>(
    `/convert${buildQuery({ from: params.from, to: params.to, amount: params.amount })}`
  );
