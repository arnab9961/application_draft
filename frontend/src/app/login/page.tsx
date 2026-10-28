"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Bot, Mail, Lock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Invalid email or password. Access is restricted.");
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(99,102,241,0.3)",
            }}
          >
            <Bot size={32} color="white" />
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.5px",
              marginBottom: 8,
            }}
          >
            AI Job Assistant
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Private workspace — sign in to continue
          </p>
        </div>

        {/* Card */}
        <div
          className="card"
          style={{ padding: 32 }}
        >
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                  }}
                />
                <input
                  id="email"
                  type="email"
                  className="input"
                  style={{ paddingLeft: 38 }}
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                  }}
                />
                <input
                  id="password"
                  type="password"
                  className="input"
                  style={{ paddingLeft: 38 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-error" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ justifyContent: "center", padding: "12px 20px", fontSize: 15 }}
            >
              {loading ? (
                <span className="animate-spin" style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block" }} />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 24 }}>
          This is a private personal workspace. Access is restricted.
        </p>
      </div>
    </div>
  );
}
