import React, { useState, useCallback } from "react";
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

// **IMPORTAÇÕES DE COMPONENTES E TIPOS**
import ClienteSelect, { ClienteAPI as Cliente  } from '../../components/forms/search/BuscaCliente';
import ContratoSelectTabs, { Contrato } from "../../components/forms/search/BuscaContrato";
import PocoSelectTabs, { Poco } from "../../components/forms/search/BuscaPoco";

// DEFINIÇÕES DE TIPO
type SearchType = 'Cliente' | 'Contrato' | 'Poço';


export const ObrasModule: React.FC = () => {
    // ESTADOS GLOBAIS DE SELEÇÃO (OBJETOS COMPLETOS)
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    const [contratoSelecionado, setContratoSelecionado] = useState<Contrato | null>(null);
    const [pocoSelecionado, setPocoSelecionado] = useState<Poco | null>(null);
    
    // ** NOVOS ESTADOS PARA OS IDS (CHAVES PRIMÁRIAS) **
    const [clienteIdParaBackend, setClienteIdParaBackend] = useState<number | null>(null)
    const [contratoIdParaBackend, setContratoIdParaBackend] = useState<string | null>(null);
    const [pocoIdParaBackend, setPocoIdParaBackend] = useState<string | null>(null);
    
    // ESTADO DE CARREGAMENTO E TIPO DE BUSCA ATIVO
    const [isSaving, setIsSaving] = useState(false); // Usado como loading externo
    const [activeSearchType, setActiveSearchType] = useState<SearchType>('Cliente');
    
    const isLoading = isSaving; 

    // HANDLERS
    
   const handleClienteChange = useCallback((cliente: Cliente | null) => {
    // Atualiza o estado do objeto completo
    setClienteSelecionado(cliente);
    
    // Extrai o ID
    const id = cliente ? cliente.id_cliente : null;
    setClienteIdParaBackend(id);  // Atualiza o ID para ser enviado ao backend
    
    console.log(`✅ ID do Cliente pronto para o backend: ${id}`);
}, []);


    const handleContratoChange = useCallback((contrato: Contrato | null) => {
        // 1. Atualiza o estado do objeto completo
        setContratoSelecionado(contrato);

        // 2. Extrai o ID
        const id = contrato ? contrato.codigo_contrato : null;
        setContratoIdParaBackend(id); // <--- Contrato ID extraído
        
        console.log(`✅ ID do Contrato pronto para o backend: ${id}`);

        // Regra de limpeza: Se o Contrato muda, as seleções relacionadas abaixo dele são limpas
        if (id) {
            setPocoSelecionado(null);
            setPocoIdParaBackend(null);
        }
    }, []); // Dependências vazias

    const handlePocoChange = useCallback((poco: Poco | null) => {
        // 1. Atualiza o estado do objeto completo
        setPocoSelecionado(poco);

        // 2. Extrai o ID
        const id = poco ? poco.codigo : null;
        setPocoIdParaBackend(id); // <--- Poço ID extraído

        console.log(`✅ ID do Poço pronto para o backend: ${id}`);
    }, []); // Dependências vazias

    // Handler: Atualiza o tipo de busca (Mantido)
    const handleSearchTypeChange = (type: SearchType) => {
        setActiveSearchType(type);
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

                        {/* BLOCO TYPE SWITCH (Mantido) */}
                        <TypeSwitch>
                            {(['Cliente', 'Contrato', 'Poço'] as SearchType[]).map((searchType) => (
                                <TabButton
                                    key={searchType} 
                                    label={searchType} 
                                    isActive={activeSearchType === searchType} 
                                    onClick={() => handleSearchTypeChange(searchType)}
                                    disabled={isLoading}
                                    isTab={false}
                                    variant="switch"
                                />
                            ))}
                        </TypeSwitch>

                        {/* ClienteSelect */}
                        {activeSearchType === 'Cliente' && (
                            <ClienteSelect
                                entitySelecionada={clienteSelecionado}
                                onEntitySelecionadaChange={handleClienteChange}
                                isLoading={isSaving}
                            />
                        )}
                        
                        {/* ContratoSelectTabs */}
                        {activeSearchType === 'Contrato' && (
                            <ContratoSelectTabs
                                // Requer o objeto completo (Contrato | null)
                                entitySelecionada={contratoSelecionado}
                                // Handler que recebe o objeto completo
                                onEntitySelecionadaChange={handleContratoChange}
                                isLoading={isSaving}
                            />
                        )}

                        {/* PocoSelectTabs */}
                        {activeSearchType === 'Poço' && (
                            <PocoSelectTabs
                                // Requer o objeto completo (Poco | null)
                                entitySelecionada={pocoSelecionado}
                                // Handler que recebe o objeto completo
                                onEntitySelecionadaChange={handlePocoChange}
                                isLoading={isSaving}
                            />
                        )}
                        
                        {/* -------------------- VISUALIZAÇÃO DOS IDS PARA CONFIRMAÇÃO -------------------- */}
                        <div style={{ marginTop: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
                            <Typography variant="h5">Valores Atuais dos IDs (Pronto para Backend)</Typography>
                            <hr style={{margin: '10px 0'}} />
                            <Typography variant="small">ID Cliente: **{clienteIdParaBackend || 'Nenhum'}**</Typography><br/>
                            <Typography variant="small">ID Contrato: **{contratoIdParaBackend || 'Nenhum'}**</Typography><br/>
                            <Typography variant="small">ID Poço: **{pocoIdParaBackend || 'Nenhum'}**</Typography>
                        </div>
                        {/* ------------------------------------------------------------------------------- */}

                    </div>
                    
                    <SearchDashboard 
                        clienteId={clienteIdParaBackend}
                        contratoId={contratoIdParaBackend}
                        pocoId={pocoIdParaBackend}

                    
                    />
                    <ObraDetalhes 
                       
                       
                    />

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