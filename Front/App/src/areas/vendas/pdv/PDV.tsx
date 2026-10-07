// PDV (modelo novo): catálogo publicável com preço por unidade e atacado, leitor de código de barras,
// cliente do cadastro e carrinho/pagamento. A OS fica fora até existir no modelo novo.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Input, Modal, Select, Space, Switch, Tag, Tooltip, TreeSelect, message } from 'antd';
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
import { CartAside } from './carrinho/CartAside';
import { FinalizarVenda } from './pagamento/FinalizarVenda';
import { PDVProvider, usePDV } from './contexts/PDVContext';
import ImageDisplay from '../../../shared/components/ui/ImageGallery/ImageDysplay';
import UniversalInventory from '../../../app/layout/UniversalInventory/UniversalInventory';
import { ClientePdvModal, formatarDocumento } from './components/ClientePdvModal';
import { ItemPdvDrawer } from './components/ItemPdvDrawer';
import { AvisoCaixaFechado } from '../caixa/CaixaPainel';
import { caixaStore, useCaixa } from '../caixa/caixaStore';
import { useSituacaoCliente } from '../../financeiro/receber/receberApi';
import { imprimirOrcamento, pedidosAbertosApi } from './services/pedidosAbertosApi';
import { DadosOrcamento, DrawerPedidosAbertos, ModalSalvarOrcamento } from './components/PedidosAbertosPDV';
import { extensoesPdv } from '../../../modulos/registroModulos';
import { devolucoesService } from './services/salesService';
import { CHAVE_TROCA } from './components/ModalDevolucao';
import { useModulos } from '../../../modulos/modulosStore';
import { Suspense } from 'react';

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
    cart, addToCart, updateQuantity, removeItem, changeUnit, applyIndividualDiscount, clearCart, carregarItens,
    estagio, setEstagio, cliente, setCliente, clienteId, clienteDocumento, selecionarCliente,
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

  // ---------------------------------------------------------------- Orçamentos e vendas suspensas
  // Venda nascida de um orçamento (vai junto no envio; manterPreco = preços congelados do orçamento)
  const [orcamentoAtual, setOrcamentoAtual] = useState<{ id: number; manterPreco: boolean } | null>(null);
  const [drawerPedidos, setDrawerPedidos] = useState<null | 'SUSPENSA' | 'ORCAMENTO'>(null);
  const [modalOrcamento, setModalOrcamento] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [qtdSuspensas, setQtdSuspensas] = useState(0);
  const atualizarSuspensas = useCallback(() => {
    pedidosAbertosApi.listar('SUSPENSA').then(l => setQtdSuspensas(l.length)).catch(() => undefined);
  }, []);
  useEffect(() => { atualizarSuspensas(); }, [atualizarSuspensas]);

  const itensParaSalvar = () => cart
    .filter((i: any) => i.type !== 'service' && i.type !== 'os')
    .map((i: any) => ({ idItem: Number(i.id), quantidade: Number(i.quantity), idUnidade: i.idUnidadeVenda ?? null, precoUnitario: i.precoManual ? Number(i.price) : undefined }));

  // Módulos plugáveis com botão no PDV (ex.: montagem de mangueira)
  const { ativos: modulosAtivos } = useModulos();
  const botoesModulos = extensoesPdv(modulosAtivos);

  // Venda ligada a algo de um módulo (ex.: entrega de OS): sinais dessa origem no pagamento
  const [origemExterna, setOrigemExterna] = useState<{ origem: string; idOrigem: number; rotulo: string } | null>(null);

  const novaVenda = () => {
    // Aviso genérico para os módulos (ex.: descartar fichas de montagem de um carrinho que não virou venda)
    window.dispatchEvent(new Event('erp:venda-nova'));
    clearCart();
    setOrcamentoAtual(null);
    setOrigemExterna(null);
    setEstagio('SELECAO');
    selecionarCliente(null);
    setMostrarModalCliente(true);
  };

  const suspender = async () => {
    const itens = itensParaSalvar();
    if (itens.length === 0) return;
    setSalvandoPedido(true);
    try {
      const r = await pedidosAbertosApi.salvar({ tipo: 'SUSPENSA', itens, clienteNome: cliente, idCliente: clienteId });
      message.success(`Venda suspensa (Nº ${r.id}). Retome em "Suspensas".`);
      novaVenda();
      atualizarSuspensas();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao suspender.');
    } finally {
      setSalvandoPedido(false);
    }
  };

  const salvarOrcamento = async (dados: DadosOrcamento) => {
    setSalvandoPedido(true);
    try {
      const r = await pedidosAbertosApi.salvar({ tipo: 'ORCAMENTO', itens: itensParaSalvar(), clienteNome: cliente, idCliente: clienteId, ...dados });
      setModalOrcamento(false);
      novaVenda();
      Modal.confirm({
        title: `Orçamento Nº ${r.id} salvo`,
        content: `Total ${money.format(r.totalLiquido)}. Ele fica em Vendas › Orçamentos e pode virar venda depois.`,
        okText: 'Imprimir', cancelText: 'Fechar',
        onOk: async () => imprimirOrcamento(await pedidosAbertosApi.detalhe(r.id)),
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar o orçamento.');
    } finally {
      setSalvandoPedido(false);
    }
  };

  // Retomar suspensa / vender orçamento: recoloca os itens no carrinho
  const abrirPedido = useCallback(async (idPedido: number, tipo: 'SUSPENSA' | 'ORCAMENTO') => {
    try {
      const d = tipo === 'SUSPENSA' ? await pedidosAbertosApi.retomar(idPedido) : await pedidosAbertosApi.detalhe(idPedido);
      if (d.situacao === 'CONVERTIDO') { message.info(`O orçamento ${d.id} já virou venda.`); return; }
      let manterPreco = false;
      if (tipo === 'ORCAMENTO' && d.situacao === 'VALIDO') {
        manterPreco = await new Promise<boolean>(resolve => Modal.confirm({
          title: `Orçamento Nº ${d.id} (válido até ${String(d.validade).split('-').reverse().join('/')})`,
          content: 'Vender com os preços do orçamento ou com os preços atuais do catálogo?',
          okText: 'Manter preços do orçamento', cancelText: 'Usar preços atuais', closable: false,
          onOk: () => resolve(true), onCancel: () => resolve(false),
        }));
      } else if (tipo === 'ORCAMENTO') {
        message.info(`Orçamento ${d.id} vencido: os itens entram com os preços atuais.`);
      }
      const falhas = await carregarItens(d.itens.map(i => ({
        idItem: i.idItem, nome: i.nome, quantidade: i.quantidade, idUnidade: i.idUnidade,
        // Orçamento mantido: preço congelado; suspensa: mantém só o desconto manual que havia
        ...(manterPreco
          ? { precoFixo: i.precoUnitario, precoTabelaFixa: i.precoTabela }
          : tipo === 'SUSPENSA' && i.precoUnitario < i.precoTabela - 0.004 ? { precoFixo: i.precoUnitario } : {}),
      })));
      if (d.idCliente) selecionarCliente({ id: d.idCliente, nome: d.cliente });
      else { selecionarCliente(null); if (d.cliente && d.cliente !== 'CONSUMIDOR') setCliente(d.cliente); }
      setOrcamentoAtual(tipo === 'ORCAMENTO' ? { id: d.id, manterPreco } : null);
      setEstagio('SELECAO');
      setDrawerPedidos(null);
      setMostrarModalCliente(false);
      if (falhas.length) message.warning(`Não foi possível carregar: ${falhas.join(', ')}.`);
      else message.success(tipo === 'SUSPENSA' ? `Venda ${d.id} retomada.` : `Orçamento ${d.id} no carrinho.`);
      atualizarSuspensas();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao abrir.');
    }
  }, [carregarItens, selecionarCliente, setCliente, setEstagio, setMostrarModalCliente, atualizarSuspensas]);

  // Vindo de Vendas › Orçamentos (?orcamento=ID)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const idOrc = Number(searchParams.get('orcamento'));
    if (idOrc > 0) {
      setSearchParams({}, { replace: true });
      abrirPedido(idOrc, 'ORCAMENTO');
    }
    // Troca vinda de Vendas do Dia (?troca=ID da devolução): cliente e crédito gerado ficam disponíveis no pagamento
    const idTroca = Number(searchParams.get(CHAVE_TROCA));
    if (idTroca > 0) {
      setSearchParams({}, { replace: true });
      devolucoesService.detalhe(idTroca).then(d => {
        clearCart();
        if (d.idCliente) selecionarCliente({ id: d.idCliente, nome: d.cliente });
        else { selecionarCliente(null); if (d.cliente && d.cliente !== 'CONSUMIDOR') setCliente(d.cliente); }
        setMostrarModalCliente(false);
        setOrigemExterna({ origem: 'DEVOLUCAO', idOrigem: d.idDevolucao, rotulo: `Troca da venda ${d.idVenda}: crédito de ${money.format(d.valor)} disponível no pagamento (forma "Sinal")` });
      }).catch(e => message.error(e.message));
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Situação de crédito do cliente escolhido (dívida, vencidos, bloqueio)
  const situacaoCliente = useSituacaoCliente(clienteId);

  // Sem caixa aberto não se vende: F2/finalizar abrem o painel de abertura
  const { caixa, carregado: caixaCarregado } = useCaixa();
  const irParaPagamento = useCallback(() => {
    if (caixaCarregado && !caixa) { caixaStore.mostrar('abrir'); return; }
    setEstagio('PAGAMENTO');
  }, [caixa, caixaCarregado]);

  useEffect(() => {
    let acumulado = '';
    let ultimaTecla = Date.now();
    const aoTeclar = (e: KeyboardEvent) => {
      // Atalhos
      if (e.key === 'F2') { e.preventDefault(); if (cart.length > 0) irParaPagamento(); return; }
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
  }, [processarCodigo, cart.length, mostrarModalCliente, irParaPagamento]);

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
        <AvisoCaixaFechado />

        {/* Cabeçalho: cliente + busca + filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<UserOutlined />} onClick={() => setMostrarModalCliente(true)}>
              <span style={{ fontWeight: 600 }}>{cliente || 'Consumidor Final'}</span>
              {clienteId && clienteDocumento && <span style={{ color: '#64748b', marginLeft: 6, fontFamily: 'monospace', fontSize: 11 }}>{formatarDocumento(clienteDocumento)}</span>}
              <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>F4</span>
            </Button>
            {situacaoCliente && (situacaoCliente.emAberto > 0 || situacaoCliente.bloqueado) && (
              <Tooltip title={`${situacaoCliente.titulos.length} parcela(s) em aberto${situacaoCliente.limite !== null ? ` · limite R$ ${situacaoCliente.limite.toFixed(2)}, disponível R$ ${(situacaoCliente.disponivel ?? 0).toFixed(2)}` : ''}`}>
                <Tag color={situacaoCliente.bloqueado || situacaoCliente.qtdVencidas > 0 ? 'red' : 'gold'} style={{ margin: 0 }}>
                  {situacaoCliente.bloqueado ? 'Bloqueado a prazo · ' : ''}Deve R$ {situacaoCliente.emAberto.toFixed(2)}
                  {situacaoCliente.qtdVencidas > 0 ? ` · ${situacaoCliente.qtdVencidas} vencida(s)` : ''}
                </Tag>
              </Tooltip>
            )}
            <Space size={6}>
              {botoesModulos.map((Botao, i) => (
                <Suspense key={i} fallback={null}>
                  <Botao
                    adicionarItens={(linhas, opcoes) => carregarItens(
                      linhas.map(l => ({ ...l, ...(l.precoFixo !== undefined ? { precoFixo: l.precoFixo, precoTabelaFixa: l.precoFixo } : {}) })),
                      { acrescentar: !opcoes?.substituir }
                    )}
                    clienteId={clienteId}
                    cliente={cliente}
                    definirCliente={(c, nomeLivre) => {
                      if (c) selecionarCliente(c);
                      else { selecionarCliente(null); if (nomeLivre && nomeLivre !== 'CONSUMIDOR') setCliente(nomeLivre); }
                      setMostrarModalCliente(false);
                    }}
                    vincularOrigem={o => { setOrigemExterna(o); if (o) setOrcamentoAtual(null); }}
                  />
                </Suspense>
              ))}
              <Badge count={qtdSuspensas} size="small">
                <Button size="small" onClick={() => setDrawerPedidos('SUSPENSA')}>Suspensas</Button>
              </Badge>
              <Button size="small" onClick={() => setDrawerPedidos('ORCAMENTO')}>Orçamentos</Button>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>F2 finalizar · F3 buscar · F4 cliente</span>
            </Space>
          </div>
          {origemExterna && (
            <Alert type="info" showIcon style={{ padding: '2px 10px' }} message={origemExterna.rotulo}
              action={<Button size="small" type="link" onClick={() => setOrigemExterna(null)}>desvincular</Button>} />
          )}
          {orcamentoAtual && (
            <Alert type="info" showIcon style={{ padding: '2px 10px' }}
              message={<span>Vendendo o <b>orçamento Nº {orcamentoAtual.id}</b> · {orcamentoAtual.manterPreco ? 'preços do orçamento mantidos' : 'preços atuais do catálogo'}</span>}
              action={<Button size="small" type="link" onClick={() => setOrcamentoAtual(null)}>desvincular</Button>} />
          )}

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
        onFinalizar={irParaPagamento}
        onSuspender={suspender}
        onOrcamento={() => setModalOrcamento(true)}
        salvandoPedido={salvandoPedido}
        onBack={() => setEstagio('SELECAO')}
        estagio={estagio}
        applyIndividualDiscount={applyIndividualDiscount}
      />

      <aside className={styles.paymentSidebar}>
        <FinalizarVenda
          onBack={() => setEstagio('SELECAO')}
          onVendaConcluida={novaVenda}
          idOrcamento={orcamentoAtual?.id ?? null}
          manterPrecoOrcamento={Boolean(orcamentoAtual?.manterPreco)}
          adiantamentosOrigem={origemExterna ? { origem: origemExterna.origem, idOrigem: origemExterna.idOrigem } : null}
          total={total}
          cliente={cliente}
          clienteId={clienteId}
          itens={cart as any}
        />
      </aside>

      <ModalSalvarOrcamento aberto={modalOrcamento} cliente={cliente} total={total} salvando={salvandoPedido}
        onFechar={() => setModalOrcamento(false)} onSalvar={salvarOrcamento} />
      <DrawerPedidosAbertos aberto={drawerPedidos !== null} abaInicial={drawerPedidos || 'SUSPENSA'} carrinhoComItens={cart.length > 0}
        onFechar={() => setDrawerPedidos(null)} onAbrir={abrirPedido} onAlterado={atualizarSuspensas} />

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
