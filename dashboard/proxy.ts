import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|embed.js|player.js|fvw-styles.css|test-widget.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|js|css)$).*)",
  ],
};
