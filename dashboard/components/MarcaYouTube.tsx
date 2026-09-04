/**
 * A marca do YouTube, desenhada e não baixada: um arquivo a menos para
 * carregar, e nada some se o endereço de fora mudar.
 *
 * Vive num componente próprio porque aparece em dois lugares — o cartão
 * de importar por link e o card do vídeo já importado — e as duas
 * precisam ser a mesma coisa.
 */
export default function MarcaYouTube({
  className = "h-5 w-auto",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 28 20" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="28" height="20" rx="5" fill="#FF0000" />
      <path d="M11.2 5.8v8.4L18.5 10z" fill="#fff" />
    </svg>
  );
}
