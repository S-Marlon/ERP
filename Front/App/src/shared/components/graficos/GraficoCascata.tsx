// Cascata horizontal: uma linha por passo (receita, deduções, subtotais, resultado). A dedução sai de onde a linha
// anterior parou; subtotal e resultado recomeçam do zero. Passe o mouse na linha para o detalhe.
import React from 'react';
import { Flex, Tooltip, Typography } from 'antd';
import { barrasDaCascata, TipoCascata } from './cascata';

const { Text } = Typography;

export interface LinhaCascata { chave: string; rotulo: string; tipo: TipoCascata; valor: number; pct?: number | null; detalhe?: React.ReactNode }

const COR: Record<TipoCascata, string> = { RECEITA: '#52c41a', DEDUCAO: '#ff7875', SUBTOTAL: '#4096ff', RESULTADO: '#1677ff' };

const GraficoCascata: React.FC<{ linhas: LinhaCascata[]; formatar: (v: number) => string }> = ({ linhas, formatar }) => {
  const { barras, min, max } = barrasDaCascata(linhas);
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div>
      {linhas.map((l, i) => {
        const b = barras[i];
        const [a, z] = [pos(Math.min(b.de, b.ate)), pos(Math.max(b.de, b.ate))];
        const forte = l.tipo === 'SUBTOTAL' || l.tipo === 'RESULTADO';
        const cor = l.tipo === 'RESULTADO' && l.valor < 0 ? '#cf1322' : COR[l.tipo];
        return (
          <Tooltip key={l.chave} title={l.detalhe} placement="left">
            <Flex align="center" gap={8} style={{ padding: '3px 0', borderTop: forte ? '1px solid #f0f0f0' : undefined }}>
              <Text strong={forte} style={{ width: 210, flexShrink: 0, fontSize: 13 }} ellipsis>{l.rotulo}</Text>
              <div style={{ position: 'relative', flex: 1, height: forte ? 18 : 14, background: '#fafafa', borderRadius: 3 }}>
                <div style={{ position: 'absolute', left: `${pos(0)}%`, top: -2, bottom: -2, width: 1, background: '#d9d9d9' }} />
                <div style={{ position: 'absolute', left: `${a}%`, width: `${Math.max(0.4, z - a)}%`, top: 0, bottom: 0, background: cor, borderRadius: 3, opacity: forte ? 1 : 0.85 }} />
              </div>
              <Text strong={forte} style={{ width: 110, textAlign: 'right', flexShrink: 0, color: l.valor < 0 && forte ? '#cf1322' : undefined }}>{formatar(l.valor)}</Text>
              <Text type="secondary" style={{ width: 52, textAlign: 'right', flexShrink: 0, fontSize: 12 }}>
                {l.pct !== null && l.pct !== undefined ? `${l.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}
              </Text>
            </Flex>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default GraficoCascata;
