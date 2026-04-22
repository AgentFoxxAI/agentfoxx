import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEventContext } from "@/contexts/EventContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Zap } from "lucide-react";

interface LeadEvent {
  id: number;
  contact_name: string;
  company: string;
  classification: string;
  user_id: string;
}

interface ToastItem {
  id: string;
  repName: string;
  contactName: string;
  company: string;
  classification: string;
  visible: boolean;
}

export function LeadToast() {
  const { activeEvent } = useEventContext();
  const { profile } = useAuthContext();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("agentfoxx_live_feed") !== "false";
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  useEffect(() => {
    if (!enabled || !activeEvent) return;

    const channel = supabase
      .channel(`reviews-${activeEvent.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reviews",
          filter: `event_id=eq.${activeEvent.id}`,
        },
        async (payload) => {
          const review = payload.new as LeadEvent;

          // Don't show toast for own captures
          if (review.user_id === profile?.id) return;

          // Look up rep name
          let repName = "A teammate";
          try {
            const { data } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", review.user_id)
              .single();
            if (data) repName = data.name.split(" ")[0]; // First name only
          } catch {}

          const toastId = `lead-${review.id}-${Date.now()}`;
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              repName,
              contactName: review.contact_name,
              company: review.company,
              classification: review.classification,
              visible: true,
            },
          ]);

          // Auto-dismiss after 1.5 seconds
          setTimeout(() => dismissToast(toastId), 1500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, activeEvent, profile?.id, dismissToast]);

  // Toggle control (exposed via window for sidebar toggle)
  useEffect(() => {
    (window as any).__agentfoxx_live_feed = {
      enabled,
      toggle: () => {
        setEnabled((prev) => {
          const next = !prev;
          localStorage.setItem("agentfoxx_live_feed", String(next));
          return next;
        });
      },
    };
  }, [enabled]);

  if (!enabled || toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center gap-2 pt-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto max-w-sm w-full transition-all duration-300 ${
            toast.visible
              ? "animate-in slide-in-from-top-2 fade-in"
              : "animate-out slide-out-to-top-2 fade-out"
          }`}
        >
          <div className="bg-green-500/95 backdrop-blur-sm text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {toast.repName} captured a lead!
              </p>
              <p className="text-xs text-white/80 truncate">
                {toast.contactName} · {toast.company}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
