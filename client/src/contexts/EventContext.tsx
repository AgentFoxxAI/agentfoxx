import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuthContext } from "./AuthContext";
import type { Event } from "@shared/schema";

interface EventContextType {
  events: Event[];
  activeEvent: Event | null;
  setActiveEventId: (id: number) => void;
  isLoading: boolean;
  refetchEvents: () => Promise<void>;
}

const EventContext = createContext<EventContextType | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, isAuthenticated } = useAuthContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem("agentfoxx_active_event");
    return stored ? parseInt(stored, 10) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Event[] = await res.json();
        setEvents(data);

        // Auto-select: stored preference > active event > first event
        if (data.length > 0) {
          const stored = activeEventId;
          const match = stored ? data.find((e) => e.id === stored) : null;
          if (match) {
            // keep stored
          } else {
            const active = data.find((e) => e.isActive);
            const fallback = active || data[0];
            setActiveEventIdState(fallback.id);
            localStorage.setItem("agentfoxx_active_event", String(fallback.id));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, activeEventId]);

  useEffect(() => {
    if (isAuthenticated) fetchEvents();
  }, [isAuthenticated, fetchEvents]);

  const setActiveEventId = useCallback((id: number) => {
    setActiveEventIdState(id);
    localStorage.setItem("agentfoxx_active_event", String(id));
  }, []);

  const activeEvent = events.find((e) => e.id === activeEventId) || null;

  return (
    <EventContext.Provider
      value={{
        events,
        activeEvent,
        setActiveEventId,
        isLoading,
        refetchEvents: fetchEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEventContext must be used within EventProvider");
  return ctx;
}
