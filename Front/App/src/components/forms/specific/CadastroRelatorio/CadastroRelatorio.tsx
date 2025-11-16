import React, { useState, FormEvent, useCallback } from 'react';
import Button from '../../../ui/Button/Button';
// Importação dos Módulos (Sub-formulários)
// Importação dos Componentes de Layout
import Column from './rigtsidebar';
import Tabss from './Left-sidebar';
import FlexGridContainer from '../../../Layout/FlexGridContainer/FlexGridContainer';
import ClienteSelect from '../../search/BuscaCliente';
import Modal from '../../../ui/Modal/modal';
import ContratoSelect from '../../search/BuscaContrato';
import FormControl from '../../../ui/FormControl/FormControl';
import ButtonGroup from '../../../ui/ButtonGroup/ButtonGroup';
import Card from '../../../ui/Card/Card';
import Typography from '../../../ui/Typography/Typography';
import { GroupButton } from '../../../ui/ButtonGroup/ButtonTypes';
import Badge from '../../../ui/Badge/Badge'; // Componente de UI para visualização
// Importações de Tipos (MOCK: Assumindo que Cliente e ContratoSimples vêm de algum lugar)
// ⚠️ Nota: Estou usando 'any' para Cliente e ContratoSimples, pois as importações reais não foram fornecidas.
type Cliente = { id: string, nome: string } | any;
type ContratoSimples = { id: string, numeroContrato: string, fk_cliente_id: string } | any;
type PocoSimples = { id: string, nome: string } | any;


// ----------------- TIPOS DE DADOS E MOCKS (MANTIDOS) -----------------

interface SecaoPerfuracao {
    deMetros: number;
    aMetros: number;
    litologia: string;
}
interface SecaoRevestimento {
    tipo: string;
    diametroMm: number;
    deMetros: number;
    aMetros: number;
}
interface PocoData {
    // DADOS DE REFERÊNCIA (IDs - Provavelmente o que o backend espera)
    contratoId: string;
    ClienteId: string;

    // DADOS DE CONTEXTO (Objetos Completos - Para o UI e validação no backend)
    clienteObj: Cliente | null; // NOVO: Objeto Cliente Completo
    contratoObj: ContratoSimples | null; // NOVO: Objeto Contrato Completo

    // DADOS GERAIS
    nomeIdentificacao: string;
    dataConclusao: string;
    latitude: number;
    longitude: number;
    elevacaoMetros: number;
    profundidadeTotalMetros: number;
    diametroConstrucaoMm: number;
    formacaoGeologica: string;
    observacoes: string;

    // DADOS DO CONJUNTO DE BOMBEAMENTO
    marcaBomba: string;
    modeloBomba: string;
    dataInstalacaoBomba: string;
    profundidadeBombaMetros: number;
    tubulacaoEdutora: string;
    cabeamentoEletrico: string;
    cavaleteSaida: string;

    // DADOS DOS TESTES
    vazaoTesteM3Hora: number;
    nivelEstaticoTesteMetros: number;
    nivelDinamicoTesteMetros: number;

    // Módulos de Lista
    secoesPerfuracao: SecaoPerfuracao[];
    secoesRevestimento: SecaoRevestimento[];
}

const initialState: PocoData = {
    // Limpos para um formulário novo
    contratoId: '', 
    ClienteId: '', 
    clienteObj: null, // Inicialmente null
    contratoObj: null, // Inicialmente null
    
    nomeIdentificacao: 'Poço de Teste 001', 
    dataConclusao: new Date().toISOString().split('T')[0],
    latitude: -23.5505, longitude: -46.6333, elevacaoMetros: 760, 
    profundidadeTotalMetros: 150.5, diametroConstrucaoMm: 200, 
    formacaoGeologica: 'Arenito Bauru', observacoes: 'Primeiro teste de preenchimento.',
    marcaBomba: 'Grundfos', modeloBomba: 'SP 123-A',
    dataInstalacaoBomba: new Date().toISOString().split('T')[0],
    profundidadeBombaMetros: 50,
    tubulacaoEdutora: 'PVC 2"', cabeamentoEletrico: 'Cabo Submersível 3x4mm', cavaleteSaida: 'Válvula Esfera',
    vazaoTesteM3Hora: 20, nivelEstaticoTesteMetros: 15.5, nivelDinamicoTesteMetros: 25.8,
    secoesPerfuracao: [], // Limpo para novo formulário
    secoesRevestimento: [], // Limpo para novo formulário
};

// ----------------- COMPONENTE AUXILIAR (Card de Contexto) -----------------
interface ContextCardProps {
    tipo: 'Cliente' | 'Contrato' | 'Poço';
    item: Cliente | ContratoSimples | PocoSimples | null;
    onClick: () => void;
}

const ContextCard: React.FC<ContextCardProps> = ({ tipo, item, onClick }) => {
    const isSelected = !!item;
    const titleKey = tipo === 'Cliente' ? 'nome' : tipo === 'Contrato' ? 'numeroContrato' : 'nome';
    
    // Conteúdo
    const title = isSelected ? item[titleKey] : `Selecione o ${tipo}`;
    const subtitle = isSelected ? `ID: ${item.id}` : `Clique para buscar o ${tipo.toLowerCase()}.`;
    
    // Estilo (usando classes Tailwind/in-line mockado, pois o CSS real não foi fornecido)
    const cardStyle: React.CSSProperties = {
        padding: '10px',
        borderRadius: '8px',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
        backgroundColor: isSelected ? '#eff6ff' : '#f9fafb',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.3s',
        minHeight: '80px'
    };

    return (
        <div style={cardStyle} onClick={onClick}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="strong" style={{ fontSize: '1.1em' }}>{tipo}</Typography>
                <Badge color={isSelected ? 'success' : 'secondary'}>{isSelected ? 'Selecionado' : 'Pendente'}</Badge>
            </div>
            <Typography variant="pMuted" style={{ marginTop: '5px', lineHeight: '1.2' }}>{title}</Typography>
            <Typography variant="small" style={{ color: isSelected ? '#3b82f6' : '#6b7280' }}>{subtitle}</Typography>
        </div>
    );
};
// ----------------- FIM COMPONENTE AUXILIAR -----------------


// ----------------- COMPONENTE PRINCIPAL -----------------

const RelatorioPoco: React.FC = () => {
    // 1. ESTADOS PRINCIPAIS
    const [pocoData, setPocoData] = useState<PocoData>(initialState);
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    const [contratoSelecionado, setContratoSelecionado] = useState<ContratoSimples | null>(null);
    const [pocoSelecionado, setPocoSelecionado] = useState<PocoSimples | null>(null); // Usando PocoSimples
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false); // Modal Cliente
    const [isModalOpen2, setIsModalOpen2] = useState(false); // Modal Contrato
    
    // --- HANDLERS de Modal (usamos useCallback para evitar warnings) ---
    const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
    const handleCloseModal = useCallback(() => setIsModalOpen(false), []);
    const handleOpenModal2 = useCallback(() => setIsModalOpen2(true), []);
    const handleCloseModal2 = useCallback(() => setIsModalOpen2(false), []);

    // 4. Funções de Mudança de Campo (Exemplo genérico)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const parsedValue = (type === 'number') ? parseFloat(value) : value;

        setPocoData(prevData => ({
            ...prevData,
            [name]: parsedValue,
        }));
    };


    // 5. Ajuste na Função handleClienteChange
    const handleClienteChange = useCallback((cliente: Cliente | null) => {
        
        setClienteSelecionado(cliente);
        
        const id = cliente ? cliente.id : ''; 
        
        // --- ATUALIZAÇÃO PRINCIPAL DO ESTADO (pocoData) ---
        setPocoData(prevData => ({
            ...prevData,
            ClienteId: id, 
            clienteObj: cliente, // <-- AGORA ARMAZENA O OBJETO COMPLETO
            
            // Limpa o Contrato e o Poço relacionados, forçando uma nova seleção no fluxo
            contratoId: '', 
            contratoObj: null, // Limpa o objeto de Contrato também
        }));
        
        console.log(`✅ Cliente ID e Objeto atualizados no pocoData: ${id}`);
        
        if (!cliente) { // Se limpou o cliente, limpa tudo abaixo
            setContratoSelecionado(null);
            setPocoSelecionado(null);
        } else {
            // Se um novo cliente foi selecionado, limpa Contrato e Poço anteriores
            setContratoSelecionado(null);
            setPocoSelecionado(null);
        }
        
        if (cliente) {
            handleCloseModal();
        }
    }, [handleCloseModal]); 

    const handleContratoChange = useCallback((contrato: ContratoSimples | null) => {
        setContratoSelecionado(contrato);
        
        const id = contrato ? contrato.id : ''; 
        
        // --- ATUALIZAÇÃO PRINCIPAL DO ESTADO (pocoData) ---
        setPocoData(prevData => ({
            ...prevData,
            contratoId: id,
            contratoObj: contrato, // <-- AGORA ARMAZENA O OBJETO COMPLETO
        }));
        
        console.log(`✅ Contrato ID e Objeto atualizados no pocoData: ${id}`);
        
        if (id) {
            // Se Contrato for selecionado, limpa o poço
            setPocoSelecionado(null); 
        } else {
            // Se o contrato for limpo, o poço também é
            setPocoSelecionado(null);
        }
        
        if (contrato) {
            handleCloseModal2();
        }
    }, [handleCloseModal2]);
    
    // 6. Função de Submissão 
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // Os dados enviados agora incluirão clienteObj e contratoObj
        console.log("Dados prontos para envio:", pocoData); 
        // Usando console.log em vez de alert()
        console.log('Formulário Submetido (Verifique o console para os dados)'); 
    };
    
    // --- DADOS PARA O BUTTON GROUP ---
    const modalButtons: GroupButton[] = [
        { 
            id: 1, 
            label: 'Buscar/Trocar Cliente',
            variant: 'primary', 
            onClick: handleOpenModal 
        },
        { 
            id: 2, 
            label: 'Buscar/Trocar Contrato',
            variant: 'secondary', 
            onClick: handleOpenModal2,
            disabled: !clienteSelecionado // Contrato depende do Cliente
        },
        { 
            id: 3, 
            label: 'Buscar/Trocar Poço',
            variant: 'outline', 
            onClick: () => console.log('Abre busca de Poço'),
            disabled: !contratoSelecionado // Poço depende do Contrato
        },
    ];

    return (
        <form className="relatorio-poco-form" onSubmit={handleSubmit}>
            
            <Card className='flex-row' style={{ padding: '20px' }}>
                <FlexGridContainer layout="grid" template='1fr 1fr'>
                    
                    {/* COLUNA ESQUERDA: TÍTULOS E FORMS GERAIS */}
                    <FlexGridContainer layout="flex" template='column'>
                        <Typography variant="h1Alt">
                            Registro Técnico do Poço
                        </Typography>
                        <Typography variant="pMuted" className="subtitle" style={{ marginBottom: '15px' }}>
                            Relatório pós-serviço (Perfuração/Manutenção)
                        </Typography>

                        {/* --- FORMS GERAIS --- */}
                        <FlexGridContainer layout="grid" template='1fr 1fr' gap='15px'>
                            <FormControl
                                label="Nome de Identificação do Poço"
                                name="nomeIdentificacao"
                                placeholder="Ex: Poço Principal - Casa 1"
                                required
                                value={pocoData.nomeIdentificacao}
                                onChange={handleInputChange}
                            />
                            <FormControl
                                label="Data do Relatório"
                                name="dataConclusao"
                                type="date"
                                required
                                value={pocoData.dataConclusao}
                                onChange={handleInputChange}
                            />
                        </FlexGridContainer>

                        {/* -------------------- BOTÕES DE BUSCA -------------------- */}
                        <div style={{ marginTop: '20px' }}>
                            <Typography variant='pMuted' style={{ marginBottom: '10px' }}>
                                Selecione os contextos:
                            </Typography>
                            <ButtonGroup buttons={modalButtons} />
                        </div>

                    </FlexGridContainer>

                    {/* COLUNA DIREITA: CARDS DE CONTEXTO VISUAL */}
                    <FlexGridContainer layout="flex" template='column' style={{ gap: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
                        <Typography variant='strong' style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                            Contexto de Registro
                        </Typography>
                        
                        <ContextCard
                            tipo='Cliente'
                            item={clienteSelecionado}
                            onClick={handleOpenModal}
                        />
                        
                        <ContextCard
                            tipo='Contrato'
                            item={contratoSelecionado}
                            onClick={handleOpenModal2}
                        />
                        
                        <ContextCard
                            tipo='Poço'
                            item={pocoSelecionado}
                            onClick={() => console.log('Abre busca de Poço (Mock)')}
                        />

                    </FlexGridContainer>

                </FlexGridContainer>
            </Card>

            {/* -------------------- MODAL 1 (Buscar Cliente) -------------------- */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal}
                title="Buscar Cliente"
            >
                <ClienteSelect
                    entitySelecionada={clienteSelecionado}
                    onEntitySelecionadaChange={handleClienteChange}
                    isLoading={isSaving}
                />
            </Modal>

            {/* -------------------- MODAL 2 (Buscar Contrato) -------------------- */}
            <Modal 
                isOpen={isModalOpen2} 
                onClose={handleCloseModal2}
                title="Buscar Contrato"
            >
                <ContratoSelect
                    entitySelecionada={contratoSelecionado}
                    onEntitySelecionadaChange={handleContratoChange}
                    isLoading={isSaving}
                    // Adicione aqui a prop para filtrar por cliente se a BuscaContrato suportar
                    // clienteIdFilter={clienteSelecionado?.id} 
                />
            </Modal>
            
            {/* ------------------ GRID PRINCIPAL (8fr 3fr) ------------------ */}
            <FlexGridContainer layout='grid' template='8fr 3fr' style={{ marginTop: '20px' }}>

                {/* COLUNA PRINCIPAL (8fr) - ABAS VERTICAIS */}
                <Tabss/>

                {/* COLUNA SECUNDÁRIA (3fr) - AÇÕES E BOMBEAMENTO */}
                <Column/>
            </FlexGridContainer>

            {/* ------------------ BOTÕES DE SUBMISSÃO ------------------ */}
            <Button type="submit" variant="success" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
                ✅ Finalizar Relatório e Salvar Dados do Poço
            </Button>

            <Button type="button" variant="outline" style={{ width: "100%", marginTop: 10, fontSize: '1.2em' }}>
                💾 Salvar Rascunho do Relatório
            </Button>
            
            {/* ------------------ SEÇÃO DE VISUALIZAÇÃO DE DADOS (PRÉ-ENVIO) ------------------ */}
            <div style={{ 
                marginTop: '40px', 
                padding: '20px', 
                border: '1px solid #ccc', 
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
            }}>
                <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
                    👀 Visualização de Variáveis (Pré-envio)
                </h3>
                
                {pocoData && (
                    <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-word', 
                        backgroundColor: '#272822',
                        color: '#f8f8f2',
                        padding: '15px', 
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        overflowX: 'auto'
                    }}>
                        {JSON.stringify(pocoData, null, 2)}
                    </pre>
                )}
                {!pocoData && <p>Nenhum dado do poço disponível para visualização.</p>}
            </div>
        </form>
    );
};

export default RelatorioPoco;