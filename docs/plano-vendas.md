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
| 8 | **NFC-e / NF-e de saída**: fila de aprovação do dia, emissão por provedor ou direta, cancelamento, envio por WhatsApp/e-mail | `fiscal_emitentes`, `fiscal_configuracoes`, `fiscal_documentos`, `fiscal_documentos_eventos`; `csosn` em `itens_dados_fiscais` | feito (provedor a contratar) |

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

## Fase 8 — como ficou

- **Vendas › Notas fiscais**: as vendas do dia entram na fila (Aguardando). Revisa, escolhe NFC-e (65) ou NF-e (55; sugerida
  para cliente com CNPJ), aprova e emite (uma ou em lote), dispensa com motivo ou volta à fila. Pendências (empresa sem
  cadastro, item sem NCM) aparecem na linha e bloqueiam a emissão. Venda só de serviço não tem nota de produto.
- **Configuração** (aba da mesma tela): empresa emitente, ambiente, modo (fila ou automático ao concluir a venda),
  emissor (provedor ou direto), séries/numeração e tributação padrão (MEI/Simples 102/5102; com CEST 500/5405; exceção por item).
- **Emissores** (`Backend/src/routes/Fiscal/saida/emissores.ts`): interface `EmissorFiscal` (emitir, cancelar, enviar e-mail).
  `SIMULADO` autoriza em homologação para testar. Provedor contratado = um arquivo novo registrado em `PROVEDORES`.
  Direto na SEFAZ fica preparado e pede o certificado A1. Segredos no `.env`: `FISCAL_PROVEDOR_TOKEN`, `FISCAL_CSC_TOKEN`,
  `FISCAL_CERTIFICADO_ARQUIVO`, `FISCAL_CERTIFICADO_SENHA`.
- A nota usa o preço de tabela com desconto por item, o acréscimo do parcelamento em "outras despesas", as formas no
  código da SEFAZ (tPag) e o troco. Número reservado com trava; reenvio após rejeição usa o mesmo número.
- Envio: WhatsApp (link com a mensagem pronta) e e-mail (pelo provedor ou programa de e-mail); o contato fica na nota.
- Venda com nota autorizada só é cancelada depois de cancelar a nota; a que estava na fila sai dela.
- Pendente: adaptador do provedor escolhido, NF-e de devolução e DANFE próprio (emissão direta).

## Ajuste de venda a prazo (2026-10-28)

- **Financeiro › Contas a Receber**: o nº da venda (na tabela e no detalhe da parcela) abre a venda completa: itens,
  pagamentos, parcelas, histórico (ajustes e devoluções) e a situação da nota.
- **Ajustar venda** (só a prazo e concluída, sem nota autorizada ou em emissão): muda quantidade e preço das linhas, tira
  linha (fica na venda com quantidade 0, para o histórico) e inclui item (preço de tabela da faixa, como no PDV). Kit não
  muda (use a devolução); a quantidade não fica abaixo do já devolvido.
- O estoque acompanha (sai o que aumentou, volta o que diminuiu com o custo da venda), origem `AJUSTE_VENDA` com
  `id_origem` = ajuste e `id_origem_item` = linha do histórico. Os totais da venda e o pagamento PRAZO são refeitos.
- A diferença vai para as parcelas em aberto: espalhada, na última ou (acréscimo) numa parcela nova com vencimento.
  Parcela paga não muda; redução maior que o saldo em aberto é recusada (devolução devolve o dinheiro). Acréscimo
  respeita o limite de crédito. Histórico em `vendas_pedidos_ajustes(_itens)`; regras em `ajustes/ajustesVenda.ts`.
- Nota na fila lê os itens na emissão (linha com 0 fica fora); impressão também não mostra a linha tirada.

## Orçamento de negociação (2026-11-17)

- **Banco:** `margem_alvo_padrao` e `margem_minima_negociacao` em `vendas_configuracoes`; `margem_alvo` e `condicao_pagamento` em
  `vendas_pedidos` (orçamento comum fica com `margem_alvo` NULL); `preco_travado` em `vendas_pedidos_itens`; faixas por
  quantidade em `vendas_pedidos_itens_faixas`.
- **Tela** (`areas/vendas/negociacao/NegociacaoDrawer.tsx`): botão **Negociar** no carrinho do PDV e em Vendas › Orçamentos
  (renegociar mantém o número). Margem = lucro ÷ preço (markup ao lado), sobre o custo do item (custo médio do depósito
  Venda, senão o gerencial). Margem do orçamento contra o alvo, régua geral, régua por categoria (marca a margem sugerida da
  categoria), régua e preço por item, preço por unidade base, margem de tabela e da **última venda para o cliente**, cadeado
  (travar) e **Equilibrar para o alvo** (livres na margem que fecha o orçamento no alvo; regra em `negociacao.ts`, cópia no
  front para recalcular na hora). Faixas por quantidade por item.
- **Servidor:** `POST /api/vendas/negociacao/preparar` (preço de tabela, custo da linha, categoria, unidade base, última venda);
  salvar é o POST dos orçamentos com `negociacao` (+ `idPedido` para renegociar). Item ou faixa abaixo da margem mínima pede a
  senha de autorização (quem e motivo ficam no orçamento). No orçamento negociado o preço combinado vira o "de tabela":
  ao vender, não conta como desconto.
- **Proposta** (impressão e PDF/WhatsApp): itens por categoria, embalagem e preço por unidade base, faixas, condição de
  pagamento, validade, vendedor e código do cliente (`propostaNegociacao.ts`). Custo e margem não saem.
- **Condição de pagamento em campos** (2026-11-18): `condicao_forma`, `condicao_parcelas`, `condicao_intervalo_dias` e
  `condicao_entrada` em `vendas_pedidos` (o texto `condicao_pagamento` sai deles; "a combinar" continua texto livre). Regra
  em `negociacao/condicaoPagamento.ts` (cópia no front): texto da proposta, custo da condição (taxa de Vendas › Taxas + prazo
  médio para receber) mostrado como "margem depois da condição" na negociação, e a conferência na venda.
- **Venda da proposta no PDV:** válida entra sempre pelos preços combinados (sem a pergunta "preços atuais"); sem a tabela de
  desconto por forma; "Lançar a condição" preenche o pagamento combinado (sem acréscimo do crédito até as parcelas combinadas).
  Pagamento mais caro para a loja que o combinado (mais taxa, ou mais prazo médio) pede a senha de autorização.
- Pendente: na venda, a faixa por quantidade não muda o preço sozinha se a quantidade for diferente da orçada.

## Pedidos faturados (2026-11-18)

Venda para empresa com entrega depois (Vendas › Pedidos faturados, `areas/vendas/pedidos`). Decidido com o dono: NF-e
emitida **fora** do ERP (o emissor do ERP ainda é simulado), boleto gerado **no banco**, entrega **de uma vez**, material
**reservado** desde a confirmação e baixado na entrega.

- **Banco:** `vendas_pedidos` com `origem = 'ERP'` e status `PEDIDO` (confirmado) → `FATURADO` → `CONCLUIDA` (faturado e
  entregue; aí conta no painel de vendas) ou `CANCELADA`; colunas `pedido_cliente` (OC), `previsao_entrega`,
  `endereco_entrega`, `faturado_em`, `entregue_em`, `recebido_por`. Parcelas em `financeiro_contas_receber` com `forma` e
  `codigo_barras` (linha digitável). A nota fica em `fiscal_documentos` (modelo 55, `AUTORIZADA`, emissor `EXTERNO`).
- **Fluxo:** botão **Pedido** no orçamento válido com cliente (copia itens e preços; orçamento fica `CONVERTIDO`) →
  **Faturar** (nº/série/chave da NF-e + parcelas sugeridas pela condição da proposta, editáveis) → linha digitável em cada
  boleto (na hora ou depois) → **Registrar entrega** (quem recebeu; baixa o estoque pelo custo médio do momento, origem
  `PEDIDO_ENTREGA`). Faturar e entregar podem vir em qualquer ordem. Não passa pelo caixa.
- **Reserva:** calculada (pedidos `PEDIDO`/`FATURADO` sem `entregue_em`; kit reserva os componentes), sem tabela própria.
  O PDV mostra o disponível sem ela e a venda de balcão não leva o reservado; a entrega de um pedido não concorre com a
  própria reserva. Regras em `pedidosFaturados.ts` (com teste).
- **Cancelar:** só antes da entrega (depois é devolução); parcelas sem recebimento são canceladas; a NF-e emitida fora
  precisa ser cancelada no emissor (o operador confirma). "Vendas do dia" e o cancelamento do PDV não mexem em pedido.
- Pendente: impressão do pedido/romaneio de entrega; entrega parcial; emissor fiscal real e boleto registrado pelo banco.

## Critérios de pronto

- **Fase 1:** abrir com R$ 100, vender R$ 50 em dinheiro, sangria de R$ 30 → fechamento espera R$ 120 em dinheiro e mostra a diferença contada.
- **Fase 2:** venda a prazo de R$ 300 em 3x gera 3 parcelas; receber uma em dinheiro aparece no caixa.
- **Fase 3:** desconto de 10% com limite de 4% é recusado sem senha e aceito com ela, registrado na venda.

## Observações

- Os componentes antigos de OS (`OSPanel`, `components/OrderService/*`, `LaborCalculator`, `OSListPage`) foram substituídos pelo módulo Hidráulica · Montagens e podem ser removidos.
- A lista de OS e Financeiro › Faturamento ainda usam dados de exemplo (fase 6 e depois).
