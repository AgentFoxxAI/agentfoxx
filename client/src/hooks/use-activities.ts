import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Activity, type InsertActivity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useEventContext } from "@/contexts/EventContext";
import { supabase } from "@/lib/supabase";

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return fetch(url, { ...init, headers });
}

export interface StatsResponse {
  emailsSent: number;
  leadsCreated: number;
  themeDistribution: Array<{ theme: string; count: number }>;
}

export interface UploadAudioResponse {
  success: boolean;
  activityId: number;
  audioUrl: string;
  message: string;
}

export function useActivities() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;

  return useQuery<Activity[]>({
    queryKey: ["/api/activities", { eventId }],
    queryFn: async () => {
      const url = eventId ? `/api/activities?eventId=${eventId}` : "/api/activities";
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });
}

export function useActivity(id: number) {
  return useQuery<Activity>({
    queryKey: ["/api/activities", id],
    queryFn: async () => {
      const res = await authFetch(`/api/activities/${id}`);
      if (res.status === 404) throw new Error("Activity not found");
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useStats() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;

  return useQuery<StatsResponse>({
    queryKey: ["/api/stats", { eventId }],
    queryFn: async () => {
      const url = eventId ? `/api/stats?eventId=${eventId}` : "/api/stats";
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });
}

export function useUploadAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeEvent } = useEventContext();

  return useMutation<
    UploadAudioResponse,
    Error,
    { data: { contactName: string; contactEmail: string; company?: string; notes?: string }; audioBlob: Blob }
  >({
    mutationFn: async ({ data, audioBlob }) => {
      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append("contactName", data.contactName);
      formData.append("contactEmail", data.contactEmail);
      if (data.company) formData.append("company", data.company);
      if (data.notes) formData.append("notes", data.notes);
      if (activeEvent) formData.append("eventId", String(activeEvent.id));
      formData.append("audio", audioBlob, "recording.webm");

      const res = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload audio";
        try {
          const errData = await res.json();
          errorMessage = errData.error || errData.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: data.message || "Audio uploaded and processing started.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
