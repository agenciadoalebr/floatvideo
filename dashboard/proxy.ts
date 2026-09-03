import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // robots.txt e sitemap.xml ficam de fora: são o que um rastreador
    // pede antes de qualquer coisa, e mandá-los para o /login faz o site
    // parecer fechado para quem vem de fora.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|embed.js|player.js|fvw-styles.css|test-widget.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|js|css|txt|xml|ico)$).*)",
  ],
};
