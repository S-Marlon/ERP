// Obras de poços › Central: regras puras do painel central do módulo.
// 1) Contratos a finalizar: em que fase está cada obra aberta e o que falta para fechar (comercial, execução, entrega,
//    cobrança e dados). Obra concluída sem nada faltando sai da lista.
// 2) Informações a completar: o que falta na ficha do cliente e do poço (a base do plano mensal e do mapa).
// 3) Prévia do plano mensal: chance de cada cliente assinar um plano de manutenção/monitoramento (pontos com o motivo de
//    cada um) e uma estimativa do valor mensal, com a base do cálculo à vista. Os pesos e valores ficam aqui, num lugar
//    só, para calibrar quando o plano for criado.

// ------------------------------------------------------------------ contratos a finalizar
export type FaseContrato = 'NEGOCIACAO' | 'SINAL' | 'EXECUCAO' | 'FECHAMENTO';
export type AcaoPendencia = 'PROCESSO' | 'COBRANCA' | 'MATERIAIS' | 'DADOS_OBRA' | 'POCO' | 'CLIENTE';
export interface PendenciaContrato { texto: string; gravidade: 'ALTA' | 'MEDIA' | 'BAIXA'; acao: AcaoPendencia }

export interface ContratoParaCentral {
  situacao: string; servicos: string[]; criadaEm: string; dataPrevisao: string | null; dataInicio: string | null; dataTermino: string | null;
  valorContratado: number | null; garantiaMeses: number | null; total: number; parcelado: number; recebido: number; vencido: number;
  temPoco: boolean; pocoComGps: boolean; pocoComProfundidade: boolean; pocoComVazao: boolean; clienteComTelefone: boolean;
  materiaisLinhas: number; materiaisSemConferir: number;
  /** As etapas do checklist do processo que estão pendentes ou atrasadas (do checklist da obra). */
  etapasProcesso: { titulo: string; estado: 'PENDENTE' | 'ATRASADO' }[];
}

const dias = (de: string, hoje: string) => Math.round((new Date(`${hoje.slice(0, 10)}T12:00:00`).getTime() - new Date(`${de.slice(0, 10)}T12:00:00`).getTime()) / 86400000);
const brl = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const faseDoContrato = (situacao: string): FaseContrato | null =>
  situacao === 'ORCAMENTO' ? 'NEGOCIACAO' : situacao === 'AGUARDANDO_SINAL' ? 'SINAL' : situacao === 'EM_EXECUCAO' ? 'EXECUCAO' : situacao === 'CONCLUIDA' ? 'FECHAMENTO' : null;

/**
 * O que falta para o contrato fechar. Obra concluída sem pendência nenhuma não aparece (devolve lista vazia); a ordem
 * é da mais grave para a mais leve.
 */
export const pendenciasDoContrato = (c: ContratoParaCentral, hoje: string): PendenciaContrato[] => {
  const p: PendenciaContrato[] = [];
  const perfuracao = c.servicos.includes('PERFURACAO');
  if (c.situacao === 'ORCAMENTO') {
    if (!c.valorContratado) p.push({ texto: 'Orçamento sem valor', gravidade: 'ALTA', acao: 'DADOS_OBRA' });
    const parado = dias(c.criadaEm, hoje);
    if (parado > 15) p.push({ texto: `Orçamento sem resposta há ${parado} dias`, gravidade: parado > 30 ? 'ALTA' : 'MEDIA', acao: 'PROCESSO' });
  }
  if (c.situacao === 'AGUARDANDO_SINAL') p.push({ texto: 'Aguardando o sinal para começar', gravidade: 'MEDIA', acao: 'COBRANCA' });
  if ((c.situacao === 'ORCAMENTO' || c.situacao === 'AGUARDANDO_SINAL') && c.dataPrevisao && c.dataPrevisao < hoje) {
    p.push({ texto: `Início previsto para ${c.dataPrevisao.slice(8, 10)}/${c.dataPrevisao.slice(5, 7)} passou`, gravidade: 'ALTA', acao: 'DADOS_OBRA' });
  }
  if (c.situacao === 'EM_EXECUCAO' && c.dataInicio && dias(c.dataInicio, hoje) > 15) {
    p.push({ texto: `Em execução há ${dias(c.dataInicio, hoje)} dias`, gravidade: 'MEDIA', acao: 'DADOS_OBRA' });
  }
  if (c.situacao === 'CONCLUIDA') {
    const semParcela = Math.round((c.total - c.parcelado) * 100) / 100;
    if (semParcela > 0) p.push({ texto: `${brl(semParcela)} sem parcela lançada`, gravidade: 'ALTA', acao: 'COBRANCA' });
    if (c.vencido > 0) p.push({ texto: `${brl(c.vencido)} vencido`, gravidade: 'ALTA', acao: 'COBRANCA' });
    const aReceber = Math.round((c.parcelado - c.recebido - c.vencido) * 100) / 100;
    if (aReceber > 0) p.push({ texto: `${brl(aReceber)} a receber (em dia)`, gravidade: 'BAIXA', acao: 'COBRANCA' });
    if (c.materiaisLinhas === 0) p.push({ texto: 'Materiais não lançados (custo da obra)', gravidade: 'MEDIA', acao: 'MATERIAIS' });
    else if (c.materiaisSemConferir > 0) p.push({ texto: `${c.materiaisSemConferir} material(is) sem conferir o usado`, gravidade: 'MEDIA', acao: 'MATERIAIS' });
    if (!c.garantiaMeses) p.push({ texto: 'Garantia não definida', gravidade: 'BAIXA', acao: 'DADOS_OBRA' });
    if (!c.temPoco) p.push({ texto: 'Obra sem poço ligado', gravidade: perfuracao ? 'ALTA' : 'MEDIA', acao: 'DADOS_OBRA' });
    else {
      if (!c.pocoComGps) p.push({ texto: 'Poço sem GPS (fica fora do mapa)', gravidade: 'MEDIA', acao: 'POCO' });
      if (perfuracao && !c.pocoComProfundidade) p.push({ texto: 'Poço sem profundidade', gravidade: 'MEDIA', acao: 'POCO' });
      if (perfuracao && !c.pocoComVazao) p.push({ texto: 'Poço sem vazão', gravidade: 'BAIXA', acao: 'POCO' });
    }
  }
  if (!c.clienteComTelefone && c.situacao !== 'ORCAMENTO') p.push({ texto: 'Cliente sem telefone', gravidade: 'MEDIA', acao: 'CLIENTE' });
  for (const e of c.etapasProcesso) p.push({ texto: e.titulo, gravidade: e.estado === 'ATRASADO' ? 'ALTA' : 'BAIXA', acao: 'PROCESSO' });
  const peso = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
  return p.sort((a, b) => peso[a.gravidade] - peso[b.gravidade]);
};

// ------------------------------------------------------------------ informações a completar
export interface ClienteParaCompletar { telefone: string | null; documento: string | null; endereco: string | null; cidade: string | null }
export interface PocoParaCompletar {
  latitude: number | null; profundidadeM: number | null; vazaoLh: number | null; nivelEstaticoM: number | null; diametro: string | null;
  dataPerfuracao: string | null; idProprietario: number | null; perfuradoPor: string;
  /** Conjunto motobomba registrado (undefined = não conta, para quem chama sem essa informação). */
  temConjunto?: boolean;
}
const completude = (itens: [string, boolean][]) => {
  const faltando = itens.filter(([, ok]) => !ok).map(([n]) => n);
  return { pct: Math.round(((itens.length - faltando.length) / itens.length) * 100), faltando };
};
/** Cliente: telefone (para o WhatsApp), cidade, endereço e documento (para contrato e nota). */
export const completudeCliente = (c: ClienteParaCompletar) => completude([
  ['telefone', !!c.telefone], ['cidade', !!c.cidade], ['endereço', !!c.endereco], ['CPF/CNPJ', !!c.documento],
]);
/** Poço: dono, GPS (mapa), profundidade, vazão, nível estático, diâmetro, data da perfuração e a bomba (para a manutenção e o plano). */
export const completudePoco = (p: PocoParaCompletar) => completude([
  ['dono', !!p.idProprietario], ['GPS', p.latitude !== null], ['profundidade', !!p.profundidadeM], ['vazão', !!p.vazaoLh],
  ['nível estático', p.nivelEstaticoM !== null], ['diâmetro', !!p.diametro], ['data da perfuração', !!p.dataPerfuracao || p.perfuradoPor === 'DESCONHECIDO'],
  ...(p.temConjunto === undefined ? [] : [['bomba (conjunto)', p.temConjunto] as [string, boolean]]),
]);

// ------------------------------------------------------------------ prévia do plano mensal
export interface ClienteParaPlano {
  pocos: number; pocosNossos: number; idadeMaisVelhoAnos: number | null; profundidadeMaxM: number | null;
  obrasConcluidas: number; obrasManutencao: number; valorGasto: number; mesesDesdeUltimaObra: number | null; mesesDesdeUltimaManutencao: number | null;
  garantiaVencida: boolean; garantiaVencendoMeses: number | null; avaliou: boolean; temIot: boolean; temPlanoManutencao: boolean;
  parcelasVencidas: number; temTelefone: boolean; obraAberta: boolean;
  /** Conjunto motobomba: anos da bomba instalada mais antiga e quantas trocas já houve nos poços do cliente. */
  bombaMaisVelhaAnos?: number | null; trocasBomba?: number;
}
export interface MotivoPonto { texto: string; pontos: number }

/** Pesos da chance de assinar o plano (somam no máximo 100; os negativos tiram). Calibrar com os primeiros planos. */
export const PESOS_PLANO = {
  pocoNosso: 20, recorrencia: 15, garantiaAcabando: 15, pocoVelho: 10, pocoFundo: 5, relacionamento: 10, pagaEmDia: 10, iot: 10, cliente: 5,
  bombaVelha: 10, trocaBomba: 5,
  inadimplente: -25, semTelefone: -15, semPoco: -30,
};

/** A partir de quantos anos de uso a bomba pede mais atenção (mais pontos e 2 visitas por ano). */
export const BOMBA_VELHA_ANOS = 5;

/**
 * Chance de o cliente assinar um plano mensal de manutenção/monitoramento: soma de pontos com o motivo de cada um.
 * Alta ≥ 60, média 35–59, baixa < 35. Cliente sem poço quase não tem o que manter.
 */
export const propensaoPlano = (c: ClienteParaPlano) => {
  const m: MotivoPonto[] = [];
  const P = PESOS_PLANO;
  if (!c.pocos) m.push({ texto: 'Sem poço cadastrado', pontos: P.semPoco });
  if (c.pocosNossos) m.push({ texto: 'Poço perfurado ou instalado por nós', pontos: P.pocoNosso });
  if (c.obrasManutencao) m.push({ texto: `Já contratou manutenção/limpeza (${c.obrasManutencao}×)`, pontos: P.recorrencia });
  if (c.garantiaVencida) m.push({ texto: 'Garantia já venceu (fica sem cobertura)', pontos: P.garantiaAcabando });
  else if (c.garantiaVencendoMeses !== null && c.garantiaVencendoMeses <= 3) m.push({ texto: `Garantia vence em ${c.garantiaVencendoMeses} mês(es)`, pontos: P.garantiaAcabando });
  if (c.idadeMaisVelhoAnos !== null && c.idadeMaisVelhoAnos >= 3) m.push({ texto: `Poço com ${c.idadeMaisVelhoAnos} anos`, pontos: P.pocoVelho });
  if (c.profundidadeMaxM !== null && c.profundidadeMaxM >= 100) m.push({ texto: `Poço fundo (${c.profundidadeMaxM} m): manutenção mais cara de pagar de uma vez`, pontos: P.pocoFundo });
  if ((c.bombaMaisVelhaAnos ?? 0) >= BOMBA_VELHA_ANOS) m.push({ texto: `Bomba com ${c.bombaMaisVelhaAnos} anos de uso (perto da troca)`, pontos: P.bombaVelha });
  if (c.trocasBomba) m.push({ texto: `Já trocou a bomba ${c.trocasBomba}× (sabe o custo de uma troca)`, pontos: P.trocaBomba });
  if (c.avaliou) m.push({ texto: 'Avaliou a empresa', pontos: P.relacionamento });
  else if (c.obrasConcluidas >= 2) m.push({ texto: `${c.obrasConcluidas} obras concluídas com a gente`, pontos: P.relacionamento });
  if (c.obrasConcluidas && !c.parcelasVencidas) m.push({ texto: 'Paga em dia', pontos: P.pagaEmDia });
  if (c.temIot) m.push({ texto: 'Já tem monitoramento', pontos: P.iot });
  if (c.temPlanoManutencao || c.obraAberta) m.push({ texto: c.obraAberta ? 'Tem obra em andamento' : 'Tem plano de manutenção cadastrado', pontos: P.cliente });
  if (c.parcelasVencidas) m.push({ texto: `${c.parcelasVencidas} parcela(s) vencida(s)`, pontos: P.inadimplente });
  if (!c.temTelefone) m.push({ texto: 'Sem telefone (não dá para oferecer)', pontos: P.semTelefone });
  const pontos = Math.max(0, Math.min(100, m.reduce((s, x) => s + x.pontos, 0)));
  return { pontos, faixa: (pontos >= 60 ? 'ALTA' : pontos >= 35 ? 'MEDIA' : 'BAIXA') as 'ALTA' | 'MEDIA' | 'BAIXA', motivos: m };
};

/** Valores de referência da estimativa (calibrar quando o plano existir). */
export const BASE_PLANO = { visitaPadrao: 600, margem: 0.15, monitoramento: 40, faixa: 0.2 };

/**
 * Estimativa do plano mensal: visitas preventivas por ano × valor de uma visita (a média do que o cliente já pagou em
 * manutenção, ou a média da empresa, ou o padrão) ÷ 12, mais a margem e o monitoramento. Poço fundo (≥ 100 m), mais
 * de um poço ou bomba com 5 anos ou mais de uso pede 2 visitas por ano. Devolve o valor, a faixa (±20%) e a base do cálculo em texto.
 */
export const estimativaPlano = (c: Pick<ClienteParaPlano, 'pocos' | 'profundidadeMaxM' | 'temIot' | 'bombaMaisVelhaAnos'>, visitaDoCliente: number | null, visitaDaEmpresa: number | null) => {
  const visita = visitaDoCliente || visitaDaEmpresa || BASE_PLANO.visitaPadrao;
  const origem = visitaDoCliente ? 'média do que ele já pagou' : visitaDaEmpresa ? 'média das manutenções da empresa' : 'valor padrão';
  const visitasAno = (c.profundidadeMaxM ?? 0) >= 100 || c.pocos > 1 || (c.bombaMaisVelhaAnos ?? 0) >= BOMBA_VELHA_ANOS ? 2 : 1;
  const pocosNoPlano = Math.max(1, c.pocos);
  const manutencao = (visita * visitasAno * pocosNoPlano) / 12 * (1 + BASE_PLANO.margem);
  // de 5 em 5 reais, o meio sobe (o + 1e-9 evita 57,49999… do ponto flutuante)
  const de5 = (v: number) => Math.round(v / 5 + 1e-9) * 5;
  const valor = de5(manutencao + (c.temIot ? BASE_PLANO.monitoramento * pocosNoPlano : 0));
  return {
    valorMensal: valor, minimo: de5(valor * (1 - BASE_PLANO.faixa)), maximo: de5(valor * (1 + BASE_PLANO.faixa)),
    base: `${visitasAno} visita(s)/ano × ${pocosNoPlano} poço(s) × ${brl(visita)} (${origem}) ÷ 12 + ${Math.round(BASE_PLANO.margem * 100)}%`
      + `${c.temIot ? ` + monitoramento ${brl(BASE_PLANO.monitoramento)}/poço` : ''}`,
  };
};
