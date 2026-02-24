import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Review, type InsertReview } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useReviews() {
  return useQuery<Review[]>({
    queryKey: ["/api/reviews"],
    queryFn: async () => {
      const res = await fetch("/api/reviews");
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
  });
}

export function useReview(id: number) {
  return useQuery<Review>({
    queryKey: ["/api/reviews", id],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${id}`);
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
      const res = await fetch(`/api/reviews/${id}`, {
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
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
