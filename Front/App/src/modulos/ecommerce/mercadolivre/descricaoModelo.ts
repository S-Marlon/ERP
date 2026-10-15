// Descrição por item: o texto do anúncio com {Campo} trocado pelo valor de cada item (mesma regra do servidor, para a
// prévia mostrar o que vai ao ML). Campos: {nome}, {titulo}, {familia}, {marca}, {sku} e os atributos do cadastro.
import type { AnuncioDetalhe, ItemDoAnuncio } from './mercadoLivreApi';

const normalizar = (s: string | null | undefined) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SEM_MARCA = new Set(['sem marca', 'generica', 'generico', 'nenhuma']);
const FIXOS = ['nome', 'titulo', 'familia', 'marca', 'sku'];

type Contexto = Pick<AnuncioDetalhe, 'titulo' | 'familia' | 'atributosErp'>;
type Item = Pick<ItemDoAnuncio, 'nome' | 'marca' | 'sku' | 'valoresErp'>;

export const trocarCampos = (texto: string, item: Item, det: Contexto) => {
  const porNome = new Map(det.atributosErp.map(a => [normalizar(a.nome), a.id]));
  return String(texto || '').replace(/\{([^}]+)\}/g, (_, token: string) => {
    const t = normalizar(token);
    if (t === 'nome') return item.nome || '';
    if (t === 'familia') return det.familia || '';
    if (t === 'titulo') return det.titulo || '';
    if (t === 'marca') return item.marca && !SEM_MARCA.has(normalizar(item.marca)) ? item.marca : '';
    if (t === 'sku') return item.sku || '';
    const id = porNome.get(t);
    return id !== undefined ? item.valoresErp?.[String(id)] || '' : '';
  });
};

/** A descrição que vai ao ML para este item (quebras de linha mantidas; espaço sobrando de campo vazio sai). */
export const descricaoDoItem = (modelo: string | null | undefined, item: Item, det: Contexto) =>
  trocarCampos(String(modelo || ''), item, det)
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').replace(/ ([,.;:])/g, '$1').trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();

/** {Campo} que não existe (nem fixo nem atributo do cadastro): sai em branco. */
export const camposDesconhecidos = (texto: string | null | undefined, det: Pick<AnuncioDetalhe, 'atributosErp'>) => {
  const conhecidos = new Set([...FIXOS, ...det.atributosErp.map(a => normalizar(a.nome))]);
  return [...new Set([...String(texto || '').matchAll(/\{([^}]+)\}/g)].map(m => m[1].trim()))].filter(t => !conhecidos.has(normalizar(t)));
};

/** O texto tem {Campo}: cada item recebe a sua descrição. */
export const temCampos = (texto: string | null | undefined) => /\{[^}]+\}/.test(String(texto || ''));
