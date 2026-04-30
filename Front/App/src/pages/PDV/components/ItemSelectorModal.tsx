import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CartItem } from '../types/cart.types';
import { getPdvProducts, getPdvCategories } from '../services/api/products';
import styles from './ItemSelectorModal.module.css';

interface ItemSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: CartItem) => void;
  title?: string;
  money: Intl.NumberFormat;
}

export const ItemSelectorModal: React.FC<ItemSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Adicionar Item',
  money
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<{ [key: string]: number }>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Carregar categorias ao abrir
  useEffect(() => {
    if (!isOpen) return;

    const loadCategories = async () => {
      try {
        const data = await getPdvCategories('parts');
        setCategories(['Todas', ...data]);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
        setCategories(['Todas']);
      }
    };

    loadCategories();
    searchInputRef.current?.focus();
  }, [isOpen]);

  // Buscar produtos
  useEffect(() => {
    if (!isOpen) return;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getPdvProducts({
          searchTerm: searchTerm || undefined,
          category: category !== 'Todas' ? category : undefined,
          limit: 50,
          page: 1
        });

        if (response?.data) {
          const formattedItems: CartItem[] = response.data.map(p => ({
            id: p.id,
            name: p.name,
            category: p.category || '',
            price: Number(p.salePrice) || 0,
            costPrice: Number(p.costPrice) || 0,
            type: 'product',
            quantity: 1,
            sku: p.sku,
            unitOfMeasure: p.unitOfMeasure,
            stock: Number(p.currentStock) || 0,
            pictureUrl: p.pictureUrl,
            status: p.status
          }));

          setProducts(formattedItems);
        }
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        setError('Erro ao carregar produtos. Tente novamente.');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchProducts, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, category, isOpen]);

  // Atualizar quantidade
  const handleQuantityChange = useCallback((productId: string | number, value: number) => {
    setSelectedQuantity(prev => ({
      ...prev,
      [productId]: Math.max(0.1, value)
    }));
  }, []);

  // Selecionar produto
  const handleSelectProduct = useCallback((product: CartItem) => {
    const quantity = selectedQuantity[product.id] || 1;
    
    onSelect({
      ...product,
      quantity
    });

    setSelectedQuantity(prev => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });
  }, [selectedQuantity, onSelect]);

  // Renderização do modal
  if (!isOpen) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalContent}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Controles de busca */}
        <div className={styles.searchControls}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar por SKU, EAN, nome..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={category || 'Todas'}
            onChange={e => setCategory(e.target.value === 'Todas' ? undefined : e.target.value)}
            className={styles.categorySelect}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {searchTerm && (
            <button
              className={styles.clearBtn}
              onClick={() => setSearchTerm('')}
              title="Limpar busca"
            >
              ✕ Limpar
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className={styles.resultsList}>
          {error && (
            <div className={styles.errorMessage}>
              ⚠️ {error}
            </div>
          )}

          {loading && (
            <div className={styles.loadingMessage}>
              ⏳ Carregando produtos...
            </div>
          )}

          {!loading && !error && products.length === 0 && searchTerm && (
            <div className={styles.emptyMessage}>
              📭 Nenhum produto encontrado para "{searchTerm}"
            </div>
          )}

          {!loading && !error && products.length === 0 && !searchTerm && (
            <div className={styles.emptyMessage}>
              🔍 Digite para buscar produtos
            </div>
          )}

          {!loading && products.length > 0 && (
            <div className={styles.itemsGrid}>
              {products.map(product => (
                <div key={product.id} className={styles.productCard}>
                  {/* Imagem */}
                  {product.pictureUrl && (
                    <img
                      src={product.pictureUrl}
                      alt={product.name}
                      className={styles.productImage}
                    />
                  )}

                  {/* Info */}
                  <div className={styles.productInfo}>
                    <strong className={styles.productName}>{product.name}</strong>
                    <small className={styles.productSku}>SKU: {product.sku || 'N/A'}</small>
                    
                    <div className={styles.productMeta}>
                      <span className={`${styles.stock} ${(product.stock || 0) < 5 ? styles.lowStock : ''}`}>
                        Estoque: {product.stock || 0} {product.unitOfMeasure || 'un'}
                      </span>
                      <span className={styles.category}>{product.category}</span>
                    </div>

                    <div className={styles.priceSection}>
                      <strong className={styles.price}>{money.format(product.price)}</strong>
                      <small className={styles.costPrice}>
                        Custo: {money.format(product.costPrice || 0)}
                      </small>
                    </div>
                  </div>

                  {/* Quantidade + Botão */}
                  <div className={styles.productActions}>
                    <div className={styles.quantityControl}>
                      <button
                        onClick={() => handleQuantityChange(
                          product.id,
                          (selectedQuantity[product.id] || 1) - 0.1
                        )}
                        disabled={(selectedQuantity[product.id] || 1) <= 0.1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={(selectedQuantity[product.id] || 1).toFixed(2)}
                        onChange={e => handleQuantityChange(product.id, parseFloat(e.target.value))}
                        className={styles.quantityInput}
                      />
                      <button
                        onClick={() => handleQuantityChange(
                          product.id,
                          (selectedQuantity[product.id] || 1) + 1
                        )}
                        disabled={(product.stock ?? 0) > 0 && (selectedQuantity[product.id] || 1) >= (product.stock ?? 0)}
                      >
                        +
                      </button>
                    </div>

                    <button
                      className={styles.addBtn}
                      onClick={() => handleSelectProduct(product)}
                      disabled={(product.stock || 0) === 0}
                      title={product.stock === 0 ? 'Sem estoque' : 'Adicionar à OS'}
                    >
                      ✓ Adicionar
                    </button>
                  </div>

                  {/* Badge de sem estoque */}
                  {product.stock === 0 && (
                    <div className={styles.outOfStockBadge}>
                      Sem estoque
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <p className={styles.infoText}>
            💡 Encontrados {products.length} produtos
          </p>
          <button
            className={styles.closeModalBtn}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
