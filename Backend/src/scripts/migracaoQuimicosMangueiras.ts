// Mangueiras (família por norma, bitola = lista Mangueira dos terminais, pressão como ficha) e lubrificantes/químicos
// (graxas, vaselina, desengripante, pasta de solda, colas, veda-rosca) no padrão da casa.
//   Mangueira: {norma}-{bitola}  (R2AT-08, JACK-04, J1401-02, PT300-06)
//   Químicos:  {produto}-{tipo}-{embalagem}/{MARCA quando houver}  (GRX-CALG-500G, COLA-PVC-175G/TIGRE, VAS-400G/GARIN)
//   npx ts-node src/scripts/migracaoQuimicosMangueiras.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
const CHAVE_MARCA = 'atributo-marca-virtual';
const CAT = { MANG_HID: 7, MANG_TUBOS: 2, QUIMICOS: 4, PVC: 55, OLEOS: 8, ELETRICA: 54 };
const EMBALAGENS = ['2G', '80G', '110G', '175G', '300ML', '400G', '500G', '850G', '900G', '1KG'];
const MEDIDAS_VEDA = ['18X10M', '18X25M', '18X50M'];

// Famílias: [chave, nome, categoria, sigla, templateSku, templateNome, atributos [(chave do atributo, papel, valor fixo?)], marcaNoSku]
type Attr = [string, 'grade' | 'dna' | 'ficha', string?];
type Fam = { chave: string; nome: string; cat: number; sigla: string; sku: string; nome_t: string; attrs: Attr[]; marca?: boolean };
const FAMILIAS: Fam[] = [
  { chave: 'R1AT', nome: 'MANGUEIRA HIDRÁULICA SAE 100 R1AT (1 TRAMA DE AÇO)', cat: CAT.MANG_HID, sigla: 'R1AT', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade'], ['bar', 'ficha'], ['psi', 'ficha']] },
  { chave: 'R2AT', nome: 'MANGUEIRA HIDRÁULICA SAE 100 R2AT (2 TRAMAS DE AÇO)', cat: CAT.MANG_HID, sigla: 'R2AT', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade'], ['bar', 'ficha'], ['psi', 'ficha']] },
  { chave: 'R17', nome: 'MANGUEIRA HIDRÁULICA SAE 100 R17 (COMPACTA)', cat: CAT.MANG_HID, sigla: 'R17', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade'], ['bar', 'ficha'], ['psi', 'ficha']] },
  { chave: 'JACK', nome: 'MANGUEIRA PARA MACACO HIDRÁULICO 10.000 PSI', cat: CAT.MANG_HID, sigla: 'JACK', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade'], ['psi', 'ficha']] },
  { chave: 'J1401', nome: 'MANGUEIRA DE FREIO HIDRÁULICO SAE J1401', cat: CAT.MANG_HID, sigla: 'J1401', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade']] },
  { chave: 'J188', nome: 'MANGUEIRA DE DIREÇÃO HIDRÁULICA SAE J188 / J2050', cat: CAT.MANG_HID, sigla: 'J188', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade']] },
  { chave: 'PT300', nome: 'MANGUEIRA PT 300 PSI', cat: CAT.MANG_TUBOS, sigla: 'PT300', sku: '{SIGLA}-{Mangueira:cod}', nome_t: '{FAMILIA} - {Mangueira}',
    attrs: [['mang', 'grade'], ['psi', 'ficha']] },
  { chave: 'GRX-AZUL', nome: 'GRAXA AZUL MULTIUSO', cat: CAT.QUIMICOS, sigla: 'GRX', sku: '{SIGLA}-{Tipo de graxa:cod}-{Embalagem:cod}', nome_t: '{FAMILIA} - {Embalagem}',
    attrs: [['graxa', 'dna', 'AZUL MULTIUSO'], ['emb', 'grade']] },
  { chave: 'GRX-LIT', nome: 'GRAXA BRANCA DE LÍTIO', cat: CAT.QUIMICOS, sigla: 'GRX', sku: '{SIGLA}-{Tipo de graxa:cod}-{Embalagem:cod}', nome_t: '{FAMILIA} - {Embalagem}',
    attrs: [['graxa', 'dna', 'BRANCA DE LÍTIO'], ['emb', 'grade']] },
  { chave: 'GRX-CALG', nome: 'GRAXA DE CÁLCIO GRAFITADA', cat: CAT.QUIMICOS, sigla: 'GRX', sku: '{SIGLA}-{Tipo de graxa:cod}-{Embalagem:cod}', nome_t: '{FAMILIA} - {Embalagem}',
    attrs: [['graxa', 'dna', 'CÁLCIO GRAFITADA'], ['emb', 'grade']] },
  { chave: 'VAS', nome: 'VASELINA EM PASTA BRANCA', cat: CAT.QUIMICOS, sigla: 'VAS', sku: '{SIGLA}-{Embalagem:cod}/{MARCA}', nome_t: '{FAMILIA} - {Embalagem} | {MARCA}',
    attrs: [['emb', 'grade']], marca: true },
  { chave: 'DESENG', nome: 'ÓLEO DESENGRIPANTE / LUBRIFICANTE SPRAY', cat: CAT.QUIMICOS, sigla: 'DESENG', sku: '{SIGLA}-{Embalagem:cod}', nome_t: '{FAMILIA} - {Embalagem}',
    attrs: [['emb', 'grade']] },
  { chave: 'PSOLDA', nome: 'PASTA PARA SOLDA', cat: CAT.QUIMICOS, sigla: 'PSOLDA', sku: '{SIGLA}-{Embalagem:cod}/{MARCA}', nome_t: '{FAMILIA} - {Embalagem} | {MARCA}',
    attrs: [['emb', 'grade']], marca: true },
  { chave: 'COLA-INST', nome: 'COLA INSTANTÂNEA', cat: CAT.QUIMICOS, sigla: 'COLA-INST', sku: '{SIGLA}-{Embalagem:cod}/{MARCA}', nome_t: '{FAMILIA} - {Embalagem} | {MARCA}',
    attrs: [['emb', 'grade']], marca: true },
  { chave: 'COLA-PVC', nome: 'ADESIVO (COLA) PARA PVC', cat: CAT.PVC, sigla: 'COLA-PVC', sku: '{SIGLA}-{Embalagem:cod}/{MARCA}', nome_t: '{FAMILIA} - {Embalagem} | {MARCA}',
    attrs: [['emb', 'grade']], marca: true },
  { chave: 'VEDA', nome: 'FITA VEDA ROSCA', cat: CAT.PVC, sigla: 'VEDA', sku: '{SIGLA}-{Medida da fita:cod}', nome_t: '{FAMILIA} - {Medida da fita}',
    attrs: [['fita', 'grade']] },
];
// SKU de hoje → [família, valores (por chave do atributo), marca?, nome antigo para conferência opcional]
const ITENS: Record<string, [string, Record<string, string>, string?]> = {
  'R1AT-04': ['R1AT', { mang: '04', bar: '225', psi: '3260' }], 'R1AT-06': ['R1AT', { mang: '06', bar: '180', psi: '2650' }],
  'R1AT-08': ['R1AT', { mang: '08', bar: '160', psi: '2320' }], 'R1AT-10': ['R1AT', { mang: '10', bar: '130', psi: '1880' }],
  'R1AT-12': ['R1AT', { mang: '12', bar: '105', psi: '1550' }],
  'R2AT-04': ['R2AT', { mang: '04', bar: '400', psi: '5800' }], 'R2AT-06': ['R2AT', { mang: '06', bar: '330', psi: '4785' }],
  'R2AT-08': ['R2AT', { mang: '08', bar: '275', psi: '4000' }], 'R2AT-10': ['R2AT', { mang: '10', bar: '250', psi: '3630' }],
  'R2AT-12': ['R2AT', { mang: '12', bar: '215', psi: '3120' }], 'R2AT-16': ['R2AT', { mang: '16' }], 'R2AT-20': ['R2AT', { mang: '20' }], 'R2AT-24': ['R2AT', { mang: '24' }],
  'R17-16': ['R17', { mang: '16' }],
  '0210144': ['JACK', { mang: '04', psi: '10000' }], '0210145': ['JACK', { mang: '06', psi: '10000' }],
  '030701': ['J1401', { mang: '02' }], '030703': ['J188', { mang: '06' }],
  'AV384444821-8': ['PT300', { mang: '04', psi: '300' }], 'AV384444821-9': ['PT300', { mang: '05', psi: '300' }], 'AV384444821-10': ['PT300', { mang: '06', psi: '300' }],
  '18735': ['GRX-AZUL', { emb: '80G' }], '24425': ['GRX-AZUL', { emb: '500G' }],
  '18734': ['GRX-LIT', { emb: '80G' }], '24426': ['GRX-LIT', { emb: '500G' }],
  '18733': ['GRX-CALG', { emb: '80G' }], '18732': ['GRX-CALG', { emb: '500G' }], '11407': ['GRX-CALG', { emb: '900G' }],
  '11411': ['VAS', { emb: '80G' }, 'GARIN'], '11412': ['VAS', { emb: '400G' }, 'GARIN'],
  '15247': ['DESENG', { emb: '300ML' }],
  '48364': ['PSOLDA', { emb: '110G' }, 'EMAVI'],
  '31216': ['COLA-INST', { emb: '2G' }, 'TEKBOND'],
  '33749': ['COLA-PVC', { emb: '175G' }, 'AMANCO'], '339741': ['COLA-PVC', { emb: '850G' }, 'AMANCO'],
  '76465': ['COLA-PVC', { emb: '175G' }, 'TIGRE'], '76473': ['COLA-PVC', { emb: '850G' }, 'TIGRE'],
  '11107': ['VEDA', { fita: '18X25M' }], '11108': ['VEDA', { fita: '18X50M' }],
};
// Só mudam de categoria (sem família): óleos para Óleos; fitas isolantes para Elétrica
const SO_CATEGORIA: Record<string, number> = { 'HID-68-BD': CAT.OLEOS, 'TOP-15W40-BD': CAT.OLEOS, 'OLEO_COMPRESSOR': CAT.OLEOS, '9796': CAT.ELETRICA, '11012': CAT.ELETRICA };
const MARCAS_NOVAS = ['GARIN', 'EMAVI', 'TEKBOND'];
// Diâmetro interno (mm) da bitola: exigido pela categoria Mangueiras Hidráulicas
const DI_MM: Record<string, string> = { '02': '3.18', '03': '4.76', '04': '6.35', '05': '7.94', '06': '9.53', '08': '12.7', '10': '15.88', '12': '19.05', '16': '25.4', '20': '31.75', '24': '38.1', '32': '50.8' };

type Conn = any;
const q = async (conn: Conn, sql: string, p: any[] = []) => (await conn.query(sql, p))[0] as any[];

const migrar = async (conn: Conn) => {
  if ((await q(conn, `SELECT id FROM atributos_comercial WHERE codigo = 'quimico_embalagem'`)).length) throw new Error('Já aplicado.');
  const criados = { atributos: [] as number[], opcoes: [] as number[], familias: [] as number[], marcas: [] as number[] };
  // Atributos: existentes (Mangueira) e novos
  const idMang = Number((await q(conn, `SELECT id FROM atributos_comercial WHERE codigo = 'terminal_mangueira'`))[0].id);
  if (!(await q(conn, `SELECT id FROM atributos_comercial_opcoes WHERE atributo_id = ? AND codigo = '02'`, [idMang])).length) {
    const [r] = await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, '1/8"', '02', 0, 1)`, [TENANT, idMang]);
    criados.opcoes.push(Number(r.insertId));
  }
  const novo = async (nome: string, codigo: string, tipo: string, opcoes: Array<[string, string]> = []) => {
    const [r] = await conn.query(`INSERT INTO atributos_comercial (tenant_id, nome, codigo, tipo, escopo_padrao, obrigatorio_padrao, pesquisavel, ativo) VALUES (?, ?, ?, ?, 'ficha', 0, 1, 1)`,
      [TENANT, nome, codigo, tipo]);
    const id = Number(r.insertId);
    criados.atributos.push(id);
    for (const [i, [valor, cod]] of opcoes.entries()) {
      await conn.query(`INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) VALUES (?, ?, ?, ?, ?, 1)`, [TENANT, id, valor, cod, i + 1]);
    }
    return id;
  };
  const ids: Record<string, number> = {
    mang: idMang,
    bar: await novo('Pressão de trabalho (bar)', 'mangueira_pressao_bar', 'decimal'),
    psi: await novo('Pressão de trabalho (psi)', 'mangueira_pressao_psi', 'decimal'),
    emb: await novo('Embalagem', 'quimico_embalagem', 'lista', EMBALAGENS.map(e => [e.replace(/(\d)(G|ML|KG)$/, '$1 $2'), e])),
    graxa: await novo('Tipo de graxa', 'graxa_tipo', 'lista', [['AZUL MULTIUSO', 'AZUL'], ['BRANCA DE LÍTIO', 'LIT'], ['CÁLCIO GRAFITADA', 'CALG']]),
    fita: await novo('Medida da fita', 'veda_rosca_medida', 'lista', MEDIDAS_VEDA.map(m => [m.replace('X', ' MM X ').replace(/M$/, ' M'), m])),
  };
  const nomeAttr: Record<string, string> = { mang: 'Mangueira', bar: 'Pressão de trabalho (bar)', psi: 'Pressão de trabalho (psi)', emb: 'Embalagem', graxa: 'Tipo de graxa', fita: 'Medida da fita' };
  const opcoes: Record<string, Map<string, string>> = {};
  for (const k of ['mang', 'emb', 'graxa', 'fita']) {
    opcoes[k] = new Map((await q(conn, `SELECT valor, codigo FROM atributos_comercial_opcoes WHERE atributo_id = ? AND ativo = 1`, [ids[k]])).map(o => [String(o.codigo), String(o.valor)]));
  }
  // Marcas
  for (const m of MARCAS_NOVAS) {
    if ((await q(conn, `SELECT id FROM comercial_marcas WHERE tenant_id = ? AND UPPER(nome) = ?`, [TENANT, m])).length) continue;
    const [r] = await conn.query(`INSERT INTO comercial_marcas (tenant_id, nome, slug, status) VALUES (?, ?, ?, 'Ativo')`, [TENANT, m, m.toLowerCase()]);
    criados.marcas.push(Number(r.insertId));
  }
  // Famílias
  const idFamilia: Record<string, number> = {};
  for (const f of FAMILIAS) {
    const [r] = await conn.query(`INSERT INTO comercial_familias (tenant_id, categoria_id, id_marca, comportamento_marca, nome, status, tipo_item, separador_sku, sigla_sku,
        template_sku, unidade_base, template_nome, cor, ordem) VALUES (?, ?, 1, ?, ?, 'ATIVO', 'PA', '-', ?, ?, 'UN', ?, '#1677ff', 0)`,
      [TENANT, f.cat, f.marca ? 'grade' : 'ficha', f.nome, f.sigla, f.sku, f.nome_t]);
    idFamilia[f.chave] = Number(r.insertId);
    criados.familias.push(idFamilia[f.chave]);
    for (const [o, [k, papel, fixo]] of f.attrs.entries()) {
      await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, escopo_comercial, obrigatorio, pesquisavel, herdar, ordem,
          compoe_sku, gera_variacao, valor_padrao_grupo, ativo) VALUES (?, 'familia', ?, ?, ?, 0, 1, 1, ?, ?, ?, ?, 1)`,
        [TENANT, idFamilia[f.chave], ids[k], papel, o + 1, papel === 'ficha' ? 0 : 1, papel === 'grade' ? 1 : 0, fixo ?? null]);
    }
  }

  const todos = await q(conn, `SELECT p.id_item, p.familia_id, p.categoria_id, p.sku_customizado, p.nome_comercial, p.id_marca,
      COALESCE(NULLIF(p.sku_customizado,''), ic.sku) AS sku, COALESCE(NULLIF(p.nome_comercial,''), ic.nome_item) AS nome
    FROM comercial_produtos_dados p JOIN itens_core ic ON ic.id_item = p.id_item WHERE ic.tenant_id = ? AND ic.status <> 'INATIVO'`, [TENANT]);
  const alvo = todos.filter(i => ITENS[String(i.sku)] || SO_CATEGORIA[String(i.sku)]);
  const faltando = [...Object.keys(ITENS), ...Object.keys(SO_CATEGORIA)].filter(s => !alvo.some(i => String(i.sku) === s));
  if (faltando.length) throw new Error(`SKUs não encontrados: ${faltando.join(', ')}`);
  const familiasAntigas = [...new Set(alvo.map(i => i.familia_id).filter(Boolean))];
  // Itens que já tinham diâmetro interno gravado (o reverter não apaga o deles)
  const diametroAntes = (await q(conn, `SELECT DISTINCT v.id_entidade FROM atributos_comercial_valores v JOIN atributos_comercial a ON a.id = v.atributo_id
    WHERE a.nome = 'Diâmetro Interno' AND v.tipo_entidade = 'produto' AND v.id_entidade IN (${alvo.map(i => i.id_item).join(',')})`)).map(r => Number(r.id_entidade));
  const statusAntigas = familiasAntigas.length ? await q(conn, `SELECT id, status FROM comercial_familias WHERE id IN (${familiasAntigas.join(',')})`) : [];

  // O da categoria Mangueiras Hidráulicas (há outro "Diâmetro Interno", o dos rolamentos)
  const idDiametro = Number((await q(conn, `SELECT atributo_id AS id FROM atributos_core_entidades WHERE tipo_entidade = 'categoria' AND id_entidade = ? AND ativo = 1
    AND atributo_id IN (SELECT id FROM atributos_comercial WHERE nome = 'Diâmetro Interno')`, [CAT.MANG_HID]))[0]?.id) || 0;
  const linhas: string[] = [];
  for (const i of alvo.filter(x => SO_CATEGORIA[String(x.sku)])) {
    await conn.query(`UPDATE comercial_produtos_dados SET categoria_id = ? WHERE id_item = ?`, [SO_CATEGORIA[String(i.sku)], i.id_item]);
    linhas.push(`  só categoria: ${String(i.sku).padEnd(16)} → cat ${SO_CATEGORIA[String(i.sku)]} · ${i.nome}`);
  }
  const original = { getConnection: pool.getConnection };
  (pool as any).getConnection = async () => Object.assign(Object.create(conn), { beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined });
  try {
    for (const f of FAMILIAS) {
      const lista = alvo.filter(i => ITENS[String(i.sku)]?.[0] === f.chave);
      if (!lista.length) continue;
      await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ? WHERE id_item IN (${lista.map(() => '?').join(',')})`, [idFamilia[f.chave], f.cat, ...lista.map(i => i.id_item)]);
      const corpo = lista.map(i => {
        const [, valores, marca] = ITENS[String(i.sku)];
        const atributos: Record<string, string> = marca ? { [CHAVE_MARCA]: marca } : {};
        if (f.cat === CAT.MANG_HID && idDiametro) atributos[String(idDiametro)] = DI_MM[valores.mang];
        for (const [k, v] of Object.entries(valores)) {
          if (opcoes[k]) {
            const label = opcoes[k].get(v);
            if (!label) throw new Error(`${i.sku}: ${nomeAttr[k]} sem a opção ${v}`);
            atributos[String(ids[k])] = label;
          } else atributos[String(ids[k])] = v;
        }
        return { idItem: String(i.id_item), atributos };
      });
      let status = 200; let dados: any;
      const res: any = { status: (s: number) => { status = s; return res; }, json: (d: any) => { dados = d; return res; } };
      await formalizarItensFamilia({ params: { idFamilia: String(idFamilia[f.chave]) }, query: { tenant_id: TENANT }, headers: {}, body: { itens: corpo } } as any, res);
      if (status >= 400) throw new Error(`${f.nome}: ${dados?.error}`);
      const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE familia_id = ?`, [idFamilia[f.chave]]);
      linhas.push(`\n  ${f.nome} (${lista.length})`);
      for (const d of depois) {
        const i = lista.find(x => x.id_item === d.id_item);
        linhas.push(`    ${String(i.sku).padEnd(15)} → ${String(d.sku_customizado).padEnd(22)} ${d.nome_comercial}   (antes: ${i.nome})`);
      }
    }
  } finally {
    Object.assign(pool as any, original);
  }
  for (const f of statusAntigas) {
    const n = Number((await q(conn, `SELECT COUNT(*) n FROM comercial_produtos_dados WHERE familia_id = ?`, [f.id]))[0].n);
    if (n === 0) { await conn.query(`UPDATE comercial_familias SET status = 'INATIVO' WHERE id = ?`, [f.id]); linhas.push(`  família antiga ${f.id} ficou vazia: inativa`); }
  }
  return { rel: linhas, backup: { criados, statusAntigas, diametroAntes, itens: alvo.map(i => ({ id_item: i.id_item, familia_id: i.familia_id, categoria_id: i.categoria_id,
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
      const ids = b.itens.map((i: any) => i.id_item);
      await conn.query(`DELETE FROM atributos_comercial_valores WHERE tipo_entidade = 'produto' AND id_entidade IN (${ids.join(',')})
        AND atributo_id IN (SELECT id FROM atributos_comercial WHERE codigo = 'terminal_mangueira' OR nome = 'Diâmetro Interno')
        AND id_entidade NOT IN (${(b.diametroAntes || []).join(',') || 0})`);
      for (const i of b.itens) await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, categoria_id = ?, sku_customizado = ?, nome_comercial = ?, id_marca = ? WHERE id_item = ?`,
        [i.familia_id, i.categoria_id, i.sku_customizado, i.nome_comercial, i.id_marca, i.id_item]);
      for (const f of b.statusAntigas) await conn.query(`UPDATE comercial_familias SET status = ? WHERE id = ?`, [f.status, f.id]);
      await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade IN (${c.familias.join(',')})`);
      await conn.query(`DELETE FROM comercial_familias WHERE id IN (${c.familias.join(',')})`);
      await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE atributo_id IN (${c.atributos.join(',')})`);
      await conn.query(`DELETE FROM atributos_comercial WHERE id IN (${c.atributos.join(',')})`);
      if (c.opcoes.length) await conn.query(`DELETE FROM atributos_comercial_opcoes WHERE id IN (${c.opcoes.join(',')})`);
      if (c.marcas.length) await conn.query(`DELETE FROM comercial_marcas WHERE id IN (${c.marcas.join(',')}) AND NOT EXISTS (SELECT 1 FROM comercial_produtos_dados p WHERE p.id_marca = comercial_marcas.id)`);
      await conn.commit();
      console.log('Revertido.');
    } else {
      const r = await migrar(conn);
      console.log(r.rel.join('\n'));
      if (modo === 'aplicar') {
        const destino = path.resolve(__dirname, '../../../backups', `quimicos-mangueiras-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
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
