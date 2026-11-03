import { format } from "date-fns";

// Day, month, year and hour:minute in the viewer's time zone, without seconds ("03/11/2026 14:05").
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "dd/MM/yyyy HH:mm");
}

// Vietnamese thousands separator ("199.000đ"), written out so it does not depend on the browser's locale data.
export function formatVnd(amount: number): string {
  const rounded = Math.round(amount);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}${digits}đ`;
}
