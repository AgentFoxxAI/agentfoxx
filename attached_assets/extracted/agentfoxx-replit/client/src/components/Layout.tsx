import { Link, useLocation } from "wouter";
import { Network, BarChart3, BookOpen, Compass } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", label: "Home", icon: Compass },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/how-it-works", label: "How It Works", icon: Network },
  { href: "/guide", label: "Deployment Guide", icon: BookOpen },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <>
      {/* ── Fixed background scene (blobs + grid + grain) ── */}
      <div className="scene" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      {/* ── All page content sits above the scene ── */}
      <div className="page-wrap min-h-screen flex flex-col">

        {/* Glass nav */}
        <header
          className="sticky top-0 z-50"
          style={{
            background: "rgba(7, 8, 15, 0.65)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 4px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="container flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 no-underline">
              <span
                className="font-serif text-lg tracking-tight"
                style={{ color: "oklch(0.95 0.005 265)" }}
              >
                AgentFoxx
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 no-underline flex items-center gap-1.5"
                    style={{
                      color: isActive
                        ? "oklch(0.72 0.18 275)"
                        : "oklch(0.48 0.02 265)",
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg"
                        style={{
                          background: "oklch(0.65 0.22 275 / 0.12)",
                          border: "1px solid oklch(0.65 0.22 275 / 0.25)",
                          boxShadow: "0 0 12px oklch(0.65 0.22 275 / 0.15)",
                        }}
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <item.icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile nav */}
            <div className="md:hidden">
              <MobileNav location={location} />
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer
          className="py-7 mt-16"
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.07)",
            background: "rgba(7, 8, 15, 0.7)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, oklch(0.65 0.22 275), oklch(0.45 0.22 290))",
                }}
              >
                <Network className="w-3 h-3 text-white" />
              </div>
              <span
                className="font-serif text-sm"
                style={{ color: "oklch(0.48 0.02 265)" }}
              >
                AgentFoxx
              </span>
            </div>
            <p
              className="text-xs"
              style={{ color: "oklch(0.35 0.02 265)" }}
            >
              Conference Networking Agent — Powered by n8n, Calendly & Salesforce
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}

function MobileNav({ location }: { location: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="p-2 rounded-lg transition-all duration-200 no-underline"
            style={{
              color: isActive ? "oklch(0.72 0.18 275)" : "oklch(0.40 0.02 265)",
              background: isActive ? "oklch(0.65 0.22 275 / 0.12)" : undefined,
              border: isActive ? "1px solid oklch(0.65 0.22 275 / 0.22)" : "1px solid transparent",
            }}
          >
            <item.icon className="w-4 h-4" />
          </Link>
        );
      })}
    </div>
  );
}
