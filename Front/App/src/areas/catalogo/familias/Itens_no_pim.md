# Arquitetura e Governança da Família de Itens no PIM (Catálogo Técnico e Industrial)

Este documento consolida o planejamento estratégico, as regras de comportamento, a hierarquia em cascata e o resultado dos testes de stress aplicados ao mix de produtos industriais e de e-commerce.

---

## 1. Visão Geral da Arquitetura em Cascata

A árvore de dados do PIM separa claramente a **Navegação Comercial** da **Taxonomia Técnica**, utilizando um modelo em cascata onde a inteligência flui de cima para baixo.

### A Hierarquia de Níveis (Do Macro ao Micro):
1. **Nível 1: Departamento / Categoria Macro**
   * *Exemplo:* `B2B Industrial`, `Eletrônicos`, `Casa e Decoração`.
   * *Função:* Separa grandes áreas de negócio e equipes responsáveis.
2. **Nível 2: Subcategoria Técnica (O Guardião do DNA Base / Material)**
   * *Exemplo:* `Transmissão Mecânica > Rolamentos Radiais` ou `Condução de Fluidos > Mangueiras Hidráulicas`.
   * *Função:* Define o **DNA estrutural macro** (normas de construção, séries ou matérias-primas essenciais, ex: *Aço Galvanizado*, *Poliamida PA 12*, *Série 6200*).
3. **Nível 3: Família (O Gerenciador de Grade e Variações)**
   * *Exemplo:* `Rolamentos de Esferas com Blindagem Metálica` ou `Mangueiras Hidráulicas SAE 100 R2`.
   * *Função:* Herda o DNA da categoria pai e injeta as regras de **Grade Comercial**, variações dimensionais e atributos obrigatórios de ficha técnica.
4. **Nível 4: SKU / Item (Filho ou Individual)**
   * *Filho com Variação:* O produto transacional com SKU próprio que compõe uma grade (ex: *Rolamento 6204-2RS*).
   * *SKU Individual (Stand-alone):* Um item único (ex: *Kit de Reposição* ou *Peça Avulsa*) que se comporta como uma "família de um item só", herdando a ficha técnica sem gerar grades comerciais.

---

## 2. Regras de Governança, Dependências e Comportamentos

Para garantir total liberdade aos administradores sem quebrar a integridade do catálogo ou enviar dados inconsistentes para marketplaces e e-commerce, o PIM deve seguir estas regras:

### A. Regras de Integridade e Saúde da Família
* **Validação de Atributos Chave de Variação:** Toda família deve possuir ao menos um atributo marcador de grade/variação. Se um administrador remover todos os atributos definidores, o sistema emite um alerta técnico e bloqueia a criação de novos SKUs filhos e a publicação dos existentes.
* **Modo Manutenção / Rascunho da Família:** Permite que administradores esvaziem ou reestruturem uma família sem quebrar o site. Quando a família entra em "Rascunho", o PIM retira automaticamente do ar os produtos vinculados via feed de exportação até que as regras mínimas sejam atendidas novamente.
* **Inativação Automática por Inconsistência:** Se atributos obrigatórios globais forem desvinculados, o PIM altera o status da família para *"Inativa por Inconsistência Cadastral"*, despublicando em cascata todos os SKUs conectados.

### B. O Mecanismo de Fallback e Despromoção (DNA/Grade $\rightarrow$ Ficha Técnica)
* **Preservação de Dados Históricos:** Se um atributo que antes era *DNA* ou *Grade* for removido da regra da Família, **o PIM não apaga o valor preenchido nos SKUs filhos**. 
* **Conversão de Escopo:** O sistema automaticamente despromove o atributo para a camada de *Atributo Estático / Ficha Técnica* daquele SKU, salvando o operador de refazer o trabalho e evitando a perda de especificações técnicas.

---

## 3. Teste de Stress Aplicado ao Mix Industrial

A aplicação prática da arquitetura nas categorias do seu portfólio demonstrou o seguinte comportamento:

### 1. Rolamentos e Correias (Transmissão Mecânica)
* **Categoria / DNA:** Série ou Norma (ex: *Série 6200*, *Perfil A/B*).
* **Família / Grade:** Variações de dimensões, diâmetros ou tipos de blindagem (`ZZ`, `2RS`, `C3`).
* **Comportamento:** Perfeito. O DNA impede misturar normas/séries e a família comanda as grades dimensionais.

### 2. Retentores, Gaxetas e Anéis O-Ring (Vedações)
* **Categoria / DNA:** Material base / Elastômero (ex: *NBR*, *Viton*, *Silicone*).
* **Família / Grade:** Medidas exatas de Eixo $\times$ Alojamento $\times$ Altura (retentores) ou diâmetro interno $\times$ seção (O-rings).
* **Comportamento:** Aprovado. Isola o material no topo (DNA) e foca na geometria na família.

### 3. Mangueiras Hidráulicas, Tubos PU / PA 12 e Flexíveis de Freio
* **Categoria / DNA:** Norma construtiva e matéria-prima exata (ex: *SAE 100 R2*, *Poliuretano PU* vs *Poliamida PA 12*).
* **Família / Grade:** Bitola, diâmetro interno/externo, pressão máxima e cor.
* **Comportamento:** Excelente para separar claramente os polímeros e normas antes de gerar as grades de bitola.

### 4. Conjuntos de Bombas, Peças de Reposição e Kits
* **Conjunto de Bombas (Motor + Bombeador):** Tratado como produto composto/pai-filho complexo, herdando fichas técnicas combinadas de vazão e potência.
* **Peças de Reposição e Kits:** Tratados como **SKUs Individuais (Stand-alone)**. Pularão a grade comercial, mas herdarão compulsoriamente os atributos de compatibilidade e ficha técnica da categoria pai, impedindo publicações sem dados essenciais.