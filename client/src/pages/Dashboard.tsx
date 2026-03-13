import { useState } from "react";
import { format } from "date-fns";
import { useActivities, useStats } from "@/hooks/use-activities";
import { type Activity } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity as ActivityIcon, Mail, Users, CheckCircle2, Clock, AudioLines, FileText } from "lucide-react";

export default function Dashboard() {
  const { data: activities, isLoading: activitiesLoading } = useActivities();
  const { data: stats, isLoading: statsLoading } = useStats();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/25 border-0"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'processing':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 border-0"><Clock className="w-3 h-3 mr-1 animate-spin"/> Processing</Badge>;
      default:
        return <Badge variant="secondary" className="border-0 text-muted-foreground">Pending</Badge>;
    }
  };

  const chartColors = [
    'hsl(var(--primary))',
    'hsl(var(--primary) / 0.8)',
    'hsl(var(--primary) / 0.6)',
    'hsl(var(--primary) / 0.4)',
    'hsl(var(--primary) / 0.2)'
  ];

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">Monitor agent performance and activity history.</p>
      </div>

      {/* Stats — 1 col <360px, 2 cols 360px+, 3 cols md+ */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="glass-card hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Emails Drafted</CardTitle>
            <Mail className="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl sm:text-3xl font-display font-bold">{stats?.emailsSent || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Generated via GPT-4o</p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Outlook Leads</CardTitle>
            <Users className="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl sm:text-3xl font-display font-bold">{stats?.leadsCreated || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Synced to sequences</p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-elevate min-[360px]:col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Conversations</CardTitle>
            <ActivityIcon className="h-4 w-4 text-primary shrink-0" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {activitiesLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl sm:text-3xl font-display font-bold">{activities?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Recorded sessions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

        {/* Chart */}
        <Card className="xl:col-span-1 glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Top Themes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Common topics from recordings</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-[220px] flex items-center justify-center">
                <Skeleton className="h-[180px] w-full rounded-xl" />
              </div>
            ) : stats?.themeDistribution && stats.themeDistribution.length > 0 ? (
              <div className="h-[220px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.themeDistribution} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="theme"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                      width={90}
                    />
                    <Tooltip
                      cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                      {stats.themeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No theme data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Table */}
        <Card className="xl:col-span-2 glass-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Tap a row to view full AI analysis</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs">Contact</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Company</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Theme</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs hidden sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activitiesLoading ? (
                  Array(4).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : activities?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                      No activities recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  activities?.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedActivity(activity)}
                    >
                      <TableCell className="py-3">
                        <div className="font-medium text-sm">{activity.contactName}</div>
                        <div className="text-xs text-muted-foreground font-normal">{activity.contactEmail}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{activity.company || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {activity.theme ? (
                          <Badge variant="outline" className="font-normal text-xs">{activity.theme}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(activity.status)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs tabular-nums hidden sm:table-cell">
                        {activity.createdAt ? format(new Date(activity.createdAt), 'MMM d, h:mm a') : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Activity Detail Dialog */}
      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50">
          {selectedActivity && (
            <>
              <div className="p-5 sm:p-6 border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-xl sm:text-2xl font-display truncate">{selectedActivity.contactName}</DialogTitle>
                    <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                      {selectedActivity.contactEmail}
                      {selectedActivity.company && <span>• {selectedActivity.company}</span>}
                    </DialogDescription>
                  </div>
                  {getStatusBadge(selectedActivity.status)}
                </div>

                {selectedActivity.theme && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">Theme:</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">{selectedActivity.theme}</Badge>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 p-5 sm:p-6">
                <div className="space-y-6">
                  {selectedActivity.audioUrl && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                        <AudioLines className="w-4 h-4" /> Original Audio
                      </h4>
                      <audio controls src={selectedActivity.audioUrl} className="w-full h-10 rounded-lg" />
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Whisper Transcript
                    </h4>
                    {selectedActivity.transcript ? (
                      <div className="bg-muted/30 p-4 rounded-xl text-sm leading-relaxed border border-border/50">
                        {selectedActivity.transcript}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Waiting for n8n processing...</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> GPT-4o Email Draft
                    </h4>
                    {selectedActivity.emailDraft ? (
                      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                          {selectedActivity.emailDraft}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Waiting for n8n processing...</p>
                    )}
                  </div>

                  {(selectedActivity.outlookContactId || selectedActivity.outlookCampaignId) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedActivity.outlookContactId && (
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Outlook Contact ID</p>
                          <p className="font-mono text-sm break-all">{selectedActivity.outlookContactId}</p>
                        </div>
                      )}
                      {selectedActivity.outlookCampaignId && (
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Campaign ID</p>
                          <p className="font-mono text-sm break-all">{selectedActivity.outlookCampaignId}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
