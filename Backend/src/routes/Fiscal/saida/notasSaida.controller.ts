// Notas fiscais de saída das vendas: configuração da empresa/emissão, fila do dia (aprovar e emitir,
// dispensar, reabrir), cancelamento e envio ao cliente. Quem emite é o EmissorFiscal configurado.
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';
import { operadorDe } from '../../Venda/caixa/caixa.controller';
import { criarEmissor, PROVEDORES_DISPONIVEIS, segredosConfigurados } from './emissores';
import {
  CONFIG_PADRAO, ConfigFiscal, Destinatario, Emitente, ErroFiscal, ItemVendaFiscal, Modelo, modeloSugerido, montarNota,
  pendenciasDaNota, somenteDigitos,
} from './notaSaida';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const f4 = (v: number) => Number(v || 0).toFixed(4);
const AMBIENTES = ['HOMOLOGACAO', 'PRODUCAO'];
const EMISSORES = ['PROVEDOR', 'DIRETO'];
const MODOS = ['FILA', 'AUTOMATICA'];
// Consulta pública da NFC-e em SP (vai na mensagem ao cliente quando o emissor não devolve o link do DANFE)
const CONSULTA_NFCE: Record<string, string> = { SP: 'https://www.nfce.fazenda.sp.gov.br/consulta' };

const responderErro = (res: Response, error: any, padrao: string) => {
  if (error instanceof ErroFiscal) return res.status(error.status).json({ error: error.message });
  console.error(padrao, error);
  return res.status(500).json({ error: padrao, details: error?.message });
};

// ---------- carga ----------

const paraEmitente = (e: any): Emitente | null => (!e ? null : {
  cnpj: e.cnpj, inscricaoEstadual: e.inscricao_estadual, razaoSocial: e.razao_social, nomeFantasia: e.nome_fantasia, crt: Number(e.crt),
  logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cep: e.cep, municipio: e.municipio,
  codigoMunicipioIbge: e.codigo_municipio_ibge, uf: e.uf, telefone: e.telefone, email: e.email,
});
const paraConfig = (c: any): ConfigFiscal => (!c ? { ...CONFIG_PADRAO } : {
  ambiente: c.ambiente, emissor: c.emissor, provedor: c.provedor, modoEmissao: c.modo_emissao,
  serieNfce: Number(c.serie_nfce), proximoNumeroNfce: Number(c.proximo_numero_nfce), serieNfe: Number(c.serie_nfe), proximoNumeroNfe: Number(c.proximo_numero_nfe),
  cscId: c.csc_id, csosnPadrao: c.csosn_padrao, cfopPadrao: c.cfop_padrao, csosnSt: c.csosn_st, cfopSt: c.cfop_st,
});

export const carregarConfiguracao = async (conn: any, tenant: number) => {
  const [[c]]: any = await conn.execute(`SELECT * FROM fiscal_configuracoes WHERE tenant_id = ?`, [tenant]);
  const [[e]]: any = await conn.execute(`SELECT * FROM fiscal_emitentes WHERE tenant_id = ?`, [tenant]);
  return { config: paraConfig(c), emitente: paraEmitente(e), configurado: Boolean(c) };
};

/** Itens das vendas com os dados fiscais do cadastro, agrupados por venda. */
const itensFiscais = async (conn: any, tenant: number, idsVenda: number[]) => {
  const mapa = new Map<number, ItemVendaFiscal[]>();
  if (!idsVenda.length) return mapa;
  const [rows]: any = await conn.query(
    `SELECT vi.id_venda, vi.id_item, vi.sku_snapshot, vi.nome_snapshot, vi.unidade_sigla, vi.quantidade, vi.preco_tabela, vi.total_item,
            ic.tipo_recurso, fis.ncm, fis.cest, fis.origem_mercadoria, fis.csosn, fis.cfop_padrao
     FROM vendas_pedidos_itens vi
     INNER JOIN itens_core ic ON ic.id_item = vi.id_item
     LEFT JOIN itens_dados_fiscais fis ON fis.id_item = vi.id_item
     WHERE vi.tenant_id = ? AND vi.id_venda IN (?)
     ORDER BY vi.id_venda_item`,
    [tenant, idsVenda]
  );
  for (const r of rows) {
    const lista = mapa.get(Number(r.id_venda)) || [];
    lista.push({
      idItem: Number(r.id_item), codigo: r.sku_snapshot, descricao: r.nome_snapshot, unidade: r.unidade_sigla || 'UN',
      quantidade: Number(r.quantidade), precoTabela: Number(r.preco_tabela), totalItem: Number(r.total_item),
      servico: String(r.tipo_recurso).toUpperCase() === 'SERVICO',
      ncm: r.ncm, cest: r.cest, origem: r.origem_mercadoria === null || r.origem_mercadoria === undefined ? null : Number(r.origem_mercadoria),
      csosn: r.csosn, cfop: r.cfop_padrao,
    });
    mapa.set(Number(r.id_venda), lista);
  }
  return mapa;
};

/** Documento, nome e contato (e-mail, celular) dos clientes das vendas. */
const clientesDasVendas = async (conn: any, tenant: number, idsCliente: number[]) => {
  const mapa = new Map<number, Destinatario>();
  if (!idsCliente.length) return mapa;
  const [rows]: any = await conn.query(
    `SELECT c.id_pessoa, c.tipo_pessoa, pf.nome, pf.cpf, pj.razao_social, pj.nome_fantasia, pj.cnpj,
            (SELECT e.email FROM pessoas_emails e WHERE e.id_cliente = c.id_pessoa AND e.deleted_at IS NULL ORDER BY e.principal DESC LIMIT 1) AS email,
            (SELECT t.telefone FROM pessoas_contatos t WHERE t.id_cliente = c.id_pessoa AND t.deleted_at IS NULL ORDER BY t.whatsapp DESC, t.principal DESC LIMIT 1) AS celular
     FROM pessoas_core c
     LEFT JOIN pessoas_pf pf ON pf.id_cliente = c.id_pessoa
     LEFT JOIN pessoas_pj pj ON pj.id_cliente = c.id_pessoa
     WHERE c.tenant_id = ? AND c.id_pessoa IN (?)`,
    [tenant, idsCliente]
  );
  for (const r of rows) {
    const pj = r.tipo_pessoa === 'PJ';
    mapa.set(Number(r.id_pessoa), {
      documento: somenteDigitos(pj ? r.cnpj : r.cpf) || null,
      nome: pj ? (r.razao_social || r.nome_fantasia) : r.nome,
      email: r.email || null, celular: r.celular || null,
    });
  }
  return mapa;
};

const enderecoDoCliente = async (conn: any, idCliente: number) => {
  const [[e]]: any = await conn.execute(
    `SELECT logradouro, numero, bairro, cidade, estado, cep FROM pessoas_enderecos WHERE id_cliente = ? ORDER BY principal DESC LIMIT 1`,
    [idCliente]
  );
  return e && e.logradouro ? {
    logradouro: e.logradouro, numero: e.numero || 'S/N', bairro: e.bairro || '', municipio: e.cidade || '', uf: e.estado || '', cep: somenteDigitos(e.cep),
  } : null;
};

const registrarEvento = (conn: any, idDocumento: number, tipo: string, sucesso: boolean, mensagem: string | null, detalhe: unknown, operador: string) =>
  conn.execute(
    `INSERT INTO fiscal_documentos_eventos (id_documento, tipo, sucesso, mensagem, detalhe, operador) VALUES (?, ?, ?, ?, ?, ?)`,
    [idDocumento, tipo, sucesso ? 1 : 0, mensagem ? String(mensagem).slice(0, 500) : null, detalhe === undefined ? null : JSON.stringify(detalhe), operador]
  );

/** Última nota da venda que não foi cancelada. */
const documentoAtual = async (conn: any, tenant: number, idVenda: number, trava = false) => {
  const [[d]]: any = await conn.execute(
    `SELECT * FROM fiscal_documentos WHERE tenant_id = ? AND id_venda = ? AND status <> 'CANCELADA' ORDER BY id_documento DESC LIMIT 1 ${trava ? 'FOR UPDATE' : ''}`,
    [tenant, idVenda]
  );
  return d || null;
};

// ---------- configuração ----------

// GET /api/fiscal/configuracao
export const obterConfiguracao = async (req: Request, res: Response) => {
  try {
    const dados = await carregarConfiguracao(pool, tenantDe(req));
    return res.json({ ...dados, provedores: PROVEDORES_DISPONIVEIS, segredos: segredosConfigurados() });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a configuração fiscal.');
  }
};

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;

// PUT /api/fiscal/configuracao { emitente, configuracao }
export const salvarConfiguracao = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const e = req.body?.emitente || {};
  const c = { ...CONFIG_PADRAO, ...(req.body?.configuracao || {}) };
  try {
    if (!AMBIENTES.includes(c.ambiente)) throw new ErroFiscal('Ambiente inválido.');
    if (!EMISSORES.includes(c.emissor)) throw new ErroFiscal('Emissor inválido.');
    if (!MODOS.includes(c.modoEmissao)) throw new ErroFiscal('Modo de emissão inválido.');
    for (const [rotulo, v] of [['CSOSN padrão', c.csosnPadrao], ['CSOSN de ST', c.csosnSt]]) if (!/^\d{3}$/.test(String(v))) throw new ErroFiscal(`${rotulo} deve ter 3 dígitos.`);
    for (const [rotulo, v] of [['CFOP padrão', c.cfopPadrao], ['CFOP de ST', c.cfopSt]]) if (!/^5\d{3}$/.test(String(v))) throw new ErroFiscal(`${rotulo} deve ser de saída interna (5xxx).`);
    const inteiros = [c.serieNfce, c.proximoNumeroNfce, c.serieNfe, c.proximoNumeroNfe].map(Number);
    if (inteiros.some(n => !Number.isInteger(n) || n < 1)) throw new ErroFiscal('Séries e números devem ser inteiros a partir de 1.');

    // Não deixa voltar a numeração para um número já usado no mesmo ambiente/série
    const [usados]: any = await pool.execute(
      `SELECT modelo, serie, MAX(numero) AS ultimo FROM fiscal_documentos WHERE tenant_id = ? AND ambiente = ? AND numero IS NOT NULL GROUP BY modelo, serie`,
      [tenant, c.ambiente]
    );
    for (const u of usados) {
      const [serie, proximo, nome] = u.modelo === '65' ? [c.serieNfce, c.proximoNumeroNfce, 'NFC-e'] : [c.serieNfe, c.proximoNumeroNfe, 'NF-e'];
      if (Number(u.serie) === Number(serie) && Number(proximo) <= Number(u.ultimo)) {
        throw new ErroFiscal(`O próximo número da ${nome} (série ${serie}) deve ser maior que ${u.ultimo}, o último já usado.`);
      }
    }

    await pool.execute(
      `INSERT INTO fiscal_configuracoes (tenant_id, ambiente, emissor, provedor, modo_emissao, serie_nfce, proximo_numero_nfce, serie_nfe, proximo_numero_nfe,
                                         csc_id, csosn_padrao, cfop_padrao, csosn_st, cfop_st)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE ambiente = VALUES(ambiente), emissor = VALUES(emissor), provedor = VALUES(provedor), modo_emissao = VALUES(modo_emissao),
         serie_nfce = VALUES(serie_nfce), proximo_numero_nfce = VALUES(proximo_numero_nfce), serie_nfe = VALUES(serie_nfe),
         proximo_numero_nfe = VALUES(proximo_numero_nfe), csc_id = VALUES(csc_id), csosn_padrao = VALUES(csosn_padrao),
         cfop_padrao = VALUES(cfop_padrao), csosn_st = VALUES(csosn_st), cfop_st = VALUES(cfop_st)`,
      [tenant, c.ambiente, c.emissor, texto(c.provedor, 30)?.toUpperCase() ?? null, c.modoEmissao, ...inteiros.slice(0, 4), texto(c.cscId, 10),
        c.csosnPadrao, c.cfopPadrao, c.csosnSt, c.cfopSt]
    );

    const cnpj = somenteDigitos(e.cnpj);
    if (cnpj || e.razaoSocial) {
      if (cnpj.length !== 14) throw new ErroFiscal('CNPJ da empresa deve ter 14 dígitos.');
      if (!texto(e.razaoSocial, 120)) throw new ErroFiscal('Informe a razão social.');
      await pool.execute(
        `INSERT INTO fiscal_emitentes (tenant_id, cnpj, inscricao_estadual, razao_social, nome_fantasia, crt, logradouro, numero, complemento, bairro, cep,
                                       municipio, codigo_municipio_ibge, uf, telefone, email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE cnpj = VALUES(cnpj), inscricao_estadual = VALUES(inscricao_estadual), razao_social = VALUES(razao_social),
           nome_fantasia = VALUES(nome_fantasia), crt = VALUES(crt), logradouro = VALUES(logradouro), numero = VALUES(numero),
           complemento = VALUES(complemento), bairro = VALUES(bairro), cep = VALUES(cep), municipio = VALUES(municipio),
           codigo_municipio_ibge = VALUES(codigo_municipio_ibge), uf = VALUES(uf), telefone = VALUES(telefone), email = VALUES(email)`,
        [tenant, cnpj, somenteDigitos(e.inscricaoEstadual) || null, texto(e.razaoSocial, 120), texto(e.nomeFantasia, 60), Number(e.crt) || 4,
          texto(e.logradouro, 120), texto(e.numero, 20), texto(e.complemento, 60), texto(e.bairro, 60), somenteDigitos(e.cep).slice(0, 8) || null,
          texto(e.municipio, 60), somenteDigitos(e.codigoMunicipioIbge).slice(0, 7) || null, texto(e.uf, 2)?.toUpperCase() ?? null,
          texto(e.telefone, 20), texto(e.email, 120)]
      );
    }
    const dados = await carregarConfiguracao(pool, tenant);
    return res.json({ ...dados, provedores: PROVEDORES_DISPONIVEIS, segredos: segredosConfigurados() });
  } catch (error) {
    return responderErro(res, error, 'Erro ao salvar a configuração fiscal.');
  }
};

// ---------- fila ----------

// GET /api/fiscal/notas?data=AAAA-MM-DD (padrão: hoje)
export const listarNotas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  try {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.data || '')) ? String(req.query.data) : null;
    const { emitente, config, configurado } = await carregarConfiguracao(pool, tenant);
    const [vendas]: any = await pool.execute(
      `SELECT v.id_venda, v.status AS status_venda, v.created_at, v.cliente_nome, v.id_cliente, v.total_liquido, v.total_devolvido, v.operador,
              d.id_documento, d.modelo, d.status, d.serie, d.numero, d.chave, d.motivo_status, d.url_danfe, d.url_qrcode,
              d.destinatario_email, d.destinatario_celular, d.emitido_em, d.aprovado_por, d.ambiente
       FROM vendas_pedidos v
       LEFT JOIN fiscal_documentos d ON d.id_documento = (SELECT MAX(d2.id_documento) FROM fiscal_documentos d2 WHERE d2.id_venda = v.id_venda)
       WHERE v.tenant_id = ? AND DATE(v.created_at) = COALESCE(?, CURDATE())
         AND (v.status = 'CONCLUIDA' OR (v.status = 'CANCELADA' AND d.id_documento IS NOT NULL))
       ORDER BY v.id_venda`,
      [tenant, data]
    );
    const itens = await itensFiscais(pool, tenant, vendas.map((v: any) => Number(v.id_venda)));
    const clientes = await clientesDasVendas(pool, tenant, [...new Set<number>(vendas.filter((v: any) => v.id_cliente).map((v: any) => Number(v.id_cliente)))]);

    const lista = vendas.map((v: any) => {
      const itensVenda = itens.get(Number(v.id_venda)) || [];
      const cliente = v.id_cliente ? clientes.get(Number(v.id_cliente)) : undefined;
      const soServico = itensVenda.length > 0 && itensVenda.every(i => i.servico);
      const modelo: Modelo = v.modelo || modeloSugerido(cliente?.documento ?? null);
      const situacao = v.status || (soServico ? 'SEM_NOTA' : 'AGUARDANDO');
      // Endereço do cliente (NF-e) é conferido só na emissão, para a fila não consultar endereço de cada venda
      const pendencias = ['AGUARDANDO', 'REJEITADA'].includes(situacao)
        ? pendenciasDaNota(emitente, itensVenda, modelo, cliente ? { ...cliente, endereco: { logradouro: '-', numero: '-', bairro: '-', municipio: '-', uf: '-', cep: '-' } } : null)
        : [];
      return {
        idVenda: Number(v.id_venda), statusVenda: v.status_venda, criadoEm: v.created_at, operador: v.operador,
        cliente: cliente?.nome || v.cliente_nome, documentoCliente: cliente?.documento || null, idCliente: v.id_cliente ? Number(v.id_cliente) : null,
        total: Number(v.total_liquido), totalDevolvido: Number(v.total_devolvido) || 0,
        qtdItens: itensVenda.length, soServico, modelo, modeloSugerido: modeloSugerido(cliente?.documento ?? null), situacao, pendencias,
        email: v.destinatario_email || cliente?.email || null, celular: v.destinatario_celular || cliente?.celular || null,
        documento: v.id_documento ? {
          idDocumento: Number(v.id_documento), serie: v.serie, numero: v.numero, chave: v.chave, motivo: v.motivo_status,
          urlDanfe: v.url_danfe, urlQrcode: v.url_qrcode, emitidoEm: v.emitido_em, aprovadoPor: v.aprovado_por, ambiente: v.ambiente,
        } : null,
      };
    });
    const resumo: Record<string, number> = {};
    for (const n of lista) resumo[n.situacao] = (resumo[n.situacao] || 0) + 1;
    return res.json({
      notas: lista, resumo, configurado, ambiente: config.ambiente, modoEmissao: config.modoEmissao,
      emissor: config.emissor === 'DIRETO' ? 'DIRETO' : config.provedor, consultaUrl: CONSULTA_NFCE[String(emitente?.uf || '').toUpperCase()] || null,
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar as notas fiscais.');
  }
};

export interface ResultadoEmissao { idVenda: number; ok: boolean; status: string; mensagem: string; idDocumento?: number; numero?: number; chave?: string | null }

/** Aprova e emite a nota da venda (reserva o número, chama o emissor e grava o retorno). */
export const emitirVenda = async (
  tenant: number, idVenda: number, operador: string, opcoes: { modelo?: Modelo; email?: string | null; celular?: string | null } = {}
): Promise<ResultadoEmissao> => {
  const conn: any = await pool.getConnection();
  let emTransacao = false;
  try {
    const { emitente, config } = await carregarConfiguracao(conn, tenant);
    const [[venda]]: any = await conn.execute(`SELECT id_venda, status, id_cliente, cliente_nome, total_liquido FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]);
    if (!venda) throw new ErroFiscal('Venda não encontrada.', 404);
    if (venda.status !== 'CONCLUIDA') throw new ErroFiscal('Venda cancelada não emite nota.', 409);

    const itens = (await itensFiscais(conn, tenant, [idVenda])).get(idVenda) || [];
    const cliente = venda.id_cliente ? (await clientesDasVendas(conn, tenant, [Number(venda.id_cliente)])).get(Number(venda.id_cliente)) : undefined;
    const existente = await documentoAtual(conn, tenant, idVenda);
    const modelo: Modelo = opcoes.modelo || existente?.modelo || modeloSugerido(cliente?.documento ?? null);
    const destinatario: Destinatario | null = cliente || opcoes.email || opcoes.celular ? {
      documento: cliente?.documento ?? null, nome: cliente?.nome ?? (venda.cliente_nome !== 'CONSUMIDOR' ? venda.cliente_nome : null),
      email: opcoes.email ?? cliente?.email ?? null, celular: opcoes.celular ?? cliente?.celular ?? null,
      endereco: modelo === '55' && venda.id_cliente ? await enderecoDoCliente(conn, Number(venda.id_cliente)) : null,
    } : null;
    const pendencias = pendenciasDaNota(emitente, itens, modelo, destinatario);
    if (pendencias.length) throw new ErroFiscal(pendencias.join(' '), 422);
    const [pagamentos]: any = await conn.execute(`SELECT forma, valor, troco FROM vendas_pedidos_pagamentos WHERE id_venda = ? AND tenant_id = ?`, [idVenda, tenant]);
    const emissor = criarEmissor(config); // falha antes de reservar número se o emissor não estiver disponível
    const nomeEmissor = config.emissor === 'DIRETO' ? 'DIRETO' : String(config.provedor || '').toUpperCase();

    // Reserva o número com a configuração travada (duas emissões ao mesmo tempo não pegam o mesmo número)
    await conn.beginTransaction();
    emTransacao = true;
    await conn.execute(`INSERT IGNORE INTO fiscal_configuracoes (tenant_id) VALUES (?)`, [tenant]);
    const [[cfgTravada]]: any = await conn.execute(`SELECT * FROM fiscal_configuracoes WHERE tenant_id = ? FOR UPDATE`, [tenant]);
    const cfg = paraConfig(cfgTravada);
    const doc = await documentoAtual(conn, tenant, idVenda, true);
    if (doc?.status === 'AUTORIZADA') throw new ErroFiscal('A nota desta venda já está autorizada.', 409);
    if (doc?.status === 'PROCESSANDO' && Date.now() - new Date(doc.updated_at).getTime() < 120000) throw new ErroFiscal('A nota desta venda está sendo emitida.', 409);

    let serie: number;
    let numero: number;
    if (doc?.numero && doc.modelo === modelo && doc.ambiente === cfg.ambiente) {
      serie = Number(doc.serie); numero = Number(doc.numero); // reenvio após rejeição usa o mesmo número
    } else if (modelo === '65') {
      serie = cfg.serieNfce; numero = cfg.proximoNumeroNfce;
      await conn.execute(`UPDATE fiscal_configuracoes SET proximo_numero_nfce = proximo_numero_nfce + 1 WHERE tenant_id = ?`, [tenant]);
    } else {
      serie = cfg.serieNfe; numero = cfg.proximoNumeroNfe;
      await conn.execute(`UPDATE fiscal_configuracoes SET proximo_numero_nfe = proximo_numero_nfe + 1 WHERE tenant_id = ?`, [tenant]);
    }

    const valores = [modelo, cfg.ambiente, nomeEmissor, serie, numero, f4(venda.total_liquido), destinatario?.documento ?? null,
      destinatario?.nome?.slice(0, 120) ?? null, destinatario?.email?.slice(0, 120) ?? null, destinatario?.celular?.slice(0, 20) ?? null, operador];
    let idDocumento: number;
    if (doc) {
      idDocumento = Number(doc.id_documento);
      await conn.execute(
        `UPDATE fiscal_documentos SET modelo = ?, ambiente = ?, emissor = ?, serie = ?, numero = ?, valor_total = ?, destinatario_documento = ?,
           destinatario_nome = ?, destinatario_email = ?, destinatario_celular = ?, aprovado_por = ?, aprovado_em = NOW(), status = 'PROCESSANDO', motivo_status = NULL
         WHERE id_documento = ?`,
        [...valores, idDocumento]
      );
    } else {
      const [ins]: any = await conn.execute(
        `INSERT INTO fiscal_documentos (modelo, ambiente, emissor, serie, numero, valor_total, destinatario_documento, destinatario_nome,
           destinatario_email, destinatario_celular, aprovado_por, aprovado_em, status, tenant_id, id_venda)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'PROCESSANDO', ?, ?)`,
        [...valores, tenant, idVenda]
      );
      idDocumento = Number(ins.insertId);
    }
    await registrarEvento(conn, idDocumento, 'APROVACAO', true, `${modelo === '65' ? 'NFC-e' : 'NF-e'} ${serie}/${numero} aprovada para emissão`, undefined, operador);
    await conn.commit();
    emTransacao = false;

    // Emissão fora da transação (chamada externa pode demorar)
    const nota = montarNota({ modelo, config: cfg, emitente: emitente!, serie, numero, emissao: new Date(), itens, pagamentos: pagamentos.map((p: any) => ({ forma: p.forma, valor: Number(p.valor), troco: Number(p.troco) })), destinatario, idVenda });
    let ret;
    try {
      ret = await emissor.emitir(nota, `${tenant}-${idDocumento}`);
    } catch (e: any) {
      ret = { status: 'REJEITADA' as const, mensagem: `Falha ao emitir: ${e?.message || e}`, detalhe: { erro: String(e?.message || e) } };
    }
    await conn.execute(
      `UPDATE fiscal_documentos SET status = ?, motivo_status = ?, chave = COALESCE(?, chave), protocolo = COALESCE(?, protocolo),
         xml_autorizado = COALESCE(?, xml_autorizado), url_danfe = COALESCE(?, url_danfe), url_qrcode = COALESCE(?, url_qrcode),
         referencia_externa = COALESCE(?, referencia_externa), emitido_em = IF(? = 'AUTORIZADA', NOW(), emitido_em)
       WHERE id_documento = ?`,
      [ret.status, String(ret.mensagem || '').slice(0, 500), ret.chave ?? null, ret.protocolo ?? null, ret.xml ?? null, ret.urlDanfe ?? null,
        ret.urlQrcode ?? null, ret.referenciaExterna ?? null, ret.status, idDocumento]
    );
    await registrarEvento(conn, idDocumento, 'EMISSAO', ret.status === 'AUTORIZADA', ret.mensagem, { nota, retorno: ret.detalhe ?? null }, operador);
    return { idVenda, ok: ret.status === 'AUTORIZADA', status: ret.status, mensagem: ret.mensagem, idDocumento, numero, chave: ret.chave ?? null };
  } catch (error) {
    if (emTransacao) await conn.rollback().catch(() => undefined);
    throw error;
  } finally {
    conn.release();
  }
};

/** Modo automático: emite logo após a venda (chamado sem esperar; erro só vai para o log e a nota fica na fila). */
export const emitirAutomaticoSeConfigurado = async (tenant: number, idVenda: number, operador: string) => {
  try {
    const { config } = await carregarConfiguracao(pool, tenant);
    if (config.modoEmissao !== 'AUTOMATICA') return;
    await emitirVenda(tenant, idVenda, operador);
  } catch (error: any) {
    console.warn(`Emissão automática da venda ${idVenda} não concluída: ${error?.message || error}`);
  }
};

const idsDoCorpo = (req: Request) => [...new Set((Array.isArray(req.body?.vendas) ? req.body.vendas : []).map(Number).filter((n: number) => n > 0))] as number[];

// POST /api/fiscal/notas/emitir { vendas: [id], modelo?, email?, celular?, operador }
export const emitirNotas = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const ids = idsDoCorpo(req);
  if (!ids.length) return res.status(400).json({ error: 'Selecione ao menos uma venda.' });
  const modelo = ['65', '55'].includes(req.body?.modelo) ? req.body.modelo as Modelo : undefined;
  const resultados: ResultadoEmissao[] = [];
  // Uma por vez: a numeração é sequencial e o emissor pode limitar requisições
  for (const id of ids) {
    try {
      resultados.push(await emitirVenda(tenant, id, operadorDe(req), ids.length === 1 ? { modelo, email: texto(req.body?.email, 120), celular: texto(req.body?.celular, 20) } : { modelo }));
    } catch (error: any) {
      if (!(error instanceof ErroFiscal)) console.error(`Erro ao emitir a nota da venda ${id}:`, error);
      resultados.push({ idVenda: id, ok: false, status: 'ERRO', mensagem: error?.message || 'Erro ao emitir.' });
    }
  }
  return res.json({ resultados, autorizadas: resultados.filter(r => r.ok).length });
};

const mudarParaFila = async (req: Request, res: Response, destino: 'DISPENSADA' | 'AGUARDANDO') => {
  const tenant = tenantDe(req);
  const ids = idsDoCorpo(req);
  const motivo = String(req.body?.motivo || '').trim();
  if (!ids.length) return res.status(400).json({ error: 'Selecione ao menos uma venda.' });
  if (destino === 'DISPENSADA' && !motivo) return res.status(400).json({ error: 'Informe o motivo da dispensa.' });
  const resultados: Array<{ idVenda: number; ok: boolean; mensagem: string }> = [];
  for (const id of ids) {
    const conn: any = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[venda]]: any = await conn.execute(`SELECT id_venda, status, id_cliente, total_liquido FROM vendas_pedidos WHERE id_venda = ? AND tenant_id = ?`, [id, tenant]);
      if (!venda || venda.status !== 'CONCLUIDA') throw new ErroFiscal('Venda não encontrada ou cancelada.');
      const doc = await documentoAtual(conn, tenant, id, true);
      if (doc && ['AUTORIZADA', 'PROCESSANDO', 'DENEGADA'].includes(doc.status)) throw new ErroFiscal(`Nota ${String(doc.status).toLowerCase()}: não pode ${destino === 'DISPENSADA' ? 'ser dispensada' : 'voltar para a fila'}.`);
      if (destino === 'AGUARDANDO' && doc?.status !== 'DISPENSADA') throw new ErroFiscal('Só nota dispensada volta para a fila.');
      let idDocumento: number;
      if (doc) {
        idDocumento = Number(doc.id_documento);
        await conn.execute(`UPDATE fiscal_documentos SET status = ?, motivo_status = ? WHERE id_documento = ?`, [destino, destino === 'DISPENSADA' ? motivo.slice(0, 500) : null, idDocumento]);
      } else {
        const [ins]: any = await conn.execute(
          `INSERT INTO fiscal_documentos (tenant_id, id_venda, modelo, status, motivo_status, valor_total) VALUES (?, ?, '65', ?, ?, ?)`,
          [tenant, id, destino, motivo.slice(0, 500), f4(venda.total_liquido)]
        );
        idDocumento = Number(ins.insertId);
      }
      await registrarEvento(conn, idDocumento, destino === 'DISPENSADA' ? 'DISPENSA' : 'APROVACAO', true, destino === 'DISPENSADA' ? motivo : 'Voltou para a fila', undefined, operadorDe(req));
      await conn.commit();
      resultados.push({ idVenda: id, ok: true, mensagem: destino === 'DISPENSADA' ? 'Dispensada' : 'Na fila' });
    } catch (error: any) {
      await conn.rollback().catch(() => undefined);
      if (!(error instanceof ErroFiscal)) console.error('Erro ao alterar a nota na fila:', error);
      resultados.push({ idVenda: id, ok: false, mensagem: error?.message || 'Erro.' });
    } finally {
      conn.release();
    }
  }
  return res.json({ resultados });
};

// POST /api/fiscal/notas/dispensar { vendas: [id], motivo }
export const dispensarNotas = (req: Request, res: Response) => mudarParaFila(req, res, 'DISPENSADA');
// POST /api/fiscal/notas/reabrir { vendas: [id] }
export const reabrirNotas = (req: Request, res: Response) => mudarParaFila(req, res, 'AGUARDANDO');

const carregarDocumento = async (tenant: number, idDocumento: number) => {
  const [[doc]]: any = await pool.execute(`SELECT * FROM fiscal_documentos WHERE id_documento = ? AND tenant_id = ?`, [idDocumento, tenant]);
  if (!doc) throw new ErroFiscal('Nota não encontrada.', 404);
  return doc;
};
const emissorDoDocumento = async (tenant: number, doc: any) => {
  // Usa o emissor que autorizou a nota, mesmo que a configuração tenha mudado depois
  const { config } = await carregarConfiguracao(pool, tenant);
  return doc.emissor === 'DIRETO' ? criarEmissor({ ...config, emissor: 'DIRETO' }) : criarEmissor({ ...config, emissor: 'PROVEDOR', provedor: doc.emissor });
};
const paraDocumentoEmitido = (doc: any) => ({ referencia: `${doc.tenant_id}-${doc.id_documento}`, modelo: doc.modelo, chave: doc.chave, referenciaExterna: doc.referencia_externa });

// GET /api/fiscal/notas/:id
export const detalheNota = async (req: Request, res: Response) => {
  try {
    const doc = await carregarDocumento(tenantDe(req), Number(req.params.id));
    const [eventos]: any = await pool.execute(
      `SELECT id_evento, tipo, sucesso, mensagem, detalhe, operador, created_at FROM fiscal_documentos_eventos WHERE id_documento = ? ORDER BY id_evento`,
      [doc.id_documento]
    );
    const { xml_autorizado: xml, ...resto } = doc;
    return res.json({
      documento: { ...resto, temXml: Boolean(xml) },
      eventos: eventos.map((e: any) => ({
        idEvento: Number(e.id_evento), tipo: e.tipo, sucesso: Boolean(e.sucesso), mensagem: e.mensagem, operador: e.operador, criadoEm: e.created_at,
        detalhe: typeof e.detalhe === 'string' ? JSON.parse(e.detalhe) : e.detalhe,
      })),
    });
  } catch (error) {
    return responderErro(res, error, 'Erro ao carregar a nota.');
  }
};

// POST /api/fiscal/notas/:id/cancelar { motivo (mín. 15 caracteres, regra da SEFAZ) }
export const cancelarNota = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const motivo = String(req.body?.motivo || '').trim();
  try {
    if (motivo.length < 15) throw new ErroFiscal('A justificativa do cancelamento precisa de pelo menos 15 caracteres (regra da SEFAZ).');
    const doc = await carregarDocumento(tenant, Number(req.params.id));
    if (doc.status !== 'AUTORIZADA') throw new ErroFiscal('Só nota autorizada pode ser cancelada.', 409);
    const emissor = await emissorDoDocumento(tenant, doc);
    const r = await emissor.cancelar(paraDocumentoEmitido(doc), motivo);
    if (r.ok) {
      await pool.execute(`UPDATE fiscal_documentos SET status = 'CANCELADA', cancelado_em = NOW(), motivo_cancelamento = ? WHERE id_documento = ?`, [motivo.slice(0, 255), doc.id_documento]);
    }
    await registrarEvento(pool, Number(doc.id_documento), 'CANCELAMENTO', r.ok, r.mensagem, r.detalhe, operadorDe(req));
    if (!r.ok) throw new ErroFiscal(`Cancelamento recusado: ${r.mensagem}`, 422);
    return res.json({ success: true, mensagem: r.mensagem });
  } catch (error) {
    return responderErro(res, error, 'Erro ao cancelar a nota.');
  }
};

// POST /api/fiscal/notas/:id/envio { canal: EMAIL | WHATSAPP, destino }
// WhatsApp abre no computador do operador (link wa.me); e-mail vai pelo emissor quando ele oferece envio
export const registrarEnvio = async (req: Request, res: Response) => {
  const tenant = tenantDe(req);
  const canal = String(req.body?.canal || '').toUpperCase();
  const destino = String(req.body?.destino || '').trim();
  try {
    if (!['EMAIL', 'WHATSAPP'].includes(canal)) throw new ErroFiscal('Canal inválido.');
    if (canal === 'EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) throw new ErroFiscal('E-mail inválido.');
    if (canal === 'WHATSAPP' && somenteDigitos(destino).length < 10) throw new ErroFiscal('Celular inválido (com DDD).');
    const doc = await carregarDocumento(tenant, Number(req.params.id));
    if (doc.status !== 'AUTORIZADA') throw new ErroFiscal('Só nota autorizada pode ser enviada.', 409);

    let enviadoPeloEmissor = false;
    let mensagem = canal === 'WHATSAPP' ? 'Mensagem aberta no WhatsApp' : 'E-mail aberto no programa de e-mail';
    if (canal === 'EMAIL') {
      const emissor = await emissorDoDocumento(tenant, doc);
      if (emissor.enviarEmail) {
        const r = await emissor.enviarEmail(paraDocumentoEmitido(doc), [destino]);
        if (!r.ok) throw new ErroFiscal(`E-mail não enviado: ${r.mensagem}`, 422);
        enviadoPeloEmissor = true;
        mensagem = r.mensagem;
      }
    }
    await pool.execute(
      `UPDATE fiscal_documentos SET ${canal === 'EMAIL' ? 'destinatario_email' : 'destinatario_celular'} = ? WHERE id_documento = ?`,
      [destino.slice(0, canal === 'EMAIL' ? 120 : 20), doc.id_documento]
    );
    await registrarEvento(pool, Number(doc.id_documento), canal === 'EMAIL' ? 'ENVIO_EMAIL' : 'ENVIO_WHATSAPP', true, `${mensagem}: ${destino}`, undefined, operadorDe(req));
    return res.json({ success: true, enviadoPeloEmissor, mensagem });
  } catch (error) {
    return responderErro(res, error, 'Erro ao registrar o envio.');
  }
};
