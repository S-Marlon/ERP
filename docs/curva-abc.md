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

## Próximos passos combinados

- Foto mensal da classe de cada item (tabela própria, script a aprovar) para ver quem sobe e quem cai.
- Usar a curva no estoque mínimo sugerido, na lista de compras, no PDV/catálogo (selo) e no Mercado Livre (anunciar parados e A).
