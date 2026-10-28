"use client";
import { useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useDropzone } from "react-dropzone";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Upload,
  Link2,
  FileText,
  Image,
  File,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

type InputMode = "file" | "url" | "text";

const STAGES = [
  "Uploading",
  "Extracting job information",
  "Analyzing requirements",
  "Matching your CV",
  "Generating application email",
  "Waiting for your review",
];

export default function ApplyPage() {
  const [mode, setMode] = useState<InputMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState("");
  const router = useRouter();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "text/plain": [".txt"],
    },
    multiple: false,
  });

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    setStage(0);

    try {
      const form = new FormData();
      if (mode === "file" && file) {
        form.append("file", file);
      } else if (mode === "url" && url) {
        form.append("url", url);
      } else if (mode === "text" && text) {
        form.append("text", text);
      } else {
        setError("Please provide a file, URL, or paste job description text.");
        setLoading(false);
        setStage(-1);
        return;
      }
      if (instructions) form.append("instructions", instructions);

      setStage(1);
      const response = await api.post("/api/jobs/submit", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { application_id } = response.data;
      setStage(5);

      // Poll for completion
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 60) {
          clearInterval(poll);
          setError("Processing timed out. Please try again.");
          setLoading(false);
          setStage(-1);
          return;
        }
        try {
          const appRes = await api.get(`/api/jobs/${application_id}`);
          const appStatus = appRes.data.status;
          if (appStatus === "awaiting_approval" || appStatus === "draft_ready") {
            clearInterval(poll);
            router.push(`/apply/${application_id}`);
          } else if (appStatus === "failed") {
            clearInterval(poll);
            setError(appRes.data.error_message || "Processing failed. Please try again.");
            setLoading(false);
            setStage(-1);
          }
        } catch {
          // ignore transient errors
        }
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Submission failed. Please try again.");
      setLoading(false);
      setStage(-1);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="page-header">
          <h1 className="page-title">New Application</h1>
          <p className="page-subtitle">Upload a job circular, paste a URL, or type a job description</p>
        </div>

        {/* Mode tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#f3f4f6",
            borderRadius: 12,
            padding: 4,
            marginBottom: 24,
            width: "fit-content",
          }}
        >
          {(["file", "url", "text"] as InputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "8px 20px",
                borderRadius: 9,
                border: "none",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.15s",
                background: mode === m ? "white" : "transparent",
                color: mode === m ? "#6366f1" : "#6b7280",
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {m === "file" ? "📎 File / Image" : m === "url" ? "🔗 URL" : "📝 Paste Text"}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 32 }}>
          {/* File drop zone */}
          {mode === "file" && (
            <div>
              <div
                {...getRootProps()}
                className={`drop-zone${isDragActive ? " drag-over" : ""}`}
                style={{ marginBottom: file ? 16 : 0 }}
              >
                <input {...getInputProps()} />
                <Upload size={32} style={{ margin: "0 auto 12px", color: "#9ca3af" }} />
                <p style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  {isDragActive ? "Drop your file here" : "Drag & drop or click to upload"}
                </p>
                <p style={{ fontSize: 13, color: "#9ca3af" }}>
                  PDF, DOCX, PNG, JPG, WebP, TXT — max 50MB
                </p>
              </div>
              {file && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "#f0f4ff",
                    borderRadius: 10,
                    border: "1px solid #c7d6fe",
                    marginTop: 12,
                  }}
                >
                  <File size={18} style={{ color: "#6366f1" }} />
                  <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* URL input */}
          {mode === "url" && (
            <div>
              <label className="label" htmlFor="url-input">Job posting URL</label>
              <div style={{ position: "relative" }}>
                <Link2 size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input
                  id="url-input"
                  className="input"
                  style={{ paddingLeft: 38 }}
                  placeholder="https://company.com/careers/job-posting"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                Only publicly accessible pages are supported. Private networks and localhost are blocked.
              </p>
            </div>
          )}

          {/* Text paste */}
          {mode === "text" && (
            <div>
              <label className="label" htmlFor="text-input">Paste job description</label>
              <textarea
                id="text-input"
                className="input"
                style={{ minHeight: 200 }}
                placeholder="Paste the full job description or circular here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}

          {/* Instructions */}
          <div style={{ marginTop: 20 }}>
            <label className="label" htmlFor="instructions-input">
              Additional instructions <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="instructions-input"
              className="input"
              placeholder='e.g. "Emphasize my Python experience" or "Use formal tone"'
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error" style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ marginTop: 24, width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15 }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Analyze & Generate Email
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Processing stages */}
        {loading && (
          <div className="card" style={{ padding: 24, marginTop: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Processing stages</h3>
            {STAGES.map((s, i) => (
              <div key={s} className="stage-item">
                <div
                  className="stage-dot"
                  style={{
                    background:
                      i < stage
                        ? "#10b981"
                        : i === stage
                        ? "#6366f1"
                        : "#e5e7eb",
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    color: i <= stage ? "#374151" : "#9ca3af",
                    fontWeight: i === stage ? 600 : 400,
                  }}
                >
                  {s}
                </span>
                {i === stage && (
                  <Loader2 size={14} className="animate-spin" style={{ color: "#6366f1", marginLeft: "auto" }} />
                )}
                {i < stage && (
                  <CheckCircle size={14} style={{ color: "#10b981", marginLeft: "auto" }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
