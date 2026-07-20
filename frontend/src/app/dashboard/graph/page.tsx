"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbGraph,
  TbPencil,
  TbCheck,
  TbX,
  TbFilter,
  TbRefresh,
  TbMaximize,
  TbDownload,
  TbBolt,
  TbLoader2,
  TbAlertCircle,
  TbChevronRight,
  TbLayoutSidebar,
  TbTrash,
  TbChartDots,
  TbChartArcs,
} from "react-icons/tb";
import dynamic from "next/dynamic";

const VisGraph = dynamic(() => import("react-graph-vis"), { ssr: false });

import { useGraphStore, useActiveGraph } from "@/store/graphStore";
import { shallow } from "zustand/shallow";
import { SOURCE_META } from "@/lib/sourceMeta";
import { graphsApi } from "@/lib/api";

// ─── Node / Edge visual styles ────────────────────────────────────────────────
const NODE_STYLE = {
  background: "rgba(17, 24, 39, 0.9)",
  border: "1px solid rgba(124, 58, 237, 0.4)",
  borderRadius: "12px",
  color: "#F9FAFB",
  fontSize: "12px",
  fontWeight: "600",
  padding: "10px 16px",
  backdropFilter: "blur(8px)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,58,237,0.1)",
};

const EDGE_DEFAULTS = {
  type: "straight",
  style: { stroke: "rgba(124, 58, 237, 0.55)", strokeWidth: 1.5 },
  labelStyle: { fill: "#94A3B8", fontSize: 10, fontWeight: 500 },
  labelBgStyle: { fill: "rgba(11, 16, 35, 0.9)", fillOpacity: 1 },
  labelBgPadding: [4, 6] as [number, number],
  labelBgBorderRadius: 4,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: "rgba(124, 58, 237, 0.8)",
  },
};

// ─── Force-Directed Layout ────────────────────────────────────────────────────
function computeForceLayout(
  rawNodes: any[],
  rawEdges: any[]
): { nodes: Node[]; edges: Edge[] } {
  const total = rawNodes.length;
  if (total === 0) return { nodes: [], edges: [] };

  // Identify hub node (highest degree) for visual emphasis
  const degree: Record<string, number> = {};
  for (const e of rawEdges) {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  }
  let hubId = rawNodes[0].id;
  let maxDeg = 0;
  for (const n of rawNodes) {
    if ((degree[n.id] || 0) > maxDeg) { maxDeg = degree[n.id] || 0; hubId = n.id; }
  }

  // Initial positions: random spread across large canvas
  const W = 1400, H = 900;
  const pos: Record<string, { x: number; y: number }> = {};
  const vel: Record<string, { x: number; y: number }> = {};
  // Use deterministic seed-like placement first, then let forces run
  rawNodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / rawNodes.length;
    const r = 350 + Math.sin(i * 2.3) * 100;
    pos[n.id] = { x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle) };
    vel[n.id] = { x: 0, y: 0 };
  });

  // Force simulation constants
  const REPULSION  = 22000;  // node repulsion (Coulomb)
  const SPRING_LEN = 300;    // ideal edge rest length
  const SPRING_K   = 0.05;   // spring stiffness (Hooke)
  const DAMPING    = 0.80;   // velocity damping per tick
  const CENTER_G   = 0.008;  // weak gravity toward canvas centre
  const ITERATIONS = 350;    // simulation ticks

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - (iter / ITERATIONS) * 0.6; // partial annealing

    // Repulsion between every pair
    for (let i = 0; i < rawNodes.length; i++) {
      for (let j = i + 1; j < rawNodes.length; j++) {
        const a = rawNodes[i].id, b = rawNodes[j].id;
        const dx = pos[b].x - pos[a].x;
        const dy = pos[b].y - pos[a].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (REPULSION / (dist * dist)) * cooling;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        vel[a].x -= fx; vel[a].y -= fy;
        vel[b].x += fx; vel[b].y += fy;
      }
    }

    // Spring attraction along edges
    for (const e of rawEdges) {
      if (!pos[e.source] || !pos[e.target]) continue; // Guard against orphan edges
      const dx = pos[e.target].x - pos[e.source].x;
      const dy = pos[e.target].y - pos[e.source].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const displacement = dist - SPRING_LEN;
      const force = SPRING_K * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      vel[e.source].x += fx; vel[e.source].y += fy;
      vel[e.target].x -= fx; vel[e.target].y -= fy;
    }

    // Weak gravity pulls nodes toward canvas centre (prevents fragmentation)
    for (const n of rawNodes) {
      vel[n.id].x += (W / 2 - pos[n.id].x) * CENTER_G;
      vel[n.id].y += (H / 2 - pos[n.id].y) * CENTER_G;
    }

    // Integrate: apply damping then move
    for (const n of rawNodes) {
      vel[n.id].x *= DAMPING;
      vel[n.id].y *= DAMPING;
      pos[n.id].x += vel[n.id].x;
      pos[n.id].y += vel[n.id].y;
    }
  }

  // Normalise to fit viewport with padding
  const xs = rawNodes.map((n) => pos[n.id].x);
  const ys = rawNodes.map((n) => pos[n.id].y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);
  const scale  = Math.min((W * 0.88) / rangeX, (H * 0.88) / rangeY);
  const offX   = (W - rangeX * scale) / 2 - minX * scale;
  const offY   = (H - rangeY * scale) / 2 - minY * scale;

  const nodes: Node[] = rawNodes.map((n) => ({
    id: n.id,
    position: {
      x: pos[n.id].x * scale + offX,
      y: pos[n.id].y * scale + offY,
    },
    data: { label: n.label || n.id },
    style: {
      ...NODE_STYLE,
      ...(n.id === hubId ? {
        background: "rgba(124, 58, 237, 0.22)",
        border: "1.5px solid rgba(124, 58, 237, 0.95)",
        boxShadow: "0 0 20px rgba(124,58,237,0.45), 0 4px 20px rgba(0,0,0,0.5)",
        fontSize: "13px",
      } : {}),
    },
  }));

  const edges: Edge[] = rawEdges.map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || undefined,
    type: "straight",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: "rgba(124, 58, 237, 0.75)",
    },
    style: {
      stroke: (e.source === hubId || e.target === hubId)
        ? "rgba(124, 58, 237, 0.72)"
        : "rgba(124, 58, 237, 0.38)",
      strokeWidth: (e.source === hubId || e.target === hubId) ? 1.8 : 1.2,
    },
    labelStyle: { fill: "#94A3B8", fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: "rgba(11, 16, 35, 0.9)", fillOpacity: 1 },
    labelBgPadding: [4, 6] as [number, number],
    labelBgBorderRadius: 4,
  }));

  return { nodes, edges };
}

// ─── Inline rename input ──────────────────────────────────────────────────────
function RenameInput({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(text.trim() || value);
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 bg-white/10 border border-primary/40 rounded-lg px-2.5 py-1 text-sm text-foreground focus:outline-none focus:border-primary min-w-0"
      />
      <button
        onClick={() => onSave(text.trim() || value)}
        className="w-6 h-6 flex items-center justify-center rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors shrink-0"
      >
        <TbCheck className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="w-6 h-6 flex items-center justify-center rounded-md bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <TbX className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Graph Canvas ─────────────────────────────────────────────────────────────
function GraphCanvas({ graphId }: { graphId: string }) {
  const graph = useGraphStore(
    (s) => s.graphs.find((g) => g.id === graphId) ?? null,
    shallow
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!graph || (graph.status !== "ready" && (graph.status as string) !== "completed")) return;
    let isMounted = true;
    
    setLoading(true);
    Promise.all([
      graphsApi.nodes(graph.id, 200),
      graphsApi.edges(graph.id, 500)
    ]).then(([nodesRes, edgesRes]) => {
      if (!isMounted) return;
      const { nodes: newNodes, edges: newEdges } = computeForceLayout(
        nodesRes.nodes || [],
        edgesRes.edges || []
      );
      setNodes(newNodes);
      setEdges(newEdges);
    }).catch(console.error).finally(() => {
      if (isMounted) setLoading(false);
    });
    
    return () => { isMounted = false; };
  }, [graph?.id, graph?.status, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  if (!graph) return null;

  if (graph.status === "processing" || loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <TbLoader2 className="w-10 h-10 text-primary" />
        </motion.div>
        <p className="text-sm font-medium">{loading ? "Loading graph data…" : "Building knowledge graph…"}</p>
      </div>
    );
  }

  if (graph.status === "failed") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <TbAlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-sm font-medium text-rose-400">Graph extraction failed</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 glass-card rounded-full text-xs text-cyan-400 font-medium pointer-events-none"
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <TbBolt className="w-3.5 h-3.5" />
        {graph.nodeCount} nodes · {graph.edgeCount} edges — drag to explore
      </motion.div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        defaultEdgeOptions={EDGE_DEFAULTS}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(124, 58, 237, 0.12)"
        />
        <Controls
          style={{ borderRadius: "12px", overflow: "hidden" }}
          className="!bg-[#111827] !border-white/10"
        />
        <MiniMap
          nodeColor="rgba(124, 58, 237, 0.6)"
          style={{
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#0B1023",
          }}
        />
      </ReactFlow>
    </div>
  );
}

// ─── VisNetwork Canvas ──────────────────────────────────────────────────────────
function VisCanvas({ graphId }: { graphId: string }) {
  const graph = useGraphStore(
    (s) => s.graphs.find((g) => g.id === graphId) ?? null,
    shallow
  );
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!graph || (graph.status !== "ready" && (graph.status as string) !== "completed")) return;
    let isMounted = true;
    
    setLoading(true);
    Promise.all([
      graphsApi.nodes(graph.id, 200),
      graphsApi.edges(graph.id, 500)
    ]).then(([nodesRes, edgesRes]) => {
      if (!isMounted) return;
      
      const visNodes = (nodesRes.nodes || []).map((n: any) => ({
        id: n.id,
        label: n.label || n.id,
        title: n.label || n.id,
        color: {
           background: "rgba(17, 24, 39, 0.9)",
           border: "rgba(124, 58, 237, 0.8)",
           highlight: { background: "rgba(124, 58, 237, 0.22)", border: "rgba(124, 58, 237, 0.95)" }
        },
        font: { color: "#F9FAFB" }
      }));

      const visEdges = (edgesRes.edges || []).map((e: any) => ({
        id: e.id,
        from: e.source,
        to: e.target,
        label: e.label || undefined,
        color: { color: "rgba(124, 58, 237, 0.38)", highlight: "rgba(124, 58, 237, 0.72)" },
        font: { color: "#94A3B8", size: 10 }
      }));

      setNodes(visNodes);
      setEdges(visEdges);
    }).catch(console.error).finally(() => {
      if (isMounted) setLoading(false);
    });
    
    return () => { isMounted = false; };
  }, [graph?.id, graph?.status]);

  if (!graph) return null;

  if (graph.status === "processing" || loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <TbLoader2 className="w-10 h-10 text-primary" />
        </motion.div>
        <p className="text-sm font-medium">{loading ? "Loading graph data…" : "Building knowledge graph…"}</p>
      </div>
    );
  }

  const visGraphData = { nodes, edges };
  const visOptions = {
    layout: {
      improvedLayout: true,
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -2000,
        centralGravity: 0.3,
        springLength: 150,
        springConstant: 0.04,
        damping: 0.09,
      },
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 0.5 } },
      smooth: { enabled: true, type: "continuous", roundness: 0.5 }
    },
    nodes: {
      shape: "box",
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      borderWidth: 1,
      shadow: true
    }
  };

  return (
    <div className="flex-1 relative bg-transparent">
       <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 glass-card rounded-full text-xs text-cyan-400 font-medium pointer-events-none"
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <TbBolt className="w-3.5 h-3.5" />
        {graph.nodeCount} nodes · {graph.edgeCount} edges (VisNetwork)
      </motion.div>
      <VisGraph
        graph={visGraphData}
        options={visOptions}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GraphExplorerPage() {
  const graphs = useGraphStore((s) => s.graphs, shallow);
  const activeGraphId = useGraphStore((s) => s.activeGraphId);
  const setActiveGraph = useGraphStore((s) => s.setActiveGraph);
  const renameGraph = useGraphStore((s) => s.renameGraph);
  const deleteGraph = useGraphStore((s) => s.deleteGraph);
  const activeGraph = useActiveGraph();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"react-flow" | "vis-network">("react-flow");

  const handleRename = async (id: string, name: string) => {
    renameGraph(id, name);  // Optimistic update
    setRenamingId(null);
    try {
      await graphsApi.rename(id, name); // Sync to backend
    } catch {
      // Backend not running — local rename still persists
    }
  };

  const handleExport = () => {
    if (!activeGraph) return;
    const url = graphsApi.exportUrl(activeGraph.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeGraph.name.replace(/\s+/g, "-")}.json`;
    a.click();
  };

  const handleRefresh = async () => {
    if (!activeGraph) return;
    // Re-fetch graph nodes from backend (no-op if backend not running)
    try {
      await graphsApi.nodes(activeGraph.id);
    } catch { /* silent */ }
  };

  const handleFullscreen = () => {
    const el = document.querySelector(".react-flow") as HTMLElement | null;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const totalNodes = graphs.filter((g) => g.status === "ready").reduce((s, g) => s + g.nodeCount, 0);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Graph List Sidebar ── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 272, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col glass border-r border-white/[0.06] shrink-0 overflow-hidden"
            style={{ width: 272 }}
          >
            {/* Sidebar header */}
            <div className="px-4 py-3.5 border-b border-white/[0.06]">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Your Graphs
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-muted-foreground">
                  {graphs.length} graphs · {totalNodes.toLocaleString()} total nodes
                </p>
              </div>
            </div>

            {/* Graph list */}
            <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
              {graphs.map((g) => {
                const meta = SOURCE_META[g.sourceType] || { icon: TbGraph, label: g.sourceType || "Unknown", color: "text-slate-400" };
                const isActive = g.id === activeGraphId;
                const isRenaming = renamingId === g.id;

                return (
                  <motion.div
                    key={g.id}
                    layout
                    className={`
                      rounded-xl px-3 py-2.5 cursor-pointer transition-all group
                      ${isActive
                        ? "bg-primary/15 border border-primary/25"
                        : "hover:bg-white/[0.04] border border-transparent"}
                    `}
                    onClick={() => !isRenaming && setActiveGraph(g.id)}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Source icon */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
                        ${isActive ? "bg-primary/20" : "bg-white/[0.06]"}`}
                      >
                        <meta.icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : meta.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <RenameInput
                            value={g.name}
                            onSave={(name) => handleRename(g.id, name)}
                            onCancel={() => setRenamingId(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-semibold truncate flex-1
                              ${isActive ? "text-primary" : "text-foreground"}`}
                            >
                              {g.name}
                            </p>
                            <button
                              id={`rename-${g.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingId(g.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-all shrink-0"
                            >
                              <TbPencil className="w-3 h-3" />
                            </button>
                            <button
                              id={`delete-${g.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete "${g.name}"? This will permanently remove all nodes, embeddings, and chunks.`)) {
                                  deleteGraph(g.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-400 transition-all shrink-0"
                            >
                              <TbTrash className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Source label */}
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{g.sourceLabel}</p>

                        {/* Status / stats row */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {g.status === "processing" ? (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                              <motion.div
                                className="w-1.5 h-1.5 rounded-full bg-amber-400"
                                animate={{ scale: [1, 1.4, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                              />
                              Processing…
                            </span>
                          ) : g.status === "failed" ? (
                            <span className="text-[10px] text-rose-400 font-medium">Failed</span>
                          ) : (
                            <>
                              <span className="text-[10px] text-muted-foreground">{g.nodeCount} nodes</span>
                              <span className="text-muted-foreground/40 text-[10px]">·</span>
                              <span className="text-[10px] text-muted-foreground">{g.edgeCount} edges</span>
                            </>
                          )}
                        </div>
                      </div>

                      {isActive && !isRenaming && (
                        <TbChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-1" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Right: Graph Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 glass border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            {/* Toggle sidebar */}
            <button
              id="graph-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center justify-center w-8 h-8 rounded-lg glass text-muted-foreground hover:text-foreground transition-colors"
            >
              <TbLayoutSidebar className="w-4 h-4" />
            </button>

            {activeGraph && (
              <>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-2">
                  {/* Source type badge */}
                  {(() => {
                    const meta = SOURCE_META[activeGraph.sourceType] || { icon: TbGraph, label: activeGraph.sourceType || "Unknown", color: "text-slate-400" };
                    return (
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                        <meta.icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                    );
                  })()}
                  <span className="text-sm font-semibold text-foreground">{activeGraph.name}</span>
                  {activeGraph.status === "ready" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium">
                      {activeGraph.nodeCount} nodes · {activeGraph.edgeCount} edges
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-white/[0.04] p-1 rounded-lg mr-2 border border-white/[0.06]">
              <button
                onClick={() => setViewMode("react-flow")}
                title="ReactFlow View"
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${viewMode === "react-flow" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <TbChartArcs className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("vis-network")}
                title="VisNetwork View"
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${viewMode === "vis-network" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <TbChartDots className="w-4 h-4" />
              </button>
            </div>

            {[
              { icon: TbFilter,   id: "graph-filter-btn",     title: "Filter by type",   onClick: () => {} },
              { icon: TbRefresh,  id: "graph-refresh-btn",    title: "Refresh graph",    onClick: handleRefresh },
              { icon: TbMaximize, id: "graph-fullscreen-btn", title: "Toggle fullscreen", onClick: handleFullscreen },
              { icon: TbDownload, id: "graph-export-btn",     title: "Export as JSON",   onClick: handleExport },
            ].map(({ icon: Icon, id, title, onClick }) => (
              <button
                key={id}
                id={id}
                title={title}
                onClick={onClick}
                className="flex items-center justify-center w-8 h-8 rounded-lg glass text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        {activeGraph ? (
          viewMode === "react-flow" ? (
            <GraphCanvas key={`rf-${activeGraph.id}`} graphId={activeGraph.id} />
          ) : (
            <VisCanvas key={`vis-${activeGraph.id}`} graphId={activeGraph.id} />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TbGraph className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a graph from the sidebar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
