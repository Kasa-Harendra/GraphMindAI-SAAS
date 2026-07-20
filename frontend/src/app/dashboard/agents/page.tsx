"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Topbar from "@/components/layout/Topbar";
import {
  TbRobot,
  TbSearch,
  TbBrain,
  TbLink,
  TbFileText,
  TbRefresh,
  TbPlayerPlay,
  TbPlayerStop,
  TbCircleDot,
} from "react-icons/tb";

const agents = [
  {
    id: "research",
    name: "Research Agent",
    desc: "Synthesizes knowledge from multiple graph sources and generates structured reports.",
    icon: TbSearch,
    status: "idle",
    color: "from-violet-500 to-purple-700",
    runs: 47,
    lastRun: "2 hours ago",
  },
  {
    id: "graph-reasoning",
    name: "Graph Reasoning Agent",
    desc: "Performs multi-hop reasoning across Neo4j graph nodes to answer complex queries.",
    icon: TbBrain,
    status: "running",
    color: "from-cyan-500 to-blue-700",
    runs: 312,
    lastRun: "Just now",
  },
  {
    id: "citation",
    name: "Citation Agent",
    desc: "Maps relationships between references, authors, and academic papers in the citation graph.",
    icon: TbLink,
    status: "idle",
    color: "from-emerald-500 to-teal-700",
    runs: 88,
    lastRun: "1 day ago",
  },
  {
    id: "summarizer",
    name: "Summarizer Agent",
    desc: "Condenses long documents and graph neighborhoods into concise AI summaries.",
    icon: TbFileText,
    status: "idle",
    color: "from-amber-500 to-orange-700",
    runs: 203,
    lastRun: "30 min ago",
  },
  {
    id: "relationship-repair",
    name: "Relationship Repair Agent",
    desc: "Detects and fixes broken or duplicate graph relationships using LLM validation.",
    icon: TbRefresh,
    status: "idle",
    color: "from-rose-500 to-pink-700",
    runs: 15,
    lastRun: "3 days ago",
  },
];

export default function AgentsPage() {
  const [agentStates, setAgentStates] = useState(agents);

  const toggleAgent = (id: string) => {
    setAgentStates((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "running" ? "idle" : "running" } : a
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Agent Console" subtitle="Orchestrate your AI agent workforce" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {agentStates.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card rounded-2xl p-5 flex gap-4 hover:border-primary/25 transition-all"
            >
              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0 self-start`}>
                <agent.icon className="w-6 h-6 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{agent.desc}</p>
                  </div>
                  {/* Toggle button */}
                  <button
                    id={`agent-toggle-${agent.id}`}
                    onClick={() => toggleAgent(agent.id)}
                    className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-xl transition-all
                      ${agent.status === "running"
                        ? "bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30"
                        : "bg-primary/15 border border-primary/25 text-primary hover:bg-primary/25"}`}
                  >
                    {agent.status === "running"
                      ? <TbPlayerStop className="w-3.5 h-3.5" />
                      : <TbPlayerPlay className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  {/* Status badge */}
                  <div className={`flex items-center gap-1.5 text-xs font-medium
                    ${agent.status === "running" ? "text-emerald-400" : "text-muted-foreground"}`}
                  >
                    <motion.div
                      className={`w-1.5 h-1.5 rounded-full ${agent.status === "running" ? "bg-emerald-400" : "bg-muted-foreground"}`}
                      animate={agent.status === "running" ? { scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    {agent.status === "running" ? "Running" : "Idle"}
                  </div>
                  <span className="text-xs text-muted-foreground">{agent.runs} runs</span>
                  <span className="text-xs text-muted-foreground">Last: {agent.lastRun}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
