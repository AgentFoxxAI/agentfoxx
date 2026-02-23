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
  Body,
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
        return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-0"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</Badge>;
      case 'processing':
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-0"><Clock className="w-3 h-3 mr-1 animate-spin"/> Processing</Badge>;
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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor agent performance and activity history.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Drafted</CardTitle>
            <Mail className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-display font-bold">{stats?.emailsSent || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Generated via GPT-4o</p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outreach Leads</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-display font-bold">{stats?.leadsCreated || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Synced to sequences</p>
          </CardContent>
        </Card>

        <Card className="glass-card hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
            <ActivityIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-3xl font-display font-bold">{activities?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Recorded sessions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Chart */}
        <Card className="xl:col-span-1 glass-card">
          <CardHeader>
            <CardTitle>Top Themes</CardTitle>
            <CardDescription>Common topics extracted from recordings</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-[250px] w-full rounded-xl" />
              </div>
            ) : stats?.themeDistribution && stats.themeDistribution.length > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.themeDistribution} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="theme" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={30}>
                      {stats.themeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No theme data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities Table */}
        <Card className="xl:col-span-2 glass-card overflow-hidden">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Click a row to view full AI analysis</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activitiesLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : activities?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
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
                      <TableCell className="font-medium">
                        <div>{activity.contactName}</div>
                        <div className="text-xs text-muted-foreground font-normal">{activity.contactEmail}</div>
                      </TableCell>
                      <TableCell>{activity.company || '-'}</TableCell>
                      <TableCell>
                        {activity.theme ? (
                          <Badge variant="outline" className="font-normal">{activity.theme}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(activity.status)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
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

      {/* Activity Details Dialog */}
      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50">
          {selectedActivity && (
            <>
              <div className="p-6 border-b bg-muted/20">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl font-display">{selectedActivity.contactName}</DialogTitle>
                    <DialogDescription className="mt-1 flex items-center gap-2">
                      {selectedActivity.contactEmail} 
                      {selectedActivity.company && <span>• {selectedActivity.company}</span>}
                    </DialogDescription>
                  </div>
                  {getStatusBadge(selectedActivity.status)}
                </div>
                
                {selectedActivity.theme && (
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Extracted Theme:</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">{selectedActivity.theme}</Badge>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="space-y-8">
                  {/* Audio Link */}
                  {selectedActivity.audioUrl && (
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <AudioLines className="w-4 h-4" /> Original Audio
                      </h4>
                      <audio controls src={selectedActivity.audioUrl} className="w-full h-10 rounded-lg" />
                    </div>
                  )}

                  {/* Transcript */}
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
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

                  {/* Email Draft */}
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> GPT-4o Email Draft
                    </h4>
                    {selectedActivity.emailDraft ? (
                      <div className="bg-primary/5 p-5 rounded-xl border border-primary/10 relative group">
                        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                          {selectedActivity.emailDraft}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Waiting for n8n processing...</p>
                    )}
                  </div>

                  {/* Outreach Info */}
                  {(selectedActivity.outreachProspectId || selectedActivity.outreachSequenceId) && (
                    <div className="grid grid-cols-2 gap-4">
                       {selectedActivity.outreachProspectId && (
                         <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                           <p className="text-xs text-muted-foreground mb-1">Outreach Prospect ID</p>
                           <p className="font-mono text-sm">{selectedActivity.outreachProspectId}</p>
                         </div>
                       )}
                       {selectedActivity.outreachSequenceId && (
                         <div className="bg-muted/20 p-3 rounded-lg border border-border/50">
                           <p className="text-xs text-muted-foreground mb-1">Sequence ID</p>
                           <p className="font-mono text-sm">{selectedActivity.outreachSequenceId}</p>
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
