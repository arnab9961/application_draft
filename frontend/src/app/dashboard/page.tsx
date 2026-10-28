"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { formatDateTime, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import {
  Send,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  PlusCircle,
  Mail,
  TrendingUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  processing: number;
  awaiting_approval: number;
  sent: number;
  failed: number;
}

interface RecentApp {
  id: string;
  company_name?: string;
  job_title?: string;
  status: string;
  created_at: string;
}

interface GmailStatus {
  connected: boolean;
  email?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/history/stats").then((r) => setStats(r.data)),
      api.get("/api/history/?limit=5").then((r) => setRecent(r.data.items || [])),
      api.get("/api/gmail/status").then((r) => setGmail(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: "Total Applications",
      value: stats?.total ?? 0,
      icon: FileText,
      color: "#6366f1",
      bg: "#f0f4ff",
    },
    {
      label: "Awaiting Review",
      value: stats?.awaiting_approval ?? 0,
      icon: Clock,
      color: "#f59e0b",
      bg: "#fffbeb",
    },
    {
      label: "Sent Successfully",
      value: stats?.sent ?? 0,
      icon: CheckCircle,
      color: "#10b981",
      bg: "#f0fdf4",
    },
    {
      label: "Failed",
      value: stats?.failed ?? 0,
      icon: XCircle,
      color: "#ef4444",
      bg: "#fef2f2",
    },
  ];

  return (
    <AppLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Your personal AI job application workspace</p>
          </div>
          <Link href="/apply" className="btn btn-primary">
            <PlusCircle size={16} />
            New Application
          </Link>
        </div>

        {/* Gmail status banner */}
        {gmail !== null && (
          <div
            className="alert"
            style={{
              marginBottom: 24,
              borderLeftColor: gmail.connected ? "#10b981" : "#f59e0b",
              background: gmail.connected ? "#f0fdf4" : "#fffbeb",
              color: gmail.connected ? "#065f46" : "#92400e",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {gmail.connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {gmail.connected
              ? `Gmail connected: ${gmail.email}`
              : "Gmail not connected — "}
            {!gmail.connected && (
              <Link href="/settings/gmail" style={{ color: "#d97706", fontWeight: 600, textDecoration: "underline" }}>
                Connect Gmail →
              </Link>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="stat-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: card.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={20} style={{ color: card.color }} />
                  </div>
                </div>
                <div className="stat-value">
                  {loading ? (
                    <div className="skeleton" style={{ width: 48, height: 40 }} />
                  ) : (
                    card.value
                  )}
                </div>
                <div className="stat-label">{card.label}</div>
              </div>
            );
          })}
        </div>

        {/* Recent applications */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Recent Applications</h2>
            <Link href="/history" style={{ fontSize: 13, color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 48 }} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "#9ca3af",
              }}
            >
              <FileText size={40} style={{ margin: "0 auto 12px", color: "#e5e7eb" }} />
              <p style={{ fontWeight: 600, marginBottom: 8 }}>No applications yet</p>
              <p style={{ fontSize: 14 }}>Upload a job circular to get started.</p>
              <Link href="/apply" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
                <PlusCircle size={16} />
                New Application
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((app) => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 500 }}>{app.company_name || "—"}</td>
                    <td style={{ color: "#6b7280" }}>{app.job_title || "—"}</td>
                    <td>
                      <span
                        className="badge"
                        style={{}}
                        data-status={app.status}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                          className={STATUS_COLORS[app.status] || "bg-gray-100 text-gray-500"}
                        >
                          {STATUS_LABELS[app.status] || app.status}
                        </span>
                      </span>
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: 13 }}>
                      {formatDateTime(app.created_at)}
                    </td>
                    <td>
                      <Link
                        href={`/apply/${app.id}`}
                        style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
