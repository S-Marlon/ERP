import React, { useState } from "react";
import { Link } from "react-router-dom"; 
import "./ObrasModule.css";

// IMPORTAÇÕES DE COMPONENTES DE UI/LAYOUT
import Button from "../../components/ui/Button/Button";
import FlexGridContainer from "../../components/Layout/FlexGridContainer/FlexGridContainer";
import Typography from "../../components/ui/Typography/Typography";
import TypeSwitch from "../../components/ui/TypeSwitch";
import TabButton from "../../components/ui/TabButton/TabButton";

// IMPORTAÇÕES DE COMPONENTES ESPECÍFICOS DE BUSCA E MÓDULO
import SearchDashboard from "./Components/SearchDashboard";
import { ObraDetalhes } from "./Components/ObraDetalhes";

// **CORREÇÃO:** Importando o componente e as interfaces de tipo
import ClienteSelect, { Cliente } from '../../components/forms/CadastroContrato/BuscaCliente';
import ContratoSelectTabs, { Contrato } from "../../components/forms/CadastroContrato/BuscaContrato";
import PocoSelectTabs, { Poco } from "../../components/forms/CadastroContrato/BuscaPoco";

// DEFINIÇÕES DE TIPO
type SearchType = 'Cliente' | 'Contrato' | 'Poço';


export const ObrasModule: React.FC = () => {
    // ESTADOS GLOBAIS DE SELEÇÃO
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
    const [pocoSelecionado, setPocoSelecionado] = useState<Poco | null>(null);
    
    // ESTADO DE CARREGAMENTO E TIPO DE BUSCA ATIVO
    const [isSaving, setIsSaving] = useState(false); // Usado como loading externo
    const [activeSearchType, setActiveSearchType] = useState<SearchType>('Cliente');
    
    // Alias para o estado de loading
    const isLoading = isSaving; 

    // HANDLERS
    
    const handleClienteChange = (cliente: Cliente | null) => {
        setClienteSelecionado(cliente);
        // console.log('Cliente selecionado mudou:', cliente); // console.log removido
    };

    const handleContratoChange = (contrato: Contrato | null) => {
        setContratoSelecionado(contrato);
    };

    const handlePocoChange = (poco: Poco | null) => {
        setPocoSelecionado(poco);
    };

    // Handler: Atualiza o tipo de busca (Cliente/Contrato/Poço)
    const handleSearchTypeChange = (type: SearchType) => {
        setActiveSearchType(type);
        // Lógica opcional para limpar seleções ao mudar o filtro de busca
    };

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
                    template="2fr 1fr 4fr 1fr"
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
                        {activeSearchType === 'Contrato' && (
                            <ContratoSelectTabs
                contratoSelecionado={contratoSelecionado}
                onContratoSelecionadoChange={handleContratoChange}
                isLoading={isSaving} // Exemplo de uso de uma prop de carregamento
            />
                        )}

                        {activeSearchType === 'Poço' && (
                            <PocoSelectTabs
                pocoSelecionado={pocoSelecionado}
                onPocoSelecionadoChange={handlePocoChange}
                isLoading={isSaving} // Opcional: passa o estado de carregamento
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