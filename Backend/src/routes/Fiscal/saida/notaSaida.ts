// Nota fiscal de saída (NFC-e 65 / NF-e 55) montada a partir da venda, independente de quem emite
// (provedor contratado ou direto na SEFAZ). Regras puras: sem banco, testáveis.

export type Modelo = '65' | '55';
export type Ambiente = 'HOMOLOGACAO' | 'PRODUCAO';

export class ErroFiscal extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface Emitente {
  cnpj: string; inscricaoEstadual: string | null; razaoSocial: string; nomeFantasia: string | null; crt: number;
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cep: string | null;
  municipio: string | null; codigoMunicipioIbge: string | null; uf: string | null; telefone: string | null; email: string | null;
}

export interface ConfigFiscal {
  ambiente: Ambiente; emissor: string; provedor: string | null; modoEmissao: 'FILA' | 'AUTOMATICA';
  serieNfce: number; proximoNumeroNfce: number; serieNfe: number; proximoNumeroNfe: number; cscId: string | null;
  csosnPadrao: string; cfopPadrao: string; csosnSt: string; cfopSt: string;
}

export const CONFIG_PADRAO: ConfigFiscal = {
  ambiente: 'HOMOLOGACAO', emissor: 'PROVEDOR', provedor: 'SIMULADO', modoEmissao: 'FILA',
  serieNfce: 1, proximoNumeroNfce: 1, serieNfe: 1, proximoNumeroNfe: 1, cscId: null,
  csosnPadrao: '102', cfopPadrao: '5102', csosnSt: '500', cfopSt: '5405',
};

/** Item da venda com os dados fiscais do cadastro. */
export interface ItemVendaFiscal {
  idItem: number; codigo: string; descricao: string; unidade: string; quantidade: number;
  precoTabela: number; totalItem: number; servico: boolean;
  ncm: string | null; cest: string | null; origem: number | null; csosn: string | null; cfop: string | null;
}
export interface PagamentoVenda { forma: string; valor: number; troco: number }
export interface Destinatario {
  documento: string | null; nome: string | null; email: string | null; celular: string | null;
  endereco?: { logradouro: string; numero: string; bairro: string; municipio: string; uf: string; cep: string } | null;
}

export interface ItemNota {
  numero: number; codigo: string; descricao: string; ncm: string; cest: string | null; cfop: string; csosn: string; origem: number;
  unidade: string; quantidade: number; valorUnitario: number; valorBruto: number; desconto: number; outros: number;
}
export interface PagamentoNota { tPag: string; descricao: string | null; valor: number; cartao: boolean }
export interface NotaSaida {
  modelo: Modelo; ambiente: Ambiente; serie: number; numero: number; emissao: string; naturezaOperacao: string;
  emitente: Emitente; destinatario: Destinatario | null; itens: ItemNota[]; pagamentos: PagamentoNota[]; troco: number;
  totais: { produtos: number; desconto: number; outros: number; total: number };
  informacoesComplementares: string;
}

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export const somenteDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');

// Formas de pagamento da venda -> tPag da SEFAZ (99 exige descrição)
const TPAG: Record<string, { tPag: string; descricao?: string; cartao?: boolean }> = {
  DINHEIRO: { tPag: '01' }, CREDITO: { tPag: '03', cartao: true }, DEBITO: { tPag: '04', cartao: true },
  PRAZO: { tPag: '05' }, PIX: { tPag: '17' }, TRANSFERENCIA: { tPag: '18' }, ADIANTAMENTO: { tPag: '99', descricao: 'Sinal/credito na loja' },
};
export const tPagDaForma = (forma: string) => TPAG[String(forma).toUpperCase()] || { tPag: '99', descricao: String(forma).slice(0, 60) };

/** Divide um valor entre pesos com centavos exatos (a sobra vai para o maior peso). */
export const ratear = (valor: number, pesos: number[]): number[] => {
  const total = pesos.reduce((a, p) => a + p, 0);
  if (!valor || total <= 0) return pesos.map(() => 0);
  const partes = pesos.map(p => r2((valor * p) / total));
  const sobra = r2(valor - partes.reduce((a, p) => a + p, 0));
  if (sobra) { const i = pesos.indexOf(Math.max(...pesos)); partes[i] = r2(partes[i] + sobra); }
  return partes;
};

/** Tributação do item: exceção do cadastro, senão o padrão da loja (item com CEST = substituição tributária). */
export const tributacaoDoItem = (item: Pick<ItemVendaFiscal, 'csosn' | 'cfop' | 'cest'>, cfg: ConfigFiscal) => {
  const temSt = somenteDigitos(item.cest).length === 7;
  const cfopItem = somenteDigitos(item.cfop);
  return {
    csosn: somenteDigitos(item.csosn) || (temSt ? cfg.csosnSt : cfg.csosnPadrao),
    // Só aceita CFOP de saída interna (5xxx) do cadastro; o de entrada (1xxx) não serve aqui
    cfop: /^5\d{3}$/.test(cfopItem) ? cfopItem : (temSt ? cfg.cfopSt : cfg.cfopPadrao),
  };
};

/** O que impede a emissão. Lista vazia = pode emitir. */
export const pendenciasDaNota = (emitente: Emitente | null, itens: ItemVendaFiscal[], modelo: Modelo, destinatario: Destinatario | null): string[] => {
  const p: string[] = [];
  if (!emitente) p.push('Dados da empresa emitente não cadastrados (Notas fiscais › Configuração).');
  else {
    if (somenteDigitos(emitente.cnpj).length !== 14) p.push('CNPJ da empresa inválido.');
    if (!emitente.inscricaoEstadual) p.push('Inscrição estadual da empresa não informada.');
    if (!emitente.logradouro || !emitente.numero || !emitente.bairro) p.push('Endereço da empresa incompleto.');
    if (somenteDigitos(emitente.cep).length !== 8) p.push('CEP da empresa inválido.');
    if (somenteDigitos(emitente.codigoMunicipioIbge).length !== 7) p.push('Código IBGE do município da empresa inválido.');
    if (!emitente.uf || !CODIGO_UF[emitente.uf.toUpperCase()]) p.push('UF da empresa inválida.');
  }
  const produtos = itens.filter(i => !i.servico);
  if (!produtos.length) p.push('Venda só de serviço: não tem NFC-e/NF-e de produto.');
  for (const i of produtos) {
    if (somenteDigitos(i.ncm).length !== 8) p.push(`Item "${i.descricao}" sem NCM válido.`);
    const cest = somenteDigitos(i.cest);
    if (cest && cest.length !== 7) p.push(`Item "${i.descricao}" com CEST inválido.`);
  }
  if (modelo === '55') {
    const doc = somenteDigitos(destinatario?.documento);
    if (doc.length !== 11 && doc.length !== 14) p.push('NF-e exige CPF/CNPJ do cliente.');
    if (!destinatario?.endereco) p.push('NF-e exige o endereço do cliente.');
  }
  return p;
};

/** Modelo sugerido: venda para CNPJ vai em NF-e (55); consumidor final em NFC-e (65). */
export const modeloSugerido = (documentoCliente: string | null): Modelo => (somenteDigitos(documentoCliente).length === 14 ? '55' : '65');

export const montarNota = (args: {
  modelo: Modelo; config: ConfigFiscal; emitente: Emitente; serie: number; numero: number; emissao: Date;
  itens: ItemVendaFiscal[]; pagamentos: PagamentoVenda[]; destinatario: Destinatario | null; idVenda: number;
}): NotaSaida => {
  const { modelo, config, emitente, itens, pagamentos, destinatario } = args;
  const pendencias = pendenciasDaNota(emitente, itens, modelo, destinatario);
  if (pendencias.length) throw new ErroFiscal(pendencias.join(' '));

  // Serviço não entra na nota de produto (é ISS); se houver, a nota cobre só os produtos
  const produtos = itens.filter(i => !i.servico);
  const linhas: ItemNota[] = produtos.map((i, n) => {
    const total = r2(i.totalItem);
    const bruto = r2(i.quantidade * i.precoTabela);
    // Preço de tabela com desconto; vendido acima da tabela vira o próprio preço praticado
    const [valorUnitario, valorBruto, desconto] = total <= bruto
      ? [i.precoTabela, bruto, r2(bruto - total)]
      : [Number((total / i.quantidade).toFixed(10)), total, 0];
    const trib = tributacaoDoItem(i, config);
    return {
      numero: n + 1, codigo: i.codigo || String(i.idItem), descricao: i.descricao.slice(0, 120), ncm: somenteDigitos(i.ncm),
      cest: somenteDigitos(i.cest) || null, cfop: trib.cfop, csosn: trib.csosn, origem: Number(i.origem) || 0,
      unidade: String(i.unidade || 'UN').toUpperCase().slice(0, 6), quantidade: i.quantidade, valorUnitario, valorBruto, desconto, outros: 0,
    };
  });
  const totalProdutos = r2(linhas.reduce((a, l) => a + l.valorBruto - l.desconto, 0));

  // Pago líquido de troco; se só parte da venda é produto, a nota recebe a parte proporcional de cada forma
  const totalVenda = r2(itens.reduce((a, i) => a + r2(i.totalItem), 0));
  const pago = pagamentos.map(p => ({ ...p, liquido: r2(p.valor - p.troco) })).filter(p => p.liquido > 0);
  const totalPago = r2(pago.reduce((a, p) => a + p.liquido, 0));
  const fator = totalVenda > 0 ? totalProdutos / totalVenda : 1;
  // Acréscimo pago além dos itens (ex.: juros do parcelamento) entra como "outras despesas" rateado nos itens
  const acrescimo = r2(Math.max(0, totalPago - totalVenda) * fator);
  ratear(acrescimo, linhas.map(l => l.valorBruto - l.desconto)).forEach((v, i) => { linhas[i].outros = v; });
  const totalNota = r2(totalProdutos + acrescimo);

  const valoresPag = ratear(totalNota, pago.map(p => p.liquido));
  const troco = r2(pagamentos.reduce((a, p) => a + Number(p.troco || 0), 0));
  const formas: PagamentoNota[] = pago.map((p, i) => {
    const t = tPagDaForma(p.forma);
    // O troco é informado sobre o dinheiro recebido
    const valor = r2(valoresPag[i] + (p.forma === 'DINHEIRO' ? Number(p.troco || 0) : 0));
    return { tPag: t.tPag, descricao: t.descricao || null, valor, cartao: Boolean(t.cartao) };
  });
  if (!formas.length) formas.push({ tPag: '90', descricao: null, valor: 0, cartao: false }); // sem pagamento

  return {
    modelo, ambiente: config.ambiente, serie: args.serie, numero: args.numero, emissao: args.emissao.toISOString(),
    naturezaOperacao: 'VENDA DE MERCADORIA', emitente, destinatario, itens: linhas, pagamentos: formas, troco,
    totais: { produtos: r2(linhas.reduce((a, l) => a + l.valorBruto, 0)), desconto: r2(linhas.reduce((a, l) => a + l.desconto, 0)), outros: acrescimo, total: totalNota },
    informacoesComplementares: `Venda N ${args.idVenda}`,
  };
};

export const CODIGO_UF: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17', MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26',
  AL: '27', SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41', SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

/** Dígito verificador da chave de acesso (módulo 11, pesos 2 a 9 da direita para a esquerda). */
export const digitoChave = (chave43: string): number => {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

/** Chave de acesso de 44 dígitos (usada pelo emissor direto; o provedor gera a dele). */
export const gerarChaveAcesso = (a: { uf: string; emissao: Date; cnpj: string; modelo: Modelo; serie: number; numero: number; codigoNumerico: number; tipoEmissao?: number }) => {
  const cUF = CODIGO_UF[a.uf.toUpperCase()];
  if (!cUF) throw new ErroFiscal(`UF inválida: ${a.uf}`);
  const aamm = `${String(a.emissao.getFullYear()).slice(2)}${String(a.emissao.getMonth() + 1).padStart(2, '0')}`;
  const base = cUF + aamm + somenteDigitos(a.cnpj).padStart(14, '0') + a.modelo + String(a.serie).padStart(3, '0')
    + String(a.numero).padStart(9, '0') + String(a.tipoEmissao ?? 1) + String(a.codigoNumerico).padStart(8, '0');
  if (base.length !== 43) throw new ErroFiscal('Dados insuficientes para a chave de acesso.');
  return base + digitoChave(base);
};
