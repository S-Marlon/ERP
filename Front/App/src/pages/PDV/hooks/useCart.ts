// hooks/useCart.ts
import { useState, useEffect, useCallback } from 'react';
import { CartItem, SaleItem, isCartItemOS } from '../types/cart.types';
import Swal from 'sweetalert2';
import { getPdvProductDetail } from '../services/api/products';
import { podeFracionar, precoTabelaCarrinho, UnidadeCarrinho } from '../utils/precoCarrinho';

// Produto do catálogo (vem do servidor com unidades e faixas); serviço e OS ficam fora dessa regra
const ehProduto = (item: { type?: string }) => item.type !== 'service' && item.type !== 'os';

const unidadeAtual = (item: CartItem): UnidadeCarrinho | undefined =>
  item.unidades?.find(u => u.idUnidade === item.idUnidadeVenda);

// Reaplica o preço de tabela (faixa de varejo/atacado) para a unidade e quantidade da linha.
// Com desconto manual, o preço praticado fica e só a referência de tabela muda.
const reprecificar = (item: CartItem): CartItem => {
  const unidade = unidadeAtual(item);
  if (!unidade) return item;
  const tabela = precoTabelaCarrinho(unidade, item.quantity);
  if (item.precoManual) return { ...item, precoTabela: tabela, originalPrice: tabela };
  return { ...item, precoTabela: tabela, price: tabela, originalPrice: undefined };
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

  return {
    cart,
    addToCart,
    updateQuantity,
    changeUnit,
    removeItem,
    applyIndividualDiscount,
    clearCart
  };
};
