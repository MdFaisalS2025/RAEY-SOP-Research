"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, X, CheckCircle2, AlertTriangle, File, Loader2, ArrowRight } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { uploadSOP } from "@/lib/api"
import { cn } from "@/lib/utils"

type UploadState = "idle" | "selected" | "uploading" | "processing" | "done" | "error"

export default function UploadPage() {
  const [state, setState] = useState<UploadState>("idle")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<Record<string, string | number> | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setState("selected")
    setErrorMsg("")
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setState("uploading")
    setProgress(0)

    // Simulate progress while uploading
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 90))
    }, 200)

    try {
      const response = await uploadSOP(selectedFile)
      clearInterval(interval)
      setProgress(100)
      setState("processing")
      setTimeout(() => {
        setResult({
          title: response.title || selectedFile.name,
          department: response.department || "Unspecified",
          version: response.version || "1.0",
          status: response.status || "draft",
          chunks: response.chunk_count || 0,
        })
        setState("done")
      }, 1000)
    } catch (err) {
      clearInterval(interval)
      setErrorMsg(err instanceof Error ? err.message : "Upload failed. Is the backend running?")
      setState("error")
    }
  }

  const reset = () => {
    setState("idle")
    setSelectedFile(null)
    setProgress(0)
    setResult(null)
    setErrorMsg("")
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Upload SOP" }]} />

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Upload SOP</h1>
            <p className="text-sm text-muted-foreground">Upload a PDF, DOCX, or TXT file. Review and edit metadata before adding to the library.</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.doc"
          onChange={handleInputChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center p-16 rounded-2xl border-2 border-dashed cursor-pointer transition-all",
                dragOver
                  ? "border-[#0B6BCB] bg-[#0B6BCB]/5"
                  : "border-border hover:border-[#0B6BCB]/40 bg-card"
              )}
            >
              <Upload className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">Drop your SOP file here</h3>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports PDF, DOCX, TXT</p>
            </motion.div>
          )}

          {state === "selected" && selectedFile && (
            <motion.div key="selected" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
                <div className="w-12 h-12 rounded-xl bg-[#0B6BCB]/10 flex items-center justify-center">
                  <File className="w-6 h-6 text-[#0B6BCB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)} - {selectedFile.name.split('.').pop()?.toUpperCase()}</p>
                </div>
                <button onClick={reset} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              <button onClick={handleUpload} className="press w-full py-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white font-medium transition-colors">
                Upload & Process
              </button>
            </motion.div>
          )}

          {(state === "uploading" || state === "processing") && (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-3 mb-4">
                <File className="w-5 h-5 text-[#0B6BCB]" />
                <span className="text-sm font-medium">{selectedFile?.name}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-2">
                <motion.div className="h-full rounded-full bg-[#0B6BCB]" animate={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {state === "uploading" ? `Uploading... ${progress}%` : "Processing & extracting content..."}
              </p>
            </motion.div>
          )}

          {state === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="p-6 rounded-2xl bg-card border border-red-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <h3 className="text-lg font-semibold text-red-400">Upload Failed</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
                <button onClick={reset} className="press px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                  Try Again
                </button>
              </div>
            </motion.div>
          )}

          {state === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="p-6 rounded-2xl bg-card border border-green-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <h3 className="text-lg font-semibold">Processing Complete</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {Object.entries(result).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground capitalize">{label}</p>
                      <p className="text-sm font-medium">{String(value)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="press flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                    Upload Another
                  </button>
                  <Link href="/library" className="press flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5">
                    View in Library <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Research Disclaimer */}
        <div className="mt-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-muted-foreground">
          <p className="font-medium text-amber-400 mb-1">Research Use Only</p>
          <p>This system is a research prototype. Uploaded SOPs are processed for demonstration purposes only. Do not upload documents containing protected health information (PHI) or other sensitive data. This tool is not intended for clinical decision-making.</p>
        </div>
      </div>
    </AppShell>
  )
}
