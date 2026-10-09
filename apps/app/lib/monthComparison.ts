export interface MonthComparisonPeriod {
  from: string; to: string; total: number; entries: number;
  fx: { estimated_entries: number; unconverted_entries: number };
}
export interface MonthComparison { current: MonthComparisonPeriod; previous: MonthComparisonPeriod }
export function monthComparisonLabel(value?: MonthComparison): string | null {
  if (!value) return null;
  const { current, previous } = value;
  if (!Number.isFinite(current.total) || !Number.isFinite(previous.total) || previous.total <= 0 || current.total < 0
    || current.fx.unconverted_entries || previous.fx.unconverted_entries) return null;
  const delta = current.total - previous.total;
  const percent = Math.round(Math.abs(delta / previous.total) * 1000) / 10;
  const estimated = current.fx.estimated_entries > 0 || previous.fx.estimated_entries > 0;
  const direction = delta > 0 ? 'more' : 'less';
  const amount = delta === 0 ? (estimated ? 'About the same captured amount' : 'Same captured amount')
    : `${estimated ? 'About ' : ''}${percent === 0 ? 'Less than 0.1' : percent}% ${direction} captured`;
  const showYear = current.from.slice(0, 4) !== previous.from.slice(0, 4);
  const label = (period: MonthComparisonPeriod) => {
    const [year, month, end] = period.to.split('-').map(Number);
    const start = Number(period.from.slice(8, 10));
    const name = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];
    return `${start === end ? start : `${start}–${end}`} ${name}${showYear ? ` ${year}` : ''}`;
  };
  return `${amount} · ${label(current)} vs ${label(previous)}`;
}
