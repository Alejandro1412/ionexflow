import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="container flex items-center justify-between py-6 animate-fade-rise">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight glow-text text-foreground"
        >
          IonexFlow
        </Link>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="shadow-[0_0_24px_rgba(61,255,242,0.25)]">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="container relative flex flex-1 flex-col justify-center gap-8 pb-24 pt-10 md:max-w-3xl md:pt-4">
        <div
          className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-signal/10 blur-3xl animate-pulse-glow"
          aria-hidden
        />

        <div className="relative space-y-5 animate-fade-rise [animation-delay:120ms]">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
            Command center
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-foreground sm:text-6xl md:text-7xl glow-text">
            IonexFlow
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">
            Orchestrate autonomous AI agent workflows visually — with live
            pulses, human approvals, and enterprise-grade control.
          </p>
        </div>

        <div className="relative flex flex-wrap gap-3 animate-fade-rise [animation-delay:240ms]">
          <Button asChild size="lg" className="shadow-[0_0_28px_rgba(61,255,242,0.35)]">
            <Link href="/signup">Start free trial</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-signal/30 bg-white/5 backdrop-blur-md hover:bg-signal/10"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/80 animate-fade-rise [animation-delay:360ms]">
          Move your cursor — the neural field reacts. Scroll to dive deeper into
          the core.
        </p>
      </main>

      <section className="relative mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center gap-4 px-6 pb-24">
        <div className="glass-panel p-8 animate-fade-rise">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Neural orchestration, made visible
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Every agent pulse, approval gate, and execution path will live on a
            shared graph. Phase 1 ships the command shell — the canvas arrives
            next.
          </p>
        </div>
      </section>
    </div>
  );
}
