import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/auth",
  "/api/stripe",
  "/api/approvals",
  "/api/cron",
  "/api/email",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/** Only real Supabase session cookies — avoid forcing getUser() on every request. */
function hasAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes("-auth-token") ||
        cookie.name.endsWith("auth-token.code-verifier")
    );
}

/**
 * Refreshes the Supabase auth session on protected (and cookied) requests.
 * Public pages without auth cookies skip the network getUser() round-trip.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);

  if (publicPath && !hasAuthCookie(request)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !publicPath) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
