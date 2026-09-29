import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
  Table,
  Badge,
  Tooltip,
  message,
  Card,
  Statistic
} from 'antd';
import { 
  DollarOutlined, 
  InboxOutlined, 
  GlobalOutlined, 
  FileTextOutlined, 
  TeamOutlined,
  SaveOutlined,
  PlusOutlined,
  AppstoreOutlined,
  PictureOutlined,
  UserOutlined,
  EyeOutlined,
  UndoOutlined,
  ControlOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SettingOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import StepSalesConfig from '../../../Compras/StockEntry/nfeCards/StepSalesConfig';
import ProductCommercialSalesConfig from '../ProductPricingModule/ProductCommercialSalesConfig';

const { Text, Title } = Typography;

interface ProductDetailsDrawerProps {
  open: boolean;
  product: any | null;
  onClose: () => void;
  onSave: (id: string | number, updatedFields: any) => Promise<void>;
  unidadesList?: any[];
  marcasList?: any[];
  familiasPaiList?: any[];
  fornecedoresList?: any[];
  categoriasList?: any[];
}

export default function ProductDetailsDrawer({ 
  open, 
  product, 
  onClose, 
  onSave,
  unidadesList = [],
  marcasList = [],
  familiasPaiList = [],
  fornecedoresList = [],
  categoriasList = []
}: ProductDetailsDrawerProps) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');

  const [currentStock, setCurrentStock] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [maxStock, setMaxStock] = useState(0);
  const [fileList, setFileList] = useState<any[]>([]);

  // Estado para armazenar as configurações de venda do StepSalesConfig
  const [salesModesConfig, setSalesModesConfig] = useState<any[]>([]);
  
  // Estado para controlar a abertura do Modal de Fracionamento e Vendas
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  // Estados para controle de alterações (Diff)
  const [initialValues, setInitialValues] = useState<any>({});
  const [changedFieldsList, setChangedFieldsList] = useState<any[]>([]);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const fieldLabels: Record<string, string> = {
    nomeItem: 'Nome de Catálogo',
    codItem: 'Código SKU',
    status: 'Status Comercial',
    estoqueMinimo: 'Estoque Mínimo',
    estoqueMaximo: 'Estoque Máximo',
    ncm: 'NCM',
    cest: 'CEST',
    idMarca: 'Marca',
    idUnidade: 'Unidade de Medida',
    familiaId: 'Família de Itens',
    categoriaId: 'Categoria',
    skuCustomizado: 'SKU Customizado',
    custoGerencial: 'Custo Gerencial',
    precoVenda: 'Preço de Venda',
    margemLucro: 'Margem de Lucro',
    exibirNoPdv: 'Exibir no PDV',
    podeVenderSemEstoque: 'Vender sem Estoque',
    nomeComercial: 'Nome Comercial',
    descricaoCurta: 'Descrição Curta',
    descricaoLonga: 'Descrição Longa',
    pesoKg: 'Peso Líquido',
    pesoBruto: 'Peso Bruto',
    alturaCm: 'Altura',
    larguraCm: 'Largura',
    comprimentoCm: 'Comprimento',
    fornecedorPadraoId: 'Fornecedor Padrão',
    codigoBarrasEan: 'Código de Barras EAN',
  };

  useEffect(() => {
    if (product) {
      const mappedValues = {
        nomeItem: product.nome_item || product.nomeItem || undefined,
        codItem: product.sku || product.codItem || undefined,
        status: product.status ? String(product.status).toUpperCase() !== 'INATIVO' : false,
        estoqueMinimo: product.estoqueMinimo ?? product.estoque_minimo ?? undefined,
        estoqueMaximo: product.estoqueMaximo ?? product.estoque_maximo ?? undefined,
        estoqueAtual: product.estoque || product.estoque_atual || 0,
        ncm: product.ncm ?? product.ncm_padrao ?? undefined,
        cest: product.cest ?? product.cest_padrao ?? undefined,
        idMarca: product.id_marca ?? product.idMarca ?? undefined,
        idUnidade: product.id_unidade ?? product.idUnidade ?? undefined,
        familiaId: product.familia_id ?? product.familiaId ?? undefined,
        categoriaId: product.categoria_id ?? product.categoriaId ?? undefined,
        skuCustomizado: product.sku_customizado ?? product.skuCustomizado ?? undefined,
        custoGerencial: product.custo_gerencial ?? product.custoGerencial ?? undefined,
        precoVenda: product.preco_venda ?? product.precoVenda ?? undefined,
        margemLucro: product.margem_lucro ?? product.margemLucro ?? undefined,
        exibirNoPdv: product.exibir_no_pdv ?? product.exibirNoPdv ?? true,
        podeVenderSemEstoque: product.pode_vender_sem_estoque ?? product.podeVenderSemEstoque ?? false,
        nomeComercial: product.nome_comercial ?? product.nomeComercial ?? undefined,
        descricaoComercial: product.descricao_comercial ?? product.descricaoComercial ?? undefined,
        descricaoCurta: product.descricaoCurta ?? product.descricao_curta ?? undefined,
        descricaoLonga: product.descricaoLonga ?? product.descricao_longa ?? undefined,
        pesoKg: product.pesoKg ?? product.peso_kg ?? product.peso_liquido ?? undefined,
        pesoBruto: product.pesoBruto ?? product.peso_bruto ?? undefined,
        alturaCm: product.alturaCm ?? product.altura_cm ?? undefined,
        larguraCm: product.larguraCm ?? product.largura_cm ?? undefined,
        comprimentoCm: product.comprimentoCm ?? product.comprimento_cm ?? undefined,
        fornecedorPadraoId: product.fornecedorPadraoId ?? product.fornecedor_padrao_id ?? undefined,
        codigoBarrasEan: product.codigoBarrasEan || product.codigo_barras_ean || product.sku || undefined,
      };

      form.setFieldsValue(mappedValues);
      setInitialValues(mappedValues);
      setChangedFieldsList([]);

      setCurrentStock(product.estoque || product.estoque_atual || 0);
      setMinStock(Number(product.estoqueMinimo ?? product.estoque_minimo ?? 0));
      setMaxStock(Number(product.estoqueMaximo ?? product.estoque_maximo ?? 0));

      if (product.modalidades_venda) {
        setSalesModesConfig(product.modalidades_venda);
      }

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

  const evaluateChanges = (currentFormValues: any) => {
    const diffs: any[] = [];
    Object.keys(currentFormValues).forEach((key) => {
      const currentVal = currentFormValues[key];
      const initialVal = initialValues[key];

      const normalizedCurrent = currentVal === '' ? undefined : currentVal;
      const normalizedInitial = initialVal === '' ? undefined : initialVal;

      if (normalizedCurrent !== normalizedInitial) {
        diffs.push({
          field: key,
          label: fieldLabels[key] || key,
          before: initialVal ?? '—',
          after: currentVal ?? '—',
        });
      }
    });
    setChangedFieldsList(diffs);
  };

  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.estoqueMinimo !== undefined) setMinStock(changedValues.estoqueMinimo);
    if (changedValues.estoqueMaximo !== undefined) setMaxStock(changedValues.estoqueMaximo);
    evaluateChanges(allValues);
  };

  const handleRevertField = (fieldName: string) => {
    const originalValue = initialValues[fieldName];
    form.setFieldValue(fieldName, originalValue);

    if (fieldName === 'estoqueMinimo') setMinStock(originalValue);
    if (fieldName === 'estoqueMaximo') setMaxStock(originalValue);

    const updatedAllValues = form.getFieldsValue();
    evaluateChanges(updatedAllValues);
  };

  const handleRevertAll = () => {
    form.setFieldsValue(initialValues);
    setMinStock(Number(initialValues.estoqueMinimo ?? 0));
    setMaxStock(Number(initialValues.estoqueMaximo ?? 0));
    setChangedFieldsList([]);
    message.info('Todas as alterações foram desfeitas.');
  };

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
        id_unidade: values.idUnidade ?? product?.id_unidade ?? null,
        peso_liquido: values.pesoKg ?? product?.peso_liquido ?? null,
        peso_bruto: values.pesoBruto ?? product?.peso_bruto ?? null,
        categoria_id: values.categoriaId ?? product?.categoria_id ?? null,
        familia_id: values.familiaId ?? product?.familia_id ?? null,
        id_marca: values.idMarca ?? product?.id_marca ?? null,
        sku_customizado: values.skuCustomizado ?? product?.sku_customizado ?? null,
        custo_gerencial: values.custoGerencial ?? product?.custo_gerencial ?? null,
        preco_venda: values.precoVenda ?? product?.preco_venda ?? null,
        margem_lucro: values.margemLucro ?? product?.margem_lucro ?? null,
        modalidades_venda: salesModesConfig,
        exibir_no_pdv: values.exibirNoPdv ?? product?.exibir_no_pdv ?? 1,
        pode_vender_sem_estoque: values.podeVenderSemEstoque ?? product?.pode_vender_sem_estoque ?? 0,
        nome_comercial: values.nomeComercial ?? product?.nome_comercial ?? null,
        descricao_comercial: values.descricaoComercial ?? product?.descricao_comercial ?? null,
        estoque_minimo: values.estoqueMinimo ?? product?.estoque_minimo ?? null,
        estoque_maximo: values.estoqueMaximo ?? product?.estoque_maximo ?? null,
        ncm: values.ncm ?? product?.ncm ?? null,
        cest: values.cest ?? product?.cest ?? null,
        altura_cm: values.alturaCm ?? product?.altura_cm ?? null,
        largura_cm: values.larguraCm ?? product?.largura_cm ?? null,
        comprimento_cm: values.comprimentoCm ?? product?.comprimento_cm ?? null,
        fornecedor_padrao_id: values.fornecedorPadraoId ?? product?.fornecedor_padrao_id ?? null,
        imagens: urlsImagens,
        url_imagem: urlsImagens.join(',')
      };

      const rawItemId = product?.id_item ?? product?.id ?? product?.key;
      const itemId = Number(rawItemId);

      if (!Number.isFinite(itemId) || itemId <= 0) {
        message.error('Erro crítico: ID do produto inválido para edição.');
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

  const hasChanges = changedFieldsList.length > 0;

  const tabItems = [
    {
      key: 'geral',
      label: <span><PictureOutlined /> Geral & Mídia</span>,
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card size="small" title="Informações Principais" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={14}>
                <Form.Item name="nomeItem" label="Nome de Catálogo / Comercial" rules={[{ required: true, message: 'Insira a descrição!' }]}>
                  <Input size="large" />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="codItem" label="Código SKU Principal" rules={[{ required: true, message: 'Insira o SKU!' }]}>
                  <Input size="large" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="skuCustomizado" label="SKU Customizado (Comercial)">
                  <Input placeholder="Ex: COD-SITE-123" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="idUnidade" label="Unidade de Medida">
                  <Select placeholder="Selecione" allowClear showSearch optionFilterProp="children">
                    {unidadesList.map((u: any) => (
                      <Select.Option key={u.id ?? u.id_unidade} value={u.id ?? u.id_unidade}>
                        {u.simbolo} ({u.nome})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="idMarca" label="Marca">
                  <Select placeholder="Selecione a marca" allowClear showSearch optionFilterProp="children">
                    {marcasList.map((m: any) => (
                      <Select.Option key={m.id} value={m.id}>{m.nome}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="categoriaId" label="Categoria">
                  <Select placeholder="Selecione a categoria" allowClear showSearch optionFilterProp="children">
                    {categoriasList.map((c: any) => (
                      <Select.Option key={c.id ?? c.id_categoria} value={c.id ?? c.id_categoria}>{c.nome}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="Galeria de Fotos" bordered={false} style={{ background: '#fafafa' }}>
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
                  <div style={{ marginTop: 8 }}>Adicionar</div>
                </div>
              )}
            </Upload>
          </Card>
        </Space>
      )
    },
    {
      key: 'financeiro',
      label: <span><DollarOutlined /> Preços & Comercial</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
         {/* Atalho elegante para abrir o Modal de Fracionamento e Múltiplas Vendas */}
          {/* <Card 
            size="small" 
            style={{ 
              borderRadius: 8, 
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
              border: '1px solid #bbf7d0',
              cursor: 'pointer'
            }}
            bodyStyle={{ padding: '16px' }}
            onClick={() => setIsSalesModalOpen(true)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={12}>
                <BranchesOutlined style={{ fontSize: '24px', color: '#16a34a' }} />
                <div>
                  <Text strong style={{ fontSize: '0.95rem', color: '#166534', display: 'block' }}>
                    Configuração de Fracionamento e Canais de Venda
                  </Text>
                  <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                    {salesModesConfig.length > 0 
                      ? `${salesModesConfig.filter(m => m.active).length} modalidade(s) ativa(s) configurada(s). Clique para gerenciar.` 
                      : 'Nenhum fracionamento avançado configurado. Clique para adicionar.'}
                  </Text>
                </div>
              </Space>
              <Button type="primary" size="small" style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                Gerenciar Fracionamentos
              </Button>
            </div>
          </Card>
           */}
         

          <ProductCommercialSalesConfig idItem={Number(product?.id_item ?? product?.id) || undefined} />

          
        </Space>
      )
    },
    {
      key: 'estoque',
      label: <span><InboxOutlined /> Estoque & Logística</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small" title="Parâmetros de Estoque" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16} align="middle">
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
                <Form.Item name="estoqueAtual" label="Estoque Atual (Saldo)">
                  <InputNumber style={{ width: '100%' }} disabled />
                </Form.Item>
              </Col>
            </Row>
            {currentStock <= minStock && (
              <Alert 
                message="Alerta de Reposição Sugerida" 
                description={`O estoque atual (${currentStock}) está abaixo ou igual ao mínimo (${minStock}). Sugestão de compra: +${maxStock - currentStock} unidades.`} 
                type="warning" 
                showIcon 
                style={{ marginTop: 12 }} 
              />
            )}
          </Card>

          <Card size="small" title="Dimensões e Pesos Físicos" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item name="pesoKg" label="Peso Líquido (Kg)">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="pesoBruto" label="Peso Bruto (Kg)">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.0001} precision={4} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="comprimentoCm" label="Comp. (cm)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="larguraCm" label="Larg. (cm)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="alturaCm" label="Alt. (cm)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
              </Col>
            </Row>
          </Card>
        </Space>
      )
    },
    {
      key: 'ecommerce',
      label: <span><GlobalOutlined /> E-commerce & PIM</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
            <Form.Item name="nomeComercial" label="Nome Comercial (Vitrine / PDV)">
              <Input maxLength={255} placeholder="Nome exibido nos canais de venda" />
            </Form.Item>
            <Form.Item name="descricaoCurta" label="Descrição Comercial Curta">
              <Input maxLength={150} showCount placeholder="Resumo rápido para listagens" />
            </Form.Item>
            <Form.Item name="descricaoLonga" label="Ficha Técnica / Descrição Completa">
              <Input.TextArea rows={4} placeholder="Descrição rica em detalhes para o e-commerce..." />
            </Form.Item>
          </Card>
        </Space>
      )
    },
    {
      key: 'fiscal',
      label: <span><FileTextOutlined /> Fiscal & Fornecedor</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card size="small" title="Dados Tributários" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="ncm" label="NCM"><Input maxLength={10} placeholder="Ex: 0000.00.00" /></Form.Item></Col>
              <Col span={12}><Form.Item name="cest" label="CEST"><Input maxLength={10} placeholder="Ex: 00.000.00" /></Form.Item></Col>
              <Col span={12}>
                <Form.Item name="familiaId" label="Família de Itens">
                  <Select placeholder="Selecione a família" allowClear showSearch optionFilterProp="children">
                    {familiasPaiList.map((fam: any) => (<Select.Option key={fam.id} value={fam.id}>{fam.nome}</Select.Option>))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}><Form.Item name="codigoBarrasEan" label="EAN / GTIN"><Input placeholder="Código de barras oficial" /></Form.Item></Col>
            </Row>
          </Card>

          <Card size="small" title="Cadeia de Suprimentos" bordered={false} style={{ background: '#fafafa' }}>
            <Form.Item name="fornecedorPadraoId" label="Fornecedor Homologado Preferencial">
              <Select placeholder="Selecione o fornecedor padrão" allowClear showSearch optionFilterProp="children">
                {fornecedoresList.map((forn: any) => (<Select.Option key={forn.id_pessoa ?? forn.id} value={forn.id_pessoa ?? forn.id}>{forn.nome_razao ?? forn.nome}</Select.Option>))}
              </Select>
            </Form.Item>
          </Card>
        </Space>
      )
    }
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={8}>
              <Title level={4} style={{ margin: 0 }}>Ficha do Produto</Title>
              <Tag color="cyan">ID: {product?.id_item || product?.id || 'N/A'}</Tag>
              <Tag color="geekblue">SKU: {product?.sku || 'N/A'}</Tag>
            </Space>
          </div>
          <Text type="secondary" style={{ fontSize: '13px', fontWeight: 400 }}>
            {product?.nome_item || product?.nomeComercial || 'Carregando produto...'}  
          </Text>
        </div>
      }
      width={850}
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Tag color={currentStock <= minStock ? 'orange' : 'blue'}>
            <AppstoreOutlined /> Total em Estoque: {currentStock}
          </Tag>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>Status:</Text>
              <Form.Item name="status" valuePropName="checked" noStyle>
                <Switch 
                  checkedChildren="ATIVO" 
                  unCheckedChildren="INATIVO" 
                  size="small"
                  onChange={() => evaluateChanges(form.getFieldsValue())}
                />
              </Form.Item>
            </div>
          </div>
        </Space>
      }
      footer={
        hasChanges ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e6f4ff', padding: '10px 16px', borderRadius: '6px', border: '1px solid #91caff' }}>
            <Space>
              <Badge count={changedFieldsList.length} style={{ backgroundColor: '#1677ff' }} />
              <Text style={{ color: '#0958d9', fontWeight: 600 }}>Há campos modificados não salvos nesta sessão.</Text>
            </Space>
            <Space>
              <Button type="link" icon={<EyeOutlined />} onClick={() => setIsDiffModalOpen(true)}>
                Visualizar Alterações
              </Button>
              <Button type="link" danger icon={<UndoOutlined />} onClick={handleRevertAll}>
                Desfazer Tudo
              </Button>
              <Button 
                type="primary" 
                onClick={handleSubmit} 
                loading={isSaving} 
                disabled={!hasChanges}
                icon={<SaveOutlined />}
                size="large"
              >
                Salvar Alterações {hasChanges && `(${changedFieldsList.length})`}
              </Button>
            </Space>
          </div>
        ) : null
      }
    >
      <Form 
        form={form} 
        layout="vertical"
        onValuesChange={handleFormValuesChange} 
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={(key) => setActiveTab(key)} 
          items={tabItems} 
          type="card"
        />
      </Form>

      {/* Modal Dedicado para Configuração de Fracionamento de Vendas */}
      <Modal
        title={
          <Space>
            <BranchesOutlined style={{ color: '#1677ff' }} />
            <span>Gerenciamento de Fracionamento e Unidades de Venda</span>
          </Space>
        }
        open={isSalesModalOpen}
        onOk={() => setIsSalesModalOpen(false)}
        onCancel={() => setIsSalesModalOpen(false)}
        width={1200}
        style={{ top: 40 }}
        footer={[
          <Button key="ok" type="primary" onClick={() => setIsSalesModalOpen(false)}>
            Concluir Configuração
          </Button>
        ]}
      >
        <div style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
          {/* <StepSalesConfig
            item={{ 
              custo: product?.custo_gerencial || product?.custoGerencial || form.getFieldValue('custoGerencial') || 0, 
              unidadeMedida: product?.simbolo_unidade || product?.unidadeMedida || 'UN' 
            }}
            initialModes={salesModesConfig.length > 0 ? salesModesConfig : product?.modalidades_venda}
            onChange={(modes: any[]) => {
              setSalesModesConfig(modes);
              
              const defaultMode = modes.find(m => m.isDefault) || modes[0];
              if (defaultMode) {
                form.setFieldsValue({
                  precoVenda: defaultMode.price,
                  margemLucro: defaultMode.markup
                });
              }
            }}
          /> */}

          <ProductCommercialSalesConfig idItem={Number(product?.id_item ?? product?.id) || undefined} />
        </div>
      </Modal>

      {/* Modal de Auditoria e Desfazimento Pontual */}
      <Modal
        title="Auditoria de Alterações Pendentes"
        open={isDiffModalOpen}
        onOk={() => setIsDiffModalOpen(false)}
        onCancel={() => setIsDiffModalOpen(false)}
        width={700}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsDiffModalOpen(false)}>
            Fechar
          </Button>
        ]}
      >
        <p style={{ color: '#595959', marginBottom: 16 }}>
          Abaixo estão listados os campos modificados. Você pode reverter ajustes individuais clicando em desfazer.
        </p>
        <Table
          dataSource={changedFieldsList}
          rowKey="field"
          pagination={false}
          size="small"
          bordered
          columns={[
            {
              title: 'Campo Modificado',
              dataIndex: 'label',
              key: 'label',
              render: (text) => <Text strong>{text}</Text>,
            },
            {
              title: 'Valor Original',
              dataIndex: 'before',
              key: 'before',
              render: (val) => <Tag color="default">{String(val)}</Tag>,
            },
            {
              title: 'Novo Valor',
              dataIndex: 'after',
              key: 'after',
              render: (val) => <Tag color="processing">{String(val)}</Tag>,
            },
            {
              title: 'Ação',
              key: 'action',
              width: 90,
              align: 'center',
              render: (_, record) => (
                <Tooltip title="Reverter este campo">
                  <Button 
                    type="link" 
                    danger 
                    size="small" 
                    icon={<UndoOutlined />} 
                    onClick={() => handleRevertField(record.field)}
                  >
                    Desfazer
                  </Button>
                </Tooltip>
              ),
            },
          ]}
        />
      </Modal>
    </Drawer>
  );
}