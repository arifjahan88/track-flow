"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Radio, ShieldCheck, Truck, UserCheck, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEMO_ACCOUNTS, useAuthStore } from "@/store/auth-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { ROLE_LABELS } from "@/lib/rbac";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

const ROLE_ICON: Record<UserRole, typeof ShieldCheck> = {
  super_admin: ShieldCheck,
  fleet_manager: UserCheck,
  dispatcher: Radio,
  mechanic: Wrench,
  driver: Truck,
};

const ROLE_COLOR: Record<UserRole, string> = {
  super_admin: "border-cyan-500/35 bg-cyan-500/12 text-cyan-600 dark:text-cyan-300",
  fleet_manager: "border-emerald-500/35 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  dispatcher: "border-violet-500/35 bg-violet-500/12 text-violet-600 dark:text-violet-300",
  mechanic: "border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-300",
  driver: "border-sky-500/35 bg-sky-500/12 text-sky-600 dark:text-sky-300",
};

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const prefersReduced = useReducedMotion();

  const currentUserId = useAuthStore((s) => s.currentUserId);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loginAsDemo = useAuthStore((s) => s.loginAsDemo);

  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@demo.com");
  const [password, setPassword] = useState("demo1234");
  const [registerRole, setRegisterRole] = useState<UserRole>("fleet_manager");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [launchingRole, setLaunchingRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (hydrated && currentUserId) {
      router.replace("/dashboard");
    }
  }, [hydrated, currentUserId, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const err =
      tab === "signin"
        ? await login(email, password)
        : await register(name, email, password, registerRole);

    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }

    router.replace("/dashboard");
  };

  const handleQuickDemo = async (role: UserRole) => {
    setError(null);
    setLaunchingRole(role);
    await new Promise((resolve) => setTimeout(resolve, 160));
    loginAsDemo(role);
    router.replace("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-12">
      {/* Top-right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left visual panel (original animated route backdrop design) */}
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-border bg-[#0b1522] px-6 py-8 text-[#e8f0f7] lg:col-span-5 lg:border-r lg:border-b-0 lg:p-12">
        <Image
          src="/images/login-backdrop.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="pointer-events-none object-cover opacity-35"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#0b1522]/85 via-[#0b1522]/65 to-[#12202f]/90"
          aria-hidden="true"
        />

        {/* Animated SVG route overlay */}
        <svg
          viewBox="0 0 640 420"
          className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-55 lg:block"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="login-route-grad"
              x1="60"
              y1="340"
              x2="540"
              y2="90"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="65%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <pattern id="login-grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path
                d="M 44 0 L 0 0 0 44"
                fill="none"
                stroke="rgba(138, 160, 180, 0.12)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect width="640" height="420" fill="url(#login-grid)" />

          <path
            d="M 70 340 C 150 320, 175 245, 250 250 C 330 255, 345 170, 425 175 C 485 178, 505 120, 548 108"
            fill="none"
            stroke="#2ee6d6"
            strokeOpacity="0.18"
            strokeWidth="14"
            strokeLinecap="round"
          />

          <motion.path
            d="M 70 340 C 150 320, 175 245, 250 250 C 330 255, 345 170, 425 175 C 485 178, 505 120, 548 108"
            fill="none"
            stroke="url(#login-route-grad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            initial={prefersReduced ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 4, ease: "easeInOut" }}
          />

          <circle cx="70" cy="340" r="6" fill="#0b1522" stroke="#2ee6d6" strokeWidth="3" />

          <motion.g
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={prefersReduced ? { duration: 0 } : { delay: 3.6, duration: 0.4 }}
          >
            <circle
              cx="548"
              cy="108"
              r="14"
              fill="#ffb020"
              fillOpacity="0.28"
              className="tf-live-pulse origin-[548px_108px]"
            />
            <circle cx="548" cy="108" r="6.5" fill="#ffb020" stroke="#0b1522" strokeWidth="2" />
          </motion.g>
        </svg>

        <div className="relative z-10">
          <BrandLogo size="md" className="[&_span]:text-[#e8f0f7]" />
        </div>

        <div className="relative z-10 mt-6 max-w-md space-y-3 rounded-2xl bg-[#0b1522]/60 p-4 backdrop-blur-[2px] sm:-mx-4 lg:mt-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white [text-shadow:0_2px_12px_rgba(7,15,28,0.9)] sm:text-3xl lg:text-4xl">
            See every trip as it happens.
          </h1>
          <p className="text-sm leading-relaxed text-[#e2edf7] [text-shadow:0_1px_10px_rgba(7,15,28,0.95)] sm:text-base">
            Track live GPS routes, monitor fleet vehicles, log fuel and maintenance, and export trip
            reports directly from your browser.
          </p>
        </div>

        <div className="relative z-10 mt-6 hidden items-center gap-2 text-xs text-[#8aa0b4] lg:flex">
          <ShieldCheck className="h-4 w-4 text-[#2ee6d6]" />
          <span>Browser-only vehicle management workspace stored locally on your device.</span>
        </div>
      </section>

      {/* Right Auth + Quick Demo Accounts Panel */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:col-span-7">
        <motion.div
          className="w-full max-w-xl space-y-5"
          initial={prefersReduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.35 }}
        >
          <Card className="rounded-2xl border-border bg-card shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold">
                {tab === "signin" ? "Sign in to TrackFlow" : "Create a Fleet Account"}
              </CardTitle>
              <CardDescription>
                Use any pre-seeded demo account below (password{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  demo1234
                </code>
                ) or register a new profile.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <Tabs
                value={tab}
                onValueChange={(value) => {
                  setTab(value as "signin" | "register");
                  setError(null);
                  if (value === "register") {
                    setEmail("");
                    setPassword("");
                  } else {
                    setEmail("demo@demo.com");
                    setPassword("demo1234");
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-2 rounded-xl">
                  <TabsTrigger value="signin" className="rounded-lg">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="register" className="rounded-lg">
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-4 space-y-5">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="signin-email">Email</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="demo@demo.com"
                          className="h-10 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="signin-password">Password</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>

                    {error ? (
                      <p
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {error}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={submitting || launchingRole !== null}
                      className="h-10 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>

                  {/* 1-Click Quick Demo Accounts */}
                  <div className="space-y-2.5 border-t border-border/70 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Quick Demo Accounts (1-Click Launch)
                      </p>
                      <span className="fp-telemetry text-[11px] text-muted-foreground">
                        5 roles ready
                      </span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {DEMO_ACCOUNTS.map((acct) => {
                        const Icon = ROLE_ICON[acct.role];
                        const isLaunching = launchingRole === acct.role;
                        return (
                          <button
                            key={acct.id}
                            type="button"
                            disabled={submitting || launchingRole !== null}
                            onClick={() => handleQuickDemo(acct.role)}
                            className="group flex items-start gap-2.5 rounded-xl border border-border/80 bg-muted/30 p-2.5 text-left transition-all hover:border-cyan-500/45 hover:bg-cyan-500/5 disabled:opacity-60"
                          >
                            <div
                              className={cn(
                                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                                ROLE_COLOR[acct.role],
                              )}
                            >
                              {isLaunching ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Icon className="size-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="truncate text-xs font-semibold text-foreground">
                                  {acct.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="shrink-0 px-1.5 py-0 text-[10px]"
                                >
                                  {ROLE_LABELS[acct.role]}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                                {acct.email}
                              </p>
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                                {acct.tagline}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="register" className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="register-name">Full name</Label>
                        <Input
                          id="register-name"
                          type="text"
                          autoComplete="name"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Alex Rahman"
                          className="h-10 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="register-role">Account role</Label>
                        <Select
                          value={registerRole}
                          items={ROLE_LABELS}
                          onValueChange={(val) => {
                            if (val) setRegisterRole(val as UserRole);
                          }}
                        >
                          <SelectTrigger id="register-role" className="h-10 w-full rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(
                              ([roleKey, label]) => (
                                <SelectItem key={roleKey} value={roleKey}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="register-email">Email</Label>
                        <Input
                          id="register-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="alex@company.com"
                          className="h-10 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="register-password">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="h-10 rounded-xl"
                        />
                      </div>
                    </div>

                    {error ? (
                      <p
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      >
                        {error}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="h-10 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create account
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
