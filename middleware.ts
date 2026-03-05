import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/navigation";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except API routes, Next.js internals, and static files
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
