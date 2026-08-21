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
  UploadOutlined,
  PrinterOutlined
} from '@ant-design/icons';

import type { ColumnsType } from 'antd/es/table';

import { ItemParentType, SkuChildType } from './CatalogSku.types';
import { getProdutos, updateProduto, saveProdutosLote } from './CatalogSku.service';
import ProductDetailsDrawer from './ProductDetailsDrawer';
import CreateProductModal from './CreateProductModal'; 
import { generatePRN, type LabelData } from '../../../Estoque/utils/labelGenerator';

const { Title, Text } = Typography;
const { TextArea } = Input;

type FilterType = 'all' | 'activeSkus' | 'noStock' | 'criticalStock';

type QuickPrintItem = LabelData & {
  id: string;
};

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

  // Impressão Rápida
  const [quickPrintQueue, setQuickPrintQueue] = useState<QuickPrintItem[]>([]);
  const [quickPrintSize, setQuickPrintSize] = useState<'105x27' | '60x40'>('105x27');

  const checkIsFamily = (record: ItemParentType): boolean => {
    const isFamKey = String(record.id_item).startsWith('FAM-') || String(record.sku || '').startsWith('FAM-');
    const familyId = Number(record.familia_id ?? 0);
    const hasFamiliaId = familyId > 0;
    const hasFamilyName = !!record.categoria && String(record.categoria).trim().length > 0 && String(record.categoria).trim() !== String(record.nome_item || '').trim();
    const isTipoFamilia = String(record.tipo_recurso || '').toUpperCase() === 'FAMILIA';
    const hasMultipleSkus = (record.skus || []).length > 1;

    return isFamKey || hasFamiliaId || hasFamilyName || isTipoFamilia || hasMultipleSkus;
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProdutos();
      setProducts(data);
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : 'Falha ao carregar os produtos do servidor.';
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

 const handleUpdateProduct = async (idItem: string | number, updatedFields: Record<string, unknown>) => {
    try {
      const rawTargetId = idItem ?? selectedProduct?.id_item ?? selectedProduct?.key;
      const normalizedTargetId = Number(rawTargetId);

      if (
        rawTargetId === undefined ||
        rawTargetId === null ||
        rawTargetId === '' ||
        !Number.isFinite(normalizedTargetId) ||
        normalizedTargetId <= 0 ||
        String(rawTargetId).startsWith('FAM-') ||
        String(rawTargetId).startsWith('fam-') ||
        String(rawTargetId).startsWith('prod-')
      ) {
        message.error('ID do item não informado ou inválido para atualização.');
        return;
      }

      await updateProduto(normalizedTargetId, updatedFields);
      message.success('Produto atualizado com sucesso!');
      setIsDrawerVisible(false);
      fetchProducts();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar alterações no servidor.';
      message.error(errorMessage);
    }
  };

  const handleSaveProduct = async (payload: Record<string, unknown>) => {
    const tempId = Date.now();
    const payloadRecord = payload as Record<string, unknown>;
    const novoItemPai: ItemParentType = {
      key: String(tempId),
      id_item: tempId,
      tenant_id: 1,
      sku: String(payloadRecord.sku ?? payloadRecord.codItem ?? ''),
      nome_item: String(payloadRecord.nome ?? payloadRecord.nome_item ?? 'Produto sem nome'),
      tipo_recurso: payloadRecord.isFamilia ? 'FAMILIA' : 'PRODUTO',
      status: 'ATIVO',
      familia_id: Number(payloadRecord.familia_id ?? 0) || null,
      categoria_id: Number(payloadRecord.categoria_id ?? 0) || null,
      categoria: payloadRecord.categoria ? String(payloadRecord.categoria) : null,
      skus: [
        {
          key: `${tempId}-0`,
          id_item: tempId,
          sku: String(payloadRecord.sku ?? payloadRecord.codItem ?? ''),
          variacao: 'Principal',
          marca: payloadRecord.marca ? String(payloadRecord.marca) : 'Própria',
          estoque: Number(payloadRecord.estoque_inicial ?? 0),
          preco_venda: Number((payloadRecord.financeiro as Record<string, unknown> | undefined)?.preco_venda ?? 0),
          custo_gerencial: Number((payloadRecord.financeiro as Record<string, unknown> | undefined)?.custo_gerencial ?? 0),
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

      const validatedItems: ItemParentType[] = itemsArray.map((item: unknown, idx: number) => {
        const itemRecord = item as Record<string, unknown>;
        const tempId = Number(itemRecord.id_item ?? Date.now() + idx);
        const mainSku = String(itemRecord.sku ?? `SKU-AUTO-${tempId}`);

        const innerSkus: SkuChildType[] = Array.isArray(itemRecord.skus) && (itemRecord.skus as unknown[]).length > 0
          ? (itemRecord.skus as unknown[]).map((skuItem: unknown, sIdx: number) => {
              const skuRecord = skuItem as Record<string, unknown>;
              return {
                key: String(skuRecord.key ?? `${tempId}-${sIdx}`),
                id_item: tempId,
                sku: String(skuRecord.sku ?? `${mainSku}-${sIdx + 1}`),
                variacao: String(skuRecord.variacao ?? 'Padrão'),
                marca: skuRecord.marca ? String(skuRecord.marca) : String(itemRecord.marca ?? 'Própria'),
                estoque: Number(skuRecord.estoque ?? itemRecord.estoque ?? 0),
                preco_venda: Number(skuRecord.preco_venda ?? itemRecord.preco_venda ?? itemRecord.preco ?? 0),
                custo_gerencial: Number(skuRecord.custo_gerencial ?? itemRecord.custo_gerencial ?? itemRecord.custo ?? 0),
                status: String(skuRecord.status ?? 'ATIVO') as SkuChildType['status'],
                imagem_url: skuRecord.imagem_url ? String(skuRecord.imagem_url) : (typeof itemRecord.imagem_url === 'string' ? String(itemRecord.imagem_url) : null)
              };
            })
          : [
              {
                key: `${tempId}-0`,
                id_item: tempId,
                sku: mainSku,
                variacao: String(itemRecord.variacao ?? 'Principal'),
                marca: itemRecord.marca ? String(itemRecord.marca) : 'Própria',
                estoque: Number(itemRecord.estoque ?? 0),
                preco_venda: Number(itemRecord.preco_venda ?? itemRecord.preco ?? 0),
                custo_gerencial: Number(itemRecord.custo_gerencial ?? itemRecord.custo ?? 0),
                status: 'ATIVO' as SkuChildType['status'],
                imagem_url: typeof itemRecord.imagem_url === 'string' ? String(itemRecord.imagem_url) : null
              }
            ];

        return {
          key: String(tempId),
          id_item: tempId,
          tenant_id: 1,
          sku: mainSku,
          nome_item: String(itemRecord.nome_item ?? itemRecord.nome ?? 'Produto Sem Nome'),
          tipo_recurso: String(itemRecord.tipo_recurso ?? 'PRODUTO'),
          status: String(itemRecord.status ?? 'ATIVO') as ItemParentType['status'],
          familia_id: Number(itemRecord.familia_id ?? 0) || null,
          categoria_id: Number(itemRecord.categoria_id ?? 0) || null,
          skus: innerSkus
        };
      });

      setParsedJsonPreview(validatedItems);
    } catch {
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
      console.log('📤 [BATCH INSERT] Payload sendo enviado ao backend:', JSON.stringify(creationBatch, null, 2));
      console.log('📤 [BATCH INSERT] Detalhando os SKUs de cada item:');
      creationBatch.forEach((item, idx) => {
        console.log(`  Item ${idx}: ${item.nome_item} (SKU: ${item.sku})`);
        item.skus.forEach((sku, skuIdx) => {
          console.log(`    SKU ${skuIdx}: preco_venda=${sku.preco_venda}, custo_gerencial=${sku.custo_gerencial}`);
        });
      });
      
      await saveProdutosLote(creationBatch);
      message.success(`${creationBatch.length} produtos salvos com sucesso no banco!`);
      setCreationBatch([]);
      setShowBatchPanel(false);
      fetchProducts();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao persistir o lote no banco de dados.';
      message.error(errorMessage);
    } finally {
      setModalLoading(false);
    }
  };

  const removeItemFromBatch = (key: string) => {
    setCreationBatch(prev => prev.filter(item => item.key !== key));
  };

  const addToQuickPrintQueue = (record: ItemParentType) => {
    const sourceSkus = record.skus?.length ? record.skus : [
      {
        key: String(record.key || record.id_item),
        id_item: record.id_item,
        sku: record.sku,
        variacao: 'Principal',
        marca: 'Própria',
        estoque: 0,
        preco_venda: 0,
        custo_gerencial: 0,
        status: record.status,
        imagem_url: null,
      } as SkuChildType
    ];

    const nextItems = sourceSkus.map((sku, index) => {
      const displayName = record.familia_id
        ? `${record.nome_item}${sku.variacao && sku.variacao !== 'Principal' ? ` - ${sku.variacao}` : ''}`
        : record.nome_item;

      return {
        id: `${record.id_item}-${sku.id_item ?? record.id_item}-${sku.sku ?? record.sku}-${index}`,
        name: displayName,
        sku: String(sku.sku || record.sku || 'SEM-SKU'),
        price: Number(sku.preco_venda ?? 0),
        quantity: 1,
        unit: 'UN',
        isPromo: false,
        batch: '',
        expiryDate: '',
        gtin: String(sku.sku || record.sku || 'SEM-SKU'),
      } satisfies QuickPrintItem;
    });

    setQuickPrintQueue(prev => {
      const ids = new Set(prev.map(item => item.id));
      const merged = [...prev];

      nextItems.forEach((item) => {
        if (!ids.has(item.id)) {
          merged.push(item);
          ids.add(item.id);
        }
      });

      return merged;
    });

    message.success(`${nextItems.length} item(ns) adicionado(s) à fila de impressão rápida.`);
  };

  const removeFromQuickPrintQueue = (id: string) => {
    setQuickPrintQueue(prev => prev.filter(item => item.id !== id));
  };

  const handlePrintQuickQueue = () => {
    if (quickPrintQueue.length === 0) {
      message.warning('A fila de impressão rápida está vazia.');
      return;
    }

    generatePRN(quickPrintQueue, quickPrintSize);
    message.success(`Arquivo .PRN gerado com ${quickPrintQueue.length} etiqueta(s).`);
  };

  const clearQuickPrintQueue = () => {
    setQuickPrintQueue([]);
    message.info('Fila de impressão rápida limpa.');
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
      width: '180px',
      render: (_, record) => {
        return (
          <Space size="small">
            <Button 
              type="default"
              size="small"
              icon={<PrinterOutlined />}
              onClick={() => addToQuickPrintQueue(record)}
            >
              Imprimir
            </Button>
            <Button 
              type="primary" 
              size="small" 
              onClick={() => {
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

  const groupedProducts = React.useMemo(() => {
    const map = new Map<string, ItemParentType>();

    products.forEach((item) => {
      const groupKey = item.familia_id ? `family-${item.familia_id}` : `single-${item.id_item}`;
      const familyName = item.familia_id ? (item.categoria || item.nome_item || 'Família') : item.nome_item;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          id_item: item.id_item,
          tenant_id: item.tenant_id,
          sku: item.familia_id ? `FAM-${item.familia_id}` : item.sku,
          nome_item: familyName,
          tipo_recurso: item.familia_id ? 'FAMILIA' : item.tipo_recurso,
          status: item.status,
          categoria_id: item.categoria_id,
          categoria: item.categoria,
          familia_id: item.familia_id,
          skus: [],
        });
      }

      const parent = map.get(groupKey)!;
      const candidateChild: SkuChildType = {
        key: String(item.id_item),
        id_item: item.id_item,
        sku: item.sku,
        variacao: item.skus?.[0]?.variacao || 'Principal',
        marca: item.skus?.[0]?.marca || 'Própria',
        estoque: item.skus?.[0]?.estoque ?? 0,
        preco_venda: item.skus?.[0]?.preco_venda ?? 0,
        custo_gerencial: item.skus?.[0]?.custo_gerencial ?? 0,
        status: item.skus?.[0]?.status ?? item.status,
        imagem_url: item.skus?.[0]?.imagem_url ?? null,
      };

      const alreadyExists = parent.skus.some((sku) => {
        const matchesId = String(sku.id_item) === String(candidateChild.id_item);
        const matchesSku = String(sku.sku || '').trim() === String(candidateChild.sku || '').trim();
        return matchesId || matchesSku;
      });

      if (!alreadyExists) {
        parent.skus.push(candidateChild);
      }
    });

    return Array.from(map.values()).filter((parent) => {
      const isFamilyRoot = Boolean(parent.familia_id) || parent.tipo_recurso === 'FAMILIA';
      return isFamilyRoot ? parent.skus.length > 0 : true;
    });
  }, [products]);

  const filteredData = React.useMemo(() => {
    return groupedProducts.filter(item => {
      const matchesSearch =
        item.nome_item?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.skus.some(sku => sku.sku.toLowerCase().includes(searchText.toLowerCase()));

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
  }, [groupedProducts, searchText, selectedFilter, selectedSupplier, selectedCategory, selectedStructure]);

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
        title="🖨️ Impressão Rápida"
        style={{ marginBottom: 18, border: '1px solid #d9d9d9' }}
        extra={
          <Space>
            <Select
              value={quickPrintSize}
              onChange={(value) => setQuickPrintSize(value)}
              options={[
                { value: '105x27', label: '105x27 mm' },
                { value: '60x40', label: '60x40 mm' },
              ]}
              style={{ width: 120 }}
            />
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrintQuickQueue} disabled={quickPrintQueue.length === 0}>
              Imprimir ({quickPrintQueue.length})
            </Button>
            <Button danger type="text" onClic k={clearQuickPrintQueue} disabled={quickPrintQueue.length === 0}>
              Limpar
            </Button>
          </Space>
        }
      >
        {quickPrintQueue.length === 0 ? (
          <Text type="secondary">Selecione itens da tabela para criar uma fila de impressão rápida.</Text>
        ) : (
          <Table
            size="small"
            pagination={false}
            dataSource={quickPrintQueue}
            rowKey="id"
            columns={[
              { title: 'Produto', dataIndex: 'name', key: 'name' },
              { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (value) => <Text code>{value}</Text> },
              { title: 'Preço', dataIndex: 'price', key: 'price', render: (value) => `R$ ${Number(value || 0).toFixed(2)}` },
              { title: 'Qtd.', dataIndex: 'quantity', key: 'quantity', width: 70 },
              {
                title: 'Ações',
                key: 'remove',
                width: 90,
                render: (_, record) => (
                  <Button type="text" danger size="small" onClick={() => removeFromQuickPrintQueue(record.id)}>
                    Remover
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

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