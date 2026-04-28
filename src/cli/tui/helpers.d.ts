export function buildHelpLines(): string[];

export function truncateStackTrace(
  stack: string | null | undefined,
  maxLines?: number
): string[];
