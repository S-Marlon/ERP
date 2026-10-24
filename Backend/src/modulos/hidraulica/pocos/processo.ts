// Obras de poços › processo de atendimento, orçamento, obra, entrega e pós-venda: regras puras.
// 1) todo contato vira lead com origem, e a resposta tem prazo em minutos de horário comercial; 2) o orçamento sai em
// até N horas depois da visita; 3) fotos de antes, durante e depois; 4) laudo e adesivo na entrega; 5) avaliação pedida
// N dias depois da conclusão e lembrete de revisão N meses depois. O checklist da obra diz o que está feito, pendente,
// atrasado ou ainda não é hora; os indicadores medem quanto o processo está sendo seguido.
import { ErroObra, garantiaAte } from './obras';

export const ORIGENS = ['GOOGLE', 'INDICACAO', 'PLACA', 'INSTAGRAM', 'FACEBOOK', 'SITE', 'WHATSAPP', 'OUTRO'] as const;
export const SITUACOES_LEAD = ['NOVO', 'EM_CONTATO', 'VISITA_AGENDADA', 'ORCAMENTO_ENVIADO', 'CONVERTIDO', 'PERDIDO'] as const;
export type SituacaoLead = typeof SITUACOES_LEAD[number];
/** Etapas registradas à mão (as fotos saem da tabela de fotos). */
export const ETAPAS_REGISTRO = ['VISITA', 'ORCAMENTO_ENVIADO', 'LAUDO_ENTREGUE', 'ADESIVO_QUADRO', 'AVALIACAO_PEDIDA', 'AVALIACAO_RECEBIDA', 'REVISAO_LEMBRADA'] as const;
export type EtapaRegistro = typeof ETAPAS_REGISTRO[number];
export const ETAPAS_FOTO = ['ANTES', 'DURANTE', 'DEPOIS'] as const;
export type EtapaFoto = typeof ETAPAS_FOTO[number];

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const textoLongo = (v: unknown, max: number) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max) || null;
const digitos = (v: unknown, max = 20) => String(v ?? '').replace(/\D/g, '').slice(0, max) || null;

// ------------------------------------------------------------------ horário comercial e prazos
export interface Horario { abre: string; fecha: string; sabadoFecha: string | null }
export const HORARIO_PADRAO: Horario = { abre: '08:00', fecha: '18:00', sabadoFecha: '12:00' };

const minutosDoDia = (hhmm: string) => { const [h, m] = hhmm.slice(0, 5).split(':').map(Number); return h * 60 + m; };
const lerDataHora = (s: string) => new Date(s.replace(' ', 'T'));
const formatar = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
/** A janela de atendimento do dia (minutos desde 0h), ou null se não atende (domingo; sábado sem horário). */
const janela = (d: Date, h: Horario): [number, number] | null => {
  const dia = d.getDay();
  if (dia === 0) return null;
  if (dia === 6) return h.sabadoFecha ? [minutosDoDia(h.abre), minutosDoDia(h.sabadoFecha)] : null;
  return [minutosDoDia(h.abre), minutosDoDia(h.fecha)];
};

/**
 * Prazo de resposta: soma `minutos` de horário comercial a partir de `inicio` (contato à noite ou no domingo começa a
 * contar quando a empresa abre). Devolve "AAAA-MM-DD HH:MM:SS".
 */
export const somarMinutosUteis = (inicio: string, minutos: number, h: Horario = HORARIO_PADRAO) => {
  let d = lerDataHora(inicio);
  let resta = Math.max(0, minutos);
  for (let i = 0; i < 400; i++) {
    const j = janela(d, h);
    const agoraMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    if (j && agoraMin < j[1]) {
      const comeco = Math.max(agoraMin, j[0]);
      const livre = j[1] - comeco;
      if (resta <= livre) {
        const meiaNoite = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        return formatar(new Date(meiaNoite.getTime() + Math.round((comeco + resta) * 60) * 1000));
      }
      resta -= livre;
    }
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
  }
  return formatar(d);
};

export type EstadoPrazo = 'NO_PRAZO' | 'FORA_DO_PRAZO' | 'CORRENDO' | 'ATRASADO';
/** Feito até o prazo = no prazo; feito depois = fora do prazo; não feito = correndo (ainda dá) ou atrasado. */
export const estadoDoPrazo = (prazo: string, feitoEm: string | null, agora: string): EstadoPrazo =>
  feitoEm ? (feitoEm <= prazo ? 'NO_PRAZO' : 'FORA_DO_PRAZO') : agora <= prazo ? 'CORRENDO' : 'ATRASADO';

// ------------------------------------------------------------------ leads
export const validarLead = (b: any, agora: string) => {
  const nome = texto(b?.nome, 120);
  if (!nome) throw new ErroObra('Informe o nome de quem entrou em contato.');
  const origem = String(b?.origem || 'OUTRO').toUpperCase();
  if (!(ORIGENS as readonly string[]).includes(origem)) throw new ErroObra(`Origem inválida: ${b?.origem}.`);
  const telefone = digitos(b?.telefone);
  if (telefone && telefone.length < 8) throw new ErroObra('Telefone incompleto.');
  const recebido = b?.recebidoEm ? String(b.recebidoEm).replace('T', ' ').slice(0, 19) : agora;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(recebido)) throw new ErroObra('Hora do contato inválida.');
  const recebidoEm = recebido.length === 16 ? `${recebido}:00` : recebido;
  if (recebidoEm > agora) throw new ErroObra('A hora do contato não pode ser no futuro.');
  return {
    nome, telefone, origem, indicadoPor: origem === 'INDICACAO' ? texto(b?.indicadoPor, 120) : null, cidade: texto(b?.cidade, 60),
    necessidade: texto(b?.necessidade, 255), recebidoEm, observacao: texto(b?.observacao, 255),
  };
};

/**
 * A situação que o lead mostra: perdido é perdido; se a obra que saiu dele já passou do orçamento, convertido; se o
 * orçamento já foi enviado (etapa da obra), orçamento enviado; senão, o que foi marcado.
 */
export const situacaoDoLead = (gravada: SituacaoLead, obraSituacao: string | null, orcamentoEnviado: boolean): SituacaoLead => {
  if (gravada === 'PERDIDO') return 'PERDIDO';
  if (obraSituacao && ['AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CONCLUIDA'].includes(obraSituacao)) return 'CONVERTIDO';
  if (orcamentoEnviado) return 'ORCAMENTO_ENVIADO';
  return gravada;
};

// ------------------------------------------------------------------ configuração
export interface ConfigProcesso {
  respostaLeadMin: number; orcamentoHoras: number; avaliacaoDias: number; revisaoMeses: number; horario: Horario;
}
export const CONFIG_PADRAO: ConfigProcesso = { respostaLeadMin: 60, orcamentoHoras: 24, avaliacaoDias: 7, revisaoMeses: 11, horario: HORARIO_PADRAO };
export const MSG_AVALIACAO_PADRAO =
  'Olá, {cliente}! Aqui é da {empresa}. Faz uma semana que entregamos o seu poço: está tudo funcionando bem? '
  + 'Se puder, deixe sua avaliação no Google, ajuda muito o nosso trabalho: {link}';
export const MSG_REVISAO_PADRAO =
  'Olá, {cliente}! Aqui é da {empresa}. Já faz quase um ano que fizemos o seu poço ({poco}). Recomendamos uma revisão '
  + 'preventiva (bomba, quadro e vazão) para evitar parada. Quer agendar uma visita?';

const hora = (v: unknown, nome: string, vazio: string | null) => {
  if (v === undefined || v === null || v === '') return vazio;
  const s = String(v).slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new ErroObra(`${nome}: hora inválida (use 08:00).`);
  return s;
};
const inteiro = (v: unknown, nome: string, min: number, max: number, padrao: number) => {
  if (v === undefined || v === null || v === '') return padrao;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new ErroObra(`${nome}: de ${min} a ${max}.`);
  return n;
};

export const validarConfig = (b: any) => {
  const email = texto(b?.empresaEmail, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroObra('E-mail inválido.');
  const link = texto(b?.linkAvaliacao, 255);
  if (link && !/^https?:\/\//i.test(link)) throw new ErroObra('O link de avaliação deve começar com http:// ou https://.');
  const c = {
    empresaNome: texto(b?.empresaNome, 120), empresaDocumento: digitos(b?.empresaDocumento), empresaTelefone: digitos(b?.empresaTelefone),
    empresaWhatsapp: digitos(b?.empresaWhatsapp), empresaEmail: email ? email.toLowerCase() : null, empresaEndereco: texto(b?.empresaEndereco, 200),
    textoGarantia: textoLongo(b?.textoGarantia, 2000), formaPagamentoPadrao: texto(b?.formaPagamentoPadrao, 255),
    validadeOrcamentoDias: inteiro(b?.validadeOrcamentoDias, 'Validade do orçamento', 1, 365, 15), linkAvaliacao: link,
    msgAvaliacao: textoLongo(b?.msgAvaliacao, 1000), msgRevisao: textoLongo(b?.msgRevisao, 1000),
    respostaLeadMin: inteiro(b?.respostaLeadMin, 'Prazo de resposta', 5, 1440, 60), orcamentoHoras: inteiro(b?.orcamentoHoras, 'Prazo do orçamento', 1, 240, 24),
    avaliacaoDias: inteiro(b?.avaliacaoDias, 'Dias para pedir avaliação', 1, 90, 7), revisaoMeses: inteiro(b?.revisaoMeses, 'Meses para a revisão', 1, 60, 11),
    horaAbre: hora(b?.horaAbre, 'Abre', '08:00') as string, horaFecha: hora(b?.horaFecha, 'Fecha', '18:00') as string, sabadoFecha: hora(b?.sabadoFecha, 'Sábado', null),
  };
  if (c.horaFecha <= c.horaAbre) throw new ErroObra('O horário de fechar tem de ser depois do de abrir.');
  if (c.sabadoFecha && c.sabadoFecha <= c.horaAbre) throw new ErroObra('O horário de sábado tem de ser depois do de abrir.');
  return c;
};

// ------------------------------------------------------------------ checklist da obra
export type EstadoEtapa = 'FEITO' | 'NAO_SE_APLICA' | 'PENDENTE' | 'ATRASADO' | 'AINDA_NAO' | 'OPCIONAL';
export interface ItemChecklist {
  etapa: EtapaRegistro | `FOTOS_${EtapaFoto}`; titulo: string; grupo: 'ORCAMENTO' | 'OBRA' | 'ENTREGA' | 'POS_VENDA';
  estado: EstadoEtapa; prazo: string | null; feitoEm: string | null; observacao: string | null; manual: boolean; noPrazo: boolean | null;
}
export interface ObraParaProcesso {
  situacao: string; criadaEm: string; dataInicio: string | null; dataTermino: string | null; servicos: string[];
}
export interface EventoProcesso { etapa: string; situacao: 'FEITO' | 'NAO_SE_APLICA'; feitoEm: string; observacao: string | null }

const somarHoras = (s: string, horas: number) => { const d = lerDataHora(s); d.setMinutes(d.getMinutes() + Math.round(horas * 60)); return formatar(d); };
const somarDias = (dia: string, dias: number) => { const d = lerDataHora(`${dia.slice(0, 10)} 23:59:59`); d.setDate(d.getDate() + dias); return formatar(d); };

/**
 * O checklist da obra, na ordem do processo. Cada etapa só "vale" a partir de um momento: o orçamento conta da visita
 * (ou da criação da obra); as fotos de antes, do início; durante, depois e a entrega, da conclusão; a avaliação, N dias
 * depois da conclusão; a revisão, N meses depois. Antes disso a etapa aparece como "ainda não". Obra cancelada não
 * tem processo.
 */
export const checklistDaObra = (o: ObraParaProcesso, eventos: EventoProcesso[], fotos: Partial<Record<EtapaFoto, number>>, cfg: ConfigProcesso, agora: string): ItemChecklist[] => {
  if (o.situacao === 'CANCELADA') return [];
  const ev = new Map(eventos.map(e => [e.etapa, e]));
  const iniciada = ['EM_EXECUCAO', 'CONCLUIDA'].includes(o.situacao);
  const concluida = o.situacao === 'CONCLUIDA';
  const termino = o.dataTermino;
  const itens: ItemChecklist[] = [];
  const manual = (etapa: EtapaRegistro, titulo: string, grupo: ItemChecklist['grupo'], valeDesde: string | null, prazo: string | null, opcional = false) => {
    const e = ev.get(etapa);
    let estado: EstadoEtapa;
    if (e) estado = e.situacao === 'NAO_SE_APLICA' ? 'NAO_SE_APLICA' : 'FEITO';
    else if (opcional) estado = 'OPCIONAL';
    else if (!valeDesde || agora < valeDesde) estado = 'AINDA_NAO';
    else estado = prazo && agora > prazo ? 'ATRASADO' : 'PENDENTE';
    itens.push({ etapa, titulo, grupo, estado, prazo, feitoEm: e?.feitoEm || null, observacao: e?.observacao || null, manual: true,
      noPrazo: e && e.situacao === 'FEITO' && prazo ? e.feitoEm <= prazo : null });
  };
  const foto = (etapa: EtapaFoto, titulo: string, vale: boolean) => {
    const qtd = fotos[etapa] || 0;
    itens.push({ etapa: `FOTOS_${etapa}`, titulo: `${titulo}${qtd ? ` (${qtd})` : ''}`, grupo: 'OBRA', manual: false, noPrazo: null, prazo: null, feitoEm: null,
      observacao: null, estado: qtd ? 'FEITO' : vale ? 'PENDENTE' : 'AINDA_NAO' });
  };
  const visita = ev.get('VISITA');
  manual('VISITA', 'Visita técnica', 'ORCAMENTO', o.criadaEm, null);
  const baseOrcamento = visita && visita.situacao === 'FEITO' ? visita.feitoEm : o.criadaEm;
  manual('ORCAMENTO_ENVIADO', `Orçamento enviado (até ${cfg.orcamentoHoras} h da visita)`, 'ORCAMENTO', baseOrcamento, somarHoras(baseOrcamento, cfg.orcamentoHoras));
  foto('ANTES', 'Fotos de antes', iniciada);
  foto('DURANTE', 'Fotos durante', concluida);
  foto('DEPOIS', 'Fotos de depois', concluida);
  const desdeFim = concluida && termino ? `${termino} 00:00:00` : null;
  manual('LAUDO_ENTREGUE', 'Laudo entregue (profundidade, vazão, nível)', 'ENTREGA', desdeFim, termino ? somarDias(termino, 3) : null);
  manual('ADESIVO_QUADRO', 'Adesivo com o telefone no quadro', 'ENTREGA', desdeFim, termino ? somarDias(termino, 3) : null);
  const avaliacaoDesde = concluida && termino ? `${somarDias(termino, cfg.avaliacaoDias - 1).slice(0, 10)} 00:00:00` : null;
  manual('AVALIACAO_PEDIDA', `Avaliação no Google pedida (${cfg.avaliacaoDias} dias)`, 'POS_VENDA', avaliacaoDesde, avaliacaoDesde ? somarDias(avaliacaoDesde, 3) : null);
  manual('AVALIACAO_RECEBIDA', 'Cliente avaliou', 'POS_VENDA', null, null, true);
  const revisao = concluida && termino ? `${garantiaAte(termino, cfg.revisaoMeses)} 00:00:00` : null;
  manual('REVISAO_LEMBRADA', `Lembrete de revisão (${cfg.revisaoMeses} meses)`, 'POS_VENDA', revisao, revisao ? somarDias(revisao, 15) : null);
  return itens;
};

/** Resumo do checklist para listas: quantas etapas pendentes e atrasadas, e se o que já vale está todo feito. */
export const resumoDoChecklist = (itens: ItemChecklist[]) => ({
  pendentes: itens.filter(i => i.estado === 'PENDENTE').length, atrasadas: itens.filter(i => i.estado === 'ATRASADO').length,
  feitas: itens.filter(i => i.estado === 'FEITO' || i.estado === 'NAO_SE_APLICA').length,
  emDia: itens.every(i => i.estado !== 'PENDENTE' && i.estado !== 'ATRASADO'),
});

// ------------------------------------------------------------------ WhatsApp
/** Link do WhatsApp com a mensagem pronta (número brasileiro ganha o 55). */
export const linkWhatsapp = (telefone: string | null, mensagem = '') => {
  const d = String(telefone ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  const numero = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${numero}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
};
/** Troca {cliente}, {empresa}, {link}, {poco}, {obra} da mensagem pelos valores (o que faltar some). */
export const preencherMensagem = (modelo: string, v: Record<string, string | number | null | undefined>) =>
  modelo.replace(/\{(\w+)\}/g, (_, k) => (v[k] === null || v[k] === undefined ? '' : String(v[k]))).replace(/ {2,}/g, ' ').trim();

// ------------------------------------------------------------------ indicadores
export interface LeadParaIndicador { origem: string; recebidoEm: string; respondidoEm: string | null; prazo: string; situacao: SituacaoLead; valorFechado: number | null }
/**
 * Indicadores do processo no período: % de leads respondidos no prazo (dos que já venceram ou foram respondidos), leads
 * por origem com conversão e valor fechado, % de orçamentos no prazo, % de obras concluídas com as 3 fotos e as
 * avaliações pedidas/recebidas.
 */
export const indicadores = (
  leads: LeadParaIndicador[], agora: string,
  orcamentos: { noPrazo: boolean }[], concluidas: { fotosCompletas: boolean; avaliacaoPedida: boolean; avaliacaoRecebida: boolean }[],
) => {
  const medidos = leads.filter(l => l.respondidoEm || agora > l.prazo);
  const noPrazo = medidos.filter(l => l.respondidoEm && l.respondidoEm <= l.prazo).length;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const origens = new Map<string, { leads: number; convertidos: number; perdidos: number; valor: number }>();
  for (const l of leads) {
    const o = origens.get(l.origem) || { leads: 0, convertidos: 0, perdidos: 0, valor: 0 };
    o.leads++;
    if (l.situacao === 'CONVERTIDO') { o.convertidos++; o.valor += Math.round((l.valorFechado || 0) * 100); }
    if (l.situacao === 'PERDIDO') o.perdidos++;
    origens.set(l.origem, o);
  }
  return {
    leads: leads.length, respostaNoPrazo: pct(noPrazo, medidos.length), respostaMedidos: medidos.length,
    porOrigem: [...origens.entries()].map(([origem, o]) => ({ origem, leads: o.leads, convertidos: o.convertidos, perdidos: o.perdidos,
      conversao: pct(o.convertidos, o.leads), valorFechado: o.valor / 100 })).sort((a, b) => b.leads - a.leads),
    orcamentoNoPrazo: pct(orcamentos.filter(x => x.noPrazo).length, orcamentos.length), orcamentos: orcamentos.length,
    fotosCompletas: pct(concluidas.filter(x => x.fotosCompletas).length, concluidas.length), concluidas: concluidas.length,
    avaliacoesPedidas: concluidas.filter(x => x.avaliacaoPedida).length, avaliacoesRecebidas: concluidas.filter(x => x.avaliacaoRecebida).length,
  };
};
