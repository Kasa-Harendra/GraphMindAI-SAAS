"use client";

import { useEffect, useState } from "react";
import { useGraphStore } from "@/store/graphStore";

/**
 * Prevents Zustand persist from causing hydration mismatches.
 * Wraps children so they only render on the client side.
 */
export default function StoreHydration({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const fetchGraphs = useGraphStore(s => s.fetchGraphs);
  
  useEffect(() => {
    setMounted(true);
    fetchGraphs();
  }, [fetchGraphs]);
  
  if (!mounted) return null;
  return <>{children}</>;
}
