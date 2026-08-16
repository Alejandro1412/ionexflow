import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">We couldn&apos;t sign you in</h1>
      <p className="max-w-sm text-muted-foreground">
        The sign-in link is invalid or has expired. Please try signing in
        again.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Back to login
      </Link>
    </div>
  );
}
