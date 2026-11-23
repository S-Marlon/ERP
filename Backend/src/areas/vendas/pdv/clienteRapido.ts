// Cliente do balcão cadastrado no PDV só com nome e telefone (para vender a prazo sem o cadastro completo). Regras
// puras: valida o nome, limpa e formata o telefone como os outros contatos do cadastro ("(11) 98888-7777").
import { ErroVenda } from './vendaPdv';

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** "(11) 98888-7777" (celular) ou "(11) 4411-2233" (fixo). */
export const formatarTelefone = (digitos: string) =>
  digitos.length === 11
    ? `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
    : `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;

export const validarClienteRapido = (b: any) => {
  const nome = String(b?.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 255);
  if (nome.length < 3) throw new ErroVenda('Informe o nome do cliente (ao menos 3 letras).');
  let telefone = soDigitos(b?.telefone);
  if (telefone.startsWith('55') && telefone.length >= 12) telefone = telefone.slice(2);   // +55 colado
  if (telefone.length !== 10 && telefone.length !== 11) throw new ErroVenda('Telefone com DDD: 10 ou 11 números (ex.: 11 98888-7777).');
  // No banco só os números (como os outros cadastros); a tela formata
  return { nome, digitos: telefone, telefone: formatarTelefone(telefone), celular: telefone.length === 11 };
};
