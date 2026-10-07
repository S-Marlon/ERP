// Gravação tipada de valores de atributos (atributos_comercial_valores).
// Cada tipo vai para a sua coluna: número em valor_numero, decimal em valor_decimal, lista em opcao_id...
// Assim dá para ordenar/filtrar por medida (ex: diâmetro entre 20 e 30) em vez de comparar texto.

export type TipoAtributo = 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';

export interface OpcaoAtributo {
  id: number;
  valor: string;
  codigo?: string | null;
}

export interface ColunasValor {
  valor_texto: string | null;
  valor_numero: number | null;
  valor_decimal: number | null;
  valor_data: string | null;
  valor_boolean: number | null;
  opcao_id: number | null;
}

export type ResultadoConversao = { ok: true; colunas: ColunasValor } | { ok: false; erro: string };

const VAZIO: ColunasValor = {
  valor_texto: null, valor_numero: null, valor_decimal: null, valor_data: null, valor_boolean: null, opcao_id: null,
};

const normalizar = (v: unknown) => String(v ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Aceita "12", "12,5", "1.234,5" e "1234.5"
const paraNumero = (valor: unknown): number | null => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let texto = String(valor ?? '').trim().replace(/\s/g, '');
  if (texto === '') return null;
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  return Number(texto);
};

export const converterValorAtributo = (tipo: string, valor: unknown, opcoes: OpcaoAtributo[] = []): ResultadoConversao => {
  const bruto = typeof valor === 'string' ? valor.trim() : valor;
  if (bruto === undefined || bruto === null || bruto === '') {
    return { ok: false, erro: 'valor vazio' };
  }

  switch (tipo) {
    case 'numero': {
      const n = paraNumero(bruto);
      if (n === null || !Number.isInteger(n)) return { ok: false, erro: `"${bruto}" não é um número inteiro` };
      return { ok: true, colunas: { ...VAZIO, valor_numero: n } };
    }
    case 'decimal': {
      const n = paraNumero(bruto);
      if (n === null) return { ok: false, erro: `"${bruto}" não é um número` };
      return { ok: true, colunas: { ...VAZIO, valor_decimal: n } };
    }
    case 'boolean': {
      const t = normalizar(bruto);
      if (['1', 'true', 'sim', 's', 'yes'].includes(t)) return { ok: true, colunas: { ...VAZIO, valor_boolean: 1 } };
      if (['0', 'false', 'nao', 'n', 'no'].includes(t)) return { ok: true, colunas: { ...VAZIO, valor_boolean: 0 } };
      return { ok: false, erro: `"${bruto}" não é sim/não` };
    }
    case 'data': {
      const texto = String(bruto);
      const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : texto.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(iso))) return { ok: false, erro: `"${bruto}" não é uma data` };
      return { ok: true, colunas: { ...VAZIO, valor_data: `${iso} 00:00:00` } };
    }
    case 'lista': {
      const alvo = normalizar(bruto);
      const opcao = opcoes.find(o => normalizar(o.valor) === alvo || (o.codigo && normalizar(o.codigo) === alvo));
      if (!opcao) return { ok: false, erro: `"${bruto}" não é uma opção válida` };
      return { ok: true, colunas: { ...VAZIO, opcao_id: Number(opcao.id) } };
    }
    default:
      return { ok: true, colunas: { ...VAZIO, valor_texto: String(bruto) } };
  }
};

type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

/**
 * Grava (insere ou atualiza) o valor de um atributo de uma entidade, na coluna do tipo.
 * Lança erro com mensagem legível se o valor não for válido para o tipo.
 */
export const gravarValorAtributo = async (
  conn: Conn,
  tenant: number,
  tipoEntidade: 'produto' | 'familia' | 'categoria',
  idEntidade: number | string,
  atributo: { id: number | string; nome: string; tipo: string },
  valor: unknown,
  opcoes: OpcaoAtributo[] = []
): Promise<void> => {
  const conversao = converterValorAtributo(atributo.tipo, valor, opcoes);
  if (!conversao.ok) throw new Error(`Atributo "${atributo.nome}": ${conversao.erro}.`);
  const c = conversao.colunas;
  const colunas = [c.valor_texto, c.valor_numero, c.valor_decimal, c.valor_data, c.valor_boolean, c.opcao_id];

  const [existente] = await conn.execute(
    `SELECT id FROM atributos_comercial_valores
     WHERE tenant_id = ? AND tipo_entidade = ? AND id_entidade = ? AND atributo_id = ? LIMIT 1`,
    [tenant, tipoEntidade, idEntidade, atributo.id]
  );
  if (existente.length > 0) {
    await conn.execute(
      `UPDATE atributos_comercial_valores
       SET valor_texto = ?, valor_numero = ?, valor_decimal = ?, valor_data = ?, valor_boolean = ?, opcao_id = ?
       WHERE id = ?`,
      [...colunas, existente[0].id]
    );
  } else {
    await conn.execute(
      `INSERT INTO atributos_comercial_valores
       (tenant_id, atributo_id, tipo_entidade, id_entidade, valor_texto, valor_numero, valor_decimal, valor_data, valor_boolean, opcao_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenant, atributo.id, tipoEntidade, idEntidade, ...colunas]
    );
  }
};

// Opções ativas de uma lista de atributos, agrupadas por atributo
export const carregarOpcoes = async (conn: Conn, tenant: number, atributoIds: Array<number | string>) => {
  const mapa = new Map<string, OpcaoAtributo[]>();
  if (atributoIds.length === 0) return mapa;
  const [rows] = await conn.execute(
    `SELECT id, atributo_id, valor, codigo FROM atributos_comercial_opcoes
     WHERE tenant_id = ? AND ativo = 1 AND atributo_id IN (${atributoIds.map(() => '?').join(',')})`,
    [tenant, ...atributoIds]
  );
  for (const r of rows) {
    const chave = String(r.atributo_id);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push({ id: Number(r.id), valor: r.valor, codigo: r.codigo });
  }
  return mapa;
};
