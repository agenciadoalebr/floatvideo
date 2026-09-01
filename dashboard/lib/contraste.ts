/**
 * Cor de texto legível sobre um fundo. Mesma regra do corDeTextoPara no
 * player.js: luminância relativa da WCAG, não achismo — foi o que
 * resolveu o botão "lavado" em marcas de cor clara.
 */
export function corDeTextoPara(hex: string) {
  let m = String(hex).replace("#", "");
  if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
  if (m.length !== 6) return "#fff";

  const canal = (i: number) => {
    const c = parseInt(m.substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const lum = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  return lum > 0.45 ? "#111" : "#fff";
}
