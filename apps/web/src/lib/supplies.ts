import { supplyForecast } from '@cathub/core';
import { useNow, useTz } from './board';
import { useSupplies } from './queries';

export function useSupplyForecasts() {
  const supplies = useSupplies();
  const tz = useTz();
  const now = useNow(60_000);
  return {
    list: (supplies.data ?? []).map((s) => ({
      supply: s,
      f: supplyForecast(
        { stock: s.stock, stockAt: s.stock_at, dailyUsage: s.daily_usage, lowDays: s.low_days },
        now,
        tz,
      ),
    })),
    isLoading: supplies.isLoading,
  };
}
