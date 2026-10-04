# Plano do módulo de Vendas

Roteiro combinado em 2026-10-03 para levar o módulo de vendas (PDV, Central de Vendas, Financeiro) ao uso diário.

**Operador sem login:** cada registro guarda o campo `operador` (texto). Padrão **ADM**, editável em
Configurações › Meu Perfil. Quando houver login, o campo passa a vir do usuário, sem mudar tabelas.

**Rotina de cada fase:** script do banco com justificativa → aprovação e execução no phpMyAdmin → backend com
testes → telas → commit.

| Fase | O quê | Banco | Situação |
|---|---|---|---|
| 0 | Limpeza: código morto do PDV, senha fixa de gerente e modal de cliente falso | — | feito |
| 1 | **Caixa**: abertura com troco, sangria/suprimento, fechamento com conferência por forma; venda só com caixa aberto | `vendas_caixas`, `vendas_caixas_movimentos`, `vendas_caixas_fechamentos`; `id_caixa` e `operador` em `vendas_pedidos` | feito |
| 2 | **Prazo → contas a receber**: venda a prazo exige cliente, gera parcelas, limite de crédito, baixa (dinheiro entra no caixa) | `financeiro_contas_receber`, `financeiro_contas_receber_baixas`, limite de crédito | |
| 3 | **Desconto e margem no servidor**: limite configurável, autorização registrada, aviso/bloqueio abaixo do custo | `vendas_configuracoes`; `autorizado_por` e `motivo_autorizacao` em `vendas_pedidos` | feito |
| 3.5 | **Taxas dos meios de pagamento**: taxa por forma/parcelas, preço com a taxa embutida, desconto da forma sem autorização, acréscimo no parcelamento, margem líquida | `vendas_taxas_pagamento`; referência e sem juros em `vendas_configuracoes`; taxa em `vendas_pedidos_pagamentos` e `vendas_pedidos` | feito |
| 4 | **Central de Vendas real**: faturamento, ticket médio, margem, formas, mais vendidos, a receber, caixa | — | feito |
| 5 | **Orçamento e venda suspensa**: suspender/retomar, orçamento com validade e impressão, converter em venda | status, `validade`, `contato` e `id_orcamento` em `vendas_pedidos` | feito |
| 6 | **Módulo plugável Hidráulica · Montagens**: montagem na hora no PDV, OS com sinal e ficha técnica | `sistema_modulos`, `vendas_adiantamentos`, `modulo_hidraulica_montagens_*` | feito |
| 7 | **Devolução parcial e troca**: devolução por item/quantidade, reembolso no caixa, crédito na loja ou abatimento do a prazo; troca | `vendas_devolucoes`, `vendas_devolucoes_itens`; `total_devolvido` em `vendas_pedidos` | feito |
| 8 | **NFC-e / NF-e de saída** (emissor a definir) | | |

## Fase 1 — como ficou

- **Backend** (`Backend/src/routes/Venda/caixa`): `caixa.ts` (cálculo, com testes) e `caixa.controller.ts`.
  Rotas em `/api/vendas`: `GET caixa/atual`, `POST caixa/abrir`, `POST caixa/movimentos` (SANGRIA/SUPRIMENTO),
  `POST caixa/fechar`, `GET caixas`, `GET caixas/:id`.
- Venda só com caixa aberto (`409 CAIXA_FECHADO`); cancelamento de venda de outro caixa lança `ESTORNO_VENDA` no caixa aberto.
- **Telas**: indicador no cabeçalho do PDV (abre o resumo), abertura, sangria/suprimento, fechamento com contagem por
  forma e comprovante; aviso de caixa fechado na venda; Vendas › Caixas (histórico e detalhe).

## Fase 3 — como ficou

- **Backend** (`Backend/src/routes/Venda/regras`): `regrasVenda.ts` (avaliação e senha scrypt; com testes) e
  `regrasVenda.controller.ts` (`GET|PUT /api/vendas/configuracoes`; alterar exige a senha atual quando há senha).
- Venda: desconto total acima do limite ou abaixo do custo (política AVISAR) → `403 AUTORIZACAO_NECESSARIA` até vir
  `autorizacao { senha, nome, motivo }`; BLOQUEAR → `409 ABAIXO_DO_CUSTO`. Quem autorizou e o motivo ficam na venda.
- **Telas**: pedido de autorização na finalização (reenvia a venda), Vendas › Regras de venda, autorização no detalhe de Vendas do Dia.

## Fase 3.5 — como ficou

- **Conta**: para receber L com taxa t cobra-se L ÷ (1 − t). O preço de tabela embute a taxa de referência
  (ex.: crédito 1x); na forma f o equivalente é tabela × (1 − t_ref) ÷ (1 − t_f): PIX/débito ganham desconto,
  crédito acima do sem juros ganha acréscimo; até o sem juros a loja absorve.
- **Backend**: `Venda/taxas` (cálculo com testes; `GET|PUT /api/vendas/taxas`); a venda grava a taxa de cada pagamento
  e `total_taxas`; a regra de desconto usa o desconto efetivo (líquido recebido x líquido da referência).
  Precificação: `calcularPrecoUnidade(custo, fator, markup, fatorTaxa)` nos recálculos automáticos; margem líquida;
  `GET /api/catalogo/precos/taxa/previa` e `POST .../aplicar`.
- **Telas**: Vendas › Taxas de pagamento (com prévia), finalização (desconto da forma e acréscimo),
  Precificação (margens após a taxa, botão Preços com taxa), margem líquida no caixa.

## Fase 4 — como ficou

- **Backend** (`Venda/painel`): `painelVendas.ts` (períodos, comparação, série; com testes) e `GET /api/vendas/painel?periodo=`
  (hoje, ontem, 7dias, mes, 30dias, personalizado com `de`/`ate`).
- **Tela** `/vendas` (`CentralVendas.tsx`, substitui o mock `HubVendas`): faturamento, vendas, ticket médio (com variação
  sobre o período anterior), lucro e margem líquidos (custo + taxas), descontos/autorizações, taxas; vendas por hora/dia;
  formas de pagamento; mais vendidos com margem; caixa; a receber; alertas (estoque negativo, canceladas);
  operadores, melhores clientes, últimas vendas e atalhos.

## Fase 5 — como ficou

- **Backend**: `calcularItensDoPedido` (compartilhado por venda, orçamento e suspensa); `pdv/pedidosAbertos.controller.ts`
  (`POST|GET /api/vendas/pdv/pedidos-abertos`, `GET :id`, `POST :id/retomar`, `DELETE :id`). Venda com `idOrcamento`
  (+ `manterPrecoOrcamento` dentro da validade: a tabela da linha é a do orçamento) marca o orçamento como CONVERTIDO.
  Vendas do Dia e o painel ignoram orçamentos e suspensas.
- **Telas**: no PDV, botões Suspender / Orçamento (contato, validade, observação, impressão A4) e a lista Suspensas /
  Orçamentos (retomar, vender, imprimir, excluir); faixa "vendendo o orçamento Nº X"; Vendas › Orçamentos.

## Fase 6 — como ficou

- **Núcleo**: venda de itens do tipo Serviço (sem estoque); adiantamentos (`/api/vendas/adiantamentos`, forma de pagamento
  ADIANTAMENTO/"Sinal", Caixa › Receber sinal); módulos plugáveis (`sistema_modulos`, `GET|PUT /api/sistema/modulos`,
  Configurações › Módulos). O núcleo não importa nada de módulo.
- **Padrão de módulo**: tabelas `modulo_<area>_<assunto>_*`, código `AREA_ASSUNTO`, backend em `Backend/src/modulos/<area>/<assunto>`
  (registro em `src/modulos/registro.ts`, rotas em `/api/modulos/...`, 403 quando desligado), front em `Front/App/src/modulos/...`
  (registro em `registroModulos.tsx`: menu, rotas e botões no PDV). Avisos genéricos do PDV: `erp:venda-concluida` e `erp:venda-nova`.
- **Hidráulica · Montagens** (`HIDRAULICA_MONTAGENS`): botão Montagem no PDV (mangueira em metros + terminais + capas,
  prensagem só se o cliente trouxe material; ficha gravada com a venda; refazer pelo histórico do cliente) e
  Vendas › Montagens (OS): etapas, mangueiras com ficha e materiais, itens avulsos, sinal, impressão A4, cancelamento
  (devolve ou guarda o sinal) e entrega pelo PDV (preços da OS, sinal abatido, OS fica ENTREGUE com a venda).

## Fase 7 — como ficou

- **Vendas do Dia**: botão Devolver por venda (e campo "Devolver venda Nº" para vendas de outros dias). Escolhe a quantidade
  de cada item, se volta ao estoque (defeito não volta) e como devolver o valor: dinheiro/PIX/estorno no cartão (sai do caixa
  aberto como DEVOLUCAO_VENDA), crédito na loja (fica como sinal do cliente, forma "Sinal" no PDV) ou abater do a prazo
  (reduz as últimas parcelas em aberto).
- **Valor**: proporcional ao que foi pago no item (descontos rateados); a última devolução do item fecha os centavos exatos.
- **Troca**: devolução em crédito na loja e o PDV abre com o cliente e o crédito disponível no pagamento.
- Venda com devolução não pode mais ser cancelada; a Central de Vendas mostra faturamento e lucro líquidos de devoluções.

## Critérios de pronto

- **Fase 1:** abrir com R$ 100, vender R$ 50 em dinheiro, sangria de R$ 30 → fechamento espera R$ 120 em dinheiro e mostra a diferença contada.
- **Fase 2:** venda a prazo de R$ 300 em 3x gera 3 parcelas; receber uma em dinheiro aparece no caixa.
- **Fase 3:** desconto de 10% com limite de 4% é recusado sem senha e aceito com ela, registrado na venda.

## Observações

- Os componentes antigos de OS (`OSPanel`, `components/OrderService/*`, `LaborCalculator`, `OSListPage`) foram substituídos pelo módulo Hidráulica · Montagens e podem ser removidos.
- A lista de OS e Financeiro › Faturamento ainda usam dados de exemplo (fase 6 e depois).
