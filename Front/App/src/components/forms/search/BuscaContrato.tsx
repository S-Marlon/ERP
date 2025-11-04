// BuscaContrato.tsx (Corrigido)
import React, { useCallback } from 'react';

// Importa o componente genérico e seus tipos
import EntitySelectTabs, { EntitySelectProps } from '../../EntitySelectTabs'; 

// Importações de UI necessárias para as funções de renderização
import Button from '../../ui/Button/Button';
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import Typography from '../../ui/Typography/Typography';
import ResultItem from '../../ui/ResultItem';
import Badge from '../../ui/Badge/Badge';
import Fieldset from '../../ui/Fieldset/Fieldset';

// 🚨 IMPORTAÇÃO DO MOCK CENTRALIZADO
import { CONTRATOS_MOCK, ContratoMock } from '../../../data/entities/clients'; 

// ----------------- 1. TIPOS ESPECÍFICOS DE CONTRATO -----------------

type ContratoTipo = 'Serviço' | 'Obra' | 'Fornecimento';
// 🚨 Usando 'export' aqui para que o ObrasModule possa importar
export type Contrato = { 
    id: string; 
    numero: string; 
    titulo: string; 
    dataAssinatura: string; 
    valor: number; 
    tipo: ContratoTipo; 
    status: 'Ativo' | 'Concluido' | 'Cancelado' | 'Pendente';
    fk_cliente_id: number;
};

type ContratoSearchKey = 'numero' | 'titulo' | 'fk_cliente_id' | 'status';
type ContratoTypeFilter = ContratoTipo | 'TODOS';


// ----------------- 2. FUNÇÕES AUXILIARES E DE BUSCA (Mantidas) -----------------

/**
 * Função auxiliar para formatação de moeda.
 */
const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/**
 * Função auxiliar para mapeamento de cores.
 */
const getStatusColor = (status: Contrato['status']): 'success' | 'warning' | 'default' | 'danger' => {
    switch (status) {
        case 'Ativo': return 'success';
        case 'Pendente': return 'warning';
        case 'Concluido': return 'default';
        case 'Cancelado': return 'danger';
        default: return 'default';
    }
}

/**
 * Função de Adaptação e Busca (fetchContratos - Mantida)
 */
const fetchContratos = async (query: string, tab: ContratoSearchKey, typeFilter: ContratoTypeFilter): Promise<Contrato[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // ... (Lógica de adaptação e filtragem mantida)
            const allData: Contrato[] = CONTRATOS_MOCK.map((mock, index) => {
                const tipoSimulado: ContratoTipo = index % 3 === 0 ? 'Serviço' : index % 3 === 1 ? 'Obra' : 'Fornecimento';
                const clienteIdNumber = mock.clienteId 
                    ? Number(mock.clienteId.replace('cli-', '')) 
                    : 0; 
                const numeroSimulado = mock.id.replace('cont-', 'C-2024/');
                
                return {
                    id: mock.id,
                    numero: numeroSimulado, 
                    titulo: mock.titulo,
                    dataAssinatura: mock.dataAssinatura || 'N/A',
                    valor: mock.valorTotal ?? 0,
                    tipo: tipoSimulado, 
                    status: mock.status ?? 'Pendente',
                    fk_cliente_id: clienteIdNumber, 
                } as Contrato; 
            });

            const lowerQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');

            const filteredData = allData.filter(contrato => {
                // Filtro 1: Tipo de Contrato
                if (typeFilter !== 'TODOS' && contrato.tipo !== typeFilter) {
                    return false;
                }

                // Filtro 2: Termo de Busca
                if (!query) return true;

                let valueToSearch: string | number;

                if (tab === 'fk_cliente_id') {
                    valueToSearch = String(contrato.fk_cliente_id);
                } else if (tab === 'status') {
                    valueToSearch = contrato.status;
                    return valueToSearch.toLowerCase().includes(query.toLowerCase());
                } else {
                    valueToSearch = (contrato as any)[tab];
                }

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


// ----------------- 3. RENDERIZAÇÕES ESPECÍFICAS (Mantidas) -----------------

const renderSelectedContrato = (contrato: Contrato, handleClear: () => void, isLoading: boolean) => (
    // ... (Markup mantido)
    <FlexGridContainer layout='flex' template='column'>
        <FlexGridContainer layout='flex' justifyContent='space-between' alignItems='flex-start' >
            <Fieldset legend={`Contrato Selecionado (${contrato.tipo}):`} variant='basic'>
                <Typography variant="strong">{contrato.titulo}</Typography>
            </Fieldset>
            <Button variant='danger' onClick={(e) => { e.stopPropagation(); handleClear(); }} disabled={isLoading}>
                Limpar Seleção
            </Button>
        </FlexGridContainer>

        <FlexGridContainer layout='flex' justifyContent='space-between' style={{marginTop: '10px'}}>
            <Fieldset legend='Número/ID' variant='basic'>
                <Typography variant="strong">{contrato.numero}</Typography>
            </Fieldset>
            <Fieldset legend='Valor Estimado' variant='basic'>
                <Typography variant="strong">{formatCurrency(contrato.valor)}</Typography>
            </Fieldset>
            <Fieldset legend='Status' variant='basic'>
                <Badge color={getStatusColor(contrato.status)}><Typography variant='strong'>{contrato.status}</Typography></Badge>
            </Fieldset>
        </FlexGridContainer>
    </FlexGridContainer>
);

const renderContratoResult = (contrato: Contrato, isSelected: boolean, handleSelect: (c: Contrato) => void) => (
    // ... (Markup mantido)
    <ResultItem
        key={contrato.id}
        onClick={() => handleSelect(contrato)}
        selected={isSelected}
    >
        <div className='flex-row' style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="strong">**{contrato.numero}** - {contrato.titulo}</Typography>
            <Badge color={getStatusColor(contrato.status)}><Typography variant='strong'>{contrato.status}</Typography></Badge>
        </div>
        <FlexGridContainer layout='flex' justifyContent="space-between" style={{ marginTop: '5px' }}>
            <Typography variant="small">Tipo: {contrato.tipo}</Typography>
            <Typography variant="small">Valor: {formatCurrency(contrato.valor)}</Typography>
            <Typography variant="small">Cliente ID: {contrato.fk_cliente_id}</Typography>
        </FlexGridContainer>
    </ResultItem>
);


// ----------------- 4. COMPONENTE WRAPPER PRINCIPAL (CORRIGIDO) -----------------

// Definições fixas e específicas da entidade Contrato (MOVIDAS PARA FORA)
const defaultContratoProps = {
    title: "**Busca de Contrato**",
    newEntityLink: "/contratos/novo",
    newEntityLabel: "Novo Contrato",
    defaultTypeFilter: 'TODOS' as ContratoTypeFilter,
    
    tabLabels: {
        numero: 'Número', 
        titulo: 'Título',
        fk_cliente_id: 'ID Cliente',
        status: 'Status',
    } as Record<ContratoSearchKey, string>,

    typeFilterOptions: [
        { key: 'Serviço', label: 'Serviço' },
        { key: 'Obra', label: 'Obra' },
        { key: 'Fornecimento', label: 'Fornecimento' },
        { key: 'TODOS', label: 'Todos' },
    ] as { key: ContratoTypeFilter, label: string }[],
    
    fetchEntities: fetchContratos,
    renderSelectedEntity: renderSelectedContrato,
    renderResultItem: renderContratoResult,
};

// Define as props que o componente ContratoSelect VAI RECEBER (Omitindo as que são padrão)
type ContratoSelectProps = Omit<
    EntitySelectProps<Contrato, ContratoSearchKey, ContratoTypeFilter>, 
    keyof typeof defaultContratoProps
>;


const ContratoSelect: React.FC<ContratoSelectProps> = (props) => {
    // Passa as props padrões (defaultContratoProps) e as props dinâmicas (props)
    return <EntitySelectTabs {...defaultContratoProps} {...props} />;
};

export default ContratoSelect;