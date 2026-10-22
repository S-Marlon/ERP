// Obras de poços › monitoramento remoto (etapa 7): regras puras, independentes da placa (ESP-01, ESP32, 4G, LoRa ou
// sem internet: o que importa é o formato do envio). A chave de cada aparelho é calculada da chave mestra do .env (HMAC)
// e nunca fica no banco; as leituras chegam em lote (pela internet ou por arquivo importado, no poço sem internet); cada
// leitura é comparada com os limites e com o estado do quadro de comando (fases, contator, térmico, boia, seletora) e
// abre/fecha alertas; o resumo do dia vira medição do poço; o relatório do mês junta horas, partidas, energia e custo.
import crypto from 'crypto';
import { ErroObra } from './obras';

export const CONEXOES = ['WIFI', 'GSM_4G', 'LORA', 'OFFLINE', 'OUTRO'] as const;
export const ALIMENTACOES = ['MONOFASICO', 'BIFASICO', 'TRIFASICO'] as const;
export const TIPOS_ALERTA = [
  'NIVEL_BAIXO', 'A_SECO', 'SOBRECORRENTE', 'VAZAO_BAIXA', 'TENSAO', 'SEM_SINAL',
  'FALTA_FASE', 'SEM_ENERGIA', 'NAO_PARTE', 'SEM_FUNCIONAMENTO', 'TERMICO', 'PRESSAO_BAIXA', 'LIGADA_DEMAIS', 'PARTIDAS_DEMAIS',
] as const;
export type TipoAlerta = typeof TIPOS_ALERTA[number];
export const COMANDOS = ['BLOQUEAR', 'LIBERAR', 'RECONHECER'] as const;
export type Comando = typeof COMANDOS[number];
export const LOTE_MAXIMO = 500;
/** Sem leitura por mais que isso × o intervalo do aparelho = "sem sinal" (não vale para o aparelho sem internet). */
export const FATOR_SEM_SINAL = 3;
/** Abaixo disso a fase é considerada sem tensão. */
export const FASE_MINIMA_V = 50;
/** Abaixo disso (A) o motor não está girando. */
export const CORRENTE_PARADA_A = 0.5;
export const VALIDADE_COMANDO_MIN = 10;

// ------------------------------------------------------------------ chave do aparelho
/** Chave do aparelho: HMAC-SHA256(chave mestra, identificador), 32 caracteres. Trocar a mestra invalida todas. */
export const chaveDoDispositivo = (mestra: string, identificador: string) => {
  if (!mestra || mestra.length < 16) throw new ErroObra('Configure IOT_CHAVE_MESTRA no .env do backend (texto longo e aleatório, 16+ caracteres).', 503);
  return crypto.createHmac('sha256', mestra).update(String(identificador).trim().toUpperCase()).digest('hex').slice(0, 32);
};
export const chaveConfere = (mestra: string, identificador: string, chave: string) => {
  const certa = Buffer.from(chaveDoDispositivo(mestra, identificador));
  const recebida = Buffer.from(String(chave || '').trim().toLowerCase());
  return certa.length === recebida.length && crypto.timingSafeEqual(certa, recebida);
};

// ------------------------------------------------------------------ cadastro do aparelho
const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const numero = (v: unknown, nome: string, min = 0, max = 1e7) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw new ErroObra(`${nome}: número inválido.`);
  return Math.round(n * 10000) / 10000;
};

export const validarDispositivo = (b: any) => {
  const nome = texto(b?.nome, 100);
  if (!nome) throw new ErroObra('Dê um nome ao aparelho (ex.: Sensor poço Sítio São José).');
  const identificador = String(b?.identificador ?? '').trim().toUpperCase().replace(/[^A-Z0-9:_-]/g, '').slice(0, 40);
  if (identificador.length < 4) throw new ErroObra('Identificador: o nº de série ou MAC do aparelho (letras, números, ":", "-" ou "_").');
  const conexao = String(b?.conexao || 'WIFI').toUpperCase();
  if (!(CONEXOES as readonly string[]).includes(conexao)) throw new ErroObra(`Conexão inválida: ${b?.conexao}.`);
  const alimentacao = String(b?.alimentacao || 'MONOFASICO').toUpperCase();
  if (!(ALIMENTACOES as readonly string[]).includes(alimentacao)) throw new ErroObra(`Alimentação inválida: ${b?.alimentacao}.`);
  const intervalo = Math.floor(Number(b?.intervaloMin ?? 15));
  if (!(intervalo >= 1 && intervalo <= 1440)) throw new ErroObra('Intervalo de medição: de 1 a 1440 minutos.');
  const partidas = b?.partidasMaxHora === undefined || b?.partidasMaxHora === null || b?.partidasMaxHora === '' ? null : Math.floor(Number(b.partidasMaxHora));
  if (partidas !== null && !(partidas >= 1 && partidas <= 120)) throw new ErroObra('Partidas por hora: de 1 a 120.');
  const d = {
    nome, identificador, conexao, alimentacao, intervaloMin: intervalo, profundidadeSensorM: numero(b?.profundidadeSensorM, 'Profundidade do sensor', 0, 2000),
    nivelAlertaM: numero(b?.nivelAlertaM, 'Nível de alerta', 0, 2000), correnteMinA: numero(b?.correnteMinA, 'Corrente mínima', 0, 1000),
    correnteMaxA: numero(b?.correnteMaxA, 'Corrente máxima', 0, 1000), vazaoMinLh: numero(b?.vazaoMinLh, 'Vazão mínima'),
    tensaoMinV: numero(b?.tensaoMinV, 'Tensão mínima', 0, 1000), tensaoMaxV: numero(b?.tensaoMaxV, 'Tensão máxima', 0, 1000),
    pressaoMinBar: numero(b?.pressaoMinBar, 'Pressão mínima', 0, 100), horasMaxLigada: numero(b?.horasMaxLigada, 'Horas ligada', 0.1, 240),
    partidasMaxHora: partidas, tarifaKwh: numero(b?.tarifaKwh, 'Tarifa', 0, 100), aceitaComandos: b?.aceitaComandos === true || b?.aceitaComandos === 1 ? 1 : 0,
    situacao: String(b?.situacao || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO', observacao: texto(b?.observacao, 255),
  };
  if (d.correnteMinA !== null && d.correnteMaxA !== null && d.correnteMinA >= d.correnteMaxA) throw new ErroObra('A corrente mínima tem de ser menor que a máxima.');
  if (d.tensaoMinV !== null && d.tensaoMaxV !== null && d.tensaoMinV >= d.tensaoMaxV) throw new ErroObra('A tensão mínima tem de ser menor que a máxima.');
  return d;
};

// ------------------------------------------------------------------ leituras
export interface Leitura {
  em: string; nivelM: number | null; vazaoLh: number | null; pressaoBar: number | null; correnteA: number | null; tensaoV: number | null;
  faseAV: number | null; faseBV: number | null; faseCV: number | null; bombaLigada: boolean | null; comandoLigado: boolean | null;
  termicoOk: boolean | null; boiaPedindo: boolean | null; modo: 'AUTO' | 'MANUAL' | 'DESLIGADO' | null;
  horimetroH: number | null; energiaKwh: number | null; partidas: number | null; temperaturaC: number | null; sinalDbm: number | null; bateriaV: number | null;
}
export const leituraVazia = (em: string): Leitura => ({
  em, nivelM: null, vazaoLh: null, pressaoBar: null, correnteA: null, tensaoV: null, faseAV: null, faseBV: null, faseCV: null, bombaLigada: null,
  comandoLigado: null, termicoOk: null, boiaPedindo: null, modo: null, horimetroH: null, energiaKwh: null, partidas: null, temperaturaC: null, sinalDbm: null, bateriaV: null,
});

const dataHora = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const sn = (v: unknown): boolean | null => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'sim' || s === 'on' ? true : s === '0' || s === 'false' || s === 'nao' || s === 'não' || s === 'off' ? false : null;
};

/**
 * Lê o lote ({ leituras: [...] } ou uma leitura solta). Hora em ISO (com fuso), "AAAA-MM-DD HH:MM:SS" (hora local) ou
 * ausente (vale agora); mais de 10 min no futuro é recusada, assim como mais antiga que `maxDias` (60 pela internet;
 * mais na importação de arquivo do poço sem internet). "coluna_m" vira nível com a profundidade do sensor.
 */
export const lerLote = (body: any, agora: Date, profundidadeSensorM: number | null, maxDias = 60): Leitura[] => {
  const lista: any[] = Array.isArray(body?.leituras) ? body.leituras : body && typeof body === 'object' && !Array.isArray(body) ? [body] : [];
  if (!lista.length) throw new ErroObra('Nenhuma leitura no envio.');
  if (lista.length > LOTE_MAXIMO) throw new ErroObra(`No máximo ${LOTE_MAXIMO} leituras por envio.`);
  const n = (v: unknown, nome: string, min: number, max: number) => {
    if (v === undefined || v === null || v === '') return null;
    const x = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(x) || x < min || x > max) throw new ErroObra(`${nome} fora da faixa: ${v}.`);
    return Math.round(x * 1000) / 1000;
  };
  return lista.map(l => {
    const bruto = l?.em ? String(l.em).trim() : '';
    const d = !bruto ? agora : new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(bruto) ? bruto.replace(' ', 'T') : bruto);
    if (Number.isNaN(d.getTime())) throw new ErroObra(`Hora inválida: ${l?.em}.`);
    if (d.getTime() > agora.getTime() + 10 * 60000) throw new ErroObra(`Hora no futuro: ${l?.em} (o relógio do aparelho está certo? use NTP ou um relógio RTC).`);
    if (d.getTime() < agora.getTime() - maxDias * 86400000) throw new ErroObra(`Leitura de mais de ${maxDias} dias atrás: ${l?.em}.`);
    const coluna = n(l?.coluna_m, 'Coluna d\'água', 0, 2000);
    let nivel = n(l?.nivel_m, 'Nível', 0, 2000);
    if (nivel === null && coluna !== null && profundidadeSensorM !== null) nivel = Math.max(0, Math.round((profundidadeSensorM - coluna) * 100) / 100);
    const modo = String(l?.modo ?? '').trim().toUpperCase();
    const partidas = n(l?.partidas, 'Partidas', 0, 1e9);
    return {
      em: dataHora(d), nivelM: nivel, vazaoLh: n(l?.vazao_lh, 'Vazão', 0, 1e7), pressaoBar: n(l?.pressao_bar, 'Pressão', 0, 100),
      correnteA: n(l?.corrente_a, 'Corrente', 0, 1000), tensaoV: n(l?.tensao_v, 'Tensão', 0, 1000),
      faseAV: n(l?.fase_a_v, 'Fase R', 0, 1000), faseBV: n(l?.fase_b_v, 'Fase S', 0, 1000), faseCV: n(l?.fase_c_v, 'Fase T', 0, 1000),
      bombaLigada: sn(l?.bomba), comandoLigado: sn(l?.comando), termicoOk: sn(l?.termico_ok), boiaPedindo: sn(l?.boia),
      modo: (modo === 'AUTO' || modo === 'MANUAL' || modo === 'DESLIGADO' ? modo : null) as Leitura['modo'],
      horimetroH: n(l?.horimetro_h, 'Horímetro', 0, 1e7), energiaKwh: n(l?.energia_kwh, 'Energia', 0, 1e9), partidas: partidas === null ? null : Math.floor(partidas),
      temperaturaC: n(l?.temp_c, 'Temperatura', -40, 125), sinalDbm: n(l?.sinal_dbm, 'Sinal', -150, 0), bateriaV: n(l?.bateria_v, 'Bateria', 0, 60),
    };
  }).sort((a, b) => a.em.localeCompare(b.em));
};

/**
 * Arquivo do poço sem internet (o aparelho grava no cartão/memória e alguém traz): JSON do envio, uma leitura JSON por
 * linha (JSONL) ou CSV com cabeçalho nos mesmos nomes do envio (em;nivel_m;corrente_a... separado por ; ou ,).
 */
export const lerArquivo = (conteudo: string): any[] => {
  const t = String(conteudo || '').replace(/^﻿/, '').trim();
  if (!t) throw new ErroObra('Arquivo vazio.');
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t);
      return Array.isArray(j) ? j : Array.isArray(j?.leituras) ? j.leituras : [j];
    } catch {
      return t.split(/\r?\n/).filter(x => x.trim()).map((x, i) => { try { return JSON.parse(x); } catch { throw new ErroObra(`Linha ${i + 1} não é JSON.`); } });
    }
  }
  const linhas = t.split(/\r?\n/).filter(x => x.trim());
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cab = linhas[0].split(sep).map(x => x.trim().toLowerCase());
  if (!cab.includes('em')) throw new ErroObra('CSV sem a coluna "em" (a hora de cada leitura).');
  return linhas.slice(1).map(l => Object.fromEntries(l.split(sep).map((v, i) => [cab[i], v.trim()])));
};

// ------------------------------------------------------------------ alertas
export interface Limites {
  alimentacao: string; nivelAlertaM: number | null; correnteMinA: number | null; correnteMaxA: number | null; vazaoMinLh: number | null;
  tensaoMinV: number | null; tensaoMaxV: number | null; pressaoMinBar: number | null; horasMaxLigada: number | null; partidasMaxHora: number | null;
}
export interface Condicao { tipo: TipoAlerta; mensagem: string; valor: number }
/** O que a avaliação precisa saber do passado: desde quando a bomba está ligada, as partidas da última hora e se a leitura anterior já não partia. */
export interface Contexto { ligadaDesde: string | null; partidasHora: string[]; naoParteAntes: boolean; ultimaLigada: boolean | null }
export const contextoVazio = (): Contexto => ({ ligadaDesde: null, partidasHora: [], naoParteAntes: false, ultimaLigada: null });

const v = (x: number, un: string) => `${String(Math.round(x * 100) / 100).replace('.', ',')} ${un}`;
const minutos = (de: string, ate: string) => (new Date(ate.replace(' ', 'T')).getTime() - new Date(de.replace(' ', 'T')).getTime()) / 60000;

/** Bomba girando: o que o aparelho disse, ou a corrente acima de 0,5 A quando ele não diz. */
export const bombaLigada = (l: Pick<Leitura, 'bombaLigada' | 'correnteA'>) => l.bombaLigada ?? (l.correnteA !== null ? l.correnteA > CORRENTE_PARADA_A : null);

/** As fases que o quadro tem (pela alimentação) e as que chegaram sem tensão. Sem dado de fase: null. */
export const fases = (lim: Pick<Limites, 'alimentacao'>, l: Leitura) => {
  const lista: [string, number | null][] = [['R', l.faseAV], ['S', l.faseBV], ['T', l.faseCV]];
  const qtd = lim.alimentacao === 'TRIFASICO' ? 3 : lim.alimentacao === 'BIFASICO' ? 2 : 1;
  const conferidas = lista.slice(0, qtd).filter(([, x]) => x !== null) as [string, number][];
  if (!conferidas.length) return null;
  return { conferidas: conferidas.length, semTensao: conferidas.filter(([, x]) => x < FASE_MINIMA_V).map(([f]) => f), todas: qtd };
};

/**
 * As condições de alerta da leitura, sabendo o passado (contexto). "Sem sinal" depende do tempo sem leitura e é
 * conferido à parte. Sem energia não gera os alertas de bomba (é a causa deles).
 */
export const condicoesDaLeitura = (lim: Limites, l: Leitura, ctx: Contexto = contextoVazio()): Condicao[] => {
  const c: Condicao[] = [];
  const f = fases(lim, l);
  const semEnergia = !!f && f.semTensao.length === f.conferidas && f.conferidas === f.todas;
  const energiaOk = !f || f.semTensao.length === 0;
  if (f && semEnergia) c.push({ tipo: 'SEM_ENERGIA', valor: 0, mensagem: 'Sem energia no quadro (nenhuma fase com tensão).' });
  else if (f && f.semTensao.length) c.push({ tipo: 'FALTA_FASE', valor: f.semTensao.length, mensagem: `Falta de fase: ${f.semTensao.join(', ')} sem tensão.` });
  if (semEnergia) return c;

  const girando = bombaLigada(l);
  const correnteGirando = l.correnteA !== null && l.correnteA >= CORRENTE_PARADA_A;
  if (l.termicoOk === false) c.push({ tipo: 'TERMICO', valor: 0, mensagem: 'Disjuntor-motor/térmico desarmado (sobrecarga, bomba travada ou tensão baixa).' });
  if (l.comandoLigado && energiaOk && l.correnteA !== null && !correnteGirando && l.termicoOk !== false) {
    c.push({ tipo: 'SEM_FUNCIONAMENTO', valor: l.correnteA, mensagem: `Contator ligado e a bomba não puxa corrente (${v(l.correnteA, 'A')}): bomba queimada, cabo rompido ou emenda solta?` });
  }
  const naoParte = l.boiaPedindo === true && l.comandoLigado === false && energiaOk && l.termicoOk !== false && l.modo !== 'MANUAL' && l.modo !== 'DESLIGADO';
  if (naoParte && ctx.naoParteAntes) {
    c.push({ tipo: 'NAO_PARTE', valor: 0, mensagem: 'A boia pede água e a bomba não liga: relé de nível (poço baixo), relé de fase, bobina ou boia com defeito?' });
  }
  if (lim.nivelAlertaM !== null && l.nivelM !== null && l.nivelM > lim.nivelAlertaM) {
    c.push({ tipo: 'NIVEL_BAIXO', valor: l.nivelM, mensagem: `Água a ${v(l.nivelM, 'm')} (alerta a partir de ${v(lim.nivelAlertaM, 'm')}).` });
  }
  if (girando && correnteGirando && lim.correnteMinA !== null && l.correnteA! < lim.correnteMinA) {
    c.push({ tipo: 'A_SECO', valor: l.correnteA!, mensagem: `Bomba ligada com ${v(l.correnteA!, 'A')} (mínimo ${v(lim.correnteMinA, 'A')}): pode estar trabalhando a seco.` });
  }
  if (lim.correnteMaxA !== null && l.correnteA !== null && l.correnteA > lim.correnteMaxA) {
    c.push({ tipo: 'SOBRECORRENTE', valor: l.correnteA, mensagem: `Corrente de ${v(l.correnteA, 'A')} (máximo ${v(lim.correnteMaxA, 'A')}).` });
  }
  if (girando && lim.vazaoMinLh !== null && l.vazaoLh !== null && l.vazaoLh < lim.vazaoMinLh) {
    c.push({ tipo: 'VAZAO_BAIXA', valor: l.vazaoLh, mensagem: `Vazão de ${v(l.vazaoLh, 'L/h')} com a bomba ligada (mínimo ${v(lim.vazaoMinLh, 'L/h')}).` });
  }
  if (girando && correnteGirando && lim.pressaoMinBar !== null && l.pressaoBar !== null && l.pressaoBar < lim.pressaoMinBar) {
    c.push({ tipo: 'PRESSAO_BAIXA', valor: l.pressaoBar, mensagem: `Bomba trabalhando e pressão de ${v(l.pressaoBar, 'bar')} (mínimo ${v(lim.pressaoMinBar, 'bar')}): cano ou edutor estourado?` });
  }
  const tensoes = [l.tensaoV, l.faseAV, l.faseBV, l.faseCV].filter((x): x is number => x !== null && x >= FASE_MINIMA_V);
  const fora = tensoes.find(x => (lim.tensaoMinV !== null && x < lim.tensaoMinV) || (lim.tensaoMaxV !== null && x > lim.tensaoMaxV));
  if (fora !== undefined) c.push({ tipo: 'TENSAO', valor: fora, mensagem: `Tensão de ${v(fora, 'V')} (faixa ${lim.tensaoMinV ?? '—'} a ${lim.tensaoMaxV ?? '—'} V).` });
  if (girando && lim.horasMaxLigada !== null && ctx.ligadaDesde && minutos(ctx.ligadaDesde, l.em) / 60 > lim.horasMaxLigada) {
    c.push({ tipo: 'LIGADA_DEMAIS', valor: Math.round(minutos(ctx.ligadaDesde, l.em) / 6) / 10,
      mensagem: `Bomba ligada sem parar há ${v(minutos(ctx.ligadaDesde, l.em) / 60, 'h')}: boia travada/queimada ou vazamento?` });
  }
  if (lim.partidasMaxHora !== null && ctx.partidasHora.length > lim.partidasMaxHora) {
    c.push({ tipo: 'PARTIDAS_DEMAIS', valor: ctx.partidasHora.length,
      mensagem: `${ctx.partidasHora.length} partidas na última hora (máximo ${lim.partidasMaxHora}): boia oscilando, pressostato ou tanque de pressão?` });
  }
  return c;
};

/** Leva o contexto para a próxima leitura: desde quando está ligada, as partidas da última hora, "não parte" anterior. */
export const avancarContexto = (ctx: Contexto, l: Leitura, lim: Limites): Contexto => {
  const girando = bombaLigada(l);
  const partiu = girando === true && ctx.ultimaLigada === false;
  const partidasHora = [...ctx.partidasHora, ...(partiu ? [l.em] : [])].filter(x => minutos(x, l.em) <= 60);
  const f = fases(lim, l);
  const energiaOk = !f || f.semTensao.length === 0;
  return {
    ligadaDesde: girando === true ? ctx.ligadaDesde ?? l.em : girando === false ? null : ctx.ligadaDesde,
    partidasHora, ultimaLigada: girando ?? ctx.ultimaLigada,
    naoParteAntes: l.boiaPedindo === true && l.comandoLigado === false && energiaOk && l.termicoOk !== false && l.modo !== 'MANUAL' && l.modo !== 'DESLIGADO',
  };
};

/** Monta o contexto a partir das leituras guardadas antes do lote (última hora e o trecho ligado mais recente). */
export const contextoDasAnteriores = (anteriores: Leitura[], lim: Limites) =>
  [...anteriores].sort((a, b) => a.em.localeCompare(b.em)).reduce((ctx, l) => avancarContexto(ctx, l, lim), contextoVazio());

/**
 * O que fazer com os alertas a cada leitura (em ordem de hora): abre o tipo que apareceu e não estava aberto, fecha o
 * aberto que normalizou. Só fecha um tipo quando a leitura tem o dado dele (leitura sem corrente não fecha "a seco").
 * "Sem sinal" fecha em qualquer leitura. O alerta que abriu e fechou dentro do mesmo lote (aconteceu enquanto o
 * aparelho estava sem sinal) fica registrado com início e fim.
 */
export const reconciliar = (abertos: TipoAlerta[], leituras: Leitura[], lim: Limites, contexto: Contexto = contextoVazio()) => {
  const aberto = new Set<TipoAlerta>(abertos);
  const abrir: (Condicao & { inicio: string; fim?: string })[] = [];
  const fechar: { tipo: TipoAlerta; fim: string }[] = [];
  const temFase = (l: Leitura) => fases(lim, l) !== null;
  const estadoBomba = (l: Leitura) => bombaLigada(l) !== null;
  const temDado: Record<TipoAlerta, (l: Leitura) => boolean> = {
    NIVEL_BAIXO: l => l.nivelM !== null, A_SECO: l => l.correnteA !== null, SOBRECORRENTE: l => l.correnteA !== null,
    VAZAO_BAIXA: l => l.vazaoLh !== null || bombaLigada(l) === false, TENSAO: l => l.tensaoV !== null || temFase(l), SEM_SINAL: () => true,
    FALTA_FASE: temFase, SEM_ENERGIA: temFase, NAO_PARTE: l => l.boiaPedindo !== null || l.comandoLigado !== null,
    SEM_FUNCIONAMENTO: l => l.comandoLigado !== null || l.correnteA !== null, TERMICO: l => l.termicoOk !== null,
    PRESSAO_BAIXA: l => l.pressaoBar !== null || bombaLigada(l) === false, LIGADA_DEMAIS: estadoBomba, PARTIDAS_DEMAIS: estadoBomba,
  };
  let ctx = contexto;
  for (const l of leituras) {
    const depois = avancarContexto(ctx, l, lim);
    // as partidas já contam a desta leitura; o resto do contexto é o de antes dela
    const conds = condicoesDaLeitura(lim, l, { ...ctx, partidasHora: depois.partidasHora });
    const agora = new Set(conds.map(x => x.tipo));
    for (const cond of conds) if (!aberto.has(cond.tipo)) { aberto.add(cond.tipo); abrir.push({ ...cond, inicio: l.em }); }
    for (const t of [...aberto]) {
      if (!agora.has(t) && temDado[t](l)) {
        aberto.delete(t);
        const novo = abrir.find(a => a.tipo === t && !a.fim);
        if (novo) novo.fim = l.em; else fechar.push({ tipo: t, fim: l.em });
      }
    }
    ctx = depois;
  }
  return { abrir, fechar };
};

export type StatusDispositivo = 'ONLINE' | 'ATRASADO' | 'SEM_SINAL' | 'NUNCA' | 'OFFLINE';
/** Online até 1,5× o intervalo sem leitura; atrasado até 3×; depois "sem sinal". O aparelho sem internet é "offline" (importação). */
export const statusDoDispositivo = (ultima: string | null, intervaloMin: number, agora: Date, conexao = 'WIFI'): StatusDispositivo => {
  if (conexao === 'OFFLINE') return 'OFFLINE';
  if (!ultima) return 'NUNCA';
  const min = (agora.getTime() - new Date(ultima.replace(' ', 'T')).getTime()) / 60000;
  return min <= intervaloMin * 1.5 ? 'ONLINE' : min <= intervaloMin * FATOR_SEM_SINAL ? 'ATRASADO' : 'SEM_SINAL';
};

// ------------------------------------------------------------------ resumo do dia e relatório do mês
/**
 * Resumo por dia: nível estático (média com a bomba desligada), dinâmico (média ligada), vazão e pressão médias ligada,
 * horas de bomba, volume, partidas e energia. Horas e volume somam o tempo entre leituras seguidas com a bomba ligada
 * (limitado a 2× o intervalo, para um buraco sem sinal não virar horas de bomba). Partidas e energia usam o contador
 * do aparelho quando ele manda (diferença do dia); senão, as partidas contam as passagens de desligada para ligada.
 */
export const resumoPorDia = (leituras: Leitura[], intervaloMin: number) => {
  type Dia = { ne: number[]; nd: number[]; vazao: number[]; pressao: number[]; horas: number; litros: number; leituras: number; partidas: number;
    contPart: number[]; energia: number[]; ligada: boolean | null };
  const dias = new Map<string, Dia>();
  const ordem = [...leituras].sort((a, b) => a.em.localeCompare(b.em));
  let anterior: boolean | null = null;
  ordem.forEach((l, i) => {
    const dia = l.em.slice(0, 10);
    const d = dias.get(dia) || { ne: [], nd: [], vazao: [], pressao: [], horas: 0, litros: 0, leituras: 0, partidas: 0, contPart: [], energia: [], ligada: null };
    d.leituras++;
    const ligada = bombaLigada(l);
    if (l.nivelM !== null) (ligada ? d.nd : d.ne).push(l.nivelM);
    if (ligada && l.vazaoLh !== null) d.vazao.push(l.vazaoLh);
    if (ligada && l.pressaoBar !== null) d.pressao.push(l.pressaoBar);
    if (ligada === true && anterior === false) d.partidas++;
    if (l.partidas !== null) d.contPart.push(l.partidas);
    if (l.energiaKwh !== null) d.energia.push(l.energiaKwh);
    const prox = ordem[i + 1];
    if (ligada && prox) {
      const h = Math.min(minutos(l.em, prox.em) / 60, (intervaloMin * 2) / 60);
      d.horas += h;
      if (l.vazaoLh !== null) d.litros += l.vazaoLh * h;
    }
    if (ligada !== null) anterior = ligada;
    dias.set(dia, d);
  });
  const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);
  const faixa = (xs: number[]) => (xs.length > 1 ? Math.max(0, Math.max(...xs) - Math.min(...xs)) : null);
  return [...dias.entries()].map(([dia, d]) => {
    const kwh = faixa(d.energia);
    return {
      dia, leituras: d.leituras, nivelEstaticoM: media(d.ne), nivelDinamicoM: media(d.nd), vazaoMediaLh: media(d.vazao), pressaoMediaBar: media(d.pressao),
      horasBomba: Math.round(d.horas * 100) / 100, volumeM3: Math.round(d.litros / 10) / 100,
      partidas: faixa(d.contPart) ?? d.partidas, energiaKwh: kwh === null ? null : Math.round(kwh * 1000) / 1000,
    };
  });
};

/**
 * Relatório do mês: os dias, os totais (horas, volume, partidas, energia, custo pela tarifa), m³ por kWh (se cair mês
 * a mês, bomba gasta ou poço perdendo vazão), nível médio, alertas por tipo e a disponibilidade (% das leituras
 * esperadas que chegaram, até hoje).
 */
export const relatorioDoMes = (mes: string, leituras: Leitura[], intervaloMin: number, tarifaKwh: number | null, alertas: { tipo: string }[], agora: Date) => {
  const dias = resumoPorDia(leituras.filter(l => l.em.startsWith(mes)), intervaloMin);
  const soma = (k: 'horasBomba' | 'volumeM3' | 'partidas') => Math.round(dias.reduce((s, d) => s + (d[k] || 0), 0) * 100) / 100;
  const comEnergia = dias.filter(d => d.energiaKwh !== null);
  const kwh = comEnergia.length ? Math.round(comEnergia.reduce((s, d) => s + (d.energiaKwh || 0), 0) * 1000) / 1000 : null;
  const [a, m] = mes.split('-').map(Number);
  const inicio = new Date(a, m - 1, 1), fim = new Date(a, m, 1);
  const ate = agora < fim ? agora : fim;
  const esperadas = ate > inicio ? Math.floor((ate.getTime() - inicio.getTime()) / 60000 / intervaloMin) : 0;
  const recebidas = dias.reduce((s, d) => s + d.leituras, 0);
  const nds = dias.map(d => d.nivelDinamicoM).filter((x): x is number => x !== null);
  const nes = dias.map(d => d.nivelEstaticoM).filter((x): x is number => x !== null);
  const porTipo: Record<string, number> = {};
  for (const x of alertas) porTipo[x.tipo] = (porTipo[x.tipo] || 0) + 1;
  const volume = soma('volumeM3');
  return {
    mes, dias,
    totais: {
      horasBomba: soma('horasBomba'), volumeM3: volume, partidas: soma('partidas'), energiaKwh: kwh,
      custoEnergia: kwh !== null && tarifaKwh !== null ? Math.round(kwh * tarifaKwh * 100) / 100 : null,
      m3PorKwh: kwh ? Math.round((volume / kwh) * 100) / 100 : null,
      nivelEstaticoMedioM: nes.length ? Math.round((nes.reduce((s, x) => s + x, 0) / nes.length) * 100) / 100 : null,
      nivelDinamicoMedioM: nds.length ? Math.round((nds.reduce((s, x) => s + x, 0) / nds.length) * 100) / 100 : null,
      disponibilidade: esperadas ? Math.min(100, Math.round((recebidas / esperadas) * 1000) / 10) : null, leituras: recebidas,
    },
    alertasPorTipo: porTipo,
  };
};

// ------------------------------------------------------------------ comandos remotos
/** Um comando só vale para o aparelho que aceita comandos; BLOQUEAR pede motivo (fica registrado). */
export const validarComando = (b: any, aceita: boolean) => {
  if (!aceita) throw new ErroObra('Este aparelho não aceita comandos (ligue "aceita comandos" no cadastro).', 409);
  const comando = String(b?.comando || '').toUpperCase();
  if (!(COMANDOS as readonly string[]).includes(comando)) throw new ErroObra(`Comando inválido: ${b?.comando}.`);
  const motivo = texto(b?.motivo, 255);
  if (comando === 'BLOQUEAR' && !motivo) throw new ErroObra('Diga o motivo do bloqueio (fica registrado).');
  return { comando: comando as Comando, motivo };
};
