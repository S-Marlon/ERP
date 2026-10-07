import { Request, Response } from 'express';
import db from '../../../infra/db';

// 1. Processar e salvar item do XML na Staging (usando importacoes_lotes e importacao_produtos_staging)
export const processarItemXML = async (req: Request, res: Response) => {
try {
const { 
tenant_id, 
lote_importacao_id, 
chave_acesso, 
numero_nf, 
cnpj_fornecedor, 
xml_conteudo,        // <-- NOVO: Recebe o XML bruto se enviado
dados_nota_fiscal,   // <-- NOVO: Objeto JSON opcional
cProd, 
xProd, 
ncm, 
cest,
uCom, 
quantidade, 
preco_custo_unitario 
} = req.body;

let activeLoteId = lote_importacao_id;
const tenant = tenant_id || 1;

// Cria ou recupera o lote de importação (Cabeçalho)
if (!activeLoteId) {
const [lotesExistentes]: any = await db.execute(
`SELECT id FROM importacoes_lotes WHERE chave_acesso = ? LIMIT 1`,
[chave_acesso]
);

if (lotesExistentes.length > 0) {
activeLoteId = lotesExistentes[0].id;
} else {
// ADAPTADO: Agora insere também o xml_conteudo (LONGTEXT) e dados_nota_fiscal (JSON) se fornecidos
const [result]: any = await db.execute(
`INSERT INTO importacoes_lotes 
(tenant_id, chave_acesso, numero_nf, cnpj_fornecedor, xml_conteudo, dados_nota_fiscal, status, created_at) 
VALUES (?, ?, ?, ?, ?, ?, 'RASCUNHO', NOW())`,
[
tenant, 
chave_acesso, 
numero_nf || null, 
cnpj_fornecedor || null, 
xml_conteudo || null, 
dados_nota_fiscal ? JSON.stringify(dados_nota_fiscal) : null
]
);
activeLoteId = result.insertId; 
}
}

// Insere o item bruto na staging respeitando os nomes reais das colunas da tabela
await db.execute(
`INSERT INTO importacao_produtos_staging 
(tenant_id, lote_importacao_id, codigo_fornecedor, nome_fornecedor, ncm_original, cest_original, unidade_original, quantidade, preco_custo_unitario, status, criado_em) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', NOW())`,
[
tenant, 
activeLoteId, 
cProd || null, 
xProd || null, 
ncm || null, 
cest || null, 
uCom || null, 
quantidade || 0, 
preco_custo_unitario || 0
]
);

return res.status(200).json({
success: true,
lote_importacao_id: activeLoteId,
message: 'Item processado e salvo na staging com sucesso!'
});

} catch (error: any) {
console.error("❌ Erro ao processar item do XML na staging:", error);
return res.status(500).json({
success: false,
error: error.message || 'Erro interno ao salvar item na staging.'
});
}
};

// 2. Buscar os dados do Lote e todos os itens da Staging
export const getLoteStaging = async (req: Request, res: Response): Promise<Response> => {
try {
const { loteId } = req.params;
const tenant_id = req.query.tenant_id || 1;

const [lotes]: any = await db.execute(
`SELECT * FROM importacoes_lotes WHERE id = ? AND tenant_id = ?`,
[loteId, tenant_id]
);

if (lotes.length === 0) {
return res.status(404).json({ error: 'Lote de importação não encontrado.' });
}

const [itens]: any = await db.execute(
`SELECT * FROM importacao_produtos_staging WHERE lote_importacao_id = ? AND tenant_id = ? ORDER BY id ASC`,
[loteId, tenant_id]
);

return res.status(200).json({
success: true,
lote: lotes[0],
itens,
total_itens: itens.length
});

} catch (error: any) {
console.error('Erro ao buscar dados do lote na staging:', error);
return res.status(500).json({ error: 'Erro ao carregar rascunho de staging.', details: error.message });
}
};

// 3. Atualizar o status de um item individual na staging
export const atualizarStatusItemStaging = async (req: Request, res: Response): Promise<Response> => {
try {
const { id } = req.params; 
const { status, motivo_alerta, preco_venda_sugerido, familia_id, categoria_id } = req.body;

const statusPermitidos = ['PENDENTE', 'ERRO_VALIDACAO', 'APROVADO', 'REJEITADO', 'IMPORTADO'];
if (status && !statusPermitidos.includes(status)) {
return res.status(400).json({ error: 'Status inválido.' });
}

await db.execute(
`UPDATE importacao_produtos_staging 
SET status = COALESCE(?, status),
motivo_alerta = COALESCE(?, motivo_alerta),
preco_venda_sugerido = COALESCE(?, preco_venda_sugerido),
familia_id = COALESCE(?, familia_id),
categoria_id = COALESCE(?, categoria_id),
analisado_em = NOW()
WHERE id = ?`,
[status || null, motivo_alerta || null, preco_venda_sugerido || null, familia_id || null, categoria_id || null, id]
);

return res.status(200).json({ success: true, message: 'Item de staging atualizado com sucesso.' });

} catch (error: any) {
console.error('Erro ao atualizar item da staging:', error);
return res.status(500).json({ error: 'Erro ao atualizar item.', details: error.message });
}
};


// Exemplo de controller otimizado para receber os itens em lote
export const sincronizarItensLoteXML = async (req: Request, res: Response) => {
  try {
    let { tenant_id, lote_importacao_id, chave_acesso, numero_nf, cnpj_fornecedor, xml_conteudo, dados_nota_fiscal, itens, frete_adicional, sincronizacao_completa } = req.body;
    const tenant = tenant_id || 1;

    if (!Array.isArray(itens)) {
      return res.status(400).json({ error: 'Lista de itens inválida.' });
    }

    // Carga completa do XML: o lote é sempre resolvido pela chave de acesso (nunca por um id que veio da tela)
    if (sincronizacao_completa) lote_importacao_id = null;

    // Se o lote_importacao_id não veio no body, tentamos descobrir ou criar pelo lote/chave
    if (!lote_importacao_id && chave_acesso) {
      const [loteExistente]: any = await db.execute(
        `SELECT id FROM importacoes_lotes WHERE chave_acesso = ? AND tenant_id = ? LIMIT 1`,
        [chave_acesso, tenant]
      );

      if (loteExistente.length > 0) {
        lote_importacao_id = loteExistente[0].id;
      } else {
        const [resultLote]: any = await db.execute(
          `INSERT INTO importacoes_lotes 
          (tenant_id, chave_acesso, numero_nf, cnpj_fornecedor, xml_conteudo, dados_nota_fiscal, status, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, 'RASCUNHO', NOW())`,
          [
            tenant, 
            chave_acesso, 
            numero_nf || null, 
            cnpj_fornecedor || null,
            xml_conteudo || null,
            dados_nota_fiscal ? JSON.stringify(dados_nota_fiscal) : null
          ]
        );
        lote_importacao_id = resultLote.insertId;
      }
    }

    if (!lote_importacao_id) {
      return res.status(400).json({ success: false, error: 'O ID do lote de importação não foi fornecido nem pôde ser gerado.' });
    }

    // Lote já aprovado ou descartado na tela de Staging não aceita mais alterações
    const [loteAtual]: any = await db.execute(
      `SELECT status FROM importacoes_lotes WHERE id = ? AND tenant_id = ?`,
      [lote_importacao_id, tenant]
    );
    if (['IMPORTADO', 'DESCARTADO'].includes(loteAtual[0]?.status)) {
      return res.status(409).json({ success: false, error: `Esta NF já está ${loteAtual[0].status} na Staging e não pode mais ser alterada.`, lote_importacao_id });
    }

    // Carga completa: atualiza o cabeçalho do lote (lotes antigos foram criados sem esses dados)
    if (sincronizacao_completa) {
      await db.execute(
        `UPDATE importacoes_lotes
         SET numero_nf = COALESCE(?, numero_nf),
             cnpj_fornecedor = COALESCE(?, cnpj_fornecedor),
             xml_conteudo = COALESCE(?, xml_conteudo),
             dados_nota_fiscal = COALESCE(?, dados_nota_fiscal)
         WHERE id = ? AND tenant_id = ?`,
        [numero_nf || null, cnpj_fornecedor || null, xml_conteudo || null,
         dados_nota_fiscal ? JSON.stringify(dados_nota_fiscal) : null, lote_importacao_id, tenant]
      );
    }

    const emitenteNome = dados_nota_fiscal?.emitente?.nome || null;
    if (emitenteNome) {
      await db.execute(
        `UPDATE importacoes_lotes SET razao_social_fornecedor = COALESCE(razao_social_fornecedor, ?) WHERE id = ? AND tenant_id = ?`,
        [emitenteNome, lote_importacao_id, tenant]
      );
    }
    if (frete_adicional) {
      await db.execute(
        `UPDATE importacoes_lotes SET frete_adicional = ?, frete_adicional_valor = ?, frete_adicional_metodo = ? WHERE id = ? AND tenant_id = ?`,
        [JSON.stringify(frete_adicional), Number(frete_adicional.valor) || 0, frete_adicional.metodo || null, lote_importacao_id, tenant]
      );
    }

    // 🧹 AUTOLIMPEZA: Remove qualquer duplicidade anterior gerada por bugs passados neste lote
    await db.execute(
      `DELETE s1 FROM importacao_produtos_staging s1
       INNER JOIN importacao_produtos_staging s2 
       ON s1.lote_importacao_id = s2.lote_importacao_id 
       AND s1.item_nfe_seq = s2.item_nfe_seq
       AND s1.id < s2.id
       WHERE s1.lote_importacao_id = ? AND s1.tenant_id = ?`,
      [lote_importacao_id, tenant]
    );

    // Processa os itens em loop assíncrono controlado
    for (const item of itens) {
      const { 
        nItem, cProd, cEan, xProd, ncm, cest, uCom, 
        quantidade, receivedQuantity, valorUnitario, 
        valorTotal, freightAdded, freightDistributed, ipi, icmsSt,
        produtoIdSistema, skuSistema, tipoEntrada,
        skuSugerido, nomeItemSugerido, mapeamento, tipoRecurso,
        difference, isConfirmed, gtinManual, destinos
      } = item;

      // Item vindo do ProductMappingModal: os campos de mapeamento passam a valer como enviados (inclusive null)
      const temMapeamento = mapeamento ? 1 : 0;

      // mapeamento_json = payload do modal (ou o já salvo) + tipo_recurso do item (PRODUTO, CONSUMO, ATIVO...)
      const montarMapeamentoJson = (salvo: string | null): string | null => {
        let base: Record<string, unknown> = {};
        if (mapeamento) {
          base = { ...mapeamento };
        } else if (salvo) {
          try { base = JSON.parse(salvo) || {}; } catch { base = {}; }
        }
        if (tipoRecurso) base.tipo_recurso = tipoRecurso;
        if (gtinManual) base.gtin_manual = gtinManual;
        // Depósitos de destino da linha (null/[] = padrão pelo tipo do item)
        if (destinos !== undefined) {
          if (Array.isArray(destinos) && destinos.length > 0) base.destinos = destinos;
          else delete base.destinos;
        }
        return Object.keys(base).length > 0 ? JSON.stringify(base) : null;
      };

      const sequenciaItem = String(nItem || '1');
      // Frete efetivamente embutido no custo do item (vFrete do XML ou rateio + frete adicional)
      const freteItem = freightAdded ?? freightDistributed ?? 0;
      const custoTotalFinalCalc = (quantidade || 0) * (valorUnitario || 0);

      // Verifica se o item já existe baseado estritamente na sequência da NF-e (item_nfe_seq)
      const [existente]: any = await db.execute(
        `SELECT id, mapeamento_json FROM importacao_produtos_staging 
         WHERE tenant_id = ? AND lote_importacao_id = ? AND item_nfe_seq = ? LIMIT 1`,
        [tenant, lote_importacao_id, sequenciaItem]
      );

      if (existente.length > 0) {
        // Atualiza o item existente sem criar novos registros
        await db.execute(
          `UPDATE importacao_produtos_staging 
           SET codigo_fornecedor = ?,
               nome_fornecedor = ?, 
               ncm_original = ?, 
               ean = ?,
               cest_original = ?, 
               unidade_original = ?, 
               quantidade = ?, 
               quantidade_recebida = COALESCE(?, quantidade_recebida),
               divergencia = COALESCE(?, divergencia),
               is_confirmed = COALESCE(?, is_confirmed),
               preco_custo_unitario = ?,
               valor_total_nfe = ?,
               frete_rateado = ?,
               ipi = ?,
               icms_st = ?,
               custo_unitario_final = ?,
               custo_total_final = ?,
               produto_id_sistema = IF(?, ?, COALESCE(?, produto_id_sistema)),
               sku_sistema = COALESCE(?, sku_sistema),
               tipo_entrada = COALESCE(?, tipo_entrada),
               sku_sugerido = IF(?, ?, sku_sugerido),
               nome_item_sugerido = IF(?, ?, nome_item_sugerido),
               mapeamento_json = ?
           WHERE id = ?`,
          [
            cProd || null,
            xProd || null,
            ncm || null,
            cEan || null,
            cest || null,
            uCom || null,
            quantidade || 0,
            receivedQuantity ?? null,
            difference ?? null,
            isConfirmed ?? null,
            valorUnitario || 0,
            valorTotal || 0,
            freteItem || 0,
            ipi || 0,
            icmsSt || 0,
            valorUnitario || 0,
            custoTotalFinalCalc || 0,
            temMapeamento, produtoIdSistema || null, produtoIdSistema || null,
            skuSistema || null,
            tipoEntrada || 'COMPRA_NORMAL',
            temMapeamento, skuSugerido || null,
            temMapeamento, nomeItemSugerido || null,
            montarMapeamentoJson(existente[0].mapeamento_json),
            existente[0].id
          ]
        );
      } else {
        // Insere apenas se realmente não existir
        await db.execute(
          `INSERT INTO importacao_produtos_staging 
          (tenant_id, lote_importacao_id, item_nfe_seq, codigo_fornecedor, nome_fornecedor, ncm_original, ean, cest_original, unidade_original, quantidade, quantidade_recebida, preco_custo_unitario, valor_total_nfe, frete_rateado, ipi, icms_st, custo_unitario_final, custo_total_final, produto_id_sistema, sku_sistema, tipo_entrada, sku_sugerido, nome_item_sugerido, mapeamento_json, status, criado_em) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', NOW())`,
          [
            tenant, 
            lote_importacao_id, 
            sequenciaItem,
            cProd || null, 
            xProd || null, 
            ncm || null, 
            cEan || null,
            cest || null, 
            uCom || null, 
            quantidade || 0, 
            receivedQuantity || quantidade || 0,
            valorUnitario || 0,
            valorTotal || 0,
            freteItem || 0,
            ipi || 0,
            icmsSt || 0,
            valorUnitario || 0,
            custoTotalFinalCalc || 0,
            produtoIdSistema || null,
            skuSistema || null,
            tipoEntrada || 'COMPRA_NORMAL',
            skuSugerido || null,
            nomeItemSugerido || null,
            montarMapeamentoJson(null)
          ]
        );
      }
    }

    // Carga completa: remove linhas órfãs (sequências que não existem no XML, ex.: lotes antigos sem item_nfe_seq)
    let removidos = 0;
    if (sincronizacao_completa && itens.length > 0) {
      const sequencias = itens.map((item: any) => String(item.nItem || '1'));
      const [resultado]: any = await db.execute(
        `DELETE FROM importacao_produtos_staging
         WHERE lote_importacao_id = ? AND tenant_id = ?
           AND item_nfe_seq NOT IN (${sequencias.map(() => '?').join(',')})`,
        [lote_importacao_id, tenant, ...sequencias]
      );
      removidos = resultado.affectedRows || 0;
    }

    return res.status(200).json({ success: true, message: 'Lote sincronizado com sucesso!', lote_importacao_id, removidos });
  } catch (error: any) {
    console.error("Erro na sincronização em lote:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const listarLotesStaging = async (req: Request, res: Response): Promise<Response> => {
try {
const tenant_id = req.query.tenant_id || 1;

const query = `
SELECT
l.id,
l.chave_acesso,
l.numero_nf,
l.cnpj_fornecedor,
l.status,
l.created_at,
COALESCE(NULLIF(l.razao_social_fornecedor, ''), JSON_UNQUOTE(JSON_EXTRACT(l.dados_nota_fiscal, '$.emitente.nome'))) AS emitente_nome,
CAST(JSON_UNQUOTE(JSON_EXTRACT(l.dados_nota_fiscal, '$.totais.icmsTot.vNF')) AS DECIMAL(15,2)) AS valor_total_nf,
COUNT(p.id) AS total_itens,
COALESCE(SUM(p.is_confirmed = 1), 0) AS total_conferidos,
COALESCE(SUM(p.produto_id_sistema IS NULL AND COALESCE(TRIM(p.sku_sugerido), '') = ''), 0) AS total_sem_vinculo,
COALESCE(SUM(ABS(COALESCE(p.quantidade_recebida, 0) - COALESCE(p.quantidade, 0)) > 0.0001), 0) AS total_divergencias
FROM importacoes_lotes l
LEFT JOIN importacao_produtos_staging p ON p.lote_importacao_id = l.id AND p.tenant_id = l.tenant_id
WHERE l.tenant_id = ?
GROUP BY l.id
ORDER BY l.created_at DESC
`;

const [rows]: any = await db.execute(query, [tenant_id]);

const lotesFormatados = rows.map((lote: any) => {
const totalItens = Number(lote.total_itens);
const conferidos = Number(lote.total_conferidos);
const semVinculo = Number(lote.total_sem_vinculo);
// Indicativo para a lista; a validação completa é o pente-fino (/lotes/:id/analise)
const pronto = lote.status === 'RASCUNHO' && totalItens > 0 && conferidos === totalItens && semVinculo === 0;
return {
id: lote.id,
chaveAcesso: lote.chave_acesso,
numeroNf: lote.numero_nf,
emitenteNome: lote.emitente_nome || 'Fornecedor não identificado',
cnpjEmitente: lote.cnpj_fornecedor,
valorTotalNf: Number(lote.valor_total_nf) || 0,
totalItens,
totalConferidos: conferidos,
totalSemVinculo: semVinculo,
totalDivergencias: Number(lote.total_divergencias),
status: pronto ? 'PRONTO_PARA_APROVACAO' : lote.status,
dataCriacao: lote.created_at,
erroMensagem: null
};
});

return res.json({
success: true,
lotes: lotesFormatados
});

} catch (error: unknown) {
const err = error as Error;
console.error("Erro ao buscar lotes:", err);
return res.status(500).json({ success: false, error: err.message });
}
};

// Listar todos os itens de staging de um lote específico
export const listarItensDoLoteStaging = async (req: Request, res: Response): Promise<Response> => {
try {
const { loteId } = req.params;
const tenant_id = req.query.tenant_id || 1;

const query = `
SELECT *
FROM importacao_produtos_staging
WHERE lote_importacao_id = ? AND tenant_id = ?
ORDER BY CAST(item_nfe_seq AS UNSIGNED), id
`;

const [itens]: any = await db.execute(query, [loteId, tenant_id]);

return res.status(200).json({
success: true,
total: itens.length,
itens
});

} catch (error: unknown) {
const err = error as Error;
console.error("Erro ao buscar itens do lote:", err);
return res.status(500).json({ success: false, error: err.message });
}
};



export const confirmarEstoqueLote = async (req: Request, res: Response): Promise<Response> => {
const connection: any = await db.getConnection(); // Obtém conexão para transação

try {
const {
lote_importacao_id,
tenant_id,
chave_acesso,
resumo_conferencia,
frete_adicional,
itens
} = req.body;

const tenant = tenant_id || 1;

if (!lote_importacao_id) {
return res.status(400).json({ success: false, error: 'ID do lote de importação não informado.' });
}

// Inicia a transação
await connection.beginTransaction();

// 1. Atualiza o cabeçalho do lote para FINALIZADO e salva os JSONs de resumo e frete final
await connection.execute(
`UPDATE importacoes_lotes 
SET status = 'FINALIZADO', 
    resumo_conferencia = ?,
    frete_adicional = ?,
    updated_at = NOW()
WHERE id = ? AND tenant_id = ?`,
[
  resumo_conferencia ? JSON.stringify(resumo_conferencia) : null,
  frete_adicional ? JSON.stringify(frete_adicional) : null,
  lote_importacao_id, 
  tenant
]
);

// 2. Processa cada item enviado na conferência e mapeamento
for (const item of itens) {
const {
item_nfe_seq,
produto_id_sistema,
sku_sistema,
tipo_entrada,
conferencia_fisica,
custos_fiscais_e_rateio
} = item;

// Atualiza o item correspondente na staging
await connection.execute(
`UPDATE importacao_produtos_staging 
SET sku_sugerido = COALESCE(?, sku_sugerido),
status = 'IMPORTADO',
quantidade = COALESCE(?, quantidade),
preco_custo_unitario = COALESCE(?, preco_custo_unitario),
analisado_em = NOW()
WHERE lote_importacao_id = ? AND tenant_id = ? AND (id = ? OR codigo_fornecedor = ?)`,
[
sku_sistema || null,
conferencia_fisica?.quantidade_recebida ?? null,
custos_fiscais_e_rateio?.custo_unitario_final ?? null,
lote_importacao_id,
tenant,
item_nfe_seq || null,
item.codigo_fornecedor || null
]
);

// 3. EFETIVAÇÃO NO ESTOQUE OFICIAL DO ERP
if (produto_id_sistema && conferencia_fisica?.quantidade_recebida > 0) {

await connection.execute(
`UPDATE produtos 
SET saldo_atual = COALESCE(saldo_atual, 0) + ?,
preco_custo = COALESCE(?, preco_custo),
updated_at = NOW()
WHERE id = ? AND tenant_id = ?`,
[
conferencia_fisica.quantidade_recebida,
custos_fiscais_e_rateio?.custo_unitario_final || 0,
produto_id_sistema,
tenant
]
);

await connection.execute(
`INSERT INTO estoque_movimentos (tenant_id, produto_id, tipo_movimento, quantidade, custo_unitario, documento_origem, criado_em)
VALUES (?, ?, 'ENTRADA_NOTA_FISCAL', ?, ?, ?, NOW())`,
[
tenant,
produto_id_sistema,
conferencia_fisica.quantidade_recebida,
custos_fiscais_e_rateio?.custo_unitario_final || 0,
`NF-${chave_acesso || lote_importacao_id}`
]
);
}
}

// Confirma todas as operações no banco
await connection.commit();
connection.release();

return res.status(200).json({
success: true,
message: 'Entrada de estoque e fechamento do lote realizados com sucesso!',
lote_id: lote_importacao_id
});

} catch (error: any) {
if (connection) {
await connection.rollback();
connection.release();
}

console.error("❌ Erro ao confirmar estoque do lote:", error);
return res.status(500).json({
success: false,
error: error.message || 'Erro interno ao finalizar entrada de estoque.'
});
}
};