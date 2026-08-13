import React, { useState, useEffect, useCallback } from 'react';
import { SkuSubTable } from './SkuSubTable';
import { 
  Table, 
  Card, 
  Tag, 
  Input, 
  Button, 
  Space, 
  Breadcrumb, 
  Typography, 
  Row, 
  Col, 
  Statistic, 
  Badge,
  Alert,
  Select,
  Radio,
  message,
  Avatar,
  Modal,
  Upload,
  Collapse
} from 'antd';
import { 
  AppstoreOutlined, 
  SearchOutlined, 
  PlusOutlined, 
  DatabaseOutlined,
  ShoppingCartOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ClusterOutlined,
  UserOutlined,
  UnorderedListOutlined,
  ReloadOutlined,
  PictureOutlined,
  ImportOutlined,
  CodeOutlined,
  UploadOutlined
} from '@ant-design/icons';

import type { ColumnsType } from 'antd/es/table';

import { ItemParentType, SkuChildType } from './CatalogSku.types';
import { getProdutos, updateProduto, saveProdutosLote } from './CatalogSku.service';
import ProductDetailsDrawer from './ProductDetailsDrawer';
import CreateProductModal from './CreateProductModal'; 

const { Title, Text } = Typography;
const { TextArea } = Input;

type FilterType = 'all' | 'activeSkus' | 'noStock' | 'criticalStock';

export default function CatalogSku() {
  const [products, setProducts] = useState<ItemParentType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filtros e Seletores de Interface
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ItemParentType | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedStructure, setSelectedStructure] = useState<string | undefined>(undefined);

  // ESTADOS DO MODAL JSON
  const [isJsonModalVisible, setIsJsonModalVisible] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [parsedJsonPreview, setParsedJsonPreview] = useState<ItemParentType[]>([]);

  // Rascunho / Lote
  const [creationBatch, setCreationBatch] = useState<ItemParentType[]>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  const checkIsFamily = (record: ItemParentType): boolean => {
    const isFamKey = String(record.id_item).startsWith('FAM-') || String(record.sku).startsWith('FAM-');
    const hasFamiliaId = record.familia_id !== null && record.familia_id !== undefined;
    const isTipoFamilia = record.tipo_recurso === 'FAMILIA';
    const hasMultipleSkus = (record.skus || []).length > 1;

    return isFamKey || hasFamiliaId || isTipoFamilia || hasMultipleSkus;
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProdutos();
      setProducts(data);
    } catch (error: any) {
      message.error(error.message || 'Falha ao carregar os produtos do servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

 const handleUpdateProduct = async (idItem: string | number, updatedFields: any) => {
    try {
      // 🛡️ Garante fallback seguro capturando o ID do produto selecionado atual caso venha vazio
      const targetId = idItem || selectedProduct?.id_item || selectedProduct?.id || selectedProduct?.key;

      if (!targetId) {
        message.error('ID do item não informado para atualização.');
        return;
      }

      await updateProduto(targetId, updatedFields);
      message.success('Produto atualizado com sucesso!');
      setIsDrawerVisible(false);
      fetchProducts();
    } catch (error: any) {
      message.error(error.message || 'Erro ao salvar alterações no servidor.');
    }
  };

  const handleSaveProduct = async (payload: any) => {
    const tempId = Date.now();
    const novoItemPai: ItemParentType = {
      key: String(tempId),
      id_item: tempId,
      sku: payload.sku || payload.codItem,
      nome_item: payload.nome || payload.nome_item,
      tipo_recurso: payload.isFamilia ? 'FAMILIA' : 'PRODUTO',
      status: 'ATIVO',
      familia_id: payload.familia_id || null,
      categoria_id: payload.categoria_id || null,
      categoria: payload.categoria || null,
      skus: [
        {
          key: `${tempId}-0`,
          id_item: tempId,
          sku: payload.sku || payload.codItem,
          variacao: 'Principal',
          marca: payload.marca || 'Própria',
          estoque: payload.estoque_inicial || 0,
          preco_venda: payload.financeiro?.preco_venda || 0,
          custo_gerencial: payload.financeiro?.custo_gerencial || 0,
          status: 'ATIVO'
        }
      ]
    };

    setCreationBatch(prev => [novoItemPai, ...prev]);
    setShowBatchPanel(true);
    setIsModalVisible(false);
    message.info('Item adicionado à fila de criação.');
  };

  const handleJsonInputChange = (val: string) => {
    setJsonInput(val);
    if (!val.trim()) {
      setParsedJsonPreview([]);
      return;
    }

    try {
      const parsed = JSON.parse(val);
      const itemsArray = Array.isArray(parsed) ? parsed : [parsed];

      const validatedItems: ItemParentType[] = itemsArray.map((item: any, idx: number) => {
        const tempId = item.id_item || Date.now() + idx;
        const mainSku = item.sku || `SKU-AUTO-${tempId}`;

        const innerSkus: SkuChildType[] = Array.isArray(item.skus) && item.skus.length > 0
          ? item.skus.map((s: any, sIdx: number) => ({
              key: s.key || `${tempId}-${sIdx}`,
              id_item: tempId,
              sku: s.sku || `${mainSku}-${sIdx + 1}`,
              variacao: s.variacao || 'Padrão',
              marca: s.marca || item.marca || 'Própria',
              estoque: Number(s.estoque ?? item.estoque ?? 0),
              preco_venda: Number(s.preco_venda ?? item.preco_venda ?? 0),
              custo_gerencial: Number(s.custo_gerencial ?? item.custo_gerencial ?? 0),
              status: s.status || 'ATIVO',
              imagem_url: s.imagem_url || item.imagem_url
            }))
          : [
              {
                key: `${tempId}-0`,
                id_item: tempId,
                sku: mainSku,
                variacao: item.variacao || 'Principal',
                marca: item.marca || 'Própria',
                estoque: Number(item.estoque ?? 0),
                preco_venda: Number(item.preco_venda ?? item.preco ?? 0),
                custo_gerencial: Number(item.custo_gerencial ?? item.custo ?? 0),
                status: 'ATIVO',
                imagem_url: item.imagem_url
              }
            ];

        return {
          key: String(tempId),
          id_item: tempId,
          sku: mainSku,
          nome_item: item.nome_item || item.nome || 'Produto Sem Nome',
          tipo_recurso: item.tipo_recurso || 'PRODUTO',
          status: item.status || 'ATIVO',
          familia_id: item.familia_id || null,
          categoria_id: item.categoria_id || null,
          skus: innerSkus
        };
      });

      setParsedJsonPreview(validatedItems);
    } catch (e) {
      setParsedJsonPreview([]);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleJsonInputChange(content);
    };
    reader.readAsText(file);
    return false;
  };

  const handleImportJsonToBatch = () => {
    if (parsedJsonPreview.length === 0) {
      message.error('Cole ou envie um JSON válido primeiro!');
      return;
    }

    setCreationBatch(prev => [...parsedJsonPreview, ...prev]);
    setShowBatchPanel(true);
    message.success(`${parsedJsonPreview.length} item(ns) adicionado(s) à fila de criação!`);
    
    setIsJsonModalVisible(false);
    setJsonInput('');
    setParsedJsonPreview([]);
  };

  const handleConfirmEntireBatch = async () => {
    setModalLoading(true);
    try {
      await saveProdutosLote(creationBatch);
      message.success(`${creationBatch.length} produtos salvos com sucesso no banco!`);
      setCreationBatch([]);
      setShowBatchPanel(false);
      fetchProducts();
    } catch (error: any) {
      message.error(error.message || 'Erro ao persistir o lote no banco de dados.');
    } finally {
      setModalLoading(false);
    }
  };

  const removeItemFromBatch = (key: string) => {
    setCreationBatch(prev => prev.filter(item => item.key !== key));
  };

  const parentColumns: ColumnsType<ItemParentType> = React.useMemo(() => [
    {
      title: 'SKU Master',
      dataIndex: 'sku',
      key: 'sku',
      render: (text) => <Text code style={{ fontSize: '13px', fontWeight: 'bold' }}>{text}</Text>,
    },
    {
      title: 'Imagem',
      key: 'imagem',
      width: '60px',
      render: (_, record) => {
        const imgSrc = record.skus?.[0]?.imagem_url;
        return (
          <Avatar
            shape="square"
            size={48}
            src={imgSrc}
            icon={<PictureOutlined style={{ color: '#bfbfbf' }} />}
            style={{ backgroundColor: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: '6px' }}
          />
        );
      },
    },
    {
      title: 'Estrutura',
      key: 'estrutura_variacoes',
      width: '120px',
      render: (_, record) => {
        const isFamily = checkIsFamily(record);
        const skus: SkuChildType[] = record.skus || [];

        return (
          <Space size="small" wrap>
            {isFamily ? (
              <>
                <Tag color="purple" icon={<ClusterOutlined />}>Família</Tag>
                <Tag color="blue">{skus.length} {skus.length === 1 ? 'variação' : 'variações'}</Tag>
                
              </>
            ) : (
              <Tag color="default" icon={<UserOutlined />}>Individual</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Nome do Produto',
      dataIndex: 'nome_item',
      key: 'nome_item',
      render: (text, record) => {
        const isFamily = checkIsFamily(record);
        const skus = record.skus || [];

        // Se for família com sub-SKUs, encapsula com o Collapse garantindo isolamento total
        if (isFamily && skus.length > 0) {
          return (
            <Collapse 
              ghost 
              size="small"
              items={[{
                key: '1',
                label: <Text strong>{text}</Text>,
                children: <SkuSubTable parentItem={record} />
              }]} 
            />
          );
        }

        return <Text strong>{text}</Text>;
      },
    },
    {
      title: 'Categoria',
      key: 'categoria',
      render: (_, record) => <Text>{record.categoria_id ? `Categoria ${record.categoria_id} ${record.categoria || 'W'}` : '-'}</Text>
    },
    {
      title: 'Marca',
      key: 'marca',
      render: (_, record) => {
        const skus = record.skus || [];
        if (skus.length === 0) return <Text type="secondary">-</Text>;
        const marcasUnicas = Array.from(new Set(skus.map(s => s.marca).filter(Boolean)));
        if (marcasUnicas.length === 0) return <Text type="secondary">-</Text>;
        return <Text>{marcasUnicas.join(', ')}</Text>;
      },
    },
    {
      title: 'Custo Gerencial',
      key: 'precoCustoMedio',
      render: (_, record) => {
        const skus = record.skus || [];
        if (skus.length === 0) return 'R$ 0,00';
        const custos = skus.map(s => s.custo_gerencial || 0);
        const minCusto = Math.min(...custos);
        const maxCusto = Math.max(...custos);

        if (minCusto === maxCusto) return `R$ ${minCusto.toFixed(2)}`;
        return <span style={{ fontSize: 'calc(1em - 1.8pt)' }}>{`R$ ${minCusto.toFixed(2)} - R$ ${maxCusto.toFixed(2)}`}</span>;
      },
    },
    {
      title: 'Preço Venda',
      key: 'precoVendaMedio',
      render: (_, record) => {
        const skus = record.skus || [];
        if (skus.length === 0) return 'R$ 0,00';
        const precos = skus.map(s => s.preco_venda || 0);
        const minPreco = Math.min(...precos);
        const maxPreco = Math.max(...precos);

        if (minPreco === maxPreco) return `R$ ${minPreco.toFixed(2)}`;
        return <span style={{ fontSize: 'calc(1em - 1.8pt)' }}>{`R$ ${minPreco.toFixed(2)} - R$ ${maxPreco.toFixed(2)}`}</span>;
      },
    },
    {
      title: 'Estoque (UoM)',
      key: 'estoqueTotal',
      render: (_, record) => {
        const isFamily = checkIsFamily(record);
        const skus = record.skus || [];
        const total = skus.reduce((acc, sku) => acc + (sku.estoque || 0), 0);

        
        return <Text strong>{total} (UN)</Text>;
      },
    },
    {
      title: 'Status',
      key: 'statusGeral',
      render: (_, record) => {
        const skus = record.skus || [];
        const hasAtivo = skus.some(sku => sku.status === 'ATIVO');
        const hasSemEstoque = skus.some(sku => sku.status === 'Esgotado');

        if (hasAtivo) return <Tag color="green">Ativo</Tag>;
        if (hasSemEstoque) return <Tag color="orange">Esgotado</Tag>;
        return <Tag color="red">Inativo</Tag>;
      },
    },
   {
      title: 'Ações',
      key: 'action',
      width: '120px',
      render: (_, record) => {
        return (
          <Space size="middle">
           <Button 
  type="primary" 
  size="small" 
  onClick={() => {
    console.log("🚀 [DEBUG TABELA] Botão Editar clicado para o record:", record);
    setSelectedProduct(record);
    setIsDrawerVisible(true);
  }}
>
  Editar
</Button>
          </Space>
        );
      },
    }
  ], []);

  const filteredData = React.useMemo(() => {
    return products.filter(item => {
      const matchesSearch = 
        item.nome_item?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchText.toLowerCase());
      
      if (!matchesSearch) return false;

      const skus = item.skus || [];

      if (selectedFilter === 'noStock' && !skus.some(sku => sku.estoque === 0)) return false;
      if (selectedFilter === 'criticalStock' && !skus.some(sku => sku.estoque > 0 && sku.estoque <= 5)) return false;
      if (selectedFilter === 'activeSkus' && !skus.some(sku => sku.estoque > 0)) return false;

      if (selectedSupplier && !skus.some(sku => sku.marca?.toLowerCase() === selectedSupplier.toLowerCase())) return false;
      if (selectedCategory && String(item.categoria_id) !== selectedCategory) return false;

      const isFamily = checkIsFamily(item);
      if (selectedStructure === 'familia' && !isFamily) return false;
      if (selectedStructure === 'individual' && isFamily) return false;

      return true;
    });
  }, [products, searchText, selectedFilter, selectedSupplier, selectedCategory, selectedStructure]);

  const handleClearAllFilters = () => {
    setSelectedFilter('all');
    setSelectedSupplier(undefined);
    setSelectedCategory(undefined);
    setSelectedStructure(undefined);
    setSearchText('');
  };

  const sampleJsonTemplate = `[
    {
      "sku": "MANG-38-GAT",
      "nome_item": "Mangueira Hidráulica 3/8",
      "categoria_id": 7,
      "marca": "Gates",
      "preco_venda": 145.00,
      "custo_gerencial": 85.00,
      "estoque": 20,
      "variacao": "Bitola 3/8 - 100M"
    }
  ]`;

  return (
    <div style={{ padding: '12px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item onClick={() => window.history.back()} style={{ cursor: 'pointer' }}>Voltar</Breadcrumb.Item>
        <Breadcrumb.Item>Catálogo</Breadcrumb.Item>
        <Breadcrumb.Item>Gerenciador de Catálogo</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
            <AppstoreOutlined style={{ marginRight: '12px', color: '#1890ff' }} />
            Gerenciador de Catálogos
          </Title>
        </Col>
        <Col>
          <Space size="middle">
            <Button 
              type="default" 
              icon={<ImportOutlined />} 
              onClick={() => setIsJsonModalVisible(true)}
              style={{ borderColor: '#722ed1', color: '#722ed1' }}
            >
              Importar JSON
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchProducts} loading={loading}>
              Atualizar
            </Button>
            <Badge count={creationBatch.length} status="processing">
              <Button 
                type={creationBatch.length > 0 ? "dashed" : "default"} 
                icon={<ShoppingCartOutlined />} 
                onClick={() => setShowBatchPanel(!showBatchPanel)}
                disabled={creationBatch.length === 0}
              >
                Fila de Criação
              </Button>
            </Badge>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setIsModalVisible(true)}>
              Adicionar Novo
            </Button>
          </Space>
        </Col>
      </Row>

      {showBatchPanel && creationBatch.length > 0 && (
        <Card 
          title="📋 Itens Aguardando Confirmação" 
          style={{ marginBottom: 24, border: '2px dashed #1890ff', background: '#e6f7ff' }}
          extra={
            <Button 
              type="primary" 
              loading={modalLoading}
              icon={<CheckCircleOutlined />} 
              onClick={handleConfirmEntireBatch}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              Salvar Todos no Banco ({creationBatch.length})
            </Button>
          }
        >
          <Alert 
            message="Produtos temporários na fila. Clique para persistir no banco de dados." 
            type="info" 
            showIcon 
            style={{ marginBottom: 16 }}
          />
          <Table
            size="small"
            pagination={false}
            dataSource={creationBatch}
            columns={[
              { title: 'SKU Master', dataIndex: 'sku', key: 'sku', render: (t) => <Text code>{t}</Text> },
              { title: 'Nome do Produto', dataIndex: 'nome_item', key: 'nome_item' },
              { title: 'Preço Venda', key: 'preco', render: (_, r) => `R$ ${(r.skus[0]?.preco_venda || 0).toFixed(2)}` },
              {
                title: 'Ações',
                key: 'remove',
                width: '100px',
                render: (_, record) => (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItemFromBatch(record.key)}>
                    Remover
                  </Button>
                )
              }
            ]}
          />
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('all')}>
            <Statistic title="Total no Catálogo" value={products.length} prefix={<DatabaseOutlined style={{ color: '#1890ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('activeSkus')}>
            <Statistic title="Itens com Estoque" value={products.filter(p => p.skus?.some(s => s.estoque > 0)).length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('noStock')}>
            <Statistic title="Esgotado" value={products.filter(p => p.skus?.some(s => s.estoque === 0)).length} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable bodyStyle={{ padding: '16px' }} onClick={() => setSelectedFilter('criticalStock')}>
            <Statistic title="Estoque Crítico (≤ 5)" value={products.filter(p => p.skus?.some(s => s.estoque > 0 && s.estoque <= 5)).length} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      <Card 
        bordered={false} 
        title="📦 Catálogo Definitivo"
        extra={
          (selectedFilter !== 'all' || selectedSupplier || selectedCategory || selectedStructure || searchText) && (
            <Button type="dashed" danger icon={<ClearOutlined />} onClick={handleClearAllFilters}>
              Limpar Filtros
            </Button>
          )
        }
      >
        <Row style={{ marginBottom: '12px' }} gutter={[12, 12]} align="middle">
          <Col xs={24} sm={24} md={6}>
            <Input 
              placeholder="Buscar por Nome ou SKU..." 
              prefix={<SearchOutlined />} 
              value={searchText} 
              onChange={(e) => setSearchText(e.target.value)} 
              allowClear 
            />
          </Col>

          <Col xs={24} sm={24} md={7}>
            <Radio.Group 
              buttonStyle="solid" 
              value={selectedStructure || 'all_structures'} 
              onChange={(e) => {
                const val = e.target.value;
                setSelectedStructure(val === 'all_structures' ? undefined : val);
              }}
              style={{ width: '100%', display: 'flex' }}
            >
              <Radio.Button value="all_structures" style={{ flex: 1, textAlign: 'center' }}>
                <UnorderedListOutlined style={{ marginRight: '6px' }} /> Todos
              </Radio.Button>
              <Radio.Button value="familia" style={{ flex: 1, textAlign: 'center' }}>
                <ClusterOutlined style={{ marginRight: '6px' }} /> Famílias
              </Radio.Button>
              <Radio.Button value="individual" style={{ flex: 1, textAlign: 'center' }}>
                <UserOutlined style={{ marginRight: '6px' }} /> Individuais
              </Radio.Button>
            </Radio.Group>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Filtrar Categoria"
              allowClear
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={[
                { value: '7', label: 'Mangueiras (Cat 7)' },
                { value: '6', label: 'Correias (Cat 6)' },
              ]}
            />
          </Col>
        </Row>

        {(searchText || selectedStructure || selectedCategory || selectedSupplier || (selectedFilter && selectedFilter !== 'all')) && (
          <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#8c8c8c' }}>Filtros ativos:</span>
            
            {searchText && (
              <Tag closable onClose={() => setSearchText('')}>
                Busca: {searchText}
              </Tag>
            )}

            {selectedStructure && (
              <Tag closable onClose={() => setSelectedStructure(undefined)}>
                Estrutura: {selectedStructure === 'familia' ? 'Famílias' : 'Individuais'}
              </Tag>
            )}

            {selectedCategory && (
              <Tag closable onClose={() => setSelectedCategory(undefined)}>
                Categoria: {selectedCategory === '7' ? 'Mangueiras (Cat 7)' : selectedCategory === '6' ? 'Correias (Cat 6)' : selectedCategory}
              </Tag>
            )}

            {selectedSupplier && (
              <Tag closable onClose={() => setSelectedSupplier(undefined)}>
                Fornecedor: {selectedSupplier}
              </Tag>
            )}

            {selectedFilter && selectedFilter !== 'all' && (
              <Tag closable onClose={() => setSelectedFilter('all')}>
                Filtro: {selectedFilter}
              </Tag>
            )}
          </div>
        )}

        {/* TABELA LIMPA SEM A PROPRIEDADE EXPANDABLE */}
        <Table 
          rowKey={(record, index) => String(record.key || record.id_item || index)}
          columns={parentColumns} 
          dataSource={filteredData} 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <CodeOutlined style={{ color: '#722ed1' }} />
            <span>Importação / Criação Rápida via JSON</span>
          </Space>
        }
        open={isJsonModalVisible}
        onCancel={() => {
          setIsJsonModalVisible(false);
          setJsonInput('');
          setParsedJsonPreview([]);
        }}
        width={750}
        footer={[
          <Button key="cancel" onClick={() => setIsJsonModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<ImportOutlined />}
            disabled={parsedJsonPreview.length === 0}
            onClick={handleImportJsonToBatch}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
          >
            Adicionar à Fila {parsedJsonPreview.length > 0 ? `(${parsedJsonPreview.length} item(ns))` : ''}
          </Button>
        ]}
      >
        <Alert
          message="Formato Aceito do JSON"
          description="Você pode colar um único objeto ou uma lista [ ] de objetos. Os itens importados irão diretamente para a Fila de Criação antes da gravação final no banco de dados."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={18}>
            <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".json">
              <Button icon={<UploadOutlined />}>Carregar arquivo .json</Button>
            </Upload>
          </Col>
          <Col span={6} style={{ textAlign: 'right' }}>
            <Button
              type="link"
              size="small"
              onClick={() => handleJsonInputChange(sampleJsonTemplate)}
            >
              Usar Exemplo
            </Button>
          </Col>
        </Row>

        <TextArea
          rows={7}
          placeholder="Cole seu código JSON aqui..."
          value={jsonInput}
          onChange={(e) => handleJsonInputChange(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: '12px' }}
        />

        {parsedJsonPreview.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text strong>Pré-visualização dos Itens Interpretados ({parsedJsonPreview.length}):</Text>
            <Table
              size="small"
              pagination={false}
              dataSource={parsedJsonPreview}
              rowKey="key"
              style={{ marginTop: 8 }}
              columns={[
                { title: 'SKU Master', dataIndex: 'sku', render: (t) => <Text code>{t}</Text> },
                { title: 'Nome', dataIndex: 'nome_item' },
                { title: 'Preço Venda', key: 'preco', render: (_, r) => `R$ ${(r.skus[0]?.preco_venda || 0).toFixed(2)}` },
                { title: 'Estoque', key: 'estoque', render: (_, r) => r.skus[0]?.estoque || 0 }
              ]}
            />
          </div>
        )}
      </Modal>

      <CreateProductModal open={isModalVisible} onClose={() => setIsModalVisible(false)} onSave={handleSaveProduct} loading={modalLoading} />
      <ProductDetailsDrawer open={isDrawerVisible} product={selectedProduct} onClose={() => setIsDrawerVisible(false)} onSave={handleUpdateProduct} />
    </div>
  );
}