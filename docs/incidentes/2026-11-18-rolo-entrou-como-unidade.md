# Incidente: rolo de corda entrou como 1 metro (custo 258x maior)

| | |
|---|---|
| **Data** | 2026-11-18 (entrada errada em 2026-11-05) |
| **Área** | Compras · Entrada de NF (conversão de unidade) |
| **Gravidade** | Média: estoque 239 m abaixo do real e custo médio/último custo errados num item; sugestão de preço absurda |
| **Como foi achado** | Aviso "Custo desatualizado pelas últimas entradas de NF" no preço do item 386880 (Corda pol. firmeza 8 mm): último custo R$ 206,82 contra R$ 0,80 |
| **Correção** | Linha corrigida pela tela de correção de entrada (fator 1 → 240) + proteções no pente fino, na sugestão de vínculo e na correção |
| **Situação** | Corrigido: 280 MT, custo médio R$ 0,8546, vínculo do fornecedor de volta a RL ×240 |

## O que aconteceu

O fornecedor manda o rolo de 240 m com a unidade **UN**. O item é vendido em **MT** (com a embalagem RL = 240 MT).

| Nota | Conferência | Estoque |
|---|---|---|
| NF 1589075 (out/2026) | Operador corrigiu UN → **RL** e informou fator **240** | +240 MT a R$ 0,81 ✔ |
| NF 1687571 (nov/2026), item 8 | Item reconhecido sozinho pelo código do fornecedor, com **UN, fator 1** | +1 MT a R$ 206,82 ✘ |

## Por que aconteceu

1. **A sugestão automática não lembrava a correção de unidade.** O vínculo com o fornecedor guardava a unidade já corrigida (RL). A nota
   nova veio em UN e a regra "só reaproveita a conversão se a unidade da nota for a mesma" comparou UN com RL e usou fator 1.
2. **O pente fino não conferia a conversão contra o item.** "1 UN = 1 MT" com custo por metro 258x maior passou sem bloqueio nem aviso.
3. **A aprovação regravou o vínculo como UN ×1**, então a próxima nota repetiria o erro.
4. A tela de correção gravaria a conversão com a unidade do XML (criaria "UN = 240 MT" no item), não com a corrigida.

## O que mudou

- **Sugestão de vínculo** (`sugestoesVinculo.controller.ts` + `vinculoSugerido.ts`): a conversão vem da última nota aprovada do mesmo
  fornecedor/código/item **que veio na mesma unidade** (UN → RL ×240 volta igual). Sem histórico, segue o vínculo como antes.
- **Pente fino** (`penteFino.ts`), conferindo contra a unidade base e o custo **reais** do item vinculado:
  - `CONVERSAO_FALTANDO` (bloqueia): unidade da nota ≠ unidade do item, fator 1 **e** custo por unidade > 3x fora do atual.
  - `UNIDADE_SEM_CONVERSAO` (aviso): unidade diferente com fator 1 e custo normal (M × MT, UN × PC costumam ser sinônimos).
  - `UNIDADE_BASE_DIFERENTE` (bloqueia): conversão apontando para uma base que não é a do item.
  - `CUSTO_FORA_DO_PADRAO` (aviso): custo por unidade > 3x acima ou abaixo do custo atual.
  - Conferido nas 1.345 linhas já aprovadas: nenhuma seria bloqueada à toa.
- **Correção de entrada** (`correcaoEntrada.controller.ts`): usa a unidade de compra da conferência; se ela não é unidade do item e o
  item tem uma embalagem com o mesmo fator, usa a embalagem (RL). O estorno sai com a unidade com que a linha entrou.

## Ponto em aberto

Antes desta nota o saldo era 40 MT: a venda 79 tirou 100 MT e o ajuste "levou o Rolo todo" mais 100 MT (200 de um rolo de 240).
Se o rolo saiu inteiro, esses 40 m não existem e o saldo real é 240 MT — conferir no físico.
