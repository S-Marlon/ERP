// Arquivos enviados pelo ERP (fotos e documentos dos itens): ficam em Backend/uploads e são servidos em /uploads.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const PASTA_UPLOADS = path.join(__dirname, '..', '..', 'uploads');

const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf',
};
export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

export class ErroArquivo extends Error {}

/** Nome seguro para o disco (sem acento, espaço ou barra). */
export const nomeSeguro = (nome: string) => String(nome || 'arquivo')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[^.]+$/, '')
  .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'arquivo';

/**
 * Grava um arquivo vindo como data URL ("data:image/jpeg;base64,...") ou base64 puro + tipo.
 * Devolve o caminho relativo a /uploads (ex.: itens/1/123/abc-foto.jpg).
 */
export const salvarArquivo = (subpasta: string, nome: string, conteudo: string, tipoInformado?: string) => {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(String(conteudo || ''));
  const tipo = (m ? m[1] : tipoInformado || '').toLowerCase();
  const ext = TIPOS[tipo];
  if (!ext) throw new ErroArquivo('Tipo de arquivo não aceito (use JPG, PNG, WEBP, GIF ou PDF).');
  const dados = Buffer.from(m ? m[2] : String(conteudo || ''), 'base64');
  if (!dados.length) throw new ErroArquivo('Arquivo vazio.');
  if (dados.length > TAMANHO_MAXIMO) throw new ErroArquivo('Arquivo maior que 10 MB.');
  const pasta = path.join(PASTA_UPLOADS, subpasta);
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = `${crypto.randomBytes(4).toString('hex')}-${nomeSeguro(nome)}.${ext}`;
  fs.writeFileSync(path.join(pasta, arquivo), dados);
  return { relativo: `${subpasta.replace(/\\/g, '/')}/${arquivo}`, tipo, bytes: dados.length };
};

/** Caminho no disco de uma URL /uploads/... deste servidor (null se for link externo). */
export const caminhoLocalDaUrl = (url: string): string | null => {
  const m = /\/uploads\/(.+)$/.exec(String(url || '').split('?')[0]);
  if (!m) return null;
  const caminho = path.normalize(path.join(PASTA_UPLOADS, decodeURIComponent(m[1])));
  return caminho.startsWith(PASTA_UPLOADS) && fs.existsSync(caminho) ? caminho : null;
};

/** Apaga o arquivo local de uma URL /uploads/... (link externo: não faz nada). */
export const apagarArquivoDaUrl = (url: string) => {
  const caminho = caminhoLocalDaUrl(url);
  if (caminho) { try { fs.unlinkSync(caminho); } catch { /* já não existe */ } }
};
