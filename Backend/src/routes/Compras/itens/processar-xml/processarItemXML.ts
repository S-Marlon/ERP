import { Request, Response } from 'express';
import pool from '../../../Estoque/db.config'; // Ajuste o caminho do seu pool

export const processarItemXMLStaging = async (req: Request, res: Response) => {
  const { tenant_id, id_fornecedor, cProd, cEAN, xProd } = req.body;

  if (!tenant_id || !id_fornecedor || !cProd) {
    return res.status(400).json({ 
      success: false, 
      error: 'Parâmetros obrigatórios ausentes (tenant_id, id_fornecedor, cProd).' 
    });
  }

  const connection = await pool.getConnection();
  try {
    // 1. (Opcional) Aqui você pode fazer a regra de negócio de "baixo para cima":
    //    - Verificar se já existe vínculo em `comercial_fornecedores_produtos` (cProd do fornecedor).
    //    - Se não achar por cProd, tentar achar por cEAN na tabela de produtos do ERP.
    
    // 2. Insere os dados brutos na tabela temporária de Staging
    const queryStaging = `
      INSERT INTO importacao_produtos_staging (
        tenant_id, id_fornecedor, codigo_produto_fornecedor, ean, descricao_xml, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDENTE', NOW())
    `;
    
    const [result]: any = await connection.execute(queryStaging, [
      tenant_id,
      id_fornecedor,
      cProd,
      cEAN || null,
      xProd || null
    ]);

    return res.status(200).json({
      status: 'PRODUTO_INEDITO', // ou o status mapeado após sua consulta de vínculo
      message: 'Item inserido na staging com sucesso!',
      id_item: result.insertId,
      proximo_passo: 'Aguardando validação ou cruzamento de EAN',
      dados_sugeridos: {
        cProd,
        cEAN: cEAN || null,
        xProd: xProd || null
      }
    });

  } catch (error: any) {
    console.error('Erro ao processar item do XML na staging:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar item do XML.',
      details: error.message
    });
  } finally {
    connection.release();
  }
};