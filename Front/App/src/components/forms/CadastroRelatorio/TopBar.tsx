import React, { useState } from 'react';
import Card from '../../ui/Card/Card';
import Typography from '../../ui/Typography/Typography';
import FormControl from '../../ui/FormControl/FormControl';
import ClienteSelect from '../CadastroContrato/BuscaCliente';
// 🚨 ASSUMIMOS que você exporta a interface 'Poco' aqui também, se não, ajuste
import { Cliente } from '../../../types/newtypes'; 
import FlexGridContainer from '../../Layout/FlexGridContainer/FlexGridContainer';
import PocoSelect from '../CadastroContrato/BuscaPoco';
import TypeSwitch from '../../ui/TypeSwitch';
import TabButton from '../../ui/TabButton/TabButton';
import Modal from '../../ui/Modal/modal';
import ButtonGroup from '../../ui/ButtonGroup/ButtonGroup';

// 🚨 CORREÇÃO ESSENCIAL: Você precisa importar o tipo GroupButton
// (Ajuste o caminho se o seu ButtonTypes.ts não estiver nesta pasta relativa)
import { GroupButton } from '../../ui/ButtonGroup/ButtonTypes'; 
import ContratoSelect from '../CadastroContrato/BuscaContrato';

// 🚨 CORREÇÃO: Definição do SearchType, que estava faltando.
type SearchType = 'Cliente' | 'Contrato'; 

const Topbar: React.FC = () => {
  // --- ESTADOS ---
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [isSaving, setIsSaving] = useState(false); // Simula estado de loading/saving
  
  // Estados para os Modais (melhor nomeado como 'isModalOpen' e 'isModal2Open')
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isModalOpen2, setIsModalOpen2] = useState(false);

  // --- HANDLERS (Funções) ---
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false); // Correção de escopo para fechar o Modal 1

  const handleOpenModal2 = () => setIsModalOpen2(true);
  const handleCloseModal2 = () => setIsModalOpen2(false); // Correção de escopo para fechar o Modal 2
  
  const handleClienteChange = (cliente: Cliente | null) => {
    setClienteSelecionado(cliente);
    console.log('Cliente selecionado mudou:', cliente);
  };

  // --- DADOS PARA O BUTTON GROUP ---
  // Substituindo os dois <button> HTML pelo componente ButtonGroup
  const modalButtons: GroupButton[] = [
    { 
      id: 1, 
      label: 'Adcionar Cliente', // Nome mais descritivo
      variant: 'primary', 
      onClick: handleOpenModal 
    },
    { 
      id: 2, 
      label: 'Adcionar Contrato', // Nome mais descritivo
      variant: 'secondary', 
      onClick: handleOpenModal2 
    },
  ];

  return (
    <Card className='flex-row'>
      <FlexGridContainer layout="grid" template='1fr 1fr'>
        
        <FlexGridContainer layout="flex" template='column'>
          <Typography variant="h1Alt">
            Registro Técnico do Poço
          </Typography>
          <Typography variant="pMuted" className="subtitle">
            Relatório pós-serviço (Perfuração/Manutenção)
          </Typography>

          {/* 🚀 SUBSTITUIÇÃO: Usando o ButtonGroup no lugar dos botões HTML */}
          
          {/* ⚠️ Os botões HTML abaixo foram removidos para evitar duplicidade 
          <button onClick={handleOpenModal}>Abrir Modal</button>
          <button onClick={handleOpenModal2}>Abrir Modals</button> */}

          {/* -------------------- MODAL 1 (Buscar Cliente) -------------------- */}
          <Modal 
            // 🚨 CORREÇÃO: isModalOpen agora é usado corretamente para o Modal 1
            isOpen={isModalOpen} 
            onClose={handleCloseModal}
            title="Buscar Cliente"
          >
            <ClienteSelect
              clienteSelecionado={clienteSelecionado}
              onClienteSelecionadoChange={handleClienteChange}
              isLoading={isSaving} // Usando o estado de loading simulado
            />
          </Modal>

          {/* -------------------- MODAL 2 (Buscar Poço) -------------------- */}
          <Modal 
            // 🚨 CORREÇÃO: isModalOpen2 agora é usado corretamente para o Modal 2
            isOpen={isModalOpen2} 
            onClose={handleCloseModal2}
            title="Buscar Contrato"
          >
            <ContratoSelect 
              entitySelecionada={null} 
              onEntitySelecionadaChange={() => console.log('Poço selecionado')}
            />
          </Modal>

          
          {/* --- FORMS --- */}
          <FlexGridContainer layout="grid" template='1fr 1fr'>
            <FormControl
              label="Nome de Identificação do Poço"
              name="nomeIdentificacao"
              placeholder="Ex: Poço Principal - Casa 1"
              required
            />
            <FormControl
              label="Data do Relatório"
              name="dataConclusao"
              type="date"
              required
            />
          </FlexGridContainer>

        </FlexGridContainer>

        {/* --- TYPESWITCH --- */}
        <ButtonGroup buttons={modalButtons} />
            
      </FlexGridContainer>
    </Card>
  );
};

export default Topbar;