import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEventContext } from "@/contexts/EventContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { Megaphone, X } from "lucide-react";

interface BroadcastEvent {
  id: number;
  message: string;
  from_user_id: string;
  target_type: string;
  target_user_id: string | null;
}

interface ToastItem {
  id: string;
  message: string;
  fromName: string;
  visible: boolean;
}

export function BroadcastToast() {
  const { activeEvent } = useEventContext();
  const { profile } = useAuthContext();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  useEffect(() => {
    if (!activeEvent || !profile) return;

    const channel = supabase
      .channel(`broadcasts-${activeEvent.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "broadcasts",
          filter: `event_id=eq.${activeEvent.id}`,
        },
        async (payload) => {
          const broadcast = payload.new as BroadcastEvent;

          // Don't show if it's an individual message not for us
          if (broadcast.target_type === "individual" && broadcast.target_user_id !== profile.id) {
            return;
          }

          // Don't show own broadcasts
          if (broadcast.from_user_id === profile.id) return;

          let fromName = "Admin";
          try {
            const { data } = await supabase
              .from("profiles")
              .select("name")
              .eq("id", broadcast.from_user_id)
              .single();
            if (data) fromName = data.name.split(" ")[0];
          } catch {}

          const toastId = `broadcast-${broadcast.id}-${Date.now()}`;
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              message: broadcast.message,
              fromName,
              visible: true,
            },
          ]);

          // Auto-dismiss after 5 seconds (longer than lead toasts — deliberate communication)
          setTimeout(() => dismissToast(toastId), 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEvent, profile, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99] pointer-events-none flex flex-col items-center gap-2 pt-14 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto max-w-sm w-full transition-all duration-300 ${
            toast.visible
              ? "animate-in slide-in-from-top-2 fade-in"
              : "animate-out slide-out-to-top-2 fade-out"
          }`}
        >
          <div className="bg-blue-500/95 backdrop-blur-sm text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/70 font-medium">{toast.fromName}</p>
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
