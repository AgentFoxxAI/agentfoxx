import { useState, useMemo } from "react";
import { useReviews, useDeleteReview } from "@/hooks/use-reviews";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { CheckCircle2, XCircle, Clock, ArrowRight, Loader2, CalendarClock, Trash2, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ReviewList() {
  const { data: reviews, isLoading } = useReviews();
  const deleteReview = useDeleteReview();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter(
      (r) =>
        r.contactName.toLowerCase().includes(q) ||
        r.contactEmail.toLowerCase().includes(q) ||
        (r.company && r.company.toLowerCase().includes(q))
    );
  }, [reviews, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-reviews">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = reviews?.filter(r => r.status === "pending_approval").length || 0;

  return (
    <div className="max-w-6xl mx-auto py-4 px-4 space-y-4">

      {/* Header */}
      <div className="flex justify-between items-center gap-3">
        <h1 className="text-xl sm:text-3xl font-bold leading-tight" data-testid="text-page-title">
          Approval Queue
        </h1>
        <Badge variant="outline" className="px-3 py-1.5 shrink-0 text-sm" data-testid="badge-pending-count">
          {pendingCount} Pending
        </Badge>
      </div>

      {/* Search — full width, 48px touch target */}
      <div className="relative w-full" data-testid="search-container">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search name, company, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-12 w-full text-base"
          data-testid="input-search-reviews"
        />
      </div>

      {/* Review cards */}
      <div className="grid gap-3" data-testid="list-reviews">
        {filteredReviews.map((review) => (
          <Card
            key={review.id}
            className="hover:bg-accent/5 transition-colors"
            data-testid={`card-review-${review.id}`}
          >
            <CardContent className="p-4 sm:p-5">

              {/* Row 1: Name + status badge + delete */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 flex-wrap min-w-0">
                  <h3
                    className="font-semibold text-base leading-snug"
                    data-testid={`text-name-${review.id}`}
                  >
                    {review.contactName}
                  </h3>
                  <StatusBadge status={review.status} reviewId={review.id} />
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-11 w-11 shrink-0 -mt-1 -mr-1"
                      data-testid={`button-delete-review-${review.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Review</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the review for{" "}
                        <strong>{review.contactName}</strong>? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid={`button-cancel-delete-${review.id}`}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteReview.mutate(review.id)}
                        disabled={deleteReview.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid={`button-confirm-delete-${review.id}`}
                      >
                        {deleteReview.isPending ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Row 2: Company (own line, no truncation) */}
              {review.company && (
                <p
                  className="text-sm font-medium text-foreground/80 mb-0.5 break-words"
                  data-testid={`text-company-${review.id}`}
                >
                  {review.company}
                </p>
              )}

              {/* Row 3: Email (own line, wraps naturally) */}
              <p
                className="text-sm text-muted-foreground break-all mb-3"
                data-testid={`text-info-${review.id}`}
              >
                {review.contactEmail}
              </p>

              {/* Row 4: Date + classification — stacks above Review button on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className="text-xs text-muted-foreground flex items-center gap-1"
                    data-testid={`text-date-${review.id}`}
                  >
                    <CalendarClock className="w-3 h-3 shrink-0" />
                    {formatDate(review.timestamp || review.createdAt as unknown as string)}
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    data-testid={`badge-class-${review.id}`}
                  >
                    {review.classification}
                  </Badge>
                </div>

                {/* Review button — full width on mobile, auto on desktop */}
                <Link href={`/reviews/${review.id}`} className="w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full sm:w-auto h-11 px-4 justify-center border border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
                    data-testid={`button-review-${review.id}`}
                  >
                    Review <ArrowRight className="ml-1.5 w-4 h-4" />
                  </Button>
                </Link>
              </div>

            </CardContent>
          </Card>
        ))}

        {filteredReviews.length === 0 && searchQuery.trim() && (reviews?.length ?? 0) > 0 && (
          <div
            className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed"
            data-testid="empty-search-state"
          >
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No matching reviews</h3>
            <p className="text-sm text-muted-foreground">Try a different search term.</p>
          </div>
        )}

        {reviews?.length === 0 && (
          <div
            className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed"
            data-testid="empty-state"
          >
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No reviews found</h3>
            <p className="text-sm text-muted-foreground">
              New review requests from n8n will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, reviewId }: { status: string; reviewId: number }) {
  switch (status) {
    case "approved":
      return (
        <Badge
          className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0 text-xs shrink-0"
          data-testid={`status-approved-${reviewId}`}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0 text-xs shrink-0"
          data-testid={`status-rejected-${reviewId}`}
        >
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge
          className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0 text-xs shrink-0"
          data-testid={`status-pending-${reviewId}`}
        >
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
  }
}
