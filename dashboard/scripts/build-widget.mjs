/**
 * Gera o widget que roda no site do cliente: public/player.min.js.
 *
 * Duas coisas acontecem aqui, e as duas existem por causa do dono do
 * site, não do nosso conforto:
 *
 *  1. O CSS entra dentro do JS. Servido à parte, ele era uma segunda
 *     requisição para outro domínio — ida e volta de rede inteira só
 *     para o balão não nascer sem estilo.
 *  2. Minificação. O arquivo é cheio de comentários explicando decisões,
 *     e eles são para quem edita o código, não para quem visita a loja.
 *
 * O player.js continua sendo a fonte, legível e com os comentários. Se
 * este script não rodar, o embed.js cai nele sozinho — o widget fica
 * maior, mas nunca quebrado.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const arquivo = (nome) => join(raiz, "public", nome);

const css = readFileSync(arquivo("fvw-styles.css"), "utf8");
const js = readFileSync(arquivo("player.js"), "utf8");

const MARCADOR = '"__FVW_CSS__"';
if (!js.includes(MARCADOR)) {
  throw new Error(
    `player.js precisa conter ${MARCADOR} — é onde o CSS é embutido.`
  );
}

const cssMin = (await transform(css, { loader: "css", minify: true })).code;
// JSON.stringify escapa aspas, quebras de linha e barras invertidas — o
// CSS vira uma string literal válida sem nenhum cuidado manual.
const comCss = js.replace(MARCADOR, JSON.stringify(cssMin.trim()));

const { code } = await transform(comCss, {
  loader: "js",
  minify: true,
  // Site de cliente pode ser antigo; o player todo é ES5 de propósito e
  // não queremos que a minificação introduza sintaxe mais nova.
  target: "es2015",
  legalComments: "none",
});

writeFileSync(arquivo("player.min.js"), code);

const kb = (t) => (Buffer.byteLength(t) / 1024).toFixed(1) + " KB";
console.log(
  `widget: player.js ${kb(js)} + css ${kb(css)} -> player.min.js ${kb(code)}`
);
