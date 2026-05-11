import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarX2, Plus, Inbox, X, ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type VacationBalance = {
  userId: string;
  userName: string;
  recht: number;
  saldoOud: number;
  totalDays: number;
  remainingDays: number;
  sickDays: number;
  snipperdagen?: number;
};

type Absence = {
  id: number;
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  halfDay?: string | null;
  status: string;
  reason?: string | null;
  bvvdReason?: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  vacation:   "Vakantie",
  sick:       "Ziekte",
  bvvd:       "BVVD",
  persoonlijk:"Persoonlijk",
};

const BVVD_REASONS = [
  "Huwelijk/geregistreerd partnerschap",
  "Huwelijk bloed-/aanverwant",
  "Overlijden partner/kind/ouder",
  "Overlijden overige familie",
  "Bevalling partner",
  "Verhuizing",
  "Doktersbezoek",
  "Jubileum (25/40/50 jaar)",
  "Sollicitatieverlof",
  "Calamiteitenverlof",
  "Kort verzuimverlof",
  "Overig bijzonder verlof",
];

const STATUS_LABEL: Record<string, string> = {
  pending:   "In afwachting",
  approved:  "Goedgekeurd",
  rejected:  "Afgewezen",
  cancelled: "Gecanceld",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected:  "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

function formatDateNL(s: string) {
  try { return format(new Date(s + "T00:00:00"), "dd/MM/yyyy"); }
  catch { return s; }
}

// ── New Request Sheet ─────────────────────────────────────────────────────────
function NewRequestSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [type, setType]           = useState<string>("vacation");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate]     = useState(format(new Date(), "yyyy-MM-dd"));
  const [halfDay, setHalfDay]     = useState<string>("full");
  const [reason, setReason]       = useState("");
  const [bvvdReason, setBvvdReason] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/absences", {
        userId: user?.id,
        type,
        startDate,
        endDate,
        halfDay: halfDay === "full" ? null : halfDay,
        status: "pending",
        reason: reason || null,
        bvvdReason: type === "bvvd" ? bvvdReason : null,
        approvedBy: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/absences/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/absences"] });
      toast({ title: "Aanvraag ingediend" });
      onClose();
    },
    onError: () => {
      toast({ title: "Fout bij indienen", variant: "destructive" });
    },
  });

  const isValid = startDate && endDate && startDate <= endDate && (type !== "bvvd" || bvvdReason);

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Sheet panel */}
      <div
        className="bg-background rounded-t-3xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-2 border-b border-border/40">
          <h2 className="text-base font-bold text-foreground">Nieuwe aanvraag</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors" data-testid="button-close-sheet">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Type verlof</label>
            <div className="relative">
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border/60 bg-background px-4 py-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="select-type"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Startdatum</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-startdatum" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Einddatum</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="input-einddatum" />
            </div>
          </div>

          {/* Half day toggle */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Dagdeel</label>
            <div className="grid grid-cols-3 gap-2">
              {[["full","Hele dag"],["am","Ochtend (AM)"],["pm","Middag (PM)"]].map(([v,l]) => (
                <button key={v} onClick={() => setHalfDay(v)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    halfDay === v
                      ? "bg-[#1a3d26] text-white border-[#1a3d26]"
                      : "bg-background text-foreground border-border/60 hover:border-primary/40"
                  }`}
                  data-testid={`button-dagdeel-${v}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* BVVD reason */}
          {type === "bvvd" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">BVVD reden</label>
              <div className="relative">
                <select value={bvvdReason} onChange={e => setBvvdReason(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-border/60 bg-background px-4 py-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="select-bvvd-reden">
                  <option value="">Selecteer een reden...</option>
                  {BVVD_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Toelichting (optioneel)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Voeg een toelichting toe..."
              className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="textarea-reden"
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full rounded-xl py-3 text-sm font-semibold"
            style={{ background: "#1a3d26" }}
            disabled={!isValid || submit.isPending}
            onClick={() => submit.mutate()}
            data-testid="button-submit-aanvraag"
          >
            {submit.isPending ? "Indienen..." : "Aanvraag indienen"}
          </Button>

          {/* Bottom safe area spacer */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

// ── Absence Card ──────────────────────────────────────────────────────────────
function AbsenceCard({ absence }: { absence: Absence }) {
  const same = absence.startDate === absence.endDate;
  const dateStr = same
    ? formatDateNL(absence.startDate)
    : `${formatDateNL(absence.startDate)} – ${formatDateNL(absence.endDate)}`;

  const halfLabel = absence.halfDay === "am" ? " · Ochtend" : absence.halfDay === "pm" ? " · Middag" : "";

  return (
    <div className="px-4 py-3.5 flex items-start gap-3 border-b border-border/25 last:border-b-0">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-[#1a3d26]/10 dark:bg-[#2d7a3a]/20 flex items-center justify-center">
        <CalendarX2 className="h-4 w-4 text-[#2d7a3a]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {TYPE_LABELS[absence.type] ?? absence.type}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[absence.status] ?? "bg-muted text-muted-foreground"}`}>
            {STATUS_LABEL[absence.status] ?? absence.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{dateStr}{halfLabel}</p>
        {absence.reason && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate italic">{absence.reason}</p>
        )}
        {absence.bvvdReason && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{absence.bvvdReason}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MobileVerlofPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const { data: balances = [], isLoading: loadingBalance } = useQuery<VacationBalance[]>({
    queryKey: ["/api/vacation-balance"],
  });

  const { data: absences = [], isLoading: loadingAbsences } = useQuery<Absence[]>({
    queryKey: ["/api/absences/mine"],
  });

  const myBalance = balances.find(b => b.userId === user?.id);
  const myAbsences = [...absences].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const heroSrc = "/uploads/App_pics/verzuim.png";

  return (
    <div className="pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-52 overflow-hidden">
        <img src={heroSrc} alt="Verlof" className="absolute inset-0 w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = "/uploads/App_pics/dashboard.png"; }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-5">
          <p className="text-[hsl(48,96%,53%)] text-[11px] font-bold tracking-widest uppercase mb-1">Verlof</p>
          <h2 className="text-white text-2xl font-bold leading-tight">Mijn vakantiesaldo</h2>
          <p className="text-white/75 text-sm mt-0.5">{user?.fullName}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* ── Balance card ──────────────────────────────────────────────── */}
        <Card className="rounded-2xl border border-border/50 overflow-hidden">
          {loadingBalance ? (
            <div className="h-24 animate-pulse bg-muted" />
          ) : (
            <div className="p-5">
              <div className="grid grid-cols-3 divide-x divide-border/40 text-center mb-3">
                {/* Totaal */}
                <div className="pr-4">
                  <p className="text-3xl font-bold text-foreground">{myBalance?.recht ?? "–"}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Totaal</p>
                </div>
                {/* Resterend */}
                <div className="px-4">
                  <p className="text-3xl font-bold text-[#2d7a3a]">{myBalance?.remainingDays ?? "–"}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Resterend</p>
                </div>
                {/* Ziekte */}
                <div className="pl-4">
                  <p className="text-3xl font-bold text-foreground">{myBalance?.sickDays ?? 0}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">Ziekte</p>
                </div>
              </div>
              {myBalance?.saldoOud ? (
                <p className="text-xs text-center text-muted-foreground">
                  Saldo vorig jaar: <span className="font-semibold text-foreground">{myBalance.saldoOud} dag{myBalance.saldoOud !== 1 ? "en" : ""}</span>
                </p>
              ) : null}
            </div>
          )}
        </Card>

        {/* ── Nieuwe aanvraag button ─────────────────────────────────────── */}
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-opacity active:opacity-80"
          style={{ background: "#1a3d26" }}
          data-testid="button-nieuwe-aanvraag"
        >
          <Plus className="h-4 w-4" />
          Nieuwe aanvraag
        </button>

        {/* ── Mijn afwezigheden ─────────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Mijn afwezigheden</h3>
          <Card className="rounded-2xl border border-border/50 overflow-hidden">
            {loadingAbsences ? (
              <div className="space-y-0 divide-y divide-border/25">
                {[1,2,3].map(i => (
                  <div key={i} className="px-4 py-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : myAbsences.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                <Inbox className="h-8 w-8 opacity-40" />
                <p className="text-sm">Geen geregistreerde afwezigheden</p>
              </div>
            ) : (
              <div>
                {myAbsences.map(a => <AbsenceCard key={a.id} absence={a} />)}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── New request bottom sheet ──────────────────────────────────────── */}
      {showForm && <NewRequestSheet onClose={() => setShowForm(false)} />}
    </div>
  );
}
