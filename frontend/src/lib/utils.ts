import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  draft_ready: "Draft Ready",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<string, string> = {
  processing: "bg-blue-100 text-blue-700",
  draft_ready: "bg-yellow-100 text-yellow-700",
  awaiting_approval: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  sending: "bg-purple-100 text-purple-700",
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};
