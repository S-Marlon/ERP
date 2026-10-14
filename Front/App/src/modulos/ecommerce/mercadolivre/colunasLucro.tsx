// Colunas de lucro no ML (tarifa, frete, você recebe, custo, lucro, % sobre o custo, preço para o alvo e situação),
// usadas na lista por anúncio, nos itens de cada anúncio e na visão por item. Todas ordenáveis.
import React from 'react';
import { Button, Popconfirm, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FinanceiroItem, formatarMoeda } from './mercadoLivreApi';
import { precoComercial } from './listaAnuncios';

const { Text } = Typography;

/** Situação do lucro em relação ao alvo (mesmos níveis da análise de preço do anúncio). */
export const SITUACAO_LUCRO: Record<string, { texto: string; cor: string; dica: string }> = {
  PREJUIZO: { texto: 'Prejuízo', cor: 'red', dica: 'Você recebe menos do que o item custa.' },
  BAIXO: { texto: 'Abaixo do alvo', cor: 'orange', dica: 'Dá lucro, mas abaixo da margem alvo.' },
  BOM: { texto: 'No alvo', cor: 'green', dica: 'Lucro dentro da margem alvo.' },
  ALTO: { texto: 'Acima do alvo', cor: 'blue', dica: 'Bem acima da margem alvo: talvez dê para baixar o preço e vender mais.' },
  SEM_CUSTO: { texto: 'Sem custo', cor: 'default', dica: 'O item não tem custo no ERP: lance o custo para saber o lucro.' },
};
const ORDEM: Record<string, number> = { PREJUIZO: 0, BAIXO: 1, SEM_CUSTO: 2, BOM: 3, ALTO: 4 };

export const TagSituacao: React.FC<{ nivel: string; alvoPct?: number }> = ({ nivel, alvoPct }) => (
  <Tooltip title={`${SITUACAO_LUCRO[nivel].dica}${alvoPct !== undefined ? ` Alvo: ${alvoPct}% sobre o custo.` : ''}`}>
    <Tag color={SITUACAO_LUCRO[nivel].cor} style={{ marginRight: 0 }}>{SITUACAO_LUCRO[nivel].texto}</Tag>
  </Tooltip>
);

const cinza = (v: number) => <Text type="secondary">{v ? `−${formatarMoeda(v)}` : '—'}</Text>;
const num = (v: number | null | undefined) => (v === null || v === undefined ? -Infinity : v);

/**
 * Colunas de lucro de uma linha. `fin` acha os números da linha; `onAplicarPreco` (opcional) faz da coluna
 * "Para o alvo" um botão que grava o preço sugerido.
 */
export function colunasLucro<T>(
  fin: (linha: T) => FinanceiroItem | undefined,
  op: { onAplicarPreco?: (linha: T, preco: number) => void; compacto?: boolean; aplicarVaiAoRascunho?: boolean } = {},
): ColumnsType<T> {
  const ordenar = (k: (f: FinanceiroItem) => number) => (a: T, b: T) => num(fin(a) && k(fin(a)!)) - num(fin(b) && k(fin(b)!));
  const colunas: ColumnsType<T> = [
    { title: 'Tarifa', width: 88, align: 'right', sorter: ordenar(f => f.tarifa), render: (_, l) => (fin(l) ? cinza(fin(l)!.tarifa) : null) },
    {
      title: <Tooltip title="Frete grátis que você paga por envio (sem frete grátis abaixo de R$ 79, o comprador paga)">Frete</Tooltip>, width: 88, align: 'right',
      sorter: ordenar(f => f.frete),
      render: (_, l) => { const f = fin(l); if (!f) return null; return f.freteDesconhecido ? <Tooltip title="Item sem peso no cadastro"><Text type="warning">?</Text></Tooltip> : cinza(f.frete); },
    },
    { title: 'Você recebe', width: 104, align: 'right', sorter: ordenar(f => f.recebe), render: (_, l) => (fin(l) ? <Text strong>{formatarMoeda(fin(l)!.recebe)}</Text> : null) },
    { title: 'Custo', width: 92, align: 'right', sorter: ordenar(f => f.custo), render: (_, l) => (fin(l) ? cinza(fin(l)!.custo) : null) },
    {
      title: 'Lucro', width: 96, align: 'right', sorter: ordenar(f => f.lucro),
      render: (_, l) => { const f = fin(l); return f ? <Text strong style={{ color: f.lucro < 0 ? '#cf1322' : '#389e0d' }}>{formatarMoeda(f.lucro)}</Text> : null; },
    },
    {
      title: <Tooltip title="Lucro sobre o custo do ERP (o alvo é medido assim)">% s/ custo</Tooltip>, width: 96, align: 'right', sorter: ordenar(f => f.lucroSobreCustoPct ?? -Infinity),
      render: (_, l) => {
        const f = fin(l);
        if (!f || f.lucroSobreCustoPct === null) return f ? <Text type="secondary">—</Text> : null;
        return (
          <div style={{ lineHeight: 1.2 }}>
            <Text strong style={{ color: f.lucroSobreCustoPct < 0 ? '#cf1322' : f.lucroSobreCustoPct < f.alvoPct ? '#d46b08' : '#389e0d' }}>{f.lucroSobreCustoPct.toFixed(1).replace('.', ',')}%</Text>
            {!op.compacto && <div><Text type="secondary" style={{ fontSize: 11 }}>alvo {f.alvoPct}%</Text></div>}
          </div>
        );
      },
    },
    {
      title: <Tooltip title="Preço sugerido (final ,90) para chegar no alvo, já com tarifa e frete do ML. Passe o mouse para ver o mínimo exato.">Para o alvo</Tooltip>,
      width: 120, align: 'right', sorter: ordenar(f => (f.precoAlvo === null ? -Infinity : precoComercial(f.precoAlvo) - f.preco)),
      render: (_, l) => {
        const f = fin(l);
        if (!f || f.precoAlvo === null) return f ? <Text type="secondary">—</Text> : null;
        const sugerido = precoComercial(f.precoAlvo);
        const dif = sugerido - f.preco;
        if (Math.abs(dif) < 0.005) return <Text type="secondary">no preço</Text>;
        const texto = (
          <div style={{ lineHeight: 1.2 }}>
            <Text strong>{formatarMoeda(sugerido)}</Text>
            <div><Text style={{ fontSize: 11, color: dif > 0 ? '#d46b08' : '#1677ff' }}>{dif > 0 ? '+' : '−'}{formatarMoeda(Math.abs(dif))}</Text></div>
          </div>
        );
        if (!op.onAplicarPreco) return <Tooltip title={`Mínimo exato: ${formatarMoeda(f.precoAlvo)}`}>{texto}</Tooltip>;
        return (
          <Popconfirm
            title={`Mudar o preço para ${formatarMoeda(sugerido)}?`}
            description={<div style={{ maxWidth: 280 }}>Dá {f.alvoPct}% ou mais sobre o custo (mínimo exato {formatarMoeda(f.precoAlvo)}). {op.aplicarVaiAoRascunho ? 'Vai para as alterações: grava ao salvar.' : 'Grava e envia ao ML.'}</div>}
            okText={op.aplicarVaiAoRascunho ? 'Usar este preço' : 'Mudar o preço'} onConfirm={() => op.onAplicarPreco!(l, sugerido)}
          >
            <Button type="text" size="small" style={{ height: 'auto', padding: '2px 4px' }}>{texto}</Button>
          </Popconfirm>
        );
      },
    },
    {
      title: 'Situação', width: 128, sorter: (a, b) => (ORDEM[fin(a)?.nivel ?? ''] ?? 9) - (ORDEM[fin(b)?.nivel ?? ''] ?? 9),
      render: (_, l) => { const f = fin(l); return f ? <TagSituacao nivel={f.nivel} alvoPct={f.alvoPct} /> : null; },
    },
  ];
  return colunas;
}
