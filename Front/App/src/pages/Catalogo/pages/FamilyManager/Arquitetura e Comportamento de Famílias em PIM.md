Planejamento Arquitetural: Organização e Comportamento de Famílias em um Sistema PIM

Este documento consolida a estratégia de modelagem de dados, hierarquia em cascata, regras de dependência, herança e comportamentos dinâmicos para catálogos técnicos complexos (misturando Casa/Decoração, Eletrônicos e B2B Industrial como rolamentos, bombas e abraçadeiras).

1. Visão Geral da Hierarquia em Cascata (Do Macro ao Micro)

Para garantir flexibilidade sem perder o controle de qualidade, a árvore de dados do PIM foi estruturada em um modelo descendente onde a inteligência flui de cima para baixo:

Nível Macro: Departamento / Categoria Raiz

Exemplo: B2B Industrial, Eletrônicos, Casa e Decoração.

Função: Separa o modelo de negócio e grandes equipes.

Nível Intermediário: Categoria / Subcategoria Técnica (O Guardião do DNA)

Exemplo: Abraçadeiras de Aço Galvanizado, Rolamentos Radiais de Esfera.

Função: Define o escopo técnico macro, a norma estrutural e o DNA (ex: material base ou série de engenharia).

Nível Operacional: Família de Produtos

Função: Agrupa as variações específicas de DNA numérico/dimensional (ex: numeração base), define as regras de Grade Comercial e herda os atributos de ficha técnica da categoria pai.

Nível Transacional: SKU / Item (Filho ou Individual)

Função: O produto comprável final. Herda todas as regras acima e armazena os valores numéricos e textuais finais.

2. Matriz de Atributos e Regras de Comportamento

Para evitar cadastros incompletos e proteger canais de venda (E-commerce e Marketplaces), o PIM opera com três tipos principais de atributos e regras estritas:

Tipos de Atributos:

DNA: Essência estrutural ou material base (ancorado na Categoria/Família, ex: material, série, norma técnica).

Grade / Variação: Eixos que geram variações comerciais (ex: medidas, blindagem, voltagem).

Ficha Técnica (Especificações): Atributos descritivos comuns que complementam o item sem gerar variações de exibição.

Regras de Integridade e Governança:

Modo Manutenção / Rascunho da Família: Permite que administradores limpem ou reestruturem atributos de uma família sem quebrar o e-commerce de forma abrupta. Enquanto em rascunho, a família e seus SKUs são retirados dos feeds de exportação.

Fallback Inteligente de Atributos (Despromoção):

Se um atributo considerado DNA ou Grade for removido de uma Família, o sistema não apaga os dados já preenchidos nos SKUs filhos.

O PIM converte automaticamente esse atributo em uma Ficha Técnica Estática do SKU, preservando o histórico de engenharia e evitando perda de trabalho.

Bloqueio de Publicação (Gatekeeper): SKUs que nascerem sem os atributos obrigatórios exigidos pela cascata ficam com status pendente e têm a exportação bloqueada para marketplaces.

3. Tratamento de SKUs Individuais (Itens "Stand-Alone")

Nem todo produto possui variações complexas de grade. O PIM deve prever o comportamento para itens únicos:

Herança Direta: O SKU individual pula a etapa de variação de grade comercial, mas herda obrigatoriamente o DNA da categoria e os atributos de ficha técnica da família.

Família Virtual: O sistema trata o item único como uma "família de um filho só" no back-end, mantendo a consistência das regras de validação e o bloqueio contra dados faltantes.

4. Benefícios Deste Modelo

Liberdade com Segurança: A equipe pode alterar a estrutura de atributos à vontade, sabendo que o PIM possui redes de segurança automáticas (como a despromoção para ficha técnica e inativação em cascata).

Padronização para SEO e Marketplaces: Atributos herdados garantem títulos padronizados e mapeamento de categorias centralizado.

Escalabilidade Técnica: Ideal para catálogos industriais densos onde o erro humano de cadastro pode gerar prejuízos logísticos severos.