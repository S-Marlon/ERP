// backend/src/modules/Catalogo/Atributos/atributosGlobais.controller.ts
import { Request, Response } from 'express';
import pool  from '../../Estoque/db.config'; // Conexão oficial via Pool de Clientes

/**
 * 🔍 LISTAR ATRIBUTOS GLOBAIS
 * GET /catalogo/atributos-globais
 */
export async function getAtributosGlobais(req: Request, res: Response): Promise<void> {
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1; 

    // 1. Busca os atributos comerciais ativos
    const [atributos]: any = await pool.query(
      'SELECT * FROM atributos_comercial WHERE tenant_id = ? AND ativo = 1 ORDER BY nome ASC',
      [Number(tenant_id)]
    );

    // 2. Busca todas as opções ativas do tenant
    const [opcoes]: any = await pool.query(
      'SELECT atributo_id, valor FROM atributos_comercial_opcoes WHERE tenant_id = ? AND ativo = 1 ORDER BY ordem ASC',
      [Number(tenant_id)]
    );

    // OTIMIZAÇÃO: Agrupa as opções por atributo_id em um Mapa na memória
    const opcoesAgrupadas: Record<string, string[]> = {};
    for (const opcao of opcoes) {
      if (!opcoesAgrupadas[opcao.atributo_id]) {
        opcoesAgrupadas[opcao.atributo_id] = [];
      }
      opcoesAgrupadas[opcao.atributo_id].push(opcao.valor);
    }

    // 3. Formata os dados de forma performática
    const escoposValidos = ['dna', 'grade', 'ficha'];

    const result = atributos.map((attr: any) => {
      // Busca direta no dicionário O(1)
      const listaValores = opcoesAgrupadas[attr.id] || [];
      const opcoesDoAtributo = listaValores.join(', ');

      const escopoTratado = escoposValidos.includes(attr.escopo_padrao) 
        ? attr.escopo_padrao 
        : 'ficha';

      return {
        id: String(attr.id),
        grupoId: attr.grupo_id ? String(attr.grupo_id) : '',
        nome: attr.nome,
        codigo: attr.codigo,
        tipo: attr.tipo,
        escopoPadrao: escopoTratado,
        unidadeId: attr.unidade_id ? String(attr.unidade_id) : undefined,
        sufixo: attr.sufixo || undefined,
        obrigatorioPadrao: attr.obrigatorio_padrao === 1,
        pesquisavel: attr.pesquisavel === 1,
        valoresSugeridos: opcoesDoAtributo || undefined
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
 * POST /catalogo/atributos-globais
 */
export async function createAtributoGlobal(req: Request, res: Response): Promise<void> {
  const connection = await pool.getConnection(); // Abre conexão dedicada para gerenciar a transação
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1;
    const { 
      grupoId, nome, codigo, tipo, escopoPadrao, 
      unidadeId, sufixo, obrigatorioPadrao, pesquisavel, valoresSugeridos 
    } = req.body;

    // Validação de Código Técnico Único
    const [codigoExiste]: any = await connection.query(
      'SELECT id FROM atributos_comercial WHERE tenant_id = ? AND codigo = ? LIMIT 1',
      [Number(tenant_id), codigo]
    );

    if (codigoExiste.length > 0) {
      res.status(400).json({ error: '❌ O Código Técnico informado já está em uso.' });
      return;
    }

    // Início da Transação Atômica
    await connection.beginTransaction();

    // Regra do sufixo: Se escolheu unidade_id global, o sufixo customizado vira null
    const sufixoFinal = unidadeId ? null : (sufixo || null);

    const [resultInsert]: any = await connection.query(
      `INSERT INTO atributos_comercial 
       (tenant_id, grupo_id, nome, codigo, tipo, escopo_padrao, unidade_id, sufixo, obrigatorio_padrao, pesquisavel, ativo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        Number(tenant_id), Number(grupoId), nome, codigo, tipo, 
        escopoPadrao || 'ficha', unidadeId ? Number(unidadeId) : null, 
        sufixoFinal, obrigatorioPadrao ? 1 : 0, pesquisavel ? 1 : 0
      ]
    );

    const idAtributo = resultInsert.insertId;

    // Se for tipo lista, insere as opções na tabela filha
    if (tipo === 'lista' && valoresSugeridos) {
      const itensLista = valoresSugeridos.split(',').map((v: string) => v.trim()).filter(Boolean);
      
      for (let idx = 0; idx < itensLista.length; idx++) {
        const valor = itensLista[idx];
        const codigoOpcao = valor.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        
        await connection.query(
          `INSERT INTO atributos_comercial_opcoes (tenant_id, atributo_id, valor, codigo, ordem, ativo) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          [Number(tenant_id), idAtributo, valor, codigoOpcao, idx + 1]
        );
      }
    }

    await connection.commit(); // Efetiva as alterações
    res.status(201).json({ message: 'Atributo criado com sucesso!' });
  } catch (error) {
    await connection.rollback(); // Cancela tudo em caso de falha
    console.error('❌ Erro ao criar atributo global:', error);
    res.status(500).json({ error: 'Erro ao salvar o novo atributo.' });
  } finally {
    connection.release(); // Libera a conexão de volta para o Pool
  }
}

/**
 * ✏️ ATUALIZAR ATRIBUTO GLOBAL
 * PUT /catalogo/atributos-globais/:idAtributo
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

    await connection.beginTransaction();

    const sufixoFinal = unidadeId ? null : (sufixo || null);

    // 1. Atualiza a tabela mestre
    await connection.query(
      `UPDATE atributos_comercial 
       SET grupo_id = ?, nome = ?, codigo = ?, tipo = ?, escopo_padrao = ?, 
           unidade_id = ?, sufixo = ?, obrigatorio_padrao = ?, pesquisavel = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        Number(grupoId), nome, codigo, tipo, escopoPadrao, 
        unidadeId ? Number(unidadeId) : null, sufixoFinal, 
        obrigatorioPadrao ? 1 : 0, pesquisavel ? 1 : 0, Number(idAtributo), Number(tenant_id)
      ]
    );

    // 2. Se for lista e os valores foram informados, limpa e reinsere
    if (tipo === 'lista' && valoresSugeridos !== undefined) {
      await connection.query('DELETE FROM atributos_comercial_opcoes WHERE atributo_id = ?', [Number(idAtributo)]);

      const itensLista = valoresSugeridos.split(',').map((v: string) => v.trim()).filter(Boolean);
      for (let idx = 0; idx < itensLista.length; idx++) {
        const valor = itensLista[idx];
        const codigoOpcao = valor.toUpperCase().replace(/[^A-Z0-9]/g, '_');

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
 * DELETE /catalogo/atributos-globais/:idAtributo
 */
export async function deleteAtributoGlobal(req: Request, res: Response): Promise<void> {
  try {
    const tenant_id = req.headers['x-tenant-id'] || 1;
    const { idAtributo } = req.params;

    // Valida Integridade Relacional (Impede exclusão se já houver ficha técnica preenchida)
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

    // Aplica o Soft Delete
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