"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import {
  TbCloudUpload,
  TbLoader2,
  TbCheck,
  TbX,
  TbArrowRight,
  TbLink,
} from "react-icons/tb";
import { useGraphStore, type SourceType } from "@/store/graphStore";
import { SOURCE_META } from "@/lib/sourceMeta";
import { makeDefaultNodes, makeDefaultEdges } from "@/lib/graphUtils";

import { documentsApi, graphsApi } from "@/lib/api";
import { useSettingsStore } from "@/store/settingsStore";

const UPLOAD_TYPES: { type: SourceType; label: string; desc: string; isUrl?: boolean }[] = [
  { type: "pdf",      label: "PDF / DOCX",     desc: "Research papers, reports, documents" },
  { type: "web",      label: "Website URL",     desc: "Scrape and index any web page",   isUrl: true },
  { type: "youtube",  label: "YouTube",         desc: "Extract and index video transcripts", isUrl: true },
  { type: "github",   label: "GitHub Repo",     desc: "Index codebase and README files", isUrl: true },
  { type: "audio",    label: "Audio File",      desc: "Transcribe and index audio" },
  { type: "markdown", label: "Markdown / TXT",  desc: "Notes, wikis, documentation" },
  { type: "json",     label: "JSON / CSV",      desc: "Structured data and spreadsheets" },
  { type: "whatsapp", label: "WhatsApp Chat",   desc: "Exported chat history" },
  { type: "image",    label: "Image",           desc: "Extract text and entities from images" },
];

type UploadState = "idle" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { addGraph, markGraphReady } = useGraphStore();
  const { settings } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup poll on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const [selectedType, setSelectedType] = useState<SourceType>(UPLOAD_TYPES[0].type);
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [lastGraphId, setLastGraphId] = useState<string | null>(null);
  const [lastGraphName, setLastGraphName] = useState<string>("");
  const [extractionLevel, setExtractionLevel] = useState<"Low" | "Medium" | "High">("Medium");
  const [focusTopic, setFocusTopic] = useState("");

  const triggerUpload = async (
    sourceLabel: string,
    sourceType: SourceType,
    name: string,
    file?: File
  ) => {
    setUploadState("processing");
    setLastGraphName(name);

    try {
      let docId = "";
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("source_url", sourceLabel);
        form.append("name", name);
        form.append("extraction_level", extractionLevel);
        form.append("focus_topic", focusTopic);
        const res = await documentsApi.upload(form);
        docId = res.id;
      } else {
        const res = await documentsApi.uploadUrl({ source_url: sourceLabel, source_type: sourceType, name, extraction_level: extractionLevel, focus_topic: focusTopic });
        docId = res.task_id;
      }
      
      setLastGraphId(docId);
      await useGraphStore.getState().fetchGraphs();

      // Clear any previous poll
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      // Poll every 3s for up to 5 minutes
      const deadline = Date.now() + 5 * 60 * 1000;
      pollIntervalRef.current = setInterval(async () => {
        try {
          const updatedGraph = await graphsApi.get(docId);

          if (!updatedGraph) {
            // Graph was deleted or not found — stop polling
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            return;
          }

          // "completed" and "ready" are both success states
          if (updatedGraph.status === "completed" || updatedGraph.status === "ready") {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            await useGraphStore.getState().fetchGraphs();
            setUploadState("done");
          } else if (updatedGraph.status === "failed") {
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            await useGraphStore.getState().fetchGraphs();
            setUploadState("error");
          } else if (Date.now() > deadline) {
            // Timeout — treat as done so UI doesn't spin forever
            clearInterval(pollIntervalRef.current!);
            pollIntervalRef.current = null;
            setUploadState("done");
          }
        } catch {
          // Network error — keep polling
        }
      }, 3000);

    } catch (e) {
      console.error(e);
      setUploadState("error");
    }
  };

  const handleFileSelect = (file: File) => {
    const name = file.name.replace(/\.[^.]+$/, "");
    triggerUpload(file.name, selectedType, name, file);
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    const label = urlInput.trim();
    const name =
      selectedType === "youtube" ? "YouTube: " + (label.split("v=")[1]?.slice(0, 8) ?? label)
      : selectedType === "github" ? label.split("/").slice(-2).join("/")
      : new URL(label.startsWith("http") ? label : "https://" + label).hostname;
    triggerUpload(label, selectedType, name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const resetUpload = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setUploadState("idle");
    setUrlInput("");
    setLastGraphId(null);
  };

  const goToGraph = () => {
    if (lastGraphId) {
      useGraphStore.getState().setActiveGraph(lastGraphId);
      router.push("/dashboard/graph");
    }
  };

  const currentTypeMeta = UPLOAD_TYPES.find(t => t.type === selectedType) || UPLOAD_TYPES[0];

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Upload Center" subtitle="Ingest multimodal data into your knowledge graph" />
      <div className="flex-1 overflow-hidden p-6 flex flex-col md:flex-row gap-6">
        
        {/* ASIDE: List of input types */}
        <div className="w-full md:w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-2 pb-6 border-b md:border-b-0 md:border-r border-white/[0.06]">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
            Data Sources
          </h3>
          {UPLOAD_TYPES.map((t) => {
            const meta = SOURCE_META[t.type];
            const isSelected = selectedType === t.type;
            return (
              <button
                key={t.type}
                onClick={() => {
                  setSelectedType(t.type);
                  if (uploadState !== "idle") resetUpload();
                }}
                className={`flex items-center gap-3 w-full text-left p-3 rounded-xl transition-all duration-200 border
                  ${isSelected
                    ? "bg-foreground text-background border-foreground shadow-lg"
                    : "glass-card text-foreground hover:bg-white/[0.05] border-transparent"
                  }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-background text-foreground" : "bg-white/[0.05]"}`}>
                  <meta.icon className={`w-5 h-5 ${isSelected ? "text-foreground" : meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold tracking-tight truncate">{t.label}</p>
                  <p className={`text-[10px] truncate ${isSelected ? "text-background/80" : "text-muted-foreground"}`}>{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* MAIN: Input widget / upload state */}
        <div className="flex-1 flex flex-col items-center justify-center h-full overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {uploadState !== "idle" ? (
              <motion.div
                key="status"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="glass-card rounded-2xl p-10 flex flex-col items-center gap-5 text-center w-full max-w-2xl mx-auto"
              >
                {uploadState === "processing" && (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                      <TbLoader2 className="w-14 h-14 text-foreground" />
                    </motion.div>
                    <div>
                      <p className="text-xl font-bold text-foreground">Building Knowledge Graph</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Extracting entities and relationships from <span className="text-foreground font-medium">"{lastGraphName}"</span>
                      </p>
                    </div>
                    <div className="w-64 h-1.5 rounded-full bg-white/10 overflow-hidden mt-4">
                      <motion.div
                        className="h-full bg-foreground rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4, ease: "easeInOut" }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-2">Processing...</p>
                  </>
                )}
                {uploadState === "done" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-foreground text-background flex items-center justify-center">
                      <TbCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">Graph Ready!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="text-foreground font-medium">"{lastGraphName}"</span> has been indexed.
                      </p>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={goToGraph}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-bold uppercase tracking-wider hover:bg-foreground/80 transition-colors"
                      >
                        Explore Graph <TbArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={resetUpload}
                        className="flex items-center gap-2 px-6 py-3 rounded-full glass text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Upload Another
                      </button>
                    </div>
                  </>
                )}
                {uploadState === "error" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
                      <TbX className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">Upload Failed</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        An error occurred while processing <span className="text-foreground font-medium">"{lastGraphName}"</span>.
                      </p>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={resetUpload}
                        className="flex items-center gap-2 px-6 py-3 rounded-full glass text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="idle" 
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }}
                className="w-full max-w-2xl mx-auto flex flex-col gap-6"
              >
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-foreground text-background mb-4">
                    {(() => {
                      const Icon = SOURCE_META[selectedType]?.icon || TbCloudUpload;
                      return <Icon className="w-8 h-8" />;
                    })()}
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">{currentTypeMeta.label}</h2>
                  <p className="text-sm text-muted-foreground mt-2">{currentTypeMeta.desc}</p>
                </div>

                {currentTypeMeta.isUrl ? (
                  <div className="glass-card rounded-2xl p-8 flex flex-col gap-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                      Enter URL to ingest
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="glass-card flex-1 rounded-xl flex items-center gap-3 px-4 py-3">
                        <TbLink className="w-5 h-5 text-muted-foreground shrink-0" />
                        <input
                          autoFocus
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder={
                            selectedType === "youtube" ? "https://youtube.com/watch?v=..."
                            : selectedType === "github" ? "https://github.com/owner/repo"
                            : "https://..."
                          }
                          className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleUrlSubmit}
                        disabled={!urlInput.trim()}
                        className="px-6 py-3 rounded-xl bg-foreground text-background text-sm font-bold uppercase tracking-wider hover:bg-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Ingest
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`glass-card rounded-3xl border-2 transition-all p-12 flex flex-col items-center justify-center gap-4 cursor-pointer text-center
                      ${dragOver ? "border-foreground bg-white/[0.02]" : "border-dashed border-white/[0.1] hover:border-foreground/50 hover:bg-white/[0.01]"}`}
                  >
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform ${dragOver ? "scale-110 bg-foreground text-background" : "bg-white/[0.05] text-foreground"}`}>
                      <TbCloudUpload className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">Click or drag file to upload</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Supported formats: {
                          selectedType === "pdf" ? "PDF, DOCX"
                          : selectedType === "audio" ? "MP3, WAV, M4A"
                          : selectedType === "image" ? "JPG, PNG, WEBP"
                          : selectedType === "json" ? "JSON, CSV"
                          : selectedType === "markdown" ? "MD, TXT, IPYNB"
                          : selectedType === "whatsapp" ? "TXT (Exported Chat)"
                          : "Any file"
                        }
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </div>
                )}
                
                {/* Extraction Settings */}
                <div className="glass-card rounded-2xl p-6 flex flex-col gap-5 mt-2">
                  <h3 className="text-sm font-bold text-foreground">Extraction Settings</h3>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                        Detail Level
                      </label>
                      <select
                        value={extractionLevel}
                        onChange={(e) => setExtractionLevel(e.target.value as any)}
                        className="w-full glass-card rounded-xl px-4 py-3 bg-transparent text-sm font-medium text-foreground focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="Low">Low (Sparse Graph, Fast)</option>
                        <option value="Medium">Medium (Balanced)</option>
                        <option value="High">High (Dense Graph, Slower)</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
                        Focus Topic (Optional)
                      </label>
                      <input
                        value={focusTopic}
                        onChange={(e) => setFocusTopic(e.target.value)}
                        placeholder="e.g. 'Machine Learning algorithms'"
                        className="w-full glass-card rounded-xl px-4 py-3 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
