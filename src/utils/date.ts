export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function daysBetweenInclusive(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

export function isFullMonth(startDate: string, endDate: string): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const lastDayOfMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return (
    start.getDate() === 1 &&
    end.getDate() === lastDayOfMonth &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  );
}

export function countFullMonths(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let count = 0;

  let year = start.getFullYear();
  let month = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const firstDayOfThisMonth = new Date(year, month, 1);
    const lastDayOfThisMonth = new Date(year, month + 1, 0);
    const lastDayNum = lastDayOfThisMonth.getDate();

    const coversFullMonth =
      firstDayOfThisMonth.getTime() >= start.getTime() &&
      lastDayOfThisMonth.getTime() <= end.getTime();

    if (coversFullMonth) {
      count++;
    }

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return count;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getDaysInCurrentMonth(dateStr: string): number {
  const date = parseDate(dateStr);
  return getDaysInMonth(date.getFullYear(), date.getMonth());
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isNaturalMonth(startDate: string, endDate: string): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start.getDate() !== 1) return false;
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return end.getDate() === lastDay &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
}

export function isNaturalQuarter(startDate: string, endDate: string): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start.getDate() !== 1) return false;
  const startMonth = start.getMonth();
  const quarterStartMonths = [0, 3, 6, 9];
  if (!quarterStartMonths.includes(startMonth)) return false;
  const expectedEndMonth = startMonth + 2;
  const lastDay = new Date(end.getFullYear(), expectedEndMonth + 1, 0).getDate();
  return end.getDate() === lastDay &&
    start.getFullYear() === end.getFullYear() &&
    end.getMonth() === expectedEndMonth;
}

export function countNaturalMonthsInRange(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start > end) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

export function splitIntoNaturalMonths(startDate: string, endDate: string): { startDate: string; endDate: string }[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const periods: { startDate: string; endDate: string }[] = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const periodStart = current < start ? start : current;
    const periodEnd = lastDay > end ? end : lastDay;
    if (periodStart <= periodEnd) {
      periods.push({ startDate: formatDate(periodStart), endDate: formatDate(periodEnd) });
    }
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return periods;
}

export function splitIntoNaturalQuarters(startDate: string, endDate: string): { startDate: string; endDate: string }[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const periods: { startDate: string; endDate: string }[] = [];
  const quarterStartMonths = [0, 3, 6, 9];
  let qStartMonth = quarterStartMonths.find(m => m <= start.getMonth()) ?? 0;
  let current = new Date(start.getFullYear(), qStartMonth, 1);
  if (current > start) {
    const prevQMonth = quarterStartMonths.filter(m => m <= start.getMonth());
    qStartMonth = prevQMonth.length > 0 ? prevQMonth[prevQMonth.length - 1] : 0;
    current = new Date(start.getFullYear(), qStartMonth, 1);
  }
  while (current <= end) {
    const qEndMonth = current.getMonth() + 2;
    const lastDay = new Date(current.getFullYear(), qEndMonth + 1, 0);
    const periodStart = current < start ? start : current;
    const periodEnd = lastDay > end ? end : lastDay;
    if (periodStart <= periodEnd) {
      periods.push({ startDate: formatDate(periodStart), endDate: formatDate(periodEnd) });
    }
    current = new Date(current.getFullYear(), current.getMonth() + 3, 1);
  }
  return periods;
}

export function addMonths(dateStr: string, months: number): string {
  const date = parseDate(dateStr);
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
}

export function getOverlapRange(
  range1: { startDate: string; endDate: string },
  range2: { startDate: string; endDate: string }
): { startDate: string; endDate: string } | null {
  const start1 = parseDate(range1.startDate);
  const end1 = parseDate(range1.endDate);
  const start2 = parseDate(range2.startDate);
  const end2 = parseDate(range2.endDate);

  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;

  if (overlapStart > overlapEnd) {
    return null;
  }

  return {
    startDate: formatDate(overlapStart),
    endDate: formatDate(overlapEnd),
  };
}
