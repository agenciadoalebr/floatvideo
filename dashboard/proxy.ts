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
    //
    // Arquivos de mídia e fontes pelo mesmo motivo: sem sessão, o
    // proxy respondia o HTML do /login no lugar do arquivo. O <video>
    // da home recebia uma página em vez de um vídeo e desistia em
    // silêncio — o navegador não avisa, só não toca.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|embed.js|player.js|fvw-styles.css|test-widget.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|woff2?|html|js|css|txt|xml|ico)$).*)",
  ],
};
