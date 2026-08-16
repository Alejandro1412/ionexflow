import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Link
        href="/"
        className="font-display text-2xl font-bold tracking-tight glow-text"
      >
        IonexFlow
      </Link>
      {children}
    </div>
  );
}
