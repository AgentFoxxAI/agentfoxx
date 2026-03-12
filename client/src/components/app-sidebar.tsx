import { Link, useLocation } from "wouter";
import { Mic, LayoutDashboard, HelpCircle, ClipboardCheck, Settings, Sun, Moon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Record Activity", url: "/", icon: Mic },
  { title: "Approval Queue", url: "/reviews", icon: ClipboardCheck },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "How It Works", url: "/how-it-works", icon: HelpCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar shadow-sm">
      <SidebarHeader className="p-6">
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
      
      <SidebarContent className="px-4 mt-4">
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
                      className="mb-1 rounded-xl h-11 transition-all hover:bg-primary/5 active:bg-primary/10 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold"
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3">
                        <item.icon className="w-5 h-5" />
                        <span className="text-base">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
          className="w-full justify-start gap-3 rounded-xl h-11 hover:bg-primary/5 active:bg-primary/10"
        >
          {theme === "light" ? (
            <>
              <Moon className="w-5 h-5" />
              <span className="text-base">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-5 h-5" />
              <span className="text-base">Light Mode</span>
            </>
          )}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
