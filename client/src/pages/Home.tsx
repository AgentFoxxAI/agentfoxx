import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { AudioRecorder } from "@/components/audio-recorder";
import { useUploadAudio } from "@/hooks/use-activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, UserPlus, Sparkles, Mic } from "lucide-react";

// Frontend validation schema matching the backend requirements
const formSchema = z.object({
  contactName: z.string().min(2, "Contact name is required"),
  contactEmail: z.string().email("Valid email is required"),
  company: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [, setLocation] = useLocation();
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const uploadAudio = useUploadAudio();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactName: "",
      contactEmail: "",
      company: "",
      notes: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!audioBlob) {
      form.setError("root", { message: "Please record audio before submitting." });
      return;
    }

    uploadAudio.mutate(
      { data, audioBlob },
      {
        onSuccess: () => {
          form.reset();
          setAudioBlob(null);
          setLocation("/dashboard");
        },
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-gradient-to-r from-primary/10 via-accent/50 to-transparent p-8 rounded-3xl border border-primary/10">
        <div>
          <Badge className="mb-4 bg-primary/15 text-primary hover:bg-primary/20 transition-colors border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Networking Assistant
          </Badge>
          <h1 className="text-4xl font-display font-bold text-foreground tracking-tight">
            Capture Conversations
          </h1>
          <p className="text-muted-foreground mt-2 text-lg max-w-2xl">
            Record your post-meeting thoughts. AgentFoxx will transcribe, analyze themes, and automatically draft follow-up emails in Outreach.io.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Contact Details
              </CardTitle>
              <CardDescription>
                Who did you just speak with?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" className="bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="jane@example.com" className="bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corp" className="bg-background/50" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Context / Extra Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Met at booth 42. Interested in enterprise features." 
                            className="resize-none bg-background/50 min-h-[100px]" 
                            {...field} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.formState.errors.root && (
                    <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
                      {form.formState.errors.root.message}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={!audioBlob || uploadAudio.isPending}
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover-elevate active-elevate-2 transition-all"
                  >
                    {uploadAudio.isPending ? (
                      "Processing Workflow..."
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Submit to Agent
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Audio Recorder */}
        <div className="lg:col-span-7 space-y-6">
          <div className="sticky top-6">
            <h3 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-primary" />
              Voice Memo
            </h3>
            <AudioRecorder 
              onRecordingComplete={(blob) => setAudioBlob(blob)} 
              isProcessing={uploadAudio.isPending}
            />
            
            <div className="mt-8 bg-secondary/50 rounded-2xl p-6 border border-border">
              <h4 className="font-semibold text-foreground mb-2">Agent Instructions:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside ml-4">
                <li>Speak naturally about the conversation you just had.</li>
                <li>Mention key pain points, features discussed, or follow-up items.</li>
                <li>The agent will extract themes and draft a highly personalized email based on your tone.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
