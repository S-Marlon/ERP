// Obras de poços › clientes de poço: cadastro próprio do módulo (modulo_hidraulica_pocos_clientes), separado do
// cadastro geral do ERP por enquanto (id_pessoa fica guardado para quando juntar).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { operadorDe } from '../../../areas/vendas/caixa/caixa.controller';
import { ErroObra, validarCliente } from './obras';
import { responderErro } from './obras.controller';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);

const formatar = (r: any) => ({
  idCliente: Number(r.id_cliente), nome: r.nome, tipoPessoa: r.tipo_pessoa || 'PF', telefone: r.telefone || null, telefone2: r.telefone2 || null,
  documento: r.documento || null, rgIe: r.rg_ie || null, estadoCivil: r.estado_civil || null, profissao: r.profissao || null, email: r.email || null,
  endereco: r.endereco || null, bairro: r.bairro || null, cidade: r.cidade || null, uf: r.uf || null, cep: r.cep || null,
  representante: r.representante || null, representanteDocumento: r.representante_documento || null, observacao: r.observacao || null,
  aReceber: Number(r.a_receber) || 0, vencido: Number(r.vencido) || 0,
  pocos: Number(r.pocos) || 0, pocosComGps: Number(r.pocos_gps) || 0, obras: Number(r.obras) || 0, obrasAbertas: Number(r.obras_abertas) || 0,
});
const SELECT = `SELECT c.*,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_pocos p WHERE p.id_proprietario = c.id_cliente) AS pocos,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_pocos p WHERE p.id_proprietario = c.id_cliente AND p.latitude IS NOT NULL) AS pocos_gps,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_cliente = c.id_cliente) AS obras,
         (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras o WHERE o.id_cliente = c.id_cliente AND o.situacao IN ('ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO')) AS obras_abertas,
         (SELECT COALESCE(SUM(p.valor - p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = p.id_obra
           WHERE o.id_cliente = c.id_cliente AND o.situacao NOT IN ('ORCAMENTO', 'CANCELADA') AND p.status = 'ABERTO') AS a_receber,
         (SELECT COALESCE(SUM(p.valor - p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p JOIN modulo_hidraulica_pocos_obras o ON o.id_obra = p.id_obra
           WHERE o.id_cliente = c.id_cliente AND o.situacao NOT IN ('ORCAMENTO', 'CANCELADA') AND p.status = 'ABERTO' AND p.vencimento < CURDATE()) AS vencido
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
      where.push(`(c.nome LIKE ? OR c.cidade LIKE ? OR c.representante LIKE ?${digitos.length >= 3 ? ' OR c.telefone LIKE ? OR c.telefone2 LIKE ? OR c.documento LIKE ?' : ''})`);
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, ...(digitos.length >= 3 ? [`%${digitos}%`, `%${digitos}%`, `%${digitos}%`] : []));
    }
    const cidade = String(req.query.cidade || '').trim();
    if (cidade) { where.push('c.cidade = ?'); params.push(cidade); }
    const [rows]: any = await pool.execute(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY c.nome LIMIT 2000`, params);
    // filtro=ABERTA (obra em andamento) | VENCIDO (parcela vencida) | SEM_TELEFONE
    const filtro = String(req.query.filtro || '').toUpperCase();
    const lista = rows.map(formatar).filter((c: any) => filtro === 'ABERTA' ? c.obrasAbertas > 0 : filtro === 'VENCIDO' ? c.vencido > 0
      : filtro === 'SEM_TELEFONE' ? !c.telefone : true);
    return res.json(lista.slice(0, 500));
  } catch (e) { return responderErro(res, e, 'Erro ao listar os clientes de poço.'); }
};

// GET /clientes/:id
export const detalheCliente = async (req: Request, res: Response) => {
  try { return res.json(await carregar(tenantDe(req), Number(req.params.id))); }
  catch (e) { return responderErro(res, e, 'Erro ao abrir o cliente.'); }
};

/** Coluna no banco → campo validado. */
export const CAMPOS: [string, keyof ReturnType<typeof validarCliente>][] = [
  ['nome', 'nome'], ['tipo_pessoa', 'tipoPessoa'], ['telefone', 'telefone'], ['telefone2', 'telefone2'], ['documento', 'documento'], ['rg_ie', 'rgIe'],
  ['estado_civil', 'estadoCivil'], ['profissao', 'profissao'], ['email', 'email'], ['endereco', 'endereco'], ['bairro', 'bairro'], ['cidade', 'cidade'],
  ['uf', 'uf'], ['cep', 'cep'], ['representante', 'representante'], ['representante_documento', 'representanteDocumento'], ['observacao', 'observacao'],
];

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
      `INSERT INTO modulo_hidraulica_pocos_clientes (tenant_id, ${CAMPOS.map(x => x[0]).join(', ')}, operador) VALUES (?, ${CAMPOS.map(() => '?').join(', ')}, ?)`,
      [tenant, ...CAMPOS.map(x => c[x[1]]), operadorDe(req)]
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
      `UPDATE modulo_hidraulica_pocos_clientes SET ${CAMPOS.map(x => `${x[0]} = ?`).join(', ')}, operador = ? WHERE id_cliente = ? AND tenant_id = ?`,
      [...CAMPOS.map(x => c[x[1]]), operadorDe(req), id, tenant]
    );
    return res.json(await carregar(tenant, id));
  } catch (e) { return responderErro(res, e, 'Erro ao salvar o cliente.'); }
};
