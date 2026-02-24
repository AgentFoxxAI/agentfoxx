import { useReviews } from "@/hooks/use-reviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";

export default function ReviewList() {
  const { data: reviews, isLoading } = useReviews();

  if (isLoading) {
    return <div className="p-8">Loading reviews...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Human Approval Queue</h1>
        <Badge variant="outline" className="px-3 py-1">
          {reviews?.filter(r => r.status === "pending_approval").length || 0} Pending
        </Badge>
      </div>

      <div className="grid gap-4">
        {reviews?.map((review) => (
          <Card key={review.id} className="hover:bg-accent/5 transition-colors">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{review.contactName}</h3>
                  <Badge variant="secondary">{review.classification}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{review.company} • {review.contactEmail}</p>
              </div>

              <div className="flex items-center gap-4">
                <StatusBadge status={review.status} />
                <Link href={`/reviews/${review.id}`}>
                  <Button variant="ghost" size="sm">
                    Review <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {reviews?.length === 0 && (
          <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed">
            <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No reviews found</h3>
            <p className="text-sm text-muted-foreground">New review requests from n8n will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
    default:
      return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
  }
}
