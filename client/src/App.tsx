import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { EventProvider } from "@/contexts/EventContext";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sun,
  Moon,
  Menu,
  Mic,
  LayoutDashboard,
  HelpCircle,
  ClipboardCheck,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

// Pages
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import HowItWorks from "./pages/HowItWorks";
import ReviewList from "./pages/ReviewList";
import ReviewDetail from "./pages/ReviewDetail";
import Settings from "./pages/Settings";
import AdminEvents from "./pages/AdminEvents";
import Leaderboard from "./pages/Leaderboard";
import Broadcasts from "./pages/Broadcasts";
import { LeadToast } from "@/components/lead-toast";
import { BroadcastToast } from "@/components/broadcast-toast";

const mobileNavItems = [
  { title: "Record Activity", url: "/", icon: Mic },
  { title: "Approval Queue", url: "/reviews", icon: ClipboardCheck },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "How It Works", url: "/how-it-works", icon: HelpCircle },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

function MobileDrawerContent({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut, isAdmin } = useAuthContext();

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Branding */}
      <div className="px-5 py-5 border-b border-border/50">
        <Link href="/" onClick={onClose}>
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Mic className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-gradient">AgentFoxx</h2>
              <p className="text-xs text-muted-foreground">AI Networking Agent</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-3 mb-3">
          Menu
        </p>
        {mobileNavItems.map((item) => {
          const isActive = location === item.url;
          return (
            <Link key={item.title} href={item.url} onClick={onClose}>
              <div
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-primary/5 text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-base">{item.title}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User info + controls */}
      <div className="px-4 py-4 border-t border-border/50 space-y-3">
        {profile && (
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.name}</p>
              <p className="text-xs text-muted-foreground">{profile.role === "admin" ? "Admin" : "Rep"}</p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="flex-1 justify-start gap-3 rounded-xl h-10 hover:bg-primary/5"
          >
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span className="text-sm">{theme === "light" ? "Dark" : "Light"}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { signOut(); onClose(); }}
            className="rounded-xl h-10 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle-mobile"
      className="hover:bg-primary/10 hover:text-primary h-10 w-10"
    >
      {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </Button>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/reviews" component={ReviewList} />
      <Route path="/reviews/:id" component={ReviewDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin/events" component={AdminEvents} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/broadcasts" component={Broadcasts} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      {/* Mobile Sheet drawer — only active below md */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 md:hidden"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MobileDrawerContent onClose={() => setMobileDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20 selection:text-primary">

        {/* Desktop persistent sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <AppSidebar />
        </div>

        <div className="flex flex-col flex-1 relative min-w-0">

          <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] pointer-events-none transform translate-x-1/3 -translate-y-1/3" />

          {/* Sticky header */}
          <header className="sticky top-0 z-50 flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-md border-b border-border/50 min-h-[52px]">
            <div className="flex items-center gap-2">

              {/* Mobile: hamburger opens Sheet drawer */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-10 w-10 hover:bg-primary/10 hover:text-primary"
                onClick={() => setMobileDrawerOpen(true)}
                data-testid="button-mobile-menu"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Desktop: shadcn SidebarTrigger for collapse/expand */}
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className="hidden md:flex hover:bg-primary/10 hover:text-primary h-10 w-10"
              />

              {/* App name — mobile only */}
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer md:hidden">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <Mic className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-display font-bold text-gradient text-base">AgentFoxx</span>
                </div>
              </Link>
            </div>

            <ThemeToggle />
          </header>

          <main className="flex-1 overflow-y-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <AuthGuard>
              <EventProvider>
                <LeadToast />
                <BroadcastToast />
                <AppShell />
              </EventProvider>
            </AuthGuard>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
