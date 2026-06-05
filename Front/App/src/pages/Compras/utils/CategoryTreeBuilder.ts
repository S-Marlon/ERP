// mappers/CategoryTreeBuilder.ts
export interface Category {
  id: string;
  name: string;
  children?: Category[];
}

// Interface para os dados brutos que JÁ SÃO uma árvore
interface RawTreeCategory {
  id: number | string; // O ID pode vir como número
  name: string;      // O nome do campo é 'name' (pelo seu log)
  children?: RawTreeCategory[];
}

export class CategoryTreeBuilder {

  /**
   * Converte uma estrutura de árvore bruta (RawTreeCategory[]) em
   * um formato de árvore limpo (Category[]) para o frontend.
   * * @param rawCategories A lista de categorias raiz já em formato de árvore da API.
   */
  public static mapRawTreeToCleanTree(rawCategories: RawTreeCategory[]): Category[] {
    
    // Mapeamento recursivo para formatar os nós
    return rawCategories.map(item => {
      
      const category: Category = {
        id: String(item.id), // Garante que o ID é string
        name: item.name || `Categoria ID ${String(item.id)} (Nome Ausente)`, // Garante o nome
      };
      
      // Se houver filhos, mapeia recursivamente
      if (item.children && item.children.length > 0) {
        category.children = CategoryTreeBuilder.mapRawTreeToCleanTree(item.children);
      }
      
      // Retorna o objeto (a propriedade 'children' é omitida automaticamente 
      // se não for definida/atribuída, satisfazendo o requisito children?: Category[])
      return category;
    });
  }
}