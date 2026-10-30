import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, isRole } from "@/lib/roles";

// Barra páginas sem sessão e páginas fora do perfil do usuário. As rotas
// /api não passam por aqui: cada Route Handler confere a sessão sozinho.

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname, search } = request.nextUrl;

  if (!token || !isRole(token.role)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  if (!canAccess(token.role, pathname)) {
    return NextResponse.redirect(new URL("/?negado=1", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
