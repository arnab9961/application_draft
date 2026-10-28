"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import api from "@/lib/api";
import { formatDate, STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import { Search, Filter, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";

const STATUSES = [
  "processing", "draft_ready", "awaiting_approval", "approved",
  "sending", "sent", "failed", "cancelled",
];

interface HistoryItem {
  id: string;
  company_name?: string;
  job_title?: string;
  status: string;
  source_type: string;
  created_at: string;
  error_message?: string;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get("/api/history/", { params });
      setItems(res.data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="page-header">
          <h1 className="page-title">Application History</h1>
          <p className="page-subtitle">All your job applications in one place</p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search company or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <select
            className="input"
            style={{ flex: "0 0 180px" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton" style={{ height: 52 }} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af" }}>
              <FileText size={40} style={{ margin: "0 auto 12px", color: "#e5e7eb" }} />
              <p style={{ fontWeight: 600 }}>No applications found</p>
              {search || statusFilter ? (
                <p style={{ fontSize: 14, marginTop: 4 }}>Try different search terms or filters.</p>
              ) : (
                <Link href="/apply" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
                  Start Your First Application
                </Link>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.company_name || <span style={{ color: "#d1d5db" }}>Unknown</span>}</td>
                    <td style={{ color: "#6b7280" }}>{item.job_title || <span style={{ color: "#d1d5db" }}>—</span>}</td>
                    <td>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          display: "inline-block",
                        }}
                        className={STATUS_COLORS[item.status] || ""}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: 12, textTransform: "capitalize" }}>
                      {item.source_type || "—"}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: 13 }}>
                      {formatDate(item.created_at)}
                    </td>
                    <td>
                      <Link
                        href={`/apply/${item.id}`}
                        style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        View <ExternalLink size={12} />
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
