// API das notas fiscais de saída (/api/fiscal): configuração, fila do dia, emissão, cancelamento e envio
import { operadorAtual } from '../../caixa/caixaApi';

const API = 'http://localhost:3001/api/fiscal';

export type Modelo = '65' | '55';
export type SituacaoNota = 'AGUARDANDO' | 'SEM_NOTA' | 'DISPENSADA' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'DENEGADA' | 'CANCELADA';

export interface EmitenteFiscal {
  cnpj: string; inscricaoEstadual: string | null; razaoSocial: string; nomeFantasia: string | null; crt: number;
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cep: string | null;
  municipio: string | null; codigoMunicipioIbge: string | null; uf: string | null; telefone: string | null; email: string | null;
}
export interface ConfigFiscal {
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO'; emissor: 'PROVEDOR' | 'DIRETO'; provedor: string | null; modoEmissao: 'FILA' | 'AUTOMATICA';
  serieNfce: number; proximoNumeroNfce: number; serieNfe: number; proximoNumeroNfe: number; cscId: string | null;
  csosnPadrao: string; cfopPadrao: string; csosnSt: string; cfopSt: string;
}
export interface DadosConfiguracao {
  emitente: EmitenteFiscal | null; config: ConfigFiscal; configurado: boolean; provedores: string[];
  segredos: { provedorToken: boolean; cscToken: boolean; certificado: boolean };
}

export interface NotaDaFila {
  idVenda: number; statusVenda: string; criadoEm: string; operador: string; cliente: string; documentoCliente: string | null; idCliente: number | null;
  total: number; totalDevolvido: number; qtdItens: number; soServico: boolean; modelo: Modelo; modeloSugerido: Modelo;
  situacao: SituacaoNota; pendencias: string[]; email: string | null; celular: string | null;
  documento: {
    idDocumento: number; serie: number | null; numero: number | null; chave: string | null; motivo: string | null;
    urlDanfe: string | null; urlQrcode: string | null; emitidoEm: string | null; aprovadoPor: string | null; ambiente: string | null;
  } | null;
}
export interface FilaDoDia {
  notas: NotaDaFila[]; resumo: Record<string, number>; configurado: boolean; ambiente: string; modoEmissao: string; emissor: string | null; consultaUrl: string | null;
}
export interface ResultadoEmissao { idVenda: number; ok: boolean; status: string; mensagem: string; numero?: number; chave?: string | null }
export interface EventoNota { idEvento: number; tipo: string; sucesso: boolean; mensagem: string | null; operador: string; criadoEm: string }

const requisitar = async <T>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const response = await fetch(url, init);
  const dados = await response.json().catch(() => ({}));
  if (response.status === 404 && !dados.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!response.ok) throw new Error(dados.error || erro);
  return dados as T;
};
const enviar = (metodo: 'POST' | 'PUT', corpo: unknown): RequestInit => ({
  method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(corpo as object), operador: operadorAtual() }),
});

export const fiscalApi = {
  configuracao: () => requisitar<DadosConfiguracao>(`${API}/configuracao`, undefined, 'Erro ao carregar a configuração fiscal.'),
  salvarConfiguracao: (emitente: Partial<EmitenteFiscal>, configuracao: ConfigFiscal) =>
    requisitar<DadosConfiguracao>(`${API}/configuracao`, enviar('PUT', { emitente, configuracao }), 'Erro ao salvar a configuração fiscal.'),
  fila: (data: string) => requisitar<FilaDoDia>(`${API}/notas?data=${data}`, undefined, 'Erro ao carregar as notas.'),
  emitir: (vendas: number[], modelo?: Modelo) =>
    requisitar<{ resultados: ResultadoEmissao[]; autorizadas: number }>(`${API}/notas/emitir`, enviar('POST', { vendas, modelo }), 'Erro ao emitir.'),
  dispensar: (vendas: number[], motivo: string) =>
    requisitar<{ resultados: Array<{ idVenda: number; ok: boolean; mensagem: string }> }>(`${API}/notas/dispensar`, enviar('POST', { vendas, motivo }), 'Erro ao dispensar.'),
  reabrir: (vendas: number[]) =>
    requisitar<{ resultados: Array<{ idVenda: number; ok: boolean; mensagem: string }> }>(`${API}/notas/reabrir`, enviar('POST', { vendas }), 'Erro ao reabrir.'),
  cancelar: (idDocumento: number, motivo: string) =>
    requisitar<{ mensagem: string }>(`${API}/notas/${idDocumento}/cancelar`, enviar('POST', { motivo }), 'Erro ao cancelar a nota.'),
  registrarEnvio: (idDocumento: number, canal: 'EMAIL' | 'WHATSAPP', destino: string) =>
    requisitar<{ enviadoPeloEmissor: boolean; mensagem: string }>(`${API}/notas/${idDocumento}/envio`, enviar('POST', { canal, destino }), 'Erro ao enviar.'),
  eventos: (idDocumento: number) => requisitar<{ eventos: EventoNota[] }>(`${API}/notas/${idDocumento}`, undefined, 'Erro ao carregar o histórico.'),
};

const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Texto enviado ao cliente: link do DANFE quando o emissor devolve; senão a chave e a consulta pública. */
export const mensagemDaNota = (n: NotaDaFila, loja: string, consultaUrl: string | null) => {
  const nome = n.cliente && n.cliente !== 'CONSUMIDOR' ? ` ${n.cliente.split(' ')[0]}` : '';
  const doc = n.documento;
  const acesso = doc?.urlDanfe
    ? `Acesse: ${doc.urlDanfe}`
    : `Chave de acesso: ${doc?.chave || ''}${consultaUrl ? `\nConsulte em: ${consultaUrl}` : ''}`;
  return `Olá${nome}! Segue a nota fiscal da sua compra${loja ? ` na ${loja}` : ''} (venda Nº ${n.idVenda}, ${brl(n.total)}).\n${acesso}`;
};

/** Link do WhatsApp: número com DDD; sem DDI recebe o 55 do Brasil. */
export const linkWhatsapp = (celular: string, texto: string) => {
  let numero = String(celular).replace(/\D/g, '');
  if (numero.length === 10 || numero.length === 11) numero = `55${numero}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
};

export const linkEmail = (email: string, assunto: string, texto: string) =>
  `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
