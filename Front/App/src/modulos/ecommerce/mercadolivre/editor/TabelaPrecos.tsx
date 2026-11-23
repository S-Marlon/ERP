// Tabela de preços do editor (aba Preço e lucro): cada item com o preço da loja, o preço no ML (no rascunho) e o lucro
// no ML: tarifa, frete, você recebe, custo, lucro, % sobre o custo, preço para o alvo, situação e degraus de preço.
// As colunas acompanham o rascunho: mudou o preço, a linha recalcula.
import React, { useEffect, useState } from 'react';
import { Button, Card, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import { LineChartOutlined, RollbackOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, FinanceiroItem, formatarMoeda, ItemDoAnuncio, ROTULO_STATUS_ML } from '../mercadoLivreApi';
import { colunasLucro } from '../colunasLucro';
import type { RascunhoItem } from '../rascunhoAnuncio';
import { CampoDinheiro } from '../../../../shared/formularios/CamposNumero';

const { Text } = Typography;

/**
 * Lucro de cada item no editor: os números salvos e, para o item com preço mudado no rascunho, a simulação ao novo
 * preço (espera parar de digitar).
 */
export const useLucroDosItens = (salvo: AnuncioDetalhe, det: AnuncioDetalhe, rascunhoItens: Record<number, RascunhoItem>) => {
  const [base, setBase] = useState<Map<number, FinanceiroItem>>(new Map());
  const [simulados, setSimulados] = useState<Map<number, FinanceiroItem>>(new Map());
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    let vale = true;
    setCarregando(true);
    anunciosApi.financeiroAnuncio(salvo.id)
      .then(r => { if (vale) setBase(new Map(r.itens.map(i => [i.idLinha, i]))); })
      .catch(() => null)
      .finally(() => { if (vale) setCarregando(false); });
    return () => { vale = false; };
  }, [salvo]);

  // preço que vale hoje na tela para cada item com preço no rascunho
  const mudados = det.itens.filter(i => rascunhoItens[i.idLinha] && 'precoMl' in rascunhoItens[i.idLinha]).map(i => [i.idLinha, i.precoMl ?? i.precoAnuncio] as const);
  const chave = JSON.stringify(mudados);
  useEffect(() => {
    if (!mudados.length) { setSimulados(new Map()); return; }
    let vale = true;
    const t = window.setTimeout(async () => {
      const r = await Promise.all(mudados.map(async ([idLinha, preco]) => {
        try { return { ...(await anunciosApi.simularPreco(salvo.id, idLinha, preco)), idLinha, idItem: det.itens.find(i => i.idLinha === idLinha)?.idItem ?? 0, freteGratis: base.get(idLinha)?.freteGratis ?? false } as FinanceiroItem; }
        catch { return null; }
      }));
      if (vale) setSimulados(new Map(r.filter((x): x is FinanceiroItem => !!x).map(x => [x.idLinha, x])));
    }, 400);
    return () => { vale = false; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, salvo.id]);

  const doItem = (idLinha: number) => {
    const mudou = mudados.find(m => m[0] === idLinha);
    const sim = simulados.get(idLinha);
    if (mudou) return sim && Math.abs(sim.preco - mudou[1]) < 0.005 ? sim : undefined;
    return base.get(idLinha);
  };
  return { doItem, carregando };
};

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;                                  // com o rascunho aplicado
  rascunhoItens: Record<number, RascunhoItem>;
  onMudarPreco: (idLinha: number, preco: number | null) => void;
  selecionado: number | null;                           // item aberto no painel de cima
  onSelecionar: (idLinha: number) => void;
}

const TabelaPrecos: React.FC<Props> = ({ salvo, det, rascunhoItens, onMudarPreco, selecionado, onSelecionar }) => {
  const lucro = useLucroDosItens(salvo, det, rascunhoItens);
  const mudouPreco = (i: ItemDoAnuncio) => !!rascunhoItens[i.idLinha] && 'precoMl' in rascunhoItens[i.idLinha];
  const ajuste = det.ajustePreco ? `${det.ajustePreco > 0 ? '+' : ''}${det.ajustePreco}%` : '';

  return (
    <Card
      size="small" style={{ marginBottom: 16 }}
      title={<Space><LineChartOutlined />Preço e lucro de todos</Space>}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>Clique numa linha para abrir no painel · ajuste do anúncio: {ajuste || '0%'} sobre o ERP</Text>}
    >
      <Table<ItemDoAnuncio>
        size="small" rowKey="idLinha" dataSource={det.itens} pagination={det.itens.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
        scroll={{ x: 1500 }}
        rowClassName={i => [i.idLinha === selecionado ? 'ml-linha-selecionada' : '', mudouPreco(i) ? 'ml-linha-alterada' : lucro.doItem(i.idLinha)?.nivel === 'PREJUIZO' ? 'ml-linha-erro' : ''].join(' ')}
        onRow={i => ({ onClick: ev => { if (!(ev.target as HTMLElement).closest('input, button, .ant-input-number, .ant-popover, .ant-tag')) onSelecionar(i.idLinha); }, style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Item', fixed: 'left', width: 230,
            sorter: (a, b) => a.sku.localeCompare(b.sku),
            render: (_, i) => (
              <div style={{ lineHeight: 1.3 }}>
                <Text strong>{i.sku}</Text>{i.unidadeMl && <Text type="secondary" style={{ fontSize: 11 }}> ({i.unidadeMl.sigla})</Text>}
                <div><Text type="secondary" style={{ fontSize: 12 }}>{i.tituloMl || i.nome}</Text></div>
                {i.ml.mlbId && <Tag color={ROTULO_STATUS_ML[i.ml.status || '']?.cor} style={{ fontSize: 11 }}>{i.ml.mlbId}</Tag>}
              </div>
            ),
          },
          {
            title: <Tooltip title="Preço de venda do ERP (na unidade vendida no ML)">Preço loja</Tooltip>, width: 92, align: 'right',
            sorter: (a, b) => a.preco - b.preco, render: (_, i) => formatarMoeda(i.preco),
          },
          {
            title: <Tooltip title="O preço que vai para o ML. Sem preço próprio, vale o do ERP com o ajuste do anúncio. Mudou, as colunas recalculam na hora; item já no ML recebe o preço novo ao salvar.">Preço no ML</Tooltip>,
            width: 150, sorter: (a, b) => (a.precoMl ?? a.precoAnuncio) - (b.precoMl ?? b.precoAnuncio),
            render: (_, i) => (
              <div style={{ lineHeight: 1.3 }}>
                <CampoDinheiro
                  size="small" style={{ width: '100%' }} min={0.01} step={0.01} precision={2}
                  value={i.precoMl ?? i.precoAnuncio}
                  onChange={v => onMudarPreco(i.idLinha, v === null ? null : Number(v))}
                />
                {i.precoMl === null
                  ? <Text type="secondary" style={{ fontSize: 11 }}>do ERP{ajuste ? ` ${ajuste}` : ''}</Text>
                  : (
                    <Tooltip title={`Voltar ao preço do ERP com o ajuste do anúncio (${formatarMoeda(i.precoAnuncio)} hoje)`}>
                      <Button type="link" size="small" icon={<RollbackOutlined />} style={{ padding: 0, height: 'auto', fontSize: 11 }} onClick={() => onMudarPreco(i.idLinha, null)}>preço próprio</Button>
                    </Tooltip>
                  )}
              </div>
            ),
          },
          ...colunasLucro<ItemDoAnuncio>(i => lucro.doItem(i.idLinha), { aplicarVaiAoRascunho: true, onAplicarPreco: (i, preco) => onMudarPreco(i.idLinha, preco) }).map(c => ({
            ...c,
            render: (v: unknown, i: ItemDoAnuncio, k: number) => (lucro.doItem(i.idLinha) || (!mudouPreco(i) && !lucro.carregando)
              ? c.render?.(v, i, k)
              : <Spin size="small" />),
          })),
        ]}
      />
    </Card>
  );
};

export default TabelaPrecos;
