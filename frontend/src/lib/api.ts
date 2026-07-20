/**
 * Typed API client for GraphMind AI backend.
 * All requests go through the NEXT_PUBLIC_API_URL env variable (default: http://localhost:8000).
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Provider = "default" | "openai" | "anthropic" | "google" | "groq";

export interface PlatformSettings {
  provider: Provider;
  model: string;
  api_key: string | null;
  base_url: string;
  temperature: number;
  chat_provider: Provider;
  chat_model: string;
  chat_api_key: string | null;
  chat_base_url: string;
  chat_temperature: number;
  max_graph_depth: number;
  max_neighborhood_size: number;
  auto_link_graphs: boolean;
  graph_cache_ttl: number;
  jwt_auth: boolean;
  rate_limiting: boolean;
  api_throttling: boolean;
  audit_logs: boolean;
}

export interface GraphMeta {
  id: string;
  name: string;
  source_type: string;
  source_label: string;
  status: string;
  node_count: number;
  edge_count: number;
  created_at: string;
}

export interface AnalyticsOverview {
  total_graphs: number;
  total_nodes: number;
  total_edges: number;
  total_documents: number;
  total_queries: number;
  active_agents: number;
  avg_latency_ms: number;
  uptime_pct: number;
  storage_mb: number;
  avg_node_degree: number;
}

export interface WeeklyDay {
  day: string;
  date: string;
  queries: number;
  ingestions: number;
  nodes_created: number;
}

// ─── Generic fetch helper ─────────────────────────────────────────────────────

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => api<PlatformSettings>("/api/v1/settings"),
  save: (data: Partial<PlatformSettings>) =>
    api<PlatformSettings>("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ─── Graphs ───────────────────────────────────────────────────────────────────

export const graphsApi = {
  list: () => api<GraphMeta[]>("/api/v1/graphs"),
  get: (id: string) => api<GraphMeta>(`/api/v1/graphs/${id}`),

  create: (data: { name: string; source_type: string; source_label: string }) =>
    api<GraphMeta>("/api/v1/graphs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  rename: (id: string, name: string) =>
    api<GraphMeta>(`/api/v1/graphs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  delete: (id: string) =>
    fetch(`${BASE}/api/v1/graphs/${id}`, { method: "DELETE", credentials: "include" }),

  nodes: (id: string, limit = 200) =>
    api<{ nodes: unknown[]; count: number }>(`/api/v1/graphs/${id}/nodes?limit=${limit}`),

  edges: (id: string, limit = 500) =>
    api<{ edges: unknown[]; count: number }>(`/api/v1/graphs/${id}/edges?limit=${limit}`),

  exportUrl: (id: string) => `${BASE}/api/v1/graphs/${id}/export`,
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: (formData: FormData) =>
    fetch(`${BASE}/api/v1/documents/upload`, {
      method: "POST",
      body: formData, // No Content-Type header — browser sets multipart boundary
      credentials: "include",
    }).then((r) => {
      if (!r.ok) throw new Error("Upload failed");
      return r.json();
    }),

  uploadUrl: (data: { source_url: string; source_type: string; name: string; extraction_level?: string; focus_topic?: string }) =>
    api<{ task_id: string; message: string }>("/api/v1/documents/upload-url", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: () => api<GraphMeta[]>("/api/v1/documents"),
};

// ─── Chat streaming ───────────────────────────────────────────────────────────

export interface ChatMessage { role: string; content: string }

export type ChatChunk =
  | { delta: string; done: false; error?: string }
  | { delta: string; done: true; citations: string[]; error?: string };

/**
 * Streams chat completions via SSE.
 * `onChunk` is called for every token. `onDone` fires with citations when finished.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function streamChat(params: {
  messages: ChatMessage[];
  graph_ids: string[];
  provider?: string;
  model?: string;
  api_key?: string;
  onChunk: (delta: string) => void;
  onDone: (citations: string[]) => void;
  onError: (err: string) => void;
}): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: params.messages,
          graph_ids: params.graph_ids,
          provider: params.provider,
          model: params.model,
          api_key: params.api_key,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        params.onError(`Chat API error: ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const chunk = JSON.parse(raw) as ChatChunk;
            if (chunk.error) {
              params.onError(chunk.error);
              return;
            }
            if (chunk.done) {
              params.onDone((chunk as { done: true; citations: string[] }).citations ?? []);
              return;
            }
            params.onChunk(chunk.delta);
          } catch {
            // Ignore malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        params.onError(err.message);
      }
    }
  })();

  return controller;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: () => api<AnalyticsOverview>("/api/v1/analytics/overview"),
  weekly: () => api<{ days: WeeklyDay[] }>("/api/v1/analytics/weekly"),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  streamNotifications: () => {
    // Return the EventSource so the caller can close it or listen to specific events
    // We use withCredentials to pass the JWT cookie for authentication
    return new EventSource(`${BASE}/api/v1/notifications/stream`, {
      withCredentials: true,
    });
  },
  history: () => api<any[]>("/api/v1/notifications"),
  markAllAsRead: () => api<{ status: string }>("/api/v1/notifications/mark-read", { method: "PATCH" }),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => api<{ status: string }>("/health"),
  databases: () =>
    api<{ status: string; services: Record<string, string> }>("/health/dbs").catch(
      () => ({ status: "degraded", services: {} })
    ),
};
