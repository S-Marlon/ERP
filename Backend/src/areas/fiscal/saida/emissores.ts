// Quem emite a nota: provedor contratado (API) ou direto na SEFAZ (certificado A1).
// O resto do sistema só conhece EmissorFiscal; trocar de provedor = registrar outro aqui.
// Segredos ficam no .env: FISCAL_PROVEDOR_TOKEN, FISCAL_CSC_TOKEN, FISCAL_CERTIFICADO_ARQUIVO, FISCAL_CERTIFICADO_SENHA.
import { randomInt } from 'crypto';
import { ConfigFiscal, ErroFiscal, gerarChaveAcesso, NotaSaida } from './notaSaida';

export interface RetornoEmissao {
  status: 'AUTORIZADA' | 'REJEITADA' | 'DENEGADA' | 'PROCESSANDO';
  mensagem: string;
  chave?: string | null; protocolo?: string | null; xml?: string | null;
  urlDanfe?: string | null; urlQrcode?: string | null; referenciaExterna?: string | null;
  detalhe?: unknown;
}
export interface DocumentoEmitido { referencia: string; modelo: string; chave: string | null; referenciaExterna: string | null }

export interface EmissorFiscal {
  nome: string;
  /** referencia: identificador estável do documento (reenvio com a mesma referência não duplica a nota no provedor). */
  emitir(nota: NotaSaida, referencia: string): Promise<RetornoEmissao>;
  cancelar(doc: DocumentoEmitido, justificativa: string): Promise<{ ok: boolean; mensagem: string; detalhe?: unknown }>;
  /** Envio do DANFE/XML por e-mail pelo próprio emissor (quando ele oferece). */
  enviarEmail?(doc: DocumentoEmitido, emails: string[]): Promise<{ ok: boolean; mensagem: string }>;
}

// Simulado: autoriza tudo em homologação para testar a fila sem provedor nem certificado
const simulado: EmissorFiscal = {
  nome: 'Simulado (testes)',
  async emitir(nota) {
    if (nota.ambiente !== 'HOMOLOGACAO') throw new ErroFiscal('O emissor simulado só funciona em homologação.');
    const chave = gerarChaveAcesso({
      uf: nota.emitente.uf || 'SP', emissao: new Date(nota.emissao), cnpj: nota.emitente.cnpj, modelo: nota.modelo,
      serie: nota.serie, numero: nota.numero, codigoNumerico: randomInt(1, 99999999),
    });
    return {
      status: 'AUTORIZADA', mensagem: 'Autorizado o uso (SIMULADO, sem valor fiscal)', chave,
      protocolo: `9${Date.now()}`.slice(0, 15), xml: null, urlDanfe: null, urlQrcode: null, referenciaExterna: null,
      detalhe: { simulado: true, total: nota.totais.total },
    };
  },
  async cancelar() { return { ok: true, mensagem: 'Cancelamento homologado (SIMULADO)' }; },
};

// Provedores contratáveis (ex.: FOCUS_NFE, NUVEM_FISCAL): cada um implementa EmissorFiscal com a API dele
const PROVEDORES: Record<string, (cfg: ConfigFiscal) => EmissorFiscal> = {
  SIMULADO: () => simulado,
};
export const PROVEDORES_DISPONIVEIS = Object.keys(PROVEDORES);

// Direto na SEFAZ: assina o XML com o certificado A1 e transmite ao webservice da UF (a implementar com o certificado)
const direto = (): EmissorFiscal => {
  if (!process.env.FISCAL_CERTIFICADO_ARQUIVO || !process.env.FISCAL_CERTIFICADO_SENHA) {
    throw new ErroFiscal('Emissão direta precisa do certificado A1: informe FISCAL_CERTIFICADO_ARQUIVO e FISCAL_CERTIFICADO_SENHA no .env do backend.');
  }
  throw new ErroFiscal('Emissão direta na SEFAZ ainda não implementada: use um provedor.');
};

export const criarEmissor = (cfg: ConfigFiscal): EmissorFiscal => {
  if (cfg.emissor === 'DIRETO') return direto();
  const fabrica = PROVEDORES[String(cfg.provedor || '').toUpperCase()];
  if (!fabrica) throw new ErroFiscal(`Provedor fiscal "${cfg.provedor || '—'}" não disponível. Disponíveis: ${PROVEDORES_DISPONIVEIS.join(', ')}.`);
  return fabrica(cfg);
};

/** Situação dos segredos no .env (só diz se existem, nunca o valor). */
export const segredosConfigurados = () => ({
  provedorToken: Boolean(process.env.FISCAL_PROVEDOR_TOKEN),
  cscToken: Boolean(process.env.FISCAL_CSC_TOKEN),
  certificado: Boolean(process.env.FISCAL_CERTIFICADO_ARQUIVO && process.env.FISCAL_CERTIFICADO_SENHA),
});
