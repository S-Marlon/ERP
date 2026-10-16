// "De onde vem o lucro": o preço repartido em tarifa, frete, custo e lucro, numa barra só. Mostra de cara o que está
// comendo a margem. Com prejuízo, o que passa do preço aparece em vermelho no fim da barra.
import React from 'react';
import { Flex, Tooltip, Typography } from 'antd';
import { formatarMoeda } from './mercadoLivreApi';

const { Text } = Typography;

export interface PartesLucro { preco: number; tarifa: number; frete: number; custo: number; lucro: number }

const CORES = { tarifa: '#fa8c16', frete: '#faad14', custo: '#8c8c8c', lucro: '#52c41a', prejuizo: '#ff4d4f' };

const CascataLucro: React.FC<{ partes: PartesLucro; detalheTarifa?: string; detalheFrete?: string; detalheCusto?: string }> = ({ partes, detalheTarifa, detalheFrete, detalheCusto }) => {
  const { preco, tarifa, frete, custo, lucro } = partes;
  const total = Math.max(preco, tarifa + frete + custo, 0.01);   // com prejuízo, os custos passam do preço
  const pct = (v: number) => `${Math.max(0, (v / total) * 100)}%`;
  const dePreco = (v: number) => (preco > 0 ? `${((v / preco) * 100).toFixed(0)}% do preço` : '');
  const segmentos = [
    { chave: 'tarifa', rotulo: 'Tarifa do ML', valor: tarifa, cor: CORES.tarifa, dica: detalheTarifa },
    { chave: 'frete', rotulo: 'Frete', valor: frete, cor: CORES.frete, dica: detalheFrete },
    { chave: 'custo', rotulo: 'Custo do item', valor: custo, cor: CORES.custo, dica: detalheCusto },
    lucro >= 0
      ? { chave: 'lucro', rotulo: 'Lucro', valor: lucro, cor: CORES.lucro, dica: undefined }
      : { chave: 'prejuizo', rotulo: 'Prejuízo', valor: -lucro, cor: CORES.prejuizo, dica: 'O que falta: os custos passam do preço' },
  ];
  return (
    <div>
      {/* a barra do preço (com prejuízo ela estica até onde os custos chegam, e a régua marca o preço) */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', background: '#f0f0f0' }}>
          {segmentos.map(s => s.valor > 0 && (
            <Tooltip key={s.chave} title={`${s.rotulo}: ${formatarMoeda(s.valor)} (${dePreco(s.valor)})${s.dica ? ` · ${s.dica}` : ''}`}>
              <div style={{ width: pct(s.valor), background: s.cor, minWidth: 2 }} />
            </Tooltip>
          ))}
        </div>
        {lucro < 0 && <div title="preço" style={{ position: 'absolute', top: -4, bottom: -4, left: pct(preco), borderLeft: '2px dashed #262626' }} />}
      </div>
      <Flex wrap gap={14} style={{ marginTop: 8 }}>
        <span><Text type="secondary" style={{ fontSize: 12 }}>Preço</Text> <Text strong>{formatarMoeda(preco)}</Text></span>
        {segmentos.map(s => (
          <span key={s.chave} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.cor, display: 'inline-block' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>{s.chave === 'lucro' || s.chave === 'prejuizo' ? '=' : '−'} {s.rotulo}</Text>
            <Text strong style={{ color: s.chave === 'prejuizo' ? '#cf1322' : s.chave === 'lucro' ? '#389e0d' : undefined }}>{formatarMoeda(s.chave === 'prejuizo' ? -s.valor : s.valor)}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{dePreco(s.valor)}</Text>
          </span>
        ))}
      </Flex>
    </div>
  );
};

export default CascataLucro;
