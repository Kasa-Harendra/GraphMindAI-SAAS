"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { analyticsApi, type AnalyticsOverview, type WeeklyDay } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import {
  TbChartBar,
  TbClock,
  TbDatabase,
  TbActivity,
  TbArrowUpRight,
  TbArrowDownRight,
} from "react-icons/tb";

const defaultMetrics = [
  { label: "Avg Query Latency",    value: "0 ms",   delta: "Real-time",  positive: true,  icon: TbClock,      iconColor: "text-violet-500" },
  { label: "Graph Storage Size",   value: "0 MB",   delta: "Exact",      positive: true,  icon: TbDatabase,   iconColor: "text-cyan-500" },
  { label: "Graph Density",        value: "0 deg",  delta: "Edges/Node", positive: true,  icon: TbActivity,   iconColor: "text-emerald-500" },
  { label: "Total AI Queries",     value: "0",      delta: "All time",   positive: true,  icon: TbChartBar,   iconColor: "text-rose-500" },
];

const fallbackBarData = [
  { label: "Mon", queries: 0, graphs: 0 },
  { label: "Tue", queries: 0, graphs: 0 },
  { label: "Wed", queries: 0, graphs: 0 },
  { label: "Thu", queries: 0, graphs: 0 },
  { label: "Fri", queries: 0, graphs: 0 },
  { label: "Sat", queries: 0, graphs: 0 },
  { label: "Sun", queries: 0, graphs: 0 },
];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [weekly, setWeekly] = useState<WeeklyDay[]>([]);
  
  useEffect(() => {
    analyticsApi.overview().then(setOverview).catch(console.error);
    analyticsApi.weekly().then(res => setWeekly(res.days)).catch(console.error);
  }, []);

  const barData = weekly.length > 0 ? weekly.map(d => ({
    label: d.day,
    queries: d.queries,
    graphs: d.ingestions + d.nodes_created
  })) : fallbackBarData;

  const maxQueries = Math.max(10, ...barData.map((d) => Math.max(d.queries, d.graphs)));

  const dynamicMetrics = overview ? [
    { label: "Avg Query Latency",    value: `${overview.avg_latency_ms} ms`,   delta: "Real-time",  positive: true,  icon: TbClock,      iconColor: "text-violet-500" },
    { label: "Graph Storage Size",   value: `${overview.storage_mb} MB`,   delta: "Exact",  positive: true, icon: TbDatabase,   iconColor: "text-cyan-500" },
    { label: "Graph Density",        value: `${overview.avg_node_degree} deg`,    delta: "Edges/Node",    positive: true,  icon: TbActivity,   iconColor: "text-emerald-500" },
    { label: "Total AI Queries",     value: `${overview.total_queries}`,  delta: "All time", positive: true, icon: TbChartBar,   iconColor: "text-rose-500" },
  ] : defaultMetrics;
  return (
    <div className="flex flex-col h-full">
      <Topbar title="Graph Analytics" subtitle="Platform performance and usage metrics" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {dynamicMetrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <m.icon className={`w-7 h-7 ${m.iconColor}`} />
                  <div>
                    <p className="text-xl font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold ${m.positive ? "text-emerald-400" : "text-rose-400"}`}>
                  {m.positive ? <TbArrowUpRight className="w-3.5 h-3.5" /> : <TbArrowDownRight className="w-3.5 h-3.5" />}
                  {m.delta}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bar Chart — Weekly Activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Weekly Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">AI Queries vs Graph Builds</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Queries
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-secondary inline-block" /> Graph Builds
              </span>
            </div>
          </div>

          <div className="flex items-end gap-3 h-40">
            {barData.map((d, i) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-1 h-32">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.queries / maxQueries) * 100}%` }}
                    transition={{ delay: 0.4 + i * 0.06, duration: 0.5, ease: "easeOut" }}
                    className="flex-1 rounded-t-lg bg-primary/70 hover:bg-primary transition-colors cursor-pointer"
                    style={{ minHeight: "4px" }}
                  />
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.graphs / maxQueries) * 100}%` }}
                    transition={{ delay: 0.45 + i * 0.06, duration: 0.5, ease: "easeOut" }}
                    className="flex-1 rounded-t-lg bg-secondary/70 hover:bg-secondary transition-colors cursor-pointer"
                    style={{ minHeight: "4px" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
