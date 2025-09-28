// 1. Importe o novo tipo
import { Produto } from "../types/newtypes"; // Ajuste o caminho conforme necessário
import React, { createContext, useState, useEffect, ReactNode } from 'react';

// 2. Defina a nova Interface do Contexto
interface ProductContextType {
    // Agora o array de produtos é do tipo Produto[]
    products: Produto[]; 
    // Você pode manter outras funções se existirem, ex:
    // loading: boolean;
    // addProduct: (product: Produto) => void; 
}

// 3. Crie o Contexto (tipado com a nova interface)
export const ProductContext = createContext<ProductContextType | undefined>(undefined);

// 4. Implemente o Provider (Onde os dados são carregados ou mockados)
export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // O estado agora é tipado como Produto[]
    const [products, setProducts] = useState<Produto[]>([]);

    useEffect(() => {
        // TODO: Mantenha ou ajuste sua lógica de carregamento/mock para retornar o tipo Produto[]
        // Exemplo: Simulação de carregamento de dados já no formato Produto
        const loadedProducts: Produto[] = [
          {
                id: 'P001',
                sku: 'TEC-MEC',
                nome: 'Teclado Mecânico RGB',
                precoUnitario: 250.50,
                estoque: 45,
                status: 'Ativo',
                categoriaId: 'CAT01',
                categoriaNome: 'Periféricos',
                subcategoriaNome: 'Teclados',
                imagemURL: 'url-teclado.jpg',
                pictureUrl: 'url-teclado-small.jpg',
            },
            {
                id: 'P002',
                sku: 'MON-32LED',
                nome: 'Monitor LED 32 Polegadas',
                precoUnitario: 1200.00,
                estoque: 5,
                estoqueMinimo: 10,
                status: 'Baixo Estoque',
                categoriaId: 'CAT02',
                categoriaNome: 'Monitores',
                subcategoriaNome: 'Gaming',
                imagemURL: 'url-monitor.jpg',
                pictureUrl: 'url-monitor-small.jpg',
                fornecedorNome: 'TecnoCorp',
            },
            {
                id: 'P003',
                sku: 'CAB-HDMI',
                nome: 'Cabo HDMI 4K (2 metros)',
                precoUnitario: 45.90,
                estoque: 200,
                status: 'Ativo',
                categoriaId: 'CAT03',
                categoriaNome: 'Cabos',
                subcategoriaNome: 'Vídeo',
                imagemURL: 'url-cabo.jpg',
                pictureUrl: 'url-cabo-small.jpg',
            },
            
        ];
        setProducts(loadedProducts);
    }, []);

    const contextValue: ProductContextType = {
        products,
    };

    return (
        <ProductContext.Provider value={contextValue}>
            {children}
        </ProductContext.Provider>
    );
};