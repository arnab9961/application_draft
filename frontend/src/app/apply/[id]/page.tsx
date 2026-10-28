"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Briefcase,
  Mail,
  FileText,
  Edit2,
  Send,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Save,
  ChevronRight,
  Eye,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";

interface Draft {
  id: string;
  recipient_email: string;
  cc_email: string;
  subject: string;
  body: string;
  cv_document_id: string;
  cv_filename: string;
  draft_version: number;
  content_hash: string;
  cv_match_summary: string;
  missing_info: string[];
  concerns: string[];
}

interface Application {
  id: string;
  status: string;
  extracted_info: Record<string, any>;
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [showRewrite, setShowRewrite] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showApproval, setShowApproval] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [appRes, draftRes] = await Promise.all([
          api.get(`/api/jobs/${id}`),
          api.get(`/api/jobs/${id}/draft`),
        ]);
        setApp(appRes.data);
        setDraft(draftRes.data);
      } catch (e: any) {
        setError(e.response?.data?.detail || "Failed to load application.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/drafts/${draft.id}`, {
        recipient_email: draft.recipient_email,
        cc_email: draft.cc_email,
        subject: draft.subject,
        body: draft.body,
        cv_document_id: draft.cv_document_id,
      });
      setDraft(res.data);
      setEditing(false);
      setSuccessMsg("Draft saved successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const rewrite = async () => {
    if (!draft || !rewriteInstruction) return;
    setRewriting(true);
    try {
      const res = await api.post(`/api/drafts/${draft.id}/rewrite`, {
        instruction: rewriteInstruction,
      });
      setDraft((prev) => prev ? { ...prev, body: res.data.body, draft_version: res.data.draft_version, content_hash: res.data.content_hash } : prev);
      setShowRewrite(false);
      setRewriteInstruction("");
      setSuccessMsg("Email rewritten.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Rewrite failed.");
    } finally {
      setRewriting(false);
    }
  };

  const startApproval = () => {
    if (!draft?.recipient_email) {
      setError("Please set the recipient email before proceeding to approval.");
      return;
    }
    setError("");
    setShowApproval(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#6366f1" }} />
        </div>
      </AppLayout>
    );
  }

  if (showApproval && draft) {
    return (
      <AppLayout>
        <ApprovalScreen
          app={app!}
          draft={draft}
          onBack={() => setShowApproval(false)}
          onSent={() => router.push("/dashboard")}
        />
      </AppLayout>
    );
  }

  const info = app?.extracted_info || {};

  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 860, margin: "0 auto" }}>
        <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">{info.job_title || "Application Draft"}</h1>
            <p className="page-subtitle">{info.company_name || "Unknown Company"}</p>
          </div>
          {app?.status && (
            <span
              style={{
                padding: "4px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
              className={STATUS_COLORS[app.status]}
            >
              {STATUS_LABELS[app.status] || app.status}
            </span>
          )}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <CheckCircle size={16} />
            {successMsg}
          </div>
        )}

        {!draft ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "#6366f1" }} />
            <p>Generating your application email… this may take up to 30 seconds.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            {/* Main editor */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Recipient */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                  <Mail size={16} style={{ color: "#6366f1" }} /> Email Details
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="label">
                      Recipient Email{" "}
                      {!draft.recipient_email && (
                        <span style={{ color: "#ef4444" }}>* Required before sending</span>
                      )}
                    </label>
                    {editing ? (
                      <input
                        className="input"
                        value={draft.recipient_email || ""}
                        onChange={(e) => setDraft((d) => d ? { ...d, recipient_email: e.target.value } : d)}
                        placeholder="hiring@company.com"
                      />
                    ) : (
                      <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 10, fontSize: 14, color: draft.recipient_email ? "#111827" : "#ef4444" }}>
                        {draft.recipient_email || "⚠ Not identified — please enter manually"}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">CC (optional)</label>
                    {editing ? (
                      <input
                        className="input"
                        value={draft.cc_email || ""}
                        onChange={(e) => setDraft((d) => d ? { ...d, cc_email: e.target.value } : d)}
                        placeholder="manager@company.com"
                      />
                    ) : (
                      <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 10, fontSize: 14, color: "#6b7280" }}>
                        {draft.cc_email || "—"}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Subject</label>
                    {editing ? (
                      <input
                        className="input"
                        value={draft.subject || ""}
                        onChange={(e) => setDraft((d) => d ? { ...d, subject: e.target.value } : d)}
                      />
                    ) : (
                      <div style={{ padding: "10px 14px", background: "#f9fafb", borderRadius: 10, fontSize: 14 }}>
                        {draft.subject}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={16} style={{ color: "#6366f1" }} /> Email Body
                  </h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setShowRewrite(!showRewrite)}
                    >
                      <RotateCcw size={13} /> AI Rewrite
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setEditing(!editing)}
                    >
                      <Edit2 size={13} /> {editing ? "Preview" : "Edit"}
                    </button>
                  </div>
                </div>

                {showRewrite && (
                  <div style={{ marginBottom: 16, padding: 14, background: "#f0f4ff", borderRadius: 10, border: "1px solid #c7d6fe" }}>
                    <label className="label">Rewrite instruction</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="input"
                        value={rewriteInstruction}
                        onChange={(e) => setRewriteInstruction(e.target.value)}
                        placeholder='e.g. "Make it shorter and more formal"'
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: "10px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                        onClick={rewrite}
                        disabled={rewriting}
                      >
                        {rewriting ? <Loader2 size={14} className="animate-spin" /> : "Rewrite"}
                      </button>
                    </div>
                  </div>
                )}

                {editing ? (
                  <textarea
                    className="input"
                    style={{ minHeight: 320, fontFamily: "inherit" }}
                    value={draft.body || ""}
                    onChange={(e) => setDraft((d) => d ? { ...d, body: e.target.value } : d)}
                  />
                ) : (
                  <div
                    style={{
                      padding: 16,
                      background: "#f9fafb",
                      borderRadius: 10,
                      fontSize: 14,
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      minHeight: 200,
                    }}
                  >
                    {draft.body}
                  </div>
                )}
              </div>

              {/* Attachment */}
              {draft.cv_filename && (
                <div className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={18} style={{ color: "#6366f1" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Attachment</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{draft.cv_filename}</div>
                  </div>
                </div>
              )}

              {/* Save / Proceed buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                {editing && (
                  <button
                    className="btn btn-secondary"
                    onClick={saveDraft}
                    disabled={saving}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <><Save size={15} /> Save Draft</>}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={startApproval}
                  style={{ flex: 1, justifyContent: "center", padding: "12px 20px" }}
                >
                  <Eye size={16} />
                  Review & Approve
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Sidebar: job info + AI analysis */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Job summary */}
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#374151", display: "flex", gap: 6 }}>
                  <Building2 size={14} style={{ color: "#6366f1" }} /> Job Summary
                </h3>
                <InfoRow label="Company" value={info.company_name} />
                <InfoRow label="Title" value={info.job_title} />
                <InfoRow label="Location" value={info.location} />
                <InfoRow label="Type" value={info.employment_type} />
                <InfoRow label="Deadline" value={info.deadline} />
                <InfoRow label="Salary" value={info.salary} />
              </div>

              {/* CV match */}
              {draft.cv_match_summary && (
                <div className="card" style={{ padding: 18 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#374151", display: "flex", gap: 6 }}>
                    <CheckCircle size={14} style={{ color: "#10b981" }} /> CV Match
                  </h3>
                  <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{draft.cv_match_summary}</p>
                </div>
              )}

              {/* Missing info */}
              {draft.missing_info?.length > 0 && (
                <div className="card" style={{ padding: 18 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#92400e", display: "flex", gap: 6 }}>
                    <AlertTriangle size={14} style={{ color: "#f59e0b" }} /> Missing Info
                  </h3>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {draft.missing_info.map((m: string, i: number) => (
                      <li key={i} style={{ fontSize: 12, color: "#92400e", display: "flex", gap: 6 }}>
                        <span style={{ color: "#f59e0b" }}>•</span> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {draft.concerns?.length > 0 && (
                <div className="card" style={{ padding: 18 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#991b1b", display: "flex", gap: 6 }}>
                    <AlertTriangle size={14} style={{ color: "#ef4444" }} /> Concerns
                  </h3>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {draft.concerns.map((c: string, i: number) => (
                      <li key={i} style={{ fontSize: 12, color: "#991b1b", display: "flex", gap: 6 }}>
                        <span style={{ color: "#ef4444" }}>•</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: "#9ca3af", minWidth: 64, fontWeight: 500 }}>{label}</span>
      <span style={{ color: value ? "#374151" : "#d1d5db", fontStyle: value ? "normal" : "italic" }}>
        {value || "Not specified"}
      </span>
    </div>
  );
}

// ─── Approval Screen ──────────────────────────────────────────────────────────

function ApprovalScreen({
  app,
  draft,
  onBack,
  onSent,
}: {
  app: Application;
  draft: Draft;
  onBack: () => void;
  onSent: () => void;
}) {
  const info = app.extracted_info || {};
  const [approving, setApproving] = useState(false);
  const [sending, setSending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [approvalId, setApprovalId] = useState("");
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(false);

  const approve = async () => {
    setApproving(true);
    setError("");
    try {
      const res = await api.post("/api/drafts/approve", {
        draft_id: draft.id,
        draft_version: draft.draft_version,
        content_hash: draft.content_hash,
      });
      setApprovalId(res.data.approval_id);
      setApproved(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Approval failed.");
    } finally {
      setApproving(false);
    }
  };

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const idempotencyKey = `${draft.id}-${draft.draft_version}-${Date.now()}`;
      await api.post("/api/drafts/send", {
        approval_id: approvalId,
        idempotency_key: idempotencyKey,
      });
      onSent();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Send failed.");
    } finally {
      setSending(false);
      setConfirmDialog(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="page-header">
        <h1 className="page-title">Final Review</h1>
        <p className="page-subtitle">Review every detail before approving the send</p>
      </div>

      {/* Summary card */}
      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: 18, color: "#111827", marginBottom: 20 }}>
          Ready to send this application?
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ConfirmRow icon={<Building2 size={16} />} label="Company" value={info.company_name || "Unknown"} />
          <ConfirmRow icon={<Briefcase size={16} />} label="Position" value={info.job_title || "Unknown"} />
          <ConfirmRow icon={<Mail size={16} />} label="To" value={draft.recipient_email} highlight />
          {draft.cc_email && <ConfirmRow icon={<Mail size={16} />} label="CC" value={draft.cc_email} />}
          <ConfirmRow icon={<FileText size={16} />} label="Subject" value={draft.subject} />
          {draft.cv_filename && (
            <ConfirmRow icon={<FileText size={16} />} label="Attachment" value={draft.cv_filename} />
          )}
        </div>

        <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #f3f4f6" }} />

        <div>
          <label className="label" style={{ marginBottom: 8 }}>Email body</label>
          <div
            style={{
              padding: 16,
              background: "#f9fafb",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              maxHeight: 300,
              overflowY: "auto",
              border: "1px solid #f3f4f6",
            }}
          >
            {draft.body}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Approval notice */}
      {!approved && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <strong>Security:</strong> Your approval is cryptographically bound to the exact content shown above. Any edit after approval will require re-confirmation.
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ flex: 1, justifyContent: "center" }}>
          ← Back to Edit
        </button>

        {!approved ? (
          <button
            className="btn btn-primary"
            onClick={approve}
            disabled={approving}
            style={{ flex: 1, justifyContent: "center" }}
          >
            {approving ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> Approve Content</>}
          </button>
        ) : (
          <button
            className="btn"
            onClick={() => setConfirmDialog(true)}
            disabled={sending}
            style={{
              flex: 1,
              justifyContent: "center",
              background: "linear-gradient(135deg, #059669, #10b981)",
              color: "white",
              boxShadow: "0 2px 8px rgba(16,185,129,0.35)",
            }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Approve & Send</>}
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(2px)",
          }}
        >
          <div className="card" style={{ padding: 32, maxWidth: 420, width: "90%" }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Confirm Send</h3>
            <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 20, lineHeight: 1.6 }}>
              You are about to send the email to{" "}
              <strong>{draft.recipient_email}</strong> with subject{" "}
              <strong>"{draft.subject}"</strong>.{" "}
              This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(false)} style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={send}
                disabled={sending}
                style={{
                  flex: 1,
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  color: "white",
                }}
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : "Yes, Send Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ color: "#6366f1", marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: highlight ? 700 : 400, color: highlight ? "#111827" : "#374151" }}>
          {value}
        </div>
      </div>
    </div>
  );
}
