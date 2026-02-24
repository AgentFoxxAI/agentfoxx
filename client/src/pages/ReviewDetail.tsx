import { useRoute, useLocation } from "wouter";
import { useReview, useDecideReview } from "@/hooks/use-reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Check, X, ArrowLeft, Mail, FileText, MessageSquare, Loader2 } from "lucide-react";

export default function ReviewDetail() {
  const [, params] = useRoute("/reviews/:id");
  const [, setLocation] = useLocation();
  const { data: review, isLoading } = useReview(Number(params?.id));
  const decideReview = useDecideReview();

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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <Button
        variant="ghost"
        onClick={() => setLocation("/reviews")}
        data-testid="button-back-to-queue"
      >
        <ArrowLeft className="mr-2 w-4 h-4" /> Back to Queue
      </Button>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold" data-testid="text-contact-name">{review.contactName}</h1>
          <p className="text-muted-foreground" data-testid="text-contact-info">
            {review.company} &bull; {review.contactEmail}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="text-lg py-1 px-4" data-testid="badge-classification">
            {review.classification}
          </Badge>
          <span className="text-xs text-muted-foreground" data-testid="text-confidence">
            Confidence: {review.confidence}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle>Email Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  disabled={!isPending}
                  data-testid="input-subject-line"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body</label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={!isPending}
                  className="min-h-[300px] leading-relaxed"
                  data-testid="input-email-body"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <CardTitle>Transcription</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic" data-testid="text-transcription">
                {review.transcription ? `"${review.transcription}"` : "No transcription available."}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm" data-testid="text-key-insights">
                {review.keyInsights || "No insights available."}
              </p>
              {review.whitePaper && (
                <div className="mt-4 p-3 bg-primary/5 rounded border border-primary/10">
                  <span className="text-xs font-semibold uppercase text-primary">Attached Asset</span>
                  <p className="text-sm font-medium" data-testid="text-white-paper">{review.whitePaper}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {isPending && (
            <div className="sticky top-6 space-y-3">
              <Button
                className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                onClick={() => handleDecision("approved")}
                disabled={isDeciding}
                data-testid="button-approve"
              >
                {isDeciding ? (
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                ) : (
                  <Check className="mr-2 w-6 h-6" />
                )}
                Approve &amp; Send
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 text-lg text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleDecision("rejected")}
                disabled={isDeciding}
                data-testid="button-reject"
              >
                {isDeciding ? (
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                ) : (
                  <X className="mr-2 w-6 h-6" />
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
    </div>
  );
}
