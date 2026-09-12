import { addDays } from "@/lib/domain/dates";
import type { Entry, EntryKind, IsoDate } from "@/lib/domain/types";
import type { Repositories } from "@/lib/repositories";

export interface DescriptionSuggestion {
  description: string;
  categoryId: string | null;
  accountId: string;
  counterAccountId: string | null;
}

export interface EntrySuggestions {
  /** Distinct recent descriptions per kind, most recent first, with what was used last time. */
  descriptions: Record<EntryKind, DescriptionSuggestion[]>;
  /** Most-used categories per kind, ids, most used first. */
  topCategories: Record<EntryKind, string[]>;
}

const LOOKBACK_DAYS = 180;
const MAX_DESCRIPTIONS = 30;
const MAX_CATEGORIES = 4;

const empty = (): Record<EntryKind, never[]> => ({ expense: [], income: [], transfer: [], contribution: [] });

/** What the last six months suggest for the next entry: same description → same category and account. */
export async function entrySuggestions(repos: Repositories, userId: string, today: IsoDate): Promise<EntrySuggestions> {
  const entries = await repos.entries.list(userId, { from: addDays(today, -LOOKBACK_DAYS), to: today });
  return suggestionsFrom(entries);
}

/** Pure: `entries` newest first. */
export function suggestionsFrom(entries: Entry[]): EntrySuggestions {
  const descriptions: Record<EntryKind, DescriptionSuggestion[]> = empty();
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.kind}:${e.description.trim().toLowerCase()}`;
    if (!seen.has(key) && descriptions[e.kind].length < MAX_DESCRIPTIONS) {
      seen.add(key);
      descriptions[e.kind].push({ description: e.description.trim(), categoryId: e.categoryId, accountId: e.accountId, counterAccountId: e.counterAccountId });
    }
    if (e.categoryId) {
      const ck = `${e.kind}:${e.categoryId}`;
      counts.set(ck, (counts.get(ck) ?? 0) + 1);
    }
  }
  const topCategories: Record<EntryKind, string[]> = empty();
  for (const [key] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const [kind, id] = key.split(":") as [EntryKind, string];
    if (topCategories[kind].length < MAX_CATEGORIES) topCategories[kind].push(id);
  }
  return { descriptions, topCategories };
}
