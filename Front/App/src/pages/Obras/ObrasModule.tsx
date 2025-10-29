import React, { useState } from "react";
import { Link } from "react-router-dom"; 
import "./ObrasModule.css";

// IMPORTAÇÕES
import Button from "../../components/ui/Button";
import SearchDashboard from "./Components/SearchDashboard";
import { ObraDetalhes } from "./Components/ObraDetalhes";
import FlexGridContainer from "../../components/Layout/FlexGridContainer/FlexGridContainer";
import Typography from "../../components/ui/Typography";
// Assumindo que o ClienteSelect também exporta a interface Cliente
import ClienteSelect, { Cliente } from '../../components/forms/CadastroContrato/BuscaCliente';
import TypeSwitch from "../../components/ui/TypeSwitch";
import TabButton from "../../components/ui/TabButton";

// DEFINIÇÕES DE TIPO FORA DO COMPONENTE PARA MELHOR ESCOPO
type SearchType = 'Cliente' | 'Contrato' | 'Poço';


export const ObrasModule: React.FC = () => {
    // ESTADOS GLOBAIS DO MÓDULO OBRAS
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    const [isSaving, setIsSaving] = useState(false); // Usado como loading externo
    
    // ESTADO PARA O FILTRO CLIENTE/CONTRATO/POÇO
    const [activeSearchType, setActiveSearchType] = useState<SearchType>('Cliente');
    // NOVO ESTADO: Para armazenar o termo de busca

    // HANDLERS
    const handleClienteChange = (cliente: Cliente | null) => {
        setClienteSelecionado(cliente);
        console.log('Cliente selecionado mudou:', cliente);
    };


    // NOVO HANDLER: Atualiza o tipo de busca (Cliente/Contrato/Poço)
    const handleSearchTypeChange = (type: SearchType) => {
        setActiveSearchType(type);
        // **RESETAR TERMO DE BUSCA AO MUDAR O TIPO DE BUSCA É UMA BOA PRÁTICA**
    };

    // Usamos 'isSaving' como nosso estado de loading para os botões
    const isLoading = isSaving; 



    return (
        <div>
            {/* (A) PAGE HEADER */}
            <header className="page-header">
                <div className="title-section">
                    <Typography variant="h1">{'Módulo Obras" ou "Gerenciamento de Projetos/Obras'}</Typography>
                    <div
                        className="action-buttons-global"
                        style={{ display: "flex", gap: "10px" }}
                    >
                        {/* Botões de navegação usando Link e estilizados  */}
                        <Link to="/clientes/novo"><Button variant='primary'>+ Novo Cliente</Button></Link>
                        <Link to="/contratos/novo"><Button variant='secondary'>+ Novo Contrato</Button></Link>
                        <Link to="/pocos/novo"><Button variant='outline'>+ Novo relatorio de Poço</Button></Link>
                    </div>
                </div>
            </header>

            {/* (B) PAGE CONTENT */}
            <main className="layout-container">

                <FlexGridContainer 
                    layout="grid" 
                    gap="5px" 
                    template="2fr 1.5fr 4fr 1fr"
                    mobileTemplate="1fr" 
                >
                    <div>
                        <Typography variant="h4">{'Buscar Por:'}</Typography>

                        {/* BLOCO CORRIGIDO: Agora as variáveis estão no escopo */}
                        <TypeSwitch>
                            {(['Cliente', 'Contrato', 'Poço'] as SearchType[]).map((searchType) => (
                                <TabButton
                                    key={searchType} 
                                    label={searchType} 
                                    isActive={activeSearchType === searchType} 
                                    onClick={() => handleSearchTypeChange(searchType)}
                                    disabled={isLoading} // 'isLoading' agora usa 'isSaving'
                                    // CRUCIAL: Configurações para que o TabButton atue como um switch/filtro:
                                    isTab={false}    // Desativa role="tab" e aria-selected
                                    variant="switch"   // Aplica o estilo de switch/grupo
                                />
                            ))}
                        </TypeSwitch>

                        {/* ClienteSelect (Busca o Cliente) */}
                        {/* Opcional: Mostrar ClienteSelect apenas quando activeSearchType for 'Cliente' */}
                        {activeSearchType === 'Cliente' && (
                            <ClienteSelect
                                clienteSelecionado={clienteSelecionado}
                                onClienteSelecionadoChange={handleClienteChange}
                                isLoading={isSaving} // Usamos 'isSaving' como loading
                            />
                        )}
                        
                        {/* ** NOVO CONTEÚDO DINÂMICO APARECE AQUI ** */}
                        {/* Você precisará de um campo de input (que deve estar no SearchDashboard ou aqui) para setar 'searchTerm' */}
                        {/* Exemplo para testar a renderização: */}
                        {/* Apenas para demonstração, você deve adicionar um input de busca real */}
                        {/* FIM DO NOVO CONTEÚDO DINÂMICO */}

                    </div>
                    
                    <SearchDashboard />
                    <ObraDetalhes />

                    <div>
                        <Button variant="outline">➕ Novo Registro de Tempo</Button>
                        <Button type="button" variant="outline">
                            📝 Editar Dados Gerais do Poço 
                        </Button>
                        <Button type="button" variant="primary">
                            📋 Gerar Relatório Completo (PDF) 
                        </Button>
                        <Button type="button" variant="outline">
                            🖨️ Imprimir Relatório do Poço
                        </Button>
                        <Button type="button" variant="outline">
                            📤 Compartilhar Relatório do Poço
                        </Button>
                        <Button type="button" variant="outline">
                            ⚙️ Configurações Avançadas do Relatório
                        </Button>
                    </div>
                </FlexGridContainer>
            </main>
            {/* (C) PAGE FOOTER (Opcional) */}
            <footer className="page-footer"></footer>
        </div>
    );
};