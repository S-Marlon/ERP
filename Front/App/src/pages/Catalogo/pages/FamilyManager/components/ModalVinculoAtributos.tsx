import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Input, Select, Button, List, Tag, Typography, Space, App, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, FileTextOutlined, NumberOutlined, UnorderedListOutlined, CheckCircleOutlined, FilterOutlined } from '@ant-design/icons';
import { AtributoConfig, ModalDestino } from '../CatalogManager.types';

const { Text, Paragraph } = Typography;

interface ModalVinculoAtributosProps {
  isModalAberto: boolean;
  setIsModalAberto: (aberto: boolean) => void;
  destinoModal: ModalDestino;
  atributosGlobaisDisponiveis: AtributoConfig[];
  atributosAtuaisNoGrupo?: AtributoConfig[];
  handleAdicionarAtributoAoGrupo: (atributo: Partial<AtributoConfig>) => void | Promise<void>;
  brandColor?: string;
}

const DESTINO_CONFIG = {
  dna: { color: 'blue', label: '🧬 DNA' },
  grade: { color: 'orange', label: '📏 GRADE' },
  ficha: { color: 'default', label: '📋 FICHA TÉCNICA' },
} as const;

const TIPO_DADO_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  texto: { label: 'Texto', icon: <FileTextOutlined /> },
  numero: { label: 'Número', icon: <NumberOutlined /> },
  opcoes: { label: 'Lista de Opções', icon: <UnorderedListOutlined /> },
};

export const ModalVinculoAtributos: React.FC<ModalVinculoAtributosProps> = ({
  isModalAberto,
  setIsModalAberto,
  destinoModal,
  atributosGlobaisDisponiveis,
  atributosAtuaisNoGrupo = [],
  handleAdicionarAtributoAoGrupo,
  brandColor = '#1677ff',
}) => {
  const [novoNome, setNovoNome] = useState('');
  const [novoTipo, setNovoTipo] = useState<'texto' | 'numero' | 'opcoes'>('texto');
  const [pesquisaTermo, setPesquisaTermo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos'); // Novo estado para o filtro de tipo
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [criandoInedito, setCriandoInedito] = useState(false);

  const inputIneditoRef = useRef<any>(null);
  const { message } = App.useApp();

  // Reseta os campos e estados ao fechar o modal
  useEffect(() => {
    if (!isModalAberto) {
      setNovoNome('');
      setNovoTipo('texto');
      setPesquisaTermo('');
      setFiltroTipo('todos');
      setCarregandoId(null);
      setCriandoInedito(false);
    }
  }, [isModalAberto]);

  // Set de IDs e Nomes já presentes no grupo atual para consulta rápida
  const idsVinculadosSet = useMemo(() => {
    return new Set(atributosAtuaisNoGrupo.map((attr) => attr.id));
  }, [atributosAtuaisNoGrupo]);

  const nomesVinculadosSet = useMemo(() => {
    return new Set(atributosAtuaisNoGrupo.map((attr) => attr.nome.trim().toLowerCase()));
  }, [atributosAtuaisNoGrupo]);

  // Filtro otimizado (busca por texto + filtro por tipo de dado)
  const atributosFiltrados = useMemo(() => {
    const termoLimpo = pesquisaTermo.trim().toLowerCase();

    return atributosGlobaisDisponiveis.filter((attr) => {
      const correspondeTexto = !termoLimpo || attr.nome.toLowerCase().includes(termoLimpo);
      const correspondeTipo = filtroTipo === 'todos' || attr.tipoDado === filtroTipo;
      return correspondeTexto && correspondeTipo;
    });
  }, [atributosGlobaisDisponiveis, pesquisaTermo, filtroTipo]);

  const handleVincular = async (attr: AtributoConfig) => {
    try {
      setCarregandoId(attr.id);
      await handleAdicionarAtributoAoGrupo(attr);
      message.success(`Atributo "${attr.nome}" vinculado com sucesso!`);
    } catch {
      message.error('Erro ao vincular atributo.');
    } finally {
      setCarregandoId(null);
    }
  };

  const handleCriarInedito = async () => {
    const nomeFormatado = novoNome.trim();
    if (!nomeFormatado) return;

    if (nomesVinculadosSet.has(nomeFormatado.toLowerCase())) {
      message.warning(`O atributo "${nomeFormatado}" já está adicionado neste grupo!`);
      return;
    }

    try {
      setCriandoInedito(true);
      await handleAdicionarAtributoAoGrupo({
        nome: nomeFormatado,
        tipoDado: novoTipo,
        classificacao: destinoModal,
      });

      message.success(`Atributo "${nomeFormatado}" criado e vinculado com sucesso!`);
      setNovoNome('');
      inputIneditoRef.current?.focus();
    } catch {
      message.error('Erro ao criar atributo inédito.');
    } finally {
      setCriandoInedito(false);
    }
  };

  const renderTagDestino = () => {
    const config = DESTINO_CONFIG[destinoModal] || DESTINO_CONFIG.ficha;
    return (
      <Tag color={config.color} style={{ fontWeight: 600, margin: 0 }}>
        {config.label}
      </Tag>
    );
  };

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
          Fechar
        </Button>,
      ]}
      width={520}
      centered
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: '16px' }}>
        
        {/* LISTA DE ATRIBUTOS, BUSCA E FILTRO DE TIPO */}
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Text strong style={{ fontSize: '11px', color: '#475569' }}>
            TERMOS DISPONÍVEIS NO ERP ({atributosFiltrados.length})
          </Text>
          
          {/* Barra de Busca + Seletor de Filtro por Tipo */}
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="Buscar termo no dicionário..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={pesquisaTermo}
              onChange={(e) => setPesquisaTermo(e.target.value)}
              allowClear
            />
            <Select
              value={filtroTipo}
              onChange={(value) => setFiltroTipo(value)}
              style={{ width: '130px' }}
              suffixIcon={<FilterOutlined style={{ fontSize: '11px', color: '#8c8c8c' }} />}
              options={[
                { value: 'todos', label: 'Todos tipos' },
                { value: 'texto', label: 'Texto' },
                { value: 'numero', label: 'Número' },
                { value: 'opcoes', label: 'Lista' },
              ]}
            />
          </Space.Compact>

          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: '8px',
              backgroundColor: '#fafafa',
              padding: '4px 8px',
            }}
          >
            <List
              dataSource={atributosFiltrados}
              locale={{ emptyText: 'Nenhum termo disponível encontrado para este filtro.' }}
              renderItem={(attr) => {
                const jaVinculado = idsVinculadosSet.has(attr.id);
                const tipoInfo = TIPO_DADO_CONFIG[attr.tipoDado] || TIPO_DADO_CONFIG.texto;
                const estaCarregando = carregandoId === attr.id;

                return (
                  <List.Item
                    key={attr.id}
                    style={{ padding: '8px 4px', opacity: jaVinculado ? 0.6 : 1 }}
                    actions={[
                      jaVinculado ? (
                        <Tooltip title="Este atributo já está vinculado a este grupo">
                          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
                            Vinculado
                          </Tag>
                        </Tooltip>
                      ) : (
                        <Button
                          key="vincular"
                          type="text"
                          size="small"
                          loading={estaCarregando}
                          onClick={() => handleVincular(attr)}
                          style={{ color: brandColor, fontWeight: 600 }}
                        >
                          ＋ Vincular
                        </Button>
                      ),
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong style={{ fontSize: '13px' }}>{attr.nome}</Text>}
                      description={
                        <Space size={4} style={{ fontSize: '11px', color: '#8c8c8c' }}>
                          {tipoInfo.icon}
                          <span>{tipoInfo.label}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
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
              ref={inputIneditoRef}
              placeholder="Ex: Espessura da Camada"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onPressEnter={handleCriarInedito}
            />
            <Select
              value={novoTipo}
              onChange={(value) => setNovoTipo(value)}
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
              loading={criandoInedito}
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