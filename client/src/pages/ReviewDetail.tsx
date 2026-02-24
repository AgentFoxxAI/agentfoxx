import { useRoute, useLocation } from "wouter";
import { useReview, useUpdateReview } from "@/hooks/use-reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { Check, X, ArrowLeft, Mail, FileText, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ReviewDetail() {
  const [, params] = useRoute("/reviews/:id");
  const [, setLocation] = useLocation();
  const { data: review, isLoading } = useReview(Number(params?.id));
  const updateReview = useUpdateReview();
  const { toast } = useToast();
  
  const [emailBody, setEmailBody] = useState("");
  const [subjectLine, setSubjectLine] = useState("");

  useEffect(() => {
    if (review) {
      setEmailBody(review.emailBody);
      setSubjectLine(review.subjectLine || "");
    }
  }, [review]);

  if (isLoading || !review) return <div className="p-8">Loading...</div>;

  const handleDecision = async (status: "approved" | "rejected") => {
    try {
      // 1. Update local database
      await updateReview.mutateAsync({
        id: review.id,
        updates: { status, emailBody, subjectLine }
      });

      // 2. Call n8n resume webhook
      const response = await fetch(review.resumeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status,
          emailBody,
          subjectLine,
          reviewId: review.id
        })
      });

      if (!response.ok) throw new Error("Failed to notify workflow");

      toast({
        title: status === "approved" ? "Review Approved" : "Review Rejected",
        description: status === "approved" ? "Email sent to outreach workflow." : "Workflow cancelled.",
      });

      setLocation("/reviews");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" onClick={() => setLocation("/reviews")} className="mb-4">
        <ArrowLeft className="mr-2 w-4 h-4" /> Back to Queue
      </Button>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{review.contactName}</h1>
          <p className="text-muted-foreground">{review.company} • {review.contactEmail}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="text-lg py-1 px-4">{review.classification}</Badge>
          <span className="text-xs text-muted-foreground">Confidence: {review.confidence}</span>
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
                <input 
                  value={subjectLine} 
                  onChange={(e) => setSubjectLine(e.target.value)}
                  className="w-full p-2 rounded border bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body</label>
                <Textarea 
                  value={emailBody} 
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="min-h-[300px] font-serif text-lg leading-relaxed"
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
              <p className="text-sm text-muted-foreground italic">"{review.transcription}"</p>
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
              <p className="text-sm">{review.keyInsights}</p>
              {review.whitePaper && (
                <div className="mt-4 p-3 bg-primary/5 rounded border border-primary/10">
                  <span className="text-xs font-semibold uppercase text-primary">Attached Asset</span>
                  <p className="text-sm font-medium">{review.whitePaper}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sticky top-6 space-y-3">
            <Button 
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700" 
              onClick={() => handleDecision("approved")}
              disabled={updateReview.isPending}
            >
              <Check className="mr-2 w-6 h-6" /> Approve & Send
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-14 text-lg text-red-600 border-red-200 hover:bg-red-50" 
              onClick={() => handleDecision("rejected")}
              disabled={updateReview.isPending}
            >
              <X className="mr-2 w-6 h-6" /> Reject Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
