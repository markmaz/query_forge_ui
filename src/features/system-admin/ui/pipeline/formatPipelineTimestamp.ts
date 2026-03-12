function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function parseSqlLikeTimestamp(raw: string): Date | null {
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?$/
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const millis = fraction ? Number((fraction + "000").slice(0, 3)) : 0;

  const parsed = new Date(year, month - 1, day, hour, minute, second, millis);
  if (Number.isNaN(parsed.getTime())) return null;

  // Guard against rollovers from invalid values (e.g. month 13).
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute ||
    parsed.getSeconds() !== second
  ) {
    return null;
  }

  return parsed;
}

function parseEpoch(raw: string): Date | null {
  if (!/^\d+$/.test(raw)) return null;
  const numeric = Number(raw);
  if (!isFiniteNumber(numeric)) return null;

  // Treat 10-digit (or shorter) values as seconds; longer values as milliseconds.
  const millis = raw.length <= 10 ? numeric * 1000 : numeric;
  const parsed = new Date(millis);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimestamp(value: unknown): Date | null {
  if (value == null) return null;

  if (typeof value === "number") {
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const epochParsed = parseEpoch(raw);
  if (epochParsed) return epochParsed;

  const sqlLikeParsed = parseSqlLikeTimestamp(raw);
  if (sqlLikeParsed) return sqlLikeParsed;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  // Some APIs return "YYYY-MM-DD HH:mm:ss"; normalize for browser-safe parsing.
  if (raw.includes(" ")) {
    const isoLike = new Date(raw.replace(" ", "T"));
    if (!Number.isNaN(isoLike.getTime())) return isoLike;
  }

  return null;
}

export function formatPipelineTimestamp(value: unknown): string {
  const parsed = parseTimestamp(value);
  return parsed ? parsed.toLocaleString() : "\u2014";
}
