import { useQuery } from '@tanstack/react-query';

export interface Holiday {
  date: string; // yyyy-MM-dd
  localName: string;
  name: string;
}

async function fetchHolidays(year: number): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/CL`);
  if (!res.ok) return [];
  return res.json();
}

export function useHolidays(year: number) {
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => fetchHolidays(year),
    staleTime: 1000 * 60 * 60 * 24, // cache 24h
  });

  const holidayMap = new Map<string, string>();
  for (const h of holidays) {
    holidayMap.set(h.date, h.localName);
  }

  return { holidays, holidayMap };
}
