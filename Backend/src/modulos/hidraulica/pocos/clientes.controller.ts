// Obras de poços › clientes de poço: cadastro próprio do módulo (modulo_hidraulica_pocos_clientes), separado do
// cadastro geral do ERP por enquanto (id_pessoa fica guardado para quando juntar).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra, validarCliente } from './obras';
import { responderErro } from './obras.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

const formatar = (r: any) => ({
  idCliente: Number(r.id_cliente), nome: r.nome, telefone: r.telefone || null, documento: r.documento || null, email: r.email || null,
  endereco: r.endereco || null, bairro: r.bairro || null, cidade: r.cidade || null, uf: r.uf || null, observacao: r.observacao || null,
  pocos: Number(r.pocos) || 0, pocosComGps: Number(r.pocos_gps) || 0, obras: Number(r.obras) || 0, obrasAbertas: Number(r.obras_abertas) || 0,
});
const SELECT = `SELECT c.*,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_pocos p WHERE p.id_proprietario = c.id_cliente) AS pocos,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_pocos p WHERE p.id_proprietario = c.id_cliente AND p.latitude IS NOT NULL) AS pocos_gps,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_cliente = c.id_cliente) AS obras,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_cliente = c.id_cliente AND o.situacao IN ('ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO')) AS obras_abertas
       FROM modulo_hidraulica_pocos_clientes c`;

const carregar = async (tenant: number, id: number) => {
  const [[c]]: any = await pool.execute(`${SELECT} WHERE c.id_cliente = ? AND c.tenant_id = ?`, [id, tenant]);
  if (!c) throw new ErroObra('Cliente não encontrado.', 404);
  return formatar(c);
};

// GET /clientes?busca= (nome, telefone, documento ou cidade)
export const listarClientes = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const where = ['c.tenant_id = ?', 'c.ativo = 1'];
    const params: any[] = [tenant];
    const busca = String(req.query.busca || '').trim();
    if (busca) {
      const digitos = busca.replace(/\D/g, '');
      where.push(`(c.nome LIKE ? OR c.cidade LIKE ?${digitos.length >= 3 ? ' OR c.telefone LIKE ? OR c.documento LIKE ?' : ''})`);
      params.push(`%${busca}%`, `%${busca}%`, ...(digitos.length >= 3 ? [`%${digitos}%`, `%${digitos}%`] : []));
    }
    const [rows]: any = await pool.execute(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY c.nome LIMIT 300`, params);
    return res.json(rows.map(formatar));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os clientes de poço.'); }
};

// GET /clientes/:id
export const detalheCliente = async (req: Request, res: Response) => {
  try { return res.json(await carregar(tenantDe(req), Number(req.params.id))); }
  catch (e) { return responderErro(res, e, 'Erro ao abrir o cliente.'); }
};

const CAMPOS = ['nome', 'telefone', 'documento', 'email', 'endereco', 'bairro', 'cidade', 'uf', 'observacao'] as const;

// POST /clientes (basta o nome; avisa quando o telefone já é de outro cliente)
export const criarCliente = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const c = validarCliente(req.body);
    if (c.telefone && !req.body?.confirmarRepetido) {
      const [[outro]]: any = await pool.execute(`SELECT nome FROM modulo_hidraulica_pocos_clientes WHERE tenant_id = ? AND telefone = ? AND ativo = 1 LIMIT 1`, [tenant, c.telefone]);
      if (outro) throw new ErroObra(`Este telefone já é de "${outro.nome}". Escolha esse cliente na lista ou mude o telefone.`, 409);
    }
    const [ins]: any = await pool.execute(
      `INSERT INTO modulo_hidraulica_pocos_clientes (tenant_id, ${CAMPOS.join(', ')}, operador) VALUES (?, ${CAMPOS.map(() => '?').join(', ')}, ?)`,
      [tenant, ...CAMPOS.map(k => c[k]), operadorDe(req)]
    );
    return res.status(201).json(await carregar(tenant, Number(ins.insertId)));
  } catch (e) { return responderErro(res, e, 'Erro ao cadastrar o cliente.'); }
};

// PUT /clientes/:id
export const salvarCliente = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const id = Number(req.params.id);
    await carregar(tenant, id);
    const c = validarCliente(req.body);
    await pool.execute(
      `UPDATE modulo_hidraulica_pocos_clientes SET ${CAMPOS.map(k => `${k} = ?`).join(', ')}, operador = ? WHERE id_cliente = ? AND tenant_id = ?`,
      [...CAMPOS.map(k => c[k]), operadorDe(req), id, tenant]
    );
    return res.json(await carregar(tenant, id));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o cliente.'); }
};
