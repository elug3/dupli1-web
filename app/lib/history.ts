const KEY = "dupli1_history";
const VIEWS_KEY = "dupli1_recent_views";
const MAX = 20;
const MAX_VIEWS = 12;

export interface HistoryEntry {
  id: string;
  query: string;
  category: string;
  timestamp: number;
}

export interface ViewedProduct {
  id: string;
  name: string;
  brand: string;
  image?: string;
  timestamp: number;
}

export function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function pushHistory(query: string, category: string): void {
  try {
    const list = getHistory().filter(
      (h) => !(h.query === query && h.category === category)
    );
    const updated = [
      {
        id: Date.now().toString(),
        query,
        category,
        timestamp: Date.now(),
      },
      ...list,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // no-op in SSR
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op in SSR
  }
}

export function getRecentViews(): ViewedProduct[] {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "[]") as ViewedProduct[];
  } catch {
    return [];
  }
}

export function pushRecentView(product: Omit<ViewedProduct, "timestamp">): void {
  try {
    const list = getRecentViews().filter((entry) => entry.id !== product.id);
    const updated = [{ ...product, timestamp: Date.now() }, ...list].slice(0, MAX_VIEWS);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(updated));
  } catch {
    // no-op in SSR
  }
}

export function clearRecentViews(): void {
  try {
    localStorage.removeItem(VIEWS_KEY);
  } catch {
    // no-op in SSR
  }
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
