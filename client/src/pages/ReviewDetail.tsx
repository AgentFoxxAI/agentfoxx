import { useRoute, useLocation } from "wouter";
import { useReview, useDecideReview, useDeleteReview } from "@/hooks/use-reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Check, X, ArrowLeft, Mail, FileText, MessageSquare, Loader2, Trash2 } from "lucide-react";
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

export default function ReviewDetail() {
  const [, params] = useRoute("/reviews/:id");
  const [, setLocation] = useLocation();
  const { data: review, isLoading } = useReview(Number(params?.id));
  const decideReview = useDecideReview();
  const deleteReview = useDeleteReview();

  const [emailBody, setEmailBody] = useState("");
  const [subjectLine, setSubjectLine] = useState("");

  useEffect(() => {
    if (review) {
      setEmailBody(review.emailBody);
      setSubjectLine(review.subjectLine || "");
    }
  }, [review]);

  if (isLoading || !review) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-review">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPending = review.status === "pending_approval";
  const isDeciding = decideReview.isPending;

  const handleDecision = async (status: "approved" | "rejected") => {
    await decideReview.mutateAsync({
      id: review.id,
      status,
      emailBody,
      subjectLine,
    });
    setLocation("/reviews");
  };

  const handleDelete = async () => {
    await deleteReview.mutateAsync(review.id);
    setLocation("/reviews");
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 space-y-4">

      {/* Top nav bar */}
      <div className="flex justify-between items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => setLocation("/reviews")}
          className="h-10 px-2 sm:px-3"
          data-testid="button-back-to-queue"
        >
          <ArrowLeft className="mr-1.5 w-4 h-4" /> <span className="text-sm sm:text-base">Back</span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 h-10"
              data-testid="button-delete-detail"
            >
              <Trash2 className="mr-1.5 w-4 h-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Review</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the review for <strong>{review.contactName}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-detail">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteReview.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-detail"
              >
                {deleteReview.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Contact header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight" data-testid="text-contact-name">{review.contactName}</h1>
          <p className="text-sm text-muted-foreground truncate" data-testid="text-contact-info">
            {review.company}{review.company && review.contactEmail ? ' · ' : ''}{review.contactEmail}
          </p>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end gap-2">
          <Badge variant="outline" className="text-sm py-1 px-3" data-testid="badge-classification">
            {review.classification}
          </Badge>
          <span className="text-xs text-muted-foreground" data-testid="text-confidence">
            {review.confidence} confidence
          </span>
        </div>
      </div>

      {/* Main layout: single col on mobile, 3-col on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Email draft — full width on mobile, 2/3 on desktop */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <CardTitle className="text-base sm:text-lg">Email Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  disabled={!isPending}
                  className="h-11 text-base"
                  data-testid="input-subject-line"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Body</label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={!isPending}
                  className="min-h-[260px] sm:min-h-[320px] leading-relaxed text-sm"
                  data-testid="input-email-body"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <MessageSquare className="w-5 h-5 text-primary shrink-0" />
              <CardTitle className="text-base sm:text-lg">Transcription</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic leading-relaxed" data-testid="text-transcription">
                {review.transcription ? `"${review.transcription}"` : "No transcription available."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: insights + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <CardTitle className="text-base sm:text-lg">Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed" data-testid="text-key-insights">
                {review.keyInsights || "No insights available."}
              </p>
              {review.whitePaper && (
                <div className="mt-4 p-3 bg-primary/5 rounded border border-primary/10">
                  <span className="text-xs font-semibold uppercase text-primary">Attached Asset</span>
                  <p className="text-sm font-medium mt-0.5" data-testid="text-white-paper">{review.whitePaper}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {isPending && (
            <div className="space-y-3">
              <Button
                className="w-full h-14 text-base sm:text-lg bg-green-600 hover:bg-green-700"
                onClick={() => handleDecision("approved")}
                disabled={isDeciding}
                data-testid="button-approve"
              >
                {isDeciding ? (
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                ) : (
                  <Check className="mr-2 w-5 h-5" />
                )}
                Approve &amp; Send
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 text-base sm:text-lg text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => handleDecision("rejected")}
                disabled={isDeciding}
                data-testid="button-reject"
              >
                {isDeciding ? (
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                ) : (
                  <X className="mr-2 w-5 h-5" />
                )}
                Reject Draft
              </Button>
            </div>
          )}

          {!isPending && (
            <div className="p-4 rounded-lg border bg-muted/30 text-center" data-testid="text-decision-status">
              <p className="text-sm font-medium">
                This review has been <span className="font-bold">{review.status}</span>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky approve/reject bar — mobile only, shown at bottom when pending */}
      {isPending && (
        <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 bg-background/95 backdrop-blur-md border-t border-border p-3 flex gap-3">
          <Button
            className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700"
            onClick={() => handleDecision("approved")}
            disabled={isDeciding}
            data-testid="button-approve-sticky"
          >
            {isDeciding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="mr-1.5 w-5 h-5" />}
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-14 text-base text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => handleDecision("rejected")}
            disabled={isDeciding}
            data-testid="button-reject-sticky"
          >
            {isDeciding ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="mr-1.5 w-5 h-5" />}
            Reject
          </Button>
        </div>
      )}
      {/* Bottom padding so sticky bar doesn't cover content on mobile */}
      {isPending && <div className="h-20 md:hidden" />}
    </div>
  );
}
