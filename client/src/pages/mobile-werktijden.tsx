import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { format, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import {
  Clock, ShieldAlert, LogOut, TrendingDown, TrendingUp, Briefcase,
  Coffee, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Werktijd = {
  logid: number;
  userid: string;
  checktime: string;
  checktype: string;
};

type AbsenceRecord = {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: string;
  type: string;
};

type WorkPair = {
  inRec: Werktijd;
  outRec: Werktijd | null;
  inTime: Date;
  outTime: Date | null;
  werktijdSec: number | null;
};

type PauzePair = {
  outTime: Date;
  inTime: Date;
  durSec: number;
};

type DagAnalyse = {
  datum: string;
  dagStr: string;        // "02-04"
  dagStrFull: string;    // "02-04-2026"
  weekdagKort: string;   // "Do"
  isFriday: boolean;
  pairs: WorkPair[];
  completePairs: WorkPair[];
  incompletePairs: WorkPair[];
  pauze: PauzePair | null;
  totaalWerktijdSec: number;
  targetSec: number;
  verschilSec: number;
  blok1Ok: boolean;
  blok2Ok: boolean;
  blok3Ok: boolean;
  blok4Ok: boolean;
  teLaat: Array<{ tijd: string }>;
  teVroegIn: Array<{ tijd: string }>;
  teVroegUit: Array<{ tijd: string }>;
  isAbsent: boolean;
  hasMissedBlock: boolean;
};

// ── Analyse constants ─────────────────────────────────────────────────────────
const _H = 3600, _M = 60;
const ANA_BLK1_S    = 7 * _H;
const ANA_BLK1_E    = 8 * _H;
const ANA_BLK2_S    = 11 * _H + 45 * _M;
const ANA_BLK2_E    = 12 * _H;
const ANA_BLK3_S    = 13 * _H + 30 * _M;
const ANA_BLK3_E    = 14 * _H;
const ANA_BLK4_WD   = 16 * _H + 45 * _M;
const ANA_BLK4_FR   = 16 * _H + 30 * _M;
const ANA_BLK4_E    = 18 * _H;
const ANA_BREAK_S   = 12 * _H;
const ANA_BREAK_E   = 13 * _H + 30 * _M;
const ANA_TARGET_WD = 8 * _H;
const ANA_TARGET_FR = 7 * _H + 30 * _M;
const ANA_PAUZE_OUT_MIN = 11 * _H + 30 * _M;
const ANA_PAUZE_OUT_MAX = 13 * _H + 30 * _M;
const ANA_PAUZE_IN_MIN  = 12 * _H;
const ANA_PAUZE_IN_MAX  = 15 * _H;

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseChecktime(ct: string): Date {
  return new Date(ct.replace(/Z$/, "").replace(" ", "T"));
}

function secOfDay(d: Date): number {
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function formatHMS(sec: number): string {
  const abs = Math.abs(Math.round(sec));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatHM(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function dateKey(ct: string): string {
  try { return format(parseChecktime(ct), "yyyy-MM-dd"); }
  catch { return ct.slice(0, 10); }
}

function buildPairs(recs: Werktijd[]): WorkPair[] {
  const sorted = [...recs].sort((a, b) =>
    parseChecktime(a.checktime).getTime() - parseChecktime(b.checktime).getTime()
  );
  const pairs: WorkPair[] = [];
  let pending: Werktijd | null = null;
  for (const r of sorted) {
    if (r.checktype === "in") {
      if (pending !== null) {
        pairs.push({ inRec: pending, outRec: null, inTime: parseChecktime(pending.checktime), outTime: null, werktijdSec: null });
      }
      pending = r;
    } else {
      if (pending !== null) {
        const inTime  = parseChecktime(pending.checktime);
        const outTime = parseChecktime(r.checktime);
        const durSec  = (outTime.getTime() - inTime.getTime()) / 1000;
        const inSec   = secOfDay(inTime);
        const outSec  = secOfDay(outTime);
        const brkOv   = Math.max(0, Math.min(outSec, ANA_BREAK_E) - Math.max(inSec, ANA_BREAK_S));
        pairs.push({ inRec: pending, outRec: r, inTime, outTime, werktijdSec: Math.max(0, durSec - brkOv) });
        pending = null;
      }
    }
  }
  if (pending !== null) {
    pairs.push({ inRec: pending, outRec: null, inTime: parseChecktime(pending.checktime), outTime: null, werktijdSec: null });
  }
  return pairs;
}

function detectPauze(pairs: WorkPair[]): PauzePair | null {
  for (let i = 0; i < pairs.length - 1; i++) {
    const s1 = pairs[i]; const s2 = pairs[i + 1];
    if (!s1.outRec || !s1.outTime || !s2.inTime) continue;
    const outSec = secOfDay(s1.outTime);
    const inSec  = secOfDay(s2.inTime);
    const gapSec = (s2.inTime.getTime() - s1.outTime.getTime()) / 1000;
    if (outSec >= ANA_PAUZE_OUT_MIN && outSec <= ANA_PAUZE_OUT_MAX &&
        inSec  >= ANA_PAUZE_IN_MIN  && inSec  <= ANA_PAUZE_IN_MAX  &&
        gapSec >= 30 * 60 && gapSec <= 180 * 60) {
      return { outTime: s1.outTime, inTime: s2.inTime, durSec: gapSec };
    }
  }
  return null;
}

function computeDag(datum: string, recs: Werktijd[], isAbsent: boolean): DagAnalyse {
  const d         = new Date(datum + "T00:00:00");
  const isFriday  = d.getDay() === 5;
  const targetSec = isFriday ? ANA_TARGET_FR : ANA_TARGET_WD;
  const b4Start   = isFriday ? ANA_BLK4_FR  : ANA_BLK4_WD;

  const pairs           = buildPairs(recs);
  const completePairs   = pairs.filter(p => p.outRec !== null);
  const incompletePairs = pairs.filter(p => p.outRec === null);
  const pauze           = detectPauze(pairs);

  const totaalWerktijdSec = completePairs.reduce((s, p) => s + (p.werktijdSec ?? 0), 0);
  const verschilSec       = totaalWerktijdSec - targetSec;

  const sorted  = [...recs].sort((a, b) => parseChecktime(a.checktime).getTime() - parseChecktime(b.checktime).getTime());
  const inRecs  = sorted.filter(r => r.checktype === "in");
  const outRecs = sorted.filter(r => r.checktype === "out");

  const blok1Ok = inRecs.some(r  => { const s = secOfDay(parseChecktime(r.checktime)); return s >= ANA_BLK1_S && s <= ANA_BLK1_E; });
  const blok2Ok = outRecs.some(r => { const s = secOfDay(parseChecktime(r.checktime)); return s >= ANA_BLK2_S && s <= ANA_BLK2_E + 30*60; });
  const blok3Ok = inRecs.some(r  => { const s = secOfDay(parseChecktime(r.checktime)); return s >= ANA_BLK3_S && s <= ANA_BLK3_E + 30*60; });
  const blok4Ok = outRecs.some(r => { const s = secOfDay(parseChecktime(r.checktime)); return s >= b4Start - 15*60 && s <= ANA_BLK4_E; });

  const teLaat:    Array<{ tijd: string }> = [];
  const teVroegIn: Array<{ tijd: string }> = [];
  const teVroegUit:Array<{ tijd: string }> = [];

  for (const r of sorted) {
    const dt  = parseChecktime(r.checktime);
    const sec = secOfDay(dt);
    const tijd = formatHM(dt);
    if (r.checktype === "in") {
      if (sec < ANA_BLK1_S) teVroegIn.push({ tijd });
      else if (sec > ANA_BLK1_E && sec < 13 * _H) teLaat.push({ tijd });
      else if (sec > ANA_BLK3_E && sec >= 12 * _H) teLaat.push({ tijd });
    } else {
      if (!isAbsent && sec >= ANA_BREAK_E && sec < b4Start) teVroegUit.push({ tijd });
    }
  }

  const hasMissedBlock = !isAbsent && completePairs.length > 0 &&
    (!blok1Ok || !blok2Ok || !blok3Ok || !blok4Ok);

  return {
    datum,
    dagStr:     format(d, "dd/MM"),
    dagStrFull: format(d, "dd/MM/yyyy"),
    weekdagKort: format(d, "EEE", { locale: nl }).replace(/^\w/, c => c.toUpperCase()).slice(0, 2),
    isFriday, pairs, completePairs, incompletePairs, pauze,
    totaalWerktijdSec, targetSec, verschilSec,
    blok1Ok, blok2Ok, blok3Ok, blok4Ok,
    teLaat, teVroegIn, teVroegUit, isAbsent, hasMissedBlock,
  };
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, iconColor, open, onToggle }: {
  icon: React.ReactNode; label: string; iconColor: string;
  open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border/40 active:bg-muted/40 transition-colors"
      data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <span className="text-sm font-bold text-foreground">{label}</span>
      </div>
      <span className="text-muted-foreground">
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </span>
    </button>
  );
}

// ── Column header row ─────────────────────────────────────────────────────────
function ColHeaders({ cols, template }: { cols: string[]; template: string }) {
  return (
    <div className="grid px-4 py-2 border-b border-border/30 bg-muted/30" style={{ gridTemplateColumns: template }}>
      {cols.map(c => (
        <span key={c} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{c}</span>
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, iconBg, label, value, valueColor, sub }: {
  icon: React.ReactNode; iconBg: string; label: string;
  value: string; valueColor: string; sub: string;
}) {
  return (
    <Card className="rounded-2xl border border-border/50">
      <div className="p-4">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${iconBg}`}>{icon}</div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight mb-1">{label}</p>
        <p className={`text-2xl font-bold font-mono ${valueColor}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </Card>
  );
}

// ── Block badge ───────────────────────────────────────────────────────────────
function BlokBadge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-green-600 font-bold text-sm">✓</span>
    : <span className="text-red-500 font-bold text-sm">✗</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MobileWerktijdenPage() {
  const { user } = useAuth();

  const defaultEnd   = new Date();
  const defaultStart = subWeeks(defaultEnd, 5);
  const [vanStr, setVanStr] = useState(format(defaultStart, "yyyy-MM-dd"));
  const [tmStr,  setTmStr]  = useState(format(defaultEnd,   "yyyy-MM-dd"));

  const { data: werktijden = [], isLoading } = useQuery<Werktijd[]>({
    queryKey: ["/api/werktijden"],
  });
  const { data: absences = [] } = useQuery<AbsenceRecord[]>({
    queryKey: ["/api/absences/mine"],
  });

  const analyseData: DagAnalyse[] = useMemo(() => {
    if (!werktijden.length) return [];
    const filtered = werktijden.filter(r => {
      const d = dateKey(r.checktime);
      return d >= vanStr && d <= tmStr;
    });
    const byDay: Record<string, Werktijd[]> = {};
    for (const r of filtered) {
      const k = dateKey(r.checktime);
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(r);
    }
    const absenceSet = new Set<string>();
    for (const ab of absences) {
      if (ab.status !== "approved") continue;
      const cur = new Date(ab.startDate + "T00:00:00");
      const end = new Date(ab.endDate   + "T00:00:00");
      while (cur <= end) { absenceSet.add(format(cur, "yyyy-MM-dd")); cur.setDate(cur.getDate() + 1); }
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([datum, recs]) => computeDag(datum, recs, absenceSet.has(datum)));
  }, [werktijden, absences, vanStr, tmStr]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────
  const verzuimDagen   = analyseData.filter(d => d.hasMissedBlock);
  const allTeLaat      = analyseData.flatMap(d => d.teLaat.map(t => ({ dag: d, tijd: t.tijd })));
  const allTeVroegUit  = analyseData.flatMap(d => d.teVroegUit.map(t => ({ dag: d, tijd: t.tijd })));
  const variabelSaldo  = analyseData.reduce((s, d) => s + (d.isAbsent ? 0 : d.verschilSec), 0);
  const totalGewerkt   = analyseData.reduce((s, d) => s + d.totaalWerktijdSec, 0);
  const totalDagen     = analyseData.filter(d => d.completePairs.length > 0).length;
  const totalIncomplete = analyseData.reduce((s, d) => s + d.incompletePairs.length, 0);

  const pauzeRows = analyseData.filter(d => d.pauze !== null) as (DagAnalyse & { pauze: PauzePair })[];
  const totalPauzeSec = pauzeRows.reduce((s, d) => s + d.pauze.durSec, 0);

  const missedBlokRows = analyseData.filter(d => d.hasMissedBlock);

  const [openWerkuren,    setOpenWerkuren]    = useState(true);
  const [openTeLaat,      setOpenTeLaat]      = useState(true);
  const [openTeVroegUit,  setOpenTeVroegUit]  = useState(true);
  const [openPauze,       setOpenPauze]       = useState(true);
  const [openVerzuim,     setOpenVerzuim]     = useState(true);

  const heroSrc    = "/uploads/App_pics/werktijden.png";
  const displayVan = vanStr ? format(new Date(vanStr + "T00:00:00"), "dd/MM/yyyy") : "";
  const displayTm  = tmStr  ? format(new Date(tmStr  + "T00:00:00"), "dd/MM/yyyy") : "";

  return (
    <div className="pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-44 overflow-hidden">
        <img src={heroSrc} alt="Werktijden" className="absolute inset-0 w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = "/uploads/App_pics/dashboard.png"; }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/70" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-4">
          <p className="text-[hsl(48,96%,53%)] text-[11px] font-bold tracking-widest uppercase mb-1">Werktijden · Analyse</p>
          <h2 className="text-white text-2xl font-bold leading-tight">{user?.fullName}</h2>
          <p className="text-white/75 text-sm mt-0.5">{displayVan} t/m {displayTm}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* ── Date pickers ─────────────────────────────────────────────── */}
        <Card className="rounded-2xl border border-border/50">
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Van</p>
                <input type="date" value={vanStr} onChange={e => setVanStr(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-van-datum" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">T/m</p>
                <input type="date" value={tmStr} onChange={e => setTmStr(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-tm-datum" />
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* ── KPI 2×2 grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={<ShieldAlert className="h-5 w-5 text-red-500" />} iconBg="bg-red-50 dark:bg-red-950/30"
                label="Verzuim te klokken" value={String(verzuimDagen.length)} valueColor="text-red-500" sub="dag(en)" />
              <KpiCard icon={<Clock className="h-5 w-5 text-orange-500" />} iconBg="bg-orange-50 dark:bg-orange-950/30"
                label="Te laat" value={String(allTeLaat.length)} valueColor="text-orange-500" sub="keer" />
              <KpiCard
                icon={variabelSaldo >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-orange-500" />}
                iconBg={variabelSaldo >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-orange-50 dark:bg-orange-950/30"}
                label="Variabel saldo"
                value={`${variabelSaldo >= 0 ? "+" : "-"}${formatHMS(Math.abs(variabelSaldo))}`}
                valueColor={variabelSaldo >= 0 ? "text-green-600" : "text-orange-500"}
                sub={variabelSaldo >= 0 ? "te veel" : "te weinig"} />
              <KpiCard icon={<LogOut className="h-5 w-5 text-orange-500" />} iconBg="bg-orange-50 dark:bg-orange-950/30"
                label="Te vroeg uit" value={String(allTeVroegUit.length)} valueColor="text-orange-500" sub="keer" />
            </div>

            {/* ── Totaal gewerkt ────────────────────────────────────────── */}
            <Card className="rounded-2xl border border-border/50">
              <div className="p-4 flex items-center gap-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 shrink-0">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Totaal gewerkt</p>
                  <p className="text-2xl font-bold font-mono text-blue-600">{formatHMS(totalGewerkt)}</p>
                  <p className="text-xs text-muted-foreground">{totalDagen} dag(en)</p>
                </div>
              </div>
            </Card>

            {/* ── Gewerkte werkuren table ───────────────────────────────── */}
            <Card className="rounded-2xl border border-border/50 overflow-hidden">
              <SectionHeader icon={<Clock className="h-4 w-4" />} label="Gewerkte werkuren" iconColor="text-[#2d7a3a]"
                open={openWerkuren} onToggle={() => setOpenWerkuren(v => !v)} />
              {openWerkuren && (
                <>
                  {totalIncomplete > 0 && (
                    <div className="px-4 py-2 bg-orange-50/60 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900/30">
                      <p className="text-xs font-semibold text-orange-600">Incomplete werkuren: {totalIncomplete}</p>
                    </div>
                  )}
                  {analyseData.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Geen werkuren gevonden</div>
                  ) : (
                    <>
                      <ColHeaders cols={["Datum","In","Out","Tot","±"]} template="72px 44px 44px 68px 1fr" />
                      <div className="divide-y divide-border/20">
                        {analyseData.map(dag =>
                          dag.pairs.map((pair, pIdx) => {
                            const isFirst = pIdx === 0;
                            const isLast  = pIdx === dag.pairs.length - 1;
                            const isOpen  = pair.outRec === null;
                            return (
                              <div key={`${dag.datum}-${pIdx}`}
                                className={`grid px-4 items-center ${isOpen ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                                style={{ gridTemplateColumns: "72px 44px 44px 68px 1fr", minHeight: "32px" }}>
                                <span className="text-xs font-semibold text-foreground py-1.5">
                                  {isFirst ? `${dag.weekdagKort} ${dag.dagStr}` : ""}
                                </span>
                                <span className="text-xs font-mono text-foreground py-1.5">{formatHM(pair.inTime)}</span>
                                <span className={`text-xs font-mono py-1.5 ${isOpen ? "text-amber-500 italic" : "text-foreground"}`}>
                                  {pair.outTime ? formatHM(pair.outTime) : "open"}
                                </span>
                                <span className="text-xs font-mono text-foreground py-1.5">
                                  {isLast && dag.totaalWerktijdSec > 0 ? formatHMS(dag.totaalWerktijdSec) : ""}
                                </span>
                                <span className={`text-xs font-mono font-bold text-right py-1.5 ${
                                  !isLast || dag.totaalWerktijdSec === 0 ? ""
                                    : dag.verschilSec >= 0 ? "text-green-600" : "text-red-500"}`}>
                                  {isLast && dag.totaalWerktijdSec > 0
                                    ? `${dag.verschilSec >= 0 ? "+" : "-"}${formatHMS(Math.abs(dag.verschilSec))}`
                                    : ""}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="px-4 py-3 border-t border-border/30 bg-muted/20 flex justify-end">
                        <span className="text-xs text-muted-foreground">
                          Totaal: <strong className="text-foreground font-mono">{formatHMS(totalGewerkt)}</strong>
                          {" · "}<strong className="text-foreground">{totalDagen}</strong> dag(en)
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </Card>

            {/* ── Te laat ingeklokt ─────────────────────────────────────── */}
            <Card className="rounded-2xl border border-border/50 overflow-hidden">
              <SectionHeader icon={<Clock className="h-4 w-4" />} label="Te laat ingeklokt" iconColor="text-orange-500"
                open={openTeLaat} onToggle={() => setOpenTeLaat(v => !v)} />
              {openTeLaat && (
                allTeLaat.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Geen te laat geregistreerd ✓</div>
                ) : (
                  <>
                    <ColHeaders cols={["Dag","Datum","Tijd"]} template="40px 1fr 1fr" />
                    <div className="divide-y divide-border/20">
                      {allTeLaat.map((item, i) => (
                        <div key={i} className="grid px-4 items-center" style={{ gridTemplateColumns: "40px 1fr 1fr", minHeight: "36px" }}>
                          <span className="text-xs font-semibold text-foreground">{item.dag.weekdagKort}</span>
                          <span className="text-xs text-foreground">{item.dag.dagStrFull}</span>
                          <span className="text-xs font-mono font-semibold text-orange-600">{item.tijd}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </Card>

            {/* ── Te vroeg uitgeklokt ───────────────────────────────────── */}
            <Card className="rounded-2xl border border-border/50 overflow-hidden">
              <SectionHeader icon={<LogOut className="h-4 w-4" />} label="Te vroeg uitgeklokt" iconColor="text-orange-500"
                open={openTeVroegUit} onToggle={() => setOpenTeVroegUit(v => !v)} />
              {openTeVroegUit && (
                allTeVroegUit.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Geen te vroeg uitgeklokt ✓</div>
                ) : (
                  <>
                    <ColHeaders cols={["Dag","Datum","Tijd"]} template="40px 1fr 1fr" />
                    <div className="divide-y divide-border/20">
                      {allTeVroegUit.map((item, i) => (
                        <div key={i} className="grid px-4 items-center" style={{ gridTemplateColumns: "40px 1fr 1fr", minHeight: "36px" }}>
                          <span className="text-xs font-semibold text-foreground">{item.dag.weekdagKort}</span>
                          <span className="text-xs text-foreground">{item.dag.dagStrFull}</span>
                          <span className="text-xs font-mono font-semibold text-orange-600">{item.tijd}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </Card>

            {/* ── Pauze overzicht ───────────────────────────────────────── */}
            <Card className="rounded-2xl border border-border/50 overflow-hidden">
              <SectionHeader icon={<Coffee className="h-4 w-4" />} label="Pauze overzicht" iconColor="text-[#2d7a3a]"
                open={openPauze} onToggle={() => setOpenPauze(v => !v)} />
              {openPauze && (
                pauzeRows.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Geen pauzes gedetecteerd</div>
                ) : (
                  <>
                    <ColHeaders cols={["Datum","Out","In","Duur"]} template="80px 44px 44px 1fr" />
                    <div className="divide-y divide-border/20">
                      {pauzeRows.map(dag => (
                        <div key={dag.datum} className="grid px-4 items-center"
                          style={{ gridTemplateColumns: "80px 44px 44px 1fr", minHeight: "36px" }}>
                          <span className="text-xs font-semibold text-foreground">{dag.weekdagKort} {dag.dagStr}</span>
                          <span className="text-xs font-mono text-foreground">{formatHM(dag.pauze.outTime)}</span>
                          <span className="text-xs font-mono text-foreground">{formatHM(dag.pauze.inTime)}</span>
                          <span className="text-xs font-mono text-foreground text-right pr-1">{formatHMS(dag.pauze.durSec)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-border/30 bg-muted/20 flex justify-end">
                      <span className="text-xs text-muted-foreground">
                        Totaal pauze: <strong className="text-foreground font-mono">{formatHMS(totalPauzeSec)}</strong>
                      </span>
                    </div>
                  </>
                )
              )}
            </Card>

            {/* ── Verzuim — gemiste bloktijden ──────────────────────────── */}
            <Card className="rounded-2xl border border-border/50 overflow-hidden">
              <SectionHeader icon={<AlertCircle className="h-4 w-4" />} label="Verzuim — gemiste bloktijden" iconColor="text-red-500"
                open={openVerzuim} onToggle={() => setOpenVerzuim(v => !v)} />
              {openVerzuim && (
                missedBlokRows.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Alle bloktijden OK ✓</div>
                ) : (
                  <>
                    <ColHeaders cols={["Dag","BL1","BL2","BL3","BL4"]} template="68px 1fr 1fr 1fr 1fr" />
                    <div className="divide-y divide-border/20">
                      {missedBlokRows.map(dag => (
                        <div key={dag.datum} className="grid px-4 items-center"
                          style={{ gridTemplateColumns: "68px 1fr 1fr 1fr 1fr", minHeight: "36px" }}>
                          <span className="text-xs font-semibold text-foreground">{dag.weekdagKort} {dag.dagStr}</span>
                          <BlokBadge ok={dag.blok1Ok} />
                          <BlokBadge ok={dag.blok2Ok} />
                          <BlokBadge ok={dag.blok3Ok} />
                          <BlokBadge ok={dag.blok4Ok} />
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        BL1 = inklok 07:00–08:00 · BL2 = uitklok pauze 11:45–12:30 · BL3 = inklok na pauze 13:30–14:30 · BL4 = uitklok 16:30–18:00
                      </p>
                    </div>
                  </>
                )
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
