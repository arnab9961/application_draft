"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Star, Trash2, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface CVDoc {
  id: string;
  filename: string;
  is_default: boolean;
  created_at: string;
  extracted_text?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [cvs, setCvs] = useState<CVDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "cv">("profile");

  useEffect(() => {
    Promise.all([
      api.get("/api/profile/").then((r) => setProfile(r.data)),
      api.get("/api/cv/").then((r) => setCvs(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await api.put("/api/profile/", profile);
      setProfile(res.data);
      setSuccess("Profile saved.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const onDrop = async (accepted: File[]) => {
    if (!accepted[0]) return;
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", accepted[0]);
    try {
      const res = await api.post("/api/cv/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCvs((prev) => [res.data, ...prev]);
      setSuccess("CV uploaded successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: false,
  });

  const setDefault = async (cvId: string) => {
    await api.patch(`/api/cv/${cvId}/set-default`);
    setCvs((prev) => prev.map((c) => ({ ...c, is_default: c.id === cvId })));
  };

  const deleteCV = async (cvId: string) => {
    if (!confirm("Delete this CV?")) return;
    await api.delete(`/api/cv/${cvId}`);
    setCvs((prev) => prev.filter((c) => c.id !== cvId));
  };

  const field = (label: string, key: string, type: "text" | "textarea" = "text") => (
    <div>
      <label className="label">{label}</label>
      {type === "textarea" ? (
        <textarea
          className="input"
          value={profile[key] || ""}
          onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
        />
      ) : (
        <input
          className="input"
          value={profile[key] || ""}
          onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="page-header">
          <h1 className="page-title">My Profile & CV</h1>
          <p className="page-subtitle">Keep your professional profile accurate — the AI only uses verified information</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 24, width: "fit-content" }}>
          {(["profile", "cv"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 24px",
                borderRadius: 9,
                border: "none",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#6366f1" : "#6b7280",
                boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab === "profile" ? "👤 Profile" : "📄 CV Documents"}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16, display: "flex", gap: 8 }}><AlertCircle size={15} />{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16, display: "flex", gap: 8 }}><CheckCircle size={15} />{success}</div>}

        {activeTab === "profile" && (
          <div className="card" style={{ padding: 28 }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {field("Full Name", "full_name")}
                  {field("Email", "email")}
                  {field("Phone", "phone")}
                  {field("Professional Headline", "headline")}
                </div>
                {field("Professional Summary", "summary", "textarea")}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {field("GitHub URL", "github_url")}
                  {field("LinkedIn URL", "linkedin_url")}
                  {field("Portfolio URL", "portfolio_url")}
                </div>
                <div>
                  <label className="label">Technical Skills <span style={{ color: "#9ca3af", fontWeight: 400 }}>(comma-separated)</span></label>
                  <input
                    className="input"
                    placeholder="Python, FastAPI, React, TypeScript..."
                    value={(profile.skills || []).join(", ")}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        skills: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Achievements <span style={{ color: "#9ca3af", fontWeight: 400 }}>(one per line)</span></label>
                  <textarea
                    className="input"
                    placeholder="Led team of 5 engineers..."
                    value={(profile.achievements || []).join("\n")}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        achievements: e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Certifications <span style={{ color: "#9ca3af", fontWeight: 400 }}>(one per line)</span></label>
                  <textarea
                    className="input"
                    style={{ minHeight: 80 }}
                    value={(profile.certifications || []).join("\n")}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        certifications: e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean),
                      }))
                    }
                  />
                </div>

                <div className="alert alert-warning">
                  <strong>Important:</strong> The AI only uses information explicitly entered here. Never adds or invents experience or skills.
                </div>

                <button
                  className="btn btn-primary"
                  onClick={saveProfile}
                  disabled={saving}
                  style={{ alignSelf: "flex-start", padding: "12px 28px" }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : "Save Profile"}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "cv" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Upload zone */}
            <div
              {...getRootProps()}
              className={`drop-zone${isDragActive ? " drag-over" : ""}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto 10px", color: "#6366f1" }} />
              ) : (
                <Upload size={28} style={{ margin: "0 auto 10px", color: "#9ca3af" }} />
              )}
              <p style={{ fontWeight: 600, color: "#374151" }}>
                {isDragActive ? "Drop CV here" : uploading ? "Uploading..." : "Drag & drop or click to upload CV"}
              </p>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>PDF or DOCX — max 20MB</p>
            </div>

            {/* CV list */}
            {cvs.length === 0 && !loading ? (
              <div className="card" style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>
                <FileText size={32} style={{ margin: "0 auto 10px", color: "#e5e7eb" }} />
                <p>No CV uploaded yet. Upload your CV above.</p>
              </div>
            ) : (
              cvs.map((cv) => (
                <div
                  key={cv.id}
                  className="card"
                  style={{
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    border: cv.is_default ? "2px solid #6366f1" : undefined,
                  }}
                >
                  <FileText size={20} style={{ color: cv.is_default ? "#6366f1" : "#9ca3af", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cv.filename}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>Uploaded {formatDate(cv.created_at)}</div>
                  </div>
                  {cv.is_default && (
                    <span style={{ padding: "3px 10px", borderRadius: 20, background: "#f0f4ff", color: "#6366f1", fontSize: 12, fontWeight: 700 }}>
                      Default
                    </span>
                  )}
                  {!cv.is_default && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setDefault(cv.id)}
                    >
                      <Star size={13} /> Set Default
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    onClick={() => deleteCV(cv.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
