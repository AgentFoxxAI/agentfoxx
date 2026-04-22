import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useEventContext } from "@/contexts/EventContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Calendar,
  MapPin,
  Plus,
  Loader2,
  CheckCircle2,
  Shield,
} from "lucide-react";
import type { Event } from "@shared/schema";

export default function AdminEvents() {
  const { events, refetchEvents } = useEventContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  // Create event form
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    location: "",
    description: "",
  });

  const createEvent = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/events", {
        ...data,
        isActive: events.length === 0, // First event is auto-active
      });
      return res.json();
    },
    onSuccess: () => {
      refetchEvents();
      setShowCreate(false);
      setForm({ name: "", startDate: "", endDate: "", location: "", description: "" });
      toast({ title: "Event Created", description: "New event has been added." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      refetchEvents();
    },
  });

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-3 bg-gradient-to-r from-primary/10 via-accent/50 to-transparent p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-primary/10">
        <Badge className="self-start bg-primary/15 text-primary hover:bg-primary/20 transition-colors border-0">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </Badge>
        <h1 className="text-2xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
          Event Management
        </h1>
        <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl">
          Create and manage conferences. All leads, reviews, and attendees are scoped to the active event.
        </p>
      </div>

      {/* Create event button */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto h-12">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>
              Add a conference or event. All leads and reviews will be scoped to this event.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createEvent.mutate(form);
            }}
            className="space-y-4 mt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="Identiverse 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Las Vegas, NV"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the event..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
            <Button type="submit" disabled={createEvent.isPending || !form.name.trim()} className="w-full h-11">
              {createEvent.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Event"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event list */}
      <div className="grid gap-3">
        {events.length === 0 && (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No events yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first event to start capturing leads.
              </p>
            </CardContent>
          </Card>
        )}

        {events.map((event) => (
          <Card key={event.id} className="glass-card hover:bg-accent/5 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-lg">{event.name}</h3>
                    {event.isActive && (
                      <Badge className="bg-green-500/10 text-green-500 border-0 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                  {event.location && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {event.location}
                    </p>
                  )}
                  {(event.startDate || event.endDate) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {event.startDate && new Date(event.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {event.endDate && ` — ${new Date(event.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                  )}
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                  )}
                </div>

                {!event.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive.mutate({ id: event.id, isActive: true })}
                    disabled={toggleActive.isPending}
                    className="shrink-0"
                  >
                    Set Active
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
