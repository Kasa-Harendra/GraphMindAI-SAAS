"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Topbar from "@/components/layout/Topbar";
import {
  TbCheck, TbLoader2, TbRefresh, TbEye, TbEyeOff,
  TbBrain, TbCloud, TbShieldLock, TbGraph,
  TbBolt, TbServer, TbCpu
} from "react-icons/tb";
import { SiOpenai, SiGooglegemini, SiAnthropic } from "react-icons/si";
import { useSettingsStore, PROVIDER_INFO } from "@/store/settingsStore";
import type { Provider } from "@/lib/api";

// ─── Section card wrapper ─────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2.5 pb-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ value, onChange, id }: { value: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5.5 rounded-full transition-colors ${value ? "bg-primary" : "bg-white/20"}`}
      style={{ height: "22px" }}
    >
      <motion.div
        animate={{ x: value ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

// ─── Text input ───────────────────────────────────────────────────────────────
function TextInput({ id, value, onChange, placeholder, type = "text" }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-64 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
    />
  );
}

// ─── Select input ─────────────────────────────────────────────────────────────
function Select({ id, value, onChange, options }: {
  id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-64 bg-[#111827] border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors appearance-none"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { settings, loading, saved, error, loadFromAPI, updateField, saveToAPI, resetToDefaults } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [showChatKey, setShowChatKey] = useState(false);

  useEffect(() => { loadFromAPI(); }, []);

  const providerInfo = PROVIDER_INFO[settings.provider as Provider];
  const needsApiKey = settings.provider !== "default";
  const chatProviderInfo = PROVIDER_INFO[settings.chat_provider as Provider];
  const needsChatApiKey = settings.chat_provider !== "default";

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Settings" subtitle="Configure AI providers, models, and platform behaviour" />

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-5">

        {/* ── LLM Provider ── */}
        <Section title="AI Model Provider" icon={TbBrain}>
          {/* Provider selector cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {(Object.entries(PROVIDER_INFO) as [Provider, typeof PROVIDER_INFO[Provider]][]).map(([key, info]) => (
              <button
                key={key}
                id={`provider-${key}`}
                onClick={() => {
                  updateField("provider", key);
                }}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all w-full
                  ${settings.provider === key
                    ? "bg-primary/15 border-primary/30 glow-purple"
                    : "glass hover:border-white/20 border-transparent"}`}
              >
                <span className={`flex items-center text-xs font-bold ${settings.provider === key ? "text-primary" : info.color}`}>
                  {key === "default" && <TbServer className="w-4 h-4 mr-1.5" />}
                  {key === "openai" && <SiOpenai className="w-4 h-4 mr-1.5" />}
                  {key === "anthropic" && <SiAnthropic className="w-4 h-4 mr-1.5" />}
                  {key === "groq" && <TbCpu className="w-4 h-4 mr-1.5" />}
                  {key === "google" && <SiGooglegemini className="w-4 h-4 mr-1.5" />}
                  {info.label}
                </span>
                {settings.provider === key && (
                  <TbCheck className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Model selector */}
          {settings.provider !== "default" && (
            <Field label="Model Name" hint="Enter the exact model string (e.g. gpt-4o, claude-3-5-sonnet-20241022)">
              <TextInput
                id="settings-model"
                value={settings.model}
                onChange={(v) => updateField("model", v)}
                placeholder="Model name"
              />
            </Field>
          )}



          {/* API Key (non-Ollama) */}
          {needsApiKey && (
            <Field label="API Key" hint="Your provider API key (stored securely, never sent to third parties)">
              <div className="relative">
                <input
                  id="settings-api-key"
                  type={showKey ? "text" : "password"}
                  value={settings.api_key ?? ""}
                  onChange={(e) => updateField("api_key", e.target.value)}
                  placeholder="sk-..."
                  className="w-64 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                />
                <button
                  id="toggle-api-key-visibility"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <TbEyeOff className="w-4 h-4" /> : <TbEye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          )}



          {/* Temperature */}
          <Field label="Temperature" hint={`Creativity level: ${(settings.temperature ?? 0).toFixed(1)} (0 = deterministic, 1 = creative)`}>
            <div className="flex items-center gap-3 w-64">
              <input
                id="settings-temperature"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.temperature ?? 0}
                onChange={(e) => updateField("temperature", parseFloat(e.target.value))}
                className="flex-1 accent-violet-500"
              />
              <span className="text-sm font-mono text-primary w-6 text-right">{(settings.temperature ?? 0).toFixed(1)}</span>
            </div>
          </Field>
        </Section>

        {/* ── Chat LLM Provider ── */}
        <Section title="Chat AI Model Provider" icon={TbBrain}>
          {/* Provider selector cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {(Object.entries(PROVIDER_INFO) as [Provider, typeof PROVIDER_INFO[Provider]][]).map(([key, info]) => (
              <button
                key={`chat-${key}`}
                id={`chat-provider-${key}`}
                onClick={() => {
                  updateField("chat_provider", key);
                }}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all w-full
                  ${settings.chat_provider === key
                    ? "bg-primary/15 border-primary/30 glow-purple"
                    : "glass hover:border-white/20 border-transparent"}`}
              >
                <span className={`flex items-center text-xs font-bold ${settings.chat_provider === key ? "text-primary" : info.color}`}>
                  {key === "default" && <TbServer className="w-4 h-4 mr-1.5" />}
                  {key === "openai" && <SiOpenai className="w-4 h-4 mr-1.5" />}
                  {key === "anthropic" && <SiAnthropic className="w-4 h-4 mr-1.5" />}
                  {key === "groq" && <TbCpu className="w-4 h-4 mr-1.5" />}
                  {key === "google" && <SiGooglegemini className="w-4 h-4 mr-1.5" />}
                  {info.label}
                </span>
                {settings.chat_provider === key && (
                  <TbCheck className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Model selector */}
          {settings.chat_provider !== "default" && (
            <Field label="Chat Model Name" hint="Enter the exact model string (e.g. gpt-4o, claude-3-5-sonnet-20241022)">
              <TextInput
                id="settings-chat-model"
                value={settings.chat_model}
                onChange={(v) => updateField("chat_model", v)}
                placeholder="Chat model name"
              />
            </Field>
          )}



          {/* API Key (non-Ollama) */}
          {needsChatApiKey && (
            <Field label="API Key" hint="Your provider API key for chat">
              <div className="relative">
                <input
                  id="settings-chat-api-key"
                  type={showChatKey ? "text" : "password"}
                  value={settings.chat_api_key ?? ""}
                  onChange={(e) => updateField("chat_api_key", e.target.value)}
                  placeholder="sk-..."
                  className="w-64 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                />
                <button
                  id="toggle-chat-api-key-visibility"
                  onClick={() => setShowChatKey(!showChatKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showChatKey ? <TbEyeOff className="w-4 h-4" /> : <TbEye className="w-4 h-4" />}
                </button>
              </div>
            </Field>
          )}

          {/* Temperature */}
          <Field label="Temperature" hint={`Creativity level: ${(settings.chat_temperature ?? 0).toFixed(1)} (0 = deterministic, 1 = creative)`}>
            <div className="flex items-center gap-3 w-64">
              <input
                id="settings-chat-temperature"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.chat_temperature ?? 0}
                onChange={(e) => updateField("chat_temperature", parseFloat(e.target.value))}
                className="flex-1 accent-violet-500"
              />
              <span className="text-sm font-mono text-primary w-6 text-right">{(settings.chat_temperature ?? 0).toFixed(1)}</span>
            </div>
          </Field>
        </Section>

        {/* ── Graph Settings ── */}
        <Section title="Graph Reasoning" icon={TbGraph}>
          <Field label="Max Graph Traversal Depth" hint="Maximum hops during multi-hop reasoning">
            <TextInput
              id="settings-graph-depth"
              value={String(settings.max_graph_depth)}
              onChange={(v) => updateField("max_graph_depth", parseInt(v) || 5)}
            />
          </Field>
        </Section>



        {/* ── Save / Reset ── */}
        <div className="flex flex-col gap-3 pb-4">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              id="settings-reset"
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <TbRefresh className="w-4 h-4" /> Reset to Defaults
            </button>

            <button
              id="settings-save"
              onClick={saveToAPI}
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${saved
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                  : error 
                    ? "bg-rose-500/20 border border-rose-500/30 text-rose-400"
                    : "bg-primary text-primary-foreground hover:bg-primary/80 glow-purple"}`}
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <TbLoader2 className="w-4 h-4" />
                </motion.div>
              ) : saved ? (
                <TbCheck className="w-4 h-4" />
              ) : (
                <TbBolt className="w-4 h-4" />
              )}
              {saved ? "Settings Saved!" : loading ? "Saving…" : error ? "Try Again" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
