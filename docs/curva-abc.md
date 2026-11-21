# Curva ABC (Estoque › Curva ABC)

Decidido com o dono em 2026-11-21. Todas as vendas passam pelo ERP desde 03/10/2026; não há histórico do sistema antigo
para importar, então a curva cresce com o histórico do próprio ERP.

## As três curvas

| Curva | Pergunta | Valor usado | Para quê |
|---|---|---|---|
| Venda | O que traz dinheiro? | Faturamento no período (vendas `CONCLUIDA`, balcão e pedido faturado entregue) menos devoluções | Não deixar faltar |
| Lucro | O que dá resultado? | Venda − custo da venda (menos o lucro devolvido) | Preço e negociação |
| Estoque | Onde está o dinheiro? | Saldo de hoje × custo médio (sem ele, o gerencial) | Parados, promoção, compras |

- Cortes: A até 80% do valor acumulado (o item que cruza a marca ainda é A), B até 95%, C o resto.
- **Curva na categoria:** a de venda recalculada dentro de cada categoria do topo (hidráulica e ferragens têm ritmos diferentes).
- **Frequência (XYZ):** semanas com venda no período. X = em ≥ 40% das semanas (e ≥ 2), Y = 2 semanas ou mais, Z = uma só.

## Classes fora do ABC

- **P (parado):** tem estoque e não vendeu no período.
- **N (novo):** entrou há menos de 60 dias **e depois** que o ERP já vendia (a carga inicial do estoque, de setembro, é julgada
  normalmente; senão tudo apareceria como novo).
- **– (sem giro):** sem venda e sem estoque.

## Ritmo com histórico curto

Cobertura (dias de estoque no ritmo de venda) e XYZ usam o menor entre o período escolhido e os dias de histórico do ERP.
A tela avisa quando o histórico é menor que o período: venda e lucro ainda mudam muito a cada venda; estoque e parados já valem.

## Recomendação (uma frase por item, a mais importante)

Parado com estoque A/B → promoção, anúncio no ML ou devolver · lucro negativo → revisar custo/preço · vende (A/B) sem
estoque → repor · A com cobertura < 15 dias → pode faltar · A com lucro C ou margem < 15% → revisar preço · AX → manter
mínimo · AZ → venda pontual, não estocar além · cobertura > 4× o período → comprar menos.

## Onde é usada

- Tela Estoque › Curva ABC (troca de curva e filtros no navegador; regra copiada no front).
- Inventário rotativo: a frequência de recontagem (A 30 dias, B 90, C 180) usa a classe de venda dos últimos 90 dias.

## Onde focar (Estoque › Onde focar, 2026-11-21)

- **Quadrantes por categoria (do topo):** vende bem = 10%+ do faturamento ou tem item A; margem boa = pelo menos a margem
  alvo das Regras de venda (sem venda, a margem de tabela ponderada pelo estoque); parado alto = R$ 500+ e 60%+ do estoque.
  Proteger (vende + margem) · Rever preço (vende, margem baixa) · Divulgar (parado, margem boa) · Liquidar (parado, margem
  baixa) · Acompanhar.
- **Propaganda:** parados com R$ 50+ em estoque e margem de tabela 10 pontos acima da mínima; ordem = valor parado ×
  margem; desconto máximo = o que ainda deixa a margem mínima (preço mínimo = custo ÷ (1 − mínima)); sugerido = até 15%,
  para baixo em 5%. Texto pronto para WhatsApp (não muda o cadastro).
- **Chamarizes:** A com frequência X/Y e estoque. **Repor:** A/B sem estoque ou cobertura < 15 dias. **Não recomprar:**
  cobertura > 4× o período (R$ 100+) ou parado com estoque A/B.
- **Foto mensal** (`estoque_curva_abc_fotos`): curva de 90 dias de cada item, tirada no primeiro acesso do mês à curva ou ao
  Onde focar; a evolução (subiram para A / caíram de A) compara com a foto do mês anterior.
- **PDF do mês:** resumo, quadrantes, propaganda, compras, evolução e os fundos de reposição.

## Fundos de reposição (Financeiro › Fundos de reposição, 2026-11-21)

Dinheiro que o dono separa do capital de giro para recomprar itens caros (fios/cabos PP, bombas, irrigação, rolamentos,
óleos). Cada fundo tem categorias (a subcategoria herda), percentual do custo (padrão 100%), saldo inicial e data de início.
Entradas = custo das vendas das categorias (× percentual) − devoluções; saídas = compras pela NF (entrada aprovada e
correções); ajustes à mão. Nada disso é gravado: é calculado das vendas e notas. Compra que deixa o saldo negativo foi
paga com o giro (aviso). **Data de início = hoje** ao criar (uma data antiga tira do fundo as compras antigas, como a carga
inicial do estoque). Regras em `areas/financeiro/reservas/reservasReposicao.ts`.

## Marcas e equivalentes (Estoque › Marcas e equivalentes, 2026-11-21)

Exemplo que motivou: bomba 0,75 HP é a que mais sai, mas a Tetis encalha (o cliente prefere Ebara) e trava o estoque.

- **Atributo que define equivalência** (`atributos_comercial.define_equivalencia`): itens da **mesma categoria** com os mesmos
  valores em todos os atributos marcados que o item tem formam um grupo de equivalentes (valores normalizados: "0,75" = "0.75").
  Só vira grupo com 2+ origens diferentes (marca; sem marca, a família). A marca "Sem Marca" conta como sem marca.
  Marcados de início: potência (HP) da bomba, código do rolamento, perfil e número da correia, viscosidade. O modelo da
  marca (ex.: 3BPS2-14) não se marca. Tamanho/tensão da bomba ainda estão só no nome da família.
- **Quem vende e quem trava:** participação de cada item nas vendas (quantidade) e no estoque do grupo. VENDE = o que mais
  vendeu; TRAVA = tem 50%+ do estoque do grupo e menos da metade dessa participação nas vendas. Confiança pelo nº de vendas
  do grupo (< 5 fraco, 5–14 médio, 15+ forte). Preço para escoar = 10% abaixo do que mais vende, nunca abaixo do mínimo pela
  margem mínima.
- **Decisão de compra** (`comercial_produtos_dados.decisao_compra`: PREFERIDO / NAO_RECOMPRAR, com motivo, data e quem):
  "não recomprar" sai do Repor e entra no Não recomprar do Onde focar; "preferido" nunca vai para o Não recomprar. Decisão
  contrária aos números aparece como aviso no grupo.
- **Demanda por atributo** (todas as marcas somadas: o que manter) e **giro por marca** (vendido ÷ estoque médio).
- **Cadastro pendente:** itens das categorias com grupos sem marca ou sem atributo de equivalência.
- Próximo: substituto no PDV ("sem estoque da Ebara: tem Tetis equivalente") e sugestão de equivalente na reposição.

## Próximos passos combinados

- Usar a curva no estoque mínimo sugerido, na lista de compras, no PDV/catálogo (selo) e no Mercado Livre (anunciar parados e A).
