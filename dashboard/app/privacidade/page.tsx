import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Política de Privacidade — FloatVideo",
  description:
    "Como o FloatVideo trata dados de clientes e de visitantes dos sites onde o widget é instalado.",
};

export default function PrivacidadePage() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm="2 de setembro de 2026">
      <section>
        <p>
          O FloatVideo é um serviço da <strong>Agência do Alê</strong> que
          coloca um vídeo flutuante em sites e lojas virtuais. Esta política
          explica, sem rodeio, quais dados o serviço coleta, por quê, com quem
          são compartilhados e como você pede para apagá-los.
        </p>
        <p>
          Ela cobre <strong>duas pessoas diferentes</strong>: quem contrata o
          FloatVideo (o cliente, que usa o painel) e quem visita o site onde o
          widget está instalado (o visitante). O que coletamos de cada uma é
          bem diferente.
        </p>
      </section>

      <section>
        <h2>1. Quem é responsável pelos dados</h2>
        <p>
          Em relação aos dados da <strong>conta do cliente</strong>, a Agência
          do Alê é a controladora: decidimos o que guardar e por quê.
        </p>
        <p>
          Em relação aos dados de <strong>visitantes e leads</strong> coletados
          pelo widget no site do cliente, o papel se inverte: quem decide o que
          perguntar e para que usar é o dono do site (controlador), e nós
          apenas processamos e guardamos em nome dele (operador, nos termos do
          art. 5º, VII da LGPD). O cliente é quem precisa ter a própria
          política de privacidade e a base legal para essa coleta.
        </p>
      </section>

      <section>
        <h2>2. Dados da conta do cliente</h2>
        <ul>
          <li>
            <strong>E-mail e senha</strong> — para você entrar no painel. A
            senha é guardada de forma cifrada pelo serviço de autenticação e
            nunca é visível para nós.
          </li>
          <li>
            <strong>Nome da conta e domínio do site</strong> — para o widget
            funcionar apenas no seu site, e não em qualquer outro.
          </li>
          <li>
            <strong>Vídeos, textos e configurações</strong> que você envia.
          </li>
          <li>
            <strong>E-mail e webhook de aviso</strong>, quando você escolhe ser
            notificado de novos leads.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Dados coletados pelo widget nos sites dos clientes</h2>
        <p>São dois tipos, e a diferença importa:</p>
        <p>
          <strong>Medição de uso, sem identificar ninguém.</strong> A cada
          passo (o balão apareceu, alguém abriu o vídeo, assistiu até certo
          ponto, clicou no botão, fechou), guardamos o tipo do evento, o
          endereço da página, a data e um identificador aleatório de sessão. Não
          coletamos nome, e-mail, IP nem qualquer dado que identifique a pessoa.
          O identificador de sessão é gerado no navegador, existe só enquanto a
          aba estiver aberta e serve para não contar a mesma visita duas vezes.
        </p>
        <p>
          <strong>Leads, quando a pessoa preenche um formulário.</strong> Aí
          sim há dados pessoais — nome, telefone e, no formulário completo,
          e-mail, assunto e mensagem —, além da página de onde vieram. Esses
          dados são fornecidos voluntariamente pelo visitante para falar com o
          dono do site, ficam disponíveis para ele no painel e, se ele
          configurou, são enviados ao e-mail ou ao sistema dele.
        </p>
        <p>
          Dados de formulário <strong>nunca</strong> são colocados na camada de
          dados da página (o <em>dataLayer</em>), porque ela é visível a
          qualquer script do site.
        </p>
      </section>

      <section>
        <h2>4. O que o widget guarda no navegador do visitante</h2>
        <p>
          O widget não usa cookies. Ele guarda dois valores no armazenamento
          local do próprio navegador:
        </p>
        <ul>
          <li>
            <strong>Vídeo fechado</strong> — quando alguém fecha o balão,
            registramos isso para não insistir na visita seguinte, pelo tempo
            que o dono do site configurar. Fica só no navegador da pessoa.
          </li>
          <li>
            <strong>Identificador de sessão</strong> — um número aleatório que
            some ao fechar a aba, usado para não contar a mesma visita várias
            vezes e para limitar envios repetidos de formulário.
          </li>
        </ul>
        <p>
          Quando o vídeo escolhido pelo cliente é do YouTube, o player do
          YouTube é carregado na página e pode gravar cookies próprios,
          conforme a política do Google. Nesse caso, cabe ao dono do site
          declarar isso na política dele.
        </p>
      </section>

      <section>
        <h2>5. Com quem os dados são compartilhados</h2>
        <p>
          Não vendemos dados e não os usamos para publicidade. Eles passam
          apenas pelos fornecedores necessários para o serviço existir:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — banco de dados e autenticação
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do painel e do widget
          </li>
          <li>
            <strong>Cloudflare</strong> — armazenamento e entrega dos vídeos
            enviados
          </li>
          <li>
            <strong>Resend</strong> — envio dos e-mails de aviso de novo lead
          </li>
          <li>
            <strong>Google</strong> — apenas quando o cliente usa vídeo do
            YouTube ou liga a integração com o Google Analytics / Tag Manager
          </li>
        </ul>
        <p>
          Parte desses serviços mantém servidores fora do Brasil, o que implica
          transferência internacional de dados, feita com base na execução do
          contrato com o cliente.
        </p>
      </section>

      <section>
        <h2>6. Integração com o Google Tag Manager</h2>
        <p>
          Se o cliente escolher conectar a conta do Google, pedimos permissão
          para <strong>listar os contêineres</strong> e{" "}
          <strong>criar a configuração</strong> do FloatVideo dentro do
          contêiner escolhido. O que criamos fica numa área de trabalho
          separada.
        </p>
        <p>
          A permissão de <strong>publicar</strong> só é pedida se o cliente
          marcar a opção &ldquo;publicar automaticamente&rdquo; antes de
          conectar. Sem essa marcação, ela não é sequer solicitada ao Google, e
          a publicação continua sendo um ato dele, pelo Tag Manager.
        </p>
        <p>
          A autorização recebida do Google vale por cerca de uma hora e é usada
          apenas durante a configuração.{" "}
          <strong>Não guardamos essa autorização em nosso banco de dados</strong>{" "}
          e não pedimos acesso de longa duração — se for preciso configurar de
          novo, é preciso autorizar de novo.
        </p>
      </section>

      <section>
        <h2>7. Este site</h2>
        <p>
          As páginas públicas do floatvideo.com.br (esta inclusive) usam o
          Google Tag Manager e ferramentas de medição de audiência, que podem
          gravar cookies no seu navegador para entender como o site é
          encontrado e navegado. Isso vale só para as páginas abertas ao
          público: <strong>o painel do cliente não recebe nenhuma tag de
          marketing</strong>, porque ali existem dados de conta e de leads.
        </p>
      </section>

      <section>
        <h2>8. Por quanto tempo guardamos</h2>
        <ul>
          <li>
            Dados da conta e conteúdos: enquanto a conta existir. Encerrada a
            conta, apagamos em até 30 dias.
          </li>
          <li>
            Eventos de uso e leads: ficam disponíveis ao cliente enquanto a
            conta dele existir, e podem ser apagados a qualquer momento a
            pedido dele.
          </li>
          <li>
            Registros que a lei exigir manter por prazo maior, apenas pelo
            prazo exigido.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Seus direitos</h2>
        <p>
          A LGPD garante a você confirmar se tratamos seus dados, acessá-los,
          corrigi-los, pedir a eliminação, a portabilidade e informações sobre
          compartilhamento, além de revogar consentimento.
        </p>
        <p>
          Para exercer qualquer um deles, escreva para{" "}
          <a href="mailto:contato@floatvideo.com.br">contato@floatvideo.com.br</a>
          . Respondemos em até 15 dias.
        </p>
        <p>
          Se você é <strong>visitante</strong> de um site que usa o FloatVideo e
          quer apagar um formulário que enviou, o caminho mais rápido é falar
          com o dono daquele site, que é quem controla esses dados. Se preferir
          falar conosco, encaminhamos o pedido a ele e cumprimos a exclusão.
        </p>
      </section>

      <section>
        <h2>10. Segurança</h2>
        <p>
          O acesso aos dados é restrito por regras no próprio banco, de modo que
          cada conta só enxerga o que é dela. As senhas são cifradas, o tráfego
          é criptografado e as chaves de acesso a serviços ficam apenas no
          servidor, nunca no navegador.
        </p>
        <p>
          Nenhum sistema é imune a incidentes. Havendo um que possa causar risco
          relevante, comunicaremos os clientes afetados e a autoridade
          competente, conforme a LGPD.
        </p>
      </section>

      <section>
        <h2>11. Mudanças nesta política</h2>
        <p>
          Se algo mudar de forma significativa, avisaremos por e-mail ou pelo
          painel antes de valer. A data no topo indica a última revisão.
        </p>
      </section>
    </PaginaLegal>
  );
}
