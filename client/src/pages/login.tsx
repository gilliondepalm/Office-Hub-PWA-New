import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Lock, User, Mail, ArrowLeft, CheckCircle2, LogIn } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "done">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ message: string } | null>(null);

  const { data: loginPhoto } = useQuery<{ value: string | null }>({
    queryKey: ["/api/site-settings/public", "login_photo"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings/public/login_photo");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setLoading(true);
    try {
      await login(data.username, data.password);
      setLocation("/");
    } catch {
      toast({
        title: "Inloggen mislukt",
        description: "Controleer uw gebruikersnaam en wachtwoord.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    if (!resetEmail.trim()) {
      toast({ title: "Vul uw e-mailadres in", variant: "destructive" });
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      setResetResult(data);
      setResetStep("done");
    } catch {
      toast({ title: "Er is een fout opgetreden", variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowReset(false);
    setResetStep("email");
    setResetEmail("");
    setResetResult(null);
  };

  const heroImageUrl = loginPhoto?.value || "/uploads/App_pics/curacao_login.jpg";

  // ── Mobile login layout ────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-background overflow-hidden">
        {/* Hero */}
        <div className="relative h-56 flex-shrink-0">
          <img
            src={heroImageUrl}
            alt="Kantoor"
            className="absolute inset-0 w-full h-full object-cover"
            data-testid="img-login-photo"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a3d26cc] to-[#0f2518ee]" />
          <div className="relative z-10 h-full flex flex-col items-center justify-center gap-3 text-white px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(48,96%,53%)] text-[hsl(152,30%,10%)] font-bold text-lg">
              KD
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight">Kadaster Dashboard</h1>
              <p className="text-white/70 text-xs mt-0.5">Uw kantoor, overzichtelijk beheerd</p>
            </div>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 px-6 pt-8 pb-8 flex flex-col">
          {!showReset ? (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Welkom terug</h2>
                <p className="text-muted-foreground text-sm">Voer uw gegevens in om in te loggen</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="Gebruikersnaam"
                              autoComplete="username"
                              className="pl-10 h-12 bg-muted/50 border-muted rounded-xl text-sm"
                              data-testid="input-username"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Wachtwoord"
                              autoComplete="current-password"
                              className="pl-10 h-12 bg-muted/50 border-muted rounded-xl text-sm"
                              data-testid="input-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold text-sm rounded-xl mt-1"
                    style={{ background: "#1a3d26" }}
                    disabled={loading}
                    data-testid="button-login"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {loading ? "Inloggen..." : "Inloggen"}
                  </Button>
                </form>
              </Form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
                  data-testid="button-forgot-password"
                >
                  Wachtwoord of gebruikersnaam vergeten?
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="h-4 w-4" />
                Terug naar inloggen
              </button>

              {resetStep === "email" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight">Gegevens herstellen</h2>
                    <p className="text-muted-foreground text-sm">
                      Vul uw e-mailadres in om uw gegevens te herstellen.
                    </p>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="E-mailadres"
                      autoComplete="email"
                      className="pl-10 h-12 bg-muted/50 border-muted rounded-xl text-sm"
                      onKeyDown={e => e.key === "Enter" && handleRequestReset()}
                      data-testid="input-reset-email"
                    />
                  </div>
                  <Button
                    className="w-full h-12 font-semibold text-sm rounded-xl"
                    onClick={handleRequestReset}
                    disabled={resetLoading}
                    data-testid="button-request-reset"
                  >
                    {resetLoading ? "Versturen..." : "Verzoek indienen"}
                  </Button>
                </div>
              )}

              {resetStep === "done" && resetResult && (
                <div className="space-y-4 text-center pt-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold tracking-tight">Verzoek ingediend</h2>
                    <p className="text-muted-foreground text-sm">{resetResult.message}</p>
                  </div>
                  <Button
                    className="w-full h-12 font-semibold text-sm rounded-xl"
                    onClick={handleBackToLogin}
                    data-testid="button-back-after-reset"
                  >
                    Terug naar inloggen
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-auto pt-6">
            Kadaster Dashboard v2.0 · GDP © ir. G.G. de Palm
          </p>
        </div>
      </div>
    );
  }

  // ── Desktop login layout ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">

      {/* ── Hero section ─────────────────────────────────────────── */}
      <div className="relative w-full lg:w-1/2 lg:min-h-screen h-[42vh] min-h-[280px] lg:h-auto flex-shrink-0">
        <img
          src={heroImageUrl}
          alt="Kantoor"
          className="absolute inset-0 w-full h-full object-cover object-center"
          data-testid="img-login-photo"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/70 lg:bg-gradient-to-br lg:from-[#1a3d26cc] lg:to-[#0f2518e6]" />

        <div className="relative z-10 h-full flex flex-col justify-between p-6 lg:p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center rounded-md bg-[hsl(48,96%,53%)] text-[hsl(152,30%,10%)] font-bold text-sm">
              KD
            </div>
            <span className="text-base lg:text-lg font-semibold tracking-tight">Kadaster Dashboard</span>
          </div>

          <div className="space-y-3 lg:space-y-4 max-w-md">
            <h1 className="text-2xl lg:text-4xl font-bold leading-tight">
              Uw kantoor,<br />overzichtelijk beheerd
            </h1>
            <p className="text-white/80 text-sm lg:text-lg leading-relaxed">
              Beheer medewerkers, evenementen, afwezigheden en meer.
            </p>
            <div className="flex items-center gap-5 lg:gap-6 pt-1 lg:pt-4">
              <div className="text-center">
                <p className="text-xl lg:text-2xl font-bold text-[hsl(48,96%,53%)]">9+</p>
                <p className="text-xs text-white/70">Modules</p>
              </div>
              <div className="w-px h-8 bg-white/25" />
              <div className="text-center">
                <p className="text-xl lg:text-2xl font-bold text-[hsl(48,96%,53%)]">100%</p>
                <p className="text-xs text-white/70">Veilig</p>
              </div>
              <div className="w-px h-8 bg-white/25" />
              <div className="text-center">
                <p className="text-xl lg:text-2xl font-bold text-[hsl(48,96%,53%)]">24/7</p>
                <p className="text-xs text-white/70">Toegang</p>
              </div>
            </div>
          </div>

          <div className="hidden lg:block space-y-0.5">
            <p className="text-xs text-white/50">Kadaster Dashboard v2.0</p>
            <p className="text-xs text-white/50">GDP © ir. G.G. de Palm</p>
          </div>
        </div>
      </div>

      {/* ── Form section ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between bg-background px-6 pt-8 pb-6 lg:px-12 lg:py-0 lg:justify-center">
        <div className="w-full max-w-sm mx-auto space-y-7 lg:py-16">

          {!showReset ? (
            <>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Welkom terug</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Voer uw gegevens in om toegang te krijgen tot het dashboard
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="Gebruikersnaam"
                              autoComplete="username"
                              className="pl-10 h-12 bg-muted/50 border-muted rounded-xl text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
                              data-testid="input-username"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Wachtwoord"
                              autoComplete="current-password"
                              className="pl-10 h-12 bg-muted/50 border-muted rounded-xl text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
                              data-testid="input-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 font-semibold text-sm rounded-xl"
                    disabled={loading}
                    data-testid="button-login"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    {loading ? "Inloggen..." : "Inloggen"}
                  </Button>
                </form>
              </Form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline transition-colors"
                  data-testid="button-forgot-password"
                >
                  Wachtwoord of gebruikersnaam vergeten?
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="h-4 w-4" />
                Terug naar inloggen
              </button>

              {resetStep === "email" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Gegevens herstellen</h2>
                    <p className="text-muted-foreground text-sm">
                      Vul uw e-mailadres in. Uw gebruikersnaam wordt getoond en uw beheerder kan uw wachtwoord resetten.
                    </p>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="E-mailadres"
                      autoComplete="email"
                      className="pl-10 h-12 bg-muted/50 border-muted rounded-xl text-sm"
                      onKeyDown={e => e.key === "Enter" && handleRequestReset()}
                      data-testid="input-reset-email"
                    />
                  </div>
                  <Button
                    className="w-full h-12 font-semibold text-sm rounded-xl"
                    onClick={handleRequestReset}
                    disabled={resetLoading}
                    data-testid="button-request-reset"
                  >
                    {resetLoading ? "Verzoek versturen..." : "Verzoek indienen"}
                  </Button>
                </div>
              )}

              {resetStep === "done" && resetResult && (
                <div className="space-y-4 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Verzoek ingediend</h2>
                    <p className="text-muted-foreground text-sm">{resetResult.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Neem contact op met uw beheerder om uw wachtwoord te laten resetten.
                    </p>
                  </div>
                  <Button
                    className="w-full h-12 font-semibold text-sm rounded-xl"
                    onClick={handleBackToLogin}
                    data-testid="button-back-after-reset"
                  >
                    Terug naar inloggen
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 lg:hidden">
          Kadaster Dashboard v2.0 · GDP © ir. G.G. de Palm
        </p>
      </div>
    </div>
  );
}
