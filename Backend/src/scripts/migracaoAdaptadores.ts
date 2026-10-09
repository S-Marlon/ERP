// Adaptadores hidráulicos em famílias por forma × combinação de roscas, com o código da casa:
//   2[forma][tipo][rosca A][rosca B]-[bitola A]-[bitola B]   (ex.: 220NJ-04-06 = cotovelo 90° macho NPT 1/4" × macho JIC 9/16")
//   J = JIC · N = NPT · B = BSP · O = ORFS · R = O-ring Boss (ORB) · M = métrico
// Inclui famílias vazias para combinações que a loja ainda vai comprar. ORB passa de O para R (200OJ → 200RJ);
// SKUs de fornecedor (HAM...) entram no padrão e duplicados são unidos.
//
//   npx ts-node src/scripts/migracaoAdaptadores.ts simular | aplicar | reverter <backup>
// O reverter não desfaz as unificações (desfaça pela tela de unificação, se precisar).
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';
import { unificarItens } from '../areas/catalogo/produtos/unificacao.controller';

const TENANT = 1;
const FAM_TERMINAL_NPT_MACHO = 308;

// ---------------------------------------------------------------- listas
// chave → atributo (existente pelo código, ou novo copiando as opções de outra lista)
type Lista = { nome: string; codigo: string; existe?: boolean; copiaDe?: string };
const LISTAS: Record<string, Lista> = {
  jic: { nome: 'Rosca JIC', codigo: 'rosca_jic', existe: true },
  npt: { nome: 'Rosca NPT', codigo: 'rosca_npt', existe: true },
  bsp: { nome: 'Rosca BSP', codigo: 'rosca_bsp', existe: true },
  orfs: { nome: 'Rosca ORFS', codigo: 'rosca_orfs', existe: true },
  met: { nome: 'Rosca métrica', codigo: 'rosca_metrica', existe: true },
  orb: { nome: 'Rosca ORB', codigo: 'rosca_orb', copiaDe: 'jic' },
  jic2: { nome: 'Rosca JIC 2', codigo: 'rosca_jic_2', copiaDe: 'jic' },
  npt2: { nome: 'Rosca NPT 2', codigo: 'rosca_npt_2', copiaDe: 'npt' },
  bsp2: { nome: 'Rosca BSP 2', codigo: 'rosca_bsp_2', copiaDe: 'bsp' },
  orfs2: { nome: 'Rosca ORFS 2', codigo: 'rosca_orfs_2', copiaDe: 'orfs' },
  orb2: { nome: 'Rosca ORB 2', codigo: 'rosca_orb_2', copiaDe: 'jic' },
  met2: { nome: 'Rosca métrica 2', codigo: 'rosca_metrica_2', copiaDe: 'met' },
};
const NPT_NOVAS: Array<[string, string]> = [['1.1/2"-11.5', '24'], ['2"-11.5', '32']];

// ---------------------------------------------------------------- famílias: [sigla, nome, categoria, lados]
// lados: listas na ordem do SKU; a mesma chave duas vezes = mesmo valor nos dois lados (ex.: tee 231N-04-04)
type Fam = [string, string, number, string[]];
const FAMILIAS: Fam[] = [
  // JIC
  ['210J', 'NIPLE DUPLO JIC', 30, ['jic', 'jic2']],
  ['201J', 'ADAPTADOR RETO MACHO JIC X FÊMEA JIC GIRATÓRIA', 30, ['jic', 'jic2']],
  ['210UCA', 'UNIÃO COMPRIDA JIC', 30, ['jic']],
  ['220J', 'COTOVELO 90° MACHO JIC X MACHO JIC', 40, ['jic', 'jic2']],
  ['221J', 'COTOVELO 90° MACHO JIC X FÊMEA JIC GIRATÓRIA', 40, ['jic', 'jic2']],
  ['220UCA', 'COTOVELO 90° LONGO JIC', 40, ['jic', 'jic2']],
  ['246J', 'COTOVELO 45° MACHO JIC X FÊMEA JIC GIRATÓRIA', 41, ['jic', 'jic2']],
  ['230J', 'TEE MACHO JIC', 38, ['jic']],
  ['231JFC', 'TEE JIC FÊMEA GIRATÓRIA CENTRAL', 38, ['jic']],
  ['231JFL', 'TEE JIC FÊMEA GIRATÓRIA LATERAL', 38, ['jic']],
  ['230JR', 'TEE MACHO JIC COM MACHO ORB LATERAL', 38, ['jic']],
  ['240J', 'TAMPÃO MACHO JIC', 39, ['jic']],
  ['241J', 'TAMPÃO FÊMEA JIC', 39, ['jic']],
  ['240JS', 'ADAPTADOR MACHO JIC PARA SOLDA', 45, ['jic']],
  // NPT
  ['210N', 'NIPLE DUPLO NPT', 32, ['npt', 'npt2']],
  ['201N', 'BUCHA DE REDUÇÃO NPT', 32, ['npt', 'npt2']],
  ['211N', 'LUVA NPT', 32, ['npt']],
  ['200NJ', 'ADAPTADOR RETO MACHO NPT X MACHO JIC', 35, ['npt', 'jic']],
  ['201NJ', 'ADAPTADOR RETO MACHO NPT X FÊMEA JIC GIRATÓRIA', 35, ['npt', 'jic']],
  ['212NJ', 'ADAPTADOR FÊMEA FIXA NPT X MACHO JIC', 35, ['npt', 'jic']],
  ['220NJ', 'COTOVELO 90° MACHO NPT X MACHO JIC', 35, ['npt', 'jic']],
  ['245NJ', 'COTOVELO 45° MACHO NPT X MACHO JIC', 35, ['npt', 'jic']],
  ['220N', 'COTOVELO 90° MACHO NPT X MACHO NPT', 49, ['npt', 'npt2']],
  ['221N', 'COTOVELO 90° MACHO NPT X FÊMEA NPT', 49, ['npt']],
  ['221FN', 'COTOVELO 90° FÊMEA NPT X FÊMEA NPT', 49, ['npt']],
  ['231N', 'TEE FÊMEA NPT', 48, ['npt', 'npt']],
  ['240N', 'TAMPÃO MACHO NPT', 47, ['npt']],
  ['240NS', 'BUJÃO MACHO NPT SEXTAVADO INTERNO', 47, ['npt']],
  // BSP
  ['210B', 'NIPLE DUPLO BSP', 37, ['bsp', 'bsp2']],
  ['201B', 'BUCHA DE REDUÇÃO BSP', 37, ['bsp', 'bsp2']],
  ['200BW', 'ADAPTADOR RETO MACHO BSP 60° X MACHO BSP PARALELO', 37, ['bsp', 'bsp2']],
  ['200BJ', 'ADAPTADOR RETO MACHO BSP X MACHO JIC', 24, ['bsp', 'jic']],
  ['240B', 'BUJÃO MACHO BSP', 46, ['bsp']],
  ['240BS', 'BUJÃO MACHO BSP SEXTAVADO INTERNO', 46, ['bsp']],
  // ORFS
  ['210O', 'NIPLE DUPLO ORFS', 50, ['orfs']],
  ['210UCO', 'UNIÃO COMPRIDA ORFS', 50, ['orfs']],
  ['220OR', 'COTOVELO 90° MACHO ORFS X MACHO ORB', 44, ['orfs', 'orb']],
  ['230O', 'TEE MACHO ORFS', 43, ['orfs']],
  ['231OFL', 'TEE ORFS FÊMEA GIRATÓRIA LATERAL', 43, ['orfs']],
  ['240O', 'TAMPÃO MACHO ORFS', 42, ['orfs']],
  ['241O', 'TAMPÃO FÊMEA ORFS', 42, ['orfs']],
  // ORB (O-ring Boss)
  ['200RJ', 'ADAPTADOR RETO MACHO ORB X MACHO JIC', 34, ['orb', 'jic']],
  ['201RJ', 'ADAPTADOR RETO MACHO ORB X FÊMEA JIC GIRATÓRIA', 34, ['orb', 'jic']],
  ['220RJ', 'COTOVELO 90° MACHO ORB X MACHO JIC', 34, ['orb', 'jic']],
  ['245RJ', 'COTOVELO 45° MACHO ORB X MACHO JIC', 34, ['orb', 'jic']],
  ['240R', 'TAMPÃO MACHO ORB', 33, ['orb']],
  ['240RS', 'BUJÃO MACHO ORB SEXTAVADO INTERNO', 33, ['orb']],
  // Métrico
  ['200MJ', 'ADAPTADOR RETO MACHO MÉTRICO X MACHO JIC', 27, ['met', 'jic']],
  ['240MS', 'BUJÃO MACHO MÉTRICO SEXTAVADO INTERNO', 27, ['met']],
];
// Combinações preparadas para compras futuras (famílias vazias)
const NOMES_PADRAO: Record<string, string> = { B: 'BSP', N: 'NPT', O: 'ORFS', R: 'ORB', M: 'MÉTRICO' };
const LISTA_DO_PADRAO: Record<string, string> = { B: 'bsp', N: 'npt', O: 'orfs', R: 'orb', M: 'met' };
const CAT_DO_PADRAO: Record<string, number> = { B: 24, N: 25, O: 26, R: 33, M: 27 };
for (const [a, b] of [['B', 'N'], ['B', 'O'], ['N', 'O'], ['M', 'B'], ['M', 'N'], ['R', 'O'], ['R', 'N']]) {
  const lados = [LISTA_DO_PADRAO[a], LISTA_DO_PADRAO[b]];
  FAMILIAS.push([`200${a}${b}`, `ADAPTADOR RETO MACHO ${NOMES_PADRAO[a]} X MACHO ${NOMES_PADRAO[b]}`, CAT_DO_PADRAO[a], lados]);
  FAMILIAS.push([`201${a}${b}`, `ADAPTADOR RETO MACHO ${NOMES_PADRAO[a]} X FÊMEA ${NOMES_PADRAO[b]}`, CAT_DO_PADRAO[a], lados]);
  FAMILIAS.push([`220${a}${b}`, `COTOVELO 90° MACHO ${NOMES_PADRAO[a]} X MACHO ${NOMES_PADRAO[b]}`, CAT_DO_PADRAO[a], lados]);
}

// ---------------------------------------------------------------- SKU antigo → SKU no padrão
const LETRA_HAM: Record<string, string> = { N: 'N', B: 'B', O: 'R', J: 'J' };
const desc = (a: string, b: string) => (Number(a) >= Number(b) ? [a, b] : [b, a]);
const reescrever = (sku: string, nome: string): string | null => {
  if (sku === '200NJ1616') return '200NJ-16-16';
  if (sku === '200j-06-06') return '220J-06-06';
  let m = sku.match(/^HAM([NBO])(\d\d)M([NBJ])(\d\d)$/);
  if (m) {
    const [, a, ca, b, cb] = m;
    if (a === b) { const [x, y] = desc(ca, cb); return `210${a}-${x}-${y}`; }
    return `200${LETRA_HAM[a]}${LETRA_HAM[b]}-${ca}-${cb}`;
  }
  m = sku.match(/^HAM([NB])(\d\d)F\1(\d\d)$/);
  if (m) return `201${m[1]}-${m[2]}-${m[3]}`;
  const troca: Array<[RegExp, string]> = [[/^200OJ-/, '200RJ-'], [/^201OJ-/, '201RJ-'], [/^220OJ-/, '220RJ-'], [/^245OJ-/, '245RJ-'],
    [/^220OO-/, '220OR-'], [/^230JO-/, '230JR-'], [/^240OS-/, '240RS-']];
  for (const [de, para] of troca) if (de.test(sku)) return sku.replace(de, para);
  m = sku.match(/^240OB-(\d\d)$/);
  if (m) return /INTERNO/i.test(nome) ? `240RS-${m[1]}` : `240R-${m[1]}`;
  return sku;
};

// ---------------------------------------------------------------- utilidades
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
const normNome = (t: string) => String(t).toUpperCase().replace(/["'\s]/g, '');
// Parte da medida que aparece no nome antigo: '9/16"-18' → 9/16; 'M16 X 1.5' → M16
const marca = (valor: string) => normNome(valor.split('"')[0].split(' X ')[0]);

// ---------------------------------------------------------------- migração
const migrar = async (conn: Conn) => {
  const criados = { atributos: [] as number[], opcoes: [] as number[], familias: [] as number[] };
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = 'rosca_orb'`, [TENANT])).length) {
    throw new Error('Rosca ORB já existe: esta migração já foi aplicada.');
  }
  // 1. Listas
  const idLista: Record<string, number> = {};
  for (const [k, l] of Object.entries(LISTAS)) {
    if (!l.existe) continue;
    const r = await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1`, [TENANT, l.codigo]);
    if (!r.length) throw new Error(`Lista ${l.nome} não encontrada.`);
    idLista[k] = Number(r[0].id);
  }
  const ordemNpt = Number((await q(conn, `SELECT COUNT(*) n FROM atributos_comercial_opcoes WHERE atributo_id = ?`, [idLista.npt]))[0].n);
  for (const [i, [valor, codigo]] of NPT_NOVAS.entries()) {
    const [r] = await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
      [TENANT, idLista.npt, valor, codigo, ordemNpt + i + 1]);
    criados.opcoes.push(Number(r.insertId));
  }
  for (const [k, l] of Object.entries(LISTAS)) {
    if (l.existe) continue;
    const [r] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo)
      VALUES (?, ?, ?, 'lista', 'grade', 0, 1, 1)`, [TENANT, l.nome, l.codigo]);
    idLista[k] = Number(r.insertId);
    criados.atributos.push(idLista[k]);
    await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo)
      SELECT tenant_id, ?, valor, codigo, ordem, 1 FROM atributos_comercial_opcoes WHERE atributo_id = ? AND ativo = 1`, [idLista[k], idLista[l.copiaDe!]]);
  }
  const opcoes: Record<string, Map<string, string>> = {};
  for (const k of Object.keys(LISTAS)) {
    opcoes[k] = new Map((await q(conn, `SELECT valor, codigo FROM atributos_comercial_opcoes WHERE atributo_id = ? AND ativo = 1`, [idLista[k]]))
      .map(o => [String(o.codigo), String(o.valor)]));
  }

  // 2. Famílias (com os atributos de grade de cada lado)
  const idFamilia = new Map<string, number>();
  for (const [sigla, nome, cat, lados] of FAMILIAS) {
    const unicos = [...new Set(lados)];
    const tokens = lados.map(k => `{${LISTAS[k].nome}:cod}`);
    const templateSku = `{SIGLA}-${tokens.join('-')}`;
    const templateNome = `{FAMILIA} - ${unicos.map(k => `{${LISTAS[k].nome}}`).join(' X ')}`;
    const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
        template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, 'ficha', ?, 'ATIVO', 'PA', '-', ?, ?, 'PC', ?, '#1677ff', 0)`,
      [TENANT, cat, nome, sigla, templateSku, templateNome]);
    const id = Number(r.insertId);
    idFamilia.set(sigla, id);
    criados.familias.push(id);
    for (const [o, k] of unicos.entries()) {
      await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel,
          herdar, ordem, compoe_sku, gera_variacao, ativo) VALUES (?, 'familia', ?, ?, 'grade', 0, 1, 1, ?, 1, 1, 1)`, [TENANT, id, idLista[k], o + 1]);
    }
  }

  // 3. Itens: SKU de hoje → SKU no padrão → família e valores (pelas bitolas do SKU)
  const itens = await q(conn, `SELECT ic.id_item, COALESCE(NULLIF(TRIM(cpd.sku_customizado), ''), ic.sku) AS sku, COALESCE(NULLIF(TRIM(cpd.nome_comercial), ''), ic.nome_item) AS nome,
      cpd.familia_id, cpd.categoria_id, cpd.sku_customizado, cpd.nome_comercial
    FROM itens_core ic JOIN comercial_produtos_dados cpd ON cpd.id_item = ic.id_item AND cpd.tenant_id = ic.tenant_id
    WHERE ic.tenant_id = ? AND ic.status <> 'INATIVO'
      AND (ic.nome_item LIKE 'ADAPT%' OR ic.nome_item LIKE '-ADAPT%' OR ic.nome_item LIKE '%ADAPT.%' OR ic.sku LIKE 'HMN%' OR cpd.sku_customizado LIKE 'HMN%')`, [TENANT]);
  const fora: string[] = [];
  type Plano = { item: any; alvo: string; sigla: string; atributos: Record<string, string> };
  const planos: Plano[] = [];
  for (const it of itens) {
    const alvo = reescrever(String(it.sku), String(it.nome));
    if (!alvo) { fora.push(`${it.sku} · ${it.nome}`); continue; }
    if (/^100MN-\d\d-\d\d$/.test(alvo) || /^HMN(\d\d)(\d\d)$/.test(String(it.sku))) continue;
    const fam = FAMILIAS.find(([sigla, , , lados]) => {
      const m = alvo.match(new RegExp(`^${sigla}-(\\d\\d)(?:-(\\d\\d))?$`));
      return m && (lados.length === 1 ? !m[2] : !!m[2]);
    });
    if (!fam) { fora.push(`${it.sku} · ${it.nome}`); continue; }
    const [sigla, , , lados] = fam;
    const codigos = alvo.slice(sigla.length + 1).split('-');
    const atributos: Record<string, string> = {};
    const problemas: string[] = [];
    const nome = normNome(it.nome);
    lados.forEach((k, i) => {
      const valor = opcoes[k].get(codigos[i]);
      if (!valor) { problemas.push(`${LISTAS[k].nome} sem a bitola ${codigos[i]}`); return; }
      const ja = atributos[String(idLista[k])];
      if (ja && ja !== valor) problemas.push(`${LISTAS[k].nome} com bitolas diferentes nos dois lados`);
      atributos[String(idLista[k])] = valor;
      if (!nome.includes(marca(valor))) problemas.push(`${valor} não aparece no nome`);
    });
    if (problemas.length) { fora.push(`${it.sku} · ${problemas.join('; ')}`); continue; }
    planos.push({ item: it, alvo, sigla, atributos });
  }
  // Terminal NPT macho fixo de fornecedor (HMN0203 = 1/8" NPT × mangueira 3/16")
  const terminais = itens.filter(i => /^HMN(\d\d)(\d\d)$/.test(String(i.sku)));

  // Duplicados: o mesmo SKU no padrão → fica o que já tinha o SKU da casa
  const porAlvo = new Map<string, Plano[]>();
  for (const p of planos) porAlvo.set(p.alvo, [...(porAlvo.get(p.alvo) || []), p]);
  const unir: Array<{ origem: Plano; destino: Plano }> = [];
  for (const grupo of porAlvo.values()) {
    if (grupo.length < 2) continue;
    const destino = grupo.find(p => p.item.sku === p.alvo) || grupo.find(p => !/^HAM/.test(p.item.sku)) || grupo[0];
    for (const p of grupo) if (p !== destino) unir.push({ origem: p, destino });
  }
  const unidos = new Set(unir.map(u => u.origem.item.id_item));
  const finais = planos.filter(p => !unidos.has(p.item.id_item));

  const backupItens = [...planos.map(p => p.item), ...terminais].map(i => ({ idItem: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id,
    sku_customizado: i.sku_customizado, nome_comercial: i.nome_comercial }));
  const familiasAntigas = [...new Set(planos.map(p => p.item.familia_id).filter(Boolean))];
  const statusAntigas = familiasAntigas.length ? await q(conn, `SELECT id, status FROM comercial_familias WHERE id IN (${familiasAntigas.join(',')})`) : [];

  // 4. Grava
  const linhas: string[] = [];
  const restaurar = prenderPool(conn);
  try {
    for (const u of unir) {
      const r = await chamar(unificarItens, {}, { idOrigem: u.origem.item.id_item, idDestino: u.destino.item.id_item, fator: 1,
        motivo: `Mesmo adaptador (${u.origem.item.sku} = ${u.destino.item.sku} → ${u.destino.alvo})` });
      if (r.status >= 400) throw new Error(`Unificação ${u.origem.item.sku} → ${u.destino.item.sku}: ${r.dados?.error || r.status}`);
      linhas.push(`  UNIDO: ${u.origem.item.sku.padEnd(13)} → ${u.destino.item.sku}`);
    }
    const porFamilia = new Map<string, Plano[]>();
    for (const p of finais) porFamilia.set(p.sigla, [...(porFamilia.get(p.sigla) || []), p]);
    for (const [sigla, lista] of porFamilia) {
      const id = idFamilia.get(sigla)!;
      const cat = FAMILIAS.find(f => f[0] === sigla)![2];
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE tenant_id = ? AND id_item IN (${lista.map(() => '?').join(',')})`,
        [id, cat, TENANT, ...lista.map(p => p.item.id_item)]);
      const r = await chamar(formalizarItensFamilia, { idFamilia: String(id) }, { itens: lista.map(p => ({ idItem: String(p.item.id_item), atributos: p.atributos })) });
      if (r.status >= 400) throw new Error(`Formalização ${sigla}: ${r.dados?.error || r.status}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item IN (${lista.map(() => '?').join(',')})`,
        lista.map(p => p.item.id_item));
      for (const p of lista) {
        const d = depois.find(x => Number(x.id_item) === Number(p.item.id_item));
        if (!d || d.sku_customizado !== p.alvo) throw new Error(`SKU inesperado: ${p.item.sku} → ${d?.sku_customizado} (esperado ${p.alvo}). Nada foi gravado.`);
      }
      const mudaram = lista.filter(p => p.item.sku !== p.alvo).map(p => `${p.item.sku}→${p.alvo}`);
      const ex = depois[0];
      linhas.push(`  ${String(lista.length).padStart(3)}  ${sigla.padEnd(7)} ${ex.nome_comercial}${mudaram.length ? `\n         SKU novo: ${mudaram.join(', ')}` : ''}`);
    }
    // Terminal do fornecedor na família de terminal NPT macho fixo
    const idMang = Number((await q(conn, `SELECT id FROM atributos_comercial WHERE codigo = 'terminal_mangueira'`))[0].id);
    const mangs = new Map((await q(conn, `SELECT valor, codigo FROM atributos_comercial_opcoes WHERE atributo_id = ? AND ativo = 1`, [idMang])).map(o => [String(o.codigo), String(o.valor)]));
    for (const t of terminais) {
      const [, rosca, mang] = String(t.sku).match(/^HMN(\d\d)(\d\d)$/)!;
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = 16 WHERE id_item = ?`, [FAM_TERMINAL_NPT_MACHO, t.id_item]);
      const r = await chamar(formalizarItensFamilia, { idFamilia: String(FAM_TERMINAL_NPT_MACHO) },
        { itens: [{ idItem: String(t.id_item), atributos: { [idLista.npt]: opcoes.npt.get(rosca), [idMang]: mangs.get(mang) } }] });
      if (r.status >= 400) throw new Error(`Terminal ${t.sku}: ${r.dados?.error || r.status}`);
      const d = (await q(conn, `SELECT sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item = ?`, [t.id_item]))[0];
      linhas.push(`  TERMINAL: ${t.sku} → ${d.sku_customizado} · ${d.nome_comercial}`);
    }
  } finally {
    restaurar();
  }
  // Famílias antigas que ficaram vazias: inativas
  for (const f of statusAntigas) {
    const n = Number((await q(conn, `SELECT COUNT(*) n FROM comercial_produtos_dados WHERE familia_id = ?`, [f.id]))[0].n);
    if (n === 0) await conn.query(`UPDATE comercial_familias SET status = 'INATIVO' WHERE id = ?`, [f.id]);
  }

  const vazias = FAMILIAS.filter(f => !finais.some(p => p.sigla === f[0]));
  const rel = [
    `Listas novas: ${Object.values(LISTAS).filter(l => !l.existe).map(l => l.nome).join(', ')} · NPT +${NPT_NOVAS.length} medidas`,
    `Famílias: ${FAMILIAS.length} (${FAMILIAS.length - vazias.length} com itens, ${vazias.length} preparadas vazias) · itens: ${finais.length} · unificados: ${unir.length}`,
    `\nPor família (itens · exemplo):\n${linhas.join('\n')}`,
    `\nPreparadas (vazias):\n${vazias.map(f => `  ${f[0].padEnd(7)} ${f[1]}`).join('\n')}`,
    `\nFicaram de fora (${fora.length}):\n${fora.map(x => `  ${x}`).join('\n')}`,
  ];
  return { rel, backup: { criados, backupItens, statusAntigas } };
};

const reverter = async (conn: Conn, arquivo: string) => {
  const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const c = b.criados;
  if (c.atributos.length) await conn.query(`DELETE FROM atributos_comercial_valores WHERE atributo_id IN (${c.atributos.join(',')})`);
  if (c.opcoes.length) await conn.query(`DELETE FROM atributos_comercial_valores WHERE opcao_id IN (${c.opcoes.join(',')})`);
  for (const i of b.backupItens) {
    await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ? WHERE tenant_id = ? AND id_item = ?`,
      [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, TENANT, i.idItem]);
  }
  for (const f of b.statusAntigas) await conn.query(`UPDATE comercial_familias SET status = ? WHERE id = ?`, [f.status, f.id]);
  const restam = await q(conn, `SELECT COUNT(*) n FROM comercial_produtos_dados WHERE familia_id IN (${c.familias.join(',')})`);
  if (Number(restam[0].n) > 0) throw new Error(`Há ${restam[0].n} item(ns) novos nas famílias de adaptadores: tire-os antes de reverter.`);
  await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade IN (${c.familias.join(',')})`);
  await conn.query(`DELETE FROM comercial_familias WHERE id IN (${c.familias.join(',')})`);
  if (c.opcoes.length) await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE id IN (${c.opcoes.join(',')})`);
  if (c.atributos.length) {
    await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE atributo_id IN (${c.atributos.join(',')})`);
    await conn.query(`DELETE FROM atributos_comercial WHERE id IN (${c.atributos.join(',')})`);
  }
  return `Revertido: ${b.backupItens.length} itens de volta; ${c.familias.length} famílias e ${c.atributos.length} listas removidas. Unificações continuam.`;
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
        const destino = path.join(pasta, `adaptadores-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
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
