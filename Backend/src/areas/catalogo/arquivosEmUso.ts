// Arquivo enviado pelo ERP (Backend/uploads) pode estar em mais de um lugar: a mesma foto copiada em vários itens, na
// galeria da família ou como foto da família. Só sai do disco quando ninguém mais usa.
import { apagarArquivoDaUrl } from '../../infra/arquivos';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

export const arquivoEmUso = async (conn: Conn, url: string) => {
  const [[a]] = await conn.execute(`SELECT COUNT(*) AS n FROM itens_anexos WHERE url_anexo = ?`, [url]);
  const [[f]] = await conn.execute(`SELECT COUNT(*) AS n FROM comercial_familias WHERE imagem = ?`, [url]);
  const [[g]] = await conn.execute(`SELECT COUNT(*) AS n FROM comercial_familias_fotos WHERE url_foto = ?`, [url]);
  return Number(a.n) + Number(f.n) + Number(g.n) > 0;
};

/** Das URLs que saíram, as que ninguém mais usa (para apagar do disco depois do commit). */
export const semUso = async (conn: Conn, urls: (string | null | undefined)[]) => {
  const saida: string[] = [];
  for (const u of [...new Set(urls.filter((x): x is string => !!x))]) if (!(await arquivoEmUso(conn, u))) saida.push(u);
  return saida;
};

export const apagarArquivos = (urls: string[]) => urls.forEach(u => apagarArquivoDaUrl(u));
