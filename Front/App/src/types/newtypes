// =================================================================
// 1. Catálogo (Produto e Serviço)
// Reflete os itens disponíveis para venda.
// =================================================================
// 1.1: Produto (O que está no estoque/catálogo)
export interface Produto {
    subcategoriaNome: string | undefined;
    categoriaNome: string;
    imagemURL: string;
    id: string;
    sku: string;
    nome: string;
    pictureUrl: string;

     // ATUALIZAÇÕES NECESSÁRIAS PARA A TABELA:
   
    subcategoriaId?: string; // NOVO: Para a coluna 'Sub-Categoria'
    fornecedorNome?: string; // NOVO: Para a coluna 'Fornecedor'

    // Usaremos apenas o ID da categoria, como sugerido pela sua FK no DB
    categoriaId: string; 
    precoUnitario: number; // Preço atual no catálogo (era 'price')
    estoque: number;      // Era 'stock'
    estoqueMinimo?: number; // Adicionado do DB
    localizacaoEstoque?: string; // Adicionado do DB
    status: 'Ativo' | 'Inativo' | 'Baixo Estoque';
}
// 1.2: Serviço (O que está no catálogo de serviços)
// Esta classe é fundamental e estava implícita no seu ServiceItem
export interface Servico {
    id: string;
    nome: string;
    descricao: string;
    valorBase: number; // Valor base do serviço
}
// =================================================================
// 2. Cliente
// (Baseado nos seus campos 'clientName' e 'clientDetails')
// =================================================================
export interface Cliente {
    id: string;
    nome: string;      // Era 'clientName'
    documento: string; // Detalhe importante do cliente
    email: string;
    telefone: string;
    endereco: string;  // Pode ser parte do 'clientDetails'
}
// =================================================================
// 3. ItemOrdem (O Segredo do Histórico)
// Representa CADA linha da venda (era 'CartItem' e 'ServiceProduct').
// Usaremos um 'union type' para o tipo do item.
// =================================================================
export type ItemType = 'Produto' | 'Servico';
export interface ItemOrdem {
    
    id: string; 
    tipoItem: ItemType; 
    
    // Associações (Foreign Keys)
    produtoId?: string; // FK para Produto
    servicoId?: string; // FK para Servico
    // Snapshot dos dados no momento da venda (essencial para o histórico!)
    nome: string;       // Nome do item/serviço vendido (era 'name')
    sku?: string;       // SKU, se for um produto (era 'sku')
    
    quantidade: number;
    precoPraticado: number; // Preço unitário no momento da compra (era 'price')
    subtotal: number;       // total (precoPraticado * quantidade)
}
// =================================================================
// 4. OrdemVenda (O Cabeçalho da Transação)
// Esta substitui e aprimora sua 'ServiceItem'
// =================================================================
export interface OrdemVenda {

  
    clientDetails?: string; // NOVO: Para exibir detalhes do cliente
    
    // ATUALIZAÇÃO CRÍTICA: items deve ser ItemOrdem[]
    items: ItemOrdem[]; 
    
    responsible: string; // Nome do responsável/técnico (Era 'responsible')

    clientName: string;
    id: string;
    orderNumber: string;
    // Relação com Cliente (Chave Estrangeira)
    clienteId: string;
    // Opcional: Você pode manter o objeto Cliente inteiro se for uma referência populada
    // cliente: Cliente; 
    // Informações da Ordem (Header)
       status: 'Pendente' | 'Concluído' | 'Cancelado' | 'Em Andamento';
    dataCriacao: Date; // Usamos Date para o histórico
    responsavel: string; // Era 'responsible'
    tags: string[];
    // Agendamento (Informações separadas do Serviço, mas mantidas na Ordem)
    // Se for uma ordem que envolve agendamento (serviço), essas informações são preenchidas
    dataAgendamento?: Date; // Combina 'day' e 'date' em um Date object
    horaAgendamento?: string; // Mantém a granularidade (era 'time')
    
    // Detalhes da Venda
    total: number;
    
    // Relações (Itens e Pagamentos)
    itens: ItemOrdem[];
    pagamentos: Pagamento[]; // Assumimos que a interface Pagamento será criada

    





     // CAMPOS QUE ESTAVAM FALTANDO NO SEU MOCK:
    
    // AQUI ESTÃO OS "AND 4 MORE" que você precisa identificar:
    tipoServico: string; // Exemplo de campo extra
    metodoPagamento: string; // Exemplo de campo extra
    observacoes?: string; // Opcional (não precisaria estar no mock)
    dataFinalizacao?: Date; // Opcional
}
// =================================================================
// 5. Pagamento (A ser criada, mas necessária para a OrdemVenda)
// =================================================================
export interface Pagamento {
    id: string;
    metodo: string;
    valor: number;
    dataPagamento: Date;
    // ... outros detalhes financeiros
}

export interface FiltroEstoque {
    // 1. Busca por texto (Nome, SKU, etc.)
    searchTerm: string;

    // 2. Filtro de Status do Produto (ativo/inativo)
    status: 'Todos' | 'Ativo' | 'Inativo' | 'Baixo Estoque';

    // 3. Filtros de Preço (mínimo e máximo)
    precoMinimo: number | ''; // Permite string vazia no input
    precoMaximo: number | '';

    // 4. Filtro de Categoria (baseado no nome populado ou ID)
    // Usamos string para o ID/Nome da categoria. Null ou 'Todas' para desativado.
    categoria: string | 'Todas';

    // 5. Filtros de Estoque (baseado na sua estrutura de DB)
    
    // Filtro para mostrar apenas itens abaixo do estoque mínimo
    mostrarSomenteBaixoEstoque: boolean; 

    // Filtro para filtrar por localização do estoque (opcional, se usar o campo 'localizacao_estoque')
    localizacao: string | 'Todas'; 
    // Busca e Identificação
    skuTerm: string;         // NOVO: Conectado ao 'SKU do produto'

    // Filtros Categóricos
    subcategoria: string | 'Todas'; // NOVO: Conectado à 'Sub-Categoria'
    fornecedor: string | 'Todas'; // NOVO: Conectado ao 'Fornecedor'

    // Filtros Numéricos
    estoqueMin: number | '';  // NOVO: Conectado à 'Quantidade em Estoque Min'
    estoqueMax: number | '';  // NOVO: Conectado à 'Quantidade em Estoque Max'
}

// types/types.ts (Adicione esta interface)
export interface FiltroServico {
    clientName: string;
    clientEmail: string;
    clientCpf: string;
    clientPhone: string;
    orderNumber: string; // ou 'orderId'
    status: string | 'Todos'; // Ex: 'Pendente', 'Concluído', 'Cancelado'
    serviceType: string | 'Todos'; // Ex: 'Instalação', 'Reparo'
    date: string; // Para filtrar por data (formato ISO string)
    paymentMethod: string | 'Todos';
}