import { useReviews } from "@/hooks/use-reviews";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, XCircle, Clock, ArrowRight, Loader2 } from "lucide-react";

export default function ReviewList() {
  const { data: reviews, isLoading } = useReviews();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-reviews">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = reviews?.filter(r => r.status === "pending_approval").length || 0;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Human Approval Queue</h1>
        <Badge variant="outline" className="px-3 py-1" data-testid="badge-pending-count">
          {pendingCount} Pending
        </Badge>
      </div>

      <div className="grid gap-4" data-testid="list-reviews">
        {reviews?.map((review) => (
          <Card key={review.id} className="hover:bg-accent/5 transition-colors" data-testid={`card-review-${review.id}`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg" data-testid={`text-name-${review.id}`}>{review.contactName}</h3>
                  <Badge variant="secondary" data-testid={`badge-class-${review.id}`}>{review.classification}</Badge>
                </div>
                <p className="text-sm text-muted-foreground" data-testid={`text-info-${review.id}`}>
                  {review.company} &bull; {review.contactEmail}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <StatusBadge status={review.status} reviewId={review.id} />
                <Link href={`/reviews/${review.id}`}>
                  <Button variant="ghost" size="sm" data-testid={`button-review-${review.id}`}>
                    Review <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {reviews?.length === 0 && (
          <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed" data-testid="empty-state">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No reviews found</h3>
            <p className="text-sm text-muted-foreground">New review requests from n8n will appear here.</p>
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
        <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0" data-testid={`status-approved-${reviewId}`}>
          <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0" data-testid={`status-rejected-${reviewId}`}>
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0" data-testid={`status-pending-${reviewId}`}>
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
  }
}
