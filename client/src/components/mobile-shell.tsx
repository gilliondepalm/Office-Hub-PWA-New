import { Switch, Route, Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Home, Clock, CalendarX2, Gift, User as UserIcon, Monitor } from "lucide-react";
import MobileDashboardPage from "@/pages/mobile-dashboard";
import WerktijdenPage from "@/pages/mobile-werktijden";
import VerlofPage from "@/pages/mobile-verlof";
import BeloningenPage from "@/pages/mobile-beloningen";
import ProfielPage from "@/pages/mobile-profiel";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/werktijden": "Werktijden",
  "/verzuim": "Verlof",
  "/beloningen": "Beloningen",
  "/profiel": "Persoonlijk",
};

const allTabs = [
  { label: "Dashboard",   icon: Home,        href: "/",           perm: "dashboard" },
  { label: "Werktijden",  icon: Clock,       href: "/werktijden", perm: "werktijden" },
  { label: "Verlof",      icon: CalendarX2,  href: "/verzuim",    perm: "verzuim" },
  { label: "Beloningen",  icon: Gift,        href: "/beloningen", perm: "beloningen" },
  { label: "Persoonlijk", icon: UserIcon,    href: "/profiel",    perm: null },
];

function switchToDesktop() {
  try { localStorage.removeItem("kd_mobile_mode"); } catch {}
  window.location.href = "/";
}

export function MobileShell() {
  const [location] = useLocation();
  const { user } = useAuth();
  const perms = user?.permissions || [];

  const tabs = allTabs.filter(t => !t.perm || perms.includes(t.perm));
  const title = pageTitles[location] || "Dashboard";

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-3"
        style={{ background: "#1a3d26", height: "48px" }}
      >
        <div className="w-8" />
        <h1 className="text-white text-base font-semibold tracking-wide">{title}</h1>
        <button
          onClick={switchToDesktop}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          title="Schakel naar desktopweergave"
          data-testid="button-switch-desktop"
        >
          <Monitor className="h-4 w-4" />
        </button>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Switch>
          <Route path="/" component={MobileDashboardPage} />
          {perms.includes("werktijden") && <Route path="/werktijden" component={WerktijdenPage} />}
          {perms.includes("verzuim") && <Route path="/verzuim" component={VerlofPage} />}
          {perms.includes("beloningen") && <Route path="/beloningen" component={BeloningenPage} />}
          <Route path="/profiel" component={ProfielPage} />
          <Route component={MobileDashboardPage} />
        </Switch>
      </main>

      {/* ── Bottom nav ──────────────────────────────────────────────────── */}
      <nav className="flex-shrink-0 bg-background border-t border-border/60 flex safe-area-inset-bottom">
        {tabs.map(tab => {
          const active =
            tab.href === "/"
              ? location === "/"
              : location === tab.href || location.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors
                ${active ? "text-[#2d7a3a]" : "text-muted-foreground"}`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
