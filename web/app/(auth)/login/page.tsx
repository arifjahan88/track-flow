"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useHydrated } from "@/hooks/use-hydrated";

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && currentUserId) {
      router.replace("/dashboard");
    }
  }, [hydrated, currentUserId, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Brief visual feedback for demo authentication
    await new Promise((resolve) => setTimeout(resolve, 260));

    const err =
      tab === "signin"
        ? await login(email, password)
        : await register(name, email, password);

    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }

    router.replace("/dashboard");
  };

  const handleDemoLogin = async () => {
    setError(null);
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    loginAsDemo();
    router.replace("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-2">
      {/* Top-right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left visual panel (compact header on mobile, full panel on desktop) */}
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-border bg-[#0b1522] px-6 py-8 text-[#e8f0f7] lg:border-r lg:border-b-0 lg:p-12">
        <Image
          src="/images/login-backdrop.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="pointer-events-none object-cover opacity-35"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0b1522]/85 via-[#0b1522]/65 to-[#12202f]/90"
          aria-hidden="true"
        />

        {/* Animated SVG route overlay */}
        <svg
          viewBox="0 0 640 420"
          className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
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
            <pattern
              id="login-grid"
              width="44"
              height="44"
              patternUnits="userSpaceOnUse"
            >
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
            transition={
              prefersReduced
                ? { duration: 0 }
                : { duration: 4, ease: "easeInOut" }
            }
          />

          <circle
            cx="70"
            cy="340"
            r="6"
            fill="#0b1522"
            stroke="#2ee6d6"
            strokeWidth="3"
          />

          <motion.g
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              prefersReduced ? { duration: 0 } : { delay: 3.6, duration: 0.4 }
            }
          >
            <circle
              cx="548"
              cy="108"
              r="14"
              fill="#ffb020"
              fillOpacity="0.28"
              className="tf-live-pulse origin-[548px_108px]"
            />
            <circle
              cx="548"
              cy="108"
              r="6.5"
              fill="#ffb020"
              stroke="#0b1522"
              strokeWidth="2"
            />
          </motion.g>
        </svg>

        <div className="relative z-10">
          <BrandLogo size="md" className="[&_span]:text-[#e8f0f7]" />
        </div>

        <div className="relative z-10 mt-6 max-w-md space-y-3 lg:mt-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
            See every trip as it happens.
          </h1>
          <p className="text-sm leading-relaxed text-[#b4c6d8] sm:text-base">
            Track live GPS routes, monitor fleet vehicles, log fuel and
            maintenance, and export trip reports directly from your browser.
          </p>
        </div>

        <div className="relative z-10 mt-6 hidden items-center gap-2 text-xs text-[#8aa0b4] lg:flex">
          <ShieldCheck className="h-4 w-4 text-[#2ee6d6]" />
          <span>Browser-only demo workspace stored locally on your device.</span>
        </div>
      </section>

      {/* Right form panel */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          className="w-full max-w-md"
          initial={prefersReduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReduced ? { duration: 0 } : { duration: 0.35 }}
        >
          <Card className="rounded-2xl border-border bg-card shadow-lg">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-full border border-[var(--brand-teal)]/30 bg-[var(--brand-teal)]/12 text-[var(--brand-teal)]"
                >
                  Demo mode
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Local browser session
                </span>
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">
                  {tab === "signin" ? "Sign in to TrackFlow" : "Create account"}
                </CardTitle>
                <CardDescription className="mt-1">
                  Demo credentials:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    demo@demo.com
                  </code>{" "}
                  /{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    demo1234
                  </code>
                </CardDescription>
              </div>
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

                <TabsContent value="signin" className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
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

                    <div className="space-y-2">
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
                </TabsContent>

                <TabsContent value="register" className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
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

                    <div className="space-y-2">
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

                    <div className="space-y-2">
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={handleDemoLogin}
                className="h-10 w-full rounded-xl"
              >
                Continue as demo admin
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
