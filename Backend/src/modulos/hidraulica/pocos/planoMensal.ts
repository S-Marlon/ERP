// Obras de poços › plano mensal: o preço de cada plano oferecido (nível) para um cliente, a partir dos custos da empresa
// (visita, deslocamento, limpeza, monitoramento, reserva da bomba) e do poço (profundidade, potência da bomba, quantos
// poços). O plano é viável quando a empresa lucra a margem mínima e o cliente paga menos do que pagaria avulso.
// Regras puras (sem banco), com teste.
import { ErroObra, lerGps } from './obras';

export interface CustosPlano {
  custoHoraEquipe: number; horasVisita: number; horasPor100m: number; kmMedio: number; custoKm: number; materialVisita: number;
  /** Base da empresa (de onde a equipe sai): com ela, o transporte sai da distância até o poço; sem ela, do km médio. */
  baseLatitude: number | null; baseLongitude: number | null; fatorEstrada: number;
  /** Parte das emergências incluídas que os clientes usam de fato (0,3 = 30%). */
  usoEmergenciasPct: number;
  custoLimpeza: number; custoMonitoramentoMes: number; aparelhoValor: number; aparelhoMeses: number;
  bombaPrecoPorCv: number; bombaVidaAnos: number; precoVisitaAvulsa: number | null;
  impostosPct: number; taxaCobrancaPct: number; inadimplenciaPct: number; margemPct: number; margemMinimaPct: number; arredondarPara: number;
}
export interface NivelPlano {
  nome: string; descricao: string | null; visitasAno: number; limpezaACadaMeses: number | null; chamadosAno: number;
  /** Desconto em bomba e material, e na limpeza (feita quando precisa, fora do plano). Não custam: saem da margem da venda. */
  descontoPecasPct: number; descontoLimpezaPct: number; prioridade: boolean; monitoramento: boolean; reservaBombaPct: number; fidelidadeMeses: number; ordem: number; ativo: boolean;
}
/** O que pesa no preço: o poço mais fundo, a bomba mais forte e quantos poços entram no plano. */
export interface PocoDoPlano {
  profundidadeM: number | null; potenciaCv: number | null; pocos: number;
  /** GPS do poço (o mais distante do cliente), para medir o transporte; e o km informado à mão, que vale mais. */
  latitude?: number | null; longitude?: number | null; kmIdaVolta?: number | null;
}

/** Valores padrão (os mesmos do script do banco), usados enquanto a loja não grava os dela. */
export const CUSTOS_PADRAO: CustosPlano = {
  custoHoraEquipe: 80, horasVisita: 3, horasPor100m: 1.5, kmMedio: 60, custoKm: 1.5, materialVisita: 50,
  baseLatitude: null, baseLongitude: null, fatorEstrada: 1.3, usoEmergenciasPct: 0.3, custoLimpeza: 800,
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
  // base: texto colado (como o GPS do poço) ou latitude/longitude; vazio = sem base
  let base: { latitude: number; longitude: number } | null = null;
  if (b?.baseGps !== undefined) {
    if (String(b.baseGps ?? '').trim()) { base = lerGps(b.baseGps); if (!base) throw new ErroObra('Base da empresa: cole a localização (ex.: -23.1171, -46.5565).'); }
  } else if (b?.baseLatitude !== null && b?.baseLatitude !== undefined && b?.baseLongitude !== null && b?.baseLongitude !== undefined) {
    base = lerGps(`${b.baseLatitude}, ${b.baseLongitude}`);
  }
  const c: CustosPlano = {
    baseLatitude: base?.latitude ?? null, baseLongitude: base?.longitude ?? null,
    fatorEstrada: numero(b?.fatorEstrada ?? 1.3, 'Fator da estrada', 1, 3),
    usoEmergenciasPct: pct(b?.usoEmergenciasPct ?? 0.3, 'Uso das emergências', 1),
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
    descontoPecasPct: pct(b?.descontoPecasPct ?? 0, 'Desconto em bomba e material', 0.9),
    descontoLimpezaPct: pct(b?.descontoLimpezaPct ?? 0, 'Desconto na limpeza', 0.9), prioridade: !!b?.prioridade, monitoramento: !!b?.monitoramento,
    reservaBombaPct: pct(b?.reservaBombaPct ?? 0, 'Troca da bomba coberta', 1), fidelidadeMeses: Math.round(numero(b?.fidelidadeMeses ?? 12, 'Fidelidade (meses)', 0, 120)),
    ordem: Math.round(Number(b?.ordem) || 0), ativo: b?.ativo === undefined ? true : !!b.ativo,
  };
  if (!n.visitasAno && !n.limpezaACadaMeses && !n.chamadosAno && !n.monitoramento && !n.reservaBombaPct) throw new ErroObra('O plano precisa incluir alguma coisa.');
  return n;
};

/** Parte do preço que sobra depois de impostos, cobrança, inadimplência e margem (o preço = custo ÷ isso). */
export const divisor = (c: Pick<CustosPlano, 'impostosPct' | 'taxaCobrancaPct' | 'inadimplenciaPct' | 'margemPct'>) =>
  Math.round((1 - c.impostosPct - c.taxaCobrancaPct - c.inadimplenciaPct - c.margemPct) * 10000) / 10000;

/** Km de ida e volta da base até o poço: linha reta (GPS) × fator da estrada × 2. null sem base ou sem GPS do poço. */
export const kmAteOPoco = (c: Pick<CustosPlano, 'baseLatitude' | 'baseLongitude' | 'fatorEstrada'>, latitude?: number | null, longitude?: number | null) => {
  if (c.baseLatitude === null || c.baseLongitude === null || latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(latitude - c.baseLatitude), dLon = rad(longitude - c.baseLongitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(c.baseLatitude)) * Math.cos(rad(latitude)) * Math.sin(dLon / 2) ** 2;
  const reta = 2 * 6371 * Math.asin(Math.sqrt(a));
  return Math.round(reta * c.fatorEstrada * 2);
};

/** Km da visita e de onde veio: o informado, o medido pelo GPS ou o km médio. */
export const kmDaVisita = (c: CustosPlano, p: Partial<PocoDoPlano>): { km: number; origem: 'INFORMADO' | 'GPS' | 'MEDIA' } => {
  if (p.kmIdaVolta !== null && p.kmIdaVolta !== undefined && p.kmIdaVolta >= 0) return { km: p.kmIdaVolta, origem: 'INFORMADO' };
  const gps = kmAteOPoco(c, p.latitude, p.longitude);
  return gps !== null ? { km: gps, origem: 'GPS' } : { km: c.kmMedio, origem: 'MEDIA' };
};

/**
 * Custo de uma ida ao cliente: horas da equipe (mais tempo em poço fundo, para tirar e descer a bomba) e material para
 * cada poço; o deslocamento uma vez só (o km médio, ou o informado/medido).
 */
export const custoVisita = (c: CustosPlano, profundidadeM: number | null, pocos = 1, km: number = c.kmMedio) => {
  const prof = profundidadeM ?? POCO_PADRAO.profundidadeM;
  const horas = c.horasVisita + c.horasPor100m * (prof / 100);
  return r2((horas * c.custoHoraEquipe + c.materialVisita) * Math.max(1, pocos) + km * c.custoKm);
};

/** Preço de uma visita avulsa: o informado, a média das manutenções da empresa ou o custo com a margem. */
export const visitaAvulsa = (c: CustosPlano, mediaDaEmpresa: number | null, profundidadeM: number | null, km: number = c.kmMedio) =>
  c.precoVisitaAvulsa || mediaDaEmpresa || r2(custoVisita(c, profundidadeM, 1, km) / divisor(c));

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
  /** Km de ida e volta usado na conta e de onde veio. */
  km: number; kmOrigem: 'INFORMADO' | 'GPS' | 'MEDIA';
}

const arredondar = (v: number, passo: number) => (passo > 0 ? Math.round(v / passo + 1e-9) * passo : r2(v));

/** Preço e viabilidade de um plano para o poço do cliente. */
export const precoDoPlano = (c: CustosPlano, n: NivelPlano, p: PocoDoPlano, mediaVisitaEmpresa: number | null = null): PrecoPlano => {
  const pocos = Math.max(1, p.pocos || 1);
  const prof = p.profundidadeM ?? POCO_PADRAO.profundidadeM;
  const cv = p.potenciaCv ?? POCO_PADRAO.potenciaCv;
  const { km, origem } = kmDaVisita(c, p);
  const visita = custoVisita(c, prof, pocos, km);
  // emergência incluída não é usada por todo cliente: entra pelo uso esperado
  const emergencias = n.chamadosAno * c.usoEmergenciasPct;
  const limpezasAno = n.limpezaACadaMeses ? 12 / n.limpezaACadaMeses : 0;
  const custos: LinhaCusto[] = [
    { item: `${n.visitasAno} visita(s) preventiva(s) por ano`, anual: r2(n.visitasAno * visita) },
    { item: `Limpeza a cada ${n.limpezaACadaMeses} meses`, anual: r2(limpezasAno * c.custoLimpeza * pocos) },
    { item: `${n.chamadosAno} emergência(s) por ano (uso esperado ${Math.round(c.usoEmergenciasPct * 100)}%)`, anual: r2(emergencias * visita) },
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
  const avulso = visitaAvulsa(c, mediaVisitaEmpresa, prof, km) * pocos;
  const avulsoAnual = r2((n.visitasAno + emergencias) * avulso + limpezasAno * c.custoLimpeza * pocos / divisor(c)
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
    viavel: !avisos.length, avisos, km, kmOrigem: origem,
  };
};

/** Plano a sugerir: entre os viáveis, o que mais economiza para o cliente (empate: o mais barato). null se nenhum é viável. */
export const planoSugerido = <T extends { preco: PrecoPlano }>(planos: T[]): T | null =>
  planos.filter(x => x.preco.viavel)
    .sort((a, b) => b.preco.economiaAnual - a.preco.economiaAnual || a.preco.precoMensal - b.preco.precoMensal)[0] || null;
