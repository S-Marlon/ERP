import React, { useEffect, useState } from 'react';
import { Card, Button, Input, InputNumber, Checkbox, Tag, Space, Typography, Row, Col, Divider, Tooltip, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, BarChartOutlined, InfoCircleOutlined, BulbOutlined, ArrowUpOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import ProductCommercialSalesConfig from '../../../Catalogo/pages/ProductPricingModule/ProductCommercialSalesConfig';

const { Title, Text } = Typography;

interface UnitSalesConfig {
  id: number;
  unitName: string; // Ex: Metro (MT), Rolo (RL)
  conversionFactor: number; // Ex: 1 Rolo = 50 metros
  markup: number;
  price: number;
  active: boolean;
  isDefault?: boolean;
  
  enableWholesale: boolean;
  wholesaleMinQty: number;
  wholesaleMarkup: number;
  wholesalePrice: number;
}

interface StepSalesConfigProps {
  item?: { custoBase?: number; unidadeBase?: string; nomeProduto?: string };
  initialUnits?: UnitSalesConfig[];
  onChange?: (units: UnitSalesConfig[]) => void;
}

export default function StepSalesConfig({ item, initialUnits, onChange }: StepSalesConfigProps) {
  const baseUnit = item?.unidadeBase || 'MT';
  const baseCost = item?.custoBase || 10.0; // Custo por unidade base (ex: R$ 10,00 o metro)

  const defaultUnits: UnitSalesConfig[] = [
    {
      id: 1,
      unitName: `Metro (${baseUnit})`,
      conversionFactor: 1,
      markup: 60,
      price: Number((baseCost * 1.6).toFixed(2)),
      active: true,
      isDefault: true,
      enableWholesale: false,
      wholesaleMinQty: 10,
      wholesaleMarkup: 40,
      wholesalePrice: Number((baseCost * 1.4).toFixed(2)),
    },
    {
      id: 2,
      unitName: `Rolo (RL)`,
      conversionFactor: 50, // 1 Rolo = 50 metros
      markup: 45,
      price: Number(((baseCost * 50) * 1.45).toFixed(2)),
      active: true,
      isDefault: false,
      enableWholesale: true,
      wholesaleMinQty: 3, // 3 rolos
      wholesaleMarkup: 30,
      wholesalePrice: Number(((baseCost * 50) * 1.30).toFixed(2)),
    }
  ];

  const [unitsConfig, setUnitsConfig] = useState<UnitSalesConfig[]>(
    initialUnits && initialUnits.length ? initialUnits : defaultUnits
  );

  const addNewUnit = () => {
    const newId = Date.now();
    setUnitsConfig(prev => [
      ...prev,
      {
        id: newId,
        unitName: `Embalagem #${prev.length + 1}`,
        conversionFactor: 1,
        markup: 50,
        price: 0,
        active: true,
        isDefault: false,
        enableWholesale: false,
        wholesaleMinQty: 5,
        wholesaleMarkup: 35,
        wholesalePrice: 0,
      }
    ]);
  };

  const removeUnit = (id: number) => {
    setUnitsConfig(prev => prev.filter(unit => unit.id !== id));
  };

  useEffect(() => {
    if (onChange) onChange(unitsConfig);
  }, [unitsConfig]);

  const updateUnit = (id: number, field: keyof UnitSalesConfig, value: any) => {
    setUnitsConfig(prev => prev.map(itemUnit => {
      if (itemUnit.id !== id) return itemUnit;

      const updated = { ...itemUnit, [field]: value };
      const absoluteCostOfUnit = baseCost * (updated.conversionFactor || 1);

      // Recalcula Varejo
      if (field === 'markup' || field === 'conversionFactor') {
        updated.price = Number((absoluteCostOfUnit * (1 + Number(updated.markup) / 100)).toFixed(2));
      }
      if (field === 'price') {
        const rawPrice = Number(value);
        updated.markup = absoluteCostOfUnit > 0 ? Number((((rawPrice - absoluteCostOfUnit) / absoluteCostOfUnit) * 100).toFixed(2)) : 0;
      }

      // Recalcula Atacado
      if (field === 'wholesaleMarkup' || field === 'conversionFactor') {
        updated.wholesalePrice = Number((absoluteCostOfUnit * (1 + Number(updated.wholesaleMarkup) / 100)).toFixed(2));
      }
      if (field === 'wholesalePrice') {
        const rawWPrice = Number(value);
        updated.wholesaleMarkup = absoluteCostOfUnit > 0 ? Number((((rawWPrice - absoluteCostOfUnit) / absoluteCostOfUnit) * 100).toFixed(2)) : 0;
      }

      return updated;
    }));
  };

  // --- INTELIGÊNCIA EXECUTIVA E INSIGHTS DO PAINEL ---
  const activeUnits = unitsConfig.filter(u => u.active);
  
  // Encontra a melhor margem de varejo e atacado para gerar insights inteligentes
  let bestMargin = -999;
  let bestOptionName = '';

  activeUnits.forEach(u => {
    const absCost = baseCost * u.conversionFactor;
    const retailMargin = absCost > 0 ? ((u.price - absCost) / u.price) * 100 : 0;
    if (retailMargin > bestMargin) {
      bestMargin = retailMargin;
      bestOptionName = `Varejo de ${u.unitName}`;
    }
    if (u.enableWholesale) {
      const wholesaleMargin = absCost > 0 ? ((u.wholesalePrice - absCost) / u.wholesalePrice) * 100 : 0;
      if (wholesaleMargin > bestMargin) {
        bestMargin = wholesaleMargin;
        bestOptionName = `Atacado de ${u.unitName} (Qtd ≥ ${u.wholesaleMinQty})`;
      }
    }
  });

  return (
    <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto' }}>

      {/* HEADER PRINCIPAL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 16, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Space size={8} style={{ marginBottom: 4 }}>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              Definição Estratégica de Preços, Embalagens e Atacado
            </Title>
            <Tag color="geekblue" style={{ fontWeight: 600 }}>Módulo Enterprise</Tag>
          </Space>
       
        </div>

{/* 
        <Button 
          type="primary" 
          size="large"
          icon={<PlusOutlined />} 
          onClick={addNewUnit}
          style={{ fontWeight: 600, borderRadius: 8, height: 44, paddingInline: 20, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)' }}
        >
          Adicionar Nova Embalagem / Formato
        </Button> */}
      </div>

        <ProductCommercialSalesConfig/> 


      {/* --- PAINEL DE INTELIGÊNCIA EXECUTIVA (COMPLETO) --- */}
      
      

      
    </div>
  );
}