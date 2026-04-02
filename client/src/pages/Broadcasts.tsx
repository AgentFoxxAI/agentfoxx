import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEventContext } from "@/contexts/EventContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Send, Loader2, MessageSquare } from "lucide-react";
import type { Broadcast } from "@shared/schema";

export default function Broadcasts() {
  const { activeEvent } = useEventContext();
  const { isAdmin, profile } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const eventId = activeEvent?.id;

  const [message, setMessage] = useState("");

  const { data: broadcasts, isLoading } = useQuery<Broadcast[]>({
    queryKey: ["/api/broadcasts", { eventId }],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = eventId ? `/api/broadcasts?eventId=${eventId}` : "/api/broadcasts";
      const res = await fetch(url, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch broadcasts");
      return res.json();
    },
    refetchInterval: 15000, // Poll every 15s as fallback to Realtime
  });

  const sendBroadcast = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", "/api/broadcasts", {
        message: msg,
        targetType: "all",
        eventId: eventId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts"] });
      toast({ title: "Broadcast sent", description: "Your message has been sent to the team." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-3 bg-gradient-to-r from-blue-500/10 via-accent/50 to-transparent p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-blue-500/10">
        <Badge className="self-start bg-blue-500/15 text-blue-500 hover:bg-blue-500/20 transition-colors border-0">
          <Megaphone className="w-3 h-3 mr-1" />
          Team Updates
        </Badge>
        <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
          Broadcasts
        </h1>
        <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl">
          Real-time updates from field marketing and team leads.
          {activeEvent && <span className="font-medium text-foreground"> · {activeEvent.name}</span>}
        </p>
      </div>

      {/* Compose (admin only) */}
      {isAdmin && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (message.trim()) sendBroadcast.mutate(message.trim());
              }}
              className="flex gap-3"
            >
              <Textarea
                placeholder="Broadcast a message to the team..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[48px] max-h-[120px] resize-none flex-1"
                rows={1}
              />
              <Button
                type="submit"
                disabled={sendBroadcast.isPending || !message.trim()}
                className="shrink-0 h-12 px-4"
              >
                {sendBroadcast.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Broadcast feed */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="glass-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading broadcasts...
            </CardContent>
          </Card>
        ) : broadcasts?.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No broadcasts yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdmin
                  ? "Send a message to keep your team informed."
                  : "Team updates will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          broadcasts?.map((broadcast) => (
            <Card key={broadcast.id} className="glass-card hover:bg-accent/5 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-semibold text-sm shrink-0 mt-0.5">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{broadcast.message}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {formatTime(broadcast.createdAt as unknown as string)}
                      {broadcast.targetType === "individual" && (
                        <Badge variant="outline" className="ml-2 text-xs">Direct</Badge>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
