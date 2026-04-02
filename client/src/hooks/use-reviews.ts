import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Review, type InsertReview } from "@shared/schema";
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

export function useReviews() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;

  return useQuery<Review[]>({
    queryKey: ["/api/reviews", { eventId }],
    queryFn: async () => {
      const url = eventId ? `/api/reviews?eventId=${eventId}` : "/api/reviews";
      const res = await authFetch(url);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
  });
}

export function useReview(id: number) {
  return useQuery<Review>({
    queryKey: ["/api/reviews", id],
    queryFn: async () => {
      const res = await authFetch(`/api/reviews/${id}`);
      if (res.status === 404) throw new Error("Review not found");
      if (!res.ok) throw new Error("Failed to fetch review");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<Review, Error, { id: number; updates: Partial<InsertReview> }>({
    mutationFn: async ({ id, updates }) => {
      const res = await authFetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update review");
      return res.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", id] });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<{ success: boolean; message: string }, Error, number>({
    mutationFn: async (id) => {
      const res = await authFetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete review");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.removeQueries({ queryKey: ["/api/reviews", id] });
      toast({ title: "Review Deleted", description: "The review has been permanently removed." });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDecideReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    { success: boolean; message: string },
    Error,
    { id: number; status: "approved" | "rejected"; emailBody: string; subjectLine: string }
  >({
    mutationFn: async ({ id, status, emailBody, subjectLine }) => {
      const res = await authFetch(`/api/reviews/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, emailBody, subjectLine }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Request failed" }));
        throw new Error(err.message || "Failed to submit decision");
      }
      return res.json();
    },
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", id] });
      toast({ title: "Decision Submitted", description: data.message });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
