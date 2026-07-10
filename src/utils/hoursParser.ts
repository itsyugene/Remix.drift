import { HoursResult } from '../types.ts';

function clean(value: string | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeDay(day: string): string {
  if (day.length < 2) return day;
  return day[0].toUpperCase() + day[1].toLowerCase();
}

function parseDays(dayPart: string | undefined, order: string[]): Set<number> | null {
  const text = String(dayPart || "").trim();
  if (!text) return new Set(order.map((_, index) => index));

  const out = new Set<number>();
  for (const token of text.split(",")) {
    const value = token.trim();
    if (!value) continue;
    const match = value.match(/^([A-Za-z]{2})(?:\s*-\s*([A-Za-z]{2}))?$/);
    if (!match) return null;
    const first = order.indexOf(normalizeDay(match[1]));
    if (first < 0) return null;
    if (!match[2]) {
      out.add(first);
      continue;
    }
    const last = order.indexOf(normalizeDay(match[2]));
    if (last < 0) return null;
    let current = first;
    while (true) {
      out.add(current);
      if (current === last) break;
      current = (current + 1) % 7;
    }
  }
  return out;
}

function parseTimeRanges(value: string): [number, number][] | null {
  const ranges: [number, number][] = [];
  for (const segment of value.split(",")) {
    const match = segment.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const startHour = Number(match[1]);
    const startMin = Number(match[2]);
    const endHour = Number(match[3]);
    const endMin = Number(match[4]);
    if (startHour > 24 || endHour > 24 || startMin > 59 || endMin > 59) return null;
    ranges.push([startHour * 60 + startMin, endHour * 60 + endMin]);
  }
  return ranges;
}

export function parseHours(raw: string | undefined, now: Date = new Date()): HoursResult {
  if (!raw) return { state: "none" };
  try {
    const text = String(raw).trim();
    if (/^24\s*\/\s*7$/i.test(text)) return { state: "open", always: true };

    const order = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const today = (now.getDay() + 6) % 7;
    const yesterday = (today + 6) % 7;
    const minutes = now.getHours() * 60 + now.getMinutes();
    let foundRule = false;
    let foundToday = false;
    let closedToday = false;
    let unparsed = false;
    let next: number | null = null;

    for (const chunk of text.split(";")) {
      const rule = chunk.trim();
      if (!rule) continue;
      if (/\b(PH|SH)\b/i.test(rule)) continue;

      const match = rule.match(/^([A-Za-z ,\-]*?)\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*|off|closed)$/i);
      if (!match) {
        unparsed = true;
        continue;
      }

      foundRule = true;
      const days = parseDays(match[1], order);
      if (!days) {
        unparsed = true;
        continue;
      }

      const timePart = match[2].trim();
      const appliesToday = days.has(today);
      const appliesYesterday = days.has(yesterday);
      if (/^(off|closed)$/i.test(timePart)) {
        if (appliesToday) {
          foundToday = true;
          closedToday = true;
        }
        continue;
      }

      const ranges = parseTimeRanges(timePart);
      if (!ranges) {
        unparsed = true;
        continue;
      }

      if (appliesYesterday) {
        for (const [start, end] of ranges) {
          if (end < start && minutes < end) return { state: "open", until: end };
        }
      }

      if (appliesToday) {
        foundToday = true;
        for (const [start, end] of ranges) {
          if (end < start) {
            if (minutes >= start) return { state: "open", until: end };
          } else if (minutes >= start && minutes < (end === start ? end + 1 : end)) {
            return { state: "open", until: end };
          }
          if (start > minutes && (next === null || start < next)) next = start;
        }
      }
    }

    if (next !== null) return { state: "closed", next };
    if (closedToday || foundToday) return { state: "closed", next: null };
    if (unparsed || !foundRule) return { state: "unknown" };
    return { state: "closed", next: null };
  } catch (error) {
    return { state: "unknown" };
  }
}

export function formatHM(minutes: number): string {
  const normalized = minutes % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
