import { Link, useLocation } from "wouter";
import {
  Mic, LayoutDashboard, HelpCircle, ClipboardCheck, Settings,
  Sun, Moon, LogOut, User, Shield,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarFooter, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Record Activity", url: "/", icon: Mic },
  { title: "Approval Queue", url: "/reviews", icon: ClipboardCheck },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "How It Works", url: "/how-it-works", icon: HelpCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Manage Users", url: "/admin/users", icon: User },
  { title: "Manage Events", url: "/admin/events", icon: Shield },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut, isAdmin } = useAuthContext();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar shadow-sm">
      <SidebarHeader className="p-5">
        <Link href="/">
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
      </SidebarHeader>

      <SidebarContent className="px-4 mt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="mb-1 rounded-xl h-12 transition-all hover:bg-primary/5 active:bg-primary/10 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3">
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="text-base">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="mb-1 rounded-xl h-12 transition-all hover:bg-primary/5 active:bg-primary/10 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"
                      >
                        <Link href={item.url} className="flex items-center gap-3 px-3">
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span className="text-base">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {/* User info */}
        {profile && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {profile.role === "admin" ? "Admin" : "Rep"}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="flex-1 justify-start gap-3 rounded-xl h-10 hover:bg-primary/5 active:bg-primary/10"
          >
            {theme === "light" ? (
              <>
                <Moon className="w-4 h-4" />
                <span className="text-sm">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" />
                <span className="text-sm">Light</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="rounded-xl h-10 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
