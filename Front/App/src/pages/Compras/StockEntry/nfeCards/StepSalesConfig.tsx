import React, { useEffect, useState } from 'react';

interface SalesMode {
  id: number;
  name: string;
  unit: string;
  conversion: number;
  markup: number;
  price: number;
  active: boolean;
  isDefault?: boolean;
}

interface StepSalesConfigProps {
  item: { custo?: number; unidadeMedida?: string };
  initialModes?: SalesMode[];
  onChange?: (modes: SalesMode[]) => void;
}

export default function StepSalesConfig({ item, initialModes, onChange }: StepSalesConfigProps) {
  const baseUnit = item?.unidadeMedida || 'UN';

  const defaultMode: SalesMode = {
    id: 1,
    name: `Embalagem Padrão NF (${baseUnit})`,
    unit: baseUnit,
    conversion: 1,
    markup: 50,
    price: Number(((item?.custo || 0) * 1.5).toFixed(2)),
    active: true,
    isDefault: true,
  };

  const [salesModes, setSalesModes] = useState<SalesMode[]>(initialModes && initialModes.length ? initialModes : [defaultMode]);

  // Função para adicionar um novo fracionamento em branco
  const addFractionedMode = () => {
    const newId = Date.now(); // Garante um ID único
    setSalesModes(prev => [
      ...prev,
      {
        id: newId,
        name: `Fracionamento #${prev.length}`,
        unit: 'MT',
        conversion: 100,
        markup: 50,
        price: Number(((item?.custo || 0) / 100 * 1.5).toFixed(2)),
        active: true,
        isDefault: false
      }
    ]);
  };

  // Função para remover um fracionamento específico
  const removeMode = (id) => {
    setSalesModes(prev => {
      const filtered = prev.filter(mode => mode.id !== id);
      
      // Regra de segurança: Se o usuário removeu um fracionamento ativo e não sobrou nenhum ativo,
      // força a Embalagem Padrão (id: 1) a ficar ativa novamente.
      const hasActive = filtered.some(m => m.active);
      if (!hasActive) {
        return filtered.map(m => m.id === 1 ? { ...m, active: true } : m);
      }
      
      return filtered;
    });
  };

  // Propagate changes to parent when salesModes change
  useEffect(() => {
    if (onChange) onChange(salesModes);
  }, [salesModes]);

  // Função para atualizar os campos
  const updateMode = (id, field, value) => {
    setSalesModes(prev => {
      // Regra de segurança para a Ativação/Desativação
      if (field === 'active' && value === false) {
        const activeCount = prev.filter(m => m.active).length;
        
        // Se este é o único modo ativo na tela e o usuário tentou desativar:
        if (activeCount <= 1) {
          // Se for um fracionamento sendo desativado, o padrão da nota ASSUME a ativação automaticamente
          if (id !== 1) {
            return prev.map(mode => {
              if (mode.id === 1) return { ...mode, active: true }; // Padrão assume
              if (mode.id === id) return { ...mode, active: false }; // O atual desativa
              return mode;
            });
          }
          // Se for o da nota sendo desativado e não há mais nada, não deixa desativar
          return prev;
        }
      }

      // Se o usuário estiver ATIVANDO um modo, prossegue normalmente
      return prev.map(mode => {
        if (mode.id !== id) return mode;
        
        const updated = { ...mode, [field]: value };
        const baseCost = item?.custo || 0;
        const proportionalCost = baseCost / (updated.conversion || 1);

        // Recalcula o Preço se o Markup ou Conversão mudarem
        if (field === 'markup' || field === 'conversion') {
          updated.price = Number((proportionalCost * (1 + Number(updated.markup) / 100)).toFixed(2));
        }
        // Recalcula o Markup se o Preço mudar
        if (field === 'price') {
          updated.markup = proportionalCost > 0 ? Number((((Number(value) - proportionalCost) / proportionalCost) * 100).toFixed(2)) : 0;
        }

        return updated;
      });
    });
  };

  return (
    <div className="step-content" style={{ fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: '#1e293b' }}>Como este produto será vendido na ponta?</h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Ative a unidade padrão ou adicione fracionamentos customizados. Pelo menos 1 modo deve estar ativo.
          </p>
        </div>
        
        <button 
          onClick={addFractionedMode}
          style={{
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
          }}
        >
          ➕ Adicionar Fracionamento
        </button>
      </div>

      {/* Grid de Formas de Venda */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {salesModes.map((mode) => {
          const baseCost = item.custo || 0;
          const propCost = mode.conversion > 0 ? baseCost / mode.conversion : 0;
          const totalRevenue = mode.price * mode.conversion;
          const totalProfit = totalRevenue - baseCost;
          const realMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

          return (
            <div 
              key={mode.id} 
              style={{ 
                background: '#ffffff', 
                border: mode.active ? '1px solid #e2e8f0' : '1px dashed #cbd5e1', 
                borderRadius: '12px', 
                padding: '18px',
                boxShadow: mode.active ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: mode.active ? 1 : 0.6,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={mode.active}
                      onChange={(e) => updateMode(mode.id, 'active', e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600', color: mode.active ? '#334155' : '#94a3b8' }}>
                      {mode.name}
                    </span>
                  </label>
                  
                  {!mode.isDefault ? (
                    <button 
                      onClick={() => removeMode(mode.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
                      title="Remover fracionamento"
                    >
                      🗑️
                    </button>
                  ) : (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      Padrão da Nota
                    </span>
                  )}
                </div>

                {/* Inputs de Configuração */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Unidade de Venda</label>
                    <input 
                      type="text"
                      disabled={!mode.active || mode.isDefault}
                      value={mode.unit}
                      maxLength={3}
                      onChange={(e) => updateMode(mode.id, 'unit', e.target.value.toUpperCase())}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: (mode.active && !mode.isDefault) ? '#fff' : '#f8fafc', fontWeight: '600' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Fator Divisor (Partes)</label>
                    <input 
                      type="number" 
                      disabled={!mode.active || mode.isDefault}
                      value={mode.conversion}
                      onChange={(e) => updateMode(mode.id, 'conversion', Math.max(1, Number(e.target.value)))}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: (mode.active && !mode.isDefault) ? '#fff' : '#f8fafc' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Custo Proporcional</label>
                    <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
                      R$ {propCost.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Markup (%)</label>
                    <input 
                      type="number" 
                      disabled={!mode.active}
                      value={Math.round(mode.markup)}
                      onChange={(e) => updateMode(mode.id, 'markup', Number(e.target.value))}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: mode.active ? '#fff' : '#f8fafc' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>Preço de Venda Final (por {mode.unit})</label>
                    <input 
                      type="number" 
                      disabled={!mode.active}
                      step="0.01"
                      value={mode.price.toFixed(2)}
                      onChange={(e) => updateMode(mode.id, 'price', Number(e.target.value))}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontWeight: 'bold', fontSize: '1.05rem', color: mode.active ? '#0f172a' : '#94a3b8', background: mode.active ? '#fff' : '#f8fafc' }}
                    />
                  </div>
                </div>
              </div>

              {/* Resumo Financeiro Comparativo */}
             {mode.active ? (
  <div 
    style={{ 
      background: totalProfit >= 0 ? '#f0fdf4' : '#fef2f2', 
      border: `1px solid ${totalProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, 
      borderRadius: '8px', 
      padding: '12px'
    }}
  >
    {/* Nova linha: Lucro Unitário/Fracionado */}
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '6px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '6px' }}>
      <span>Ganho por unidade ({mode.unit}):</span>
      <span style={{ fontWeight: '600', color: (mode.price - propCost) >= 0 ? '#166534' : '#991b1b' }}>
        R$ {(mode.price - propCost).toFixed(2)}
      </span>
    </div>

    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '6px' }}>
      <span>Arrecadação no Volume Total:</span>
      <span style={{ fontWeight: '600' }}>R$ {totalRevenue.toFixed(2)}</span>
    </div>
    
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: totalProfit >= 0 ? '#166534' : '#991b1b' }}>
        💰 Lucro Real Total: R$ {totalProfit.toFixed(2)}
      </span>
      <span style={{ fontSize: '0.75rem', background: totalProfit >= 0 ? '#dcfce7' : '#fee2e2', color: totalProfit >= 0 ? '#15803d' : '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
        {realMargin.toFixed(1)}% Margem
      </span>
    </div>
  </div>
) : (
  <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0', color: '#94a3b8', fontSize: '0.85rem' }}>
    🚫 Esta modalidade de venda está desativada.
  </div>
)}
            </div>
          );
        })}
      </div>
    </div>
  );
}