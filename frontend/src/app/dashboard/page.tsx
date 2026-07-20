"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { analyticsApi, healthApi, type AnalyticsOverview } from "@/lib/api";
import { motion, type Variants } from "framer-motion";
import Topbar from "@/components/layout/Topbar";
import {
  TbGraph,
  TbFileText,
  TbMessageCircle,
  TbBolt,
  TbArrowUpRight,
  TbBrain,
  TbNetwork,
  TbCloudUpload,
  TbActivity,
  TbDatabase,
} from "react-icons/tb";
import Link from "next/link";
import { GraphIcon } from "@/components/icons/GraphIcon";

const stats = [
  { label: "Knowledge Graphs",  value: "0", delta: "Your graphs", icon: GraphIcon,       iconColor: "text-violet-500" },
  { label: "Graph Nodes",       value: "0", delta: "Your nodes", icon: TbNetwork,     iconColor: "text-emerald-500" },
  { label: "AI Queries",        value: "0", delta: "Your queries", icon: TbMessageCircle, iconColor: "text-rose-500" },
];

const recentActivity = [];

const quickActions = [
  { label: "Upload Document",  href: "/dashboard/upload",  icon: TbCloudUpload,  desc: "Ingest a new file or URL" },
  { label: "Explore Graph",    href: "/dashboard/graph",   icon: TbGraph,        desc: "Navigate your knowledge graph" },
  { label: "Ask AI",           href: "/dashboard/chat",    icon: TbBrain,        desc: "Graph-aware AI chat" },
  { label: "View Analytics",   href: "/dashboard/analytics",icon: TbActivity,   desc: "Performance & usage metrics" },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function WorkspaceDashboard() {
  const { data: session } = useSession();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [health, setHealth] = useState<string>("checking...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.overview().catch(() => null),
      healthApi.databases().catch(() => ({ status: "offline", services: {} }))
    ]).then(([ov, hl]) => {
      if (ov) setOverview(ov);
      setHealth(hl.status);
      setLoading(false);
    });
  }, []);

  const dynamicStats = overview ? [
    { label: "Knowledge Graphs",  value: (overview.total_graphs ?? 0).toLocaleString(),    delta: "Your graphs",    icon: GraphIcon,       iconColor: "text-violet-500" },
    { label: "Graph Nodes",       value: (overview.total_nodes ?? 0).toLocaleString(), delta: "Your nodes",      icon: TbNetwork,     iconColor: "text-emerald-500" },
    { label: "AI Queries",        value: (overview.total_queries ?? 0).toLocaleString(), delta: "Your queries",  icon: TbMessageCircle, iconColor: "text-rose-500" },
  ] : stats;

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Workspace" subtitle="Your knowledge graph intelligence hub" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Hero greeting */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card rounded-2xl p-6 flex items-center justify-between"
        >
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">{session?.user?.name || "back"}</span> 👋
            </h2>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${
              health === "healthy" ? "bg-primary/15 border-primary/25 text-primary" : 
              health === "degraded" ? "bg-amber-500/15 border-amber-500/25 text-amber-500" :
              "bg-rose-500/15 border-rose-500/25 text-rose-500"
            }`}>
              <TbDatabase className="w-4 h-4" />
              {health === "healthy" ? "All Systems Operational" : health === "degraded" ? "Degraded Performance" : "System Offline"}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {loading ? (
            <div className="col-span-full py-8 text-center text-muted-foreground text-sm">Loading workspace data...</div>
          ) : dynamicStats.map((stat) => (
            <motion.div key={stat.label} variants={item}>
              <div className="glass-card rounded-xl p-4 group hover:border-primary/30 transition-all duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <stat.icon className={`w-7 h-7 ${stat.iconColor}`} />
                    <div>
                      <p className="text-xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-emerald-400 mt-3 font-medium">{stat.delta}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom grid: Quick Actions + Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="glass-card rounded-2xl p-4 cursor-pointer group hover:border-primary/30 transition-all duration-200 h-full"
                  >
                    <action.icon className="w-6 h-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-sm font-semibold text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
              Recent Activity
            </h3>
            <div className="glass-card rounded-2xl overflow-hidden">
              {recentActivity.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No recent activity yet. Upload a document to get started!
                </div>
              ) : recentActivity.map((act, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-5 py-3.5 ${idx < recentActivity.length - 1 ? "border-b border-white/[0.05]" : ""} hover:bg-white/[0.02] transition-colors`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                    <act.icon className={`w-4 h-4 ${act.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{act.subject}</p>
                    <p className="text-[11px] text-muted-foreground">{act.action}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{act.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
