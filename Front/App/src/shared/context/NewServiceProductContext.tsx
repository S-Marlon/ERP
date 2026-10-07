// 1. Importe o novo tipo
import { Servico } from "../types/newtypes"; // Ajuste o caminho conforme necessário
import React, { createContext, useState, useEffect, ReactNode } from 'react';

// 2. Defina a nova Interface do Contexto
interface ServiceProductContextType {
    // Agora o array de serviços é do tipo Servico[]
    services: Servico[]; 
    // ... outras propriedades/funções
}

// 3. Crie o Contexto (tipado com a nova interface)
export const ServiceProductContext = createContext<ServiceProductContextType | undefined>(undefined);

// 4. Implemente o Provider
export const ServiceProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // O estado agora é tipado como Servico[]
    const [services, setServices] = useState<Servico[]>([]);

    useEffect(() => {
        // TODO: Mantenha ou ajuste sua lógica de carregamento/mock para retornar o tipo Servico[]
        const loadedServices: Servico[] = [
           {
                id: 'S001',
                nome: 'Instalação de Sistema Operacional',
                descricao: 'Formatação e instalação de Windows ou Linux.',
                valorBase: 150.00, // << Importante: usa valorBase
            },
            {
                id: 'S002',
                nome: 'Diagnóstico Técnico',
                descricao: 'Verificação completa de hardware e software (taxa inicial).',
                valorBase: 50.00,
            },
            {
                id: 'S003',
                nome: 'Manutenção Preventiva',
                descricao: 'Limpeza interna e troca de pasta térmica.',
                valorBase: 90.00,
            },
            {
                id: 'S004',
                nome: 'Instalação de Rede Local',
                descricao: 'Configuração de rede e cabeamento simples.',
                valorBase: 350.00,
            },
        ];
        setServices(loadedServices);
    }, []);

    const contextValue: ServiceProductContextType = {
        services,
    };

    return (
        <ServiceProductContext.Provider value={contextValue}>
            {children}
        </ServiceProductContext.Provider>
    );
};