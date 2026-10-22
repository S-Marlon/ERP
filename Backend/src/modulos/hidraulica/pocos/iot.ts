// Obras de poços › monitoramento remoto (etapa 7): regras puras. A chave de cada aparelho é calculada da chave mestra do
// .env (HMAC) e nunca fica no banco; as leituras chegam em lote (o aparelho guarda o que mediu sem sinal); cada leitura é
// comparada com os limites do poço e abre/fecha alertas; e o resumo do dia vira medição na linha do tempo do poço.
import crypto from 'crypto';
import { ErroObra } from './obras';

export const CONEXOES = ['WIFI', 'GSM_4G', 'LORA', 'OUTRO'] as const;
export const TIPOS_ALERTA = ['NIVEL_BAIXO', 'A_SECO', 'SOBRECORRENTE', 'VAZAO_BAIXA', 'TENSAO', 'SEM_SINAL'] as const;
export type TipoAlerta = typeof TIPOS_ALERTA[number];
export const LOTE_MAXIMO = 500;
/** Sem leitura por mais que isso × o intervalo do aparelho = "sem sinal". */
export const FATOR_SEM_SINAL = 3;

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
  return Math.round(n * 100) / 100;
};

export const validarDispositivo = (b: any) => {
  const nome = texto(b?.nome, 100);
  if (!nome) throw new ErroObra('Dê um nome ao aparelho (ex.: Sensor poço Sítio São José).');
  const identificador = String(b?.identificador ?? '').trim().toUpperCase().replace(/[^A-Z0-9:_-]/g, '').slice(0, 40);
  if (identificador.length < 4) throw new ErroObra('Identificador: o nº de série ou MAC do aparelho (letras, números, ":", "-" ou "_").');
  const conexao = String(b?.conexao || 'WIFI').toUpperCase();
  if (!(CONEXOES as readonly string[]).includes(conexao)) throw new ErroObra(`Conexão inválida: ${b?.conexao}.`);
  const intervalo = Math.floor(Number(b?.intervaloMin ?? 15));
  if (!(intervalo >= 1 && intervalo <= 1440)) throw new ErroObra('Intervalo de envio: de 1 a 1440 minutos.');
  const d = {
    nome, identificador, conexao, intervaloMin: intervalo, profundidadeSensorM: numero(b?.profundidadeSensorM, 'Profundidade do sensor', 0, 2000),
    nivelAlertaM: numero(b?.nivelAlertaM, 'Nível de alerta', 0, 2000), correnteMinA: numero(b?.correnteMinA, 'Corrente mínima', 0, 1000),
    correnteMaxA: numero(b?.correnteMaxA, 'Corrente máxima', 0, 1000), vazaoMinLh: numero(b?.vazaoMinLh, 'Vazão mínima'),
    tensaoMinV: numero(b?.tensaoMinV, 'Tensão mínima', 0, 1000), tensaoMaxV: numero(b?.tensaoMaxV, 'Tensão máxima', 0, 1000),
    situacao: String(b?.situacao || 'ATIVO').toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO', observacao: texto(b?.observacao, 255),
  };
  if (d.correnteMinA !== null && d.correnteMaxA !== null && d.correnteMinA >= d.correnteMaxA) throw new ErroObra('A corrente mínima tem de ser menor que a máxima.');
  if (d.tensaoMinV !== null && d.tensaoMaxV !== null && d.tensaoMinV >= d.tensaoMaxV) throw new ErroObra('A tensão mínima tem de ser menor que a máxima.');
  return d;
};

// ------------------------------------------------------------------ leituras
export interface Leitura {
  em: string; nivelM: number | null; vazaoLh: number | null; correnteA: number | null; tensaoV: number | null; bombaLigada: boolean | null;
  horimetroH: number | null; temperaturaC: number | null; sinalDbm: number | null; bateriaV: number | null;
}

const dataHora = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/**
 * Lê o lote que o aparelho mandou ({ leituras: [...] } ou uma leitura solta). A hora vem em ISO (com fuso) ou some e
 * vale a de agora; hora mais de 10 min no futuro ou de mais de 60 dias atrás é recusada. "coluna_m" (coluna d'água
 * sobre o sensor) vira nível quando o aparelho tem a profundidade do sensor: nível = profundidade − coluna.
 * Devolve as leituras em ordem de hora (hora local do servidor, "AAAA-MM-DD HH:MM:SS").
 */
export const lerLote = (body: any, agora: Date, profundidadeSensorM: number | null): Leitura[] => {
  const lista: any[] = Array.isArray(body?.leituras) ? body.leituras : body && typeof body === 'object' ? [body] : [];
  if (!lista.length) throw new ErroObra('Nenhuma leitura no envio.');
  if (lista.length > LOTE_MAXIMO) throw new ErroObra(`No máximo ${LOTE_MAXIMO} leituras por envio.`);
  const n = (v: unknown, nome: string, min: number, max: number) => {
    if (v === undefined || v === null || v === '') return null;
    const x = Number(v);
    if (!Number.isFinite(x) || x < min || x > max) throw new ErroObra(`${nome} fora da faixa: ${v}.`);
    return Math.round(x * 100) / 100;
  };
  return lista.map(l => {
    const d = l?.em ? new Date(l.em) : agora;
    if (Number.isNaN(d.getTime())) throw new ErroObra(`Hora inválida: ${l?.em}.`);
    if (d.getTime() > agora.getTime() + 10 * 60000) throw new ErroObra(`Hora no futuro: ${l?.em} (o relógio do aparelho está certo? use NTP).`);
    if (d.getTime() < agora.getTime() - 60 * 86400000) throw new ErroObra(`Leitura de mais de 60 dias atrás: ${l?.em}.`);
    const coluna = n(l?.coluna_m, 'Coluna d\'água', 0, 2000);
    let nivel = n(l?.nivel_m, 'Nível', 0, 2000);
    if (nivel === null && coluna !== null && profundidadeSensorM !== null) nivel = Math.max(0, Math.round((profundidadeSensorM - coluna) * 100) / 100);
    const bomba = l?.bomba === undefined || l?.bomba === null ? null : l.bomba === true || l.bomba === 1 || l.bomba === '1' || String(l.bomba).toLowerCase() === 'true';
    return {
      em: dataHora(d), nivelM: nivel, vazaoLh: n(l?.vazao_lh, 'Vazão', 0, 1e7), correnteA: n(l?.corrente_a, 'Corrente', 0, 1000), tensaoV: n(l?.tensao_v, 'Tensão', 0, 1000),
      bombaLigada: bomba, horimetroH: n(l?.horimetro_h, 'Horímetro', 0, 1e7), temperaturaC: n(l?.temp_c, 'Temperatura', -40, 125),
      sinalDbm: n(l?.sinal_dbm, 'Sinal', -150, 0), bateriaV: n(l?.bateria_v, 'Bateria', 0, 60),
    };
  }).sort((a, b) => a.em.localeCompare(b.em));
};

// ------------------------------------------------------------------ alertas
export interface Limites {
  nivelAlertaM: number | null; correnteMinA: number | null; correnteMaxA: number | null; vazaoMinLh: number | null; tensaoMinV: number | null; tensaoMaxV: number | null;
}
export interface Condicao { tipo: TipoAlerta; mensagem: string; valor: number }

const v = (x: number, un: string) => `${String(x).replace('.', ',')} ${un}`;
/** Bomba ligada: o que o aparelho disse, ou corrente acima de 0,5 A quando ele não diz. */
export const bombaLigada = (l: Pick<Leitura, 'bombaLigada' | 'correnteA'>) => l.bombaLigada ?? (l.correnteA !== null ? l.correnteA > 0.5 : null);

/** As condições de alerta que uma leitura mostra (sem contar "sem sinal", que depende do tempo sem leitura). */
export const condicoesDaLeitura = (lim: Limites, l: Leitura): Condicao[] => {
  const c: Condicao[] = [];
  const ligada = bombaLigada(l);
  if (lim.nivelAlertaM !== null && l.nivelM !== null && l.nivelM > lim.nivelAlertaM) {
    c.push({ tipo: 'NIVEL_BAIXO', valor: l.nivelM, mensagem: `Água a ${v(l.nivelM, 'm')} (alerta a partir de ${v(lim.nivelAlertaM, 'm')}).` });
  }
  if (ligada && lim.correnteMinA !== null && l.correnteA !== null && l.correnteA < lim.correnteMinA) {
    c.push({ tipo: 'A_SECO', valor: l.correnteA, mensagem: `Bomba ligada com ${v(l.correnteA, 'A')} (mínimo ${v(lim.correnteMinA, 'A')}): pode estar trabalhando a seco.` });
  }
  if (lim.correnteMaxA !== null && l.correnteA !== null && l.correnteA > lim.correnteMaxA) {
    c.push({ tipo: 'SOBRECORRENTE', valor: l.correnteA, mensagem: `Corrente de ${v(l.correnteA, 'A')} (máximo ${v(lim.correnteMaxA, 'A')}).` });
  }
  if (ligada && lim.vazaoMinLh !== null && l.vazaoLh !== null && l.vazaoLh < lim.vazaoMinLh) {
    c.push({ tipo: 'VAZAO_BAIXA', valor: l.vazaoLh, mensagem: `Vazão de ${v(l.vazaoLh, 'L/h')} com a bomba ligada (mínimo ${v(lim.vazaoMinLh, 'L/h')}).` });
  }
  if (l.tensaoV !== null && ((lim.tensaoMinV !== null && l.tensaoV < lim.tensaoMinV) || (lim.tensaoMaxV !== null && l.tensaoV > lim.tensaoMaxV))) {
    c.push({ tipo: 'TENSAO', valor: l.tensaoV, mensagem: `Tensão de ${v(l.tensaoV, 'V')} (faixa ${lim.tensaoMinV ?? '—'} a ${lim.tensaoMaxV ?? '—'} V).` });
  }
  return c;
};

/**
 * O que fazer com os alertas a cada leitura (em ordem de hora): abre o tipo que apareceu e não estava aberto, fecha o
 * aberto que normalizou. Só fecha um tipo quando a leitura tem o dado dele (leitura sem corrente não fecha "a seco").
 * "Sem sinal" fecha em qualquer leitura. O alerta que abriu e fechou dentro do mesmo lote (aconteceu enquanto o
 * aparelho estava sem sinal) fica registrado com início e fim.
 */
export const reconciliar = (abertos: TipoAlerta[], leituras: Leitura[], lim: Limites) => {
  const aberto = new Set<TipoAlerta>(abertos);
  const abrir: (Condicao & { inicio: string; fim?: string })[] = [];
  const fechar: { tipo: TipoAlerta; fim: string }[] = [];
  const temDado: Record<TipoAlerta, (l: Leitura) => boolean> = {
    NIVEL_BAIXO: l => l.nivelM !== null, A_SECO: l => l.correnteA !== null, SOBRECORRENTE: l => l.correnteA !== null,
    VAZAO_BAIXA: l => l.vazaoLh !== null || bombaLigada(l) === false, TENSAO: l => l.tensaoV !== null, SEM_SINAL: () => true,
  };
  for (const l of leituras) {
    const agora = new Set(condicoesDaLeitura(lim, l).map(x => x.tipo));
    for (const cond of condicoesDaLeitura(lim, l)) if (!aberto.has(cond.tipo)) { aberto.add(cond.tipo); abrir.push({ ...cond, inicio: l.em }); }
    for (const t of [...aberto]) {
      if (!agora.has(t) && temDado[t](l)) {
        aberto.delete(t);
        const novo = abrir.find(a => a.tipo === t && !a.fim);
        if (novo) novo.fim = l.em; else fechar.push({ tipo: t, fim: l.em });
      }
    }
  }
  return { abrir, fechar };
};

export type StatusDispositivo = 'ONLINE' | 'ATRASADO' | 'SEM_SINAL' | 'NUNCA';
/** Online até 1,5× o intervalo sem leitura; atrasado até 3×; depois "sem sinal". */
export const statusDoDispositivo = (ultima: string | null, intervaloMin: number, agora: Date): StatusDispositivo => {
  if (!ultima) return 'NUNCA';
  const min = (agora.getTime() - new Date(ultima.replace(' ', 'T')).getTime()) / 60000;
  return min <= intervaloMin * 1.5 ? 'ONLINE' : min <= intervaloMin * FATOR_SEM_SINAL ? 'ATRASADO' : 'SEM_SINAL';
};

// ------------------------------------------------------------------ resumo do dia
/**
 * Resumo por dia: nível estático (média com a bomba desligada), dinâmico (média ligada), vazão média ligada, horas de
 * bomba e volume estimado. Horas e volume somam o tempo entre leituras seguidas com a bomba ligada (cada intervalo é
 * limitado a 2× o intervalo do aparelho, para um buraco sem sinal não virar horas de bomba).
 */
export const resumoPorDia = (leituras: Leitura[], intervaloMin: number) => {
  const dias = new Map<string, { ne: number[]; nd: number[]; vazao: number[]; horas: number; litros: number; leituras: number }>();
  const ordem = [...leituras].sort((a, b) => a.em.localeCompare(b.em));
  ordem.forEach((l, i) => {
    const dia = l.em.slice(0, 10);
    const d = dias.get(dia) || { ne: [], nd: [], vazao: [], horas: 0, litros: 0, leituras: 0 };
    d.leituras++;
    const ligada = bombaLigada(l);
    if (l.nivelM !== null) (ligada ? d.nd : d.ne).push(l.nivelM);
    if (ligada && l.vazaoLh !== null) d.vazao.push(l.vazaoLh);
    const prox = ordem[i + 1];
    if (ligada && prox) {
      const h = Math.min((new Date(prox.em.replace(' ', 'T')).getTime() - new Date(l.em.replace(' ', 'T')).getTime()) / 3600000, (intervaloMin * 2) / 60);
      d.horas += h;
      if (l.vazaoLh !== null) d.litros += l.vazaoLh * h;
    }
    dias.set(dia, d);
  });
  const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null);
  return [...dias.entries()].map(([dia, d]) => ({
    dia, leituras: d.leituras, nivelEstaticoM: media(d.ne), nivelDinamicoM: media(d.nd), vazaoMediaLh: media(d.vazao),
    horasBomba: Math.round(d.horas * 100) / 100, volumeM3: Math.round(d.litros / 10) / 100,
  }));
};
