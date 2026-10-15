// GET /catalogo/imagens/repassar?url= — busca a imagem de fora e devolve daqui (o editor de imagem desenha sobre ela).
import { Request, Response } from 'express';
import { urlPublicaDeImagem } from './enderecoImagem';

export const repassarImagem = async (req: Request, res: Response) => {
  const url = urlPublicaDeImagem(String(req.query.url || ''));
  if (!url) return res.status(400).json({ error: 'Endereço de imagem inválido.' });
  try {
    const controle = new AbortController();
    const espera = setTimeout(() => controle.abort(), 15000);
    const r = await fetch(url, { signal: controle.signal, headers: { 'User-Agent': 'Mozilla/5.0 (ERP editor de imagens)' } });
    clearTimeout(espera);
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || !/^image\//i.test(tipo)) return res.status(400).json({ error: 'O endereço não devolveu uma imagem.' });
    const dados = Buffer.from(await r.arrayBuffer());
    if (dados.length > 15 * 1024 * 1024) return res.status(400).json({ error: 'Imagem grande demais (máximo 15 MB).' });
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(dados);
  } catch {
    return res.status(502).json({ error: 'Não foi possível buscar a imagem.' });
  }
};
