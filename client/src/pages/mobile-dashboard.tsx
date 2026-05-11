import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths,
} from "date-fns";
import { nl } from "date-fns/locale";
import type { Event, OfficialHoliday, Snipperdag, Announcement, User } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────
type EntryType = "event" | "verjaardag" | "jubileum" | "feestdag" | "snipperdag";
interface CalEntry { date: string; type: EntryType }

const dotColors: Record<EntryType, string> = {
  event:      "bg-green-500",
  verjaardag: "bg-pink-400",
  jubileum:   "bg-amber-400",
  feestdag:   "bg-sky-400",
  snipperdag: "bg-red-500",
};

const legend: { type: EntryType; label: string }[] = [
  { type: "event",      label: "Evenement" },
  { type: "verjaardag", label: "Verjaardag" },
  { type: "jubileum",   label: "Jubileum" },
  { type: "feestdag",   label: "Feestdag" },
  { type: "snipperdag", label: "Snipperdag" },
];

// ── Easter / Dutch holidays ───────────────────────────────────────────────────
function computeEaster(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getDutchHolidayDates(year: number): string[] {
  const easter = computeEaster(year);
  const add = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const dates = [
    new Date(year, 0, 1),
    add(easter, -2),
    easter,
    add(easter, 1),
    new Date(year, 3, 27),
    new Date(year, 4, 5),
    add(easter, 39),
    add(easter, 49),
    add(easter, 50),
    new Date(year, 11, 25),
    new Date(year, 11, 26),
  ];
  return dates.map(d => format(d, "yyyy-MM-dd"));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MobileDashboardPage() {
  const { user, logout } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: dashboardPhoto } = useQuery<{ value: string | null }>({
    queryKey: ["/api/site-settings", "dashboard_photo"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings/dashboard_photo", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: events } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: officialHolidays } = useQuery<OfficialHoliday[]>({ queryKey: ["/api/official-holidays"] });
  const { data: snipperdagen } = useQuery<Snipperdag[]>({ queryKey: ["/api/snipperdagen"] });
  const { data: announcements } = useQuery<Announcement[]>({ queryKey: ["/api/announcements"] });

  // ── Calendar entries ─────────────────────────────────────────────────────
  const entries: CalEntry[] = useMemo(() => {
    const result: CalEntry[] = [];
    const yr = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();

    // Events
    (events || []).forEach(e => result.push({ date: e.date, type: "event" }));

    // Birthdays
    (users || []).filter(u => u.active && u.birthDate).forEach(u => {
      const bd = new Date(u.birthDate! + "T00:00:00");
      if (bd.getMonth() === mo) {
        const dateStr = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(bd.getDate()).padStart(2, "0")}`;
        result.push({ date: dateStr, type: "verjaardag" });
      }
    });

    // Anniversaries
    (users || []).filter(u => u.active && u.startDate).forEach(u => {
      const sd = new Date(u.startDate! + "T00:00:00");
      if (sd.getMonth() === mo && sd.getFullYear() < yr) {
        const dateStr = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`;
        result.push({ date: dateStr, type: "jubileum" });
      }
    });

    // Official holidays (uploaded + computed Dutch)
    const dutchDates = getDutchHolidayDates(yr);
    dutchDates.forEach(d => result.push({ date: d, type: "feestdag" }));
    (officialHolidays || []).forEach(h => result.push({ date: h.date, type: "feestdag" }));

    // Snipperdagen
    (snipperdagen || []).forEach(s => result.push({ date: s.date, type: "snipperdag" }));

    return result;
  }, [events, users, officialHolidays, snipperdagen, currentMonth]);

  // ── Calendar grid ────────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekDays = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"];

  const entriesForDay = (date: Date): EntryType[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    const types = entries.filter(e => e.date === dateStr).map(e => e.type);
    const seen = new Set<EntryType>();
    return types.filter(t => seen.has(t) ? false : (seen.add(t), true));
  };

  const today = new Date();
  const isCurrentMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth() === today.getMonth();

  const heroSrc = dashboardPhoto?.value || "/uploads/App_pics/dashboard.png";
  const recentAnnouncements = (announcements || []).slice(0, 10);

  return (
    <div className="pb-4">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-44 overflow-hidden">
        <img src={heroSrc} alt="Dashboard" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/65" />
        <div className="relative z-10 h-full flex items-end justify-between px-4 pb-4">
          <div className="space-y-0.5">
            <p className="text-[hsl(48,96%,53%)] text-xs font-semibold tracking-widest uppercase">
              Welkom terug
            </p>
            <h2 className="text-white text-2xl font-bold leading-tight">
              {user?.fullName}
            </h2>
            <p className="text-white/80 text-sm">
              {user?.functie || user?.department || ""}
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white border border-white/30"
            aria-label="Uitloggen"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* ── Calendar ─────────────────────────────────────────────────── */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">Kalender</h3>
          <Card className="border border-border/60 rounded-2xl overflow-hidden">
            <CardContent className="p-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {format(currentMonth, "MMMM yyyy", { locale: nl }).replace(/^\w/, c => c.toUpperCase())}
                  </span>
                  {!isCurrentMonth && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs rounded-full px-3"
                      onClick={() => setCurrentMonth(new Date())}
                    >
                      Vandaag
                    </Button>
                  )}
                </div>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 mb-1">
                {weekDays.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {days.map(day => {
                  const inMonth = isSameMonth(day, currentMonth);
                  const todayDate = isToday(day);
                  const types = inMonth ? entriesForDay(day) : [];

                  return (
                    <div key={day.toISOString()} className="flex flex-col items-center py-1 min-h-[44px]">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm
                          ${!inMonth ? "text-muted-foreground/30" : "text-foreground"}
                          ${todayDate ? "border-2 border-primary font-bold text-primary" : ""}
                        `}
                      >
                        {format(day, "d")}
                      </div>
                      {types.length > 0 && (
                        <div className="flex gap-0.5 flex-wrap justify-center mt-0.5 max-w-[36px]">
                          {types.slice(0, 3).map((t, i) => (
                            <span key={i} className={`h-1.5 w-1.5 rounded-full ${dotColors[t]}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-border/40">
                {legend.map(l => (
                  <div key={l.type} className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${dotColors[l.type]}`} />
                    <span className="text-[10px] text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Announcements ─────────────────────────────────────────────── */}
        <div>
          <h3 className="text-lg font-bold text-foreground mb-3">Aankondigingen</h3>
          {recentAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Geen aankondigingen</p>
          ) : (
            <div className="space-y-2">
              {recentAnnouncements.map(ann => (
                <Card key={ann.id} className="border border-border/60 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {ann.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {ann.content}
                        </p>
                      </div>
                      {ann.priority === "high" && (
                        <span className="flex-shrink-0 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          Hoog
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
