"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin wrapper so the root layout (a Server Component) can mount next-themes,
// which must run on the client. Toggles the `.dark` class on <html>, matching
// the `@custom-variant dark (&:is(.dark *))` in globals.css.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
