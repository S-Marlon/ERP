// Conexões de PVC (soldável marrom e roscável branca): família por peça e linha, com bitola e marca como grade.
// SKU PVC{linha}-{peça}-{bitola}/{MARCA}: luva soldável 25 mm Amanco → PVCS-LV-25/AMANCO; LR 25 mm × 3/4 → PVCS-LVR-25-12/AMANCO.
// Bitola soldável em mm (código = mm); roscável em polegadas (código como na hidráulica: 3/4" = 12, 1" = 16).
//   npx ts-node src/scripts/migracaoPvc.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
const CAT = 55;
const CHAVE_MARCA = 'atributo-marca-virtual';
const LISTAS = {
  s: { nome: 'Bitola PVC soldável', codigo: 'pvc_bitola_soldavel', opcoes: ['20', '25', '32', '40', '50', '60', '75', '85', '110'].map(b => [`${b} MM`, b]) },
  s2: { nome: 'Bitola PVC soldável 2', codigo: 'pvc_bitola_soldavel_2', opcoes: ['20', '25', '32', '40', '50', '60', '75', '85', '110'].map(b => [`${b} MM`, b]) },
  r: { nome: 'Bitola PVC roscável', codigo: 'pvc_bitola_roscavel', opcoes: [['1/2"', '08'], ['3/4"', '12'], ['1"', '16'], ['1.1/4"', '20'], ['1.1/2"', '24'], ['2"', '32']] },
} as const;
type K = keyof typeof LISTAS;
// [sigla, nome, lados]
const FAMILIAS: Array<[string, string, K[]]> = [
  ['PVCS-LV', 'LUVA SOLDÁVEL PVC MARROM', ['s']],
  ['PVCS-LVR', 'LUVA SOLDÁVEL X ROSCA PVC MARROM', ['s', 'r']],
  ['PVCS-JE', 'COTOVELO 90° SOLDÁVEL PVC MARROM', ['s']],
  ['PVCS-JER', 'COTOVELO 90° SOLDÁVEL X ROSCA PVC MARROM', ['s', 'r']],
  ['PVCS-CV', 'CURVA 90° SOLDÁVEL PVC MARROM', ['s']],
  ['PVCS-TE', 'TÊ SOLDÁVEL PVC MARROM', ['s']],
  ['PVCS-UN', 'UNIÃO SOLDÁVEL PVC MARROM', ['s']],
  ['PVCS-BC', 'BUCHA DE REDUÇÃO CURTA SOLDÁVEL PVC MARROM', ['s', 's2']],
  ['PVCS-CP', 'CAP SOLDÁVEL PVC MARROM', ['s']],
  ['PVCS-AC', 'ADAPTADOR CURTO SOLDÁVEL X ROSCA PVC MARROM', ['s', 'r']],
  ['PVCS-RE', 'REGISTRO DE ESFERA SOLDÁVEL PVC', ['s']],
  ['PVCR-JE', 'COTOVELO 90° ROSCÁVEL PVC BRANCO', ['r']],
  ['PVCR-NP', 'NIPLE ROSCÁVEL PVC BRANCO', ['r']],
];
// SKU de hoje → [sigla, bitolas (códigos), marca]
const ITENS: Record<string, [string, string[], string]> = {
  '175609': ['PVCS-LV', ['25'], 'AMANCO'], '175617': ['PVCS-LV', ['32'], 'AMANCO'],
  '175854': ['PVCS-LVR', ['25', '12'], 'AMANCO'], '175870': ['PVCS-LVR', ['32', '16'], 'AMANCO'],
  '175560': ['PVCS-JE', ['32'], 'AMANCO'], '44027': ['PVCS-JE', ['25'], 'KRONA'],
  '175820': ['PVCS-JER', ['25', '12'], 'AMANCO'],
  '175463': ['PVCS-CV', ['32'], 'AMANCO'], '69369': ['PVCS-CV', ['25'], 'AMANCO'],
  '175692': ['PVCS-TE', ['32'], 'AMANCO'], '8950': ['PVCS-TE', ['25'], 'AMANCO'],
  '175781': ['PVCS-UN', ['32'], 'AMANCO'], '9221': ['PVCS-UN', ['25'], 'AMANCO'],
  '175366': ['PVCS-BC', ['25', '20'], 'AMANCO'], '182346': ['PVCS-BC', ['40', '32'], 'AMANCO'], '301': ['PVCS-BC', ['32', '25'], 'AMANCO'],
  '8890': ['PVCS-CP', ['25'], 'AMANCO'], '75531': ['PVCS-CP', ['32'], 'TIGRE'],
  '8886': ['PVCS-AC', ['25', '12'], 'AMANCO'], '8887': ['PVCS-AC', ['32', '16'], 'AMANCO'],
  '48256': ['PVCS-RE', ['25'], 'KRONA'], '27673': ['PVCS-RE', ['25'], 'VIQUA'],
  '176168': ['PVCR-JE', ['12'], 'AMANCO'], '176176': ['PVCR-JE', ['16'], 'AMANCO'],
  '228435': ['PVCR-NP', ['16'], 'AMANCO'], '44093': ['PVCR-NP', ['12'], 'KRONA'],
};
// Marcas: nome em maiúsculo (vai no SKU); as que faltam são criadas
const MARCAS = ['AMANCO', 'TIGRE', 'KRONA', 'VIQUA'];

type Conn = any;
const q = async (conn: Conn, sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];

const migrar = async (conn: Conn) => {
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE codigo = 'pvc_bitola_soldavel'`)).length) throw new Error('Já aplicado.');
  const criados = { atributos: [] as number[], familias: [] as number[], marcas: [] as number[] };
  const marcasAntes = await q(conn, `SELECT id, nome FROM comercial_marcas WHERE tenant_id = ?`, [TENANT]);
  for (const nome of MARCAS) {
    const ex = marcasAntes.find(m => String(m.nome).toUpperCase() === nome);
    if (ex) await conn.query(`UPDATE comercial_marcas SET nome = ? WHERE id = ?`, [nome, ex.id]);
    else {
      const [r] = await conn.query(`INSERT INTO comercial_marcas (tenant_id, nome, slug, status) VALUES (?, ?, ?, 'Ativo')`, [TENANT, nome, nome.toLowerCase()]);
      criados.marcas.push(Number(r.insertId));
    }
  }
  const ids = {} as Record<K, number>;
  for (const [k, l] of Object.entries(LISTAS) as Array<[K, typeof LISTAS[K]]>) {
    const [r] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo)
      VALUES (?, ?, ?, 'lista', 'grade', 0, 1, 1)`, [TENANT, l.nome, l.codigo]);
    ids[k] = Number(r.insertId);
    criados.atributos.push(ids[k]);
    for (const [i, [valor, codigo]] of l.opcoes.entries()) {
      await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, ids[k], valor, codigo, i + 1]);
    }
  }
  const idFamilia: Record<string, number> = {};
  for (const [sigla, nome, lados] of FAMILIAS) {
    const sku = `{SIGLA}-${lados.map(k => `{${LISTAS[k].nome}:cod}`).join('-')}/{MARCA}`;
    const nomeT = `{FAMILIA} - ${lados.map(k => `{${LISTAS[k].nome}}`).join(' X ')} | {MARCA}`;
    const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
        template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, 'grade', ?, 'ATIVO', 'PA', '-', ?, ?, 'UN', ?, '#1677ff', 0)`, [TENANT, CAT, nome, sigla, sku, nomeT]);
    idFamilia[sigla] = Number(r.insertId);
    criados.familias.push(idFamilia[sigla]);
    for (const [o, k] of lados.entries()) {
      await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem,
          compoe_sku, gera_variacao, ativo) VALUES (?, 'familia', ?, ?, 'grade', 0, 1, 1, ?, 1, 1, 1)`, [TENANT, idFamilia[sigla], ids[k], o + 1]);
    }
  }

  const skus = Object.keys(ITENS);
  const itens = await q(conn, `SELECT p.id_item, p.familia_id, p.categoria_id, p.sku_customizado, p.nome_comercial, p.id_marca, ic.sku AS sku_raiz,
      COALESCE(NULLIF(p.sku_customizado,''), ic.sku) AS sku, COALESCE(NULLIF(p.nome_comercial,''), ic.nome_item) AS nome
    FROM comercial_produtos_dados p JOIN itens_core ic ON ic.id_item = p.id_item WHERE ic.tenant_id = ? AND ic.status <> 'INATIVO'`, [TENANT]);
  const alvo = itens.filter(i => skus.includes(String(i.sku)));
  const faltando = skus.filter(s => !alvo.some(i => String(i.sku) === s));
  if (faltando.length) throw new Error(`SKUs não encontrados: ${faltando.join(', ')}`);

  const original = { getConnection: pool.getConnection };
  (pool as any).getConnection = async () => Object.assign(Object.create(conn), { beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined });
  const linhas: string[] = [];
  try {
    for (const [sigla, nomeFam, lados] of FAMILIAS) {
      const lista = alvo.filter(i => ITENS[String(i.sku)][0] === sigla);
      if (!lista.length) continue;
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE id_item IN (${lista.map(() => '?').join(',')})`,
        [idFamilia[sigla], CAT, ...lista.map(i => i.id_item)]);
      const corpo = lista.map(i => {
        const [, codigos, marca] = ITENS[String(i.sku)];
        const atributos: Record<string, string> = { [CHAVE_MARCA]: marca };
        lados.forEach((k, n) => {
          const op = LISTAS[k].opcoes.find(([, c]) => c === codigos[n]);
          if (!op) throw new Error(`${i.sku}: bitola ${codigos[n]} fora da lista ${LISTAS[k].nome}`);
          atributos[String(ids[k])] = op[0];
        });
        return { idItem: String(i.id_item), atributos };
      });
      let status = 200; let dados: any;
      const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
      await formalizarItensFamilia({ params: { idFamilia: String(idFamilia[sigla]) }, query: { tenant_id: TENANT }, headers: {}, body: { itens: corpo } } as any, res);
      if (status >= 400) throw new Error(`${nomeFam}: ${dados?.error}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE familia_id = ?`, [idFamilia[sigla]]);
      linhas.push(`\n  ${nomeFam} (${lista.length})`);
      for (const d of depois) {
        const i = lista.find(x => x.id_item === d.id_item);
        const [, codigos, marca] = ITENS[String(i.sku)];
        const esperado = `${sigla}-${codigos.join('-')}/${marca}`;
        if (d.sku_customizado !== esperado) throw new Error(`SKU inesperado: ${i.sku} → ${d.sku_customizado} (esperado ${esperado})`);
        linhas.push(`    ${String(i.sku).padEnd(8)} → ${String(d.sku_customizado).padEnd(24)} ${d.nome_comercial}   (antes: ${i.nome})`);
      }
    }
  } finally {
    Object.assign(pool as any, original);
  }
  return { rel: linhas, backup: { criados, marcasAntes, itens: alvo.map(i => ({ id_item: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id,
    sku_customizado: i.sku_customizado, nome_comercial: i.nome_comercial, id_marca: i.id_marca })) } };
};

(async () => {
  const [modo, arquivo] = process.argv.slice(2);
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (modo === 'reverter') {
      const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      const c = b.criados;
      await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id IN (${c.atributos.join(',')})`);
      for (const i of b.itens) await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ?, id_marca = ? WHERE id_item = ?`,
        [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, i.id_marca, i.id_item]);
      await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade IN (${c.familias.join(',')})`);
      await conn.query(`DELETE FROM comercial_familias WHERE id IN (${c.familias.join(',')})`);
      await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE atributo_id IN (${c.atributos.join(',')})`);
      await conn.query(`DELETE FROM atributos_comercial WHERE id IN (${c.atributos.join(',')})`);
      for (const m of b.marcasAntes) await conn.query(`UPDATE comercial_marcas SET nome = ? WHERE id = ?`, [m.nome, m.id]);
      if (c.marcas.length) await conn.query(`DELETE FROM comercial_marcas WHERE id IN (${c.marcas.join(',')}) AND NOT EXISTS (SELECT 1 FROM comercial_produtos_dados p WHERE p.id_marca = comercial_marcas.id)`);
      await conn.commit();
      console.log('Revertido.');
    } else {
      const r = await migrar(conn);
      console.log(r.rel.join('\n'));
      if (modo === 'aplicar') {
        const destino = path.resolve(__dirname, '../../../backups', `pvc-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
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
