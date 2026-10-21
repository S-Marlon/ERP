// Tags do catálogo: rótulos de uso/aplicação que atravessam categorias ("bicicleta", "rolamentos", "moto"). Ficam na
// família (valem para todos os itens dela, inclusive os que entrarem depois) ou só no item (a exceção). Regras puras e
// os trechos de SQL que as outras telas usam para "o item tem a tag".

export class ErroTag extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const CORES_TAG = ['default', 'blue', 'green', 'orange', 'red', 'purple', 'cyan', 'gold', 'magenta', 'lime'] as const;

/** Nome normalizado (sem acento, minúsculo, espaços simples): "Bicicleta " e "bicicleta" são a mesma tag. */
export const slugTag = (nome: string) =>
  String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);

export const validarTag = (b: any) => {
  const nome = String(b?.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (nome.length < 2) throw new ErroTag('Informe o nome da tag (ao menos 2 letras).');
  const grupo = String(b?.grupo ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
  const cor = (CORES_TAG as readonly string[]).includes(String(b?.cor)) ? String(b.cor) : 'default';
  return { nome, slug: slugTag(nome), grupo, cor };
};

export interface TagDoItem { idTag: number; nome: string; cor: string; herdada: boolean }

/** Tags do item: as da família (herdadas) e as próprias, sem repetir (a da família vence). Em ordem de nome. */
export const juntarTags = (daFamilia: Omit<TagDoItem, 'herdada'>[], proprias: Omit<TagDoItem, 'herdada'>[]): TagDoItem[] => {
  const saida = new Map<number, TagDoItem>();
  for (const t of daFamilia) saida.set(t.idTag, { ...t, herdada: true });
  for (const t of proprias) if (!saida.has(t.idTag)) saida.set(t.idTag, { ...t, herdada: false });
  return [...saida.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
};

/**
 * SQL: o item (alias `ic`, com `cpd` = comercial_produtos_dados) tem uma tag ativa cujo slug casa com o LIKE do
 * parâmetro, nele ou na família. Um `?` (o padrão do slug).
 */
export const SQL_ITEM_TEM_TAG_LIKE = `EXISTS (SELECT 1 FROM comercial_tags tg
  WHERE tg.tenant_id = ic.tenant_id AND tg.ativo = 1 AND tg.slug LIKE ?
    AND (EXISTS (SELECT 1 FROM comercial_tags_itens tgi WHERE tgi.id_tag = tg.id_tag AND tgi.id_item = ic.id_item)
      OR EXISTS (SELECT 1 FROM comercial_tags_familias tgf WHERE tgf.id_tag = tg.id_tag AND tgf.id_familia = cpd.familia_id)))`;

/** SQL: o item (alias `ic`/`cpd`) tem a tag do parâmetro (id), nele ou na família. Dois `?` (o id da tag duas vezes). */
export const SQL_ITEM_TEM_TAG_ID = `(EXISTS (SELECT 1 FROM comercial_tags_itens tgi WHERE tgi.id_tag = ? AND tgi.id_item = ic.id_item)
  OR EXISTS (SELECT 1 FROM comercial_tags_familias tgf WHERE tgf.id_tag = ? AND tgf.id_familia = cpd.familia_id))`;
