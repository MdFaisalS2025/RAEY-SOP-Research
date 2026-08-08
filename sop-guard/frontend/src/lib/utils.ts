import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "10:42 AM" in the reader's own locale/timezone - shared by the user and
 * assistant message timestamps in the Ask Meridian thread so both use the
 * same format. */
export function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
