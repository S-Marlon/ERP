// Entrada sem nota (compra avulsa): monta um XML no formato da NF-e para os itens digitados, e o resto da entrada
// (classificação, custo, staging, estoque na aprovação) segue igual a uma nota de verdade.
// A chave é interna: modelo 99 (não existe na SEFAZ), série 999 — assim nunca colide com uma chave real.

/** Fornecedor genérico das compras sem nota (CNPJ todo zero). */
export const CNPJ_COMPRA_AVULSA = '00000000000000';
export const NOME_COMPRA_AVULSA = 'COMPRA AVULSA (SEM NOTA)';
const MODELO_SEM_NOTA = '99';
const SERIE_SEM_NOTA = '999';

export interface ItemSemNota {
  /** Número da linha na entrada (mantido na edição: é por ele que a conferência salva volta para a linha) */
  nItem?: number;
  descricao: string;
  codigo?: string;
  ean?: string;
  ncm?: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
}

export interface DadosSemNota {
  fornecedor: { cnpj: string; nome: string; uf?: string };
  data: Date;
  /** Número interno da entrada (vai na chave e no "número da nota") */
  numero: number;
  observacao?: string;
  frete?: number;
  desconto?: number;
  itens: ItemSemNota[];
}

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const dec = (v: number, casas = 2) => (Number(v) || 0).toFixed(casas);
const so = (v: string | undefined) => String(v || '').replace(/\D/g, '');
const esc = (t: string | undefined) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));

const UF_CODIGO: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17', MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26',
  AL: '27', SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41', SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

/** Dígito verificador da chave (módulo 11, pesos 2 a 9 da direita para a esquerda). */
export const dvChave = (chave43: string) => {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
};

export const chaveSemNota = (cnpj: string, data: Date, numero: number, uf = 'SP') => {
  const aamm = `${String(data.getFullYear()).slice(2)}${String(data.getMonth() + 1).padStart(2, '0')}`;
  const nNF = String(Math.abs(Math.trunc(numero)) % 1e9).padStart(9, '0');
  const cNF = nNF.slice(-8);
  const base = `${UF_CODIGO[uf] || '35'}${aamm}${so(cnpj).padStart(14, '0').slice(-14)}${MODELO_SEM_NOTA}${SERIE_SEM_NOTA}${nNF}1${cNF}`;
  return base + dvChave(base);
};

/** A chave é de uma entrada sem nota (modelo 99)? */
export const ehEntradaSemNota = (chave: string | undefined | null) => so(chave ?? undefined).length === 44 && so(chave ?? undefined).slice(20, 22) === MODELO_SEM_NOTA;

/** Erros de preenchimento (vazio = pode gerar). */
export const validarSemNota = (d: DadosSemNota): string[] => {
  const erros: string[] = [];
  if (!so(d.fornecedor.cnpj)) erros.push('Escolha o fornecedor.');
  if (!d.itens.length) erros.push('Adicione ao menos um item.');
  d.itens.forEach((i, n) => {
    if (!String(i.descricao || '').trim()) erros.push(`Item ${n + 1}: falta a descrição.`);
    if (!(Number(i.quantidade) > 0)) erros.push(`Item ${n + 1}: quantidade precisa ser maior que zero.`);
    if (!(Number(i.custoUnitario) >= 0)) erros.push(`Item ${n + 1}: custo inválido.`);
    if (i.ncm && so(i.ncm).length !== 8) erros.push(`Item ${n + 1}: NCM tem 8 dígitos.`);
  });
  return erros;
};

/** Rateia um valor pelos pesos, com o resto de centavos na última linha. */
const ratear = (valor: number, pesos: number[]) => {
  const total = pesos.reduce((a, b) => a + b, 0);
  if (!valor || total <= 0) return pesos.map(() => 0);
  const partes = pesos.map(p => r2((valor * p) / total));
  partes[partes.length - 1] = r2(valor - partes.slice(0, -1).reduce((a, b) => a + b, 0));
  return partes;
};

const dataHora = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}-03:00`;
};

export const montarXmlSemNota = (d: DadosSemNota) => {
  const uf = d.fornecedor.uf || 'SP';
  const chave = chaveSemNota(d.fornecedor.cnpj, d.data, d.numero, uf);
  const nNF = String(Math.abs(Math.trunc(d.numero)) % 1e9);
  const produtos = d.itens.map(i => r2(Number(i.quantidade) * Number(i.custoUnitario)));
  const fretes = ratear(r2(d.frete || 0), produtos);
  const descontos = ratear(r2(d.desconto || 0), produtos);
  const vProd = r2(produtos.reduce((a, b) => a + b, 0));
  const vFrete = r2(fretes.reduce((a, b) => a + b, 0));
  const vDesc = r2(descontos.reduce((a, b) => a + b, 0));
  const vNF = r2(vProd + vFrete - vDesc);

  // Linhas que já existiam mantêm o número; as novas continuam a sequência
  let proximo = Math.max(0, ...d.itens.map(i => Number(i.nItem) || 0));
  const numeros = d.itens.map(i => (Number(i.nItem) > 0 ? Number(i.nItem) : ++proximo));

  const dets = d.itens.map((i, n) => {
    const un = esc(String(i.unidade || 'UN').toUpperCase().slice(0, 6));
    const ean = so(i.ean) || 'SEM GTIN';
    return `<det nItem="${numeros[n]}"><prod>`
      + `<cProd>${esc(i.codigo?.trim() || `AV${nNF}-${numeros[n]}`)}</cProd><cEAN>${ean}</cEAN>`
      + `<xProd>${esc(String(i.descricao).trim().toUpperCase())}</xProd><NCM>${so(i.ncm)}</NCM><CFOP>1102</CFOP>`
      + `<uCom>${un}</uCom><qCom>${dec(i.quantidade, 4)}</qCom><vUnCom>${dec(i.custoUnitario, 10)}</vUnCom><vProd>${dec(produtos[n])}</vProd>`
      + `<cEANTrib>${ean}</cEANTrib><uTrib>${un}</uTrib><qTrib>${dec(i.quantidade, 4)}</qTrib><vUnTrib>${dec(i.custoUnitario, 10)}</vUnTrib>`
      + (fretes[n] ? `<vFrete>${dec(fretes[n])}</vFrete>` : '')
      + (descontos[n] ? `<vDesc>${dec(descontos[n])}</vDesc>` : '')
      + `<indTot>1</indTot></prod>`
      + `<imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det>`;
  }).join('');

  const obs = ['ENTRADA SEM NOTA (COMPRA AVULSA)', d.observacao?.trim()].filter(Boolean).join(' - ');
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00">`
    + `<ide><cUF>${UF_CODIGO[uf] || '35'}</cUF><cNF>${chave.slice(35, 43)}</cNF><natOp>COMPRA SEM NOTA</natOp><mod>${MODELO_SEM_NOTA}</mod>`
    + `<serie>${SERIE_SEM_NOTA}</serie><nNF>${nNF}</nNF><dhEmi>${dataHora(d.data)}</dhEmi><tpNF>0</tpNF><idDest>1</idDest>`
    + `<tpEmis>1</tpEmis><cDV>${chave.slice(-1)}</cDV><tpAmb>1</tpAmb><finNFe>1</finNFe><indFinal>0</indFinal><indPres>1</indPres></ide>`
    + `<emit><CNPJ>${so(d.fornecedor.cnpj).padStart(14, '0')}</CNPJ><xNome>${esc(d.fornecedor.nome)}</xNome><xFant>${esc(d.fornecedor.nome)}</xFant>`
    + `<enderEmit><UF>${esc(uf)}</UF><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><CRT>1</CRT></emit>`
    + dets
    + `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vBCST>0.00</vBCST><vST>0.00</vST><vProd>${dec(vProd)}</vProd>`
    + `<vFrete>${dec(vFrete)}</vFrete><vSeg>0.00</vSeg><vDesc>${dec(vDesc)}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI>`
    + `<vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${dec(vNF)}</vNF></ICMSTot></total>`
    + `<transp><modFrete>${vFrete > 0 ? '0' : '9'}</modFrete></transp>`
    + `<infAdic><infCpl>${esc(obs)}</infCpl></infAdic>`
    + `</infNFe></NFe></nfeProc>`;
};

// ---------------------------------------------------------------- Adicionar itens numa entrada sem nota já aberta
const PREFIXO_OBS = 'ENTRADA SEM NOTA (COMPRA AVULSA)';

/** O que a tela já tem da entrada (a nota lida do XML interno). */
export interface EntradaSemNotaLida {
  numero: string | number;
  dataEmissao: string;
  emitente: { cnpj?: string; nome?: string; uf?: string };
  informacoesAdicionais?: { infCpl?: string } | null;
  totais?: { icmsTot?: { vFrete?: string; vDesc?: string } } | null;
  produtos: Array<{ nItem?: string; prod: { xProd: string; cProd: string; cEAN?: string; NCM?: string; uCom: string; qCom: string; vUnCom: string } }>;
}

/**
 * Remonta os dados da entrada a partir do XML lido: com eles + itens novos, o XML gerado tem a MESMA chave
 * (mesmo fornecedor, mês e número), então a staging reconhece o lote e mantém o que já foi feito nas linhas antigas.
 */
export const dadosDaEntradaSemNota = (n: EntradaSemNotaLida): DadosSemNota => {
  const [d, h] = String(n.dataEmissao || '').split('T');
  const [ano, mes, dia] = (d || '').split('-').map(Number);
  const [hora, min, seg] = String(h || '').slice(0, 8).split(':').map(Number);
  const obs = String(n.informacoesAdicionais?.infCpl || '').replace(PREFIXO_OBS, '').replace(/^\s*-\s*/, '').trim();
  return {
    fornecedor: { cnpj: so(n.emitente?.cnpj), nome: n.emitente?.nome || NOME_COMPRA_AVULSA, uf: n.emitente?.uf || undefined },
    data: ano ? new Date(ano, (mes || 1) - 1, dia || 1, hora || 0, min || 0, seg || 0) : new Date(),
    numero: Number(n.numero) || 0,
    observacao: obs || undefined,
    frete: Number(n.totais?.icmsTot?.vFrete) || 0,
    desconto: Number(n.totais?.icmsTot?.vDesc) || 0,
    itens: (n.produtos || []).map(p => ({
      nItem: Number(p.nItem) || undefined,
      descricao: p.prod.xProd,
      codigo: p.prod.cProd,
      ean: p.prod.cEAN && p.prod.cEAN !== 'SEM GTIN' ? p.prod.cEAN : undefined,
      ncm: p.prod.NCM || undefined,
      unidade: p.prod.uCom,
      quantidade: Number(p.prod.qCom) || 0,
      custoUnitario: Number(p.prod.vUnCom) || 0,
    })),
  };
};

/**
 * Linhas mudadas na edição da lista (por nItem). Quantidade, custo, descrição ou códigos mudaram: a linha volta para
 * conferência. Unidade mudou: também perde a classificação (unidade de venda e preço dependem dela).
 */
export const alteracoesDaLista = (antes: ItemSemNota[], depois: ItemSemNota[]) => {
  const n = (v: unknown) => String(v ?? '').trim().toUpperCase();
  const num = (v: unknown) => Math.round((Number(v) || 0) * 10000);
  const anteriores = new Map(antes.filter(i => i.nItem).map(i => [Number(i.nItem), i]));
  const alteracoes: Record<string, { reconferir: boolean; reclassificar: boolean }> = {};
  for (const i of depois) {
    const a = i.nItem ? anteriores.get(Number(i.nItem)) : undefined;
    if (!a) continue;
    const reclassificar = n(a.unidade) !== n(i.unidade);
    const reconferir = reclassificar || num(a.quantidade) !== num(i.quantidade) || num(a.custoUnitario) !== num(i.custoUnitario)
      || n(a.descricao) !== n(i.descricao) || n(a.codigo) !== n(i.codigo) || n(a.ean) !== n(i.ean) || n(a.ncm).replace(/\D/g, '') !== n(i.ncm).replace(/\D/g, '');
    if (reconferir) alteracoes[String(i.nItem)] = { reconferir, reclassificar };
  }
  return alteracoes;
};
