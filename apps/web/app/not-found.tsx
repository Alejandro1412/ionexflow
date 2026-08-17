import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.28em] text-signal">404</p>
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        That route does not exist. Head back to the command center.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
