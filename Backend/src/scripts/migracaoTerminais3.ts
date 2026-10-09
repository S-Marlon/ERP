// Etapa 3 dos terminais: famílias de fêmea separadas por ângulo (reta, 45°, 90°), com tamanhos parecidos com os machos.
// Em cada família o ângulo vira DNA fixo (valor padrão da família): o SKU não muda (1{Ângulo:cod}...) e o ângulo vai
// para o nome da família.
//
//   npx ts-node src/scripts/migracaoTerminais3.ts simular | aplicar | reverter <backup>
import fs from 'fs';
import path from 'path';
import pool from '../infra/db';
import { formalizarItensFamilia } from '../areas/catalogo/familias/familias.controller';

const TENANT = 1;
// Família de fêmea com ângulo como grade → é separada
const FAMILIAS = [300, 302, 304, 307, 312, 315];
const SUFIXO: Record<string, string> = { RETO: 'RETA', '45°': '45°', '90°': '90°' };

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
  const idAng = Number((await q(conn, `SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = 'terminal_angulo' AND ativo = 1`, [TENANT]))[0]?.id);
  if (!idAng) throw new Error('Atributo Ângulo não encontrado.');
  const colunas = (await q(conn, `SHOW COLUMNS FROM comercial_familias`)).map(c => c.Field)
    .filter((c: string) => !['id', 'nome', 'criado_em', 'alterado_em'].includes(c));

  const familiasAntes = await q(conn, `SELECT id, nome, template_nome FROM comercial_familias WHERE id IN (${FAMILIAS.join(',')})`);
  const vinculosAntes = await q(conn, `SELECT id, escopo_comercial, valor_padrao_grupo FROM atributos_core_entidades
    WHERE tipo_entidade = 'familia' AND id_entidade IN (${FAMILIAS.join(',')}) AND atributo_id = ?`, [idAng]);
  const itensAntes = await q(conn, `SELECT id_item AS idItem, familia_id, sku_customizado, nome_comercial FROM comercial_produtos_dados
    WHERE tenant_id = ? AND familia_id IN (${FAMILIAS.join(',')})`, [TENANT]);
  const criadas: number[] = [];
  const rel: string[] = [];
  const restaurar = prenderPool(conn);

  try {
    for (const idFam of FAMILIAS) {
      const fam = familiasAntes.find(f => Number(f.id) === idFam);
      if (!fam) throw new Error(`Família ${idFam} não encontrada.`);
      // Itens com o ângulo de cada um (valor gravado)
      const itens = await q(conn, `SELECT p.id_item, p.sku_customizado AS sku, o.valor AS angulo
        FROM comercial_produtos_dados p
        LEFT JOIN atributos_comercial_valores v ON v.id_entidade = p.id_item AND v.tipo_entidade = 'produto' AND v.atributo_id = ?
        LEFT JOIN atributos_comercial_opcoes o ON o.id = v.opcao_id
        WHERE p.tenant_id = ? AND p.familia_id = ?`, [idAng, TENANT, idFam]);
      const semAngulo = itens.filter(i => !SUFIXO[i.angulo]);
      if (semAngulo.length) throw new Error(`Família ${fam.nome}: itens sem ângulo (${semAngulo.map(i => i.sku).join(', ')}).`);

      // O nome da família leva o ângulo; o modelo do nome deixa de repetir o ângulo
      const templateNome = String(fam.template_nome).replace(/\s*-\s*\{Ângulo\}/, '');
      const angulos = [...new Set(itens.map(i => String(i.angulo)))].sort((a, b) => (a === 'RETO' ? -1 : b === 'RETO' ? 1 : a.localeCompare(b)));
      for (const angulo of angulos) {
        const nome = `${fam.nome} ${SUFIXO[angulo]}`;
        let id = idFam;
        if (angulo === 'RETO') {
          await conn.query(`UPDATE comercial_familias SET nome = ?, template_nome = ? WHERE id = ?`, [nome, templateNome, idFam]);
        } else {
          const [r] = await conn.query(`INSERT INTO comercial_familias (nome, ${colunas.join(', ')}) SELECT ?, ${colunas.join(', ')} FROM comercial_familias WHERE id = ?`, [nome, idFam]);
          id = Number(r.insertId);
          criadas.push(id);
          // Mesmos atributos próprios da família de origem
          await conn.query(`INSERT INTO atributos_core_entidades (tenant_id, tipo_entidade, id_entidade, atributo_id, unidade_id, formato_sufixo, escopo_comercial,
              obrigatorio, pesquisavel, sobrescreve, exemplos, herdar, ordem, compoe_sku, gera_variacao, separador_sufixo, valor_padrao_grupo, bloqueado, retransmitir, ativo)
            SELECT tenant_id, tipo_entidade, ?, atributo_id, unidade_id, formato_sufixo, escopo_comercial, obrigatorio, pesquisavel, sobrescreve, exemplos, herdar, ordem,
              compoe_sku, gera_variacao, separador_sufixo, valor_padrao_grupo, bloqueado, retransmitir, ativo
            FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade = ?`, [id, idFam]);
        }
        // Ângulo: DNA fixo nesta família
        await conn.query(`UPDATE atributos_core_entidades SET escopo_comercial = 'dna', valor_padrao_grupo = ?, gera_variacao = 0
          WHERE tipo_entidade = 'familia' AND id_entidade = ? AND atributo_id = ?`, [angulo, id, idAng]);

        const doAngulo = itens.filter(i => i.angulo === angulo);
        const ids = doAngulo.map(i => i.id_item);
        if (id !== idFam) {
          await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ? WHERE tenant_id = ? AND id_item IN (${ids.map(() => '?').join(',')})`, [id, TENANT, ...ids]);
        }
        const r = await chamar(formalizarItensFamilia, { idFamilia: String(id) }, { itens: ids.map(i => ({ idItem: String(i), atributos: { [idAng]: angulo } })) });
        if (r.status >= 400) throw new Error(`Formalização de "${nome}": ${r.dados?.error || r.status}`);
        const depois = await q(conn, `SELECT id_item, sku_customizado, nome_comercial FROM comercial_produtos_dados WHERE id_item IN (${ids.map(() => '?').join(',')})`, ids);
        for (const i of doAngulo) {
          const d = depois.find(x => Number(x.id_item) === Number(i.id_item));
          if (!d || d.sku_customizado !== i.sku) throw new Error(`SKU mudaria: ${i.sku} → ${d?.sku_customizado}. Nada foi gravado.`);
        }
        rel.push(`  ${String(doAngulo.length).padStart(3)}  ${nome}${id === idFam ? '' : ' (nova)'}\n       ex.: ${depois[0].sku_customizado} · ${depois[0].nome_comercial}`);
      }
    }
  } finally {
    restaurar();
  }
  return { rel, backup: { criadas, familiasAntes, vinculosAntes, itensAntes } };
};

const reverter = async (conn: Conn, arquivo: string) => {
  const b = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  for (const i of b.itensAntes) {
    await conn.query(`UPDATE comercial_produtos_dados SET familia_id = ?, sku_customizado = ?, nome_comercial = ? WHERE tenant_id = ? AND id_item = ?`,
      [i.familia_id, i.sku_customizado, i.nome_comercial, TENANT, i.idItem]);
  }
  for (const f of b.familiasAntes) await conn.query(`UPDATE comercial_familias SET nome = ?, template_nome = ? WHERE id = ?`, [f.nome, f.template_nome, f.id]);
  for (const v of b.vinculosAntes) {
    await conn.query(`UPDATE atributos_core_entidades SET escopo_comercial = ?, valor_padrao_grupo = ?, gera_variacao = 1 WHERE id = ?`, [v.escopo_comercial, v.valor_padrao_grupo, v.id]);
  }
  if (b.criadas.length) {
    const restam = await q(conn, `SELECT COUNT(*) n FROM comercial_produtos_dados WHERE familia_id IN (${b.criadas.join(',')})`);
    if (Number(restam[0].n) > 0) throw new Error('Há itens novos nas famílias criadas: tire-os antes de reverter.');
    await conn.query(`DELETE FROM atributos_core_entidades WHERE tipo_entidade = 'familia' AND id_entidade IN (${b.criadas.join(',')})`);
    await conn.query(`DELETE FROM comercial_familias WHERE id IN (${b.criadas.join(',')})`);
  }
  return `Revertido: ${b.itensAntes.length} itens de volta às famílias com ângulo como grade.`;
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
      console.log(`Famílias por ângulo (itens · nome):\n${r.rel.join('\n')}`);
      if (modo === 'aplicar') {
        const pasta = path.resolve(__dirname, '../../../backups');
        fs.mkdirSync(pasta, { recursive: true });
        const destino = path.join(pasta, `terminais-etapa3-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
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
