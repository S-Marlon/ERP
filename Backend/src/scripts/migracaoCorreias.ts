// Correias industriais em V: uma família por perfil (Perfil = DNA fixo, Número da correia = grade), SKU CIV-{perfil}{número}
// (ex.: HCVA58 → CIV-A58). Cria também os perfis que a loja ainda não tem (famílias vazias) e subcategorias em Correias.
//
//   npx ts-node src/scripts/migracaoCorreias.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
const CAT_CORREIAS = 6;
// [perfil, grupo]; o número é o comprimento nominal (polegadas nas clássicas/dentadas, mm nas SP, polegadas×10 nas 3V/5V/8V)
const PERFIS: Array<[string, 'CLASSICA' | 'DENTADA' | 'ESTREITA']> = [
  ['Z', 'CLASSICA'], ['A', 'CLASSICA'], ['B', 'CLASSICA'], ['C', 'CLASSICA'], ['D', 'CLASSICA'],
  ['AX', 'DENTADA'], ['BX', 'DENTADA'], ['CX', 'DENTADA'],
  ['SPZ', 'ESTREITA'], ['SPA', 'ESTREITA'], ['SPB', 'ESTREITA'], ['SPC', 'ESTREITA'], ['3V', 'ESTREITA'], ['5V', 'ESTREITA'], ['8V', 'ESTREITA'],
];
const GRUPOS = {
  CLASSICA: { categoria: 'Correias em V clássicas', nome: (p: string) => `CORREIA INDUSTRIAL EM V PERFIL ${p}` },
  DENTADA: { categoria: 'Correias em V dentadas', nome: (p: string) => `CORREIA INDUSTRIAL EM V DENTADA PERFIL ${p}` },
  ESTREITA: { categoria: 'Correias em V estreitas', nome: (p: string) => `CORREIA INDUSTRIAL EM V ESTREITA PERFIL ${p}` },
};
// Perfil da Correia: atributo que já existe na categoria Correias (DNA); aqui ganha o valor fixo de cada família
const TEMPLATE_SKU = 'CIV-{Perfil da Correia}{Número da correia}';
const TEMPLATE_NOME = '{FAMILIA} - {Perfil da Correia}{Número da correia}';

type Conn = any;
const q = async (conn: Conn, sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];
const prenderPool = (conn: Conn) => {
  const original = { getConnection: pool.getConnection, execute: pool.execute, query: pool.query };
  const falsa = Object.create(conn);
  falsa.beginTransaction = async () => undefined;
  falsa.commit = async () => undefined;
  falsa.rollback = async () => undefined;
  falsa.release = () => undefined;
  (pool as any).getConnection = async () => falsa;
  (pool as any).execute = (...a: any[]) => conn.execute(...a);
  (pool as any).query = (...a: any[]) => conn.query(...a);
  return () => Object.assign(pool as any, original);
};
const chamar = async (fn: (req: any, res: any) => Promise<any>, params: any, body: any) => {
  let status = 200; let dados: any;
  const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
  await fn({ params, body, query: { tenant_id: TENANT }, headers: {} }, res);
  return { status, dados };
};
const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const migrar = async (conn: Conn) => {
  const criados = { atributos: [] as number[], familias: [] as number[], categorias: [] as number[] };
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = 'correia_numero'`, [TENANT])).length) {
    throw new Error('O atributo Número da correia já existe: esta migração já foi aplicada.');
  }
  // 1. Atributos: Perfil da Correia (existente) e Número da correia (novo)
  const idPerfil = Number((await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = 'perfil_da_correia' AND ativo = 1`, [TENANT]))[0]?.id);
  if (!idPerfil) throw new Error('Atributo Perfil da Correia não encontrado.');
  const [rn] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo)
    VALUES (?, 'Número da correia', 'correia_numero', 'numero', 'grade', 0, 1, 1)`, [TENANT]);
  const idNumero = Number(rn.insertId);
  criados.atributos.push(idNumero);

  // 2. Subcategorias em Correias
  const idCategoria: Record<string, number> = {};
  for (const [i, [chave, g]] of Object.entries(GRUPOS).entries()) {
    const ja = await q(conn, `SELECT id FROM comercial_categorias WHERE tenant_id = ? AND categoria_pai_id = ? AND nome = ?`, [TENANT, CAT_CORREIAS, g.categoria]);
    if (ja.length) { idCategoria[chave] = Number(ja[0].id); continue; }
    const [r] = await conn.query(`INSERT INTO comercial_categorias (tenant_id, categoria_pai_id, nome, slug, ativa, modo_exibicao, ordem) VALUES (?, ?, ?, ?, 1, 'grade', ?)`,
      [TENANT, CAT_CORREIAS, g.categoria, slug(g.categoria), i + 1]);
    idCategoria[chave] = Number(r.insertId);
    criados.categorias.push(idCategoria[chave]);
  }

  // 3. Famílias por perfil
  const idFamilia: Record<string, number> = {};
  for (const [p, grupo] of PERFIS) {
    const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
        template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, 'ficha', ?, 'ATIVO', 'PA', '-', ?, ?, 'PC', ?, '#1677ff', 0)`,
      [TENANT, idCategoria[grupo], GRUPOS[grupo].nome(p), p, TEMPLATE_SKU, TEMPLATE_NOME]);
    idFamilia[p] = Number(r.insertId);
    criados.familias.push(idFamilia[p]);
    await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem,
        compoe_sku, gera_variacao, valor_padrao_grupo, ativo) VALUES (?, 'familia', ?, ?, 'dna', 0, 1, 1, 1, 1, 0, ?, 1)`, [TENANT, idFamilia[p], idPerfil, p]);
    await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem,
        compoe_sku, gera_variacao, ativo) VALUES (?, 'familia', ?, ?, 'grade', 1, 1, 1, 2, 1, 1, 1)`, [TENANT, idFamilia[p], idNumero]);
  }

  // 4. Itens: HCV{perfil}{número}, conferido com o nome ("PERFIL A-58")
  const itens = await q(conn, `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
      cpd.familia_id, cpd.categoria_id, cpd.sku_customizado, cpd.nome_comercial
    FROM itens_core ic JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
    WHERE ic.tenant_id = ? AND ic.status <> 'INATIVO' AND ic.nome_item LIKE '%CORREIA%'`, [TENANT]);
  const porPerfil = new Map<string, Array<{ item: any; numero: string; esperado: string }>>();
  const fora: string[] = [];
  for (const it of itens) {
    const m = String(it.sku).match(/^HCV([A-Z]+)(\d+)$/);
    const perfil = m && PERFIS.find(([p]) => p === m[1]);
    if (!m || !perfil || !String(it.nome).toUpperCase().replace(/\s/g, '').includes(`PERFIL${m[1]}-${m[2]}`)) { fora.push(`${it.sku} · ${it.nome}`); continue; }
    porPerfil.set(m[1], [...(porPerfil.get(m[1]) || []), { item: it, numero: String(Number(m[2])), esperado: `CIV-${m[1]}${Number(m[2])}` }]);
  }
  const backupItens = itens.map(i => ({ idItem: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id, sku_customizado: i.sku_customizado, nome_comercial: i.nome_comercial }));
  // Valores que as correias já tinham no Perfil da Correia (voltam no reverter)
  const perfisAntes = itens.length ? await q(conn, `SELECT * FROM atributos_comercial_valores WHERE atributo_id = ? AND tipo_entidade = 'produto'
    AND id_entidade IN (${itens.map(() => '?').join(',')})`, [idPerfil, ...itens.map(i => i.id_item)]) : [];

  const linhas: string[] = [];
  const restaurar = prenderPool(conn);
  try {
    for (const [p, lista] of porPerfil) {
      const grupo = PERFIS.find(x => x[0] === p)![1];
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE tenant_id = ? AND id_item IN (${lista.map(() => '?').join(',')})`,
        [idFamilia[p], idCategoria[grupo], TENANT, ...lista.map(l => l.item.id_item)]);
      const r = await chamar(formalizarItensFamilia, { idFamilia: String(idFamilia[p]) },
        { itens: lista.map(l => ({ idItem: String(l.item.id_item), atributos: { [idPerfil]: p, [idNumero]: l.numero } })) });
      if (r.status >= 400) throw new Error(`Formalização perfil ${p}: ${r.dados?.error || r.status}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item IN (${lista.map(() => '?').join(',')})`,
        lista.map(l => l.item.id_item));
      for (const l of lista) {
        const d = depois.find(x => Number(x.id_item) === Number(l.item.id_item));
        if (!d || d.sku_customizado !== l.esperado) throw new Error(`SKU inesperado: ${l.item.sku} → ${d?.sku_customizado} (esperado ${l.esperado}). Nada foi gravado.`);
      }
      linhas.push(`  ${String(lista.length).padStart(3)}  ${GRUPOS[grupo].nome(p)}  ex.: ${lista[0].item.sku} → ${depois[0].sku_customizado} · ${depois[0].nome_comercial}`);
    }
  } finally {
    restaurar();
  }
  const vazias = PERFIS.filter(([p]) => !porPerfil.has(p)).map(([p, g]) => GRUPOS[g].nome(p));
  const rel = [
    `Atributos: Perfil da Correia (DNA fixo por família) e Número da correia (grade, novo) · subcategorias: ${Object.values(GRUPOS).map(g => g.categoria).join(', ')}`,
    `Famílias: ${PERFIS.length} (${porPerfil.size} com itens, ${vazias.length} preparadas)`,
    `\nCom itens:\n${linhas.join('\n')}`,
    `\nPreparadas (vazias):\n${vazias.map(v => `  ${v}`).join('\n')}`,
    fora.length ? `\nFicaram de fora (${fora.length}):\n${fora.map(x => `  ${x}`).join('\n')}` : '',
  ];
  return { rel, backup: { criados, backupItens, idPerfil, perfisAntes } };
};

const reverter = async (conn: Conn, arquivo: string) => {
  const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const c = b.criados;
  await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id IN (${c.atributos.join(',')})`);
  const ids = b.backupItens.map((i: any) => i.idItem);
  if (ids.length) {
    await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id = ? AND tipo_entidade = 'produto' AND id_entidade IN (${ids.join(',')})`, [b.idPerfil]);
  }
  for (const v of b.perfisAntes) {
    await conn.query(`INSERT INTO atributos_comercial_valores (tenant_id, atributo_id, tipo_entidade, id_entidade, valor_texto, valor_numero, valor_decimal, valor_data, valor_boolean, opcao_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [v.tenant_id, v.atributo_id, v.tipo_entidade, v.id_entidade, v.valor_texto, v.valor_numero, v.valor_decimal, v.valor_data, v.valor_boolean, v.opcao_id]);
  }
  for (const i of b.backupItens) {
    await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ? WHERE tenant_id = ? AND id_item = ?`,
      [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, TENANT, i.idItem]);
  }
  const restam = await q(conn, `SELECT COUNT(*) n FROM comercial_produtos_dados WHERE familia_id IN (${c.familias.join(',')})`);
  if (Number(restam[0].n) > 0) throw new Error(`Há ${restam[0].n} item(ns) novos nas famílias de correia: tire-os antes de reverter.`);
  await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade IN (${c.familias.join(',')})`);
  await conn.query(`DELETE FROM comercial_familias WHERE id IN (${c.familias.join(',')})`);
  if (c.categorias.length) await conn.query(`DELETE FROM comercial_categorias WHERE id IN (${c.categorias.join(',')})`);
  await conn.query(`DELETE FROM atributos_comercial WHERE id IN (${c.atributos.join(',')})`);
  return `Revertido: ${b.backupItens.length} correias de volta; famílias, subcategorias e atributos removidos.`;
};

(async () => {
  const [modo, arquivo] = process.argv.slice(2);
  if (!['simular', 'aplicar', 'reverter'].includes(modo)) { console.log('Uso: simular | aplicar | reverter <backup>'); process.exit(1); }
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (modo === 'reverter') {
      console.log(await reverter(conn, arquivo));
      await conn.commit();
    } else {
      const r = await migrar(conn);
      console.log(r.rel.join('\n'));
      if (modo === 'aplicar') {
        const pasta = path.resolve(__dirname, '../../../backups');
        fs.mkdirSync(pasta, { recursive: true });
        const destino = path.join(pasta, `correias-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(destino, JSON.stringify(r.backup, null, 1));
        await conn.commit();
        console.log(`\nGRAVADO. Backup: ${destino}`);
      } else {
        await conn.rollback();
        console.log('\nSIMULAÇÃO: nada foi gravado (rollback).');
      }
    }
  } catch (e) {
    await conn.rollback();
    console.error(`\nERRO: ${e instanceof Error ? e.message : e}\nNada foi gravado.`);
    process.exitCode = 1;
  } finally {
    conn.release();
    process.exit();
  }
})();
