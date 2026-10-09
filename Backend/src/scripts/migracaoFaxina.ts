// Faxina final do catálogo: categoria certa para os soltos, nomes sem "[NOVO]"/"&amp;", e famílias pequenas onde há
// variação real (EPIs por tamanho/lente/cano, protetor de mangueira, disjuntor, cabo PP, porta-eletrodo, motobombas).
//   npx ts-node src/scripts/migracaoFaxina.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
const CHAVE_MARCA = 'atributo-marca-virtual';

// ---------------------------------------------------------------- só categoria (SKU e nome ficam)
const CATEGORIA: Record<string, number | 'ORING'> = {
  // Lavação (o bloco continua como está; só sai do "sem categoria")
  '000.LUB-29AL': 21, '000.LUB-29A-AL': 21, '000.LAV37': 21, '000.LUB-2040L': 21, '000.LUB-2040LP': 21, '000.LUB-LAV01': 21, '000.LUB-LAV02': 21,
  '000.LUB-LAV03': 21, '000.LAV36': 21, '000.LAV31': 21, '000.LUB-28': 21, '000.LUB-28D': 21, '300.LAVBCOLORA': 21, '300.LAVB-COLOR': 21,
  '000.LAV33': 21, '000.LAV35': 21, '000.LUB-FLUX': 21,
  '386871': 60, '386880': 60, // cordas
  '93069': 2, // mangueira para gasolina
  'GD-3485': 57, 'GD-3400': 57, 'GD-3695': 57, 'GD-3028': 57, 'GD-3690': 57, 'GD-6685': 57, 'GD-3345': 57, 'GD-6550': 57, 'GD-3120': 57, 'GD-3036': 57,
  'GD-3900': 54, 'GD-3115': 64, 'GD-3105': 64, 'GD-3110': 64,
  'FLUID-ATF-LT': 8, 'FREIO-DOT4-LT': 8, 'HID-68-GL': 8, 'TOP-15W40-GL': 8, 'LUB-20W50-LT': 8, 'MOTO-20W50-LT': 8,
  'KITORING-JON': 'ORING', 'KITORING-MET225': 'ORING', 'KITORING-MET': 'ORING', 'KITORING-POL': 'ORING', 'KITORING-METSIL': 'ORING',
  '250F3-08': 29, '250F3-12': 29, '250F6-12': 29, '200JF-12-12': 29,
};

// ---------------------------------------------------------------- famílias pequenas
type Fam = { chave: string; nome: string; cat: number; sigla: string; sku: string; nomeT: string; attrs: string[]; marca?: boolean };
type Attr = { nome: string; codigo: string; opcoes: Array<[string, string]> };
const ATRIBUTOS: Record<string, Attr> = {
  tam: { nome: 'Tamanho', codigo: 'epi_tamanho', opcoes: [['P', 'P'], ['M', 'M'], ['G', 'G'], ['GG', 'GG'], ['XG', 'XG']] },
  lente: { nome: 'Lente', codigo: 'oculos_lente', opcoes: [['INCOLOR', 'INCOLOR'], ['FUMÊ', 'FUME'], ['ESPELHADA', 'ESPELHADA']] },
  cano: { nome: 'Cano da luva', codigo: 'luva_cano', opcoes: [['7 CM', '07CM'], ['15 CM', '15CM'], ['20 CM', '20CM']] },
  diam: { nome: 'Diâmetro do protetor', codigo: 'protetor_diametro', opcoes: [['12 MM', '12'], ['16 MM', '16'], ['20 MM', '20'], ['25 MM', '25'], ['32 MM', '32']] },
  amp: { nome: 'Corrente (A)', codigo: 'disjuntor_corrente', opcoes: ['6', '10', '16', '20', '25', '32', '40', '50', '63'].map(a => [`${a} A`, `${a}A`]) },
  cabo: { nome: 'Vias x seção', codigo: 'cabo_vias_secao', opcoes: [['1 X 0,5 MM²', '1X0.5'], ['2 X 1,5 MM²', '2X1.5'], ['2 X 2,5 MM²', '2X2.5'], ['3 X 1,5 MM²', '3X1.5'], ['3 X 2,5 MM²', '3X2.5']] },
  ampel: { nome: 'Capacidade (A)', codigo: 'porta_eletrodo_corrente', opcoes: [['200 A', '200A'], ['300 A', '300A'], ['500 A', '500A']] },
  modelo: { nome: 'Modelo da bomba', codigo: 'bomba_modelo', opcoes: [] },
  pot: { nome: 'Potência (HP)', codigo: 'bomba_potencia', opcoes: [] },
};
const FAMILIAS: Fam[] = [
  { chave: 'LUVA-PU', nome: 'LUVA MULTITATO COM BANHO DE PU PRETA', cat: 56, sigla: 'LUVA-PU', sku: '{SIGLA}-{Tamanho:cod}/{MARCA}', nomeT: '{FAMILIA} - TAM. {Tamanho} | {MARCA}', attrs: ['tam'], marca: true },
  { chave: 'LUVA-NBR', nome: 'LUVA NITRÍLICA (NBR) WAVE', cat: 56, sigla: 'LUVA-NBR', sku: '{SIGLA}-{Tamanho:cod}/{MARCA}', nomeT: '{FAMILIA} - TAM. {Tamanho} | {MARCA}', attrs: ['tam'], marca: true },
  { chave: 'OCULOS-SKY', nome: 'ÓCULOS DE PROTEÇÃO SKY', cat: 56, sigla: 'OCULOS-SKY', sku: '{SIGLA}-{Lente:cod}/{MARCA}', nomeT: '{FAMILIA} - LENTE {Lente} | {MARCA}', attrs: ['lente'], marca: true },
  { chave: 'OCULOS-SUMMER', nome: 'ÓCULOS DE PROTEÇÃO SUMMER', cat: 56, sigla: 'OCULOS-SUMMER', sku: '{SIGLA}-{Lente:cod}/{MARCA}', nomeT: '{FAMILIA} - LENTE {Lente} | {MARCA}', attrs: ['lente'], marca: true },
  { chave: 'LUVA-RASPA', nome: 'LUVA DE RASPA REFORÇADA', cat: 58, sigla: 'LUVA-RASPA', sku: '{SIGLA}-{Cano da luva:cod}/{MARCA}', nomeT: '{FAMILIA} - CANO {Cano da luva} | {MARCA}', attrs: ['cano'], marca: true },
  { chave: 'HPM', nome: 'PROTETOR PLÁSTICO ESPIRAL PARA MANGUEIRA', cat: 62, sigla: 'HPM', sku: '{SIGLA}{Diâmetro do protetor:cod}', nomeT: '{FAMILIA} - {Diâmetro do protetor}', attrs: ['diam'] },
  { chave: 'DISJ-1P', nome: 'DISJUNTOR MONOPOLAR (1P)', cat: 54, sigla: 'DISJ-1P', sku: '{SIGLA}-{Corrente (A):cod}/{MARCA}', nomeT: '{FAMILIA} - {Corrente (A)} | {MARCA}', attrs: ['amp'], marca: true },
  { chave: 'CABO-PP', nome: 'CABO PP FLEXÍVEL', cat: 54, sigla: 'CABO-PP', sku: '{SIGLA}-{Vias x seção:cod}', nomeT: '{FAMILIA} - {Vias x seção}', attrs: ['cabo'] },
  { chave: 'PORTA-ELET', nome: 'PORTA-ELETRODO', cat: 58, sigla: 'PORTA-ELET', sku: '{SIGLA}-{Capacidade (A):cod}/{MARCA}', nomeT: '{FAMILIA} - {Capacidade (A)} | {MARCA}', attrs: ['ampel'], marca: true },
  { chave: 'MB-3BPS2', nome: 'MOTOBOMBA SUBMERSA 3" 3BPS2 MONOFÁSICA 220V', cat: 61, sigla: 'MB', sku: '{Modelo da bomba}/{MARCA}', nomeT: '{FAMILIA} - {Modelo da bomba} - {Potência (HP)} HP | {MARCA}', attrs: ['modelo', 'pot'], marca: true },
  { chave: 'MB-3SDM', nome: 'MOTOBOMBA SUBMERSA 3" 3SDM 2 FIOS 220V', cat: 61, sigla: 'MB', sku: '{Modelo da bomba}/{MARCA}', nomeT: '{FAMILIA} - {Modelo da bomba} - {Potência (HP)} HP | {MARCA}', attrs: ['modelo', 'pot'], marca: true },
];
// SKU de hoje → [família, valores por chave de atributo, marca]
const ITENS: Record<string, [string, Record<string, string>, string?]> = {
  '2354': ['LUVA-PU', { tam: 'P' }, 'KALIPSO'], '599': ['LUVA-PU', { tam: 'M' }, 'KALIPSO'], '424': ['LUVA-PU', { tam: 'G' }, 'KALIPSO'], '597': ['LUVA-PU', { tam: 'XG' }, 'KALIPSO'],
  '5634': ['LUVA-NBR', { tam: 'M' }, 'KALIPSO'], '5648': ['LUVA-NBR', { tam: 'G' }, 'KALIPSO'], '7103': ['LUVA-NBR', { tam: 'XG' }, 'KALIPSO'],
  '51384': ['OCULOS-SKY', { lente: 'FUME' }, 'SAFETY'], '51385': ['OCULOS-SKY', { lente: 'INCOLOR' }, 'SAFETY'], '51386': ['OCULOS-SKY', { lente: 'ESPELHADA' }, 'SAFETY'],
  '55226': ['OCULOS-SUMMER', { lente: 'FUME' }, 'SAFETY'], '51389': ['OCULOS-SUMMER', { lente: 'INCOLOR' }, 'SAFETY'],
  '93288': ['LUVA-RASPA', { cano: '07CM' }, 'ZANEL'], '93289': ['LUVA-RASPA', { cano: '15CM' }, 'ZANEL'], '93290': ['LUVA-RASPA', { cano: '20CM' }, 'ZANEL'],
  'HPM12': ['HPM', { diam: '12' }], 'HPM16': ['HPM', { diam: '16' }], 'HPM20': ['HPM', { diam: '20' }],
  '14626': ['DISJ-1P', { amp: '10A' }, 'LUKMA'], '14625': ['DISJ-1P', { amp: '16A' }, 'LUKMA'],
  'AV384444821-12': ['CABO-PP', { cabo: '1X0.5' }], '35195': ['CABO-PP', { cabo: '2X1.5' }], 'AV384444821-11': ['CABO-PP', { cabo: '2X2.5' }],
  '69007': ['PORTA-ELET', { ampel: '300A' }, 'STARFER'], '69008': ['PORTA-ELET', { ampel: '500A' }, 'STARFER'],
  '3862': ['MB-3BPS2', { modelo: '3BPS2-10', pot: '0,5' }, 'EBARA'], '3863': ['MB-3BPS2', { modelo: '3BPS2-14', pot: '0,75' }, 'EBARA'],
  '3861': ['MB-3BPS2', { modelo: '3BPS2-18', pot: '1' }, 'EBARA'], '3864': ['MB-3BPS2', { modelo: '3BPS2-22', pot: '1,5' }, 'EBARA'],
  '71107175': ['MB-3SDM', { modelo: '3SDM-13', pot: '0,75' }, 'TETIS'], '71107176': ['MB-3SDM', { modelo: '3SDM-18', pot: '1' }, 'TETIS'],
};
const MARCAS = ['KALIPSO', 'SAFETY', 'ZANEL', 'LUKMA', 'STARFER', 'EBARA', 'TETIS'];

type Conn = any;
const q = async (conn: Conn, sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];

const migrar = async (conn: Conn) => {
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE codigo = 'epi_tamanho'`)).length) throw new Error('Já aplicado.');
  const criados = { atributos: [] as number[], familias: [] as number[], marcas: [] as number[], categorias: [] as number[] };
  const linhas: string[] = [];
  const todos = await q(conn, `SELECT p.id_item, p.familia_id, p.categoria_id, p.sku_customizado, p.nome_comercial, p.id_marca,
      COALESCE(NULLIF(p.sku_customizado,''), ic.sku) AS sku, COALESCE(NULLIF(p.nome_comercial,''), ic.nome_item) AS nome
    FROM comercial_produtos_dados p JOIN itens_core ic ON ic.id_item = p.id_item WHERE ic.tenant_id = ? AND ic.status <> 'INATIVO'`, [TENANT]);
  const porSku = new Map(todos.map(i => [String(i.sku), i]));
  const faltando = [...Object.keys(CATEGORIA), ...Object.keys(ITENS)].filter(s => !porSku.has(s));
  if (faltando.length) throw new Error(`SKUs não encontrados: ${faltando.join(', ')}`);
  // Nomes a limpar: "[NOVO] " e "&amp;"
  const sujos = todos.filter(i => i.nome_comercial && (/^\[NOVO\]\s*/i.test(i.nome_comercial) || i.nome_comercial.includes('&amp;')));
  const backupItens = new Map<number, any>();
  const guardar = (i: any) => backupItens.set(i.id_item, { id_item: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id,
    sku_customizado: i.sku_customizado, nome_comercial: i.nome_comercial, id_marca: i.id_marca });

  // 1. Categoria nova para os kits de o-ring
  const [rc] = await conn.query(`INSERT INTO comercial_categorias (tenant_id, categoria_pai_id, nome, slug, ativa, modo_exibicao, ordem)
    VALUES (?, 1, 'Anéis O-ring e kits de vedação', 'aneis-o-ring-e-kits-de-vedacao', 1, 'grade', 0)`, [TENANT]);
  const catOring = Number(rc.insertId);
  criados.categorias.push(catOring);
  for (const [sku, cat] of Object.entries(CATEGORIA)) {
    const i = porSku.get(sku)!;
    guardar(i);
    const destino = cat === 'ORING' ? catOring : cat;
    await conn.query(`UPDATE comercial_produtos_dados SET categoria_id = ? WHERE id_item = ?`, [destino, i.id_item]);
    linhas.push(`  categoria: ${sku.padEnd(16)} ${String(i.categoria_id ?? '-').padStart(4)} → ${destino}  ${i.nome}`);
  }
  for (const i of sujos) {
    guardar(i);
    const limpo = String(i.nome_comercial).replace(/^\[NOVO\]\s*/i, '').replace(/&amp;/g, '&');
    await conn.query(`UPDATE comercial_produtos_dados SET nome_comercial = ? WHERE id_item = ?`, [limpo, i.id_item]);
    linhas.push(`  nome: ${i.nome_comercial} → ${limpo}`);
  }

  // 2. Marcas (maiúsculo; as que faltam são criadas)
  const marcasAntes = await q(conn, `SELECT id, nome FROM comercial_marcas WHERE tenant_id = ?`, [TENANT]);
  for (const m of MARCAS) {
    const ex = marcasAntes.find(x => String(x.nome).toUpperCase() === m);
    if (ex) await conn.query(`UPDATE comercial_marcas SET nome = ? WHERE id = ?`, [m, ex.id]);
    else { const [r] = await conn.query(`INSERT INTO comercial_marcas (tenant_id, nome, slug, status) VALUES (?, ?, ?, 'Ativo')`, [TENANT, m, m.toLowerCase()]); criados.marcas.push(Number(r.insertId)); }
  }
  // 3. Atributos
  const ids: Record<string, number> = {};
  for (const [k, a] of Object.entries(ATRIBUTOS)) {
    const [r] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo) VALUES (?, ?, ?, ?, 'grade', 0, 1, 1)`,
      [TENANT, a.nome, a.codigo, a.opcoes.length ? 'lista' : 'texto']);
    ids[k] = Number(r.insertId);
    criados.atributos.push(ids[k]);
    for (const [o, [valor, codigo]] of a.opcoes.entries()) {
      await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, ids[k], valor, codigo, o + 1]);
    }
  }
  // 4. Famílias e itens
  const original = { getConnection: pool.getConnection };
  (pool as any).getConnection = async () => Object.assign(Object.create(conn), { beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined });
  try {
    for (const f of FAMILIAS) {
      const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
          template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, ?, ?, 'ATIVO', 'PA', '-', ?, ?, 'UN', ?, '#1677ff', 0)`,
        [TENANT, f.cat, f.marca ? 'grade' : 'ficha', f.nome, f.sigla, f.sku, f.nomeT]);
      const idF = Number(r.insertId);
      criados.familias.push(idF);
      for (const [o, k] of f.attrs.entries()) {
        const ficha = k === 'pot';
        await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem,
            compoe_sku, gera_variacao, ativo) VALUES (?, 'familia', ?, ?, ?, 0, 1, 1, ?, ?, ?, 1)`, [TENANT, idF, ids[k], ficha ? 'ficha' : 'grade', o + 1, ficha ? 0 : 1, ficha ? 0 : 1]);
      }
      const lista = Object.entries(ITENS).filter(([, v]) => v[0] === f.chave).map(([sku, v]) => ({ i: porSku.get(sku)!, valores: v[1], marca: v[2] }));
      lista.forEach(l => guardar(l.i));
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE id_item IN (${lista.map(() => '?').join(',')})`, [idF, f.cat, ...lista.map(l => l.i.id_item)]);
      const corpo = lista.map(l => {
        const atributos: Record<string, string> = l.marca ? { [CHAVE_MARCA]: l.marca } : {};
        for (const [k, v] of Object.entries(l.valores)) {
          const op = ATRIBUTOS[k].opcoes.find(([, c]) => c === v);
          atributos[String(ids[k])] = op ? op[0] : v;
        }
        return { idItem: String(l.i.id_item), atributos };
      });
      let status = 200; let dados: any;
      const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
      await formalizarItensFamilia({ params: { idFamilia: String(idF) }, query: { tenant_id: TENANT }, headers: {}, body: { itens: corpo } } as any, res);
      if (status >= 400) throw new Error(`${f.nome}: ${dados?.error}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE familia_id = ?`, [idF]);
      linhas.push(`\n  ${f.nome} (${lista.length})`);
      for (const d of depois) {
        const l = lista.find(x => x.i.id_item === d.id_item)!;
        linhas.push(`    ${String(l.i.sku).padEnd(15)} → ${String(d.sku_customizado).padEnd(26)} ${d.nome_comercial}   (antes: ${l.i.nome})`);
      }
    }
  } finally {
    Object.assign(pool as any, original);
  }
  return { rel: linhas, backup: { criados, marcasAntes, itens: [...backupItens.values()] } };
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
      if (c.categorias.length) await conn.query(`DELETE FROM comercial_categorias WHERE id IN (${c.categorias.join(',')})`);
      await conn.commit();
      console.log('Revertido.');
    } else {
      const r = await migrar(conn);
      console.log(r.rel.join('\n'));
      if (modo === 'aplicar') {
        const destino = path.resolve(__dirname, '../../../backups', `faxina-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
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
