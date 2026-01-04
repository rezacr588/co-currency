export interface Currency {
  code: string;
  name: string;
  symbol: string;
  priority: number;
}

export interface Rate {
  code: string;
  name: string;
  rate: number;
  change?: number;
}

export interface RatesResponse {
  base: string;
  date: string;
  rates: Rate[];
  updated_at: string;
}

export interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  updated_at: string;
}

export interface ConversionRequest {
  from: string;
  to: string;
  amount: number;
}
