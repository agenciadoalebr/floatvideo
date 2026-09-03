/**
 * Máscara e conferência de CPF, CNPJ e telefone.
 *
 * Vale nos dois lados: a máscara é conforto de quem digita, mas quem
 * recusa documento inválido é o servidor — senão bastaria abrir o
 * console do navegador para passar por cima.
 */

/** Só o que interessa: letras e dígitos, em maiúscula. */
export function limparDocumento(valor: string) {
  return (valor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function limparNumeros(valor: string) {
  return (valor ?? "").replace(/\D/g, "");
}

/** 000.000.000-00 ou 00.000.000/0000-00, conforme o tamanho. */
export function mascararDocumento(valor: string) {
  const cru = limparDocumento(valor).slice(0, 14);

  // Até 11 caracteres tratamos como CPF; a partir daí, CNPJ. Quem digita
  // um CNPJ passa pelo formato de CPF no meio do caminho, e tudo bem:
  // o campo se reorganiza sozinho quando o 12º caractere chega.
  if (cru.length <= 11) {
    return cru
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return cru
    .replace(/^(.{2})(.)/, "$1.$2")
    .replace(/^(.{2})\.(.{3})(.)/, "$1.$2.$3")
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, "$1.$2.$3/$4")
    .replace(/^(.{2})\.(.{3})\.(.{3})\/(.{4})(.)/, "$1.$2.$3/$4-$5");
}

/** (11) 90000-0000, aceitando também o fixo de 8 dígitos. */
export function mascararTelefone(valor: string) {
  const cru = limparNumeros(valor).slice(0, 11);

  if (cru.length <= 2) return cru.replace(/^(\d{1,2})/, "($1");
  if (cru.length <= 6) return cru.replace(/^(\d{2})(\d{1,4})/, "($1) $2");
  if (cru.length <= 10) {
    return cru.replace(/^(\d{2})(\d{4})(\d{1,4})/, "($1) $2-$3");
  }
  return cru.replace(/^(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
}

export function telefoneValido(valor: string) {
  const cru = limparNumeros(valor);
  // DDD válido começa em 11; celular tem 9 dígitos e começa com 9.
  if (cru.length !== 10 && cru.length !== 11) return false;
  if (Number(cru.slice(0, 2)) < 11) return false;
  if (cru.length === 11 && cru[2] !== "9") return false;
  return true;
}

/** Dígitos verificadores do CPF. */
function cpfValido(cpf: string) {
  if (cpf.length !== 11) return false;
  // 111.111.111-11 e afins passam na conta, mas não existem.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  for (const [ate, posicao] of [
    [9, 10],
    [10, 11],
  ]) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (posicao - i);
    const resto = (soma * 10) % 11 % 10;
    if (resto !== Number(cpf[ate])) return false;
  }

  return true;
}

/**
 * Dígitos verificadores do CNPJ.
 *
 * A conta usa o valor ASCII menos 48 de cada caractere, e não o dígito.
 * Para o CNPJ numérico dá exatamente no mesmo; a diferença aparece no
 * CNPJ alfanumérico, que a Receita passou a emitir — recusá-lo seria
 * barrar empresa nova na porta.
 */
function cnpjValido(cnpj: string) {
  if (cnpj.length !== 14) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  // Os dois últimos são sempre numéricos, mesmo no formato novo.
  if (!/^\d{2}$/.test(cnpj.slice(12))) return false;

  const valor = (c: string) => c.charCodeAt(0) - 48;

  for (const ate of [12, 13]) {
    let soma = 0;
    let peso = ate - 7;
    for (let i = 0; i < ate; i++) {
      soma += valor(cnpj[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    const digito = resto < 2 ? 0 : 11 - resto;
    if (digito !== Number(cnpj[ate])) return false;
  }

  return true;
}

/** Aceita CPF (11) ou CNPJ (14) e confere os dígitos verificadores. */
export function documentoValido(valor: string) {
  const cru = limparDocumento(valor);
  if (cru.length === 11) return /^\d{11}$/.test(cru) && cpfValido(cru);
  if (cru.length === 14) return cnpjValido(cru);
  return false;
}
