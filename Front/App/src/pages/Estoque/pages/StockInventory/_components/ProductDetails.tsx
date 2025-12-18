import React from 'react';
import { Product } from '../../../../../types/types';

interface ProductDetailsProps {
  product?: Product | null;
  onEdit?: (p: Product) => void;
}

const ProductDetails: React.FC<ProductDetailsProps> = ({ product, onEdit }) => {
  if (!product) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: '#6b7280' }}>👉 Selecione um produto na tabela para ver seus detalhes.</p>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8, color: '#6b7280' }}>{product.name}</h3>
      <p style={{ margin: 0, color: '#6b7280' }}>{product.sku} • {product.category}</p>

      <div style={{ marginTop: 12, display: 'grid', gap: 8, color: '#374151' }}>
        <div><strong>Estoque atual:</strong> {product.currentStock}</div>
        <div><strong>Estoque mínimo:</strong> {product.minStock}</div>
        <div><strong>Preço:</strong> {formatCurrency(product.salePrice)}</div>
        <div><strong>Status:</strong> <span style={{ color: product.status === 'Ativo' ? '#065f46' : '#374151' }}>{product.status}</span></div>
        <div><strong>Fornecedor:</strong> {product.fornecedor || '—'}</div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => onEdit?.(product)}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#e01919ff',
            cursor: 'pointer'
          }}
        >
          Editar
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(String(product.id))}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: 'none',
            background: '#29239fff',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          Copiar ID
        </button>
      </div>
    </div>
  );
};

export default ProductDetails;