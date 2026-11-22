"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error instanceof Error && error.message
      ? error.message
      : "An unexpected error occurred while rendering this view.";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-6">
        <BrandLogo size="md" />
      </div>
      <Card className="w-full max-w-md rounded-2xl text-center">
        <CardContent className="flex flex-col items-center py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {message}
          </p>
          <Button
            type="button"
            onClick={() => retry()}
            className="mt-6 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
