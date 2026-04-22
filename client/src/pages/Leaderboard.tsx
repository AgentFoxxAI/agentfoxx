import { useQuery } from "@tanstack/react-query";
import { useEventContext } from "@/contexts/EventContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Flame, Target, Zap } from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  name: string;
  points: number;
  leadCount: number;
  topClassification: string;
}

const classificationLabels: Record<string, { label: string; color: string }> = {
  qualified_lead: { label: "Hot Leads", color: "bg-red-500/10 text-red-500" },
  partnership_opportunity: { label: "Partnerships", color: "bg-purple-500/10 text-purple-500" },
  content_nurture: { label: "Nurture", color: "bg-blue-500/10 text-blue-500" },
  relationship_building: { label: "Networking", color: "bg-green-500/10 text-green-500" },
  needs_clarification: { label: "Follow-up", color: "bg-amber-500/10 text-amber-500" },
};

const rankIcons = [
  <Trophy className="w-6 h-6 text-yellow-500" />,
  <Medal className="w-6 h-6 text-gray-400" />,
  <Medal className="w-6 h-6 text-amber-700" />,
];

export default function Leaderboard() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", { eventId }],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = eventId ? `/api/leaderboard?eventId=${eventId}` : "/api/leaderboard";
      const res = await fetch(url, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-3 bg-gradient-to-r from-yellow-500/10 via-accent/50 to-transparent p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-yellow-500/10">
        <Badge className="self-start bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/20 transition-colors border-0">
          <Flame className="w-3 h-3 mr-1" />
          Live Leaderboard
        </Badge>
        <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
          Lead Capture Board
        </h1>
        <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl">
          Quality-weighted rankings. Hot leads = 5pts, Partnerships = 4pts, Nurture = 3pts, Networking = 2pts.
          {activeEvent && <span className="font-medium text-foreground"> · {activeEvent.name}</span>}
        </p>
      </div>

      {/* Leaderboard */}
      <div className="grid gap-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-5 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : leaderboard?.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No leads captured yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Start recording conversations to see the leaderboard light up.
              </p>
            </CardContent>
          </Card>
        ) : (
          leaderboard?.map((entry, index) => {
            const classification = classificationLabels[entry.topClassification] || classificationLabels.needs_clarification;
            return (
              <Card
                key={entry.userId}
                className={`glass-card transition-all ${index === 0 ? "ring-2 ring-yellow-500/30 bg-yellow-500/5" : ""}`}
              >
                <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                  {/* Rank */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    {index < 3 ? (
                      rankIcons[index]
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">{entry.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {entry.leadCount} lead{entry.leadCount !== 1 ? "s" : ""}
                        </span>
                        <Badge className={`text-xs border-0 ${classification.color}`}>
                          {classification.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-2xl font-display font-bold">{entry.points}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
