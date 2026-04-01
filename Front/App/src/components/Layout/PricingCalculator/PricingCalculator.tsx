import React, { useState, useEffect, useRef } from 'react';
import { usePricing } from './usePricing';
import { getProductById } from './service/productService'; 

// Dados que vêm do pai ou da NF
interface PricingInputData {
  costPrice: number;            // ✅ custo total da NF
  markup?: number;              // opcional
  margin?: number;              // opcional, % (apenas referência)
  salePrice?: number;           // opcional
  unitsPerPackage?: number;     // opcional, para cálculo unitário
}

// Dados que serão enviados para o pai
interface PricingData {
  salePrice: number;            // preço unitário
  markup: number;               // fator
  costPrice: number;            // custo total da NF
  unitsPerPackage: number;      // unidades do pacote (para cálculo unitário)
  priceMethod?: 'MARKUP' | 'MANUAL'; // modo de cálculo
}

// Props do componente
interface Props {
  productId?: number | string;          // opcional, caso não seja NF
  initialData?: PricingInputData;       // dados iniciais da NF ou do produto
  onChange: (data: PricingData) => void;
}

const PricingCalculator: React.FC<Props> = ({ productId, initialData, onChange }) => {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'MANUAL' | 'MARKUP'>('MARKUP');

  const { 
    values, 
    setAllValues, 
    handleFieldChange: updatePrices, 
    unitCost 
  } = usePricing();

  const lastNotified = useRef("");

  // Wrapper para capturar alterações e atualizar o modo
  const handleChange = (field: keyof typeof values, value: number) => {
    updatePrices(field, value);

    if (field === 'salePrice') setMode('MANUAL');
    else if (field === 'markup' || field === 'margin') setMode('MARKUP');
  };

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);

        // 🟢 MODO NF: inicializa com dados da nota fiscal
        if (initialData) {
          setAllValues({
            costPrice: Number(initialData.costPrice || 0), // total da NF
            markup: Number(initialData.markup || 1),
            unitsPerPackage: Number(initialData.unitsPerPackage || 1), // para custo unitário
            salePrice: Number(initialData.salePrice || 0),
          });
          initializedRef.current = true;
          return;
        }

        // 🔵 MODO Produto: busca no cadastro
        if (productId) {
          const data = await getProductById(Number(productId));
          if (isMounted && data) {
            setAllValues({
              costPrice: Number(data.costPrice || 0),               // total do cadastro
              markup: Number(data.markup_praticado || data.markup || 1),
              unitsPerPackage: Number(data.unitsPerPackage || 1),   // para custo unitário
              salePrice: Number(data.preco_venda || 0),
            });
            setMode(data.priceMethod || 'MARKUP');
            initializedRef.current = true;
          }
        }

      } catch (err) {
        console.error("Erro ao carregar precificação:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [productId, initialData, setAllValues]);

  // Envia dados atualizados para o pai
  useEffect(() => {
    if (loading) return;
    const hash = `${values.salePrice}-${values.markup}-${values.costPrice}-${mode}`;
    if (lastNotified.current !== hash) {
      lastNotified.current = hash;
      onChange({
        salePrice: values.salePrice,
        markup: values.markup,
        costPrice: values.costPrice,
        unitsPerPackage: values.unitsPerPackage,
        priceMethod: mode,
      });
    }
  }, [values, loading, mode, onChange]);

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
      
      {/* Indicador de Modo */}
      <div style={{ marginBottom: '12px', fontWeight: 600, color: mode === 'MANUAL' ? '#2563eb' : '#16a34a' }}>
        MODO: {mode}
      </div>

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
            onChange={(e) => handleChange('unitsPerPackage', Number(e.target.value))}
            style={{ ...inputStyle, backgroundColor: '#f1f5f9' }}
          />
        </div>

        <div className="field">
          <label style={labelStyle}>Custo da NF (Total)</label>
          <input 
            type="number" 
            value={values.costPrice} 
            onChange={(e) => handleChange('costPrice', Number(e.target.value))}
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
            onChange={(e) => handleChange('margin', Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <div className="field">
          <label style={labelStyle}>Markup (Fator)</label>
          <input 
            type="number" 
            step="0.01"
            value={values.markup} 
            onChange={(e) => handleChange('markup', Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginTop: '15px' }}>
        <label style={{ ...labelStyle, color: '#2563eb' }}>Preço de Venda (por Unidade)</label>
        <input 
          type="number" 
          value={values.salePrice} 
          onChange={(e) => handleChange('salePrice', Number(e.target.value))}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '1.1rem' }}>💡</span>
                                    <div style={{ fontSize: '0.7rem', color: '#92400e', lineHeight: '1.4' }}>
                                        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            Projeção para o Conjunto  un):
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            • Valor total do pacote: <strong>R$ </strong>
                                        </p>
                                        <p style={{ margin: 0 }}>
                                            • Lucro total no pacote: <strong>R$ </strong>
                                        </p>
                                        <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', fontSize: '0.65rem', borderTop: '1px solid #fde68a', paddingTop: '4px' }}>
                                            O cálculo considera o custo real processado com impostos da NF.
                                        </p>
                                    </div>
                                </div>
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