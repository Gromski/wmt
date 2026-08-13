import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// IN-01: Shared utility — previously duplicated in app/dashboard/page.tsx
// and components/GlobalHeader.tsx. Returns up to two uppercase initials.
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

// First name only — used on the analytics surface for a less formal tone
// (e.g. "Mark" instead of "Mark Wright"). Falls back to the full string.
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
