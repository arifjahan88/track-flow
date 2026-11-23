import dayjs from "dayjs";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatKm(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "0.0";
}

export function formatSpeed(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n)) : "0";
}

export function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatShortDate(iso: string): string {
  const parsed = dayjs(iso);
  if (!parsed.isValid()) return iso;
  return parsed.format("MMM D, YYYY");
}

export function formatDateTime(iso: string): string {
  const parsed = dayjs(iso);
  if (!parsed.isValid()) return iso;
  return parsed.format("MMM D, h:mm A");
}

export function toIsoDate(value?: Date | string | null): string {
  if (!value) return dayjs().format("YYYY-MM-DD");
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
}

export function offsetIsoDate(daysOffset: number): string {
  return dayjs().add(daysOffset, "day").format("YYYY-MM-DD");
}
