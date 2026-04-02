import { useEventContext } from "@/contexts/EventContext";
import { Calendar, ChevronDown, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EventSelector() {
  const { events, activeEvent, setActiveEventId } = useEventContext();

  if (events.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground italic">
        No events configured
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 transition-colors text-left">
        <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {activeEvent?.name || "Select Event"}
          </p>
          {activeEvent?.location && (
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {activeEvent.location}
            </p>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {events.map((event) => (
          <DropdownMenuItem
            key={event.id}
            onClick={() => setActiveEventId(event.id)}
            className={`flex flex-col items-start gap-0.5 py-2 ${
              event.id === activeEvent?.id ? "bg-primary/10 text-primary" : ""
            }`}
          >
            <span className="font-medium text-sm">{event.name}</span>
            {event.location && (
              <span className="text-xs text-muted-foreground">{event.location}</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
