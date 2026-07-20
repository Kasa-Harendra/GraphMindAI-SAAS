"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  TbGraph,
  TbBrain,
  TbSettings,
  TbCloudUpload,
  TbArrowRight,
  TbDatabase,
  TbNetwork,
} from "react-icons/tb";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function LandingPage() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-primary">
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full" />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">GraphMind AI</span>
        </div>
        <div>
          {status === "loading" ? (
            <div className="w-32 h-10 rounded-full bg-white/5 animate-pulse" />
          ) : status === "authenticated" ? (
            <Link href="/dashboard">
              <button className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors backdrop-blur-md border border-white/10">
                Go to Dashboard
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button className="px-5 py-2.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-colors backdrop-blur-md border border-primary/30 glow-purple">
                Sign In
              </button>
            </Link>
          )}
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-24 pb-32">
        {/* ── Hero Section ── */}
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-8">
          {/* <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest">Platform v2.0 Live</span>
          </motion.div> */}

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 leading-tight"
          >
            Transform documents into <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">intelligent knowledge.</span>
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
          >
            Upload your complex documents and let GraphMind AI extract, map, and visualize the hidden relationships. Experience RAG powered by dynamic Knowledge Graphs.
          </motion.p>

          <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="pt-4 h-[60px] flex items-center justify-center">
            {status === "loading" ? (
              <div className="w-64 h-14 rounded-2xl bg-white/5 animate-pulse" />
            ) : (
              <Link href={status === "authenticated" ? "/dashboard" : "/login"}>
                <button className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-all glow-purple hover:scale-105 active:scale-95 shadow-2xl shadow-primary/25">
                  {status === "authenticated" ? "Enter Workspace" : "Get Started Now"}
                  <TbArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            )}
          </motion.div>
        </div>

        {/* ── Features Grid ── */}
        <div className="mt-40">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold">Unleash your data's potential</h2>
            <p className="text-muted-foreground mt-4">Next-generation features built for enterprise intelligence.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-3xl p-8 hover:border-violet-500/30 transition-colors group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center mb-6">
                <TbGraph className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3">Graph Inspection</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Interactively visualize and traverse extracted entities and relationships. Discover multi-hop connections that traditional vector search misses.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-3xl p-8 hover:border-emerald-500/30 transition-colors group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                <TbCloudUpload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3">Multimodal Inputs</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ingest PDFs, images, URLs, and plain text effortlessly. Our asynchronous processing pipeline handles it all seamlessly in the background.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="glass-card rounded-3xl p-8 hover:border-rose-500/30 transition-colors group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-6">
                <TbBrain className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3">Context-Aware Chat</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Engage with an intelligent agent that understands the full topology of your knowledge base, citing exact sub-graphs for verifiable answers.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="glass-card rounded-3xl p-8 hover:border-amber-500/30 transition-colors group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
                <TbSettings className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3">Bring Your Own LLM</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Switch between OpenAI, Anthropic, Google Gemini, Groq, or local Ollama models on a per-user basis. Ultimate flexibility and privacy.
              </p>
            </motion.div>
          </div>
        </div>

        {/* ── Architecture Highlight ──
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          className="mt-32 glass-card rounded-[2rem] p-8 md:p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                <TbDatabase className="w-4 h-4" /> Enterprise Grade
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">Built for scale & performance</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                GraphMind AI leverages Redis for high-speed caching and real-time SSE event pipelines, alongside MongoDB Atlas for highly optimized Vector Search storage. Everything runs blazing fast.
              </p>
            </div>
            <div className="w-full md:w-1/3 shrink-0 flex items-center justify-center">
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 border border-white/20 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-4 border border-white/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <TbNetwork className="w-16 h-16 text-primary glow-purple" />
                </div>
              </div>
            </div>
          </div>
        </motion.div> */}

      </main>
      
      {/* Footer */}
      <footer className="w-full border-t border-white/[0.05] py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} GraphMind AI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
