import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, List, Tag, Typography, Space, App } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { AtributoConfig, ModalDestino } from '../CatalogManager.types';

const { Text, Paragraph } = Typography;

interface ModalVinculoAtributosProps {
  isModalAberto: boolean;
  setIsModalAberto: (aberto: boolean) => void;
  destinoModal: ModalDestino;
  atributosGlobaisDisponiveis: AtributoConfig[];
  handleAdicionarAtributoAoGrupo: (atributo: Partial<AtributoConfig>) => void;
  brandColor?: string;
}

export const ModalVinculoAtributos: React.FC<ModalVinculoAtributosProps> = ({
  isModalAberto,
  setIsModalAberto,
  destinoModal,
  atributosGlobaisDisponiveis,
  handleAdicionarAtributoAoGrupo,
  brandColor = '#1677ff'
}) => {
  const [novoNome, setNovoNome] = useState('');
  const [novoTipo, setNovoTipo] = useState<'texto' | 'numero' | 'opcoes'>('texto');
  const [pesquisaTermo, setPesquisaTermo] = useState('');

  // Notificações nativas do Antd v5 para feedback de criação
  const { message } = App.useApp();

  // Limpa os campos de criação quando o modal fecha
  useEffect(() => {
    if (!isModalAberto) {
      setNovoNome('');
      setNovoTipo('texto');
      setPesquisaTermo('');
    }
  }, [isModalAberto]);

  const renderTagDestino = () => {
    switch (destinoModal) {
      case 'dna':
        return <Tag color="blue" style={{ fontWeight: 600, margin: 0 }}>🧬 DNA</Tag>;
      case 'grade':
        return <Tag color="orange" style={{ fontWeight: 600, margin: 0 }}>📏 GRADE</Tag>;
      default:
        return <Tag color="default" style={{ fontWeight: 600, margin: 0 }}>📋 FICHA TÉCNICA</Tag>;
    }
  };

  const handleCriarInedito = () => {
    if (novoNome.trim()) {
      handleAdicionarAtributoAoGrupo({ 
        nome: novoNome.trim(), 
        tipoDado: novoTipo,
        classificacao: destinoModal
      });
      message.success(`Atributo "${novoNome.trim()}" criado com sucesso!`);
      setNovoNome('');
    }
  };

  const atributosFiltrados = atributosGlobaisDisponiveis.filter(attr =>
    attr.nome.toLowerCase().includes(pesquisaTermo.toLowerCase())
  );

  return (
    <Modal
      title={
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between', paddingRight: '24px' }}>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: '16px' }}>Vincular Atributo Global</Text>
            <Paragraph type="secondary" style={{ fontSize: '13px', margin: 0 }}>
              Selecione do dicionário do ERP ou cadastre um termo novo.
            </Paragraph>
          </Space>
          {renderTagDestino()}
        </Space>
      }
      open={isModalAberto}
      onCancel={() => setIsModalAberto(false)}
      footer={[
        <Button key="back" onClick={() => setIsModalAberto(false)}>
          Cancelar e Fechar
        </Button>
      ]}
      width={500}
      centered
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: '16px' }}>
        
        {/* LISTA DE ATRIBUTOS E BUSCA */}
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong style={{ fontSize: '11px', color: '#475569' }}>
            TERMOS DISPONÍVEIS NO ERP
          </Text>
          
          <Input 
            placeholder="Buscar termo no dicionário..." 
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={pesquisaTermo}
            onChange={e => setPesquisaTermo(e.target.value)}
            allowClear
          />

          <div style={{ 
            maxHeight: '180px', 
            overflowY: 'auto', 
            border: '1px solid #f0f0f0', 
            borderRadius: '8px',
            backgroundColor: '#fafafa',
            padding: '4px 8px'
          }}>
            <List
              dataSource={atributosFiltrados}
              locale={{ emptyText: 'Nenhum termo disponível encontrado.' }}
              renderItem={attr => (
                <List.Item
                  key={attr.id}
                  style={{ padding: '8px 4px' }}
                  actions={[
                    <Button 
                      type="text" 
                      size="small" 
                      onClick={() => handleAdicionarAtributoAoGrupo(attr)}
                      style={{ color: brandColor, fontWeight: 600 }}
                    >
                      ＋ Vincular
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong style={{ fontSize: '13px' }}>{attr.nome}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {attr.tipoDado === 'opcoes' ? '📋 Lista de Opções' : attr.tipoDado === 'numero' ? '🔢 Número' : '🔤 Texto'}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        </Space>

        {/* CRIAR ATRIBUTO INÉDITO */}
        <Space direction="vertical" size="small" style={{ width: '100%', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
          <Text strong style={{ fontSize: '11px', color: '#475569' }}>
            NÃO ENCONTROU? CRIAR TERMO INÉDITO
          </Text>
          
          <Space.Compact style={{ width: '100%' }}>
            <Input 
              placeholder="Ex: Espessura da Camada" 
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onPressEnter={handleCriarInedito}
            />
            <Select
              value={novoTipo}
              onChange={value => setNovoTipo(value)}
              style={{ width: '110px' }}
              options={[
                { value: 'texto', label: 'Texto' },
                { value: 'numero', label: 'Número' },
                { value: 'opcoes', label: 'Lista' },
              ]}
            />
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleCriarInedito}
              disabled={!novoNome.trim()}
              style={{ backgroundColor: novoNome.trim() ? brandColor : undefined }}
            >
              Criar
            </Button>
          </Space.Compact>
        </Space>

      </Space>
    </Modal>
  );
};