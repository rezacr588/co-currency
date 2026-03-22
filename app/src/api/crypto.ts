import { fetchAPI } from './base';

// ==================== Types ====================

export interface BlockchainNetwork {
  id: string;
  name: string;
  symbol: string;
}

export interface CryptoWallet {
  id: string;
  user_id: string;
  address: string;
  network: string;
  label?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CryptoBalance {
  id: string;
  wallet_id: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  token_decimals: number;
  balance: string;
  balance_usd: number;
  price_usd: number;
  price_change_24h: number;
  token_type: 'native' | 'erc20' | 'nft';
  logo_url?: string;
  updated_at: string;
}

export interface CryptoTransaction {
  id: string;
  wallet_id: string;
  tx_hash: string;
  block_number: number;
  timestamp: string;
  from_address: string;
  to_address: string;
  token_address: string;
  token_symbol: string;
  amount: string;
  amount_usd: number;
  gas_used: number;
  gas_price: string;
  tx_type: 'send' | 'receive' | 'swap' | 'approve' | 'contract';
  status: 'pending' | 'confirmed' | 'failed';
}

export interface DeFiPosition {
  id: string;
  wallet_id: string;
  protocol: string;
  protocol_logo?: string;
  position_type: 'lending' | 'borrowing' | 'liquidity' | 'staking' | 'farming' | 'vault';
  token_symbol: string;
  token_address: string;
  amount: string;
  value_usd: number;
  apy: number;
  health_factor?: number;
  collateral_usd?: number;
  debt_usd?: number;
  network: string;
  updated_at: string;
}

export interface NFTAsset {
  id: string;
  wallet_id: string;
  contract_address: string;
  token_id: string;
  name: string;
  description?: string;
  image_url?: string;
  collection_name: string;
  collection_slug?: string;
  network: string;
  floor_price_usd?: number;
  last_sale_usd?: number;
  rarity_rank?: number;
  traits?: Record<string, string>;
}

export interface CryptoAlert {
  id: string;
  user_id: string;
  token_symbol: string;
  token_address: string;
  network: string;
  condition: 'above' | 'below';
  target_value: number;
  current_value?: number;
  is_active: boolean;
  triggered_at?: string;
  created_at: string;
}

export interface TokenPriceResponse {
  address: string;
  network: string;
  symbol: string;
  name: string;
  price_usd: number;
  price_change_24h: number;
  market_cap?: number;
  volume_24h?: number;
  updated_at: string;
}

export interface GasPrice {
  network: string;
  slow: number;
  standard: number;
  fast: number;
  instant: number;
  base_fee?: number;
  priority_fee?: number;
  updated_at: string;
}

export interface WalletResponse {
  wallet: CryptoWallet;
  balances: CryptoBalance[];
  total_value_usd: number;
}

export interface PortfolioSummary {
  total_value_usd: number;
  total_change_24h: number;
  total_change_24h_percent: number;
  wallets: WalletResponse[];
  top_holdings: CryptoBalance[];
  network_breakdown: { network: string; value_usd: number; percentage: number }[];
}

export interface DeFiOverview {
  total_supplied_usd: number;
  total_borrowed_usd: number;
  total_rewards_usd: number;
  net_worth_usd: number;
  avg_apy: number;
  positions: DeFiPosition[];
  protocol_breakdown: { protocol: string; value_usd: number; positions: number }[];
}

// ==================== Request Types ====================

export interface AddWalletRequest {
  address: string;
  network: string;
  label?: string;
  is_primary?: boolean;
}

export interface CreateAlertRequest {
  token_symbol: string;
  token_address: string;
  network: string;
  condition: 'above' | 'below';
  target_value: number;
}

export interface TransactionFilter {
  type?: string;
  token?: string;
  limit?: number;
  offset?: number;
}

// ==================== API Functions ====================

// Wallet endpoints
export const addWallet = async (request: AddWalletRequest): Promise<CryptoWallet> => {
  return fetchAPI<CryptoWallet>('/crypto/wallets', {
    method: 'POST',
    body: JSON.stringify(request),
  });
};

export const getWallet = async (walletId: string): Promise<WalletResponse> => {
  return fetchAPI<WalletResponse>(`/crypto/wallets/${walletId}`);
};

export const listWallets = async (): Promise<{ wallets: CryptoWallet[] }> => {
  return fetchAPI<{ wallets: CryptoWallet[] }>('/crypto/wallets');
};

export const deleteWallet = async (walletId: string): Promise<void> => {
  await fetchAPI<void>(`/crypto/wallets/${walletId}`, {
    method: 'DELETE',
  });
};

export const syncWallet = async (walletId: string): Promise<{ message: string }> => {
  return fetchAPI<{ message: string }>(`/crypto/wallets/${walletId}/sync`, {
    method: 'POST',
  });
};

// Portfolio endpoints
export const getPortfolioSummary = async (): Promise<PortfolioSummary> => {
  return fetchAPI<PortfolioSummary>('/crypto/portfolio');
};

export const getDeFiOverview = async (): Promise<DeFiOverview> => {
  return fetchAPI<DeFiOverview>('/crypto/defi');
};

export const syncAllWallets = async (): Promise<{ message: string }> => {
  return fetchAPI<{ message: string }>('/crypto/sync', {
    method: 'POST',
  });
};

// Transaction endpoints
export const getWalletTransactions = async (
  walletId: string,
  filter?: TransactionFilter
): Promise<{ transactions: CryptoTransaction[]; total: number; limit: number; offset: number }> => {
  const params = new URLSearchParams();
  if (filter?.type) params.append('type', filter.type);
  if (filter?.token) params.append('token', filter.token);
  if (filter?.limit) params.append('limit', String(filter.limit));
  if (filter?.offset) params.append('offset', String(filter.offset));
  
  const queryString = params.toString();
  const url = queryString 
    ? `/crypto/wallets/${walletId}/transactions?${queryString}` 
    : `/crypto/wallets/${walletId}/transactions`;
  
  return fetchAPI<{ transactions: CryptoTransaction[]; total: number; limit: number; offset: number }>(url);
};

// Alert endpoints
export const createAlert = async (request: CreateAlertRequest): Promise<CryptoAlert> => {
  return fetchAPI<CryptoAlert>('/crypto/alerts', {
    method: 'POST',
    body: JSON.stringify(request),
  });
};

export const listAlerts = async (activeOnly?: boolean): Promise<{ alerts: CryptoAlert[] }> => {
  const url = activeOnly ? '/crypto/alerts?active=true' : '/crypto/alerts';
  return fetchAPI<{ alerts: CryptoAlert[] }>(url);
};

export const deleteAlert = async (alertId: string): Promise<void> => {
  await fetchAPI<void>(`/crypto/alerts/${alertId}`, {
    method: 'DELETE',
  });
};

// Price endpoints
export const getTokenPrice = async (address: string, network: string): Promise<TokenPriceResponse> => {
  return fetchAPI<TokenPriceResponse>(`/crypto/prices?address=${encodeURIComponent(address)}&network=${encodeURIComponent(network)}`);
};

export const getGasPrices = async (network?: string): Promise<GasPrice> => {
  const url = network ? `/crypto/gas?network=${encodeURIComponent(network)}` : '/crypto/gas';
  return fetchAPI<GasPrice>(url);
};

export const getSupportedNetworks = async (): Promise<{ networks: BlockchainNetwork[] }> => {
  return fetchAPI<{ networks: BlockchainNetwork[] }>('/crypto/networks');
};

// Export all as namespace for convenience
export const cryptoApi = {
  // Wallets
  addWallet,
  getWallet,
  listWallets,
  deleteWallet,
  syncWallet,
  
  // Portfolio
  getPortfolioSummary,
  getDeFiOverview,
  syncAllWallets,
  
  // Transactions
  getWalletTransactions,
  
  // Alerts
  createAlert,
  listAlerts,
  deleteAlert,
  
  // Prices
  getTokenPrice,
  getGasPrices,
  getSupportedNetworks,
};

export default cryptoApi;
