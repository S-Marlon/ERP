// Obras de poços › plano mensal: o preço de cada plano oferecido (nível) para um cliente, a partir dos custos da empresa
// (preventiva com 1 pessoa sem tirar a bomba; chamado/troca com a equipe, mais tempo em poço fundo e 2ª viagem se passar
// do dia; domingo/feriado com hora extra só nos planos com prioridade; caminhão-pipa; limpeza, monitoramento, reserva e
// desconto da bomba) e do poço (profundidade, potência da bomba, quantos poços). O plano é viável quando a empresa lucra
// a margem mínima e o cliente paga menos do que pagaria avulso.
// Regras puras (sem banco), com teste.
import { ErroObra, lerGps } from './obras';

export interface CustosPlano {
  /** Custo da hora de UMA pessoa (com encargos); a preventiva e o chamado multiplicam pelas pessoas que vão. */
  custoHoraEquipe: number;
  /** Preventiva: horas no local (sem tirar a bomba). Chamado/troca: horas por 100 m de poço (tirar e descer o tubo). */
  horasVisita: number; horasPor100m: number; kmMedio: number; custoKm: number; materialVisita: number;
  pessoasPreventiva: number; pessoasTroca: number;
  /** Horas base do chamado/troca em poço raso (as horas por 100 m somam por cima); passou da jornada, 2ª viagem. */
  horasTroca: number;
  /** Chamados esperados por poço por ano (o pessimista usa o limite do plano). */
  chamadosPocoAno: number;
  /** Parte dos chamados em domingo/feriado e a hora extra nesses dias (só nos planos com prioridade). */
  domingoFeriadoPct: number; adicionalDomingoPct: number;
  /** Cobrada no domingo/feriado de quem não tem prioridade (fora do custo do plano). */
  taxaUrgencia: number;
  /** Caminhão-pipa (planos com água emergencial): custo e chance de precisar por chamado. */
  custoPipa: number; pipaPct: number;
  /** Planejamento: equipe só para os planos (custo/mês), meta de assinantes e receita, serviços por semana. */
  custoEquipeDedicada: number; metaAssinantes: number; metaReceita: number; capacidadeSemana: number;
  /** Base da empresa (de onde a equipe sai): com ela, o transporte sai da distância até o poço; sem ela, do km médio. */
  baseLatitude: number | null; baseLongitude: number | null; fatorEstrada: number;
  /** Antigo (parte das emergências usadas); substituído por chamadosPocoAno. Fica gravado, sem uso na conta. */
  usoEmergenciasPct: number;
  custoLimpeza: number; custoMonitoramentoMes: number; aparelhoValor: number; aparelhoMeses: number;
  bombaPrecoPorCv: number; bombaVidaAnos: number; precoVisitaAvulsa: number | null;
  /** Conexões e peças pequenas por poço por ano (a preço de venda), fora o tubo e o fio. */
  materialAnoPoco: number;
  /** Tubo edutor + fio + corda por metro (a preço de venda) e de quantos em quantos anos se troca: base do desconto em material. */
  materialMetro: number; materialVidaAnos: number;
  impostosPct: number; taxaCobrancaPct: number; inadimplenciaPct: number; margemPct: number; margemMinimaPct: number; arredondarPara: number;
}
export interface NivelPlano {
  nome: string; descricao: string | null; visitasAno: number; limpezaACadaMeses: number | null; chamadosAno: number;
  /** Desconto em material — tubo edutor, fio, conexões (entra no custo: o que deixa de entrar no material do ano; a
   *  bomba vai em reservaBombaPct) — e na limpeza (feita quando precisa, fora do plano: sai da margem da venda). */
  descontoPecasPct: number; descontoLimpezaPct: number;
  /** Prioridade: atende domingo e feriado (sem ela, o chamado entra na fila do próximo dia útil). */
  prioridade: boolean;
  /** Leva caminhão-pipa se a bomba parar e demorar. */
  aguaEmergencial: boolean;
  monitoramento: boolean; reservaBombaPct: number; fidelidadeMeses: number; ordem: number; ativo: boolean;
}
/** O que pesa no preço: o poço mais fundo, a bomba mais forte e quantos poços entram no plano. */
export interface PocoDoPlano {
  profundidadeM: number | null; potenciaCv: number | null; pocos: number;
  /** GPS do poço (o mais distante do cliente), para medir o transporte; e o km informado à mão, que vale mais. */
  latitude?: number | null; longitude?: number | null; kmIdaVolta?: number | null;
  /** Profundidade da bomba (o tubo e o fio vão até ela); sem ela, 70% da profundidade do poço. */
  profundidadeBombaM?: number | null;
}

/** Valores padrão (os mesmos do script do banco), usados enquanto a loja não grava os dela. */
export const CUSTOS_PADRAO: CustosPlano = {
  custoHoraEquipe: 30, horasVisita: 3, horasPor100m: 1.5, kmMedio: 60, custoKm: 1.5, materialVisita: 50,
  pessoasPreventiva: 1, pessoasTroca: 3, horasTroca: 4, chamadosPocoAno: 1, domingoFeriadoPct: 0.17, adicionalDomingoPct: 1, taxaUrgencia: 0,
  custoPipa: 0, pipaPct: 0.1, custoEquipeDedicada: 0, metaAssinantes: 15, metaReceita: 5000, capacidadeSemana: 3,
  baseLatitude: null, baseLongitude: null, fatorEstrada: 1.3, usoEmergenciasPct: 0.3, custoLimpeza: 800,
  custoMonitoramentoMes: 25, aparelhoValor: 900, aparelhoMeses: 36, bombaPrecoPorCv: 1500, bombaVidaAnos: 6, precoVisitaAvulsa: null, materialAnoPoco: 0, materialMetro: 0, materialVidaAnos: 10,
  impostosPct: 0.06, taxaCobrancaPct: 0.03, inadimplenciaPct: 0.03, margemPct: 0.25, margemMinimaPct: 0.1, arredondarPara: 5,
};
/** Sem profundidade nem bomba informadas, a conta usa um poço comum. */
export const POCO_PADRAO = { profundidadeM: 80, potenciaCv: 1.5 };
/** Sem a profundidade da bomba, o tubo e o fio vão até 70% da profundidade do poço. */
export const BOMBA_NO_POCO = 0.7;

/** Material do poço por ano: tubo + fio + corda até a bomba (por metro, ÷ vida útil) e as conexões do ano. */
export const materialAnual = (c: Pick<CustosPlano, 'materialMetro' | 'materialVidaAnos' | 'materialAnoPoco'>, profundidadeM: number | null, profundidadeBombaM?: number | null) => {
  const ate = profundidadeBombaM ?? (profundidadeM ?? POCO_PADRAO.profundidadeM) * BOMBA_NO_POCO;
  return r2(ate * c.materialMetro / (c.materialVidaAnos || 10) + c.materialAnoPoco);
};

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
    custoHoraEquipe: numero(b?.custoHoraEquipe, 'Custo por hora (por pessoa)', 0, 10000),
    pessoasPreventiva: Math.round(numero(b?.pessoasPreventiva ?? 1, 'Pessoas na preventiva', 1, 10)),
    pessoasTroca: Math.round(numero(b?.pessoasTroca ?? 3, 'Pessoas no chamado/troca', 1, 10)),
    horasTroca: numero(b?.horasTroca ?? 4, 'Horas do chamado/troca', 0, 48),
    chamadosPocoAno: numero(b?.chamadosPocoAno ?? 1, 'Chamados por poço por ano', 0, 24),
    domingoFeriadoPct: pct(b?.domingoFeriadoPct ?? 0.17, 'Chamados em domingo/feriado', 1),
    adicionalDomingoPct: numero(b?.adicionalDomingoPct ?? 1, 'Hora extra em domingo/feriado', 0, 3),
    taxaUrgencia: numero(b?.taxaUrgencia ?? 0, 'Taxa de urgência', 0, 100000),
    custoPipa: numero(b?.custoPipa ?? 0, 'Custo do caminhão-pipa', 0, 100000),
    pipaPct: pct(b?.pipaPct ?? 0.1, 'Chance de precisar do pipa', 1),
    custoEquipeDedicada: numero(b?.custoEquipeDedicada ?? 0, 'Custo da equipe dedicada', 0, 10000000),
    metaAssinantes: Math.round(numero(b?.metaAssinantes ?? 15, 'Meta de assinantes', 0, 100000)),
    metaReceita: numero(b?.metaReceita ?? 5000, 'Meta de receita', 0, 100000000),
    capacidadeSemana: Math.round(numero(b?.capacidadeSemana ?? 3, 'Serviços por semana', 0, 100)),
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
    materialAnoPoco: numero(b?.materialAnoPoco ?? 0, 'Conexões e peças por ano', 0, 1000000),
    materialMetro: numero(b?.materialMetro ?? 0, 'Material por metro', 0, 100000),
    materialVidaAnos: numero(b?.materialVidaAnos ?? 10, 'Vida útil do material', 0.5, 50),
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
    descontoPecasPct: pct(b?.descontoPecasPct ?? 0, 'Desconto em material', 1),
    descontoLimpezaPct: pct(b?.descontoLimpezaPct ?? 0, 'Desconto na limpeza', 0.9), prioridade: !!b?.prioridade, aguaEmergencial: !!b?.aguaEmergencial,
    monitoramento: !!b?.monitoramento,
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
 * Custo de uma visita preventiva: as horas no local (sem tirar a bomba, por isso a profundidade não pesa) × as pessoas
 * da preventiva × a hora, e o material, para cada poço; o deslocamento uma vez só (o km médio, ou o informado/medido).
 */
export const custoVisita = (c: CustosPlano, _profundidadeM: number | null = null, pocos = 1, km: number = c.kmMedio) =>
  r2((c.horasVisita * c.pessoasPreventiva * c.custoHoraEquipe + c.materialVisita) * Math.max(1, pocos) + km * c.custoKm);

/** Jornada da equipe: o chamado que passa disso volta no dia seguinte (mais uma viagem). */
export const JORNADA_HORAS = 8;

/**
 * Custo de um chamado (bomba parou, água suja, troca): a equipe da troca pelas horas base mais o tempo de tirar e descer
 * o tubo (por 100 m), com hora extra no domingo/feriado; o material e uma viagem por dia de serviço.
 */
export const custoChamado = (c: CustosPlano, profundidadeM: number | null, km: number = c.kmMedio, domingo = false) => {
  const horas = c.horasTroca + c.horasPor100m * ((profundidadeM ?? POCO_PADRAO.profundidadeM) / 100);
  const viagens = Math.max(1, Math.ceil(horas / JORNADA_HORAS - 1e-9));
  const maoDeObra = r2(horas * c.pessoasTroca * c.custoHoraEquipe * (domingo ? 1 + c.adicionalDomingoPct : 1));
  return { total: r2(maoDeObra + c.materialVisita + km * c.custoKm * viagens), maoDeObra, horas: r2(horas), viagens };
};

/** Preço de uma visita avulsa: o informado, a média das manutenções da empresa ou o custo com a margem. */
export const visitaAvulsa = (c: CustosPlano, mediaDaEmpresa: number | null, profundidadeM: number | null, km: number = c.kmMedio) =>
  c.precoVisitaAvulsa || mediaDaEmpresa || r2(custoVisita(c, profundidadeM, 1, km) / divisor(c));

export interface LinhaCusto { item: string; anual: number }
export interface PrecoPlano {
  precoMensal: number; custoMensal: number; custos: LinhaCusto[];
  /** Parte do custo que é mão de obra (para ver quando vale ter uma equipe só para os planos). */
  maoDeObraMensal: number;
  /** Idas ao cliente esperadas por ano (preventivas + chamados), para a capacidade da equipe. */
  atendimentosAno: number;
  /** Chamados esperados por ano neste cliente e o custo de um (dia útil). */
  chamadosAno: number; custoUmChamado: number;
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
  // chamados: os esperados por poço, até o limite do plano; com prioridade, parte cai no domingo/feriado (hora extra);
  // sem prioridade, espera o próximo dia útil. Com água emergencial, a chance do caminhão-pipa em cada chamado.
  const chamados = Math.min(n.chamadosAno, c.chamadosPocoAno * pocos);
  const util = custoChamado(c, prof, km), domingo = custoChamado(c, prof, km, true);
  const f = n.prioridade ? c.domingoFeriadoPct : 0;
  const porChamado = r2((1 - f) * util.total + f * domingo.total + (n.aguaEmergencial ? c.pipaPct * c.custoPipa : 0));
  const maoChamado = (1 - f) * util.maoDeObra + f * domingo.maoDeObra;
  const limpezasAno = n.limpezaACadaMeses ? 12 / n.limpezaACadaMeses : 0;
  // desconto em material: o que deixa de entrar por ano no tubo, fio e conexões (a bomba vai pela reserva)
  const descontoAnual = r2(n.descontoPecasPct * materialAnual(c, prof, p.profundidadeBombaM) * pocos);
  const custos: LinhaCusto[] = [
    { item: `${n.visitasAno} visita(s) preventiva(s) por ano`, anual: r2(n.visitasAno * visita) },
    { item: `Limpeza a cada ${n.limpezaACadaMeses} meses`, anual: r2(limpezasAno * c.custoLimpeza * pocos) },
    { item: `Chamados: até ${n.chamadosAno} por ano, esperado ${String(r2(chamados)).replace('.', ',')}${n.prioridade ? ' (com domingo/feriado)' : ''}${n.aguaEmergencial ? ' + pipa' : ''}`,
      anual: r2(chamados * porChamado) },
    { item: 'Monitoramento (dados e aparelho)', anual: n.monitoramento ? r2((c.custoMonitoramentoMes + c.aparelhoValor / c.aparelhoMeses) * 12 * pocos) : 0 },
    { item: `${Math.round(n.reservaBombaPct * 100)}% da troca da bomba (${String(cv).replace('.', ',')} CV)`,
      anual: r2((n.reservaBombaPct * cv * c.bombaPrecoPorCv / c.bombaVidaAnos) * pocos) },
    { item: `Desconto de ${Math.round(n.descontoPecasPct * 100)}% em material (tubo, fio, conexões)`, anual: descontoAnual },
  ].filter(l => l.anual > 0);
  const custoAnual = custos.reduce((s, l) => s + l.anual, 0);
  const custoMensal = r2(custoAnual / 12);
  const maoDeObraMensal = r2((n.visitasAno * c.horasVisita * c.pessoasPreventiva * c.custoHoraEquipe * pocos + chamados * maoChamado) / 12);
  const precoMensal = arredondar(custoMensal / divisor(c), c.arredondarPara);
  const liquido = precoMensal * (1 - c.impostosPct - c.taxaCobrancaPct - c.inadimplenciaPct);
  const lucroMensal = r2(liquido - custoMensal);
  const margemReal = precoMensal > 0 ? Math.round((lucroMensal / precoMensal) * 10000) / 10000 : 0;

  // o mesmo serviço pago avulso: visitas e emergências pelo preço avulso, limpeza com a mesma margem, a parte da bomba
  // pelo preço dela (monitoramento não se compra avulso: entra pelo preço de custo com margem)
  const avulso = visitaAvulsa(c, mediaVisitaEmpresa, prof, km) * pocos;
  const avulsoAnual = r2(n.visitasAno * avulso + chamados * util.total / divisor(c) + limpezasAno * c.custoLimpeza * pocos / divisor(c)
    + (n.monitoramento ? (c.custoMonitoramentoMes + c.aparelhoValor / c.aparelhoMeses) * 12 * pocos / divisor(c) : 0)
    + n.reservaBombaPct * cv * c.bombaPrecoPorCv / c.bombaVidaAnos * pocos
    + descontoAnual);   // sem o plano, o cliente pagaria a peça cheia
  const economiaAnual = r2(avulsoAnual - precoMensal * 12);
  const avisos: string[] = [];
  if (margemReal < c.margemMinimaPct) avisos.push(`Margem de ${(margemReal * 100).toFixed(1).replace('.', ',')}% abaixo da mínima (${Math.round(c.margemMinimaPct * 100)}%)`);
  const comparacaoEstimada = !c.precoVisitaAvulsa && !mediaVisitaEmpresa;
  if (economiaAnual < 0 && !comparacaoEstimada) avisos.push('O cliente paga mais do que pagaria avulso: o plano não se vende');
  if (!custos.length) avisos.push('O plano não inclui nada que custe');
  return {
    precoMensal, custoMensal, custos, maoDeObraMensal, atendimentosAno: r2(n.visitasAno + chamados), chamadosAno: r2(chamados), custoUmChamado: util.total,
    lucroMensal, margemReal, avulsoAnual, economiaAnual,
    economiaPct: avulsoAnual > 0 ? Math.round((economiaAnual / avulsoAnual) * 1000) / 1000 : null, comparacaoEstimada,
    viavel: !avisos.length, avisos, km, kmOrigem: origem,
  };
};

/** Plano a sugerir: entre os viáveis, o que mais economiza para o cliente (empate: o mais barato). null se nenhum é viável. */
export const planoSugerido = <T extends { preco: PrecoPlano }>(planos: T[]): T | null =>
  planos.filter(x => x.preco.viavel)
    .sort((a, b) => b.preco.economiaAnual - a.preco.economiaAnual || a.preco.precoMensal - b.preco.precoMensal)[0] || null;

// ------------------------------------------------------------------ risco e faixa de lucro (caso a caso)
export interface CenarioPlano { custoMensal: number; lucroMensal: number; margem: number }
export interface RiscoPlano {
  /** Preço usado na análise (o calculado ou o combinado com o cliente). */
  preco: number;
  otimista: CenarioPlano; esperado: CenarioPlano; pessimista: CenarioPlano;
  /** Até quantos km (ida e volta) o plano ainda dá lucro, e até quantos mantém a margem mínima, com este preço. */
  kmEquilibrio: number | null; kmMargemMinima: number | null;
  nivel: 'BAIXO' | 'MEDIO' | 'ALTO';
  /** O que pesa no risco, em frases curtas. */
  fatores: string[];
  /** Precisão da conta: dados estimados alargam a faixa (sem GPS, sem profundidade, sem bomba registrada). */
  precisao: 'BOA' | 'MEDIA' | 'BAIXA'; estimados: string[];
}

/** O que muda em cada cenário (sobre os custos da empresa). Ajustar com a experiência. */
export const CENARIOS = {
  /** chamados: parte dos esperados (pessimista: todos os do limite do plano); horas: preventiva e troca. */
  otimista: { chamados: 0.5, horas: 1, inadimplencia: 0, vidaBomba: 1 },
  pessimista: { chamados: null as number | null, horas: 1.25, inadimplencia: 2, vidaBomba: 0.75 },
};
/** Erro esperado do km de ida e volta por origem: informado, GPS (estrada × linha reta) ou o km médio (sem GPS). */
export const ERRO_KM = { INFORMADO: 0.05, GPS: 0.15, MEDIA: 0.4 };

const brlTxt = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

/**
 * Risco do plano para um cliente, com um preço (o calculado ou o combinado): o lucro por mês no cenário otimista,
 * esperado e pessimista (emergências, tempo de visita, inadimplência, vida da bomba e o erro dos dados — km sem GPS,
 * profundidade e bomba não informadas), até onde a distância compensa e o nível de risco com os motivos.
 */
export const riscoDoPlano = (c: CustosPlano, n: NivelPlano, p: PocoDoPlano, preco: number, media: number | null = null): RiscoPlano => {
  const base = precoDoPlano(c, n, p, media);
  const { km, origem } = { km: base.km, origem: base.kmOrigem };
  const erroKm = ERRO_KM[origem];
  const estimados: string[] = [];
  if (origem === 'MEDIA') estimados.push(`distância pelo km médio (${c.kmMedio} km), sem GPS do poço${c.baseLatitude === null ? ' ou da base' : ''}`);
  if (p.profundidadeM === null) estimados.push(`profundidade não informada (conta com ${POCO_PADRAO.profundidadeM} m)`);
  if (p.potenciaCv === null && n.reservaBombaPct > 0) estimados.push(`bomba não registrada (conta com ${String(POCO_PADRAO.potenciaCv).replace('.', ',')} CV)`);

  const liquido = (inad: number) => preco * (1 - c.impostosPct - c.taxaCobrancaPct - Math.min(0.5, inad));
  const cenario = (cc: CustosPlano, pp: PocoDoPlano, inad: number): CenarioPlano => {
    const custoMensal = precoDoPlano(cc, n, pp, media).custoMensal;
    const lucroMensal = r2(liquido(inad) - custoMensal);
    return { custoMensal, lucroMensal, margem: preco > 0 ? Math.round((lucroMensal / preco) * 10000) / 10000 : 0 };
  };
  const esperado = cenario(c, { ...p, kmIdaVolta: km }, c.inadimplenciaPct);
  const o = CENARIOS.otimista, q = CENARIOS.pessimista;
  const otimista = cenario(
    { ...c, chamadosPocoAno: c.chamadosPocoAno * o.chamados, horasVisita: c.horasVisita * o.horas, horasPor100m: c.horasPor100m * o.horas,
      horasTroca: c.horasTroca * o.horas, bombaVidaAnos: c.bombaVidaAnos * o.vidaBomba },
    { ...p, kmIdaVolta: Math.round(km * (1 - erroKm)), profundidadeM: p.profundidadeM ?? 50, potenciaCv: p.potenciaCv ?? 1 },
    c.inadimplenciaPct * o.inadimplencia);
  const pessimista = cenario(
    { ...c, chamadosPocoAno: q.chamados ?? Math.max(c.chamadosPocoAno, n.chamadosAno), horasVisita: c.horasVisita * q.horas, horasPor100m: c.horasPor100m * q.horas,
      horasTroca: c.horasTroca * q.horas, bombaVidaAnos: c.bombaVidaAnos * q.vidaBomba },
    { ...p, kmIdaVolta: Math.round(km * (1 + erroKm)), profundidadeM: p.profundidadeM ?? 150, potenciaCv: p.potenciaCv ?? 3 },
    c.inadimplenciaPct * q.inadimplencia);

  // o custo cresce em linha reta com o km: acha onde o lucro zera e onde fica na margem mínima
  const custoEm = (k: number) => precoDoPlano(c, n, { ...p, kmIdaVolta: k }, media).custoMensal;
  const c0 = custoEm(0), porKm = (custoEm(1000) - c0) / 1000;
  const liq = liquido(c.inadimplenciaPct);
  const kmAte = (alvo: number) => (porKm > 0 ? Math.max(0, Math.floor((liq - alvo - c0) / porKm)) : null);
  const kmEquilibrio = kmAte(0), kmMargemMinima = kmAte(c.margemMinimaPct * preco);

  const fatores: string[] = [];
  if (esperado.lucroMensal < 0) fatores.push(`Prejuízo já no esperado: ${brlTxt(esperado.lucroMensal)}/mês.`);
  else if (esperado.margem < c.margemMinimaPct) fatores.push(`Margem esperada de ${(esperado.margem * 100).toFixed(1).replace('.', ',')}%, abaixo da mínima (${Math.round(c.margemMinimaPct * 100)}%).`);
  if (kmMargemMinima !== null && km > kmMargemMinima) fatores.push(`Longe: ${km} km ida e volta, acima dos ${kmMargemMinima} km que mantêm a margem mínima com este preço.`);
  else if (kmMargemMinima !== null && km > kmMargemMinima * 0.8) fatores.push(`Perto do limite da distância: ${km} de ${kmMargemMinima} km.`);
  if (n.chamadosAno > 0 && pessimista.lucroMensal < esperado.lucroMensal) {
    fatores.push(`Se usar os ${n.chamadosAno} chamados do ano (e o serviço demorar mais), o lucro vai a ${brlTxt(pessimista.lucroMensal)}/mês.`);
  }
  if (n.reservaBombaPct >= 0.5 && (p.potenciaCv ?? 0) >= 3) fatores.push(`Bomba forte (${p.potenciaCv} CV) com ${Math.round(n.reservaBombaPct * 100)}% da troca coberta.`);
  if ((p.profundidadeM ?? 0) >= 150) fatores.push(`Poço fundo (${p.profundidadeM} m): visita mais longa.`);
  if (estimados.length) fatores.push(`Dados estimados: ${estimados.join('; ')}.`);

  const nivel: RiscoPlano['nivel'] = esperado.lucroMensal < 0 || esperado.margem < c.margemMinimaPct ? 'ALTO' : pessimista.lucroMensal < 0 ? 'MEDIO' : 'BAIXO';
  const precisao: RiscoPlano['precisao'] = origem === 'MEDIA' || estimados.length >= 2 ? 'BAIXA' : estimados.length ? 'MEDIA' : 'BOA';
  return { preco, otimista, esperado, pessimista, kmEquilibrio, kmMargemMinima, nivel, fatores, precisao, estimados };
};
