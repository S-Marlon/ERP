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
  UserOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;

interface ProductDetailsDrawerProps {
  open: boolean;
  product: any | null;
  onClose: () => void;
  onSave: (id: string | number, updatedFields: any) => Promise<void>;
}

export default function ProductDetailsDrawer({ open, product, onClose, onSave }: ProductDetailsDrawerProps) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('financeiro');

  const [currentStock, setCurrentStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [maxStock, setMaxStock] = useState(0);
  const [fileList, setFileList] = useState<any[]>([]);

  useEffect(() => {
    if (product) {
      form.setFieldsValue({
        nomeItem: product.nome_item || product.nomeItem || undefined,
        codItem: product.sku || product.codItem || undefined,
        status: product.status ? String(product.status).toUpperCase() !== 'INATIVO' : false,
        estoqueMinimo: product.estoqueMinimo ?? product.estoque_minimo ?? undefined,
        estoqueMaximo: product.estoqueMaximo ?? product.estoque_maximo ?? undefined,
        estoqueAtual: product.estoque || product.estoque_atual || 0,
        ncm: product.ncm ?? undefined,
        cest: product.cest ?? undefined,
        marca: product.marca || undefined,
        unidadeMedida: product.unidadeMedida ?? product.unidade_medida ?? undefined,
        descricaoCurta: product.descricaoCurta ?? product.descricao_curta ?? undefined,
        descricaoLonga: product.descricaoLonga ?? product.descricao_longa ?? undefined,
        pesoKg: product.pesoKg ?? product.peso_kg ?? undefined,
        alturaCm: product.alturaCm ?? product.altura_cm ?? undefined,
        larguraCm: product.larguraCm ?? product.largura_cm ?? undefined,
        comprimentoCm: product.comprimentoCm ?? product.comprimento_cm ?? undefined,
        fornecedorPadraoId: product.fornecedorPadraoId ?? product.fornecedor_padrao_id ?? undefined,
        codigoBarrasEan: product.codigoBarrasEan || product.codigo_barras_ean || product.sku || undefined,
      });

      setCurrentStock(product.estoque || product.estoque_atual || 0);
      setMinStock(Number(product.estoqueMinimo ?? product.estoque_minimo ?? 0));
      setMaxStock(Number(product.estoqueMaximo ?? product.estoque_maximo ?? 0));

      const imagensSrc = product.urlImagem || product.url_imagem || product.imagens;
      if (Array.isArray(imagensSrc)) {
        setFileList(imagensSrc.map((url: string, index: number) => ({
          uid: `-${index}`,
          name: `imagem-${index}.png`,
          status: 'done',
          url: url,
        })));
      } else if (typeof imagensSrc === 'string' && imagensSrc.trim() !== '') {
        const urls = imagensSrc.split(',').filter(Boolean);
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
        nome_item: values.nomeItem ?? product?.nome_item ?? null,
        sku: values.codItem ?? product?.sku ?? null,
        status: values.status ? 'ATIVO' : 'INATIVO',
        estoque_minimo: values.estoqueMinimo ?? product?.estoque_minimo ?? null,
        estoque_maximo: values.estoqueMaximo ?? product?.estoque_maximo ?? null,
        ncm: values.ncm ?? product?.ncm ?? null,
        cest: values.cest ?? product?.cest ?? null,
        marca: values.marca ?? product?.marca ?? null,
        unidade_medida: values.unidadeMedida ?? product?.unidade_medida ?? null,
        descricao_curta: values.descricaoCurta ?? product?.descricao_curta ?? null,
        descricao_longa: values.descricaoLonga ?? product?.descricao_longa ?? null,
        peso_kg: values.pesoKg ?? product?.peso_kg ?? null,
        altura_cm: values.alturaCm ?? product?.altura_cm ?? null,
        largura_cm: values.larguraCm ?? product?.largura_cm ?? null,
        comprimento_cm: values.comprimentoCm ?? product?.comprimento_cm ?? null,
        fornecedor_padrao_id: values.fornecedorPadraoId ?? product?.fornecedor_padrao_id ?? null,
        imagens: urlsImagens,
        url_imagem: urlsImagens.join(',')
      };

      const rawItemId = product?.id_item ?? product?.id ?? product?.key;
      const itemId = Number(rawItemId);

      if (
        rawItemId === undefined ||
        rawItemId === null ||
        rawItemId === '' ||
        !Number.isFinite(itemId) ||
        itemId <= 0
      ) {
        message.error('Erro crítico: ID do produto não identificado ou inválido para edição.');
        setIsSaving(false);
        return;
      }

      await onSave(itemId, payload);
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
            message="Calculadora Spot & Margens de Lucro" 
            description="Defina os custos e margens diretas para este produto individual."
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px', textAlign: 'center', color: '#8c8c8c' }}>
            Dados financeiros serão exibidos quando disponíveis no banco.
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
              <Form.Item name="estoqueAtual" label="Estoque Atual (Individual)">
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
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="comprimentoCm" label="Comprimento (cm)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="larguraCm" label="Largura (cm)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="alturaCm" label="Altura (cm)">
                <InputNumber style={{ width: '100%' }} min={0} />
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
            <Input maxLength={150} showCount />
          </Form.Item>

          <Form.Item name="descricaoLonga" label="Ficha Técnica Completa">
            <Input.TextArea rows={4} />
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
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="cest" label="CEST">
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="codigoBarrasEan" label="Código de Barras EAN / GTIN">
              <Input />
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
            <Select placeholder="Selecione o fornecedor" allowClear />
          </Form.Item>
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
            <Tag color="default" icon={<UserOutlined />}>INDIVIDUAL</Tag>
          </Space>
          <Text type="secondary">ID do Sistema: <Text code>{product?.id_item || product?.id || 'N/A'}</Text></Text>
        </Space>
      }
      width={800}
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Button onClick={onClose} icon={<RollbackOutlined />}>Cancelar</Button>
          <Button type="primary" onClick={handleSubmit} loading={isSaving} icon={<SaveOutlined />}>
            Salvar Registro
          </Button>
        </Space>
      }
    >
      <Form 
        form={form} 
        layout="vertical"
        onValuesChange={(changedValues) => {
          if (changedValues.estoqueMinimo !== undefined) setMinStock(changedValues.estoqueMinimo);
          if (changedValues.estoqueMaximo !== undefined) setMaxStock(changedValues.estoqueMaximo);
        }}
      >
        <Row gutter={16} align="middle" style={{ marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
          <Col span={12}>
            <Form.Item name="status" label="Status Comercial" valuePropName="checked" style={{ margin: 0 }}>
              <Switch checkedChildren="ATIVO" unCheckedChildren="INATIVO" />
            </Form.Item>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Tag color={currentStock <= minStock ? 'orange' : 'blue'} style={{ fontSize: '13px', padding: '4px 10px', borderRadius: '4px' }}>
              <AppstoreOutlined /> Total em Estoque: {currentStock}{form.getFieldValue('unidadeMedida') ? ` ${form.getFieldValue('unidadeMedida')}` : ''}
            </Tag>
          </Col>
        </Row>

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

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name="nomeItem" label="Nome de Catálogo / Comercial" rules={[{ required: true, message: 'Insira a descrição do produto!' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="codItem" label="Código SKU" rules={[{ required: true, message: 'Insira o SKU!' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Form.Item name="marca" label="Marca ou Fabricante">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="unidadeMedida" label="Unidade de Medida">
              <Select placeholder="Selecione a unidade" allowClear>
                <Option value="UN">UN (Unidade)</Option>
                <Option value="KG">KG (Quilograma)</Option>
                <Option value="PC">PÇ (Peça)</Option>
                <Option value="CX">CX (Caixa)</Option>
                <Option value="PCT">PCT (Pacote)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} items={tabItems} />
      </Form>
    </Drawer>
  );
}