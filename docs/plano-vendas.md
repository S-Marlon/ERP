# Plano do módulo de Vendas

Roteiro combinado em 2026-10-03 para levar o módulo de vendas (PDV, Central de Vendas, Financeiro) ao uso diário.

**Operador sem login:** cada registro guarda o campo `operador` (texto). Padrão **ADM**, editável em
Configurações › Meu Perfil. Quando houver login, o campo passa a vir do usuário, sem mudar tabelas.

**Rotina de cada fase:** script do banco com justificativa → aprovação e execução no phpMyAdmin → backend com
testes → telas → commit.

| Fase | O quê | Banco | Situação |
|---|---|---|---|
| 0 | Limpeza: código morto do PDV, senha fixa de gerente e modal de cliente falso | — | feito |
| 1 | **Caixa**: abertura com troco, sangria/suprimento, fechamento com conferência por forma; venda só com caixa aberto | `vendas_caixas`, `vendas_caixas_movimentos`, `vendas_caixas_fechamentos`; `id_caixa` e `operador` em `vendas_pedidos` | em andamento |
| 2 | **Prazo → contas a receber**: venda a prazo exige cliente, gera parcelas, limite de crédito, baixa (dinheiro entra no caixa) | `financeiro_contas_receber`, `financeiro_contas_receber_baixas`, limite de crédito | |
| 3 | **Desconto e margem no servidor**: limite configurável, autorização registrada, aviso/bloqueio abaixo do custo | `vendas_configuracoes`; autorização em `vendas_pedidos` | |
| 4 | **Central de Vendas real**: faturamento, ticket médio, margem, formas, mais vendidos, a receber, caixa | — | |
| 5 | **Orçamento e venda suspensa**: suspender/retomar, orçamento com validade e impressão, converter em venda | status e validade em `vendas_pedidos` | |
| 6 | **OS de montagem de mangueira**: mão de obra + componentes, OS → venda (reaproveita `components/OrderService`) | itens de serviço, OS | |
| 7 | **Devolução parcial e troca** | | |
| 8 | **NFC-e / NF-e de saída** (emissor a definir) | | |

## Critérios de pronto

- **Fase 1:** abrir com R$ 100, vender R$ 50 em dinheiro, sangria de R$ 30 → fechamento espera R$ 120 em dinheiro e mostra a diferença contada.
- **Fase 2:** venda a prazo de R$ 300 em 3x gera 3 parcelas; receber uma em dinheiro aparece no caixa.
- **Fase 3:** desconto de 10% com limite de 4% é recusado sem senha e aceito com ela, registrado na venda.

## Observações

- Os componentes de OS (`OSPanel`, `components/OrderService/*`, `LaborCalculator`, `OSListPage`) não estão em uso, mas foram mantidos para a fase 6.
- A Central de Vendas (`HubVendas`), a lista de OS e Financeiro › Faturamento ainda usam dados de exemplo até as fases 4 e 6.
