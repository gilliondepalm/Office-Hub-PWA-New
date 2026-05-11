import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Star, Award } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type BeoordelingReview = {
  id: string;
  userId: string;
  year: number;
  medewerker: string;
  functie?: string | null;
  afdeling?: string | null;
  beoordelaar?: string | null;
  totalScore?: string | null;
};

type YearlyAward = {
  id: string;
  year: number;
  type: string;
  name: string;
  photo?: string | null;
};

// ── Score label map (1–5 scale) ────────────────────────────────────────────
const SCORE_LABELS: Record<number, string> = {
  1: "Onvoldoende",
  2: "Nog te ontwikkelen",
  3: "Normaal/goed",
  4: "Zeer goed/aantoonbaar beter",
  5: "Uitstekend/voorbeeld voor anderen",
};

// Parse "Totaal: 30 / Gemiddeld: 5.0" → { totaal, gemiddeld, label }
function parseScore(totalScore: string | null | undefined) {
  if (!totalScore) return null;
  const totaalMatch    = totalScore.match(/Totaal:\s*(\d+)/);
  const gemiddeldMatch = totalScore.match(/Gemiddeld:\s*([\d.]+)/);
  if (!totaalMatch) return null;
  const totaal    = parseInt(totaalMatch[1]);
  const gemiddeld = gemiddeldMatch ? parseFloat(gemiddeldMatch[1]) : 0;
  const rounded   = Math.min(5, Math.max(1, Math.round(gemiddeld)));
  return { totaal, gemiddeld, label: SCORE_LABELS[rounded] ?? "" };
}

// ── Beoordeling card ──────────────────────────────────────────────────────────
function BeoordelingCard({ review }: { review: BeoordelingReview | undefined; year: number } & { year: number }) {
  if (!review) {
    return (
      <Card className="rounded-2xl border border-border/50 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0 mt-0.5">
            <Star className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Beoordeling</p>
            <p className="text-sm text-muted-foreground italic">Nog niet beoordeeld</p>
          </div>
        </div>
      </Card>
    );
  }

  const parsed = parseScore(review.totalScore);
  const shortName = review.medewerker
    ? (() => {
        const parts = review.medewerker.trim().split(" ");
        const lastName = parts[parts.length - 1];
        const initials = parts
          .slice(0, -1)
          .map(p => p[0]?.toUpperCase() + ".")
          .join(" ");
        return `${initials} ${lastName}`.trim();
      })()
    : review.medewerker;

  return (
    <Card className="rounded-2xl border border-border/50 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0 mt-0.5">
          <Star className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Beoordeling {shortName}
          </p>
          {parsed ? (
            <>
              <p className="text-sm font-semibold text-foreground">Totaal: {parsed.totaal}</p>
              <p className="text-sm text-foreground">Aantal gescoord: {parsed.totaal}</p>
              <p className="text-sm font-semibold text-[#2d7a3a] mt-0.5">{parsed.label}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Beoordeling aanwezig</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Afdeling van het jaar card ────────────────────────────────────────────────
function AfdelingCard({ award }: { award: YearlyAward | undefined }) {
  const hasAward = !!award;
  return (
    <Card className="rounded-2xl border border-border/50 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
          hasAward ? "bg-[#1a3d26]" : "bg-muted"
        }`}>
          <Award className={`h-5 w-5 ${hasAward ? "text-white" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Afdeling van het jaar
          </p>
          {hasAward ? (
            <p className="text-sm font-bold text-foreground">{award.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Nog niet toegekend</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MobileBeloningenPage() {
  const { user } = useAuth();

  const { data: myReviews = [], isLoading: loadingReviews } = useQuery<BeoordelingReview[]>({
    queryKey: ["/api/beoordeling/mine"],
  });

  const { data: yearlyAwards = [], isLoading: loadingAwards } = useQuery<YearlyAward[]>({
    queryKey: ["/api/yearly-awards"],
  });

  const isLoading = loadingReviews || loadingAwards;

  // Determine year range: current year down to earliest data year (min 3 years back)
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(
    currentYear - 2,
    ...(myReviews.length > 0 ? myReviews.map(r => r.year) : [currentYear]),
    ...(yearlyAwards.length > 0 ? yearlyAwards.map(a => a.year) : [currentYear]),
  );
  const years: number[] = [];
  for (let y = currentYear; y >= minYear; y--) years.push(y);

  const heroSrc = "/uploads/App_pics/beloningen.png";

  return (
    <div className="pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={heroSrc}
          alt="Beloningen"
          className="absolute inset-0 w-full h-full object-cover"
          onError={e => { (e.target as HTMLImageElement).src = "/uploads/App_pics/dashboard.png"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />
        <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-5">
          <p className="text-[hsl(48,96%,53%)] text-[11px] font-bold tracking-widest uppercase mb-1">Beloningen</p>
          <h2 className="text-white text-2xl font-bold leading-tight">Mijn waardering</h2>
          <p className="text-white/75 text-sm mt-0.5">{user?.fullName}</p>
        </div>
      </div>

      {/* ── Year groups ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 space-y-6">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-16 rounded-lg bg-muted animate-pulse" />
              <div className="h-24 rounded-2xl bg-muted animate-pulse" />
              <div className="h-16 rounded-2xl bg-muted animate-pulse" />
            </div>
          ))
        ) : (
          years.map(year => {
            const review  = myReviews.find(r => r.year === year);
            const deptAward = yearlyAwards.find(a => a.year === year && a.type === "department");

            // Skip years with no data at all
            const hasData = review || deptAward || year >= currentYear - 1;
            if (!hasData) return null;

            return (
              <div key={year} className="space-y-3">
                <h2 className="text-xl font-bold text-foreground">{year}</h2>
                <BeoordelingCard review={review} year={year} />
                <AfdelingCard award={deptAward} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
