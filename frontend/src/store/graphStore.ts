import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import type { Node, Edge } from "@xyflow/react";
import { makeDefaultNodes, makeDefaultEdges } from "@/lib/graphUtils";

// SSR-safe storage — returns undefined on the server so persist doesn't
// attempt to access localStorage during Next.js server rendering.
const ssrStorage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return localStorage;
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GraphStatus = "processing" | "ready" | "failed";
export type SourceType =
  | "pdf" | "docx" | "txt"
  | "web" | "youtube" | "github"
  | "markdown" | "json" | "image" | "whatsapp" | "audio";

export interface KnowledgeGraph {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceLabel: string;   // e.g. "research-llm.pdf" or "https://example.com"
  status: GraphStatus;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;     // ISO string
  selected: boolean;     // selected for chat context
  nodes: Node[];
  edges: Edge[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Default seed graphs — shown on first load
// ─────────────────────────────────────────────────────────────────────────────




import { graphsApi } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

interface GraphStore {
  graphs: KnowledgeGraph[];
  activeGraphId: string | null;   // currently viewed in Graph Explorer

  // Graph Explorer actions
  setActiveGraph: (id: string) => void;
  renameGraph: (id: string, name: string) => void;
  deleteGraph: (id: string) => Promise<void>;

  // Chat context selection
  toggleGraphSelection: (id: string) => void;
  selectAllGraphs: () => void;
  deselectAllGraphs: () => void;

  // Upload — add a new graph (starts as "processing")
  addGraph: (partial: Omit<KnowledgeGraph, "id" | "createdAt" | "nodes" | "edges" | "selected" | "nodeCount" | "edgeCount" | "status">) => string;

  // Fetch from API
  fetchGraphs: () => Promise<void>;

  // Simulate graph ready (after processing)
  markGraphReady: (id: string, nodeCount: number, edgeCount: number, nodes: Node[], edges: Edge[]) => void;
}

export const useGraphStore = create<GraphStore>()(
  persist(
    (set, get) => ({
      graphs: [],
      activeGraphId: null,

      fetchGraphs: async () => {
        try {
          const apiGraphs = await graphsApi.list();
          set((state) => {
            // Merge API graphs with local state (preserve selection, nodes/edges)
            const newGraphs = apiGraphs.map((ag) => {
              const existing = state.graphs.find((g) => g.id === ag.id);
              const normalizedStatus = (ag.status === "completed" ? "ready" : ag.status) as GraphStatus;
              return {
                id: ag.id,
                name: ag.name,
                sourceType: ag.source_type as SourceType,
                sourceLabel: ag.source_label,
                status: normalizedStatus,
                nodeCount: ag.node_count,
                edgeCount: ag.edge_count,
                createdAt: ag.created_at,
                selected: existing ? existing.selected : false,
                nodes: existing ? existing.nodes : [],
                edges: existing ? existing.edges : [],
              };
            });
            // Auto-select first graph if none active
            const activeId = state.activeGraphId && newGraphs.find(g => g.id === state.activeGraphId) 
              ? state.activeGraphId 
              : (newGraphs.length > 0 ? newGraphs[0].id : null);
              
            return { graphs: newGraphs, activeGraphId: activeId };
          });
        } catch (e) {
          console.error("Failed to fetch graphs", e);
        }
      },

      setActiveGraph: (id) => set({ activeGraphId: id }),

      renameGraph: (id, name) =>
        set((state) => ({
          graphs: state.graphs.map((g) => (g.id === id ? { ...g, name } : g)),
        })),

      deleteGraph: async (id) => {
        // Optimistic delete
        set((state) => {
          const newGraphs = state.graphs.filter((g) => g.id !== id);
          const nextActiveId = state.activeGraphId === id 
            ? (newGraphs.length > 0 ? newGraphs[0].id : null)
            : state.activeGraphId;
          return { graphs: newGraphs, activeGraphId: nextActiveId };
        });
        
        try {
          await graphsApi.delete(id);
        } catch (e) {
          console.error("Failed to delete graph from backend", e);
          // Optional: re-fetch if backend fails?
        }
      },

      toggleGraphSelection: (id) =>
        set((state) => ({
          graphs: state.graphs.map((g) =>
            g.id === id ? { ...g, selected: !g.selected } : g
          ),
        })),

      selectAllGraphs: () =>
        set((state) => ({
          graphs: state.graphs.map((g) => ({ ...g, selected: true })),
        })),

      deselectAllGraphs: () =>
        set((state) => ({
          graphs: state.graphs.map((g) => ({ ...g, selected: false })),
        })),

      addGraph: (partial) => {
        const id = `graph-${Date.now()}`;
        const newGraph: KnowledgeGraph = {
          ...partial,
          id,
          status: "processing",
          nodeCount: 0,
          edgeCount: 0,
          createdAt: new Date().toISOString(),
          selected: false,
          nodes: [],
          edges: [],
        };
        set((state) => ({ graphs: [newGraph, ...state.graphs] }));
        return id;
      },

      markGraphReady: (id, nodeCount, edgeCount, nodes, edges) =>
        set((state) => ({
          graphs: state.graphs.map((g) =>
            g.id === id
              ? { ...g, status: "ready", nodeCount, edgeCount, nodes, edges }
              : g
          ),
        })),
    }),
    { name: "graphmind-graphs", storage: ssrStorage }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// Selectors  — use shallow equality to prevent infinite getSnapshot loops
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the graphs that are selected AND ready.
 * Passes `shallow` as second arg to useGraphStore (Zustand v4 pattern)
 * so the array reference is only updated when contents actually change.
 */
export const useSelectedGraphs = () =>
  useGraphStore(
    (s) => s.graphs.filter((g) => g.selected && (g.status === "ready" || (g.status as string) === "completed")),
    shallow
  );

/**
 * Returns the currently active graph object.
 * shallow equality prevents returning a new object reference every render.
 */
export const useActiveGraph = () =>
  useGraphStore(
    (s) => s.graphs.find((g) => g.id === s.activeGraphId) ?? null,
    shallow
  );

