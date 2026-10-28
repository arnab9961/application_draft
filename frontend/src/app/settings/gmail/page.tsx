"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { Mail, CheckCircle, Wifi, WifiOff, Loader2, AlertCircle, ExternalLink } from "lucide-react";

interface GmailStatus {
  connected: boolean;
  email?: string;
}

export default function GmailSettingsPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/gmail/status")
      .then((r) => setStatus(r.data))
      .catch(() => setError("Failed to load Gmail status."))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      const res = await api.get("/api/gmail/connect");
      window.location.href = res.data.auth_url;
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to start Gmail connection.");
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect Gmail? You will not be able to send emails until reconnected.")) return;
    await api.delete("/api/gmail/disconnect");
    setStatus({ connected: false });
  };

  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="page-header">
          <h1 className="page-title">Gmail Connection</h1>
          <p className="page-subtitle">Connect your Gmail account to send approved applications</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <AlertCircle size={15} />{error}
          </div>
        )}

        <div className="card" style={{ padding: 32 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Loader2 size={28} className="animate-spin" style={{ color: "#6366f1" }} />
            </div>
          ) : status?.connected ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wifi size={24} style={{ color: "#10b981" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Gmail Connected</div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>{status.email}</div>
                </div>
                <CheckCircle size={20} style={{ color: "#10b981", marginLeft: "auto" }} />
              </div>

              <div className="alert alert-success" style={{ marginBottom: 20 }}>
                Your Gmail account is connected. Emails will only be sent after your explicit approval.
              </div>

              <button
                className="btn btn-danger"
                onClick={disconnect}
                style={{ width: "100%", justifyContent: "center" }}
              >
                Disconnect Gmail
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WifiOff size={24} style={{ color: "#9ca3af" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Gmail Not Connected</div>
                  <div style={{ fontSize: 14, color: "#9ca3af" }}>Connect to enable sending emails</div>
                </div>
              </div>

              <div className="alert alert-info" style={{ marginBottom: 20 }}>
                <strong>Privacy:</strong> Only the minimum scope to send emails is requested. Your inbox is never read.
              </div>

              <button
                className="btn btn-primary"
                onClick={connect}
                disabled={connecting}
                style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 15 }}
              >
                {connecting ? (
                  <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                ) : (
                  <><Mail size={16} /> Connect Gmail Account</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Setup instructions */}
        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "#374151" }}>Gmail OAuth Setup (one-time)</h3>
          <ol style={{ listStyle: "decimal", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>
            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>Google Cloud Console <ExternalLink size={12} style={{ display: "inline" }} /></a></li>
            <li>Create a new project and enable the Gmail API</li>
            <li>Configure the OAuth consent screen (External, add your email as test user)</li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add your backend callback URL as an authorized redirect URI</li>
            <li>Copy Client ID and Client Secret to your backend <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>.env</code></li>
            <li>Set <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>GOOGLE_REDIRECT_URI=https://your-backend/api/gmail/callback</code></li>
          </ol>
        </div>
      </div>
    </AppLayout>
  );
}
