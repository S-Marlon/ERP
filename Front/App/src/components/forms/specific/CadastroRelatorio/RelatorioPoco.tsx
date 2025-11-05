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
// Importações de Tipos (MOCK: Assumindo que Cliente e ContratoSimples vêm de algum lugar)
// import { Cliente } from '../../../../types/entities/client';
// ⚠️ Nota: Estou usando 'any' para Cliente e ContratoSimples, pois as importações reais não foram fornecidas.
type Cliente = any;
type ContratoSimples = any;


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
    // DADOS GERAIS
    contratoId: string;
    ClienteId: string;
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
    contratoId: '12345-EXEMPLO', 
    ClienteId: '67890-EXEMPLO', 
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
    secoesPerfuracao: [
        { deMetros: 0, aMetros: 10, litologia: 'Solo' },
        { deMetros: 10, aMetros: 50, litologia: 'Argilito' },
    ],
    secoesRevestimento: [
        { tipo: 'Aço Carbono', diametroMm: 200, deMetros: 0, aMetros: 6 },
    ],
};

// ----------------- COMPONENTE PRINCIPAL -----------------

const RelatorioPoco: React.FC = () => {
    // 1. ESTADOS PRINCIPAIS (Declarados apenas uma vez)
    const [pocoData, setPocoData] = useState<PocoData>(initialState);
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
    const [contratoSelecionado, setContratoSelecionado] = useState<ContratoSimples | null>(null);
    const [pocoSelecionado, setPocoSelecionado] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalOpen2, setIsModalOpen2] = useState(false);
    
    // --- HANDLERS de Modal ---
    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);
    const handleOpenModal2 = () => setIsModalOpen2(true);
    const handleCloseModal2 = () => setIsModalOpen2(false);

    // 4. Funções de Mudança de Campo (Exemplo genérico)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        // Converte para número se o campo for numérico no estado (opcional, dependendo do FormControl)
        const parsedValue = (type === 'number') ? parseFloat(value) : value;

        setPocoData(prevData => ({
            ...prevData,
            [name]: parsedValue,
        }));
    };


    // 5. Ajuste na Função handleClienteChange
    const handleClienteChange = useCallback((cliente: Cliente | null) => {
        
        // 1. Atualiza o estado do Cliente
        setClienteSelecionado(cliente);
        
        // 2. Extrai o ID
        const id = cliente ? cliente.id : ''; 
        
        // 3. ATUALIZAÇÃO DO ESTADO PRINCIPAL (pocoData)
        setPocoData(prevData => ({
            ...prevData,
            ClienteId: id, 
            // Limpa o ContratoId no payload se o ClienteId for limpo
            contratoId: id ? prevData.contratoId : '', 
        }));
        
        console.log(`✅ ID do Cliente atualizado no pocoData: ${id}`);
        
        // 4. Regra de limpeza (Limpa os estados auxiliares para a UI)
        if (id === '') {
            setContratoSelecionado(null);
            setPocoSelecionado(null);
        }
        
        // Fecha o Modal após a seleção
        if (cliente) {
            handleCloseModal();
        }
    }, [handleCloseModal]); 

    const handleContratoChange = useCallback((contrato: ContratoSimples | null) => {
            // 1. Atualiza o estado do objeto completo
            setContratoSelecionado(contrato);
    
            // 2. Extrai o ID
            const id = contrato ? contrato.id : ''; // Assumindo string vazia para limpar
            
            // 3. ATUALIZAÇÃO DO ESTADO PRINCIPAL (pocoData)
            setPocoData(prevData => ({
                ...prevData,
                contratoId: id,
            }));
            
            console.log(`✅ ID do Contrato atualizado no pocoData: ${id}`);
    
            // 4. Regra de limpeza: Se o Contrato muda, as seleções relacionadas abaixo dele são limpas
            if (id) {
                setPocoSelecionado(null);
            }
            
            // 5. Fecha o Modal após a seleção
            if (contrato) {
                handleCloseModal2();
            }
        }, [handleCloseModal2]); // Adicionado handleCloseModal2 às dep
    // 6. Função de Submissão 
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        console.log("Dados prontos para envio:", pocoData);
        // Aqui você faria a chamada para o backend (ex: axios.post)
        // Usando console.log em vez de alert()
        console.log('Formulário Submetido (Verifique o console para os dados)'); 
    };
    
      // --- DADOS PARA O BUTTON GROUP ---
      const modalButtons: GroupButton[] = [
        { 
          id: 1, 
          label: 'Adicionar Cliente', // Corrigido para "Adicionar"
          variant: 'primary', 
          onClick: handleOpenModal 
        },
        { 
          id: 2, 
          label: 'Adicionar Contrato', // Corrigido para "Adicionar"
          variant: 'secondary', 
          onClick: handleOpenModal2 
        },
      ];

    return (
        <form className="relatorio-poco-form" onSubmit={handleSubmit}>
            {/* ------------------ HEADER AJUSTADO ------------------ */}
          
           <Card className='flex-row'>
      <FlexGridContainer layout="grid" template='1fr 1fr'>
        
        <FlexGridContainer layout="flex" template='column'>
          <Typography variant="h1Alt">
            Registro Técnico do Poço
          </Typography>
          <Typography variant="pMuted" className="subtitle">
            Relatório pós-serviço (Perfuração/Manutenção)
          </Typography>

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
                                // Requer o objeto completo (Contrato | null)
                                entitySelecionada={contratoSelecionado}
                                // Handler que recebe o objeto completo
                                onEntitySelecionadaChange={handleContratoChange}
                                isLoading={isSaving}
                            />
          </Modal>

          
          {/* --- FORMS --- */}
          <FlexGridContainer layout="grid" template='1fr 1fr'>
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

        </FlexGridContainer>

        {/* --- BUTTON GROUP --- */}
        <ButtonGroup buttons={modalButtons} />
            
      </FlexGridContainer>
    </Card>

            {/* ------------------ GRID PRINCIPAL (8fr 3fr) ------------------ */}
            <FlexGridContainer layout='grid' template='8fr 3fr'>

                {/* COLUNA PRINCIPAL (8fr) - ABAS VERTICAIS */}
                <Tabss/>

                {/* COLUNA SECUNDÁRIA (3fr) - AÇÕES E BOMBEAMENTO */}
                <Column/>
            </FlexGridContainer>

            {/* ------------------ BOTÕES DE SUBMISSÃO ------------------ */}
            <Button type="submit" variant="success" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
                ✅ Finalizar Relatório e Salvar Dados do Poço
            </Button>

            <Button type="button" variant="outline" style={{ width: "100%", marginTop: 30, fontSize: '1.2em' }}>
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
                        backgroundColor: '#272822', // Cor escura para visualização de código
                        color: '#f8f8f2', // Cor clara para o texto
                        padding: '15px', 
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        overflowX: 'auto'
                    }}>
                        {/* Esta linha transforma seu objeto 'pocoData' em uma string JSON formatada */}
                        {JSON.stringify(pocoData, null, 2)}
                    </pre>
                )}
                {!pocoData && <p>Nenhum dado do poço disponível para visualização.</p>}
            </div>
        </form>
    );
};

export default RelatorioPoco;