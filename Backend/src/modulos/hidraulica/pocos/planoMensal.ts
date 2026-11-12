// Obras de poços › plano mensal: o preço de cada plano oferecido (nível) para um cliente, a partir dos custos da empresa
// (visita, deslocamento, limpeza, monitoramento, reserva da bomba) e do poço (profundidade, potência da bomba, quantos
// poços). O plano é viável quando a empresa lucra a margem mínima e o cliente paga menos do que pagaria avulso.
// Regras puras (sem banco), com teste.
import { ErroObra } from './obras';

export interface CustosPlano {
  custoHoraEquipe: number; horasVisita: number; horasPor100m: number; kmMedio: number; custoKm: number; materialVisita: number;
  custoLimpeza: number; custoMonitoramentoMes: number; aparelhoValor: number; aparelhoMeses: number;
  bombaPrecoPorCv: number; bombaVidaAnos: number; precoVisitaAvulsa: number | null;
  impostosPct: number; taxaCobrancaPct: number; inadimplenciaPct: number; margemPct: number; margemMinimaPct: number; arredondarPara: number;
}
export interface NivelPlano {
  nome: string; descricao: string | null; visitasAno: number; limpezaACadaMeses: number | null; chamadosAno: number;
  descontoPecasPct: number; monitoramento: boolean; reservaBombaPct: number; fidelidadeMeses: number; ordem: number; ativo: boolean;
}
/** O que pesa no preço: o poço mais fundo, a bomba mais forte e quantos poços entram no plano. */
export interface PocoDoPlano { profundidadeM: number | null; potenciaCv: number | null; pocos: number }

/** Valores padrão (os mesmos do script do banco), usados enquanto a loja não grava os dela. */
export const CUSTOS_PADRAO: CustosPlano = {
  custoHoraEquipe: 80, horasVisita: 3, horasPor100m: 1.5, kmMedio: 60, custoKm: 1.5, materialVisita: 50, custoLimpeza: 800,
  custoMonitoramentoMes: 25, aparelhoValor: 900, aparelhoMeses: 36, bombaPrecoPorCv: 1500, bombaVidaAnos: 6, precoVisitaAvulsa: null,
  impostosPct: 0.06, taxaCobrancaPct: 0.03, inadimplenciaPct: 0.03, margemPct: 0.25, margemMinimaPct: 0.1, arredondarPara: 5,
};
/** Sem profundidade nem bomba informadas, a conta usa um poço comum. */
export const POCO_PADRAO = { profundidadeM: 80, potenciaCv: 1.5 };

const r2 = (v: number) => Math.round(v * 100) / 100;

const numero = (v: unknown, nome: string, min: number, max: number) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (v === null || v === undefined || String(v).trim() === '' || !Number.isFinite(n)) throw new ErroObra(`${nome}: informe um número.`);
  if (n < min || n > max) throw new ErroObra(`${nome}: entre ${String(min).replace('.', ',')} e ${String(max).replace('.', ',')}.`);
  return n;
};
const pct = (v: unknown, nome: string, max = 0.9) => numero(v, nome, 0, max);

/** Confere os custos (percentuais de 0 a 1). As deduções mais a margem precisam deixar ao menos 5% do preço. */
export const validarCustos = (b: any): CustosPlano => {
  const c: CustosPlano = {
    custoHoraEquipe: numero(b?.custoHoraEquipe, 'Custo por hora da equipe', 0, 10000),
    horasVisita: numero(b?.horasVisita, 'Horas da visita', 0, 48),
    horasPor100m: numero(b?.horasPor100m, 'Horas a mais por 100 m', 0, 48),
    kmMedio: numero(b?.kmMedio, 'Km de ida e volta', 0, 5000),
    custoKm: numero(b?.custoKm, 'Custo por km', 0, 100),
    materialVisita: numero(b?.materialVisita, 'Material por visita', 0, 100000),
    custoLimpeza: numero(b?.custoLimpeza, 'Custo da limpeza', 0, 1000000),
    custoMonitoramentoMes: numero(b?.custoMonitoramentoMes, 'Monitoramento por mês', 0, 100000),
    aparelhoValor: numero(b?.aparelhoValor, 'Valor do aparelho', 0, 1000000),
    aparelhoMeses: Math.round(numero(b?.aparelhoMeses, 'Meses para pagar o aparelho', 1, 240)),
    bombaPrecoPorCv: numero(b?.bombaPrecoPorCv, 'Preço da bomba por CV', 0, 1000000),
    bombaVidaAnos: numero(b?.bombaVidaAnos, 'Vida útil da bomba', 0.5, 50),
    precoVisitaAvulsa: b?.precoVisitaAvulsa === null || b?.precoVisitaAvulsa === undefined || String(b.precoVisitaAvulsa).trim() === ''
      ? null : numero(b.precoVisitaAvulsa, 'Preço da visita avulsa', 0, 1000000),
    impostosPct: pct(b?.impostosPct, 'Impostos'), taxaCobrancaPct: pct(b?.taxaCobrancaPct, 'Taxa de cobrança'),
    inadimplenciaPct: pct(b?.inadimplenciaPct, 'Inadimplência'), margemPct: pct(b?.margemPct, 'Margem desejada'),
    margemMinimaPct: pct(b?.margemMinimaPct, 'Margem mínima'),
    arredondarPara: numero(b?.arredondarPara, 'Arredondar para', 0, 1000),
  };
  if (c.margemMinimaPct > c.margemPct) throw new ErroObra('A margem mínima não pode ser maior que a desejada.');
  if (divisor(c) < 0.05) throw new ErroObra('Impostos, cobrança, inadimplência e margem somam 95% ou mais do preço: não sobra para os custos.');
  return c;
};

/** Confere um plano oferecido. */
export const validarNivel = (b: any): NivelPlano => {
  const nome = String(b?.nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!nome) throw new ErroObra('Dê um nome ao plano.');
  const limpeza = b?.limpezaACadaMeses === null || b?.limpezaACadaMeses === undefined || String(b.limpezaACadaMeses).trim() === '' || Number(b.limpezaACadaMeses) === 0
    ? null : Math.round(numero(b.limpezaACadaMeses, 'Limpeza a cada (meses)', 1, 120));
  const n: NivelPlano = {
    nome, descricao: String(b?.descricao ?? '').trim().slice(0, 255) || null,
    visitasAno: Math.round(numero(b?.visitasAno ?? 0, 'Visitas por ano', 0, 24)), limpezaACadaMeses: limpeza,
    chamadosAno: Math.round(numero(b?.chamadosAno ?? 0, 'Emergências por ano', 0, 24)),
    descontoPecasPct: pct(b?.descontoPecasPct ?? 0, 'Desconto em peças', 0.9), monitoramento: !!b?.monitoramento,
    reservaBombaPct: pct(b?.reservaBombaPct ?? 0, 'Troca da bomba coberta', 1), fidelidadeMeses: Math.round(numero(b?.fidelidadeMeses ?? 12, 'Fidelidade (meses)', 0, 120)),
    ordem: Math.round(Number(b?.ordem) || 0), ativo: b?.ativo === undefined ? true : !!b.ativo,
  };
  if (!n.visitasAno && !n.limpezaACadaMeses && !n.chamadosAno && !n.monitoramento && !n.reservaBombaPct) throw new ErroObra('O plano precisa incluir alguma coisa.');
  return n;
};

/** Parte do preço que sobra depois de impostos, cobrança, inadimplência e margem (o preço = custo ÷ isso). */
export const divisor = (c: Pick<CustosPlano, 'impostosPct' | 'taxaCobrancaPct' | 'inadimplenciaPct' | 'margemPct'>) =>
  Math.round((1 - c.impostosPct - c.taxaCobrancaPct - c.inadimplenciaPct - c.margemPct) * 10000) / 10000;

/**
 * Custo de uma ida ao cliente: horas da equipe (mais tempo em poço fundo, para tirar e descer a bomba) e material para
 * cada poço; o deslocamento uma vez só.
 */
export const custoVisita = (c: CustosPlano, profundidadeM: number | null, pocos = 1) => {
  const prof = profundidadeM ?? POCO_PADRAO.profundidadeM;
  const horas = c.horasVisita + c.horasPor100m * (prof / 100);
  return r2((horas * c.custoHoraEquipe + c.materialVisita) * Math.max(1, pocos) + c.kmMedio * c.custoKm);
};

/** Preço de uma visita avulsa: o informado, a média das manutenções da empresa ou o custo com a margem. */
export const visitaAvulsa = (c: CustosPlano, mediaDaEmpresa: number | null, profundidadeM: number | null) =>
  c.precoVisitaAvulsa || mediaDaEmpresa || r2(custoVisita(c, profundidadeM) / divisor(c));

export interface LinhaCusto { item: string; anual: number }
export interface PrecoPlano {
  precoMensal: number; custoMensal: number; custos: LinhaCusto[];
  /** O que fica com a empresa por mês depois de impostos, cobrança e inadimplência, menos os custos. */
  lucroMensal: number; margemReal: number;
  /** Quanto o cliente gastaria no ano pagando o mesmo avulso, e quanto economiza com o plano (negativo = paga mais). */
  avulsoAnual: number; economiaAnual: number; economiaPct: number | null;
  /** Sem o preço da visita avulsa (nem média das manutenções), a comparação usa o custo com a margem e não reprova o plano. */
  comparacaoEstimada: boolean;
  viavel: boolean; avisos: string[];
}

const arredondar = (v: number, passo: number) => (passo > 0 ? Math.round(v / passo + 1e-9) * passo : r2(v));

/** Preço e viabilidade de um plano para o poço do cliente. */
export const precoDoPlano = (c: CustosPlano, n: NivelPlano, p: PocoDoPlano, mediaVisitaEmpresa: number | null = null): PrecoPlano => {
  const pocos = Math.max(1, p.pocos || 1);
  const prof = p.profundidadeM ?? POCO_PADRAO.profundidadeM;
  const cv = p.potenciaCv ?? POCO_PADRAO.potenciaCv;
  const visita = custoVisita(c, prof, pocos);
  const limpezasAno = n.limpezaACadaMeses ? 12 / n.limpezaACadaMeses : 0;
  const custos: LinhaCusto[] = [
    { item: `${n.visitasAno} visita(s) preventiva(s) por ano`, anual: r2(n.visitasAno * visita) },
    { item: `Limpeza a cada ${n.limpezaACadaMeses} meses`, anual: r2(limpezasAno * c.custoLimpeza * pocos) },
    { item: `${n.chamadosAno} emergência(s) por ano`, anual: r2(n.chamadosAno * visita) },
    { item: 'Monitoramento (dados e aparelho)', anual: n.monitoramento ? r2((c.custoMonitoramentoMes + c.aparelhoValor / c.aparelhoMeses) * 12 * pocos) : 0 },
    { item: `${Math.round(n.reservaBombaPct * 100)}% da troca da bomba (${String(cv).replace('.', ',')} CV)`,
      anual: r2((n.reservaBombaPct * cv * c.bombaPrecoPorCv / c.bombaVidaAnos) * pocos) },
  ].filter(l => l.anual > 0);
  const custoAnual = custos.reduce((s, l) => s + l.anual, 0);
  const custoMensal = r2(custoAnual / 12);
  const precoMensal = arredondar(custoMensal / divisor(c), c.arredondarPara);
  const liquido = precoMensal * (1 - c.impostosPct - c.taxaCobrancaPct - c.inadimplenciaPct);
  const lucroMensal = r2(liquido - custoMensal);
  const margemReal = precoMensal > 0 ? Math.round((lucroMensal / precoMensal) * 10000) / 10000 : 0;

  // o mesmo serviço pago avulso: visitas e emergências pelo preço avulso, limpeza com a mesma margem, a parte da bomba
  // pelo preço dela (monitoramento não se compra avulso: entra pelo preço de custo com margem)
  const avulso = visitaAvulsa(c, mediaVisitaEmpresa, prof) * pocos;
  const avulsoAnual = r2((n.visitasAno + n.chamadosAno) * avulso + limpezasAno * c.custoLimpeza * pocos / divisor(c)
    + (n.monitoramento ? (c.custoMonitoramentoMes + c.aparelhoValor / c.aparelhoMeses) * 12 * pocos / divisor(c) : 0)
    + n.reservaBombaPct * cv * c.bombaPrecoPorCv / c.bombaVidaAnos * pocos);
  const economiaAnual = r2(avulsoAnual - precoMensal * 12);
  const avisos: string[] = [];
  if (margemReal < c.margemMinimaPct) avisos.push(`Margem de ${(margemReal * 100).toFixed(1).replace('.', ',')}% abaixo da mínima (${Math.round(c.margemMinimaPct * 100)}%)`);
  const comparacaoEstimada = !c.precoVisitaAvulsa && !mediaVisitaEmpresa;
  if (economiaAnual < 0 && !comparacaoEstimada) avisos.push('O cliente paga mais do que pagaria avulso: o plano não se vende');
  if (!custos.length) avisos.push('O plano não inclui nada que custe');
  return {
    precoMensal, custoMensal, custos, lucroMensal, margemReal, avulsoAnual, economiaAnual,
    economiaPct: avulsoAnual > 0 ? Math.round((economiaAnual / avulsoAnual) * 1000) / 1000 : null, comparacaoEstimada,
    viavel: !avisos.length, avisos,
  };
};

/** Plano a sugerir: entre os viáveis, o que mais economiza para o cliente (empate: o mais barato). null se nenhum é viável. */
export const planoSugerido = <T extends { preco: PrecoPlano }>(planos: T[]): T | null =>
  planos.filter(x => x.preco.viavel)
    .sort((a, b) => b.preco.economiaAnual - a.preco.economiaAnual || a.preco.precoMensal - b.preco.precoMensal)[0] || null;
