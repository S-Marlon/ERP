// PDV (modelo novo): catálogo publicável com preço por unidade e atacado, leitor de código de barras,
// cliente do cadastro e carrinho/pagamento. A OS fica fora até existir no modelo novo.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Alert, Badge, Button, Drawer, Flex, FloatButton, Grid, Input, Modal, Select, Space, Switch, Tag, Tooltip, TreeSelect, Typography, message, theme } from 'antd';
import { SearchOutlined, ShoppingCartOutlined, UserOutlined } from '@ant-design/icons';
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
import { ListaProdutosPdv, ModoLista } from './components/ListaProdutosPdv';
import { ClientePdvModal, formatarDocumento } from './components/ClientePdvModal';
import { EquivalentesModal } from './components/EquivalentesPdv';
import type { ProdutoEquivalente } from './services/equivalentesPdvApi';
import { ItemPdvDrawer } from './components/ItemPdvDrawer';
import KitConfiguradorModal from './components/KitConfiguradorModal';
import { idItemDaLinha } from './types/cart.types';
import { linhasSemEstoque } from './utils/estoqueCarrinho';
import { AvisoCaixaFechado } from '../caixa/CaixaPainel';
import { caixaStore, useCaixa } from '../caixa/caixaStore';
import { useSituacaoCliente } from '../../financeiro/receber/receberApi';
import { imprimirOrcamento, pedidosAbertosApi } from './services/pedidosAbertosApi';
import { DadosOrcamento, DrawerPedidosAbertos, ModalSalvarOrcamento } from './components/PedidosAbertosPDV';
import { AberturaNegociacao, NegociacaoDrawer } from '../negociacao/NegociacaoDrawer';
import type { CondicaoPagamento } from '../negociacao/condicaoPagamento';
import { extensoesPdv } from '../../../modulos/registroModulos';
import { devolucoesService } from './services/salesService';
import { CHAVE_TROCA } from './components/ModalDevolucao';
import { useModulos } from '../../../modulos/modulosStore';
import { Suspense } from 'react';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

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
    cart, addToCart, updateQuantity, removeItem, changeUnit, applyIndividualDiscount, clearCart, carregarItens, aplicarAtacado,
    kitPendente, confirmarKit, cancelarKit, editarKit,
    estagio, setEstagio, cliente, setCliente, clienteId, clienteDocumento, selecionarCliente,
    mostrarModalCliente, setMostrarModalCliente,
    searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, brand, setBrand,
    sortOrder, setSortOrder, onlyInStock, setOnlyInStock,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
  } = usePDV();

  const { token } = theme.useToken();
  const [modoLista, setModoLista] = useState<ModoLista>('lista');
  const [recarga, setRecarga] = useState(0);
  const [mostrarNaoPublicaveis, setMostrarNaoPublicaveis] = useState(false);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [totalItens, setTotalItens] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [arvoreCategorias, setArvoreCategorias] = useState<CategoriaNo[]>([]);
  const [marcas, setMarcas] = useState<string[]>(['Todos']);
  const [itemDetalhe, setItemDetalhe] = useState<number | null>(null);
  const buscaRef = useRef<any>(null);
  const buscaDebounce = useDebounce(searchTerm, 400);

  // Nova venda começa pela identificação do cliente; vindo de um orçamento ou de uma troca o cliente vem deles
  // (sem isto o modal abria e sumia logo depois, quando o orçamento carregava)
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (url.get('orcamento') || url.get(CHAVE_TROCA)) return;
    if (!id && !cliente) setMostrarModalCliente(true);
  }, [id]);

  // ---------------------------------------------------------------- Orçamentos e vendas suspensas
  // Venda nascida de um orçamento (vai junto no envio; manterPreco = preços congelados do orçamento).
  // negociacao: proposta negociada (preços fechados com o cliente; sem desconto/acréscimo automático da forma)
  const [orcamentoAtual, setOrcamentoAtual] = useState<{ id: number; manterPreco: boolean; negociacao?: { texto: string | null; condicao: CondicaoPagamento | null } } | null>(null);
  const [drawerPedidos, setDrawerPedidos] = useState<null | 'SUSPENSA' | 'ORCAMENTO'>(null);
  const [modalOrcamento, setModalOrcamento] = useState(false);
  const [negociando, setNegociando] = useState<AberturaNegociacao | null>(null);
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [qtdSuspensas, setQtdSuspensas] = useState(0);
  const atualizarSuspensas = useCallback(() => {
    pedidosAbertosApi.listar('SUSPENSA').then(l => setQtdSuspensas(l.length)).catch(() => undefined);
  }, []);
  useEffect(() => { atualizarSuspensas(); }, [atualizarSuspensas]);

  const itensParaSalvar = () => cart
    .filter((i: any) => i.type !== 'service' && i.type !== 'os')
    .map((i: any) => ({
      idItem: idItemDaLinha(i), quantidade: Number(i.quantity), idUnidade: i.idUnidadeVenda ?? null, precoUnitario: i.precoManual ? Number(i.price) : undefined,
      // Atacado só se o operador aplicou
      ...(i.atacado ? {} : { semAtacado: true }),
      ...(i.kitEscolhas ? { componentes: i.kitEscolhas } : {}),
    }));

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

  const salvarOrcamento = async (dados: DadosOrcamento, clienteDoOrcamento?: { id: number; nome: string } | null) => {
    setSalvandoPedido(true);
    try {
      const r = await pedidosAbertosApi.salvar({
        tipo: 'ORCAMENTO', itens: itensParaSalvar(), ...dados,
        clienteNome: clienteDoOrcamento?.nome ?? cliente, idCliente: clienteDoOrcamento?.id ?? clienteId,
      });
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
      const negociado = tipo === 'ORCAMENTO' && d.margemAlvo !== null && d.margemAlvo !== undefined;
      const validade = String(d.validade).split('-').reverse().join('/');
      if (negociado && d.situacao === 'VALIDO') {
        // Proposta negociada: o preço é o combinado com o cliente, sem pergunta (trocar pelos atuais desfaria a negociação)
        manterPreco = true;
      } else if (negociado) {
        Modal.warning({
          title: `Proposta negociada Nº ${d.id} vencida (valia até ${validade})`,
          content: 'Os itens entram com os preços atuais do catálogo. Para vender pelos preços negociados, renove a validade: Vendas › Orçamentos › Negociar.',
        });
      } else if (tipo === 'ORCAMENTO' && d.situacao === 'VALIDO') {
        manterPreco = await new Promise<boolean>(resolve => Modal.confirm({
          title: `Orçamento Nº ${d.id} (válido até ${validade})`,
          content: 'O orçamento ainda vale: o normal é vender pelos preços que o cliente recebeu. Use os preços atuais só se combinou isso com ele.',
          okText: 'Manter preços do orçamento', cancelText: 'Usar preços atuais', closable: false,
          onOk: () => resolve(true), onCancel: () => resolve(false),
        }));
      } else if (tipo === 'ORCAMENTO') {
        message.info(`Orçamento ${d.id} vencido: os itens entram com os preços atuais.`);
      }
      const falhas = await carregarItens(d.itens.map(i => ({
        idItem: i.idItem, nome: i.nome, quantidade: i.quantidade, idUnidade: i.idUnidade, componentes: i.componentes, precoTabelaAnterior: i.precoTabela,
        // Orçamento mantido: preço congelado; suspensa: mantém só o desconto manual que havia
        ...(manterPreco
          ? { precoFixo: i.precoUnitario, precoTabelaFixa: i.precoTabela }
          : tipo === 'SUSPENSA' && i.precoUnitario < i.precoTabela - 0.004 ? { precoFixo: i.precoUnitario } : {}),
      })));
      if (d.idCliente) selecionarCliente({ id: d.idCliente, nome: d.cliente });
      else { selecionarCliente(null); if (d.cliente && d.cliente !== 'CONSUMIDOR') setCliente(d.cliente); }
      setOrcamentoAtual(tipo === 'ORCAMENTO'
        ? { id: d.id, manterPreco, ...(negociado && manterPreco ? { negociacao: { texto: d.condicaoPagamento ?? null, condicao: d.condicao ?? null } } : {}) }
        : null);
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
    // Vindo da ficha do cliente (?cliente=ID&nome=...): já escolhe o cliente para montar o orçamento ou a venda
    const idCli = Number(searchParams.get('cliente'));
    if (idCli > 0) {
      const nomeCli = searchParams.get('nome') || `Cliente ${idCli}`;
      setSearchParams({}, { replace: true });
      selecionarCliente({ id: idCli, nome: nomeCli, documento: searchParams.get('doc') || undefined });
      setMostrarModalCliente(false);
      message.info(`${nomeCli} escolhido: monte os itens e salve como orçamento (ou finalize a venda).`);
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
  }), [buscaDebounce, selectedCategory, brand, sortOrder, currentPage, itemsPerPage, onlyInStock, mostrarNaoPublicaveis, recarga]);

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

  // Equivalentes de um item da lista (sem estoque) e troca da linha do carrinho pelo equivalente escolhido
  const [equivalentesDe, setEquivalentesDe] = useState<{ idItem: number; nome: string } | null>(null);
  const trocarPorEquivalente = useCallback(async (linha: any, p: ProdutoEquivalente, trocar: boolean) => {
    if (trocar) removeItem(linha.id);
    const falhas = await carregarItens([{ idItem: Number(p.id), nome: p.name, quantidade: Number(linha.quantity) || 1, idUnidade: p.idUnidadeVenda ?? null }], { acrescentar: true });
    if (falhas.length) message.error(`Não foi possível carregar ${p.name}.`);
    else message.success(trocar ? `Trocado por ${p.name}.` : `${p.name} acrescentado.`);
  }, [removeItem, carregarItens]);

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
    // Item sem estoque fica no carrinho para orçamento, mas não vende: oferece salvar como orçamento
    const semEstoque = linhasSemEstoque(cart);
    if (semEstoque.length > 0) {
      Modal.confirm({
        title: 'Não dá para vender: falta estoque',
        width: 480,
        content: (
          <div>
            <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
              {semEstoque.map(({ item, falta }) => (
                <li key={item.id}>
                  {item.name}: {Number(item.stock) > 0
                    ? `há ${Number(item.stock).toLocaleString('pt-BR')}, faltam ${falta.toLocaleString('pt-BR')} ${item.unitOfMeasure || ''}`
                    : 'sem estoque'}
                </li>
              ))}
            </ul>
            Salve como orçamento, ou ajuste as quantidades (ou dê entrada no estoque) para vender.
          </div>
        ),
        okText: 'Salvar como orçamento',
        cancelText: 'Voltar ao carrinho',
        onOk: () => setModalOrcamento(true),
      });
      return;
    }
    if (caixaCarregado && !caixa) { caixaStore.mostrar('abrir'); return; }
    setEstagio('PAGAMENTO');
  }, [cart, caixa, caixaCarregado]);

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

  // Larguras: carrinho fixo ao lado da lista; janela estreita (ex.: meia tela) encolhe o carrinho e,
  // abaixo de md, ele vira gaveta. No pagamento a lista some e o pagamento ocupa o espaço dela.
  const telas = Grid.useBreakpoint();
  const carrinhoEmGaveta = !telas.md;
  const compacto = !telas.xl;
  const larguraCarrinho = telas.xxl ? 600 : telas.xl ? 500 : telas.lg ? 440 : 360;
  const [gavetaCarrinho, setGavetaCarrinho] = useState(false);
  const emPagamento = estagio === 'PAGAMENTO';
  // Transição seleção ⇄ pagamento: a lista encolhe e some enquanto o pagamento cresce (e o contrário)
  const transicao = 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
  const painel = (visivel: boolean): React.CSSProperties => ({
    flex: visivel ? '1 1 0' : '0 0 0px', opacity: visivel ? 1 : 0, minWidth: 0, overflow: 'hidden',
    transition: transicao, pointerEvents: visivel ? 'auto' : 'none',
  });
  useEffect(() => { if (emPagamento) setGavetaCarrinho(false); }, [emPagamento]);

  const carrinho = (estilo?: React.CSSProperties) => (
    <CartAside
      cart={cart}
      cliente={cliente}
      total={total}
      money={money}
      updateQuantity={updateQuantity}
      aplicarAtacado={aplicarAtacado}
      onEquivalente={trocarPorEquivalente}
      changeUnit={changeUnit}
      removeItem={removeItem}
      onFinalizar={() => { setGavetaCarrinho(false); irParaPagamento(); }}
      onSuspender={suspender}
      onOrcamento={() => setModalOrcamento(true)}
      onNegociar={() => setNegociando({
        itens: itensParaSalvar().map(i => ({ idItem: i.idItem, quantidade: i.quantidade, idUnidade: i.idUnidade, componentes: (i as any).componentes })),
        cliente: clienteId ? { id: clienteId, nome: cliente } : cliente && cliente !== 'CONSUMIDOR' ? { id: null, nome: cliente } : null,
      })}
      salvandoPedido={salvandoPedido}
      onBack={() => setEstagio('SELECAO')}
      estagio={estagio}
      applyIndividualDiscount={applyIndividualDiscount}
      onEditarKit={editarKit}
      negociado={Boolean(orcamentoAtual?.negociacao)}
      style={estilo}
    />
  );

  return (
    <Flex style={{ height: 'calc(100vh - 58px)', minHeight: 420, overflow: 'hidden' }}>
      <ClientePdvModal
        open={mostrarModalCliente}
        onSelecionar={c => { selecionarCliente(c); setTimeout(() => buscaRef.current?.focus(), 50); }}
        onFechar={() => { if (!cliente) selecionarCliente(null); else setMostrarModalCliente(false); }}
      />

      <Flex vertical gap={8} aria-hidden={emPagamento} style={{ ...painel(!emPagamento), marginRight: emPagamento ? 0 : 8 }}>
        <AvisoCaixaFechado />

        {/* Cabeçalho: cliente + ações + busca + filtros */}
        <Flex vertical gap={8} style={{ padding: '8px 10px', background: token.colorBgContainer, borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}` }}>
          <Flex justify="space-between" align="center" gap={8} wrap>
            <Flex align="center" gap={6} wrap style={{ minWidth: 0 }}>
              <Button icon={<UserOutlined />} onClick={() => setMostrarModalCliente(true)} style={{ maxWidth: '100%' }}>
                <Typography.Text strong ellipsis style={{ maxWidth: 220 }}>{cliente || 'Consumidor Final'}</Typography.Text>
                {clienteId && clienteDocumento && <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11 }}>{formatarDocumento(clienteDocumento)}</Typography.Text>}
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>F4</Typography.Text>
              </Button>
              {situacaoCliente && (situacaoCliente.emAberto > 0 || situacaoCliente.bloqueado) && (
                <Tooltip title={`${situacaoCliente.titulos.length} parcela(s) em aberto${situacaoCliente.limite !== null ? ` · limite R$ ${situacaoCliente.limite.toFixed(2)}, disponível R$ ${(situacaoCliente.disponivel ?? 0).toFixed(2)}` : ''}`}>
                  <Tag color={situacaoCliente.bloqueado || situacaoCliente.qtdVencidas > 0 ? 'red' : 'gold'} style={{ margin: 0 }}>
                    {situacaoCliente.bloqueado ? 'Bloqueado a prazo · ' : ''}Deve R$ {situacaoCliente.emAberto.toFixed(2)}
                    {situacaoCliente.qtdVencidas > 0 ? ` · ${situacaoCliente.qtdVencidas} vencida(s)` : ''}
                  </Tag>
                </Tooltip>
              )}
            </Flex>
            <Space size={6} wrap>
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
            </Space>
          </Flex>
          {origemExterna && (
            <Alert type="info" showIcon style={{ padding: '2px 10px' }} title={origemExterna.rotulo}
              action={<Button size="small" type="link" onClick={() => setOrigemExterna(null)}>desvincular</Button>} />
          )}
          {orcamentoAtual?.negociacao ? (
            <Alert type="warning" showIcon style={{ padding: '2px 10px' }}
              title={<span>Vendendo a <b>proposta negociada Nº {orcamentoAtual.id}</b> · preços combinados com o cliente
                {' · condição: '}<b>{orcamentoAtual.negociacao.texto || 'a combinar'}</b></span>} />
          ) : orcamentoAtual && (
            <Alert type="info" showIcon style={{ padding: '2px 10px' }}
              title={<span>Vendendo o <b>orçamento Nº {orcamentoAtual.id}</b> · {orcamentoAtual.manterPreco ? 'preços do orçamento mantidos' : 'preços atuais do catálogo'}</span>}
              action={<Button size="small" type="link" onClick={() => setOrcamentoAtual(null)}>desvincular</Button>} />
          )}

          <Input
            ref={buscaRef}
            size="large"
            allowClear
            autoFocus
            prefix={<SearchOutlined />}
            placeholder="Buscar por nome, SKU, código de barras ou medida (F3)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          <Flex gap={8} wrap align="center">
            <TreeSelect
              style={{ flex: '1 1 200px', minWidth: 0, maxWidth: 320 }}
              treeData={arvoreCategorias}
              value={selectedCategory && selectedCategory !== 'Todas' ? selectedCategory : undefined}
              onChange={v => setSelectedCategory(v || 'Todas')}
              placeholder="Todas as categorias"
              allowClear
              showSearch
              treeNodeFilterProp="title"
              treeDefaultExpandAll
              popupMatchSelectWidth={false}
            />
            <Select
              style={{ flex: '1 1 140px', minWidth: 0, maxWidth: 220 }}
              value={brand}
              onChange={setBrand}
              options={marcas.map(m => ({ value: m, label: m === 'Todos' ? 'Todas as marcas' : m }))}
              showSearch
              popupMatchSelectWidth={false}
            />
            <Space size={4}><Switch size="small" checked={onlyInStock} onChange={setOnlyInStock} /> Em estoque</Space>
            <Tooltip title="Provisório: inclui itens que ainda não passam na regra de publicação (ficha incompleta, família bloqueada...)">
              <Space size={4}><Switch size="small" checked={mostrarNaoPublicaveis} onChange={setMostrarNaoPublicaveis} /> Não publicáveis</Space>
            </Tooltip>
            {temFiltros && <Button size="small" onClick={limparFiltros}>Limpar filtros</Button>}
          </Flex>
        </Flex>

        <ListaProdutosPdv
          produtos={produtos}
          total={totalItens}
          carregando={carregando}
          busca={searchTerm}
          pagina={currentPage}
          porPagina={itemsPerPage}
          ordem={sortOrder}
          modo={modoLista}
          compacto={compacto}
          onModo={setModoLista}
          onPagina={(pagina, porPagina) => {
            if (porPagina !== itemsPerPage) { setItemsPerPage(porPagina); setCurrentPage(1); } else setCurrentPage(pagina);
          }}
          onOrdem={ordem => { setSortOrder(ordem); setCurrentPage(1); }}
          onAtualizar={() => setRecarga(n => n + 1)}
          onIncluir={p => incluir(p)}
          onDetalhe={setItemDetalhe}
          onEquivalentes={p => setEquivalentesDe({ idItem: Number(p.id), nome: p.name })}
        />
        <EquivalentesModal alvo={equivalentesDe} onFechar={() => setEquivalentesDe(null)}
          onEscolher={p => { incluir(p); setEquivalentesDe(null); message.success(`${p.name} no carrinho.`); }} />
      </Flex>

      {/* Carrinho: coluna fixa ou gaveta (janela estreita). No pagamento em janela estreita, só o pagamento aparece. */}
      {!carrinhoEmGaveta && carrinho({ flex: `0 0 ${larguraCarrinho}px`, width: larguraCarrinho })}
      {carrinhoEmGaveta && !emPagamento && (
        <FloatButton
          type="primary"
          icon={<ShoppingCartOutlined />}
          badge={{ count: cart.length }}
          tooltip={`Carrinho · ${money.format(total)}`}
          onClick={() => setGavetaCarrinho(true)}
        />
      )}
      <Drawer
        open={carrinhoEmGaveta && gavetaCarrinho}
        onClose={() => setGavetaCarrinho(false)}
        size={Math.min(420, window.innerWidth - 24)}
        closable={false}
        styles={{ body: { padding: 0, display: 'flex' } }}
      >
        {carrinho({ flex: 1, border: 'none', borderRadius: 0 })}
      </Drawer>

      <div aria-hidden={!emPagamento} style={{
        ...painel(emPagamento), marginLeft: emPagamento && !carrinhoEmGaveta ? 8 : 0,
        borderRadius: token.borderRadiusLG, border: emPagamento ? `1px solid ${token.colorBorderSecondary}` : 'none',
      }}>
        <FinalizarVenda
          ativo={emPagamento}
          onBack={() => setEstagio('SELECAO')}
          onVendaConcluida={novaVenda}
          idOrcamento={orcamentoAtual?.id ?? null}
          manterPrecoOrcamento={Boolean(orcamentoAtual?.manterPreco)}
          negociacao={orcamentoAtual?.negociacao ?? null}
          adiantamentosOrigem={origemExterna ? { origem: origemExterna.origem, idOrigem: origemExterna.idOrigem } : orcamentoAtual ? { origem: 'ORCAMENTO', idOrigem: orcamentoAtual.id } : null}
          total={total}
          cliente={cliente}
          clienteId={clienteId}
          itens={cart as any}
        />
      </div>

      <ModalSalvarOrcamento aberto={modalOrcamento} cliente={cliente} clienteId={clienteId} total={total} salvando={salvandoPedido}
        onFechar={() => setModalOrcamento(false)} onSalvar={salvarOrcamento} />
      <NegociacaoDrawer abrir={negociando} onFechar={() => setNegociando(null)}
        onSalvo={(id, total) => {
          setNegociando(null);
          novaVenda();
          Modal.confirm({
            title: `Orçamento Nº ${id} salvo`,
            content: `Total ${money.format(total)}. Ele fica em Vendas › Orçamentos (dá para renegociar e vender depois).`,
            okText: 'Imprimir a proposta', cancelText: 'Fechar',
            onOk: async () => imprimirOrcamento(await pedidosAbertosApi.detalhe(id)),
          });
        }} />
      <DrawerPedidosAbertos aberto={drawerPedidos !== null} abaInicial={drawerPedidos || 'SUSPENSA'} carrinhoComItens={cart.length > 0}
        onFechar={() => setDrawerPedidos(null)} onAbrir={abrirPedido} onAlterado={atualizarSuspensas} />

      <KitConfiguradorModal pendente={kitPendente} onConfirmar={confirmarKit} onCancelar={cancelarKit} />

      <ItemPdvDrawer
        idItem={itemDetalhe}
        onClose={() => setItemDetalhe(null)}
        onAdicionar={(p, idUnidade) => { incluir(p, idUnidade); message.success(`${p.name} adicionado.`); }}
      />
    </Flex>
  );
};

const PDV: React.FC = () => (
  <PDVProvider>
    <PDVContent />
  </PDVProvider>
);

export default PDV;
export { PDVContent };
