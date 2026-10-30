import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSetupMode,
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "@/lib/supabase/config";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/setup-required"];

// Runs before every page: refreshes the login session and sends
// signed-out visitors to /login. Each page also checks again on the server.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isSupabaseConfigured) {
    if (isSetupMode || isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup-required", request.url));
  }

  try {
    return await checkSession(request, pathname, isPublic);
  } catch (err) {
    // Never show a blank server error: log it and fail safely to the login page.
    console.error("[polarvane] session check failed:", err);
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login?error=service", request.url));
  }
}

async function checkSession(request: NextRequest, pathname: string, isPublic: boolean) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
