import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import type { Transaction } from '../../../types/wallet';
import { buildDailyAggregation } from '../Reports/daily/aggregation';
import { getWindowRange, toRFC3339RangeStart, toRFC3339RangeEnd } from '../Reports/daily/time';
import { REPORT_CURRENCY, PAGE_SIZE } from '../Reports/daily/constants';

interface DayData {
  date: string;
  amount: number;
  count: number;
}

interface UseHeatMapDataResult {
  data: DayData[];
  currency: string;
  isPending: boolean;
}

const WINDOW_DAYS = 84; // 12 weeks
const FETCH_CAP = 2000;

async function fetchHeatMapData(fromTs: string, toTs: string, currency: string) {
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const all: Transaction[] = [];

  while (all.length < total && all.length < FETCH_CAP) {
    const page = await api.wallet.getTransactions(PAGE_SIZE, offset, {
      from_ts: fromTs,
      to_ts: toTs,
    });
    const txs = page.transactions || [];
    total = Number.isFinite(page.total) ? page.total : txs.length;
    if (txs.length === 0) break;
    all.push(...txs.slice(0, FETCH_CAP - all.length));
    if (txs.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const rates: Record<string, number> = { [currency]: 1 };
  const distinct = Array.from(
    new Set(all.map((tx) => tx.currency).filter((c): c is string => Boolean(c) && c !== currency))
  );

  await Promise.all(
    distinct.map(async (c) => {
      try {
        const res = await api.convert({ from: c, to: currency, amount: 1 });
        if (Number.isFinite(res.rate) && res.rate > 0) rates[c] = res.rate;
      } catch {
        // skip
      }
    })
  );

  return { transactions: all, rates };
}

export function useHeatMapData(timeZone: string, currency = REPORT_CURRENCY): UseHeatMapDataResult {
  const { start, end } = useMemo(() => getWindowRange(WINDOW_DAYS, 0, timeZone), [timeZone]);
  const fromTs = toRFC3339RangeStart(start, timeZone);
  const toTs = toRFC3339RangeEnd(end, timeZone);

  const { data: raw, isPending } = useQuery({
    queryKey: ['heatmap', timeZone, currency],
    queryFn: () => fetchHeatMapData(fromTs, toTs, currency),
    staleTime: 5 * 60 * 1000,
  });

  const data = useMemo<DayData[]>(() => {
    if (!raw) return [];
    const agg = buildDailyAggregation(start, WINDOW_DAYS, raw.transactions, raw.rates, currency, timeZone);
    return agg.daySummaries.map((day) => ({
      date: day.dateKey,
      amount: day.expenses,
      count: day.txCount,
    }));
  }, [raw, start, currency, timeZone]);

  return { data, currency, isPending };
}
