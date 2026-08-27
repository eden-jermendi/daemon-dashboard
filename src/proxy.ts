import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (authentication API endpoints)
     * - auth (authentication UI pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     */
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
