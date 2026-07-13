import React, { useState, useEffect } from 'react';
import { 
  Drawer, 
  Tabs, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  Switch, 
  Button, 
  Space, 
  Row, 
  Col, 
  Alert, 
  Tag, 
  Typography,
  Upload,
  Divider,
  message
} from 'antd';
import { 
  DollarOutlined, 
  InboxOutlined, 
  GlobalOutlined, 
  FileTextOutlined, 
  TeamOutlined,
  SaveOutlined,
  RollbackOutlined,
  PlusOutlined,
  AppstoreOutlined,
  PictureOutlined,
  ClusterOutlined,
  UserOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;

interface ProductDetailsDrawerProps {
  visible: boolean;
  product: any | null;
  onClose: () => void;
  onSave: (id: string, updatedFields: any) => Promise<void>;
}

export default function ProductDetailsDrawer({ visible, product, onClose, onSave }: ProductDetailsDrawerProps) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('financeiro');

  const [currentStock, setCurrentStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [maxStock, setMaxStock] = useState(0);
  const [fileList, setFileList] = useState<any[]>([]);

  // Regra de negócio: Identifica se o item possui SKUs filhos ou grade vinculada
  const isFamilyProduct = product?.skus && product.skus.length > 0;

  useEffect(() => {
    if (product) {
      const estoqueCalculado = product.skus?.reduce((acc: number, sku: any) => acc + sku.estoque, 0) || 0;
      
      form.setFieldsValue({
        nomeItem: product.nomeItem,
        codItem: product.codItem,
        status: product.status !== 'Inativo',
        estoqueMinimo: product.estoqueMinimo || 10,
        estoqueMaximo: product.estoqueMaximo || 100,
        estoqueAtual: estoqueCalculado,
        ncm: product.ncm || '',
        cest: product.cest || '',
        marca: product.marca || '',
        unidadeMedida: product.unidadeMedida || 'UN',
        descricaoCurta: product.descricaoCurta || '',
        descricaoLonga: product.descricaoLonga || '',
        pesoKg: product.pesoKg || 0,
        alturaCm: product.alturaCm || 0,
        larguraCm: product.larguraCm || 0,
        comprimentoCm: product.comprimentoCm || 0,
        fornecedorPadraoId: product.fornecedorPadraoId || '',
        codigoBarrasEan: product.codigoBarrasEan || '',
      });

      setCurrentStock(estoqueCalculado);
      setMinStock(product.estoqueMinimo || 10);
      setMaxStock(product.estoqueMaximo || 100);

      if (product.imagens) {
        setFileList(product.imagens.map((url: string, index: number) => ({
          uid: `-${index}`,
          name: `imagem-${index}.png`,
          status: 'done',
          url: url,
        })));
      } else if (product.urlImagem) {
        const urls = product.urlImagem.split(',').filter(Boolean);
        setFileList(urls.map((url: string, index: number) => ({
          uid: `-${index}`,
          name: `imagem-${index}.png`,
          status: 'done',
          url: url.trim(),
        })));
      } else {
        setFileList([]);
      }
    }
  }, [product, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSaving(true);
      
      const urlsImagens = fileList
        .map(file => file.url || file.response?.url || '')
        .filter(Boolean);

      const payload = {
        ...values,
        status: values.status ? 'Ativo' : 'Inativo',
        imagens: urlsImagens,
        urlImagem: urlsImagens.join(',')
      };

      await onSave(product.key || product.id, payload);
      message.success('Produto atualizado com sucesso!');
      onClose();
    } catch (error) {
      console.error('Validação falhou:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadChange = ({ fileList: newFileList }: any) => {
    setFileList(newFileList);
  };

  const tabItems = [
    {
      key: 'financeiro',
      label: <span><DollarOutlined /> Financeiro</span>,
      children: (
        <div>
          <Alert 
            message={isFamilyProduct ? "Calculadora de Herança de Preço (Família)" : "Calculadora Spot & Margens de Lucro"} 
            description={isFamilyProduct 
              ? "As margens configuradas aqui servirão como base padrão (markup mestre) para os SKUs filhos vinculados." 
              : "Defina os custos e margens diretas para este produto individual."}
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px', textAlign: 'center', color: '#8c8c8c' }}>
            [PricingCalculator Component - Integrado]
          </div>
        </div>
      )
    },
    {
      key: 'estoque',
      label: <span><InboxOutlined /> Estoque & Logística</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="estoqueMinimo" label="Estoque Mínimo">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="estoqueMaximo" label="Estoque Máximo">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="estoqueAtual" 
                label={isFamilyProduct ? "Estoque Consol. (Grade)" : "Estoque Atual (Individual)"}
              >
                <InputNumber style={{ width: '100%' }} disabled />
              </Form.Item>
            </Col>
          </Row>

          {currentStock <= minStock && (
            <Alert
              message="Sugestão de Reposição de Estoque"
              description={`Atenção! Estoque crítico. Comprar mais ${maxStock - currentStock} unidades para atingir o estoque máximo ideal.`}
              type="warning"
              showIcon
            />
          )}

          <Divider orientation="left" style={{ margin: '8px 0', fontSize: '12px' }}>Dimensões de Frete (Cálculo de Cubagem)</Divider>
          
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="pesoKg" label="Peso (Kg)">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="comprimentoCm" label="Comprimento (cm)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="larguraCm" label="Largura (cm)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="alturaCm" label="Altura (cm)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
        </Space>
      )
    },
    {
      key: 'ecommerce',
      label: <span><GlobalOutlined /> Descrições & Catálogo</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Form.Item name="descricaoCurta" label="Chamada / Descrição Comercial Curta">
            <Input placeholder="Texto breve focado em conversão e SEO" maxLength={150} showCount />
          </Form.Item>

          <Form.Item name="descricaoLonga" label="Ficha Técnica Completa">
            <Input.TextArea rows={4} placeholder="Especificações detalhadas, composição e cuidados com o produto..." />
          </Form.Item>
        </Space>
      )
    },
    {
      key: 'fiscal',
      label: <span><FileTextOutlined /> Fiscal</span>,
      children: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ncm" label="NCM (Classificação Fiscal)">
              <Input placeholder="Ex: 6109.10.00" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="cest" label="CEST">
              <Input placeholder="Ex: 21.011.00" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item 
              name="codigoBarrasEan" 
              label="Código de Barras EAN / GTIN"
              tooltip={isFamilyProduct ? "Produtos com variação devem ter o EAN gerenciado diretamente nas configurações internas de cada SKU filho." : undefined}
            >
              <Input placeholder="7890000000000" disabled={isFamilyProduct} />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      key: 'fornecedor',
      label: <span><TeamOutlined /> Fornecedores</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item name="fornecedorPadraoId" label="Fornecedor Homologado Preferencial">
            <Select placeholder="Vincular fornecedor padrão...">
              <Option value="101">Distribuidora Global de Ferro e Aço S.A.</Option>
              <Option value="102">FORNECEDOR GENERICO - COMPRAS SPOT</Option>
            </Select>
          </Form.Item>
          <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px', textAlign: 'center', color: '#8c8c8c' }}>
            O histórico de ordens de compra anteriores ligadas a este item será consolidado aqui.
          </div>
        </Space>
      )
    }
  ];

  return (
    <Drawer
      title={
        <Space direction="vertical" size={1} style={{ width: '100%' }}>
          <Space align="center" size={8}>
            <Title level={4} style={{ margin: 0 }}>Ficha Cadastral do Produto</Title>
            {isFamilyProduct ? (
              <Tag color="purple" icon={<ClusterOutlined />} style={{ fontWeight: 'bold' }}>FAMÍLIA / GRADE</Tag>
            ) : (
              <Tag color="default" icon={<UserOutlined />}>INDIVIDUAL</Tag>
            )}
          </Space>
          <Text type="secondary">{isFamilyProduct ? "Código do SKU Pai: " : "Código do Item: "} <Text code>{product?.codItem || 'N/A'}</Text></Text>
        </Space>
      }
      width={680}
      onClose={onClose}
      open={visible}
      extra={
        <Space>
          <Button onClick={onClose} icon={<RollbackOutlined />}>Cancelar</Button>
          <Button type="primary" onClick={handleSubmit} loading={isSaving} icon={<SaveOutlined />}>
            Salvar Registro
          </Button>
        </Space>
      }
    >
      {/* Banner contextual de topo avisando o impacto da edição */}
      {isFamilyProduct ? (
        <Alert
          message={<span style={{ fontWeight: 600, color: '#391085' }}>Modo de Edição de Família</span>}
          description={`Você está editando o registro pai. Alterações em Nome, Imagens e Campos Fiscais se aplicarão por efeito cascata aos ${product.skus.length} SKUs da grade.`}
          type="success"
          showIcon
          icon={<ClusterOutlined style={{ color: '#722ed1' }} />}
          style={{ marginBottom: 16, backgroundColor: '#f9f0ff', borderColor: '#d3adf7' }}
        />
      ) : (
        <Alert
          message="Modo de Edição Individual"
          description="Este item é um produto simples sem variações de tamanho, cor ou sabor. As alterações afetarão unicamente este SKU."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form 
        form={form} 
        layout="vertical"
        onValuesChange={(changedValues) => {
          if (changedValues.estoqueMinimo !== undefined) setMinStock(changedValues.estoqueMinimo);
          if (changedValues.estoqueMaximo !== undefined) setMaxStock(changedValues.estoqueMaximo);
        }}
      >
        {/* 1. Painel Superior de Visibilidade */}
        <Row gutter={16} align="middle" style={{ marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
          <Col span={12}>
            <Form.Item name="status" label="Status Comercial" valuePropName="checked" style={{ margin: 0 }}>
              <Switch checkedChildren="ATIVO" unCheckedChildren="INATIVO" />
            </Form.Item>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Tag color={currentStock <= minStock ? 'orange' : 'blue'} style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '4px' }}>
              <AppstoreOutlined /> {isFamilyProduct ? 'Estoque Total da Grade: ' : 'Total em Estoque: '} {currentStock} {form.getFieldValue('unidadeMedida') || 'UN'}
            </Tag>
          </Col>
        </Row>

        {/* 2. Upload de Imagens no TOPO */}
        <div style={{ background: '#fafafa', padding: '16px 16px 4px 16px', borderRadius: '8px', marginBottom: 20, border: '1px dashed #d9d9d9' }}>
          <Form.Item label={<span style={{ fontWeight: 500 }}><PictureOutlined /> Galeria de Fotos (Identificação Rápida)</span>}>
            <Upload
              action="/api/media/upload"
              listType="picture-card"
              fileList={fileList}
              onChange={handleUploadChange}
              beforeUpload={(file) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                  setFileList(prev => [...prev, { uid: file.uid, name: file.name, status: 'done', url: reader.result as string }]);
                };
                return false; 
              }}
            >
              {fileList.length >= 5 ? null : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </div>

        {/* 3. Informações Primárias de Identificação */}
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="nomeItem" label={isFamilyProduct ? "Nome Comercial da Família (Mestre)" : "Nome de Catálogo / Comercial"} rules={[{ required: true, message: 'Insira a descrição do produto!' }]}>
              <Input placeholder="Ex: Camiseta Oversized Malha Fria" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Form.Item name="marca" label="Marca ou Fabricante">
              <Select placeholder="Selecione...">
                <Option value="propria">Marca Própria</Option>
                <Option value="parceiro">Fornecedor Homologado</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="unidadeMedida" label="Unidade de Medida">
              <Select>
                <Option value="UN">UN (Unidade)</Option>
                <Option value="CX">CX (Caixa)</Option>
                <Option value="KG">KG (Quilo)</Option>
                <Option value="M">M (Metro)</Option>
                <Option value="PCT">PCT (Pacote)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* 4. Abas Avançadas parametrizadas */}
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} items={tabItems} />
      </Form>
    </Drawer>
  );
}