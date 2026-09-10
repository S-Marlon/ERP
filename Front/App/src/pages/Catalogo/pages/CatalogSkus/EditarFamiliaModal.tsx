import React, { useState } from 'react';
import { Modal, Form, Input, Button, Table, Tag, Space, Typography, Divider, message, Tooltip } from 'antd';
import { EditOutlined, SettingOutlined, ShoppingCartOutlined, QuestionCircleOutlined, TagOutlined, ThunderboltOutlined, BlockOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface EditarFamiliaModalProps {
  visible: boolean;
  onClose: () => void;
  familia: any;
  itensFamilia: any[];
  onSalvarFamilia: (valoresAtualizados: any) => void;
  onAplicarPadraoNomeEmLote?: (padrao: string) => void;
  onAplicarPadraoSkuEmLote?: (prefixo: string) => void;
  onIrParaConfiguracaoCompleta: (familiaId: any) => void;
  brandColor?: string;
}

export const EditarFamiliaModal: React.FC<EditarFamiliaModalProps> = ({
  visible,
  onClose,
  familia,
  itensFamilia = [],
  onSalvarFamilia,
  onAplicarPadraoNomeEmLote,
  onAplicarPadraoSkuEmLote,
  onIrParaConfiguracaoCompleta,
  brandColor = '#1890ff',
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Estados dos Modais Secundários (Aplicação em Lote)
  const [isModalNomeOpen, setIsModalNomeOpen] = useState(false);
  const [isModalSkuOpen, setIsModalSkuOpen] = useState(false);

  React.useEffect(() => {
    if (familia && visible) {
      form.setFieldsValue({
        nome: familia.nome,
        unidadeMedidaBase: familia.unidadeMedidaBase || 'PC',
        tipoItem: familia.tipoItem || 'PA',
        ncmPadrao: familia.ncmPadrao,
        cestPadrao: familia.cestPadrao,
        padraoNome: familia.padraoNome || '[Nome da Família] - [Variação]',
        prefixoSku: familia.prefixoSku || '',
      });
    }
  }, [familia, visible, form]);

  const handleFinish = async (values: any) => {
    try {
      setLoading(true);
      await onSalvarFamilia({ ...familia, ...values });
      message.success('Família e padrões atualizados com sucesso!');
      onClose();
    } catch (error) {
      message.error('Erro ao atualizar família.');
    } finally {
      setLoading(false);
    }
  };

  const colunasItens = [
    {
      title: 'SKU Gerado',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => <Text code style={{ fontWeight: 600 }}>{sku}</Text>,
    },
    {
      title: 'Nome do Item (Padrão Aplicado)',
      dataIndex: 'nomeItem',
      key: 'nomeItem',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ATIVO' ? 'success' : 'default'}>
          {status === 'ATIVO' ? 'Ativo' : 'Inativo'}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space size={8}>
            <EditOutlined style={{ color: brandColor }} />
            <span>Gerenciar Família: {familia?.nome || ''}</span>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={780}
        footer={[
          <Button key="back" onClick={onClose}>
            Fechar
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            style={{ backgroundColor: brandColor, borderColor: brandColor }}
            onClick={() => form.submit()}
          >
            Salvar Alterações
          </Button>,
        ]}
      >
        <div style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: '4px' }}>
          
          <Form form={form} layout="vertical" onFinish={handleFinish}>
            
            {/* CARD 1: INFORMAÇÕES BÁSICAS */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <Text style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>Informações Básicas da Família</Text>
                
                <Button
                  type="dashed"
                  size="small"
                  icon={<SettingOutlined />}
                  style={{ borderColor: brandColor, color: brandColor }}
                  onClick={() => {
                    onClose();
                    onIrParaConfiguracaoCompleta(familia?.id);
                  }}
                >
                  Configurar Atributos e DNA Avançado
                </Button>
              </div>

              <Form.Item
                name="nome"
                label="Nome da Família"
                rules={[{ required: true, message: 'Insira o nome da família' }]}
                style={{ marginBottom: '10px' }}
              >
                <Input placeholder="Ex: Camiseta Básica Algodão" />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <Form.Item name="unidadeMedidaBase" label="Unidade" style={{ marginBottom: '0' }}>
                  <Input placeholder="PC, KG" />
                </Form.Item>
                <Form.Item name="tipoItem" label="Tipo SPED" style={{ marginBottom: '0' }}>
                  <Input placeholder="PA, Mercadoria" />
                </Form.Item>
                <Form.Item name="ncmPadrao" label="NCM Padrão" style={{ marginBottom: '0' }}>
                  <Input placeholder="0000.00.00" />
                </Form.Item>
                <Form.Item name="cestPadrao" label="CEST Padrão" style={{ marginBottom: '0' }}>
                  <Input placeholder="00.000.00" />
                </Form.Item>
              </div>
            </div>

            {/* CARD 2: MÓDULO DE NOMENCLATURA E PADRÃO DE SKUS */}
            <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <Space size={6}>
                  <BlockOutlined style={{ color: '#16a34a' }} />
                  <Text style={{ fontWeight: 600, fontSize: '13px', color: '#166534' }}>
                    Módulo de Nomenclatura e Padrão de SKUs
                  </Text>
                </Space>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* Bloco Nome */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <Space size={4}>
                      <Text strong style={{ fontSize: '12px' }}>Padrão de Nome</Text>
                      <Tooltip title="Regra de nomenclatura herdada pelos itens filhos.">
                        <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                      </Tooltip>
                    </Space>
                    <Button
                      type="link"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      style={{ padding: 0, height: 'auto', color: '#16a34a' }}
                      onClick={() => setIsModalNomeOpen(true)}
                    >
                      Aplicar em Lote
                    </Button>
                  </div>
                  <Form.Item name="padraoNome" style={{ marginBottom: '0' }}>
                    <Input placeholder="Ex: [Família] - [Variação]" />
                  </Form.Item>
                </div>

                {/* Bloco SKU */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <Space size={4}>
                      <TagOutlined style={{ color: '#16a34a' }} />
                      <Text strong style={{ fontSize: '12px' }}>Prefixo / Máscara SKU</Text>
                    </Space>
                    <Button
                      type="link"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      style={{ padding: 0, height: 'auto', color: '#16a34a' }}
                      onClick={() => setIsModalSkuOpen(true)}
                    >
                      Aplicar em Lote
                    </Button>
                  </div>
                  <Form.Item name="prefixoSku" style={{ marginBottom: '0' }}>
                    <Input placeholder="Ex: CAM-BAS-" />
                  </Form.Item>
                </div>

              </div>
            </div>

          </Form>

          <Divider style={{ margin: '12px 0' }} />

          {/* Seção 2: Itens Associados */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Space size={6}>
                <ShoppingCartOutlined style={{ color: brandColor }} />
                <Text style={{ fontWeight: 600, fontSize: '13px', color: '#334155' }}>
                  Itens e Variações Vinculadas ({itensFamilia.length})
                </Text>
              </Space>
            </div>

            <Table
              dataSource={itensFamilia}
              columns={colunasItens}
              rowKey="idItem"
              size="small"
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: 'Nenhum SKU associado a esta família.' }}
            />
          </div>

        </div>
      </Modal>

      {/* --- MODAL DE CONFIRMAÇÃO: APLICAR PADRÃO DE NOME EM LOTE --- */}
      <Modal
        title="Aplicar Padrão de Nome em Lote"
        open={isModalNomeOpen}
        onOk={() => {
          const valor = form.getFieldValue('padraoNome');
          if (onAplicarPadraoNomeEmLote) onAplicarPadraoNomeEmLote(valor);
          message.success(`Padrão de nome aplicado a ${itensFamilia.length} itens!`);
          setIsModalNomeOpen(false);
        }}
        onCancel={() => setIsModalNomeOpen(false)}
        okText="Confirmar Aplicação"
        cancelText="Cancelar"
      >
        <p>Tem certeza que deseja aplicar a regra <strong>{form.getFieldValue('padraoNome') || 'Padrão Vazio'}</strong> em todos os <strong>{itensFamilia.length}</strong> itens vinculados a esta família?</p>
        <Text type="secondary">Esta ação atualizará o nome de exibição de todos os SKUs filhos instantaneamente.</Text>
      </Modal>

      {/* --- MODAL DE CONFIRMAÇÃO: APLICAR PREFIXO DE SKU EM LOTE --- */}
      <Modal
        title="Aplicar Prefixo de SKU em Lote"
        open={isModalSkuOpen}
        onOk={() => {
          const valor = form.getFieldValue('prefixoSku');
          if (onAplicarPadraoSkuEmLote) onAplicarPadraoSkuEmLote(valor);
          message.success(`Prefixo de SKU aplicado a ${itensFamilia.length} itens!`);
          setIsModalSkuOpen(false);
        }}
        onCancel={() => setIsModalSkuOpen(false)}
        okText="Confirmar Geração"
        cancelText="Cancelar"
      >
        <p>Deseja gerar e aplicar o prefixo <strong>{form.getFieldValue('prefixoSku') || 'Nenhum Prefixo'}</strong> para os códigos de SKU dos <strong>{itensFamilia.length}</strong> itens desta família?</p>
        <Text type="secondary">Os códigos dos itens filhos serão recalculados utilizando este prefixo base.</Text>
      </Modal>
    </>
  );
};