// Etapa 2 dos terminais prensáveis: série DIN (L/S) no métrico DKO, DKO do fornecedor (HPAS...) no padrão da casa,
// JIC/NPT que ficaram soltos e a unificação do DKO duplicado.
//
//   npx ts-node src/scripts/migracaoTerminais2.ts simular | aplicar | reverter <backup>
//
// SKU novo do métrico: 1{ângulo}FD{série}-{rosca}-{mangueira}-T{tubo} (ex.: 190FDL-14-04-T08) e 100MM{série}-...
// A série sai da tabela DIN (rosca × tubo). A unificação (estoque/fornecedor do duplicado) não é desfeita pelo reverter.
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';
import { unificarItens } from '../areas/catalogo/produtos/unificacao.controller';

const TENANT = 1;
const FAM_JIC_FEMEA = 300;
const FAM_DKO_FEMEA = 312;
const FAM_METRICO_MACHO = 313;
const CAT_NPT = 16;
const CAT_DKO = 17;

// DIN 2353 / ISO 8434: tubo → rosca por série
const SERIE: Record<string, 'L' | 'S'> = {
  '06-12': 'L', '08-14': 'L', '10-16': 'L', '12-18': 'L', '15-22': 'L', '18-26': 'L', '22-30': 'L', '28-36': 'L', '35-45': 'L', '42-52': 'L',
  '06-14': 'S', '08-16': 'S', '10-18': 'S', '12-20': 'S', '14-22': 'S', '16-24': 'S', '20-30': 'S', '25-36': 'S', '30-42': 'S', '38-52': 'S',
};
// Rosca métrica com o passo (até M26 é 1.5; de M30 em diante, 2.0)
const ROSCA_METRICA: Array<[string, string]> = [
  ['M12 X 1.5', '12'], ['M14 X 1.5', '14'], ['M16 X 1.5', '16'], ['M18 X 1.5', '18'], ['M20 X 1.5', '20'], ['M22 X 1.5', '22'],
  ['M24 X 1.5', '24'], ['M26 X 1.5', '26'], ['M30 X 2.0', '30'], ['M36 X 2.0', '36'], ['M42 X 2.0', '42'], ['M45 X 2.0', '45'], ['M52 X 2.0', '52'],
];
const TUBOS_NOVOS: Array<[string, string]> = [['14 MM', '14'], ['30 MM', '30'], ['35 MM', '35'], ['38 MM', '38'], ['42 MM', '42']];

const DKO_SKU = '1{Ângulo:cod}{SIGLA}{Série DIN:cod}-{Rosca métrica:cod}-{Mangueira:cod}-T{Tubo:cod}';
const DKO_NOME = '{FAMILIA} - {Ângulo} - {Rosca métrica} - {Série DIN} - TUBO {Tubo} - {Mangueira} - {Mangueira:cod}';
const MACHO_SKU = '100{SIGLA}{Série DIN:cod}-{Rosca métrica:cod}-{Mangueira:cod}-T{Tubo:cod}';
const MACHO_NOME = '{FAMILIA} - {Rosca métrica} - {Série DIN} - TUBO {Tubo} - {Mangueira} - {Mangueira:cod}';

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

const migrar = async (conn: Conn) => {
  const rel: string[] = [];
  const criados = { atributos: [] as number[], opcoes: [] as number[], vinculos: [] as number[], familias: [] as number[] };
  const attr = async (codigo: string) => {
    const r = await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1`, [TENANT, codigo]);
    if (!r.length) throw new Error(`Atributo ${codigo} não encontrado: a etapa 1 foi aplicada?`);
    return Number(r[0].id);
  };
  const idMang = await attr('terminal_mangueira');
  const idAng = await attr('terminal_angulo');
  const idTubo = await attr('terminal_tubo');
  const idRoscaMet = await attr('rosca_metrica');
  const idJic = await attr('rosca_jic');
  const idNpt = await attr('rosca_npt');
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = 'serie_din' AND ativo = 1`, [TENANT])).length) {
    throw new Error('O atributo Série DIN já existe: esta etapa já foi aplicada.');
  }

  // Backup do que muda fora dos itens
  const opcoesAntes = await q(conn, `SELECT id, atributo_id, valor, codigo, ordem FROM atributos_comercial_opcoes WHERE atributo_id IN (?, ?)`, [idRoscaMet, idTubo]);
  const familiasAntes = await q(conn, `SELECT id, template_sku, template_nome FROM comercial_familias WHERE id IN (?, ?)`, [FAM_DKO_FEMEA, FAM_METRICO_MACHO]);

  // 1. Rosca métrica com passo (renomear a opção mantém o id que os itens usam) e opções novas
  for (const [i, [valor, codigo]] of ROSCA_METRICA.entries()) {
    const ex = opcoesAntes.find(o => Number(o.atributo_id) === idRoscaMet && o.codigo === codigo);
    if (ex) await conn.query(`UPDATE atributos_comercial_opcoes SET valor = ?, ordem = ? WHERE id = ?`, [valor, i + 1, ex.id]);
    else {
      const [r] = await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, idRoscaMet, valor, codigo, i + 1]);
      criados.opcoes.push(Number(r.insertId));
    }
  }
  const ordemTubo = opcoesAntes.filter(o => Number(o.atributo_id) === idTubo).length;
  for (const [i, [valor, codigo]] of TUBOS_NOVOS.entries()) {
    const [r] = await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, idTubo, valor, codigo, ordemTubo + i + 1]);
    criados.opcoes.push(Number(r.insertId));
  }

  // 2. Série DIN (L/S) e vínculos
  const [ra] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo)
    VALUES (?, 'Série DIN', 'serie_din', 'lista', 'grade', 0, 1, 1)`, [TENANT]);
  const idSerie = Number(ra.insertId);
  criados.atributos.push(idSerie);
  for (const [i, [valor, codigo]] of [['SÉRIE L', 'L'], ['SÉRIE S', 'S']].entries()) {
    await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, idSerie, valor, codigo, i + 1]);
  }
  const vincular = async (idFamilia: number, idAtributo: number, ordem: number) => {
    const [r] = await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel,
        herdar, ordem, compoe_sku, gera_variacao, ativo) VALUES (?, 'familia', ?, ?, 'grade', 0, 1, 1, ?, 1, 1, 1)`, [TENANT, idFamilia, idAtributo, ordem]);
    criados.vinculos.push(Number(r.insertId));
  };
  await vincular(FAM_DKO_FEMEA, idAng, 1);
  await vincular(FAM_DKO_FEMEA, idSerie, 2);
  await vincular(FAM_METRICO_MACHO, idSerie, 1);
  await conn.query(`UPDATE comercial_familias SET template_sku = ?, template_nome = ? WHERE id = ?`, [DKO_SKU, DKO_NOME, FAM_DKO_FEMEA]);
  await conn.query(`UPDATE comercial_familias SET template_sku = ?, template_nome = ? WHERE id = ?`, [MACHO_SKU, MACHO_NOME, FAM_METRICO_MACHO]);

  // 3. Família nova: NPT fêmea fixa
  const [rf] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
      template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, 'ficha', 'TERMINAL PRENSÁVEL NPT FÊMEA FIXA', 'ATIVO', 'PA', '-', 'FN', ?, 'PC', ?, '#1677ff', 0)`,
    [TENANT, CAT_NPT, '100{SIGLA}-{Rosca NPT:cod}-{Mangueira:cod}', '{FAMILIA} - {Rosca NPT} - {Mangueira} - {Mangueira:cod}']);
  const famFN = Number(rf.insertId);
  criados.familias.push(famFN);

  // Opções por código (já com os textos novos)
  const opcoes = async (idA: number) => new Map((await q(conn, `SELECT valor, codigo FROM atributos_comercial_opcoes WHERE atributo_id = ? AND ativo = 1`, [idA]))
    .map(o => [String(o.codigo), String(o.valor)]));
  const op = { mang: await opcoes(idMang), ang: await opcoes(idAng), tubo: await opcoes(idTubo), met: await opcoes(idRoscaMet), jic: await opcoes(idJic), npt: await opcoes(idNpt), serie: await opcoes(idSerie) };
  const valor = (mapa: Map<string, string>, codigo: string, oQue: string) => {
    const v = mapa.get(codigo);
    if (!v) throw new Error(`${oQue} sem a opção ${codigo}`);
    return v;
  };
  const serieDe = (tubo: string, rosca: string, sku: string) => {
    const s = SERIE[`${tubo}-${rosca}`];
    if (!s) throw new Error(`${sku}: tubo ${tubo} com rosca M${rosca} não está na tabela DIN (L/S)`);
    return s;
  };

  const itens = await q(conn, `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
      cpd.familia_id, cpd.categoria_id, cpd.sku_customizado, cpd.nome_comercial, ic.status
    FROM itens_core ic JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
    WHERE ic.tenant_id = ? AND (cpd.familia_id IN (?, ?) OR cpd.categoria_id IN (14, 16, 17)) AND ic.status <> 'INATIVO'`, [TENANT, FAM_DKO_FEMEA, FAM_METRICO_MACHO]);
  const porSku = new Map(itens.map(i => [String(i.sku), i]));
  const backupItens = itens.map(i => ({ idItem: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id,
    sku_customizado: i.sku_customizado, nome_comercial: i.nome_comercial, status: i.status }));

  type Plano = { idItem: number; skuAntes: string; skuNovo: string; nomeAntes: string; atributos: Record<string, string> };
  const planos = new Map<number, Plano[]>();
  const planejar = (fam: number, p: Plano) => { if (!planos.has(fam)) planos.set(fam, []); planos.get(fam)!.push(p); };
  const fora: string[] = [];
  const mudar = new Set<number>();

  // DKO/métrico que já estavam nas famílias: ganham ângulo (reto) e série
  for (const i of itens.filter(x => [FAM_DKO_FEMEA, FAM_METRICO_MACHO].includes(Number(x.familia_id)))) {
    const m = String(i.sku).match(/^100(FD|MM)-(\d\d)-(\d\d)-T(\d\d)$/);
    if (!m) { fora.push(`${i.sku}: fora do padrão 100FD/100MM`); continue; }
    const [, tipo, rosca, mang, tubo] = m;
    const serie = serieDe(tubo, rosca, i.sku);
    const atributos: Record<string, string> = {
      [idRoscaMet]: valor(op.met, rosca, 'Rosca métrica'), [idMang]: valor(op.mang, mang, 'Mangueira'), [idTubo]: valor(op.tubo, tubo, 'Tubo'),
      [idSerie]: valor(op.serie, serie, 'Série'),
    };
    if (tipo === 'FD') atributos[idAng] = valor(op.ang, '00', 'Ângulo');
    planejar(Number(i.familia_id), { idItem: i.id_item, skuAntes: i.sku, skuNovo: `100${tipo}${serie}-${rosca}-${mang}-T${tubo}`, nomeAntes: i.nome, atributos });
  }

  // DKO do fornecedor: HPAS[90]{tubo}M{rosca}{mangueira}
  const unificar: Array<{ origem: any; destino: any }> = [];
  for (const i of itens.filter(x => /^HPAS/.test(String(x.sku)) && !x.familia_id)) {
    const m = String(i.sku).match(/^HPAS(90)?(\d\d)M(\d\d)(\d\d)$/);
    if (!m) { fora.push(`${i.sku}: SKU do fornecedor fora do padrão`); continue; }
    const [, noventa, tubo, rosca, mang] = m;
    const nome = String(i.nome).toUpperCase().replace(/\s/g, '');
    const confere = nome.includes(`TB.${tubo}`) && nome.includes(`(M${Number(rosca)}X`) && (noventa ? nome.includes('GIR.90') : !nome.includes('GIR.90'));
    if (!confere) { fora.push(`${i.sku}: nome não confere com o SKU (${i.nome})`); continue; }
    const serie = serieDe(tubo, rosca, i.sku);
    const ang = noventa ? '90' : '00';
    const skuNovo = `1${ang}FD${serie}-${rosca}-${mang}-T${tubo}`;
    // Mesmo produto já cadastrado no padrão da casa: une o do fornecedor nele
    const existente = itens.find(x => String(x.sku) === `1${ang}FD-${rosca}-${mang}-T${tubo}`);
    if (existente) { unificar.push({ origem: i, destino: existente }); continue; }
    planejar(FAM_DKO_FEMEA, { idItem: i.id_item, skuAntes: i.sku, skuNovo, nomeAntes: i.nome, atributos: {
      [idAng]: valor(op.ang, ang, 'Ângulo'), [idRoscaMet]: valor(op.met, rosca, 'Rosca métrica'), [idMang]: valor(op.mang, mang, 'Mangueira'),
      [idTubo]: valor(op.tubo, tubo, 'Tubo'), [idSerie]: valor(op.serie, serie, 'Série'),
    } });
    mudar.add(i.id_item);
  }

  // JIC fêmea 90° e NPT fêmea fixa que ficaram soltos (SKU já no padrão)
  for (const sku of ['190FJ-16-20', '190FJ-24-24']) {
    const i = porSku.get(sku);
    if (!i || i.familia_id) { fora.push(`${sku}: não encontrado solto`); continue; }
    const [, rosca, mang] = sku.match(/^190FJ-(\d\d)-(\d\d)$/)!;
    planejar(FAM_JIC_FEMEA, { idItem: i.id_item, skuAntes: sku, skuNovo: sku, nomeAntes: i.nome, atributos: {
      [idAng]: valor(op.ang, '90', 'Ângulo'), [idJic]: valor(op.jic, rosca, 'Rosca JIC'), [idMang]: valor(op.mang, mang, 'Mangueira') } });
    mudar.add(i.id_item);
  }
  const fn = porSku.get('100FN-02-04');
  if (fn && !fn.familia_id) {
    planejar(famFN, { idItem: fn.id_item, skuAntes: fn.sku, skuNovo: '100FN-02-04', nomeAntes: fn.nome, atributos: {
      [idNpt]: valor(op.npt, '02', 'Rosca NPT'), [idMang]: valor(op.mang, '04', 'Mangueira') } });
    mudar.add(fn.id_item);
  } else fora.push('100FN-02-04: não encontrado solto');

  // 4. Grava: unificação, entrada nas famílias e formalização (o servidor monta nome e SKU)
  const restaurar = prenderPool(conn);
  const exemplos: string[] = [];
  try {
    for (const u of unificar) {
      const r = await chamar(unificarItens, {}, { idOrigem: u.origem.id_item, idDestino: u.destino.id_item, fator: 1,
        motivo: `Mesmo terminal DKO (${u.origem.sku} = ${u.destino.sku}): cadastro do fornecedor unido ao da casa` });
      if (r.status >= 400) throw new Error(`Unificação ${u.origem.sku} → ${u.destino.sku}: ${r.dados?.error || r.status}`);
      exemplos.push(`  UNIDO: ${u.origem.sku} (${u.origem.nome}) → ${u.destino.sku}`);
    }
    for (const [fam, lista] of planos) {
      const cat = fam === famFN ? CAT_NPT : fam === FAM_JIC_FEMEA ? 14 : CAT_DKO;
      const novos = lista.filter(p => mudar.has(p.idItem)).map(p => p.idItem);
      if (novos.length) {
        await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE tenant_id = ? AND id_item IN (${novos.map(() => '?').join(',')})`,
          [fam, cat, TENANT, ...novos]);
      }
      const r = await chamar(formalizarItensFamilia, { idFamilia: String(fam) }, { itens: lista.map(p => ({ idItem: String(p.idItem), atributos: p.atributos })) });
      if (r.status >= 400) throw new Error(`Formalização da família ${fam}: ${r.dados?.error || r.status}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item IN (${lista.map(() => '?').join(',')})`,
        lista.map(p => p.idItem));
      for (const p of lista) {
        const d = depois.find(x => Number(x.id_item) === Number(p.idItem));
        if (!d || d.sku_customizado !== p.skuNovo) throw new Error(`SKU inesperado: ${p.skuAntes} → ${d?.sku_customizado} (esperado ${p.skuNovo}). Nada foi gravado.`);
        exemplos.push(`  ${p.skuAntes.padEnd(16)} → ${String(d.sku_customizado).padEnd(18)} ${d.nome_comercial}`);
      }
    }
  } finally {
    restaurar();
  }

  const total = [...planos.values()].reduce((s, l) => s + l.length, 0);
  rel.push(`Série DIN criada (L/S); Rosca métrica com passo (${ROSCA_METRICA.length} opções); Tubo +${TUBOS_NOVOS.length} medidas`);
  rel.push(`Família nova: TERMINAL PRENSÁVEL NPT FÊMEA FIXA · DKO fêmea ganhou Ângulo e Série; métrico macho ganhou Série`);
  rel.push(`Itens gravados: ${total} · unificados: ${unificar.length}`);
  rel.push(`\nAntes → depois:\n${exemplos.join('\n')}`);
  if (fora.length) rel.push(`\nFicaram de fora (${fora.length}):\n${fora.map(x => `  ${x}`).join('\n')}`);
  return { rel, backup: { criados, backupItens, opcoesAntes, familiasAntes, idSerie } };
};

const reverter = async (conn: Conn, arquivo: string) => {
  const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id = ?`, [b.idSerie]);
  for (const i of b.backupItens) {
    await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ? WHERE tenant_id = ? AND id_item = ?`,
      [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, TENANT, i.idItem]);
  }
  for (const f of b.familiasAntes) await conn.query(`UPDATE comercial_familias SET template_sku = ?, template_nome = ? WHERE id = ?`, [f.template_sku, f.template_nome, f.id]);
  for (const o of b.opcoesAntes) await conn.query(`UPDATE atributos_comercial_opcoes SET valor = ?, ordem = ? WHERE id = ?`, [o.valor, o.ordem, o.id]);
  const c = b.criados;
  if (c.vinculos.length) await conn.query(`DELETE FROM atributos_core_entidades WHERE id IN (${c.vinculos.join(',')})`);
  if (c.opcoes.length) {
    await conn.query(`DELETE FROM atributos_comercial_valores WHERE opcao_id IN (${c.opcoes.join(',')})`);
    await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE id IN (${c.opcoes.join(',')})`);
  }
  if (c.familias.length) await conn.query(`DELETE FROM comercial_familias WHERE id IN (${c.familias.join(',')})`);
  await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE atributo_id = ?`, [b.idSerie]);
  await conn.query(`DELETE FROM atributos_comercial WHERE id = ?`, [b.idSerie]);
  return `Revertido: ${b.backupItens.length} itens voltaram ao backup. A unificação do DKO duplicado continua (desfaça pela tela de unificação, se precisar).`;
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
        const destino = path.join(pasta, `terminais-etapa2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
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
