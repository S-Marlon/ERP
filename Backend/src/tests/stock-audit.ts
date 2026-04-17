/**
 * Script de Auditoria de Estoque
 *
 * Realiza uma auditoria completa comparando ledger vs cache
 * para todos os produtos no sistema.
 */

import fetch from 'node-fetch';

interface AuditResult {
  total: number;
  ok: number;
  erro: number;
  driftMax: number;
  timestamp: string;
  detalhes: Array<{
    produto: number;
    saldoLedger: { quantidade: number; valorMedio: number };
    saldoCache: { quantidade: number; valorMedio: number };
    diferenca: { quantidade: number; valorMedio: number };
    erro?: string;
  }>;
}

async function auditarEstoque(apiUrl: string = 'http://localhost:3001'): Promise<void> {
  console.log('🔍 Iniciando auditoria de estoque...\n');

  try {
    // Chamar endpoint de auditoria
    const response = await fetch(`${apiUrl}/api/stock/audit-all`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const relatorio: AuditResult = await response.json() as AuditResult;

    // Processar e exibir resultados
    displayReport(relatorio);

    // Verificar se é seguro remover trigger
    const recomendação = validateConsistency(relatorio);
    displayRecommendation(recomendação);

  } catch (error) {
    console.error('❌ Erro ao realizar auditoria:', error);
    process.exit(1);
  }
}

function displayReport(relatorio: AuditResult): void {
  console.log('📊 RELATÓRIO DE AUDITORIA DE ESTOQUE\n');
  console.log(`Timestamp: ${relatorio.timestamp}`);
  console.log(`Total de produtos: ${relatorio.total}`);
  console.log(`✅ Consistentes: ${relatorio.ok}`);
  console.log(`❌ Com divergências: ${relatorio.erro}`);
  console.log(`📏 Drift máximo: ${relatorio.driftMax}\n`);

  // Taxa de sucesso
  const taxa = ((relatorio.ok / relatorio.total) * 100).toFixed(1);
  console.log(`Taxa de consistência: ${taxa}%\n`);

  // Mostrar produtos com divergências
  const comDivergencias = relatorio.detalhes.filter(
    (d) => d.diferenca && (d.diferenca.quantidade !== 0 || d.diferenca.valorMedio !== 0)
  );

  if (comDivergencias.length > 0) {
    console.log('🔴 PRODUTOS COM DIVERGÊNCIAS:\n');
    comDivergencias.forEach((produto) => {
      console.log(`  Produto ID: ${produto.produto}`);
      console.log(`    Ledger:   QTD=${produto.saldoLedger.quantidade.toFixed(4)}, VM=${produto.saldoLedger.valorMedio.toFixed(4)}`);
      console.log(`    Cache:    QTD=${produto.saldoCache.quantidade.toFixed(4)}, VM=${produto.saldoCache.valorMedio.toFixed(4)}`);
      console.log(`    Diferença: QTD=${produto.diferenca.quantidade.toFixed(4)}, VM=${produto.diferenca.valorMedio.toFixed(4)}\n`);
    });
  } else {
    console.log('✅ Nenhum produto com divergências detectado!\n');
  }
}

function validateConsistency(relatorio: AuditResult): string {
  const tolerancia = 0.0001;
  const consistente = relatorio.erro === 0 && relatorio.driftMax < tolerancia;

  if (consistente) {
    return '✅ SALDOS TOTALMENTE CONSISTENTES';
  } else if (relatorio.ok / relatorio.total > 0.95) {
    return '🟡 SALDOS PARCIALMENTE CONSISTENTES (>95%)';
  } else {
    return '❌ SALDOS COM DIVERGÊNCIAS SIGNIFICATIVAS';
  }
}

function displayRecommendation(validacao: string): void {
  console.log('🎯 RECOMENDAÇÃO:\n');

  if (validacao === '✅ SALDOS TOTALMENTE CONSISTENTES') {
    console.log(`${validacao}\n`);
    console.log('✨ RECOMENDAÇÃO FINAL: É SEGURO REMOVER A TRIGGER\n');
    console.log('Próximos passos:');
    console.log('1. Fazer backup completo do banco de dados');
    console.log('2. Criar um script de migração que:');
    console.log('   a) Desabilita a trigger de estoque_saldos');
    console.log('   b) Cria uma view para estoque_saldos baseada no ledger');
    console.log('   c) Atualiza todas as queries para usar o ledger');
    console.log('3. Monitorar por 7 dias para detectar problemas');
    console.log('4. Se tudo OK, remover trigger permanentemente');
  } else if (validacao === '🟡 SALDOS PARCIALMENTE CONSISTENTES (>95%)') {
    console.log(`${validacao}\n`);
    console.log('⚠️  RECOMENDAÇÃO: INVESTIGAR DIVERGÊNCIAS ANTES DE REMOVER TRIGGER\n');
    console.log('Próximos passos:');
    console.log('1. Analisar os produtos com divergências');
    console.log('2. Verificar se há movimentações não processadas');
    console.log('3. Executar reprocessamento de movimentações suspeitas');
    console.log('4. Reexecutar esta auditoria após correções');
  } else {
    console.log(`${validacao}\n`);
    console.log('🛑 RECOMENDAÇÃO: NÃO REMOVER TRIGGER POR ENQUANTO\n');
    console.log('Próximos passos:');
    console.log('1. Analisar logs do ledger para divergências');
    console.log('2. Verificar se há registros com event_id duplicado');
    console.log('3. Executar limpeza de dados duplicados se necessário');
    console.log('4. Validar integridade referencial entre tabelas');
    console.log('5. Reexecutar esta auditoria');
  }

  console.log('\n');
}

// Executar auditoria
if (require.main === module) {
  const apiUrl = process.argv[2] || 'http://localhost:3001';
  console.log(`Conectando a: ${apiUrl}\n`);

  auditarEstoque(apiUrl)
    .then(() => {
      console.log('✅ Auditoria finalizada com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

export { auditarEstoque, AuditResult };