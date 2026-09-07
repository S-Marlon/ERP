import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Typography, Table, Space, Tag, Select, Popconfirm, message, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { Familia, AtributoGlobal } from '../types';
import { updateFamilia } from '../services/familiaService'; // API para salvar no backend

const { Title, Text } = Typography;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  familiaId: string | null;
  familias: Familia[]; // Lista atual de famílias (para buscar os dados da que está sendo editada)
  atributosGlobaisDisponiveis: AtributoGlobal[]; // Dicionário de atributos globais do ERP para selecionar
  onSaveSuccess: () => void; // Callback para atualizar a listagem após salvar
}

export default function ModalEditFamilia({
  isOpen,
  onClose,
  familiaId,
  familias = [],
  atributosGlobaisDisponiveis = [],
  onSaveSuccess,
}: Props) {
  const [nomeFamilia, setNomeFamilia] = useState('');
  const [atributosEstrutura, setAtributosEstrutura] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Carrega os dados da família selecionada sempre que o modal abrir ou o ID mudar
  useEffect(() => {
    if (isOpen && familiaId) {
      const familiaAtual = familias.find(f => f.id === familiaId);
      if (familiaAtual) {
        setNomeFamilia(familiaAtual.nome || '');
        // Garante que traz os atributos configurados ou um array vazio
        setAtributosEstrutura(familiaAtual.atributos || []);
      }
    }
  }, [isOpen, familiaId, familias]);

  if (!isOpen || !familiaId) return null;

  // Identifica se é uma família temporária (criada localmente na nota)
  const isTemp = familiaId.startsWith('temp_');

  // Adicionar um atributo à estrutura da família
  const handleAddAtributo = (atributoGlobalId: string) => {
    const globalAttr = atributosGlobaisDisponiveis.find(a => a.id === atributoGlobalId);
    if (!globalAttr) return;

    // Evita duplicados na mesma família
    if (atributosEstrutura.some(a => a.id === atributoGlobalId || a.nome === globalAttr.nome)) {
      message.warning('Este atributo já faz parte da estrutura desta família.');
      return;
    }

    const novoAtributo = {
      id: globalAttr.id,
      nome: globalAttr.nome,
      principal: atributosEstrutura.length === 0, // O primeiro atributo vira o principal automaticamente por padrão
    };

    setAtributosEstrutura(prev => [...prev, novoAtributo]);
  };

  // Remover atributo da estrutura
  const handleRemoveAtributo = (idAtributo: string) => {
    setAtributosEstrutura(prev => {
      const novaLista = prev.filter(a => a.id !== idAtributo);
      // Se removeu o principal e sobrou algum, define o primeiro da lista como novo principal
      if (novaLista.length > 0 && !novaLista.some(a => a.principal)) {
        novaLista[0].principal = true;
      }
      return novaLista;
    });
  };

  // Definir qual atributo é a Chave Principal
  const handleSetPrincipal = (idAtributo: string) => {
    setAtributosEstrutura(prev =>
      prev.map(a => ({
        ...a,
        principal: a.id === idAtributo
      }))
    );
  };

  // Salvar as alterações
  const handleSave = async () => {
    try {
      setLoading(true);

      const dadosAtualizados = {
        nome: nomeFamilia,
        atributos: atributosEstrutura,
      };

      if (isTemp) {
        // Se for temporária, você pode gerenciar a atualização no estado pai ou num reducer local
        message.success('Estrutura da família temporária atualizada localmente!');
      } else {
        // Se for oficial, salva direto no banco via API
        await updateFamilia(familiaId, dadosAtualizados);
        message.success('Estrutura da família salva com sucesso!');
      }

      onSaveSuccess();
      onClose();
    } catch (error) {
      message.error('Erro ao salvar a estrutura da família.');
    } finally {
      setLoading(false);
    }
  };

  // Colunas da tabela de atributos da estrutura
  const columns = [
    {
      title: 'Atributo',
      dataIndex: 'nome',
      key: 'nome',
      render: (text: string, record: any) => (
        <Space>
          <Text strong>{text}</Text>
          {record.principal && <Tag color="blue"><KeyOutlined /> Principal</Tag>}
        </Space>
      ),
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          {!record.principal && (
            <Button 
              size="small" 
              type="text" 
              onClick={() => handleSetPrincipal(record.id)}
              title="Definir como chave principal da grade"
            >
              Tornar Principal
            </Button>
          )}
          <Popconfirm
            title="Remover atributo?"
            description="Isso afetará a grade de variações."
            onConfirm={() => handleRemoveAtributo(record.id)}
            okText="Sim"
            cancelText="Não"
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              Remover
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>Configurar Estrutura da Família</Title>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Defina o nome e os eixos de variação (ex: Cor, Tamanho) que compõem a grade.
          </Text>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSave}>
          Salvar Estrutura
        </Button>
      ]}
    >
      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Nome da Família</Text>
          <Input 
            value={nomeFamilia} 
            onChange={e => setNomeFamilia(e.target.value)} 
            placeholder="Ex: Camiseta Básica Algodão" 
          />
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Atributos da Grade (Eixos de Variação)</Text>
          <Select
            placeholder="+ Adicionar Atributo do Dicionário"
            style={{ width: 260 }}
            onChange={handleAddAtributo}
            optionLabelProp="label"
            options={atributosGlobaisDisponiveis.map(attr => ({
              value: attr.id,
              label: attr.nome,
              // Evita selecionar os que já estão na lista
              disabled: atributosEstrutura.some(a => a.id === attr.id)
            }))}
          />
        </div>

        <Table
          dataSource={atributosEstrutura}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Nenhum atributo configurado para esta família ainda.' }}
        />
      </div>
    </Modal>
  );
}