/**
 * Respiro padrão das telas do painel.
 *
 * O layout deixou de embrulhar tudo porque dentro de um site o menu
 * precisa encostar na borda. Este componente devolve o enquadramento
 * para as telas que não têm menu — num lugar só, em vez de repetir a
 * mesma sequência de classes em seis páginas.
 */
export default function Conteudo({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6">{children}</div>
  );
}
