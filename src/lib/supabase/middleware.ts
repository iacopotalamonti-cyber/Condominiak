import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    const { data: unita } = await supabase
      .from("unita")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: condominium } = await supabase
      .from("condominiums")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    const hasCondominium = Boolean(condominium) || Boolean(unita);

    if (pathname.startsWith("/onboarding") && hasCondominium) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/dashboard") && !hasCondominium) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/dashboard") && unita && !condominium) {
      // Il condomino può accedere solo alla propria vista appartamento
      if (pathname !== "/dashboard/appartamento" && pathname !== "/dashboard") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/appartamento";
        return NextResponse.redirect(url);
      }
      if (pathname === "/dashboard") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/appartamento";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
