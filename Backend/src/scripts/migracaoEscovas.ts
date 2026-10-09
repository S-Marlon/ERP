// Escovas de carvão: família por ferramenta, SKU de hoje (EC-xxx) mantido pelo atributo Código da escova; aplicação
// (máquinas) e medidas em mm separadas (busca por medida); embalagem unidade/par quando o nome diz.
//   npx ts-node src/scripts/migracaoEscovas.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
const CAT = 52;
const FERRAMENTAS: Array<[string, RegExp]> = [
  ['ESMERILHADEIRA', /^esmerilhadeira/i],
  ['FURADEIRA', /^(furadeira|406P)/i],
  ['LIXADEIRA E POLITRIZ', /^(lixadeira|politriz)/i],
  ['MARTELO', /^martelo/i],
  ['SERRA CIRCULAR', /^serra (circular|madeira)/i],
  ['SERRA MÁRMORE', /^serra m[aá]rmore/i],
];
const ATRIBUTOS: Array<[string, string, string, string]> = [ // [chave, nome, código, tipo]
  ['codigo', 'Código da escova', 'escova_codigo', 'texto'],
  ['aplicacao', 'Aplicação', 'escova_aplicacao', 'texto'],
  ['comp', 'Comprimento (mm)', 'escova_comprimento', 'decimal'],
  ['larg', 'Largura (mm)', 'escova_largura', 'decimal'],
  ['esp', 'Espessura (mm)', 'escova_espessura', 'decimal'],
  ['emb', 'Embalagem', 'escova_embalagem', 'lista'],
];

type Conn = any;
const q = async (conn: Conn, sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];

const lerItem = (nomeOriginal: string) => {
  let t = String(nomeOriginal).replace(/&amp;/g, '&').replace(/^escova de carv[aã]o\s*-\s*/i, '').replace(/\s+/g, ' ').trim();
  const emb = /\bpar\b/i.test(t) ? 'PAR' : /\bunidade\b/i.test(t) ? 'UNIDADE' : null;
  t = t.replace(/\s*-\s*(par|unidade)\b/i, '');
  // Medidas ficam no fim do nome ("... 16x7,9x4,9mm", "(Medida 17x8x5)"): ancora no fim para não ler o modelo (849X) como medida
  const m = t.match(/\(?(?:medida\s*)?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?\)?\s*$/i);
  const num = (v: string) => String(Number(v.replace(',', '.')));
  const medidas = m ? { comp: num(m[1]), larg: num(m[2]), esp: num(m[3]) } : null;
  const aplicacao = (m ? t.replace(m[0], '') : t).replace(/\s*[-/]\s*$/, '').replace(/\s+/g, ' ').trim();
  const ferramenta = FERRAMENTAS.find(([, re]) => re.test(aplicacao))?.[0] || null;
  return { aplicacao, medidas, emb, ferramenta };
};

const migrar = async (conn: Conn) => {
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE codigo = 'escova_codigo'`)).length) throw new Error('Já aplicado.');
  const ids: Record<string, number> = {};
  for (const [k, nome, codigo, tipo] of ATRIBUTOS) {
    const [r] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo)
      VALUES (?, ?, ?, ?, ?, 0, 1, 1)`, [TENANT, nome, codigo, tipo, k === 'codigo' ? 'grade' : 'ficha']);
    ids[k] = Number(r.insertId);
  }
  for (const [i, v] of ['UNIDADE', 'PAR'].entries()) {
    await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, ids.emb, v, v, i + 1]);
  }
  const idFamilia: Record<string, number> = {};
  for (const [f] of FERRAMENTAS) {
    const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
        template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, 'ficha', ?, 'ATIVO', 'PA', '-', 'EC', '{SIGLA}-{Código da escova}', 'PC',
        '{FAMILIA} - EC-{Código da escova} - {Aplicação}', '#1677ff', 0)`, [TENANT, CAT, `ESCOVA DE CARVÃO P/ ${f}`]);
    idFamilia[f] = Number(r.insertId);
    for (const [o, [k]] of ATRIBUTOS.entries()) {
      await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem,
          compoe_sku, gera_variacao, ativo) VALUES (?, 'familia', ?, ?, ?, 0, 1, 1, ?, ?, ?, 1)`,
        [TENANT, idFamilia[f], ids[k], k === 'codigo' ? 'grade' : 'ficha', o + 1, k === 'codigo' ? 1 : 0, k === 'codigo' ? 1 : 0]);
    }
  }
  const [[col]]: any = await conn.query(`SHOW COLUMNS FROM comercial_produtos_dados LIKE 'nome_comercial'`);
  const limite = Number(String(col.Type).match(/\d+/)?.[0] || 255);

  const itens = (await q(conn, `SELECT p.id_item, p.familia_id, p.categoria_id, p.sku_customizado, p.nome_comercial, COALESCE(NULLIF(p.sku_customizado,''), ic.sku) sku,
      COALESCE(NULLIF(p.nome_comercial,''), ic.nome_item) nome FROM comercial_produtos_dados p JOIN itens_core ic ON ic.id_item = p.id_item
      WHERE ic.tenant_id = ? AND ic.status <> 'INATIVO' AND ic.nome_item LIKE 'Escova de carv%'`, [TENANT])).filter(i => /^EC-/.test(String(i.sku)));
  const planos = new Map<string, any[]>();
  const fora: string[] = [];
  for (const it of itens) {
    const l = lerItem(it.nome);
    if (!l.ferramenta) { fora.push(`${it.sku} · ${it.nome}`); continue; }
    const atributos: Record<string, string> = { [ids.codigo]: String(it.sku).replace(/^EC-/, ''), [ids.aplicacao]: l.aplicacao.toUpperCase() };
    if (l.medidas) { atributos[ids.comp] = l.medidas.comp; atributos[ids.larg] = l.medidas.larg; atributos[ids.esp] = l.medidas.esp; }
    if (l.emb) atributos[ids.emb] = l.emb;
    planos.set(l.ferramenta, [...(planos.get(l.ferramenta) || []), { it, atributos, l }]);
  }

  const original = { getConnection: pool.getConnection };
  (pool as any).getConnection = async () => Object.assign(Object.create(conn), { beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined });
  const linhas: string[] = [];
  try {
    for (const [f, lista] of planos) {
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE id_item IN (${lista.map(() => '?').join(',')})`,
        [idFamilia[f], CAT, ...lista.map(p => p.it.id_item)]);
      let status = 200; let dados: any;
      const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
      await formalizarItensFamilia({ params: { idFamilia: String(idFamilia[f]) }, query: { tenant_id: TENANT }, headers: {},
        body: { itens: lista.map(p => ({ idItem: String(p.it.id_item), atributos: p.atributos })) } } as any, res);
      if (status >= 400) throw new Error(`${f}: ${dados?.error}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE familia_id = ?`, [idFamilia[f]]);
      linhas.push(`\n  ESCOVA DE CARVÃO P/ ${f} (${lista.length})`);
      for (const d of depois) {
        const p = lista.find(x => x.it.id_item === d.id_item);
        if (d.sku_customizado !== p.it.sku) throw new Error(`SKU mudaria: ${p.it.sku} → ${d.sku_customizado}`);
        if (String(d.nome_comercial).length > limite) throw new Error(`Nome maior que a coluna: ${d.nome_comercial}`);
        const med = p.l.medidas ? `${p.l.medidas.comp} x ${p.l.medidas.larg} x ${p.l.medidas.esp} mm` : 'sem medidas';
        linhas.push(`    ${String(d.sku_customizado).padEnd(10)} ${med.padEnd(18)} ${p.l.emb || ''} · ${d.nome_comercial}`);
      }
    }
  } finally {
    Object.assign(pool as any, original);
  }
  return { rel: [...linhas, fora.length ? `\nFicaram de fora (${fora.length}):\n${fora.map(x => `  ${x}`).join('\n')}` : ''],
    backup: { atributos: Object.values(ids), familias: Object.values(idFamilia), itens: itens.map(i => ({ id_item: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id,
      sku_customizado: i.sku_customizado, nome_comercial: i.nome_comercial })) } };
};

(async () => {
  const [modo, arquivo] = process.argv.slice(2);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (modo === 'reverter') {
      const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id IN (${b.atributos.join(',')})`);
      for (const i of b.itens) await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ? WHERE id_item = ?`,
        [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, i.id_item]);
      await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade IN (${b.familias.join(',')})`);
      await conn.query(`DELETE FROM comercial_familias WHERE id IN (${b.familias.join(',')})`);
      await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE atributo_id IN (${b.atributos.join(',')})`);
      await conn.query(`DELETE FROM atributos_comercial WHERE id IN (${b.atributos.join(',')})`);
      await conn.commit();
      console.log('Revertido.');
    } else {
      const r = await migrar(conn);
      console.log(r.rel.join('\n'));
      if (modo === 'aplicar') {
        const destino = path.resolve(__dirname, '../../../backups', `escovas-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(destino, JSON.stringify(r.backup, null, 1));
        await conn.commit();
        console.log(`\nGRAVADO. Backup: ${destino}`);
      } else { await conn.rollback(); console.log('\nSIMULAÇÃO: nada foi gravado.'); }
    }
  } catch (e) {
    await conn.rollback();
    console.error(`ERRO: ${e instanceof Error ? e.message : e}. Nada foi gravado.`);
  } finally { conn.release(); process.exit(); }
})();
