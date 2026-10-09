// Migração dos terminais prensáveis para famílias por padrão + tipo, com rosca, mangueira e ângulo como grade.
//
//   npx ts-node src/scripts/migracaoTerminais.ts simular           → faz tudo numa transação, confere e desfaz
//   npx ts-node src/scripts/migracaoTerminais.ts aplicar           → grava (antes salva o backup em ../backups)
//   npx ts-node src/scripts/migracaoTerminais.ts reverter <backup> → volta ao estado do backup
//
// Segurança: o item só entra na família se o SKU montado pelos atributos for IGUAL ao SKU de hoje. O nome muda
// (passa a ser montado pelo modelo da família); o SKU raiz (itens_core.sku) não muda.
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';
import { avaliarSaudeFamilia } from '../areas/catalogo/familias/saudeFamilia';
import { carregarAtributosDaCategoria } from '../areas/catalogo/categorias/herancaCategorias';

const TENANT = 1;
const FAMILIAS_ANTIGAS = [153, 154, 156, 157];

// ---------------------------------------------------------------- listas (texto = código da bitola)
type Lista = { nome: string; codigo: string; opcoes: Array<[string, string]>; confere?: (valor: string) => string | null };
const LISTAS: Record<string, Lista> = {
  mang: { nome: 'Mangueira', codigo: 'terminal_mangueira', opcoes: [
    ['3/16"', '03'], ['1/4"', '04'], ['5/16"', '05'], ['3/8"', '06'], ['1/2"', '08'], ['5/8"', '10'], ['3/4"', '12'],
    ['1"', '16'], ['1.1/4"', '20'], ['1.1/2"', '24'], ['2"', '32']] },
  ang: { nome: 'Ângulo', codigo: 'terminal_angulo', opcoes: [['RETO', '00'], ['45°', '45'], ['90°', '90']], confere: () => null },
  jic: { nome: 'Rosca JIC', codigo: 'rosca_jic', opcoes: [
    ['7/16"-20', '04'], ['1/2"-20', '05'], ['9/16"-18', '06'], ['3/4"-16', '08'], ['7/8"-14', '10'], ['1.1/16"-12', '12'],
    ['1.3/16"-12', '14'], ['1.5/16"-12', '16'], ['1.5/8"-12', '20'], ['1.7/8"-12', '24'], ['2.1/2"-12', '32']] },
  orfs: { nome: 'Rosca ORFS', codigo: 'rosca_orfs', opcoes: [
    ['9/16"-18', '04'], ['11/16"-16', '06'], ['13/16"-16', '08'], ['1"-14', '10'], ['1.3/16"-12', '12'], ['1.7/16"-12', '16'],
    ['1.11/16"-12', '20'], ['2"-12', '24']] },
  bsp: { nome: 'Rosca BSP', codigo: 'rosca_bsp', opcoes: [
    ['1/8"-28', '02'], ['1/4"-19', '04'], ['3/8"-19', '06'], ['1/2"-14', '08'], ['5/8"-14', '10'], ['3/4"-14', '12'],
    ['1"-11', '16'], ['1.1/4"-11', '20'], ['1.1/2"-11', '24'], ['2"-11', '32']] },
  npt: { nome: 'Rosca NPT', codigo: 'rosca_npt', opcoes: [
    ['1/8"-27', '02'], ['1/4"-18', '04'], ['3/8"-18', '06'], ['1/2"-14', '08'], ['3/4"-14', '12'], ['1"-11.5', '16'], ['1.1/4"-11.5', '20']] },
  flange: { nome: 'Flange SAE 3000', codigo: 'flange_sae_3000', opcoes: [
    ['30.2 MM (1/2")', '08'], ['38.1 MM (3/4")', '12'], ['44.4 MM (1")', '16'], ['50.8 MM (1.1/4")', '20'], ['60.3 MM (1.1/2")', '24'],
    ['71.4 MM (2")', '32']], confere: v => v.split(' ')[0] },
  jis: { nome: 'Rosca métrica JIS', codigo: 'rosca_metrica_jis', opcoes: [
    ['M14 X 1.5', '14'], ['M16 X 1.5', '16'], ['M18 X 1.5', '18'], ['M20 X 1.5', '20'], ['M22 X 1.5', '22'], ['M24 X 1.5', '24'],
    ['M30 X 1.5', '30'], ['M33 X 1.5', '33'], ['M36 X 1.5', '36']] },
  met: { nome: 'Rosca métrica', codigo: 'rosca_metrica', opcoes: [
    ['M12', '12'], ['M14', '14'], ['M16', '16'], ['M18', '18'], ['M20', '20'], ['M22', '22'], ['M24', '24'], ['M26', '26'],
    ['M30', '30'], ['M36', '36']] },
  tubo: { nome: 'Tubo', codigo: 'terminal_tubo', opcoes: [
    ['6 MM', '06'], ['8 MM', '08'], ['10 MM', '10'], ['12 MM', '12'], ['15 MM', '15'], ['16 MM', '16'], ['18 MM', '18'],
    ['20 MM', '20'], ['22 MM', '22'], ['25 MM', '25'], ['28 MM', '28']], confere: () => null },
  unf: { nome: 'Rosca UNF 45°', codigo: 'rosca_unf_45', opcoes: [
    ['7/16"-20', '04'], ['1/2"-20', '05'], ['5/8"-18', '06'], ['3/4"-16', '08'], ['7/8"-14', '10']], confere: v => v.split('"')[0] },
};

// Onde cada lista fica vinculada (herda para as subcategorias e famílias abaixo)
const VINCULOS_CATEGORIA: Array<[number, string]> = [
  [10, 'mang'], [14, 'jic'], [18, 'orfs'], [20, 'bsp'], [16, 'npt'], [19, 'flange'], [15, 'jis'], [17, 'met'], [17, 'tubo'],
];

// ---------------------------------------------------------------- famílias
type Familia = {
  nome: string; categoria: number; sigla: string; sku: RegExp; rosca?: string; angulo?: boolean; tubo?: boolean;
  templateSku: string; templateNome: string; listasProprias?: string[]; copiarDe?: number;
};
const comAngulo = (rosca: string) => `{FAMILIA} - {Ângulo} - {${rosca}} - {Mangueira} - {Mangueira:cod}`;
const semAngulo = (rosca: string) => `{FAMILIA} - {${rosca}} - {Mangueira} - {Mangueira:cod}`;
const FAMILIAS: Familia[] = [
  { nome: 'TERMINAL PRENSÁVEL JIC 37° FÊMEA GIRATÓRIA', categoria: 14, sigla: 'FJ', rosca: 'jic', angulo: true,
    sku: /^1(?<ang>00|45|90)FJ-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca JIC:cod}-{Mangueira:cod}', templateNome: comAngulo('Rosca JIC') },
  { nome: 'TERMINAL PRENSÁVEL JIC 37° MACHO', categoria: 14, sigla: 'MJ', rosca: 'jic', copiarDe: 153,
    sku: /^100MJ-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca JIC:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca JIC') },
  { nome: 'TERMINAL PRENSÁVEL ORFS FÊMEA GIRATÓRIA', categoria: 18, sigla: 'FO', rosca: 'orfs', angulo: true,
    sku: /^1(?<ang>00|45|90)FO-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca ORFS:cod}-{Mangueira:cod}', templateNome: comAngulo('Rosca ORFS') },
  { nome: 'TERMINAL PRENSÁVEL ORFS MACHO FIXO', categoria: 18, sigla: 'MO', rosca: 'orfs',
    sku: /^100MO-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca ORFS:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca ORFS') },
  { nome: 'TERMINAL PRENSÁVEL BSP 60° FÊMEA GIRATÓRIA', categoria: 20, sigla: 'FB', rosca: 'bsp', angulo: true,
    sku: /^1(?<ang>00|45|90)FB-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca BSP:cod}-{Mangueira:cod}', templateNome: comAngulo('Rosca BSP') },
  { nome: 'TERMINAL PRENSÁVEL BSP 60° FÊMEA GIRATÓRIA COMPACTA 90°', categoria: 20, sigla: 'FBC', rosca: 'bsp',
    sku: /^190FBC-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '190{SIGLA}-{Rosca BSP:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca BSP') },
  { nome: 'TERMINAL PRENSÁVEL BSP 60° MACHO FIXO', categoria: 20, sigla: 'MB', rosca: 'bsp',
    sku: /^100MB-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca BSP:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca BSP') },
  { nome: 'TERMINAL PRENSÁVEL BSP JIC FÊMEA GIRATÓRIA', categoria: 20, sigla: 'FBJ', rosca: 'bsp', angulo: true,
    sku: /^1(?<ang>00|45|90)FBJ-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca BSP:cod}-{Mangueira:cod}', templateNome: comAngulo('Rosca BSP') },
  { nome: 'TERMINAL PRENSÁVEL NPT MACHO FIXO', categoria: 16, sigla: 'MN', rosca: 'npt',
    sku: /^100MN-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca NPT:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca NPT') },
  { nome: 'TERMINAL PRENSÁVEL NPT MACHO GIRATÓRIO', categoria: 16, sigla: 'MG', rosca: 'npt',
    sku: /^100MG-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca NPT:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca NPT') },
  { nome: 'TERMINAL PRENSÁVEL FLANGE SAE 3000 PSI', categoria: 19, sigla: 'F3', rosca: 'flange', angulo: true,
    sku: /^1(?<ang>00|45|90)F3-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '1{Ângulo:cod}{SIGLA}-{Flange SAE 3000:cod}-{Mangueira:cod}', templateNome: comAngulo('Flange SAE 3000') },
  { nome: 'TERMINAL PRENSÁVEL KOMATSU (JIS) FÊMEA GIRATÓRIA', categoria: 15, sigla: 'FK', rosca: 'jis',
    sku: /^100FK-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca métrica JIS:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca métrica JIS') },
  { nome: 'TERMINAL PRENSÁVEL MÉTRICO DKO FÊMEA GIRATÓRIA', categoria: 17, sigla: 'FD', rosca: 'met', tubo: true,
    sku: /^100FD-(?<rosca>\d\d)-(?<mang>\d\d)-T(?<tubo>\d\d)$/, templateSku: '100{SIGLA}-{Rosca métrica:cod}-{Mangueira:cod}-T{Tubo:cod}',
    templateNome: '{FAMILIA} - {Rosca métrica} - {Mangueira} - {Mangueira:cod} - TUBO {Tubo}' },
  { nome: 'TERMINAL PRENSÁVEL MÉTRICO MACHO FIXO', categoria: 17, sigla: 'MM', rosca: 'met', tubo: true,
    sku: /^100MM-(?<rosca>\d\d)-(?<mang>\d\d)-T(?<tubo>\d\d)$/, templateSku: '100{SIGLA}-{Rosca métrica:cod}-{Mangueira:cod}-T{Tubo:cod}',
    templateNome: '{FAMILIA} - {Rosca métrica} - {Mangueira} - {Mangueira:cod} - TUBO {Tubo}' },
  { nome: 'TERMINAL PRENSÁVEL MÉTRICO PONTA LISA', categoria: 17, sigla: 'PL', tubo: true,
    sku: /^100PL-(?<tubo>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Tubo:cod}-{Mangueira:cod}',
    templateNome: '{FAMILIA} - TUBO {Tubo} - {Mangueira} - {Mangueira:cod}' },
  { nome: 'TERMINAL PRENSÁVEL UNF 45° FÊMEA GIRATÓRIA', categoria: 14, sigla: 'FS', rosca: 'unf', angulo: true, listasProprias: ['unf'],
    sku: /^1(?<ang>00|45|90)FS-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '1{Ângulo:cod}{SIGLA}-{Rosca UNF 45°:cod}-{Mangueira:cod}', templateNome: comAngulo('Rosca UNF 45°') },
  { nome: 'TERMINAL PRENSÁVEL UNF 45° MACHO', categoria: 14, sigla: 'MS', rosca: 'unf', listasProprias: ['unf'],
    sku: /^100MS-(?<rosca>\d\d)-(?<mang>\d\d)$/, templateSku: '100{SIGLA}-{Rosca UNF 45°:cod}-{Mangueira:cod}', templateNome: semAngulo('Rosca UNF 45°') },
  { nome: 'TERMINAL PRENSÁVEL EMENDA DUPLA', categoria: 10, sigla: 'EM',
    sku: /^100EM-(?<mang>\d\d)-(?<mang2>\d\d)$/, templateSku: '100{SIGLA}-{Mangueira:cod}-{Mangueira:cod}', templateNome: '{FAMILIA} - {Mangueira} - {Mangueira:cod}' },
];

// ---------------------------------------------------------------- utilidades
const norm = (t: unknown) => String(t ?? '').toLowerCase().replace(/["\s]/g, '');
type Conn = any;

const q = async (conn: Conn, sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];

/** Faz o pool inteiro usar esta conexão (os controllers abrem a deles) e ignora commit/rollback/release deles. */
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

// ---------------------------------------------------------------- migração
const migrar = async (conn: Conn) => {
  const relatorio: string[] = [];
  const criados = { atributos: [] as number[], familias: [] as number[], vinculos: [] as number[] };

  // Nada com o mesmo nome pode existir (o script não mexe em atributo antigo)
  const nomes = Object.values(LISTAS).map(l => l.nome);
  const ja = await q(conn, `SELECT nome FROM atributos_comercial WHERE tenant_id = ? AND ativo = 1 AND nome IN (${nomes.map(() => '?').join(',')})`, [TENANT, ...nomes]);
  if (ja.length) throw new Error(`Já existem atributos com estes nomes: ${ja.map(a => a.nome).join(', ')}.`);
  const famJa = await q(conn, `SELECT nome FROM comercial_familias WHERE tenant_id = ? AND nome IN (${FAMILIAS.map(() => '?').join(',')})`, [TENANT, ...FAMILIAS.map(f => f.nome)]);
  if (famJa.length) throw new Error(`Já existem famílias com estes nomes: ${famJa.map(f => f.nome).join(', ')}.`);

  // 1. Atributos de lista com as opções (texto = código)
  const idLista: Record<string, number> = {};
  const opcaoPorCodigo: Record<string, Map<string, string>> = {};
  for (const [chave, l] of Object.entries(LISTAS)) {
    const [r] = await conn.query(
      `INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo)
       VALUES (?, ?, ?, 'lista', 'grade', 0, 1, 1)`, [TENANT, l.nome, l.codigo]);
    idLista[chave] = Number(r.insertId);
    criados.atributos.push(idLista[chave]);
    opcaoPorCodigo[chave] = new Map(l.opcoes.map(([valor, codigo]) => [codigo, valor]));
    let ordem = 1;
    for (const [valor, codigo] of l.opcoes) {
      await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
        [TENANT, idLista[chave], valor, codigo, ordem++]);
    }
  }

  const vincular = async (tipo: 'categoria' | 'familia', idEntidade: number, chave: string, ordem: number) => {
    const [r] = await conn.query(
      `INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel,
         herdar, ordem, compoe_sku, gera_variacao, ativo)
       VALUES (?, ?, ?, ?, 'grade', 0, 1, 1, ?, 1, 1, 1)`, [TENANT, tipo, idEntidade, idLista[chave], ordem]);
    criados.vinculos.push(Number(r.insertId));
  };

  // 2. Listas nas categorias (sem obrigatório: item fora de família não fica "não publicável")
  let ordem = 1;
  for (const [cat, chave] of VINCULOS_CATEGORIA) await vincular('categoria', cat, chave, ordem++);

  // 3. Famílias
  const [colNome] = await conn.query(`SHOW COLUMNS FROM comercial_produtos_dados LIKE 'nome_comercial'`);
  const limiteNome = Number(String((colNome as any[])[0]?.Type || '').match(/\d+/)?.[0] || 255);
  const idFamilia = new Map<Familia, number>();
  for (const f of FAMILIAS) {
    const base = f.copiarDe ? (await q(conn, `SELECT margem_minima, margem_maxima, markup_padrao, estoque_minimo, lote_minimo, prioridade_exposicao
      FROM comercial_familias WHERE id = ?`, [f.copiarDe]))[0] || {} : {};
    const [r] = await conn.query(
      `INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
         template_sku, unidade_base, template_nome, cor, ordem, margem_minima, margem_maxima, markup_padrao, estoque_minimo, lote_minimo, prioridade_exposicao)
       VALUES (?, ?, 1, 'ficha', ?, 'ATIVO', 'PA', '-', ?, ?, 'PC', ?, '#1677ff', 0, ?, ?, ?, ?, ?, ?)`,
      [TENANT, f.categoria, f.nome, f.sigla, f.templateSku, f.templateNome,
        base.margem_minima ?? null, base.margem_maxima ?? null, base.markup_padrao ?? null, base.estoque_minimo ?? null, base.lote_minimo ?? null, base.prioridade_exposicao ?? null]);
    const id = Number(r.insertId);
    idFamilia.set(f, id);
    criados.familias.push(id);
    let o = 1;
    if (f.angulo) await vincular('familia', id, 'ang', o++);
    for (const l of f.listasProprias || []) await vincular('familia', id, l, o++);
  }

  // Saúde de cada família com os atributos efetivos (herdados + próprios)
  for (const f of FAMILIAS) {
    const id = idFamilia.get(f)!;
    const herdados = await carregarAtributosDaCategoria(conn, TENANT, f.categoria);
    const proprios = await q(conn, `SELECT a.id, a.nome, a.codigo, e.escopo_comercial AS classificacao, e.obrigatorio, e.valor_padrao_grupo AS valorPadraoGrupo
      FROM atributos_core_entidades e JOIN atributos_comercial a ON a.id = e.atributo_id WHERE e.tipo_entidade = 'familia' AND e.id_entidade = ? AND e.ativo = 1`, [id]);
    const saude = avaliarSaudeFamilia(
      { status: 'ATIVO', templateSku: f.templateSku, templateNomeComercial: f.templateNome, siglaSku: f.sigla, comportamentoMarca: 'ficha' },
      [...herdados, ...proprios].map((a: any) => ({ ...a, id: String(a.id), obrigatorio: Boolean(Number(a.obrigatorio)) })),
    );
    if (!saude.saudavel) throw new Error(`Família "${f.nome}" não fica saudável: ${saude.bloqueios.map(b => b.mensagem).join(' ')}`);
  }

  // 4. Itens: valores tirados do SKU de hoje, conferidos com o nome
  const itens = await q(conn, `SELECT ic.id_item, ic.nome_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku,
      COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome, cpd.familia_id, cpd.categoria_id
    FROM itens_core ic JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
    WHERE ic.tenant_id = ? AND ic.nome_item LIKE 'TERMINAIS PRENSAVEIS%'`, [TENANT]);
  const backupItens: any[] = [];
  const porFamilia = new Map<Familia, Array<{ idItem: number; sku: string; nomeAntes: string; atributos: Record<string, string> }>>();
  const fora: string[] = [];
  for (const it of itens) {
    const f = FAMILIAS.find(x => x.sku.test(it.sku));
    if (!f) { fora.push(`${it.sku} · ${it.nome}`); continue; }
    const g = it.sku.match(f.sku)!.groups!;
    const atributos: Record<string, string> = {};
    const problemas: string[] = [];
    const cauda = norm(String(it.nome).split(' - ').slice(3).join(' - '));
    const pegar = (chave: string, codigo: string, conferir = true) => {
      const valor = opcaoPorCodigo[chave].get(codigo);
      if (!valor) { problemas.push(`${LISTAS[chave].nome} sem a bitola ${codigo}`); return; }
      const alvo = LISTAS[chave].confere ? LISTAS[chave].confere!(valor) : valor;
      if (conferir && alvo && !cauda.includes(norm(alvo))) problemas.push(`${LISTAS[chave].nome} ${valor} não aparece no nome`);
      atributos[String(idLista[chave])] = valor;
    };
    if (g.ang) pegar('ang', g.ang);
    if (g.rosca && f.rosca) pegar(f.rosca, g.rosca);
    if (g.tubo) pegar('tubo', g.tubo);
    pegar('mang', g.mang);
    if (g.mang2 && g.mang2 !== g.mang) problemas.push('emenda com bitolas diferentes');
    if (problemas.length) { fora.push(`${it.sku} · ${problemas.join('; ')}`); continue; }
    const atual = (await q(conn, `SELECT sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item = ? AND tenant_id = ?`, [it.id_item, TENANT]))[0];
    backupItens.push({ idItem: it.id_item, familia_id: it.familia_id, categoria_id: it.categoria_id,
      sku_customizado: atual?.sku_customizado ?? null, nome_comercial: atual?.nome_comercial ?? null });
    if (!porFamilia.has(f)) porFamilia.set(f, []);
    porFamilia.get(f)!.push({ idItem: it.id_item, sku: it.sku, nomeAntes: it.nome, atributos });
  }

  // 5. Entra na família, grava pela formalização (o servidor monta nome e SKU) e confere o SKU
  const restaurar = prenderPool(conn);
  const exemplos: string[] = [];
  try {
    for (const [f, lista] of porFamilia) {
      const id = idFamilia.get(f)!;
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE tenant_id = ? AND id_item IN (${lista.map(() => '?').join(',')})`,
        [id, f.categoria, TENANT, ...lista.map(i => i.idItem)]);
      const r = await chamar(formalizarItensFamilia, { idFamilia: String(id) }, { itens: lista.map(i => ({ idItem: String(i.idItem), atributos: i.atributos })) });
      if (r.status >= 400) throw new Error(`Formalização da família "${f.nome}": ${r.dados?.error || r.status}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE tenant_id = ? AND id_item IN (${lista.map(() => '?').join(',')})`,
        [TENANT, ...lista.map(i => i.idItem)]);
      for (const i of lista) {
        const d = depois.find(x => Number(x.id_item) === Number(i.idItem));
        if (!d || d.sku_customizado !== i.sku) throw new Error(`SKU mudaria: ${i.sku} → ${d?.sku_customizado} (família "${f.nome}"). Nada foi gravado.`);
        if (String(d.nome_comercial).length > limiteNome) throw new Error(`Nome maior que a coluna (${limiteNome}): ${d.nome_comercial}`);
      }
      const ex = depois[0];
      exemplos.push(`  ${f.nome} (${lista.length})\n    ${ex.sku_customizado}: ${lista.find(i => Number(i.idItem) === Number(ex.id_item))?.nomeAntes}\n    →  ${ex.nome_comercial}`);
    }
  } finally {
    restaurar();
  }

  // 6. Famílias antigas sem itens ficam inativas (o backup guarda o status)
  const antigas = await q(conn, `SELECT f.id, f.status, (SELECT COUNT(*) FROM comercial_produtos_dados p WHERE p.familia_id = f.id) AS itens
    FROM comercial_familias f WHERE f.id IN (${FAMILIAS_ANTIGAS.join(',')})`);
  for (const a of antigas) if (Number(a.itens) === 0) await conn.query(`UPDATE comercial_familias SET status = 'INATIVO' WHERE id = ?`, [a.id]);

  const total = [...porFamilia.values()].reduce((s, l) => s + l.length, 0);
  relatorio.push(`Atributos criados: ${Object.values(LISTAS).map(l => `${l.nome} (${l.opcoes.length})`).join(', ')}`);
  relatorio.push(`Vínculos nas categorias: ${VINCULOS_CATEGORIA.map(([c, k]) => `${LISTAS[k].nome} → cat ${c}`).join(', ')}`);
  relatorio.push(`Famílias criadas: ${FAMILIAS.length} · itens migrados: ${total} (SKU igual ao de hoje em todos)`);
  relatorio.push(`Famílias antigas inativadas: ${antigas.filter(a => Number(a.itens) === 0).map(a => a.id).join(', ') || 'nenhuma'}`);
  relatorio.push(`\nExemplo por família (antes → depois):\n${exemplos.join('\n')}`);
  relatorio.push(`\nFicaram de fora (${fora.length}):\n${fora.map(x => `  ${x}`).join('\n')}`);
  return { relatorio, criados, backupItens, antigas };
};

// ---------------------------------------------------------------- reverter
const reverter = async (conn: Conn, arquivo: string) => {
  const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const ids = b.backupItens.map((i: any) => i.idItem);
  const attrs: number[] = b.criados.atributos;
  if (ids.length && attrs.length) {
    await conn.query(`DELETE FROM atributos_comercial_valores WHERE tenant_id = ? AND tipo_entidade = 'produto' AND atributo_id IN (${attrs.join(',')})`, [TENANT]);
  }
  for (const i of b.backupItens) {
    await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ? WHERE tenant_id = ? AND id_item = ?`,
      [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, TENANT, i.idItem]);
  }
  for (const a of b.antigas) await conn.query(`UPDATE comercial_familias SET status = ? WHERE id = ?`, [a.status, a.id]);
  if (b.criados.vinculos.length) await conn.query(`DELETE FROM atributos_core_entidades WHERE id IN (${b.criados.vinculos.join(',')})`);
  const restam = await q(conn, `SELECT COUNT(*) n FROM comercial_produtos_dados WHERE familia_id IN (${b.criados.familias.join(',')})`);
  if (Number(restam[0].n) > 0) throw new Error(`Há ${restam[0].n} item(ns) novos nas famílias criadas: tire-os antes de reverter.`);
  await conn.query(`DELETE FROM comercial_familias WHERE id IN (${b.criados.familias.join(',')})`);
  await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE atributo_id IN (${attrs.join(',')})`);
  await conn.query(`DELETE FROM atributos_comercial WHERE id IN (${attrs.join(',')})`);
  return `Revertido: ${b.backupItens.length} itens voltaram ao estado do backup; ${b.criados.familias.length} famílias e ${attrs.length} atributos removidos.`;
};

// ---------------------------------------------------------------- entrada
(async () => {
  const [modo, arquivo] = process.argv.slice(2);
  if (!['simular', 'aplicar', 'reverter'].includes(modo)) {
    console.log('Uso: simular | aplicar | reverter <arquivo-de-backup>');
    process.exit(1);
  }
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (modo === 'reverter') {
      console.log(await reverter(conn, arquivo));
      await conn.commit();
    } else {
      const r = await migrar(conn);
      console.log(r.relatorio.join('\n'));
      if (modo === 'aplicar') {
        const pasta = path.resolve(__dirname, '../../../backups');
        fs.mkdirSync(pasta, { recursive: true });
        const destino = path.join(pasta, `terminais-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(destino, JSON.stringify({ criados: r.criados, backupItens: r.backupItens, antigas: r.antigas }, null, 1));
        await conn.commit();
        console.log(`\nGRAVADO. Backup para reverter: ${destino}`);
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
