"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "@/components/layout/Topbar";
import {
  TbSend, TbBrain, TbUser, TbSparkles, TbGraph,
  TbCheck, TbMinus, TbX, TbLoader2,
} from "react-icons/tb";

import { useGraphStore, useSelectedGraphs } from "@/store/graphStore";
import { useSettingsStore } from "@/store/settingsStore";
import { shallow } from "zustand/shallow";
import { SOURCE_META } from "@/lib/sourceMeta";
import ReactMarkdown from "react-markdown";
import { streamChat, type ChatMessage } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: string[];
  timestamp: Date;
};

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex gap-3 flex-row-reverse"
      >
        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-background bg-foreground">
          <TbUser className="w-4 h-4" />
        </div>

        <div className="max-w-[75%] flex flex-col gap-1 items-end">
          <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-muted border border-border text-foreground rounded-tr-sm">
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
          <span className="text-[10px] text-muted-foreground px-1">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </motion.div>
    );
  }

  // Assistant message rendering (Full width, markdown, no avatar)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-2 w-full py-2"
    >
      <div className="prose prose-invert prose-sm max-w-none text-foreground leading-relaxed">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>

      {msg.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {msg.citations.map((c, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-sans font-semibold tracking-wide uppercase">
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground font-medium">GraphMind AI</span>
        <span className="text-[10px] text-muted-foreground/60">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </motion.div>
  );
}

function StreamingIndicator() {
  return (
    <div className="flex flex-col gap-2 w-full py-2">
      <div className="flex items-center gap-1.5 h-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-foreground"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground font-medium">GraphMind AI</span>
      </div>
    </div>
  );
}

// ─── Welcome message ──────────────────────────────────────────────────────────
const makeWelcome = (model: string): Message => ({
  id: "welcome",
  role: "assistant",
  content: `Hello! I'm GraphMind AI, powered by **${model}**.\n\nSelect the knowledge graphs you want me to reason across using the left panel, then ask me anything. I'll traverse your graph and answer with full context.`,
  citations: [],
  timestamp: new Date(),
});

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const graphs = useGraphStore((s) => s.graphs, shallow);
  const toggleGraphSelection = useGraphStore((s) => s.toggleGraphSelection);
  const selectAllGraphs = useGraphStore((s) => s.selectAllGraphs);
  const deselectAllGraphs = useGraphStore((s) => s.deselectAllGraphs);
  const selectedGraphs = useSelectedGraphs();
  const { settings } = useSettingsStore();

  const readyGraphs = graphs.filter((g) => g.status === "ready" || (g.status as string) === "completed");

  const [messages, setMessages] = useState<Message[]>([makeWelcome(settings.model)]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Update welcome message when model changes
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === "welcome" ? makeWelcome(settings.model) : m))
    );
  }, [settings.model]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userContent = input.trim();
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
      citations: [],
      timestamp: new Date(),
    };

    if (selectedGraphs.length === 0) {
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ No graphs are selected. Please select at least one knowledge graph from the left panel.",
          citations: [],
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Build message history for LLM (last 10 messages)
    const history: ChatMessage[] = messages
      .filter((m) => m.id !== "welcome")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: userContent });

    // Create placeholder AI message
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = {
      id: aiId,
      role: "assistant",
      content: "",
      citations: [],
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    // Stream from backend
    abortRef.current = streamChat({
      messages: history,
      graph_ids: selectedGraphs.map((g) => g.id),
      provider: settings.provider,
      model: settings.model,
      api_key: settings.api_key ?? undefined,
      onChunk: (delta) => {
        setMessages((prev) =>
          prev.map((m) => m.id === aiId ? { ...m, content: m.content + delta } : m)
        );
      },
      onDone: (citations) => {
        setMessages((prev) =>
          prev.map((m) => m.id === aiId ? { ...m, citations } : m)
        );
        setIsStreaming(false);
        abortRef.current = null;
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: `❌ Error: ${err}\n\nMake sure the backend is running at \`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}\`.` }
              : m
          )
        );
        setIsStreaming(false);
        abortRef.current = null;
      },
    });
  }, [input, isStreaming, messages, selectedGraphs, settings]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    abortRef.current = null;
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title="AI Chat" subtitle="Graph-aware conversational intelligence" />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Graph Selection Sidebar ── */}
        <aside className="w-60 flex flex-col glass border-r border-white/[0.06] shrink-0">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Knowledge Sources</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {selectedGraphs.length} of {readyGraphs.length} selected
            </p>
            <div className="flex gap-1.5 mt-2">
              <button id="chat-select-all" onClick={selectAllGraphs}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-none bg-foreground text-background hover:bg-foreground/80 transition-colors font-sans font-bold uppercase tracking-wider">
                <TbCheck className="w-3 h-3" /> All
              </button>
              <button id="chat-deselect-all" onClick={deselectAllGraphs}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-none bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors font-sans font-bold uppercase tracking-wider">
                <TbMinus className="w-3 h-3" /> None
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            {readyGraphs.length === 0 ? (
              <div className="text-center py-8">
                <TbGraph className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  No graphs yet.{" "}
                  <a href="/dashboard/upload" className="text-primary underline">Upload a document</a> to create one.
                </p>
              </div>
            ) : (
              readyGraphs.map((g) => {
                const meta = SOURCE_META[g.sourceType] || { icon: TbGraph, label: g.sourceType || "Unknown", color: "text-slate-400" };
                return (
                  <button key={g.id} id={`chat-graph-${g.id}`} onClick={() => toggleGraphSelection(g.id)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-none text-left transition-all border-l-2
                      ${g.selected ? "bg-muted border-foreground" : "hover:bg-muted/50 border-transparent"}`}>
                    <div className={`w-4 h-4 rounded-sm border shrink-0 mt-0.5 flex items-center justify-center transition-all
                      ${g.selected ? "bg-foreground border-foreground" : "border-border"}`}>
                      {g.selected && <TbCheck className="w-2.5 h-2.5 text-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${g.selected ? "text-foreground" : "text-foreground/80"}`}>{g.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <meta.icon className={`w-2.5 h-2.5 ${meta.color} shrink-0`} />
                        <p className="text-[10px] text-muted-foreground truncate">{g.sourceLabel}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{g.nodeCount} nodes · {g.edgeCount} edges</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Model info footer */}
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <div className="glass-card rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <TbSparkles className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-foreground font-sans font-semibold uppercase tracking-wider truncate">{settings.model}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TbBrain className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-foreground font-sans font-semibold uppercase tracking-wider truncate">{settings.embed_model}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Context bar */}
          <AnimatePresence>
            {selectedGraphs.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-white/[0.06]"
              >
                <div className="flex items-center gap-2 px-5 py-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest shrink-0">Reasoning across:</span>
                  {selectedGraphs.map((g) => {
                    const meta = SOURCE_META[g.sourceType] || { icon: TbGraph, label: g.sourceType || "Unknown", color: "text-slate-400" };
                    return (
                      <span key={g.id} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-none bg-foreground text-background font-sans font-bold uppercase tracking-wider">
                        <meta.icon className="w-2.5 h-2.5" />{g.name}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
            {isStreaming && <StreamingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-6 pb-5">
            <div className="glass-card rounded-2xl p-1 flex items-end gap-2">
              <textarea
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder={
                  selectedGraphs.length === 0
                    ? "Select graphs first, then ask anything…"
                    : `Ask anything across ${selectedGraphs.length} graph${selectedGraphs.length > 1 ? "s" : ""}…`
                }
                className="flex-1 bg-transparent resize-none px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40"
              />
              {isStreaming ? (
                <button
                  id="chat-stop-btn"
                  onClick={handleStop}
                  className="mb-1 mr-1 flex items-center justify-center w-9 h-9 rounded-none bg-foreground hover:bg-foreground/80 transition-all text-background shrink-0"
                >
                  <TbX className="w-4 h-4" />
                </button>
              ) : (
                <button
                  id="chat-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="mb-1 mr-1 flex items-center justify-center w-9 h-9 rounded-none bg-foreground hover:bg-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-background shrink-0"
                >
                  <TbSend className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              {selectedGraphs.length > 0
                ? <>Reasoning across <span className="text-foreground font-sans font-bold uppercase tracking-wide">{selectedGraphs.length} graph{selectedGraphs.length > 1 ? "s" : ""}</span> · <span className="text-muted-foreground font-sans font-semibold uppercase tracking-wide">{settings.model}</span></>
                : <span className="text-foreground font-sans font-bold uppercase tracking-widest">Select knowledge graphs from the left panel to begin</span>
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
