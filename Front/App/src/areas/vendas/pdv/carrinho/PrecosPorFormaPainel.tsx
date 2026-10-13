// Quadro do carrinho: quanto fica à vista (PIX/dinheiro/débito, com o desconto da forma) e no cartão
// (sem juros e com juros, com o valor da parcela), para o operador falar o preço certo ao cliente.
import React, { useEffect, useState } from 'react';
import { Flex, Select, Tag, Tooltip, Typography, theme } from 'antd';
import { useTaxasVenda } from '../../taxas/taxasVenda';
import { precosPorForma } from '../utils/precoPorForma';

interface Props { total: number; money: Intl.NumberFormat }

export const PrecosPorFormaPainel: React.FC<Props> = ({ total, money }) => {
  const { token } = theme.useToken();
  const cfg = useTaxasVenda();
  const precos = precosPorForma(cfg, total);
  const [parcelas, setParcelas] = useState<number | null>(null);
  const maximo = precos?.comJuros.length ? precos.comJuros[precos.comJuros.length - 1].parcelas : null;
  useEffect(() => { if (parcelas === null && maximo) setParcelas(maximo); }, [maximo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!precos) return null;

  // Formas com o mesmo desconto aparecem juntas (ex.: "PIX / Dinheiro")
  const grupos: Array<{ rotulo: string; valor: number; pct: number }> = [];
  for (const o of precos.aVista) {
    const g = grupos.find(x => Math.abs(x.pct - o.pct) < 0.005);
    if (g) g.rotulo = `${g.rotulo} / ${o.rotulo}`;
    else grupos.push({ rotulo: o.rotulo, valor: o.valor, pct: o.pct });
  }
  const escolhida = precos.comJuros.find(p => p.parcelas === parcelas) || precos.comJuros[precos.comJuros.length - 1];
  const linha = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 } as const;

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: token.borderRadius, background: token.colorFillTertiary, border: `1px solid ${token.colorBorderSecondary}` }}>
      {grupos.length > 0 && (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>À vista</Typography.Text>
          {grupos.map((g, i) => (
            <div key={g.rotulo} style={linha}>
              <Typography.Text style={{ fontSize: i === 0 ? 13 : 12 }}>
                {g.rotulo} <Tag color="green" style={{ marginInlineStart: 4, fontSize: 10 }}>-{g.pct.toFixed(1).replace('.', ',')}%</Tag>
              </Typography.Text>
              <Typography.Text strong style={{ fontSize: i === 0 ? 18 : 13, color: token.colorSuccess, whiteSpace: 'nowrap' }}>{money.format(g.valor)}</Typography.Text>
            </div>
          ))}
        </>
      )}
      <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginTop: grupos.length ? 6 : 0 }}>Cartão de crédito</Typography.Text>
      <div style={linha}>
        <Typography.Text style={{ fontSize: 12 }}>
          {precos.semJuros.parcelas > 1 ? `até ${precos.semJuros.parcelas}x sem juros` : 'à vista no crédito'}
          {precos.semJuros.parcelas > 1 && <Typography.Text type="secondary" style={{ fontSize: 12 }}> · {precos.semJuros.parcelas}x {money.format(precos.semJuros.parcela)}</Typography.Text>}
        </Typography.Text>
        <Typography.Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{money.format(precos.semJuros.valor)}</Typography.Text>
      </div>
      {escolhida && (
        <div style={{ ...linha, marginTop: 2 }}>
          <Flex gap={4} align="center">
            <Select size="small" value={escolhida.parcelas} onChange={setParcelas} popupMatchSelectWidth={false} style={{ width: 72 }}
              options={precos.comJuros.map(p => ({ value: p.parcelas, label: `${p.parcelas}x` }))} />
            <Tooltip title={`Acima de ${precos.semJuros.parcelas}x: acréscimo pela taxa da maquininha em ${escolhida.parcelas}x`}>
              <Typography.Text style={{ fontSize: 12, color: token.colorWarning }}>
                {money.format(escolhida.parcela)} <span style={{ fontSize: 11 }}>(+{escolhida.acrescimoPct.toFixed(1).replace('.', ',')}%)</span>
              </Typography.Text>
            </Tooltip>
          </Flex>
          <Typography.Text strong style={{ fontSize: 13, color: token.colorWarning, whiteSpace: 'nowrap' }}>{money.format(escolhida.valor)}</Typography.Text>
        </div>
      )}
    </div>
  );
};
