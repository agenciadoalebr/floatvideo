import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Termos de Uso — FloatVideo",
  description:
    "Condições de uso do FloatVideo: o que o serviço faz, o que cabe a cada parte e como encerrar.",
};

export default function TermosPage() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizadoEm="2 de setembro de 2026">
      <section>
        <p>
          Estes termos valem entre a <strong>Agência do Alê</strong>, que
          oferece o FloatVideo, e você, que contrata o serviço. Ao criar uma
          conta, você concorda com eles.
        </p>
      </section>

      <section>
        <h2>1. O que o serviço faz</h2>
        <p>
          O FloatVideo exibe um vídeo flutuante no seu site, com botão de ação
          (WhatsApp, formulário, link ou compra), e mostra num painel as
          métricas e os leads gerados por ele. O acesso é por assinatura mensal,
          no plano que você escolher.
        </p>
      </section>

      <section>
        <h2>2. Conta e acesso</h2>
        <ul>
          <li>
            A criação de conta hoje é por convite. Você é responsável por manter
            sua senha em segurança e pelo que for feito com ela.
          </li>
          <li>
            Você pode convidar pessoas da sua equipe. Elas entram com permissão
            de edição: mexem em vídeos e configurações, mas não convidam nem
            removem ninguém, e não alteram o plano.
          </li>
          <li>
            Cada plano define quantos sites a conta pode ter. Vídeos e
            visualizações não têm limite.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. O que é seu e o que é nosso</h2>
        <p>
          Os vídeos, textos, imagens e dados que você envia continuam seus. Você
          nos autoriza a hospedar e exibir esse conteúdo apenas para o serviço
          funcionar.
        </p>
        <p>
          O software, o painel e o widget continuam nossos. Nada aqui transfere
          propriedade sobre eles.
        </p>
      </section>

      <section>
        <h2>4. Suas responsabilidades</h2>
        <ul>
          <li>
            Ter direito sobre o que publica — vídeo, música, imagem e uso da
            imagem das pessoas que aparecem.
          </li>
          <li>
            Instalar o widget apenas em sites que você administra.
          </li>
          <li>
            Cumprir a LGPD quanto aos dados que coletar pelo formulário: ter
            base legal, informar as pessoas na sua própria política de
            privacidade e atender aos pedidos delas. Nesses dados, você é o
            controlador e nós somos o operador.
          </li>
          <li>
            Não usar o serviço para conteúdo ilegal, enganoso, ofensivo ou que
            viole direito de terceiros.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Pagamento</h2>
        <p>
          A assinatura é mensal e cobrada de forma antecipada. Preços e limites
          são os informados na página de planos no momento da contratação.
          Havendo reajuste, avisaremos com pelo menos 30 dias de antecedência, e
          você pode encerrar antes que ele valha.
        </p>
        <p>
          Em caso de falta de pagamento, o acesso pode ser suspenso após aviso.
          Seus dados ficam guardados por 30 dias depois disso, para você
          regularizar sem perder nada.
        </p>
      </section>

      <section>
        <h2>6. Cancelamento</h2>
        <p>
          Você pode cancelar quando quiser, e o serviço segue até o fim do
          período já pago — sem multa e sem fidelidade. Pedindo o cancelamento
          em até 7 dias da primeira contratação, devolvemos o valor integral,
          conforme o Código de Defesa do Consumidor.
        </p>
        <p>
          Encerrada a conta, apagamos vídeos, métricas e leads em até 30 dias.
          Exporte o que quiser guardar antes disso.
        </p>
      </section>

      <section>
        <h2>7. Disponibilidade</h2>
        <p>
          Trabalhamos para manter o serviço no ar o tempo todo, mas ele depende
          de fornecedores de hospedagem e de entrega de conteúdo, e pode passar
          por interrupções ou manutenções. Não prometemos disponibilidade
          ininterrupta.
        </p>
        <p>
          O widget é carregado depois da sua página e falha em silêncio: se o
          serviço estiver indisponível, o vídeo não aparece,{" "}
          <strong>mas o seu site continua funcionando normalmente</strong>.
        </p>
      </section>

      <section>
        <h2>8. Limites de responsabilidade</h2>
        <p>
          O FloatVideo é uma ferramenta de exibição e medição. Não garantimos
          aumento de vendas, de conversão ou qualquer outro resultado
          comercial — isso depende do seu vídeo, da sua oferta e do seu público.
        </p>
        <p>
          Salvo dolo ou culpa grave, nossa responsabilidade se limita ao valor
          pago por você nos 12 meses anteriores ao fato.
        </p>
      </section>

      <section>
        <h2>9. Mudanças no serviço e nestes termos</h2>
        <p>
          O produto evolui: recursos podem ser acrescentados, alterados ou
          removidos. Mudanças relevantes nestes termos serão avisadas por e-mail
          ou pelo painel com antecedência, e continuar usando o serviço significa
          concordar com elas.
        </p>
      </section>

      <section>
        <h2>10. Foro e contato</h2>
        <p>
          Estes termos seguem a lei brasileira. Fica eleito o foro da comarca de
          São Paulo/SP para o que não for resolvido de forma amigável.
        </p>
        <p>
          Dúvidas:{" "}
          <a href="mailto:contato@floatvideo.com.br">contato@floatvideo.com.br</a>
          .
        </p>
      </section>
    </PaginaLegal>
  );
}
