import type { Node, Edge } from "@xyflow/react";

/** Generate a simple star-layout graph for newly created sources */
export function makeDefaultNodes(centerLabel: string): Node[] {
  return [
    { id: "1", position: { x: 400, y: 220 }, data: { label: centerLabel } },
    { id: "2", position: { x: 180, y: 110 }, data: { label: "Concept A" } },
    { id: "3", position: { x: 640, y: 110 }, data: { label: "Concept B" } },
    { id: "4", position: { x: 180, y: 340 }, data: { label: "Entity X" } },
    { id: "5", position: { x: 640, y: 340 }, data: { label: "Entity Y" } },
  ];
}

export function makeDefaultEdges(): Edge[] {
  return [
    { id: "e1-2", source: "1", target: "2", animated: true, label: "relates to" },
    { id: "e1-3", source: "1", target: "3", animated: true, label: "connects" },
    { id: "e1-4", source: "1", target: "4", label: "contains" },
    { id: "e1-5", source: "1", target: "5", label: "references" },
  ];
}
