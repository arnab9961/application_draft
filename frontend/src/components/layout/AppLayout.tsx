"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { withAuth } from "@/components/auth/withAuth";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default withAuth(AppLayout);
