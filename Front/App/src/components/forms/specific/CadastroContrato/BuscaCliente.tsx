// ClienteSelect.tsx (Novo arquivo)
import React, { useCallback } from 'react';
import EntitySelectTabs, { EntitySelectProps } from '../../../EntitySelectTabs'; 
import { CLIENTES_MOCK, ClienteMock } from '../../../../data/entities/clients'; 
import FlexGridContainer from '../../../Layout/FlexGridContainer/FlexGridContainer';
import Fieldset from '../../../ui/Fieldset/Fieldset';
import Button from '../../../ui/Button/Button';
import Typography from '../../../ui/Typography/Typography';
import ResultItem from '../../../ui/ResultItem';
import Badge from '../../../ui/Badge/Badge';
// ... Importações de UI necessárias para renderSelectedEntity e renderResultItem (Typography, Fieldset, Badge, Button, FlexGridContainer)

// ----------------- TIPOS ESPECÍFICOS DE CLIENTE -----------------
type Cliente = ClienteMock;
type ClienteSearchKey = 'nome' | 'documento' | 'telefone' | 'email' | 'cep';
type ClienteTypeFilter = 'CPF' | 'CNPJ' | 'AMBOS';

// Função de Busca Específica (usando a lógica do seu arquivo 01)
const fetchClientes = async (query: string, tab: ClienteSearchKey, typeFilter: ClienteTypeFilter): Promise<Cliente[]> => {
    // ... (Lógica de simulação de fetch e filtragem do arquivo 01)
    return new Promise((resolve) => {
        setTimeout(() => {
            let filteredData = CLIENTES_MOCK;
            const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

            filteredData = (CLIENTES_MOCK ?? []).filter(cliente => {
                // Filtro 1: Tipo de Cliente
                if (typeFilter !== 'AMBOS' && cliente.tipo !== typeFilter) {
                    return false;
                }

                // Filtro 2: Termo de Busca
                if (!query) return true;

                const valueToSearch = (cliente as any)[tab];
                if (typeof valueToSearch === 'string' || typeof valueToSearch === 'number') {
                    const stringValue = String(valueToSearch);
                    const cleanedValue = stringValue.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleanedValue.includes(lowerQuery);
                }
                return false;
            });

            resolve(filteredData);
        }, 300);
    });
};


// ----------------- RENDERIZAÇÕES ESPECÍFICAS DE CLIENTE -----------------

// 1. Renderização do Item Selecionado
const renderSelectedCliente = (cliente: Cliente, handleClear: () => void, isLoading: boolean) => (
    <FlexGridContainer layout='flex' template='column' gap='10px'>
        {/* ... (Todo o markup do Fieldset e Typography para o cliente selecionado do arquivo 01) */}
        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
            <Fieldset legend={`Cliente Selecionado (${cliente.tipo}):`} variant='basic'>
                <Typography variant="strong">{cliente.nome}</Typography>
            </Fieldset>
            <Button variant='danger' onClick={handleClear} disabled={isLoading}>Limpar Seleção</Button>
        </FlexGridContainer>
        {/* Detalhes do Cliente Selecionado (Documento, Telefone, CEP, Email) */}
        {/* ... */}
    </FlexGridContainer>
);

// 2. Renderização de um Item na Lista de Resultados
const renderClienteResult = (cliente: Cliente, isSelected: boolean, handleSelect: (c: Cliente) => void) => (
    <ResultItem
        key={cliente.id}
        onClick={() => handleSelect(cliente)}
        selected={isSelected}
    >
        {/* ... (Todo o markup do ResultItem para o cliente do arquivo 01) */}
        <div className='flex-row' style={{ justifyContent: 'space-between' }}>
            <Typography variant="strong">**{cliente.nome}** ({cliente.tipo})</Typography>
            <Typography variant="pMuted">{cliente.documento}</Typography>
        </div>
        <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
            <Typography variant="small">E-mail: {cliente.email}</Typography>
            <Badge color='info'><Typography variant='strong'>1 Contrato</Typography></Badge>
            {/* ... */}
        </FlexGridContainer>
    </ResultItem>
);


// ----------------- COMPONENTE WRAPPER -----------------
const ClienteSelect: React.FC<Omit<EntitySelectProps<Cliente, ClienteSearchKey, ClienteTypeFilter>, keyof typeof defaultProps>> = (props) => {
  const defaultProps = {
    title: "**Busca de Cliente**",
    newEntityLink: "/clientes/novo",
    newEntityLabel: "Novo Cliente",
    defaultTypeFilter: 'AMBOS' as ClienteTypeFilter,
    
    // Mapeamento das abas
    tabLabels: {
        nome: 'Nome',
        documento: 'Documento',
        telefone: 'Telefone',
        email: 'E-mail',
        cep: 'CEP',
    } as Record<ClienteSearchKey, string>,

    // Opções para o filtro de Tipo
    typeFilterOptions: [
        { key: 'CPF', label: 'CPF' },
        { key: 'CNPJ', label: 'CNPJ' },
        { key: 'AMBOS', label: 'Ambos' },
    ] as { key: ClienteTypeFilter, label: string }[],
    
    // Funções específicas (passadas como props)
    fetchEntities: fetchClientes,
    renderSelectedEntity: renderSelectedCliente,
    renderResultItem: renderClienteResult,
  };

  return <EntitySelectTabs {...defaultProps} {...props} />;
};

export default ClienteSelect;