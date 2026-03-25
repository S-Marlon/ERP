import React, { useState, useEffect, useRef } from 'react';
import { usePricing } from './usePricing';
import { getProductById } from './service/productService'; 

interface PricingData {
  salePrice: number;
  markup: number;
  costPrice: number;
  unitsPerPackage: number;
}

interface Props {
  productId: number | string;
  onChange: (data: PricingData) => void;
}

const PricingCalculator: React.FC<Props> = ({ productId, onChange }) => {
  const [loading, setLoading] = useState(true);

const { 
    values, 
    setAllValues, 
    handleFieldChange: updatePrices, // Adicione o ": updatePrices" aqui
    unitCost 
  } = usePricing();


  const lastNotified = useRef("");

  // Busca dados da API
 useEffect(() => {
  let isMounted = true;
  const load = async () => {
    try {
      setLoading(true);
      const data = await getProductById(Number(productId));
      
      if (isMounted && data) {
       setAllValues({
  // O SQL retorna 'costPrice', então usamos 'data.costPrice'
  costPrice: Number(data.costPrice || 0), 
  
  // Verifique se no SQL você também não precisa renomear esses:
  markup: Number(data.markup_praticado || data.markup || 1),
  
  // 'unidades_por_pacote' não existe no seu SELECT SQL mostrado acima!
  // Se não estiver no SELECT, ele sempre será 1.
  unitsPerPackage: Number(data.unitsPerPackage || 1),
  
  salePrice: Number(data.preco_venda || 0)
});
      }
    } catch (err) { 
      console.error("Erro ao carregar precificação:", err); 
    } finally { 
      if (isMounted) setLoading(false); 
    }
  };
  load();
  return () => { isMounted = false; };
}, [productId, setAllValues]);

  // Envia para o pai APENAS se houver mudança real
 useEffect(() => {
  if (loading) return;
  const hash = `${values.salePrice}-${values.markup}-${values.costPrice}`;
  if (lastNotified.current !== hash) {
    lastNotified.current = hash;
    
    // Envia os dados formatados para o que o componente de formulário espera
    onChange({
      salePrice: values.salePrice,
      markup: values.markup, // O fieldMap da rota PUT cuidará de transformar em markup_praticado
      costPrice: values.costPrice,
      unitsPerPackage: values.unitsPerPackage
    });
  }
}, [values, loading, onChange]);

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>MODO FRACIONADO / UNIDADE</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
        <div className="field">
          <label style={labelStyle}>Itens na Embalagem</label>
          <input 
            type="number" 
            min="1"
            value={values.unitsPerPackage} 
            onChange={(e) => updatePrices('unitsPerPackage', Number(e.target.value))}
            style={{ ...inputStyle, backgroundColor: '#f1f5f9' }}
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Custo da NF (Total)</label>
          <input 
            type="number" 
            value={values.costPrice} 
            style={{ ...inputStyle, backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
            disabled
          />
        </div>
      </div>

      <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '15px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div className="field">
          <label style={labelStyle}>Margem (%)</label>
          <input 
            type="number" 
            value={values.margin} 
            onChange={(e) => updatePrices('margin', Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div className="field">
          <label style={labelStyle}>Markup (Fator)</label>
          <input 
            type="number" 
            step="0.01"
            value={values.markup} 
            onChange={(e) => updatePrices('markup', Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginTop: '15px' }}>
        <label style={{ ...labelStyle, color: '#2563eb' }}>Preço de Venda (por Unidade)</label>
        <input 
          type="number" 
          value={values.salePrice} 
          onChange={(e) => updatePrices('salePrice', Number(e.target.value))}
          style={{ ...inputStyle, fontSize: '1.1rem', fontWeight: 'bold', border: '2px solid #2563eb' }}
        />
      </div>

      <div style={{ marginTop: '15px', padding: '10px', background: '#0f172a', borderRadius: '8px', color: '#fff' }}>
        <div style={rowStyle}>
          <span style={{ opacity: 0.8 }}>Custo Unit. Calculado:</span>
          <span>R$ {unitCost.toFixed(2)}</span>
        </div>
        <div style={{ ...rowStyle, color: '#4ade80', marginTop: '4px', fontWeight: 'bold' }}>
          <span>Lucro Bruto/Unid:</span>
          <span>R$ {(values.salePrice - unitCost).toFixed(2)}</span>
        </div>
      </div>

      {values.unitsPerPackage > 1 && (
        <div style={{ marginTop: '10px', padding: '10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', fontSize: '0.75rem' }}>
          <p style={{ margin: 0, color: '#92400e' }}>
            💡 Venda total da embalagem ({values.unitsPerPackage} un): 
            <strong> R$ {(values.salePrice * values.unitsPerPackage).toFixed(2)}</strong>
          </p>
        </div>
      )}
    </div>
  );
};

// Estilos rápidos para o exemplo
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' };
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' };

export default PricingCalculator;