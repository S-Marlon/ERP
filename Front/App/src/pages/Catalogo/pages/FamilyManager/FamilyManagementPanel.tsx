import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Row, 
  Col, 
  Upload, 
  Typography, 
  Modal,
  Divider,
  Tooltip
} from 'antd';
import { 
  InboxOutlined, 
  PlayCircleOutlined, 
  SwapOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  RightOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

export default function FamilyManagementPanelSplitLayout() {
  const [form] = Form.useForm();
  
  // Estados de controle de painéis e modais
  const [isItemsPanelOpen, setIsItemsPanelOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [standardizeType, setStandardizeType] = useState<'name' | 'sku'>('name');

  // Estado para a área interativa de simulação de atributos
  const [simulationAttribute, setSimulationAttribute] = useState<string>('Cor');
  const [simulationValue, setSimulationValue] = useState<string>('Vermelho');
  const [simulatedAttributesList, setSimulatedAttributesList] = useState([
    { key: '1', attribute: 'Cor', value: 'Preta' },
    { key: '2', attribute: 'Tamanho', value: '3.6x150mm' }
  ]);

  // Função para adicionar valor de simulação
  const handleAddSimulationValue = () => {
    if (!simulationValue) return;
    setSimulatedAttributesList([
      ...simulatedAttributesList,
      { key: String(Date.now()), attribute: simulationAttribute, value: simulationValue }
    ]);
    setSimulationValue('');
  };

  // Função para remover valor de simulação
  const handleRemoveSimulationValue = (key: string) => {
    setSimulatedAttributesList(simulatedAttributesList.filter(item => item.key !== key));
  };

  // Dados dos itens da família
  const [familyItemsData] = useState([
    { key: '1', sku: 'GD-3046-PRETA', status: 'Ativo', commercialName: 'ABRAÇADEIRA DE NYLON - 3.6X150MM - PRETA' },
    { key: '2', sku: 'GD-3047-BRANCA', status: 'Ativo', commercialName: 'ABRAÇADEIRA DE NYLON - 3.6X200MM - BRANCA' },
  ]);

  // Atributos base
  const attributesData = [
    { key: '1', type: 'DNA', name: 'Cor', dataType: 'TEXTO' },
    { key: '2', type: 'Eixo de Variação', name: 'Tamanho', dataType: 'NUMERO' },
  ];

  const attributesColumns = [
    { title: 'Tipo', dataIndex: 'type', key: 'type', width: '35%', render: (t: string) => <Text strong style={{ fontSize: '11px' }}>{t}</Text> },
    { title: 'Atributo', dataIndex: 'name', key: 'name', width: '40%', render: (t: string) => <Text style={{ fontSize: '11px' }}>{t}</Text> },
    { title: 'Formato', dataIndex: 'dataType', key: 'dataType', width: '25%', render: (dt: string) => <Tag color="blue" style={{ margin: 0, fontSize: '10px' }}>{dt}</Tag> },
  ];

  const previewData = [
    { key: '1', sku: 'GD-3046-PRETA', before: 'Abraçadeira Nylon 3.6x150', after: 'ABRAÇADEIRA DE NYLON - 3.6X150MM - PRETA' },
  ];

  const familyItemsColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: '35%', render: (t: string) => <Text strong style={{ fontSize: '11px' }}>{t}</Text> },
    { title: 'Nome Comercial', dataIndex: 'commercialName', key: 'commercialName', render: (t: string) => <span style={{ fontSize: '11px' }}>{t}</span> },
  ];

  const comparisonColumns = [
    { title: 'SKU / Item', dataIndex: 'sku', key: 'sku', width: '25%' },
    { title: 'Antes (Atual)', dataIndex: 'before', key: 'before', render: (t: string) => <Text type="secondary">{t}</Text> },
    { title: 'Depois (Simulação)', dataIndex: 'after', key: 'after', render: (t: string) => <Text type="success" strong>{t}</Text> },
  ];

  const handleOpenPreview = (type: 'name' | 'sku') => {
    setStandardizeType(type);
    setIsModalOpen(true);
  };

  return (
    <div style={{ padding: '12px 16px', background: '#f0f2f5', minHeight: '100vh', fontSize: '13px' }}>
    

      <Form form={form} layout="vertical" size="small">
        <Row gutter={[8, 8]}>
          
          {/* ================= COLUNA ESQUERDA ================= */}
          <Col xs={24} lg={10}>
            <Row gutter={[8, 8]}>
              
              {/* 1. Configurações de Identidade */}
              <Col span={24}>
                <Card title="Configurações de Identidade" size="small">
                  <Row gutter={12} align="middle">
                    <Col xs={24} sm={6} md={5} style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <Upload.Dragger 
                        name="file" 
                        multiple={false} 
                        style={{ width: '100px', height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: '6px' }}
                      >
                        <p style={{ fontSize: '20px', margin: 0 }}><InboxOutlined /></p>
                        <p style={{ fontSize: '10px', margin: 0 }}>Sem imagem</p>
                      </Upload.Dragger>
                    </Col>

                    <Col xs={24} sm={18} md={19}>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item label="Nome da Família" style={{ marginBottom: 6 }}>
                            <Input defaultValue="Abraçadeira de Nylon" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="Unidade Base" style={{ marginBottom: 6 }}>
                            <Select defaultValue="PC"><Option value="PC">PC</Option></Select>
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="Tipo SPED" style={{ marginBottom: 6 }}>
                            <Select defaultValue="Acabado"><Option value="Acabado">Acabado</Option></Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item label="Categoria de Vínculo" style={{ marginBottom: 0 }}>
                            <Select defaultValue="global"><Option value="global">Vincular à árvore global...</Option></Select>
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="NCM Padrão" style={{ marginBottom: 0 }}>
                            <Input placeholder="NCM" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="CEST Padrão" style={{ marginBottom: 0 }}>
                            <Input placeholder="CEST" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* 2. Atributos e Parâmetros Base Cadastrados (Abaixo da Identidade na Esquerda) */}
              <Col span={24}>
                <Card title="Atributos e Parâmetros Base" size="small">
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>Atributos e Parâmetros Base Cadastrados</Text>
                  </div>
                  <Table 
                    dataSource={attributesData} 
                    columns={attributesColumns} 
                    pagination={false} 
                    size="small" 
                    bordered
                  />
                </Card>
              </Col>

            </Row>
          </Col>

          {/* ================= COLUNA DIREITA ================= */}
          <Col xs={24} lg={14}>
            <Row gutter={[8, 8]}>
              
              {/* 1. Painel de Simulação de Nome e SKU */}
              <Col span={24}>
                <Card 
                  title={<span style={{ color: '#0958d9' }}>⚡ Painel de Simulação de Nome e SKU</span>} 
                  size="small"
                  style={{ 
                    background: '#f0f5ff', 
                    border: '1px solid #adc6ff',
                    borderRadius: '8px'
                  }}
                >
                  <Row gutter={8}>
                    {/* Simulação Nome */}
                    <Col span={12}>
                      <div style={{ background: '#ffffff', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: '4px', marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Preview Nome:</Text>
                        <div style={{ fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ABRAÇADEIRA DE NYLON - 3.6X150MM - PRETA
                        </div>
                      </div>
                      <Form.Item label="Template Nome" style={{ marginBottom: 4 }}>
                        <Input size="small" defaultValue="{GRUPO} - {Tamanho} - {Cor}" />
                      </Form.Item>
                      <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />} onClick={() => handleOpenPreview('name')} block>
                        Padronizar Nomes
                      </Button>
                    </Col>

                    {/* Simulação SKU */}
                    <Col span={12}>
                      <div style={{ background: '#ffffff', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: '4px', marginBottom: 4 }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Preview SKU:</Text>
                        <div style={{ fontWeight: 600, fontSize: '11px' }}>GD-3046-PRETA</div>
                      </div>
                      <Row gutter={4}>
                        <Col span={14}>
                          <Form.Item label="Sigla / Sep." style={{ marginBottom: 4 }}>
                            <Input size="small" defaultValue="GD (-)" disabled />
                          </Form.Item>
                        </Col>
                        <Col span={10}>
                          <Form.Item label="Template SKU" style={{ marginBottom: 4 }}>
                            <Input size="small" defaultValue="{Sigla}-{Var}-{Cor}" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />} onClick={() => handleOpenPreview('sku')} block>
                        Padronizar SKUs
                      </Button>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '8px 0', borderColor: '#adc6ff' }} />
                  
                  {/* Área de Teste/Simulação com Atributos Ativos */}
                  <div style={{ background: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px dashed #91caff', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px', color: '#1d39c4' }}>
                      🧪 Simular Valores de Atributos em Tempo Real:
                    </Text>
                    <Space size={4} style={{ width: '100%', marginBottom: '6px' }} wrap>
                      <Select 
                        size="small" 
                        value={simulationAttribute} 
                        onChange={setSimulationAttribute} 
                        style={{ width: 110 }}
                      >
                        <Option value="Cor">Cor (DNA)</Option>
                        <Option value="Tamanho">Tamanho (Eixo)</Option>
                      </Select>
                      <Input 
                        size="small" 
                        placeholder="Digite o valor" 
                        value={simulationValue} 
                        onChange={(e) => setSimulationValue(e.target.value)} 
                        style={{ width: 130 }}
                      />
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={handleAddSimulationValue}>
                        Adicionar
                      </Button>
                    </Space>

                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {simulatedAttributesList.map(item => (
                        <Tag 
                          key={item.key} 
                          closable 
                          onClose={() => handleRemoveSimulationValue(item.key)}
                          color="blue"
                          style={{ fontSize: '11px', margin: '2px' }}
                        >
                          <b>{item.attribute}:</b> {item.value}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </Card>
              </Col>

              {/* 2. Itens da Família (Abaixo da Simulação na Direita, se visível) */}
              {isItemsPanelOpen && (
                <Col span={24}>
                  <Card 
                    title={
                      <Space>
                        <span>Itens da Família</span>
                        <Tag color="success">{familyItemsData.length} itens</Tag>
                      </Space>
                    }
                    extra={
                      <Space size="small">
                        <Button type="primary" size="small" icon={<PlusOutlined />}>Adicionar</Button>
                        <Tooltip title="Recolher painel">
                          <Button type="text" size="small" icon={<RightOutlined />} onClick={() => setIsItemsPanelOpen(false)} />
                        </Tooltip>
                      </Space>
                    }
                    size="small"
                    bodyStyle={{ padding: '8px' }}
                  >
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>SKUs gerados sob as regras desta família:</Text>
                    </div>
                    <Table 
                      dataSource={familyItemsData} 
                      columns={familyItemsColumns} 
                      pagination={false} 
                      size="small"
                      scroll={{ y: 220 }}
                    />
                  </Card>
                </Col>
              )}

            </Row>
          </Col>

        </Row>
      </Form>

      {/* MODAL DE PREVIEW: ANTES E DEPOIS DA PADRONIZAÇÃO */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>Simulação de Padronização em Lote ({standardizeType === 'name' ? 'Nomes Comerciais' : 'SKUs'})</span>
          </Space>
        }
        open={isModalOpen}
        onOk={() => setIsModalOpen(false)}
        onCancel={() => setIsModalOpen(false)}
        width={750}
        okText="Aplicar Padronização"
        cancelText="Voltar"
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            Prévia de alteração em lote com base nos parâmetros atuais de simulação:
          </Text>
        </div>
        <Table 
          dataSource={previewData} 
          columns={comparisonColumns} 
          pagination={false} 
          size="small" 
          bordered 
        />
      </Modal>

    </div>
  );
}