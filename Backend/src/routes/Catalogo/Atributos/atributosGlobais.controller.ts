// backend/src/modules/Catalogo/Atributos/atributosGlobais.controller.ts
import { Request, Response } from 'express';
import pool from '../../Estoque/db.config';

/**
 * Helper para buscar o símbolo de uma unidade e usá-lo como sufixo padrão
 */
async function obterSufixoPorUnidade(connection: any, unidadeId: number | null): Promise<string | null> {
  if (!unidadeId) return null;
  const [unidade]: any = await connection.query(
    'SELECT simbolo FROM atributos_comercial_unidades WHERE id = ? LIMIT 1',
    [unidadeId]
  );
  return unidade.length > 0 ? unidade[0].simbolo : null;
}

/**
 * 🔍 LISTAR ATRIBUTOS GLOBAIS
 */
export async function getAtributosGlobais(req: Request, res: Response): Promise<void> {
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1; 

    const [atributos]: any = await pool.query(
      'SELECT * FROM atributos_comercial WHERE tenant_id = ? AND ativo = 1 ORDER BY nome ASC',
      [Number(tenant_id)]
    );

    const [opcoes]: any = await pool.query(
      'SELECT atributo_id, valor FROM atributos_comercial_opcoes WHERE tenant_id = ? AND ativo = 1 ORDER BY ordem ASC',
      [Number(tenant_id)]
    );

    const opcoesAgrupadas: Record<string, string[]> = {};
    for (const opcao of opcoes) {
      if (!opcoesAgrupadas[opcao.atributo_id]) {
        opcoesAgrupadas[opcao.atributo_id] = [];
      }
      opcoesAgrupadas[opcao.atributo_id].push(opcao.valor);
    }

    const escoposValidos = ['dna', 'grade', 'ficha'];

    const result = atributos.map((attr: any) => {
      const listaValores = opcoesAgrupadas[attr.id] || [];
      const opcoesDoAtributo = listaValores.join(', ');
      const escopoTratado = escoposValidos.includes(attr.escopo_padrao) ? attr.escopo_padrao : 'ficha';

      return {
        id: String(attr.id),
        grupo_id: attr.grupo_id ? Number(attr.grupo_id) : undefined,
        nome: attr.nome,
        codigo: attr.codigo,
        tipo: attr.tipo,
        escopoPadrao: escopoTratado,
        unidade_id: attr.unidade_id ? Number(attr.unidade_id) : undefined,
        sufixo: attr.sufixo || undefined,
        obrigatorioPadrao: attr.obrigatorio_padrao === 1,
        pesquisavel: attr.pesquisavel === 1,
        valores_sugeridos: opcoesDoAtributo || undefined
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Erro ao listar atributos globais:', error);
    res.status(500).json({ error: 'Erro interno ao processar listagem de atributos.' });
  }
}

/**
 * ➕ CRIAR ATRIBUTO GLOBAL
 */
export async function createAtributoGlobal(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection();
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1;
    const { 
      grupoId, nome, codigo, tipo, escopoPadrao, 
      unidadeId, sufixo, obrigatorioPadrao, pesquisavel, valoresSugeridos 
    } = req.body;

    const [codigoExiste]: any = await connection.query(
      'SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1 LIMIT 1',
      [Number(tenant_id), codigo]
    );

    if (codigoExiste.length > 0) {
      res.status(400).json({ error: '❌ O Código Técnico informado já está em uso.' });
      return;
    }

    await connection.beginTransaction();

    const grupoIdFinal = grupoId && !isNaN(Number(grupoId)) ? Number(grupoId) : null;
    const unidadeIdFinal = unidadeId && !isNaN(Number(unidadeId)) ? Number(unidadeId) : null;
    
    // 🔥 Correção: Se tem unidadeId, busca o símbolo dela para salvar de forma consistente no banco!
    const sufixoFinal = unidadeIdFinal 
      ? await obterSufixoPorUnidade(connection, unidadeIdFinal) 
      : (sufixo || null);

    const [resultInsert]: any = await connection.query(
      `INSERT INTO atributos_comercial 
       (tenant_id, grupo_id, nome, codigo, tipo, escopo_padrao, unidade_id, sufixo, obrigatorio_padrao, pesquisavel, ativo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        Number(tenant_id), grupoIdFinal, nome, codigo, tipo, 
        escopoPadrao || 'ficha', unidadeIdFinal, 
        sufixoFinal, obrigatorioPadrao ? 1 : 0, pesquisavel ? 1 : 0
      ]
    );

    const idAtributo = resultInsert.insertId;

    if (tipo === 'lista' && valoresSugeridos) {
      const itensLista = valoresSugeridos.split(',').map((v: string) => v.trim()).filter(Boolean);
      
      for (let idx = 0; idx < itensLista.length; idx++) {
        const valor = itensLista[idx];
        let codigoOpcao = valor.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        
        // Evita colisão de códigos gerados para a mesma lista de opções
        if (codigoOpcao === '_') codigoOpcao = `OPC_${idx + 1}`;

        await connection.query(
          `INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [Number(tenant_id), idAtributo, valor, codigoOpcao, idx + 1]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ success: true, id: String(idAtributo), message: 'Atributo criado com sucesso!' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Erro ao criar atributo global:', error);
    res.status(500).json({ error: 'Erro ao salvar o novo atributo.' });
  } finally {
    connection.release();
  }
}

/**
 * ✏️ ATUALIZAR ATRIBUTO GLOBAL
 */
export async function updateAtributoGlobal(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection();
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1;
    const { idAtributo } = req.params;
    const { 
      grupoId, nome, codigo, tipo, escopoPadrao, 
      unidadeId, sufixo, obrigatorioPadrao, pesquisavel, valoresSugeridos 
    } = req.body;

    // 🔥 Proteção de Integridade: Se o atributo já está sendo usado por produtos, 
    // precisamos ter extremo cuidado ao remover as opções existentes.
    if (tipo === 'lista' && valoresSugeridos !== undefined) {
      const [emUso]: any = await connection.query(
        'SELECT id FROM atributos_comercial_valores WHERE atributo_id = ? AND tenant_id = ? LIMIT 1',
        [Number(idAtributo), Number(tenant_id)]
      );

      if (emUso.length > 0) {
        res.status(400).json({ 
          error: '❌ Não é possível reestruturar a lista de opções deste atributo porque já existem produtos vinculados a essas opções.' 
        });
        return;
      }
    }

    await connection.beginTransaction();

    const grupoIdFinal = grupoId && !isNaN(Number(grupoId)) ? Number(grupoId) : null;
    const unidadeIdFinal = unidadeId && !isNaN(Number(unidadeId)) ? Number(unidadeId) : null;
    
    // 🔥 Correção consistente do sufixo
    const sufixoFinal = unidadeIdFinal 
      ? await obterSufixoPorUnidade(connection, unidadeIdFinal) 
      : (sufixo || null);

    await connection.query(
      `UPDATE atributos_comercial 
       SET grupo_id = ?, nome = ?, codigo = ?, tipo = ?, escopo_padrao = ?, 
           unidade_id = ?, sufixo = ?, obrigatorio_padrao = ?, pesquisavel = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        grupoIdFinal, nome, codigo, tipo, escopoPadrao, 
        unidadeIdFinal, sufixoFinal, 
        obrigatorioPadrao ? 1 : 0, pesquisavel ? 1 : 0, Number(idAtributo), Number(tenant_id)
      ]
    );

    if (tipo === 'lista' && valoresSugeridos !== undefined) {
      await connection.query('DELETE FROM atributos_comercial_opcoes WHERE atributo_id = ?', [Number(idAtributo)]);

      const itensLista = valoresSugeridos.split(',').map((v: string) => v.trim()).filter(Boolean);
      for (let idx = 0; idx < itensLista.length; idx++) {
        const valor = itensLista[idx];
        let codigoOpcao = valor.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        if (codigoOpcao === '_') codigoOpcao = `OPC_${idx + 1}`;

        await connection.query(
          `INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [Number(tenant_id), Number(idAtributo), valor, codigoOpcao, idx + 1]
        );
      }
    }

    await connection.commit();
    res.status(200).json({ message: 'Atributo atualizado com sucesso.' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Erro ao atualizar atributo global:', error);
    res.status(500).json({ error: 'Erro ao modificar as propriedades do atributo.' });
  } finally {
    connection.release();
  }
}

/**
 * 🗑️ EXCLUIR ATRIBUTO GLOBAL (SOFT DELETE)
 */
export async function deleteAtributoGlobal(req: Request, res: Response): Promise<void> {
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1;
    const { idAtributo } = req.params;

    const [possuiValores]: any = await pool.query(
      'SELECT id FROM atributos_comercial_valores WHERE atributo_id = ? AND tenant_id = ? LIMIT 1',
      [Number(idAtributo), Number(tenant_id)]
    );

    if (possuiValores.length > 0) {
      res.status(400).json({ 
        error: '❌ Restrição de Integridade: Este atributo já está preenchido em itens do catálogo e não pode ser deletado.' 
      });
      return;
    }

    await pool.query(
      'UPDATE atributos_comercial SET ativo = 0 WHERE id = ? AND tenant_id = ?',
      [Number(idAtributo), Number(tenant_id)]
    );

    res.status(200).json({ message: 'Atributo removido com sucesso.' });
  } catch (error) {
    console.error('❌ Erro ao deletar atributo global:', error);
    res.status(500).json({ error: 'Erro ao tentar remover o atributo.' });
  }
}

/**
 * ⚡ CADASTRO RÁPIDO DE ATRIBUTO GLOBAL CORE
 */
export async function createAtributoGlobalRapido(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection();
  try {
    const tenant_id = req.body.tenant_id || req.headers['x-tenant-id'] || 1;
    const { nome, tipo, grupo_id, unidade_id } = req.body;

    if (!nome || !tipo) {
      res.status(400).json({ error: '❌ Parâmetros obrigatórios ausentes: nome e tipo de dado.' });
      return;
    }

    let codigoGerado = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const [codigoExiste]: any = await connection.query(
      'SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? AND ativo = 1 LIMIT 1',
      [Number(tenant_id), codigoGerado]
    );

    if (codigoExiste.length > 0) {
      codigoGerado = `${codigoGerado}_${Date.now().toString().slice(-4)}`;
    }

    await connection.beginTransaction();

    const grupoIdFinal = grupo_id && !isNaN(Number(grupo_id)) ? Number(grupo_id) : null;
    const unidadeIdFinal = unidade_id && !isNaN(Number(unidade_id)) ? Number(unidade_id) : null;

    // 🔥 Busca do sufixo reescrita com o helper padronizado
    const sufixoFinal = await obterSufixoPorUnidade(connection, unidadeIdFinal);

    const [resultInsert]: any = await connection.query(
      `INSERT INTO atributos_comercial 
       (tenant_id, grupo_id, nome, codigo, tipo, escopo_padrao, unidade_id, sufixo, obrigatorio_padrao, pesquisavel, ativo) 
       VALUES (?, ?, ?, ?, ?, 'ficha', ?, ?, 0, 1, 1)`,
      [
        Number(tenant_id),
        grupoIdFinal,
        nome,
        codigoGerado,
        tipo,
        unidadeIdFinal,
        sufixoFinal
      ]
    );

    const idAtributo = resultInsert.insertId;

    await connection.commit();
    res.status(201).json({ success: true, id: String(idAtributo) });
  } catch (error: any) {
    await connection.rollback();
    console.error('❌ Erro no cadastro expresso de atributo:', error);
    res.status(500).json({ error: error.message || 'Erro ao processar criação rápida do atributo.' });
  } finally {
    connection.release();
  }
}