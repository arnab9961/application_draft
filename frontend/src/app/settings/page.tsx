"use client";
import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";
import { Mail, User, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="animate-fade-in" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your personal workspace</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link href="/settings/gmail" className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={20} style={{ color: "#6366f1" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Gmail Connection</div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Connect or manage your Gmail account</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 18 }}>›</span>
          </Link>

          <Link href="/profile" className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={20} style={{ color: "#10b981" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Profile & CV</div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Update your professional information and CVs</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 18 }}>›</span>
          </Link>

          <div className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={20} style={{ color: "#f59e0b" }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Security</div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Single-user access enforced. All emails require explicit approval.</div>
            </div>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginTop: 20 }}>
          <strong>Backend configuration</strong> (GROQ_MODEL, authorized email, etc.) is managed via your backend <code style={{ background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 4 }}>.env</code> file on your VPS.
        </div>
      </div>
    </AppLayout>
  );
}
