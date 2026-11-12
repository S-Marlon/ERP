// Obras de poços (etapa 1): regras puras de obra e de poço. A obra tem os serviços (perfuração, instalação...), a
// situação (orçamento → aguardando sinal → em execução → concluída, ou cancelada) e o relatório técnico (o formulário
// do módulo, em JSON). O poço é uma ficha própria; a perfuração concluída atualiza a ficha com o que o relatório mediu.

export class ErroObra extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const SERVICOS = ['PERFURACAO', 'INSTALACAO', 'LIMPEZA', 'MANUTENCAO', 'TROCA_BOMBA', 'TESTE_VAZAO', 'OUTRO'] as const;
export type Servico = typeof SERVICOS[number];
export const SITUACOES_OBRA = ['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA'] as const;
export type SituacaoObra = typeof SITUACOES_OBRA[number];
export const SITUACOES_POCO = ['ATIVO', 'SECO', 'DESATIVADO'] as const;
export const PERFURADO_POR = ['NOS', 'TERCEIRO', 'DESCONHECIDO'] as const;

/** Para onde a obra pode ir de cada situação (voltar uma casa é permitido, para corrigir). */
const PASSAGENS: Record<SituacaoObra, SituacaoObra[]> = {
  ORCAMENTO: ['AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CANCELADA'],
  AGUARDANDO_SINAL: ['ORCAMENTO', 'EM_EXECUCAO', 'CANCELADA'],
  EM_EXECUCAO: ['AGUARDANDO_SINAL', 'CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: ['EM_EXECUCAO'],
  CANCELADA: ['ORCAMENTO'],
};
export const podeIrPara = (de: SituacaoObra, para: SituacaoObra) => PASSAGENS[de]?.includes(para) ?? false;
export const proximasSituacoes = (de: SituacaoObra) => PASSAGENS[de] || [];

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const numero = (v: unknown, nome: string, max = 1e9) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new ErroObra(`${nome}: número inválido.`);
  return Math.round(n * 10000) / 10000;
};
const dataIso = (v: unknown, nome: string) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T12:00:00`).getTime())) throw new ErroObra(`${nome}: data inválida.`);
  return s;
};

/** Os serviços da obra: lista sem repetir, na ordem da lista padrão (vem como array ou "A,B"). */
export const lerServicos = (v: unknown): Servico[] => {
  const lista = (Array.isArray(v) ? v : String(v ?? '').split(',')).map(x => String(x).trim().toUpperCase()).filter(Boolean);
  const invalido = lista.find(x => !(SERVICOS as readonly string[]).includes(x));
  if (invalido) throw new ErroObra(`Serviço inválido: ${invalido}.`);
  return SERVICOS.filter(s => lista.includes(s));
};

export const validarObra = (b: any) => {
  const idCliente = Number(b?.idCliente);
  if (!(idCliente > 0)) throw new ErroObra('Escolha o cliente da obra.');
  const servicos = lerServicos(b?.servicos);
  if (!servicos.length) throw new ErroObra('Escolha ao menos um serviço (perfuração, instalação, limpeza...).');
  const garantia = b?.garantiaMeses === undefined || b?.garantiaMeses === null || b?.garantiaMeses === '' ? null : Math.floor(Number(b.garantiaMeses));
  if (garantia !== null && !(garantia >= 0 && garantia <= 120)) throw new ErroObra('Garantia: de 0 a 120 meses.');
  return {
    idCliente, idPoco: Number(b?.idPoco) > 0 ? Number(b.idPoco) : null, servicos,
    titulo: texto(b?.titulo, 150), dataPrevisao: dataIso(b?.dataPrevisao, 'Início previsto'),
    garantiaMeses: garantia, metrosPrevistos: numero(b?.metrosPrevistos, 'Metros previstos', 2000),
    valorContratado: numero(b?.valorContratado, 'Valor contratado'), valorMetroExcedente: numero(b?.valorMetroExcedente, 'Valor do metro excedente'),
    // preço se pago parcelado (cartão), ao lado do à vista
    valorParcelado: numero(b?.valorParcelado, 'Valor parcelado') || null,
    valorSinal: numero(b?.valorSinal, 'Sinal') || null,
    sinalQuando: String(b?.sinalQuando || '').toUpperCase() === 'NO_ATO' ? 'NO_ATO' : 'ANTES',
    observacao: texto(b?.observacao, 255),
    // o que vai no orçamento em PDF
    escopo: String(b?.escopo ?? '').replace(/\r\n/g, '\n').trim().slice(0, 5000) || null,
    prazoExecucaoDias: diasOuNulo(b?.prazoExecucaoDias, 'Prazo de execução'), formaPagamento: texto(b?.formaPagamento, 255),
    validadeOrcamentoDias: diasOuNulo(b?.validadeOrcamentoDias, 'Validade do orçamento'),
  };
};

function diasOuNulo(v: unknown, nome: string) {
  if (v === undefined || v === null || v === '') return null;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 365) throw new ErroObra(`${nome}: de 1 a 365 dias.`);
  return n;
}

/** "-23.55, -46.63" (ou com espaço/ponto e vírgula) → latitude e longitude; null quando não dá para ler. */
export const lerGps = (v: unknown): { latitude: number; longitude: number } | null => {
  const m = String(v ?? '').match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!m) return null;
  const [latitude, longitude] = [Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))];
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
};

/** Nome do poço quando o operador não dá um: "Poço de <cliente>"; o segundo em diante "Poço de <cliente> #2", "#3"... */
export const nomePadraoPoco = (cliente: string | null | undefined, existentes: Array<string | null>) => {
  const base = `Poço de ${String(cliente || '').trim().replace(/\s+/g, ' ') || 'cliente'}`.slice(0, 94);
  const usados = new Set(existentes.filter(Boolean).map(s => String(s).trim().toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) { const nome = `${base} #${n}`; if (!usados.has(nome.toLowerCase())) return nome; }
};

export const validarPoco = (b: any) => {
  // sem identificação, o poço do cliente ganha o nome automático ("Poço de <cliente>", "#2"...) ao gravar
  const identificacao = texto(b?.identificacao, 100);
  if (!identificacao && !(Number(b?.idProprietario) > 0)) throw new ErroObra('Dê uma identificação ao poço ou escolha o proprietário (o nome sai automático: "Poço de <cliente>").');
  const gps = b?.latitude !== undefined && b?.latitude !== null && b?.latitude !== '' ? lerGps(`${b.latitude}, ${b.longitude}`) : lerGps(b?.gps);
  if ((b?.gps || b?.latitude) && !gps) throw new ErroObra('Localização (GPS) inválida: use "-23.550520, -46.633308".');
  const opcao = <T extends readonly string[]>(lista: T, v: unknown, padrao: T[number]): T[number] =>
    (lista as readonly string[]).includes(String(v ?? '').toUpperCase()) ? String(v).toUpperCase() as T[number] : padrao;
  const uf = String(b?.uf ?? '').trim().toUpperCase().slice(0, 2) || null;
  return {
    identificacao, idProprietario: Number(b?.idProprietario) > 0 ? Number(b.idProprietario) : null,
    endereco: texto(b?.endereco, 150), bairro: texto(b?.bairro, 60), cidade: texto(b?.cidade, 60), uf, cep: texto(b?.cep, 9),
    latitude: gps?.latitude ?? null, longitude: gps?.longitude ?? null,
    profundidadeM: numero(b?.profundidadeM, 'Profundidade', 2000), diametro: texto(b?.diametro, 20), vazaoLh: numero(b?.vazaoLh, 'Vazão'),
    nivelEstaticoM: numero(b?.nivelEstaticoM, 'Nível estático', 2000), nivelDinamicoM: numero(b?.nivelDinamicoM, 'Nível dinâmico', 2000),
    tipoSolo: texto(b?.tipoSolo, 60), dataPerfuracao: dataIso(b?.dataPerfuracao, 'Data da perfuração'),
    perfuradoPor: opcao(PERFURADO_POR, b?.perfuradoPor, 'NOS'), perfuradoPorNome: texto(b?.perfuradoPorNome, 100),
    situacao: opcao(SITUACOES_POCO, b?.situacao, 'ATIVO'), observacao: texto(b?.observacao, 255),
  };
};

/** Cliente de poço (cadastro do módulo, separado do cadastro geral): basta o nome; telefone e documento só com os dígitos. */
export const validarCliente = (b: any) => {
  const nome = texto(b?.nome, 120);
  if (!nome) throw new ErroObra('Informe o nome do cliente.');
  const digitos = (v: unknown, max: number) => String(v ?? '').replace(/\D/g, '').slice(0, max) || null;
  const telefone = digitos(b?.telefone, 20);
  if (telefone && telefone.length < 8) throw new ErroObra('Telefone incompleto.');
  const tipoPessoa = String(b?.tipoPessoa || 'PF').toUpperCase() === 'PJ' ? 'PJ' : 'PF';
  const documento = digitos(b?.documento, 18);
  if (documento && documento.length !== 11 && documento.length !== 14) throw new ErroObra('Documento: CPF com 11 ou CNPJ com 14 dígitos.');
  if (documento && tipoPessoa === 'PJ' && documento.length !== 14) throw new ErroObra('Empresa (PJ): o CNPJ tem 14 dígitos.');
  if (documento && tipoPessoa === 'PF' && documento.length !== 11) throw new ErroObra('Pessoa física: o CPF tem 11 dígitos (empresa: marque PJ).');
  const email = texto(b?.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ErroObra('E-mail inválido.');
  const telefone2 = digitos(b?.telefone2, 20);
  const cep = digitos(b?.cep, 8);
  if (cep && cep.length !== 8) throw new ErroObra('CEP com 8 dígitos.');
  const representanteDocumento = tipoPessoa === 'PJ' ? digitos(b?.representanteDocumento, 11) : null;
  if (representanteDocumento && representanteDocumento.length !== 11) throw new ErroObra('CPF do representante com 11 dígitos.');
  return {
    nome, tipoPessoa, telefone, telefone2, documento, rgIe: texto(b?.rgIe, 20), estadoCivil: tipoPessoa === 'PF' ? texto(b?.estadoCivil, 20) : null,
    profissao: tipoPessoa === 'PF' ? texto(b?.profissao, 60) : null, email: email ? email.toLowerCase() : null,
    endereco: texto(b?.endereco, 150), bairro: texto(b?.bairro, 60), cidade: texto(b?.cidade, 60),
    uf: String(b?.uf ?? '').trim().toUpperCase().slice(0, 2) || null, cep: cep ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null,
    representante: tipoPessoa === 'PJ' ? texto(b?.representante, 120) : null, representanteDocumento, observacao: texto(b?.observacao, 255),
  };
};

type Rel = Record<string, any>;
const num = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? null : Number(String(v).replace(',', '.')) || null);

/** O relatório da obra nova já vem com o cliente e o poço (o operador não digita de novo). */
export const relatorioInicial = (c: { nome: string; documento?: string | null; telefone?: string | null }, p: {
  endereco?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null;
  latitude?: number | null; longitude?: number | null; profundidadeM?: number | null; vazaoLh?: number | null;
} | null, o: { metrosPrevistos?: number | null; valorContratado?: number | null; valorMetroExcedente?: number | null; garantiaMeses?: number | null }): Rel => ({
  cliente: c.nome, documento: c.documento || undefined, celular: c.telefone || undefined,
  endereco: p?.endereco || undefined, bairro: p?.bairro || undefined, cidade: p?.cidade || undefined, uf: p?.uf || undefined, cep: p?.cep || undefined,
  localizacao: p?.latitude !== null && p?.latitude !== undefined && p?.longitude !== null && p?.longitude !== undefined ? `${p.latitude}, ${p.longitude}` : undefined,
  profundidade: p?.profundidadeM ?? undefined, vazaoAprox: p?.vazaoLh ?? undefined,
  finMetrosContratados: o.metrosPrevistos ?? undefined, finValorContratado: o.valorContratado ?? undefined,
  finValorMetroExcedente: o.valorMetroExcedente ?? undefined, garantiaMeses: o.garantiaMeses ?? undefined,
});

/**
 * O que o relatório mediu e vai para a ficha do poço (na perfuração concluída): profundidade (a informada ou o fundo
 * da perfuração), vazão, níveis, solo, data e GPS. Só os campos preenchidos.
 */
export const pocoDoRelatorio = (r: Rel) => {
  const fundo = (r.perfuracoes || []).reduce((m: number, c: Rel) => Math.max(m, Number(c?.perfAte) || 0), 0);
  const gps = lerGps(r.localizacao);
  const saida: Record<string, number | string> = {};
  const profundidade = num(r.profundidade) || (fundo > 0 ? fundo : null);
  if (profundidade) saida.profundidadeM = profundidade;
  const vazao = num(r.vazaoAprox) ?? num(r.bombaVazaoEstimada);
  if (vazao) saida.vazaoLh = vazao;
  if (num(r.bombaNivelEstatico)) saida.nivelEstaticoM = num(r.bombaNivelEstatico)!;
  if (num(r.bombaNivelDinamico)) saida.nivelDinamicoM = num(r.bombaNivelDinamico)!;
  if (r.tipoSolo) saida.tipoSolo = String(r.tipoSolo).slice(0, 60);
  if (r.diametroInterno) saida.diametro = `${r.diametroInterno}${r.diamInternoUnidade || '"'}`.slice(0, 20);
  if (r.dtTermino && /^\d{4}-\d{2}-\d{2}/.test(String(r.dtTermino))) saida.dataPerfuracao = String(r.dtTermino).slice(0, 10);
  if (gps) { saida.latitude = gps.latitude; saida.longitude = gps.longitude; }
  return saida;
};

/** Garantia até (AAAA-MM-DD): conclusão + meses; null sem um dos dois. */
export const garantiaAte = (dataTermino: string | null, meses: number | null) => {
  if (!dataTermino || !meses) return null;
  const d = new Date(`${dataTermino}T12:00:00Z`);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
};
