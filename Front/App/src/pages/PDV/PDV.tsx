// PDV (modelo novo): catálogo publicável com preço por unidade e atacado, leitor de código de barras,
// cliente do cadastro e carrinho/pagamento. A OS fica fora até existir no modelo novo.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Input, Select, Space, Switch, Tag, Tooltip, TreeSelect, message } from 'antd';
import { EnvironmentOutlined, InfoCircleOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import styles from './PDV.module.css';
import { Product } from './types/product.types';
import {
  getPdvProducts,
  getPdvBrands,
  getArvoreCategoriasPdv,
  CategoriaNo,
} from './services/api/products';
import { useDebounce } from './hooks/useDebounce';
import { CartAside } from './pages/Cart/CartAside';
import { FinalizarVenda } from './pages/FinalizarVenda';
import { PDVProvider, usePDV } from './contexts/PDVContext';
import ImageDisplay from '../../components/ui/ImageGallery/ImageDysplay';
import UniversalInventory from '../../components/Layout/UniversalInventory/UniversalInventory';
import { ClientePdvModal, formatarDocumento } from './components/ClientePdvModal';
import { ItemPdvDrawer } from './components/ItemPdvDrawer';

type DisplayMode = 'lista' | 'cards' | 'compact';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const destacar = (texto: string, termo: string) => {
  if (!termo.trim()) return texto;
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(texto).split(new RegExp(`(${escapado})`, 'gi')).map((parte, i) =>
    parte.toLowerCase() === termo.toLowerCase()
      ? <mark key={i} style={{ background: '#fde68a', padding: 0 }}>{parte}</mark>
      : parte
  );
};

const bip = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 1500;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  } catch { /* sem áudio */ }
};

const PDVContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    cart, addToCart, updateQuantity, removeItem, changeUnit, applyIndividualDiscount, clearCart,
    estagio, setEstagio, cliente, clienteId, clienteDocumento, selecionarCliente,
    mostrarModalCliente, setMostrarModalCliente,
    searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, brand, setBrand,
    sortOrder, setSortOrder, onlyInStock, setOnlyInStock,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
  } = usePDV();

  const [displayMode, setDisplayMode] = useState<DisplayMode>('lista');
  const [mostrarNaoPublicaveis, setMostrarNaoPublicaveis] = useState(false);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [totalItens, setTotalItens] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [arvoreCategorias, setArvoreCategorias] = useState<CategoriaNo[]>([]);
  const [marcas, setMarcas] = useState<string[]>(['Todos']);
  const [itemDetalhe, setItemDetalhe] = useState<number | null>(null);
  const buscaRef = useRef<any>(null);
  const buscaDebounce = useDebounce(searchTerm, 400);

  // Nova venda começa pela identificação do cliente
  useEffect(() => {
    if (!id && !cliente) setMostrarModalCliente(true);
  }, [id]);

  useEffect(() => {
    getArvoreCategoriasPdv().then(setArvoreCategorias);
    getPdvBrands().then(b => setMarcas(['Todos', ...b.filter(x => x !== 'Todos')]));
  }, []);

  const filtros = useMemo(() => ({
    searchTerm: buscaDebounce || undefined,
    category: selectedCategory && selectedCategory !== 'Todas' ? selectedCategory : undefined,
    brand: brand !== 'Todos' ? brand : undefined,
    sort: sortOrder || undefined,
    page: currentPage,
    limit: itemsPerPage,
    onlyInStock,
    onlyActive: true,
    incluirNaoPublicaveis: mostrarNaoPublicaveis,
  }), [buscaDebounce, selectedCategory, brand, sortOrder, currentPage, itemsPerPage, onlyInStock, mostrarNaoPublicaveis]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    getPdvProducts(filtros)
      .then(r => { if (ativo) { setProdutos(r.data || []); setTotalItens(r.pagination?.total || 0); } })
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [filtros]);

  // Filtro mudou: volta para a 1ª página
  useEffect(() => { setCurrentPage(1); }, [buscaDebounce, selectedCategory, brand, onlyInStock, mostrarNaoPublicaveis]);

  const temFiltros = (selectedCategory && selectedCategory !== 'Todas') || brand !== 'Todos' || !!searchTerm;
  const limparFiltros = () => { setSearchTerm(''); setSelectedCategory('Todas'); setBrand('Todos'); };

  // Total da venda: só itens (mão de obra/OS ficam para o módulo de OS)
  const total = useMemo(() => cart.reduce((acc, i) => acc + i.price * i.quantity, 0), [cart]);

  const incluir = useCallback((p: any, idUnidade?: number | null) => {
    addToCart({
      id: p.id,
      name: p.name,
      price: Number(p.salePrice) || 0,
      costPrice: Number(p.costPrice) || 0,
      type: 'product',
      sku: p.sku,
      barcode: p.barcode,
      stock: Number(p.currentStock) || 0,
      unitOfMeasure: p.unitOfMeasure,
      idUnidadeVenda: idUnidade ?? p.idUnidadeVenda ?? null,
      category: p.category,
      status: p.status,
      pictureUrl: p.pictureUrl,
    } as any);
  }, [addToCart]);

  // Leitor de código de barras: GTIN/SKU exato entra direto no carrinho
  const processarCodigo = useCallback(async (codigo: string) => {
    const limpo = codigo.trim();
    if (limpo.length < 3) return;
    const r = await getPdvProducts({ searchTerm: limpo, limit: 1, incluirNaoPublicaveis: mostrarNaoPublicaveis });
    const p = r.data?.[0];
    if (p && (p.barcode === limpo || String(p.sku).toLowerCase() === limpo.toLowerCase())) {
      incluir(p);
      bip();
      message.success({ content: `${p.name} · ${money.format(Number(p.salePrice) || 0)}${p.unitOfMeasure ? ` /${p.unitOfMeasure}` : ''}`, duration: 1.5 });
      if (searchTerm.trim() === limpo) setSearchTerm('');
    } else {
      message.warning(`Código ${limpo} não encontrado.`);
    }
  }, [incluir, mostrarNaoPublicaveis, searchTerm]);

  useEffect(() => {
    let acumulado = '';
    let ultimaTecla = Date.now();
    const aoTeclar = (e: KeyboardEvent) => {
      // Atalhos
      if (e.key === 'F2') { e.preventDefault(); if (cart.length > 0) setEstagio('PAGAMENTO'); return; }
      if (e.key === 'F3') { e.preventDefault(); buscaRef.current?.focus(); return; }
      if (e.key === 'F4') { e.preventDefault(); setMostrarModalCliente(true); return; }
      if (mostrarModalCliente) return;
      // Leitor: teclas muito rápidas terminando em Enter
      const agora = Date.now();
      if (agora - ultimaTecla > 60) acumulado = '';
      ultimaTecla = agora;
      if (e.key === 'Enter') {
        if (acumulado.length > 3) { e.preventDefault(); processarCodigo(acumulado); }
        acumulado = '';
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) acumulado += e.key;
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [processarCodigo, cart.length, mostrarModalCliente]);

  const colunas = [
    {
      header: '',
      key: 'pictureUrl',
      render: (item: any) => <ImageDisplay src={item.pictureUrl} size="38px" rounded="6px" />,
    },
    {
      header: 'Item',
      key: 'name',
      render: (item: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{destacar(item.name, searchTerm)}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {destacar(String(item.sku || ''), searchTerm)}{item.category ? ` · ${item.category}` : ''}{item.brand ? ` · ${item.brand}` : ''}
          </div>
          {item.publicavel === false && (
            <Tooltip title={(item.motivosPublicacao || []).join(' · ')}>
              <Tag color="gold" style={{ fontSize: 10, marginTop: 2 }}>Não publicável</Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      header: 'Preço',
      key: 'price',
      textAlign: 'right' as const,
      render: (item: any) => (
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span>
            <span style={{ fontWeight: 700, color: item.salePrice > 0 ? '#0f172a' : '#dc2626' }}>{money.format(Number(item.salePrice) || 0)}</span>
            <span style={{ color: '#64748b', fontSize: 11 }}> /{item.unitOfMeasure || 'un'}</span>
          </span>
          {item.atacado && (
            <Tooltip title={`Comprando a partir de ${qtd(item.atacado.quantidadeMinima)} ${item.unitOfMeasure || 'un'}, cada ${item.unitOfMeasure || 'un'} sai por ${money.format(item.atacado.preco)} (economia de ${Math.round((1 - item.atacado.preco / (Number(item.salePrice) || 1)) * 100)}%)`}>
              <Tag color="green" style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                Atacado {qtd(item.atacado.quantidadeMinima)}+ {item.unitOfMeasure || 'un'}: {money.format(item.atacado.preco)}
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      header: 'Estoque',
      key: 'stock',
      textAlign: 'right' as const,
      render: (item: any) => (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 600, color: Number(item.currentStock) > 0 ? undefined : '#dc2626' }}>
            {qtd(item.currentStock)} <span style={{ fontWeight: 400, color: '#64748b' }}>{item.unitOfMeasure}</span>
          </span>
          {item.location && <div><Tag icon={<EnvironmentOutlined />} style={{ fontSize: 10, margin: 0 }}>{item.location}</Tag></div>}
        </div>
      ),
    },
    {
      header: '',
      key: 'actions',
      textAlign: 'center' as const,
      render: (item: any) => (
        <Space size={4}>
          <Tooltip title="Detalhes, unidades e faixas">
            <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setItemDetalhe(item.id)} />
          </Tooltip>
          <Tooltip title="Adicionar ao carrinho">
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => incluir(item)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const dadosLista = useMemo(() => produtos.map(p => ({
    ...p,
    price: Number(p.salePrice) || 0,
    stock: Number(p.currentStock) || 0,
    imageUrl: p.pictureUrl,
    type: 'part' as const,
  })), [produtos]);

  return (
    <div className={`${styles.PDVcontainer} ${estagio === 'PAGAMENTO' ? styles.checkoutActive : ''}`}>
      <ClientePdvModal
        open={mostrarModalCliente}
        onSelecionar={c => { selecionarCliente(c); setTimeout(() => buscaRef.current?.focus(), 50); }}
        onFechar={() => { if (!cliente) selecionarCliente(null); else setMostrarModalCliente(false); }}
      />

      <main className={styles.mainContent}>
        {estagio === 'PAGAMENTO' && <div className={styles.lockOverlay} onClick={() => setEstagio('SELECAO')} />}

        {/* Cabeçalho: cliente + busca + filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<UserOutlined />} onClick={() => setMostrarModalCliente(true)}>
              <span style={{ fontWeight: 600 }}>{cliente || 'Consumidor Final'}</span>
              {clienteId && clienteDocumento && <span style={{ color: '#64748b', marginLeft: 6, fontFamily: 'monospace', fontSize: 11 }}>{formatarDocumento(clienteDocumento)}</span>}
              <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>F4</span>
            </Button>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>F2 finalizar · F3 buscar · F4 cliente · bipe o código de barras a qualquer momento</span>
          </div>

          <Space.Compact style={{ width: '100%' }}>
            <Input
              ref={buscaRef}
              size="large"
              allowClear
              autoFocus
              placeholder="Buscar por nome, SKU ou código de barras (F3)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </Space.Compact>

          <Space wrap size={[8, 6]}>
            <TreeSelect
              style={{ minWidth: 240 }}
              treeData={arvoreCategorias}
              value={selectedCategory && selectedCategory !== 'Todas' ? selectedCategory : undefined}
              onChange={v => setSelectedCategory(v || 'Todas')}
              placeholder="Todas as categorias"
              allowClear
              showSearch
              treeNodeFilterProp="title"
              treeDefaultExpandAll
            />
            <Select
              style={{ minWidth: 160 }}
              value={brand}
              onChange={setBrand}
              options={marcas.map(m => ({ value: m, label: m === 'Todos' ? 'Todas as marcas' : m }))}
              showSearch
            />
            <Space size={4}><Switch size="small" checked={onlyInStock} onChange={setOnlyInStock} /> Em estoque</Space>
            <Tooltip title="Provisório: inclui itens que ainda não passam na regra de publicação (ficha incompleta, família bloqueada...)">
              <Space size={4}><Switch size="small" checked={mostrarNaoPublicaveis} onChange={setMostrarNaoPublicaveis} /> Não publicáveis</Space>
            </Tooltip>
            {temFiltros && <Button size="small" onClick={limparFiltros}>Limpar filtros</Button>}
            <span style={{ fontSize: 12, color: '#64748b' }}>{totalItens} item(ns)</span>
          </Space>
        </div>

        <UniversalInventory
          data={dadosLista}
          columns={colunas}
          loading={carregando}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          sortOrder={sortOrder}
          pagination={{
            totalItems: totalItens,
            currentPage,
            itemsPerPage,
            totalPages: Math.ceil(totalItens / itemsPerPage),
          }}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={limit => { setItemsPerPage(limit); setCurrentPage(1); }}
          onSortChange={sort => { setSortOrder(sort); setCurrentPage(1); }}
          onRefresh={() => setCurrentPage(1)}
          onAction={item => incluir(item)}
          moneyFormatter={v => money.format(v)}
        />
      </main>

      <CartAside
        cart={cart}
        cliente={cliente}
        itemsSubtotal={total}
        activeTab="parts"
        calculatedLabor={0}
        total={total}
        money={money}
        updateQuantity={updateQuantity}
        changeUnit={changeUnit}
        removeItem={removeItem}
        onFinalizar={() => setEstagio('PAGAMENTO')}
        onBack={() => setEstagio('SELECAO')}
        estagio={estagio}
        applyIndividualDiscount={applyIndividualDiscount}
      />

      <aside className={styles.paymentSidebar}>
        <FinalizarVenda
          onBack={() => setEstagio('SELECAO')}
          onVendaConcluida={() => { clearCart(); setEstagio('SELECAO'); selecionarCliente(null); setMostrarModalCliente(true); }}
          total={total}
          cliente={cliente}
          clienteId={clienteId}
          itens={cart as any}
        />
      </aside>

      <ItemPdvDrawer
        idItem={itemDetalhe}
        onClose={() => setItemDetalhe(null)}
        onAdicionar={(p, idUnidade) => { incluir(p, idUnidade); message.success(`${p.name} adicionado.`); }}
      />
    </div>
  );
};

const PDV: React.FC = () => (
  <PDVProvider>
    <PDVContent />
  </PDVProvider>
);

export default PDV;
export { PDVContent };
