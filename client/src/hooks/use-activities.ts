import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Activity, type InsertActivity } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Types derived from backend responses
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
  return useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    queryFn: async () => {
      const res = await fetch("/api/activities");
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });
}

export function useActivity(id: number) {
  return useQuery<Activity>({
    queryKey: [`/api/activities/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/activities/${id}`);
      if (res.status === 404) throw new Error("Activity not found");
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useStats() {
  return useQuery<StatsResponse>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });
}

export function useUploadAudio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    UploadAudioResponse,
    Error,
    { data: InsertActivity; audioBlob: Blob }
  >({
    mutationFn: async ({ data, audioBlob }) => {
      const formData = new FormData();
      formData.append("contactName", data.contactName);
      formData.append("contactEmail", data.contactEmail);
      if (data.company) formData.append("company", data.company);
      if (data.notes) formData.append("notes", data.notes);
      
      // Append audio blob with a filename
      formData.append("audio", audioBlob, "recording.webm");

      const res = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type header; fetch will set it with boundary for FormData automatically
      });

      if (!res.ok) {
        let errorMessage = "Failed to upload audio";
        try {
          const errData = await res.json();
          errorMessage = errData.error || errData.message || errorMessage;
        } catch (e) {
          // Ignore parse errors if response is not JSON
        }
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
