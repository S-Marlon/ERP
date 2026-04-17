/**
 * Script de Testes de Edge Cases para Movimentações de Estoque
 *
 * Valida comportamentos críticos do sistema de estoque baseado em ledger
 * para garantir consistência antes da remoção da trigger.
 */

import pool from '../routes/Estoque/db.config';
import {
  processStockMovement,
  recalculateStockForProduct,
  getCurrentStock,
  revertStockMovement,
  reprocessStockByReference,
  STOCK_ORIGINS
} from '../services/stock/stock.service';

interface TestResult {
  testName: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
  duration: number;
}

class StockEdgeCaseTests {
  private results: TestResult[] = [];
  private testProductIds: { [key: string]: number } = {
    noMovements: 999999,      // Produto único que não existe
    excessiveOutput: 999000,  // Produtos de teste exclusivos
    manualAdjustment: 999001,
    reversals: 999002,
    duplicateReprocessing: 999003,
    nullCosts: 999004,
    sameDate: 999005
  };

  async runAllTests(): Promise<void> {
    console.log('🚀 Iniciando testes de edge cases para estoque...\n');

    // Limpar dados ACumulados ANTES de começar
    await this.cleanupAllTestData();

    try {
      // 1. Produto sem movimentação
      await this.testProductWithoutMovements();

      // 2. Saída maior que entrada histórica
      await this.testExcessiveOutput();

      // 3. Ajuste manual
      await this.testManualAdjustment();

      // 4. Reversão de movimentações
      await this.testMovementReversal();

      // 5. Reprocessamento duplicado
      await this.testDuplicateReprocessing();

      // 6. Valores nulos no custo
      await this.testNullCostValues();

      // 7. Movimentações com mesma data
      await this.testSameDateMovements();

    } finally {
      // Limpar dados de teste ao finalizar
      await this.cleanupAllTestData();
    }

    // Relatório final
    this.printReport();
  }

  private async runTest(testName: string, testFn: () => Promise<void>, debug: boolean = false): Promise<void> {
    const startTime = Date.now();

    try {
      if (debug) console.log(`[DEBUG] Iniciando teste: ${testName}`);
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: true,
        expected: 'Success',
        actual: 'Success',
        duration
      });
      console.log(`✅ ${testName} - PASSOU (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.results.push({
        testName,
        passed: false,
        expected: 'Success',
        actual: 'Error',
        error: error.message,
        duration
      });
      console.log(`❌ ${testName} - FALHOU (${duration}ms): ${error.message}`);
    }
  }

  /**
   * 1. Produto sem movimentação (produto recém-criado)
   */
  private async testProductWithoutMovements(): Promise<void> {
    await this.runTest('Produto sem movimentação', async () => {
      const productId = this.testProductIds.noMovements;

      // Criar produto de teste que não existe
      await this.createTestProduct(productId);

      // Verificar saldo calculado
      const saldoLedger = await recalculateStockForProduct(productId);
      const saldoCache = await getCurrentStock(productId);

      // Deve ser zero em ambos
      if (saldoLedger.quantidade !== 0 || saldoCache.quantidade !== 0) {
        throw new Error(`Saldo não é zero. Ledger: ${saldoLedger.quantidade}, Cache: ${saldoCache.quantidade}`);
      }

      if (saldoLedger.movimentosProcessados !== 0) {
        throw new Error(`Movimentos processados deve ser 0, foi ${saldoLedger.movimentosProcessados}`);
      }
    });
  }

  /**
   * 2. Saída maior que a entrada histórica
   */
  private async testExcessiveOutput(): Promise<void> {
    await this.runTest('Saída maior que entrada histórica', async () => {
      const productId = this.testProductIds.excessiveOutput;
      await this.createTestProduct(productId);

      // Entrada de 10 unidades
      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 10,
        valorUnitario: 5.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 1
      });

      // Tentar saída de 15 unidades (mais que disponível)
      try {
        await processStockMovement({
          idProduto: productId,
          tipo: 'SAIDA',
          quantidade: 15,
          origem: STOCK_ORIGINS.VENDA,
          idOrigem: 2
        });
        throw new Error('Deveria ter falhado - saída maior que estoque');
      } catch (error: any) {
        // Deve falhar com erro de estoque insuficiente
        if (!error.message.includes('Estoque insuficiente')) {
          throw new Error(`Erro inesperado: ${error.message}`);
        }
      }

      // Verificar que saldo permanece 10
      const saldoCache = await getCurrentStock(productId);
      if (saldoCache.quantidade !== 10) {
        throw new Error(`Saldo deveria ser 10, foi ${saldoCache.quantidade}`);
      }
    });
  }

  /**
   * 3. Ajuste manual
   */
  private async testManualAdjustment(): Promise<void> {
    await this.runTest('Ajuste manual', async () => {
      const productId = this.testProductIds.manualAdjustment;
      await this.createTestProduct(productId);

      // Entrada inicial
      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 20,
        valorUnitario: 10.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 3
      });

      // Ajuste manual para 15 unidades
      await processStockMovement({
        idProduto: productId,
        tipo: 'AJUSTE',
        quantidade: 15,
        valorUnitario: 12.00,
        origem: STOCK_ORIGINS.AJUSTE_MANUAL,
        idOrigem: 4
      });

      // Verificar saldo
      const saldoLedger = await recalculateStockForProduct(productId);
      const saldoCache = await getCurrentStock(productId);

      if (saldoLedger.quantidade !== 15) {
        throw new Error(`Saldo ledger deveria ser 15, foi ${saldoLedger.quantidade}`);
      }

      if (saldoCache.quantidade !== 15) {
        throw new Error(`Saldo cache deveria ser 15, foi ${saldoCache.quantidade}`);
      }

      if (Math.abs(saldoLedger.valorMedio - 12.00) > 0.01) {
        throw new Error(`Valor médio deveria ser 12.00, foi ${saldoLedger.valorMedio}`);
      }
    });
  }

  /**
   * 4. Reversão de movimentações
   */
  private async testMovementReversal(): Promise<void> {
    await this.runTest('Reversão de movimentações', async () => {
      const productId = this.testProductIds.reversals;
      await this.createTestProduct(productId);

      // Entrada
      const entradaId = await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 25,
        valorUnitario: 8.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 5
      });

      // Saída
      const saidaId = await processStockMovement({
        idProduto: productId,
        tipo: 'SAIDA',
        quantidade: 10,
        origem: STOCK_ORIGINS.VENDA,
        idOrigem: 6
      });

      // Reverter a saída
      await revertStockMovement(saidaId);

      // Verificar saldo (deve voltar para 25)
      const saldoLedger = await recalculateStockForProduct(productId);
      const saldoCache = await getCurrentStock(productId);

      if (saldoLedger.quantidade !== 25) {
        throw new Error(`Após reversão, saldo ledger deveria ser 25, foi ${saldoLedger.quantidade}`);
      }

      if (saldoCache.quantidade !== 25) {
        throw new Error(`Após reversão, saldo cache deveria ser 25, foi ${saldoCache.quantidade}`);
      }
    });
  }

  /**
   * 5. Reprocessamento duplicado
   */
  private async testDuplicateReprocessing(): Promise<void> {
    await this.runTest('Reprocessamento duplicado', async () => {
      const productId = this.testProductIds.duplicateReprocessing;
      await this.createTestProduct(productId);

      const referencia = 'TEST_DUPLICATE_123';

      // Duas entradas com mesma referência
      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 5,
        valorUnitario: 15.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 7,
        referenciaAuditavel: referencia
      });

      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 5,
        valorUnitario: 15.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 8,
        referenciaAuditavel: referencia
      });

      // Reprocessar por referência
      const novosIds = await reprocessStockByReference(referencia);

      // Deve ter criado 2 reversões + 2 reprocessamentos = 4 movimentos
      if (novosIds.length !== 4) {
        throw new Error(`Deveria ter criado 4 movimentos, criou ${novosIds.length}`);
      }

      // Saldo deve permanecer o mesmo (reversões + reprocessamentos)
      const saldoLedger = await recalculateStockForProduct(productId);
      if (saldoLedger.quantidade !== 10) {
        throw new Error(`Saldo deveria ser 10 após reprocessamento, foi ${saldoLedger.quantidade}`);
      }
    });
  }

  /**
   * 6. Valores nulos no custo
   */
  private async testNullCostValues(): Promise<void> {
    await this.runTest('Valores nulos no custo', async () => {
      const productId = this.testProductIds.nullCosts;
      await this.createTestProduct(productId);

      // Entrada sem valor unitário
      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 30,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 9
        // valorUnitario não fornecido
      });

      // Saída sem valor unitário
      await processStockMovement({
        idProduto: productId,
        tipo: 'SAIDA',
        quantidade: 10,
        origem: STOCK_ORIGINS.VENDA,
        idOrigem: 10
      });

      // Verificar cálculos
      const saldoLedger = await recalculateStockForProduct(productId);

      if (saldoLedger.quantidade !== 20) {
        throw new Error(`Saldo deveria ser 20, foi ${saldoLedger.quantidade}`);
      }

      // Valor médio deve ser 0 quando não fornecido
      if (saldoLedger.valorMedio !== 0) {
        throw new Error(`Valor médio deveria ser 0, foi ${saldoLedger.valorMedio}`);
      }
    });
  }

  /**
   * 7. Movimentações com mesma data
   */
  private async testSameDateMovements(): Promise<void> {
    await this.runTest('Movimentações com mesma data', async () => {
      const productId = this.testProductIds.sameDate;
      await this.createTestProduct(productId);

      // Usar processStockMovement em vez de inserir diretamente
      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 10,
        valorUnitario: 5.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 11
      });

      await processStockMovement({
        idProduto: productId,
        tipo: 'ENTRADA',
        quantidade: 15,
        valorUnitario: 6.00,
        origem: STOCK_ORIGINS.RECEBIMENTO,
        idOrigem: 12
      });

      await processStockMovement({
        idProduto: productId,
        tipo: 'SAIDA',
        quantidade: 5,
        origem: STOCK_ORIGINS.VENDA,
        idOrigem: 13
      });

      // Verificar cálculo
      const saldoLedger = await recalculateStockForProduct(productId);

      // 10 + 15 - 5 = 20
      if (saldoLedger.quantidade !== 20) {
        throw new Error(`Saldo deveria ser 20, foi ${saldoLedger.quantidade}`);
      }

      // Valor médio: ((10*5) + (15*6)) / 25 = 5.7
      const expectedValorMedio = ((10 * 5) + (15 * 6)) / 25;
      if (Math.abs(saldoLedger.valorMedio - expectedValorMedio) > 0.01) {
        throw new Error(`Valor médio deveria ser ${expectedValorMedio}, foi ${saldoLedger.valorMedio}`);
      }
    });
  }

  private async createTestProduct(productId: number): Promise<void> {
    // Verificar se produto já existe
    const [existing]: any = await pool.execute(
      'SELECT id_produto FROM produtos WHERE id_produto = ?',
      [productId]
    );

    if (existing.length === 0) {
      // Criar produto de teste com colunas corretas (id_categoria pode ser NULL)
      const result = await pool.execute(
        `INSERT INTO produtos (
          id_produto, codigo_interno, descricao, unidade, preco_venda, status, id_categoria
        ) VALUES (?, ?, ?, 'UN', 0.00, 'Ativo', NULL)`,
        [productId, `TEST_${productId}`, `Produto Teste ${productId}`]
      );
      console.log(`[DEBUG] Produto criado: ${productId}`);
    }
  }

  private async cleanupAllTestData(): Promise<void> {
    try {
      // NOTA: Ledger é imutável - não podemos remover dados de estoque_movimentacoes
      // Em vez disso, apenas limpamos as referências de produtos de teste

      // Remover produtos de teste (apenas o que não é de produção)
      const testProductId = this.testProductIds.noMovements;
      await pool.execute(
        'DELETE FROM produtos WHERE id_produto >= ?',
        [testProductId]
      );

      // Remover saldos de cache  
      await pool.execute(
        'DELETE FROM estoque_saldos WHERE id_produto >= ?',
        [testProductId]
      );

      // Também remover por codigo_interno para garantir
      await pool.execute(
        "DELETE FROM produtos WHERE codigo_interno LIKE 'TEST_%'"
      );
    } catch (error) {
      console.warn('Aviso: erro na limpeza de dados de teste:', error);
    }
  }

  private async cleanupTestData(): Promise<void> {
    // Nada a fazer - ledger é imutável
    // Os dados dos testes ficarão registrados para auditoria
  }

  private printReport(): void {
    console.log('\n📊 RELATÓRIO DE TESTES DE EDGE CASES\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total de testes: ${this.results.length}`);
    console.log(`✅ Aprovados: ${passed}`);
    console.log(`❌ Reprovados: ${failed}`);
    console.log(`⏱️  Tempo total: ${totalTime}ms`);
    console.log(`📈 Taxa de sucesso: ${((passed / this.results.length) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('🔍 DETALHES DOS FALHOS:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  ❌ ${result.testName}: ${result.error}`);
      });
    }

    console.log('\n🎯 CONCLUSÃO:');
    if (failed === 0) {
      console.log('  ✅ Todos os edge cases passaram! Sistema pronto para produção.');
    } else {
      console.log('  ⚠️  Alguns edge cases falharam. Revisar implementação antes de remover trigger.');
    }
  }
}

// Executar testes se arquivo for executado diretamente
if (require.main === module) {
  const tests = new StockEdgeCaseTests();
  tests.runAllTests()
    .then(() => {
      console.log('\n🏁 Testes finalizados.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erro crítico durante testes:', error);
      process.exit(1);
    });
}

export default StockEdgeCaseTests;