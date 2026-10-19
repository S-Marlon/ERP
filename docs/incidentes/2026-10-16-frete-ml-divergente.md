# Incidente: lucro do Mercado Livre no ERP maior que o real (frete abaixo de R$ 79)

| | |
|---|---|
| **Data** | 2026-10-16 |
| **Área** | Módulo E-commerce · Mercado Livre (preço e lucro) |
| **Gravidade** | Alta: o ERP mostrava lucro em anúncios que davam prejuízo |
| **Como foi achado** | O operador comparou a lista de anúncios do ERP com o painel do ML (anúncio das abraçadeiras) |
| **Correção** | Commit `2c94a3e` — `fix(modulos): frete do ML abaixo de R$ 79 como o ML cobra` |
| **Situação** | Corrigido e conferido (10 de 10 anúncios iguais ao painel). Prevenção: ver "O que fazer para não repetir" |

## O que aconteceu

O preço e a tarifa de venda batiam entre o ERP e o ML. O **frete** não:

| SKU | Preço | Frete no ERP | Frete no ML | Você recebe ERP × ML |
|---|---|---|---|---|
| ABR-3.6-100 (comprador paga o envio) | 12,59 | 0,00 | 5,95 | 11,08 × 5,13 |
| ABR-3.6-200 (frete grátis) | 15,90 | 5,95 | 13,85 | 8,04 × 0,14 |
| ABR-7.2-250 (frete grátis) | 23,40 | 6,95 | 13,85 | 13,64 × 6,74 |
| ABR-7.2-500 (frete grátis) | 26,59 | 7,15 | 14,45 | 16,25 × 8,95 |

Com o frete certo, **7 dos 10 anúncios estavam em prejuízo**. O ERP mostrava todos com lucro, a maioria "acima do alvo".

## Por que aconteceu

### 1. O ERP calculava uma estimativa e nunca conferia com o que o ML cobra
O frete vinha de uma consulta de **simulação**: o custo de frete grátis de uma caixa genérica 5×5×5 cm com o peso cobrado e o valor da compra
(`GET /users/{id}/shipping_options/free?dimensions=5x5x5,{peso}&item_price=...`). Para os anúncios **já publicados**, o ML expõe o custo
real do próprio anúncio (`GET /items/{mlb}/shipping_options`, campo `list_cost` da opção de frete grátis), mas o ERP não lia esse
valor. A estimativa e o real só coincidem quando a regra do ML é a que o ERP supõe.

### 2. A regra do ML para itens abaixo de R$ 79 mudou e o ERP não acompanhou
O ML trocou a "taxa fixa" do item barato (a tarifa passou a vir com `fixed_fee: 0`) por uma cobrança de envio. Conferido nesta data:

| Caso | O ERP supunha | O ML cobra |
|---|---|---|
| Abaixo de R$ 79, frete grátis ligado | valor subsidiado (desconto de item barato, ex.: R$ 6,95) | o frete grátis **cheio**, pela tabela de R$ 79 (ex.: R$ 13,85) |
| Abaixo de R$ 79, comprador paga o envio | R$ 0,00 | a tarifa de envio do item barato (ex.: R$ 5,95), **mesmo com o comprador pagando** |
| R$ 79 ou mais | frete grátis obrigatório, tabela do valor | igual (não mudou) |

A própria API de simulação devolve, abaixo de R$ 79, o valor subsidiado (`free_shipping_by_meli: true`), que não é o que o ML cobra de quem
liga o frete grátis por conta própria. Ou seja: **a simulação do ML e a cobrança do ML não são a mesma coisa**, e o ERP confiava só na
simulação.

### 3. Uma suposição embutida no código: "comprador paga = vendedor não paga nada"
`vendedorPagaFrete()` devolvia falso abaixo de R$ 79 sem frete grátis, e o frete virava zero. Era verdade antes da mudança do ML; deixou de
ser, e nada avisou.

### 4. Ainda não havia venda real para comparar
A tela **Pedidos › Resultado real** compara o lucro estimado com o frete cobrado de verdade em cada venda, mas os pedidos do ML foram
ativados em 2026-10-14 e ainda não tinha caído venda. A divergência só apareceu porque o operador comparou as telas à mão.

## O que foi corrigido

- Regra pura `valorNaTabelaDeFrete()` em `Backend/src/modulos/ecommerce/mercadolivre/custosMl.ts`: diz por qual valor de compra consultar
  a tabela de frete (abaixo de R$ 79 com frete grátis → tabela de R$ 79; senão, o próprio valor). Com teste em `custosMl.test.ts`.
- `freteDe()` em `precificacao.controller.ts` usa essa regra e deixa de zerar o frete do "comprador paga".
- Cenários Clássico × Premium: o cenário "comprador paga o frete" passa a descontar a tarifa de envio do item barato.
- Tela (Preço e lucro › Conta e frete, coluna Frete): explica as duas cobranças.
- Conferência no banco/ML real: os 10 anúncios das abraçadeiras ficaram iguais ao painel do ML no frete e no "você recebe".

## O que fazer para não repetir: integração de mão dupla

O ERP e o ML fazem operações diferentes, mas **o que um mostra precisa bater com o outro**. Hoje o ERP **envia** bem (publica, preço,
estoque, fotos, descrição) e **lê** só parte (status do anúncio, tipo, frete grátis ligado/desligado, tarifa de venda). O que o ML **cobra**
de fato não volta para o ERP. Princípios para daqui em diante:

1. **O que o ML calcula, o ERP lê do ML — não recalcula.** Para anúncio publicado, frete e tarifa vêm do próprio anúncio
   (`/items/{mlb}/shipping_options`, `/sites/MLB/listing_prices`). A conta própria do ERP fica só para o que ainda não está no ML
   (rascunho, simulação de preço, formas de venda ainda não criadas).
2. **Guardar os dois lados e comparar.** Junto do que o ERP calculou, guardar o que o ML devolveu (frete, tarifa, "você recebe") e a
   data da leitura. Diferença acima de uma tolerância (ex.: R$ 0,05) vira aviso no anúncio, em vez de passar despercebida.
3. **Conferência periódica.** A sincronização automática (que já roda para estoque e preço) também relê o custo de cada anúncio
   publicado e marca os que divergem. Uma lista "ERP × ML" no painel mostra o que precisa de atenção.
4. **Venda real fecha o ciclo.** Cada pedido importado traz o frete e a tarifa cobrados; o Resultado real compara com o estimado e
   avisa quando a diferença se repete (sinal de regra do ML que mudou).
5. **Sem suposição silenciosa sobre regra do ML.** Regras como "abaixo de R$ 79 o comprador paga" ficam numa função pura, com teste
   e com o comentário de **quando foi conferida** com o painel. Quando a leitura do ML (item 1) discorda da regra, o aviso aponta a
   regra a revisar.
6. **Teste com números reais.** Os testes das regras de custo usam casos tirados do painel do ML (preço, peso, frete, recebe), como os
   desta conferência, para que uma mudança de regra quebre um teste e não o lucro.

### Próximos passos propostos (ainda não feitos)

| # | O quê | Onde | Banco |
|---|---|---|---|
| 1 | ✅ **Feito em 2026-10-19.** Para anúncio publicado, no preço de lá, o frete vem do próprio anúncio (`/items/{mlb}/shipping_options`, `list_cost` da opção grátis para o comprador); a tela marca "ML" e avisa "ML≠ERP" quando a estimativa diferia | `freteRealNoMl()`, `freteDoVendedorNasOpcoes()`, `contextoVenda` | não |
| 2 | Guardar o que o ML cobra por anúncio (frete, tarifa, recebe, data) e mostrar "ERP × ML" com aviso de divergência | anúncios do ML | sim (colunas em `modulo_ecommerce_mercadolivre_anuncios_itens`, por script) |
| 3 | A sincronização automática relê esses valores junto com estoque e preço | `sincronizacao.ts` | não |
| 4 | Aviso no Resultado real quando o frete cobrado nas vendas difere do estimado | pedidos do ML | não |

## Como conferir de novo

Script avulso usado nesta conferência (no scratchpad da sessão, não versionado): carrega o financeiro do anúncio e compara, item a item,
o frete e o "você recebe" do ERP com os valores do painel do ML. Para repetir: pegar os números do painel do ML (frete "a pagar" e
"você recebe" de cada anúncio) e comparar com a coluna **Frete** e **Você recebe** da lista de anúncios do ERP.
