import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-6">
        <BrandLogo size="md" />
      </div>
      <Card className="w-full max-w-md rounded-2xl text-center">
        <CardContent className="flex flex-col items-center py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-[var(--brand-teal)]">
            <Compass className="h-6 w-6" />
          </div>
          <p className="mt-4 font-display text-3xl font-semibold text-foreground">
            404
          </p>
          <h1 className="mt-2 text-lg font-semibold text-foreground">
            Page not found
          </h1>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            The route you requested does not exist in TrackFlow.
          </p>
          <Link href="/dashboard" className="mt-6">
            <Button className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
