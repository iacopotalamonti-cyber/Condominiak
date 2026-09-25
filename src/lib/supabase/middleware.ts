import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_CONDOMINIO } from "@/lib/appartenenza";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");
  const isAuthPage = pathname.startsWith("/login");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && isProtected) {
    // L'appartenenza sta in membri, e un utente può averne più d'una. Il
    // ruolo che conta è quello nel condominio che sta guardando: si può
    // gestire il proprio condominio ed essere condomino in un altro.
    const { data: appartenenze } = await supabase
      .from("membri")
      .select("condominium_id, ruolo")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const scelto = request.cookies.get(COOKIE_CONDOMINIO)?.value;
    const attiva =
      (appartenenze ?? []).find((a) => a.condominium_id === scelto) ?? appartenenze?.[0];

    // L'onboarding resta raggiungibile anche per chi ha già un condominio:
    // è da lì che se ne registra un secondo.
    if (pathname.startsWith("/dashboard") && !attiva) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/dashboard") && attiva?.ruolo === "resident") {
      // Il condomino può accedere solo alla propria vista appartamento
      if (pathname !== "/dashboard/appartamento") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/appartamento";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
