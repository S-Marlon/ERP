// hooks/useCart.ts
import { useState, useEffect, useCallback } from 'react';
import { CartItem, SaleItem, isCartItemOS } from '../types/cart.types';
import Swal from 'sweetalert2';
import { getPdvProductDetail } from '../services/api/products';
import { podeFracionar, precoTabelaCarrinho, UnidadeCarrinho } from '../utils/precoCarrinho';
import { calcularKit, chaveLinhaKit, EscolhaKitPdv, escolhasPadrao, PosicaoKit } from '../utils/kitPdv';
import { opcoesDoKit } from '../services/kitsPdvApi';
import type { KitPendente } from '../components/KitConfiguradorModal';

// Produto do catálogo (vem do servidor com unidades e faixas); serviço e OS ficam fora dessa regra
const ehProduto = (item: { type?: string }) => item.type !== 'service' && item.type !== 'os';

const unidadeAtual = (item: CartItem): UnidadeCarrinho | undefined =>
  item.unidades?.find(u => u.idUnidade === item.idUnidadeVenda);

// Reaplica o preço de tabela (faixa de varejo/atacado) para a unidade e quantidade da linha.
// Com desconto manual, o preço praticado fica e só a referência de tabela muda.
const reprecificar = (item: CartItem): CartItem => {
  const unidade = unidadeAtual(item);
  if (!unidade) return item;
  // Kit configurável: tabela do kit + diferença das trocas (por kit na unidade base, convertida para a unidade da linha)
  const tabela = Math.max(0, Math.round((precoTabelaCarrinho(unidade, item.quantity) + (item.ajusteKit || 0) * (unidade.fator || 1)) * 10000) / 10000);
  if (item.precoManual) return { ...item, precoTabela: tabela, originalPrice: tabela };
  return { ...item, precoTabela: tabela, price: tabela, originalPrice: undefined };
};

/** Linha de kit configurável a partir da linha padrão e das escolhas do cliente. */
const montarLinhaKit = (base: CartItem, posicoes: PosicaoKit[], escolhas: EscolhaKitPdv[]): CartItem => {
  const idKit = Number(base.idItemCatalogo ?? base.id);
  const c = calcularKit(posicoes, escolhas);
  const fator = Number(base.fatorConversao) || 1;
  return reprecificar({
    ...base,
    id: chaveLinhaKit(idKit, escolhas),
    idItemCatalogo: idKit,
    kitEscolhas: escolhas,
    kitPosicoes: posicoes,
    ajusteKit: c.ajuste,
    kitResumo: c.resumo,
    stock: c.estoque === null ? base.stock : Math.floor(c.estoque / fator),
    podeVenderSemEstoque: c.estoque === null ? true : Boolean(base.podeVenderSemEstoque && c.estoque === null),
  });
};

const lerCarrinhoSalvo = (): CartItem[] => {
  try {
    const saved = localStorage.getItem('pdv-cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>(lerCarrinhoSalvo);
  // Kit configurável esperando a escolha das variações (tela KitConfiguradorModal)
  const [kitPendente, setKitPendente] = useState<(KitPendente & { base: CartItem; substituir?: string | number }) | null>(null);

  useEffect(() => {
    try { localStorage.setItem('pdv-cart', JSON.stringify(cart)); } catch { /* armazenamento indisponível */ }
  }, [cart]);

  const addToCart = useCallback(async (item: SaleItem) => {
    if (!ehProduto(item) || !item.id) {
      // Serviço
      setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) return prev.map(i => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
        return [...prev, { ...item, quantity: 1 }];
      });
      return;
    }

    try {
      const productData: any = await getPdvProductDetail(item.id);
      if (!productData) {
        Swal.fire('Produto não encontrado', `Não foi possível carregar "${item.name}".`, 'error');
        return;
      }

      if (productData.currentStock <= 0 && !productData.podeVenderSemEstoque) {
        Swal.fire('Sem estoque', `"${item.name}" está sem estoque.`, 'warning');
        return;
      }

      // Provisório: itens fora da regra de publicação só entram com confirmação
      if (productData.publicavel === false) {
        const { isConfirmed } = await Swal.fire({
          icon: 'warning',
          title: 'Item não publicável',
          html: `"${item.name}" ainda não passa na regra de publicação:<br><small>${(productData.motivosPublicacao || []).join('<br>')}</small>`,
          showCancelButton: true,
          confirmButtonText: 'Adicionar mesmo assim',
          cancelButtonText: 'Cancelar',
        });
        if (!isConfirmed) return;
      }

      const unidades: UnidadeCarrinho[] = Array.isArray(productData.unidades) ? productData.unidades : [];
      // Unidade da linha: a do item bipado (GTIN da embalagem) ou a sugerida pelo servidor
      const idUnidade = item.idUnidadeVenda ?? productData.idUnidadeVenda ?? unidades[0]?.idUnidade ?? null;
      const unidade = unidades.find(u => u.idUnidade === idUnidade);

      // Kit com itens trocáveis: abre a escolha antes de entrar no carrinho
      if (productData.kitConfiguravel) {
        const posicoes = await opcoesDoKit(Number(item.id));
        const base = reprecificar({
          ...item, type: 'product', quantity: 1, sku: productData.sku || item.sku, stock: unidade ? unidade.estoque : productData.currentStock,
          costPrice: productData.costPrice || 0, price: unidade ? unidade.preco : productData.salePrice,
          unitOfMeasure: unidade?.sigla || productData.unitOfMeasure || item.unitOfMeasure, idUnidadeVenda: idUnidade,
          fatorConversao: unidade?.fator || productData.fatorConversao || 1, unidades, podeVenderSemEstoque: productData.podeVenderSemEstoque,
          publicavel: productData.publicavel, precoManual: false, idItemCatalogo: Number(item.id),
        } as CartItem);
        setKitPendente({ nome: productData.name || item.name, precoKit: base.precoTabela ?? base.price, posicoes, base });
        return;
      }

      setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) {
          return prev.map(i => {
            if (i.id !== item.id) return i;
            const quantity = i.quantity + 1;
            if (!i.podeVenderSemEstoque && i.stock !== undefined && quantity > i.stock) {
              Swal.fire('Estoque insuficiente', `Só há ${i.stock} ${i.unitOfMeasure || ''} de "${i.name}".`, 'warning');
              return i;
            }
            return reprecificar({ ...i, quantity });
          });
        }
        const novo: CartItem = {
          ...item,
          type: 'product',
          quantity: 1,
          sku: productData.sku || item.sku,
          stock: unidade ? unidade.estoque : productData.currentStock,
          costPrice: productData.costPrice || 0,
          price: unidade ? unidade.preco : productData.salePrice,
          unitOfMeasure: unidade?.sigla || productData.unitOfMeasure || item.unitOfMeasure,
          idUnidadeVenda: idUnidade,
          fatorConversao: unidade?.fator || productData.fatorConversao || 1,
          unidades,
          podeVenderSemEstoque: productData.podeVenderSemEstoque,
          publicavel: productData.publicavel,
          precoManual: false,
        };
        return [...prev, reprecificar(novo)];
      });
    } catch (err) {
      console.error('Erro ao validar produto:', err);
      Swal.fire('Erro', 'Não foi possível consultar o produto no servidor.', 'error');
    }
  }, []);

  const updateQuantity = useCallback((id: string | number, value: number | string) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (isCartItemOS(item)) {
        console.warn('Não é permitido alterar quantidade de Ordem de Serviço');
        return item;
      }

      let newQty = typeof value === 'string' ? parseFloat(value.replace(',', '.')) || 0 : Number(value);
      newQty = Math.max(0, newQty);
      if (!podeFracionar(item.unitOfMeasure)) newQty = Math.floor(newQty);

      if (ehProduto(item) && !item.podeVenderSemEstoque && item.stock !== undefined && newQty > item.stock) {
        Swal.fire('Estoque insuficiente', `Só há ${item.stock} ${item.unitOfMeasure || ''} de "${item.name}".`, 'warning');
        return item;
      }
      return reprecificar({ ...item, quantity: Number(newQty.toFixed(3)) });
    }));
  }, []);

  // Troca a unidade de venda da linha (ex.: metro -> rolo); o desconto manual é desfeito porque a tabela muda
  const changeUnit = useCallback((id: string | number, idUnidade: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const unidade = item.unidades?.find(u => u.idUnidade === idUnidade);
      if (!unidade) return item;
      let quantity = podeFracionar(unidade.sigla) ? item.quantity : Math.max(1, Math.floor(item.quantity));
      if (!item.podeVenderSemEstoque && quantity > unidade.estoque) quantity = Math.max(0, Math.floor(unidade.estoque));
      return reprecificar({
        ...item,
        idUnidadeVenda: unidade.idUnidade,
        unitOfMeasure: unidade.sigla,
        fatorConversao: unidade.fator,
        stock: unidade.estoque,
        quantity,
        precoManual: false,
      });
    }));
  }, []);

  /** Confirma as escolhas do kit: entra no carrinho (mesma configuração soma 1) ou substitui a linha editada. */
  const confirmarKit = useCallback((escolhas: EscolhaKitPdv[]) => {
    if (!kitPendente) return;
    const linha = montarLinhaKit(kitPendente.base, kitPendente.posicoes, escolhas);
    if (!linha.podeVenderSemEstoque && linha.stock !== undefined && linha.quantity > linha.stock) {
      Swal.fire('Estoque insuficiente', `Dá para montar só ${linha.stock} kit(s) com essas escolhas.`, 'warning');
      return;
    }
    setCart(prev => {
      const semEditada = kitPendente.substituir !== undefined ? prev.filter(i => i.id !== kitPendente.substituir) : prev;
      const igual = semEditada.find(i => i.id === linha.id);
      if (igual) return semEditada.map(i => (i.id === linha.id ? reprecificar({ ...i, quantity: i.quantity + linha.quantity }) : i));
      if (kitPendente.substituir === undefined) return [...semEditada, linha];
      // Editada: fica no mesmo lugar da lista
      const pos = prev.findIndex(i => i.id === kitPendente.substituir);
      const copia = [...semEditada];
      copia.splice(Math.max(0, pos), 0, linha);
      return copia;
    });
    setKitPendente(null);
  }, [kitPendente]);

  const cancelarKit = useCallback(() => setKitPendente(null), []);

  /** Reabre a escolha das variações de uma linha de kit do carrinho. */
  const editarKit = useCallback((id: string | number) => {
    const linha = cart.find(i => i.id === id);
    if (!linha?.kitPosicoes) return;
    const fator = Number(linha.fatorConversao) || 1;
    setKitPendente({
      nome: linha.name,
      precoKit: (linha.precoTabela ?? linha.price) - (linha.ajusteKit || 0) * fator,
      posicoes: linha.kitPosicoes,
      escolhas: linha.kitEscolhas,
      base: { ...linha, precoManual: false },
      substituir: id,
    });
  }, [cart]);

  const removeItem = useCallback((id: string | number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const applyIndividualDiscount = useCallback((id: string | number, newPrice: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id !== id) return item;
      if (isCartItemOS(item)) {
        Swal.fire({
          icon: 'error',
          title: 'Operação inválida',
          text: 'Não é permitido aplicar desconto em Ordens de Serviço',
          timer: 2000
        });
        return item;
      }
      const tabela = item.precoTabela ?? item.originalPrice ?? item.price;
      // Voltar ao preço de tabela remove o desconto manual
      if (newPrice >= tabela) return { ...item, price: tabela, originalPrice: undefined, precoManual: false };
      return { ...item, originalPrice: tabela, price: newPrice, precoManual: true };
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  /**
   * Recoloca itens no carrinho (venda suspensa retomada ou orçamento convertido): busca cada produto no
   * servidor (unidades, faixas, estoque). Com `precoFixo`, o preço da linha fica congelado (preço do orçamento).
   * Devolve os nomes que não puderam ser carregados.
   */
  const carregarItens = useCallback(async (
    linhas: Array<{ idItem: number; nome: string; quantidade: number; idUnidade: number | null; precoFixo?: number; precoTabelaFixa?: number; unidadeBase?: boolean; componentes?: EscolhaKitPdv[] }>,
    opcoes: { acrescentar?: boolean } = {}
  ) => {
    const novos: CartItem[] = [];
    const falhas: string[] = [];
    for (const l of linhas) {
      try {
        const productData: any = await getPdvProductDetail(l.idItem);
        if (!productData) { falhas.push(l.nome); continue; }
        const unidades: UnidadeCarrinho[] = Array.isArray(productData.unidades) ? productData.unidades : [];
        // unidadeBase: a unidade de estoque (fator 1), ex.: metro da mangueira na montagem
        const unidade = (l.unidadeBase ? unidades.find(u => Number(u.fator) === 1) : undefined)
          || unidades.find(u => u.idUnidade === l.idUnidade) || unidades.find(u => u.idUnidade === productData.idUnidadeVenda) || unidades[0];
        let item: CartItem = {
          id: l.idItem,
          name: productData.name || l.nome,
          type: 'product',
          quantity: l.quantidade,
          sku: productData.sku,
          stock: unidade ? unidade.estoque : productData.currentStock,
          costPrice: productData.costPrice || 0,
          price: unidade ? unidade.preco : productData.salePrice,
          unitOfMeasure: unidade?.sigla || productData.unitOfMeasure,
          idUnidadeVenda: unidade?.idUnidade ?? null,
          fatorConversao: unidade?.fator || 1,
          unidades,
          podeVenderSemEstoque: productData.podeVenderSemEstoque,
          publicavel: productData.publicavel,
          precoManual: false,
        } as CartItem;
        item = reprecificar(item);
        // Kit configurável (orçamento/suspensa): remonta com as escolhas gravadas
        if (productData.kitConfiguravel || l.componentes?.length) {
          const posicoes = await opcoesDoKit(l.idItem);
          item = montarLinhaKit({ ...item, idItemCatalogo: l.idItem }, posicoes, l.componentes?.length ? l.componentes : escolhasPadrao(posicoes));
        }
        if (l.precoFixo !== undefined) {
          item = { ...item, price: l.precoFixo, precoTabela: l.precoTabelaFixa ?? l.precoFixo, originalPrice: l.precoTabelaFixa ?? l.precoFixo, precoManual: true };
        }
        novos.push(item);
      } catch {
        falhas.push(l.nome);
      }
    }
    if (!opcoes.acrescentar) {
      setCart(novos);
      return falhas;
    }
    // Acrescentar (ex.: montagem): soma na linha do mesmo item; se a linha estiver em outra unidade,
    // converte pela unidade base (ex.: 2 MT somados numa linha em RL de 50 MT = +0,04 RL)
    setCart(prev => {
      const proximo = [...prev];
      for (const n of novos) {
        const i = proximo.findIndex(x => x.id === n.id);
        if (i < 0) { proximo.push(n); continue; }
        const fatorNovo = Number(n.fatorConversao) || 1;
        const fatorLinha = Number(proximo[i].fatorConversao) || 1;
        const somar = proximo[i].idUnidadeVenda === n.idUnidadeVenda ? n.quantity : (n.quantity * fatorNovo) / fatorLinha;
        proximo[i] = reprecificar({ ...proximo[i], quantity: Number((proximo[i].quantity + somar).toFixed(3)) });
      }
      return proximo;
    });
    return falhas;
  }, []);

  return {
    cart,
    addToCart,
    updateQuantity,
    changeUnit,
    removeItem,
    applyIndividualDiscount,
    clearCart,
    carregarItens,
    kitPendente,
    confirmarKit,
    cancelarKit,
    editarKit,
  };
};
