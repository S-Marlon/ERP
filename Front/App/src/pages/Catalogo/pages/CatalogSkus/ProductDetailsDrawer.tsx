import { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Table,
  Badge,
  Tooltip,
  message,
  Card,
  Statistic,
  Spin,
  Empty
} from 'antd';
import {
  DollarOutlined,
  InboxOutlined,
  GlobalOutlined,
  FileTextOutlined,
  SaveOutlined,
  AppstoreOutlined,
  PictureOutlined,
  EyeOutlined,
  UndoOutlined,
  ReloadOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import ProductCommercialSalesConfig from '../ProductPricingModule/ProductCommercialSalesConfig';
import { getListasCadastro, getProdutoDetalhe, OpcaoCadastro, ProdutoDetalhe } from './CatalogSku.service';
import { Alteracao, alteracoesParaPayload, calcularAlteracoes, CAMPOS_FICHA, detalheParaForm, FichaForm } from './productFicha';
import { getTipoRecursoConfig } from '../../../Compras/StockEntry/tipoRecurso';
import AnexosCard from './AnexosCard';
import FichaTecnicaCard from './FichaTecnicaCard';

const { Text, Title } = Typography;

interface ProductDetailsDrawerProps {
  open: boolean;
  product: any | null;
  onClose: () => void;
  onSave: (id: string | number, updatedFields: any) => Promise<void>;
  // Mantidos por compatibilidade: a ficha agora carrega as próprias listas
  unidadesList?: any[];
  marcasList?: any[];
  familiasPaiList?: any[];
  fornecedoresList?: any[];
  categoriasList?: any[];
}

// Tabela de origem da mercadoria (CST ICMS, 1º dígito)
const ORIGENS_MERCADORIA = [
  { value: 0, label: '0 - Nacional' },
  { value: 1, label: '1 - Estrangeira (importação direta)' },
  { value: 2, label: '2 - Estrangeira (mercado interno)' },
  { value: 3, label: '3 - Nacional, conteúdo importado > 40%' },
  { value: 4, label: '4 - Nacional, processos produtivos básicos' },
  { value: 5, label: '5 - Nacional, conteúdo importado ≤ 40%' },
  { value: 6, label: '6 - Estrangeira (importação direta), sem similar' },
  { value: 7, label: '7 - Estrangeira (mercado interno), sem similar' },
  { value: 8, label: '8 - Nacional, conteúdo importado > 70%' },
];

const brl = (v: number | null | undefined, casas = 2) =>
  v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: 4 });

const exibir = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v));

export default function ProductDetailsDrawer({ open, product, onClose, onSave }: ProductDetailsDrawerProps) {
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('geral');

  const [detalhe, setDetalhe] = useState<ProdutoDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [listas, setListas] = useState<{ marcas: OpcaoCadastro[]; categorias: OpcaoCadastro[]; familias: OpcaoCadastro[] }>({
    marcas: [], categorias: [], familias: []
  });

  const [initialValues, setInitialValues] = useState<FichaForm>({});
  const [changedFieldsList, setChangedFieldsList] = useState<Alteracao[]>([]);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const itemId = Number(product?.id_item ?? product?.id) || null;

  const carregarFicha = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const dados = await getProdutoDetalhe(id);
      const valores = detalheParaForm(dados);
      setDetalhe(dados);
      form.resetFields();
      form.setFieldsValue(valores);
      setInitialValues(valores);
      setChangedFieldsList([]);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Erro ao carregar a ficha do produto.');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    if (open && itemId) {
      setActiveTab('geral');
      carregarFicha(itemId);
    }
    if (!open) setDetalhe(null);
  }, [open, itemId, carregarFicha]);

  useEffect(() => {
    if (!open || listas.marcas.length || listas.categorias.length || listas.familias.length) return;
    getListasCadastro()
      .then(setListas)
      .catch(err => message.warning(err.message || 'Não foi possível carregar marcas/categorias/famílias.'));
  }, [open, listas]);

  const recarregarAnexos = async (id: number) => {
    try {
      const dados = await getProdutoDetalhe(id);
      setDetalhe(atual => (atual ? { ...atual, anexos: dados.anexos } : dados));
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Erro ao recarregar os anexos.');
    }
  };

  const atualizarPublicacao = async (id: number) => {
    try {
      const dados = await getProdutoDetalhe(id);
      setDetalhe(atual => (atual ? { ...atual, publicacao: dados.publicacao } : dados));
    } catch {
      // a ficha técnica já foi salva; a tag de publicação atualiza na próxima abertura
    }
  };

  const evaluateChanges = (valores: FichaForm) => setChangedFieldsList(calcularAlteracoes(initialValues, valores));

  const handleRevertField = (fieldName: string) => {
    form.setFieldValue(fieldName, initialValues[fieldName]);
    evaluateChanges(form.getFieldsValue(true));
  };

  const handleRevertAll = () => {
    form.setFieldsValue(initialValues);
    setChangedFieldsList([]);
    message.info('Todas as alterações foram desfeitas.');
  };

  const handleSubmit = async () => {
    if (!itemId) return;
    try {
      await form.validateFields();
    } catch {
      message.warning('Corrija os campos obrigatórios antes de salvar.');
      return;
    }
    const alteracoes = calcularAlteracoes(initialValues, form.getFieldsValue(true));
    if (alteracoes.length === 0) return;

    setIsSaving(true);
    try {
      // Só os campos alterados: o backend mantém tudo o que não foi enviado
      await onSave(itemId, alteracoesParaPayload(alteracoes));
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = changedFieldsList.length > 0;
  const item = detalhe?.item;
  const unidade = item?.unidade_sigla || '';
  const tipo = getTipoRecursoConfig(item?.tipo_recurso || 'PRODUTO');

  const tabItems = [
    {
      key: 'geral',
      label: <span><PictureOutlined /> Geral</span>,
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card size="small" title="Identificação" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={14}>
                <Form.Item name="nomeInterno" label="Nome Interno (cadastro)" rules={[{ required: true, whitespace: true, message: 'Informe o nome interno.' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item
                  name="skuComercial"
                  label="SKU (código do produto)"
                  tooltip="Código usado no dia a dia (etiqueta, busca, PDV). Único por produto. Se vazio, vale o SKU raiz."
                >
                  <Input placeholder={item?.sku_core || 'Código do produto'} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="SKU raiz (identidade)" tooltip="Identificador técnico fixo do item. Não muda, mesmo que o SKU seja editado.">
                  <Input value={item?.sku_core || ''} disabled />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="variacao" label="Variação">
                  <Input placeholder="Ex: 220V / Azul" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="status" label="Status" valuePropName="checked">
                  <Switch checkedChildren="ATIVO" unCheckedChildren="INATIVO" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="idMarca" label="Marca">
                  <Select placeholder="Selecione a marca" allowClear showSearch optionFilterProp="label" options={listas.marcas} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="categoriaId" label="Categoria">
                  <Select placeholder="Selecione a categoria" allowClear showSearch optionFilterProp="label" options={listas.categorias} />
                </Form.Item>
              </Col>
            </Row>
            <Space size={8} wrap>
              <Text type="secondary">Tipo:</Text>
              <Tag color={tipo.color}>{tipo.label}</Tag>
              <Text type="secondary">Unidade base:</Text>
              {unidade ? <Tag color="purple">{unidade}{item?.unidade_descricao && item.unidade_descricao !== unidade ? ` · ${item.unidade_descricao}` : ''}</Tag> : <Tag>não definida</Tag>}
              <Text type="secondary" style={{ fontSize: 11 }}>(unidades e conversões na aba Preços & Comercial)</Text>
            </Space>
          </Card>

          {itemId && (
            <AnexosCard idItem={itemId} anexos={detalhe?.anexos || []} onChange={() => recarregarAnexos(itemId)} />
          )}
        </Space>
      )
    },
    {
      key: 'ficha-tecnica',
      label: <span><ProfileOutlined /> Ficha Técnica</span>,
      // Após salvar, atualiza só a situação de publicação (preserva edições em andamento na ficha)
      children: itemId ? <FichaTecnicaCard idItem={itemId} onSalvo={() => atualizarPublicacao(itemId)} /> : null
    },
    {
      key: 'financeiro',
      label: <span><DollarOutlined /> Preços & Comercial</span>,
      children: itemId ? <ProductCommercialSalesConfig idItem={itemId} /> : null
    },
    {
      key: 'estoque',
      label: <span><InboxOutlined /> Estoque & Logística</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small" title="Posição de Estoque" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={6}><Statistic title={`Saldo${unidade ? ` (${unidade})` : ''}`} value={item?.quantidade_atual ?? 0} precision={item && item.quantidade_atual % 1 !== 0 ? 4 : 0} /></Col>
              <Col span={6}><Statistic title="Custo médio" value={brl(item?.custo_medio, 2)} /></Col>
              <Col span={6}><Statistic title="Último custo" value={brl(item?.ultimo_custo, 2)} /></Col>
              <Col span={6}><Statistic title="Valor em estoque" value={brl((item?.quantidade_atual ?? 0) * (item?.custo_medio ?? 0))} /></Col>
            </Row>
          </Card>

          <Card size="small" title="Últimas Movimentações" bordered={false} style={{ background: '#fafafa' }}>
            <Table
              size="small"
              rowKey="id_movimento"
              pagination={false}
              dataSource={detalhe?.movimentos || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma movimentação" /> }}
              columns={[
                { title: 'Data', dataIndex: 'created_at', width: 130, render: (v: string) => new Date(v).toLocaleString('pt-BR') },
                {
                  title: 'Tipo', dataIndex: 'tipo_movimento', width: 90,
                  render: (v: string) => <Tag color={v === 'ENTRADA' ? 'green' : v === 'SAIDA' ? 'red' : 'blue'}>{v}</Tag>
                },
                {
                  title: 'Quantidade', key: 'qtd', width: 150,
                  render: (_: unknown, m: ProdutoDetalhe['movimentos'][number]) => (
                    <span>
                      {m.quantidade} {unidade}
                      {m.fator_conversao !== 1 && m.quantidade_documento !== null && (
                        <Text type="secondary" style={{ fontSize: 11 }}> ({m.quantidade_documento} {m.unidade_documento} × {m.fator_conversao})</Text>
                      )}
                    </span>
                  )
                },
                { title: 'Custo unit.', dataIndex: 'custo_unitario', width: 100, render: (v: number) => brl(v, 2) },
                { title: 'Saldo após', dataIndex: 'saldo_posterior', width: 90 },
                { title: 'Origem', key: 'origem', ellipsis: true, render: (_: unknown, m: ProdutoDetalhe['movimentos'][number]) => m.observacao || m.origem }
              ]}
            />
          </Card>

          <Card size="small" title="Pesos e Dimensões" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={6}><Form.Item name="pesoLiquido" label="Peso Líquido (kg)"><InputNumber style={{ width: '100%' }} min={0} step={0.001} precision={4} /></Form.Item></Col>
              <Col span={6}><Form.Item name="pesoBruto" label="Peso Bruto (kg)"><InputNumber style={{ width: '100%' }} min={0} step={0.001} precision={4} /></Form.Item></Col>
              <Col span={4}><Form.Item name="comprimentoCm" label="Comp. (cm)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              <Col span={4}><Form.Item name="larguraCm" label="Larg. (cm)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              <Col span={4}><Form.Item name="alturaCm" label="Alt. (cm)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            </Row>
          </Card>
        </Space>
      )
    },
    {
      key: 'ecommerce',
      label: <span><GlobalOutlined /> Vitrine & PDV</span>,
      children: (
        <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
          <Form.Item name="nomeComercial" label="Nome Comercial (exibido no PDV / site)">
            <Input maxLength={255} placeholder="Se vazio, usa o nome interno" />
          </Form.Item>
          <Form.Item name="descricaoComercial" label="Descrição Comercial">
            <Input.TextArea rows={5} placeholder="Descrição detalhada para o cliente" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="exibirNoPdv" label="Exibir no PDV" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="podeVenderSemEstoque" label="Permitir venda sem estoque" valuePropName="checked"><Switch /></Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      key: 'fiscal',
      label: <span><FileTextOutlined /> Fiscal & Fornecedores</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Card size="small" title="Dados Tributários" bordered={false} style={{ background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="ncm" label="NCM"><Input maxLength={10} placeholder="Ex: 84137010" /></Form.Item></Col>
              <Col span={8}><Form.Item name="cest" label="CEST"><Input maxLength={10} placeholder="Ex: 0100100" /></Form.Item></Col>
              <Col span={8}><Form.Item name="cfopPadrao" label="CFOP Padrão"><Input maxLength={10} placeholder="Ex: 5102" /></Form.Item></Col>
              <Col span={12}>
                <Form.Item name="origemMercadoria" label="Origem da Mercadoria">
                  <Select allowClear placeholder="Selecione" options={ORIGENS_MERCADORIA} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="familiaId" label="Família de Itens">
                  <Select placeholder="Selecione a família" allowClear showSearch optionFilterProp="label" options={listas.familias} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="Códigos de Barras (GTIN)" bordered={false} style={{ background: '#fafafa' }}>
            {detalhe?.gtins.length ? (
              <Space wrap>
                {detalhe.gtins.map(g => (
                  <Tag key={`${g.sigla}-${g.gtin}`} color="blue">{g.sigla}{g.nome_exibicao ? ` (${g.nome_exibicao})` : ''}: {g.gtin}</Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">Nenhum GTIN cadastrado.</Text>
            )}
            <div><Text type="secondary" style={{ fontSize: 11 }}>O GTIN é por embalagem: edite na aba Preços & Comercial (unidades de venda).</Text></div>
          </Card>

          <Card size="small" title="Fornecedores" bordered={false} style={{ background: '#fafafa' }}>
            <Table
              size="small"
              rowKey="id_fornecedor"
              pagination={false}
              dataSource={detalhe?.fornecedores || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum fornecedor vinculado (o vínculo nasce na entrada de NF)" /> }}
              columns={[
                { title: 'Fornecedor', key: 'nome', render: (_: unknown, f: ProdutoDetalhe['fornecedores'][number]) => <span>{f.nome || `#${f.id_fornecedor}`} {f.padrao && <Tag color="gold">Padrão</Tag>}</span> },
                { title: 'Código no fornecedor', dataIndex: 'codigo_produto_fornecedor', width: 150 },
                {
                  title: 'Unidade de compra', key: 'conv', width: 150,
                  render: (_: unknown, f: ProdutoDetalhe['fornecedores'][number]) => `1 ${f.unidade_compra || '?'} = ${f.fator_compra} ${unidade}`
                },
                { title: 'Último preço', dataIndex: 'preco_ultima_compra', width: 110, render: (v: number | null) => brl(v, 2) }
              ]}
            />
            {(detalhe?.fornecedores.length || 0) > 0 && (
              <Form.Item name="fornecedorPadraoId" label="Fornecedor padrão" style={{ marginTop: 12, marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="Nenhum"
                  options={detalhe?.fornecedores.map(f => ({ value: f.id_fornecedor, label: f.nome || `#${f.id_fornecedor}` }))}
                />
              </Form.Item>
            )}
          </Card>
        </Space>
      )
    }
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 16 }}>
          <Space size={8} wrap>
            {detalhe?.anexos.find(a => a.tipo_anexo === 'IMAGEM_PRINCIPAL') && (
              <img
                src={detalhe.anexos.find(a => a.tipo_anexo === 'IMAGEM_PRINCIPAL')!.url_anexo}
                alt=""
                style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, border: '1px solid #f0f0f0' }}
              />
            )}
            <Title level={4} style={{ margin: 0 }}>Ficha do Produto</Title>
            <Tag color="cyan">ID: {itemId ?? 'N/A'}</Tag>
            <Tag color="geekblue">SKU: {item?.sku_customizado || item?.sku_core || product?.sku || 'N/A'}</Tag>
            {item && item.status === 'INATIVO' && <Tag color="red">INATIVO</Tag>}
            {detalhe && (
              <Tooltip title={detalhe.publicacao.publicavel ? 'Pode ser exibido no PDV e nos canais' : detalhe.publicacao.motivos.join(' · ')}>
                <Tag color={detalhe.publicacao.publicavel ? 'green' : 'orange'}>
                  {detalhe.publicacao.publicavel ? 'Publicável' : 'Não publicável'}
                </Tag>
              </Tooltip>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: '13px', fontWeight: 400 }}>
            {item?.nome_comercial || item?.nome_core || product?.nome_item || 'Carregando produto...'}
          </Text>
        </div>
      }
      width={900}
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Tag color={(item?.quantidade_atual ?? 0) > 0 ? 'blue' : 'orange'}>
            <AppstoreOutlined /> Estoque: {item?.quantidade_atual ?? 0} {unidade}
          </Tag>
          <Tooltip title="Recarregar ficha">
            <Button size="small" icon={<ReloadOutlined />} disabled={!itemId || loading} onClick={() => itemId && carregarFicha(itemId)} />
          </Tooltip>
        </Space>
      }
      footer={
        hasChanges ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e6f4ff', padding: '10px 16px', borderRadius: '6px', border: '1px solid #91caff' }}>
            <Space>
              <Badge count={changedFieldsList.length} style={{ backgroundColor: '#1677ff' }} />
              <Text style={{ color: '#0958d9', fontWeight: 600 }}>Há campos modificados não salvos.</Text>
            </Space>
            <Space>
              <Button type="link" icon={<EyeOutlined />} onClick={() => setIsDiffModalOpen(true)}>Visualizar Alterações</Button>
              <Button type="link" danger icon={<UndoOutlined />} onClick={handleRevertAll}>Desfazer Tudo</Button>
              <Button type="primary" onClick={handleSubmit} loading={isSaving} icon={<SaveOutlined />} size="large">
                Salvar Alterações ({changedFieldsList.length})
              </Button>
            </Space>
          </div>
        ) : null
      }
    >
      <Spin spinning={loading}>
        {!loading && open && itemId && !detalhe ? (
          <Alert type="error" showIcon message="Não foi possível carregar a ficha deste produto." />
        ) : (
          <Form form={form} layout="vertical" onValuesChange={(_, todos) => evaluateChanges(todos)}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} type="card" />
          </Form>
        )}
      </Spin>

      <Modal
        title="Auditoria de Alterações Pendentes"
        open={isDiffModalOpen}
        onCancel={() => setIsDiffModalOpen(false)}
        width={700}
        footer={[<Button key="close" type="primary" onClick={() => setIsDiffModalOpen(false)}>Fechar</Button>]}
      >
        <p style={{ color: '#595959', marginBottom: 16 }}>
          Campos modificados. Você pode reverter ajustes individuais clicando em desfazer.
        </p>
        <Table
          dataSource={changedFieldsList}
          rowKey="field"
          pagination={false}
          size="small"
          bordered
          columns={[
            { title: 'Campo', dataIndex: 'label', key: 'label', render: (text: string) => <Text strong>{text}</Text> },
            { title: 'Valor original', dataIndex: 'before', key: 'before', render: (val: unknown) => <Tag>{exibir(val)}</Tag> },
            { title: 'Novo valor', dataIndex: 'after', key: 'after', render: (val: unknown) => <Tag color="processing">{exibir(val)}</Tag> },
            {
              title: 'Ação', key: 'action', width: 90, align: 'center' as const,
              render: (_: unknown, record: Alteracao) => (
                <Button type="link" danger size="small" icon={<UndoOutlined />} onClick={() => handleRevertField(record.field)}>
                  Desfazer
                </Button>
              ),
            },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 11 }}>
          Campos editáveis: {Object.values(CAMPOS_FICHA).map(c => c.label).join(', ')}.
        </Text>
      </Modal>
    </Drawer>
  );
}
