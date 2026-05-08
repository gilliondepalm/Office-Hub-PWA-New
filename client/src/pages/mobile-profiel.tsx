import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { User, Mail, Briefcase, LayoutGrid, LogOut } from "lucide-react";

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3.5 py-3.5 border-b border-border/30 last:border-b-0">
      <div className="w-9 h-9 rounded-full bg-[#1a3d26]/10 dark:bg-[#2d7a3a]/20 flex items-center justify-center shrink-0">
        <span className="text-[#2d7a3a]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function MobileProfielPage() {
  const { user, logout } = useAuth();

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("")
    : "KD";

  const heroSrc = "/uploads/App_pics/profiel.png";

  return (
    <div className="pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: "220px" }}>
        <img
          src={heroSrc}
          alt="Persoonlijk"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/uploads/App_pics/dashboard.png";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/75" />

        {/* Content overlay */}
        <div className="relative z-10 h-full flex flex-col justify-end px-4 pb-5">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
            style={{ background: "#e8b800" }}
          >
            <span className="text-[#1a1a00] text-xl font-black tracking-tight">{initials}</span>
          </div>
          <h2 className="text-white text-2xl font-bold leading-tight">{user?.fullName}</h2>
          <p className="text-white/75 text-sm mt-0.5">{user?.functie || user?.role || ""}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* ── Info card ─────────────────────────────────────────────────── */}
        <Card className="rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-4">
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Gebruikersnaam"
              value={user?.username}
            />
            <InfoRow
              icon={<Mail className="h-4 w-4" />}
              label="E-mailadres"
              value={user?.email}
            />
            <InfoRow
              icon={<Briefcase className="h-4 w-4" />}
              label="Functie"
              value={user?.functie}
            />
            <InfoRow
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Afdeling"
              value={user?.department}
            />
          </div>
        </Card>

        {/* ── Uitloggen ─────────────────────────────────────────────────── */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold text-white transition-opacity active:opacity-80"
          style={{ background: "#e53e3e" }}
          data-testid="button-uitloggen"
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </button>
      </div>
    </div>
  );
}
