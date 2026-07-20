import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PlatformSettings, Provider } from "@/lib/api";
import { settingsApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsStore {
  // Current settings state
  settings: PlatformSettings;
  loading: boolean;
  saved: boolean;
  error: string | null;

  // Actions
  loadFromAPI: () => Promise<void>;
  updateField: <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => void;
  saveToAPI: () => Promise<void>;
  resetToDefaults: () => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: PlatformSettings = {
  provider: "default",
  model: "gemma4:26b",
  api_key: null,
  base_url: "http://localhost:11434",

  temperature: 0.0,
  chat_provider: "default",
  chat_model: "llama3.2:3b",
  chat_api_key: null,
  chat_base_url: "http://localhost:11434",
  chat_temperature: 0.0,
  max_graph_depth: 5,
  max_neighborhood_size: 50,
  auto_link_graphs: true,
  graph_cache_ttl: 3600,
  jwt_auth: true,
  rate_limiting: true,
  api_throttling: false,
  audit_logs: true,
};

// ─── Provider display info ─────────────────────────────────────────────────────

export const PROVIDER_INFO: Record<Provider, { label: string; color: string }> = {
  default: {
    label: "System Default (Free)",
    color: "text-blue-400",
  },
  openai: {
    label: "OpenAI",
    color: "text-cyan-400",
  },
  anthropic: {
    label: "Anthropic",
    color: "text-violet-400",
  },
  google: {
    label: "Google Gemini",
    color: "text-amber-400",
  },
  groq: {
    label: "Groq",
    color: "text-rose-400",
  },
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      loading: false,
      saved: false,
      error: null,

      loadFromAPI: async () => {
        set({ loading: true, error: null });
        try {
          const data = await settingsApi.get();
          set({ settings: { ...DEFAULT_SETTINGS, ...data }, loading: false });
        } catch (e: any) {
          set({ loading: false, error: e.message || "Failed to connect to backend API." });
        }
      },

      updateField: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
          saved: false,
          error: null,
        })),

      saveToAPI: async () => {
        const { settings } = get();
        set({ loading: true, saved: false, error: null });
        try {
          const saved = await settingsApi.save(settings);
          set({ settings: { ...settings, ...saved }, loading: false, saved: true });
          // Reset "saved" tick after 3s
          setTimeout(() => set({ saved: false }), 3000);
        } catch (e: any) {
          set({ loading: false, error: e.message || "Failed to save settings to backend API." });
        }
      },

      resetToDefaults: () => set({ settings: DEFAULT_SETTINGS, saved: false, error: null }),
    }),
    {
      name: "graphmind-settings",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
          : localStorage
      ),
    }
  )
);
