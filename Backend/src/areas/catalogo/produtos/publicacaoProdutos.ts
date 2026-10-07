// Carrega do banco o necessário para decidir se cada item pode ser publicado (PDV/canais).
import { AtributoEfetivo, avaliarPublicacao, mesclarAtributos, Publicacao } from '../familias/saudeFamilia';
import { atributosEfetivosDaCategoria, carregarArvore, carregarVinculosCategorias } from '../categorias/herancaCategorias';

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

const paraAtributo = (r: any): AtributoEfetivo => ({
  id: String(r.atributo_id),
  nome: r.nome,
  codigo: r.codigo,
  classificacao: r.escopo_comercial || 'ficha',
  obrigatorio: Boolean(Number(r.obrigatorio)),
  valorPadraoGrupo: r.valor_padrao_grupo,
});

/**
 * Situação de publicação de itens (todos do tenant ou só os ids informados).
 * Item sem família herda direto da categoria ("família virtual" do documento de arquitetura).
 */
// gradeSemValor: atributos de grade (não obrigatórios) ainda vazios: não impedem a publicação, mas deixam SKUs iguais na grade
// atributosGrade: ids dos atributos de grade que valem para o item (família + herdados da categoria)
export type PublicacaoItem = Publicacao & { gradeSemValor: string[]; atributosGrade: string[] };

export const avaliarPublicacaoItens = async (conn: Conn, tenant: number, idsItens?: number[]): Promise<Map<number, PublicacaoItem>> => {
  const filtro = idsItens && idsItens.length > 0 ? `AND ic.id_item IN (${idsItens.map(() => '?').join(',')})` : '';
  const [itens] = await conn.execute(
    `SELECT ic.id_item, ic.status AS status_item, COALESCE(cpd.exibir_no_pdv, 1) AS exibir_no_pdv,
            cpd.familia_id, f.status AS status_familia, COALESCE(f.categoria_id, cpd.categoria_id) AS categoria_id
     FROM itens_core ic
     LEFT JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
     LEFT JOIN comercial_familias f ON f.id = cpd.familia_id AND f.tenant_id = ic.tenant_id
     WHERE ic.tenant_id = ? ${filtro}`,
    [tenant, ...(idsItens || [])]
  );
  const resultado = new Map<number, PublicacaoItem>();
  if (itens.length === 0) return resultado;

  const [vinculos] = await conn.execute(
    `SELECT core.tipo_entidade, core.id_entidade, core.atributo_id, core.escopo_comercial, core.obrigatorio,
            core.valor_padrao_grupo, a.nome, a.codigo
     FROM atributos_core_entidades core
     INNER JOIN atributos_comercial a ON a.id = core.atributo_id AND a.tenant_id = core.tenant_id
     WHERE core.tenant_id = ? AND core.ativo = 1 AND core.tipo_entidade = 'familia'`,
    [tenant]
  );
  const [arvore, vinculosCategorias] = await Promise.all([carregarArvore(conn, tenant), carregarVinculosCategorias(conn, tenant)]);
  const herdadosPorCategoria = new Map<string, AtributoEfetivo[]>();
  const herdadosDa = (categoriaId: unknown): AtributoEfetivo[] => {
    const k = String(categoriaId);
    if (!herdadosPorCategoria.has(k)) {
      herdadosPorCategoria.set(k, atributosEfetivosDaCategoria(arvore, vinculosCategorias, k).map(r => paraAtributo({
        atributo_id: r.id, nome: r.nome, codigo: r.codigo, escopo_comercial: r.classificacao,
        obrigatorio: r.obrigatorio, valor_padrao_grupo: r.valorPadraoGrupo,
      })));
    }
    return herdadosPorCategoria.get(k)!;
  };
  const porEntidade = new Map<string, AtributoEfetivo[]>();
  for (const v of vinculos) {
    const chave = `${v.tipo_entidade}:${v.id_entidade}`;
    if (!porEntidade.has(chave)) porEntidade.set(chave, []);
    porEntidade.get(chave)!.push(paraAtributo(v));
  }

  const ids = itens.map((i: any) => Number(i.id_item));
  const [valores] = await conn.execute(
    `SELECT DISTINCT id_entidade, atributo_id FROM atributos_comercial_valores
     WHERE tenant_id = ? AND tipo_entidade = 'produto' AND id_entidade IN (${ids.map(() => '?').join(',')})
       AND (NULLIF(TRIM(valor_texto), '') IS NOT NULL OR valor_numero IS NOT NULL OR valor_decimal IS NOT NULL
            OR valor_data IS NOT NULL OR valor_boolean IS NOT NULL OR opcao_id IS NOT NULL)`,
    [tenant, ...ids]
  );
  const comValor = new Map<number, Set<string>>();
  for (const v of valores) {
    const id = Number(v.id_entidade);
    if (!comValor.has(id)) comValor.set(id, new Set());
    comValor.get(id)!.add(String(v.atributo_id));
  }

  for (const item of itens) {
    const herdados = item.categoria_id ? herdadosDa(item.categoria_id) : [];
    const locais = item.familia_id ? porEntidade.get(`familia:${item.familia_id}`) || [] : [];
    const efetivos = mesclarAtributos(herdados, locais);
    const preenchidos = comValor.get(Number(item.id_item)) || new Set<string>();
    resultado.set(Number(item.id_item), {
      ...avaliarPublicacao({
        statusItem: item.status_item,
        exibirNoPdv: Boolean(Number(item.exibir_no_pdv)),
        statusFamilia: item.familia_id ? item.status_familia : null,
        obrigatorios: efetivos.filter(a => a.obrigatorio),
        atributosComValor: preenchidos,
      }),
      gradeSemValor: efetivos
        .filter(a => a.classificacao === 'grade' && !a.obrigatorio && !preenchidos.has(String(a.id)))
        .map(a => a.nome),
      atributosGrade: efetivos.filter(a => a.classificacao === 'grade').map(a => String(a.id)),
    });
  }
  return resultado;
};
