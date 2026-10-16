// Aba Preço e lucro como painel: à esquerda as linhas do anúncio (SKU, preço, % de lucro e o que pede atenção) para
// escolher; à direita o painel da linha escolhida (preço, os números que decidem e as seções em abas). A tabela de
// todos, para mexer em vários preços de uma vez, abre por cima.
import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Empty, Flex, Input, Modal, Row, Space, Tag, Tooltip, Typography } from 'antd';
import { TableOutlined, WarningFilled } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, FaixaQuantidade, formatarMoeda, SecaoPreco, SugestaoMl } from '../mercadoLivreApi';
import type { RascunhoItem } from '../rascunhoAnuncio';
import PrecoMlCard from '../PrecoMlCard';
import FormasDeVendaCard from '../FormasDeVendaCard';
import FaixasQuantidadeCard from '../FaixasQuantidadeCard';
import TabelaPrecos, { useLucroDosItens } from './TabelaPrecos';
import { SITUACAO_LUCRO } from '../colunasLucro';
import { rotuloDaUnidade } from '../linhasAnuncio';

const { Text } = Typography;

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;                                         // com o rascunho aplicado
  rascunhoItens: Record<number, RascunhoItem>;
  idLinha: number | null;                                      // linha aberta no painel
  onSelecionar: (idLinha: number) => void;
  onMudarPreco: (idLinha: number, preco: number | null) => void;
  onEscolherCenario: (tipo: string, freteGratis: boolean | undefined) => void;
  onMudarFaixas: (faixas: FaixaQuantidade[]) => void;
  onCriarForma: (idLinha: number, quantidade: number, preco: number | null) => void;
  onAtivar: (idLinha: number, ativo: boolean) => void;
  ocupado?: boolean;
  secaoPedida?: { secao: SecaoPreco; vez: number } | null;   // vinda da central de sugestões
  onIrParaItens?: (s: SugestaoMl) => void;
}

const AbaPreco: React.FC<Props> = p => {
  const { salvo, det } = p;
  const lucro = useLucroDosItens(salvo, det, p.rascunhoItens);
  const [busca, setBusca] = useState('');
  const [tabela, setTabela] = useState(false);
  const [pedido, setPedido] = useState<{ secao: SecaoPreco; vez: number } | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoMl[]>([]);
  useEffect(() => { if (p.secaoPedida) setPedido(p.secaoPedida); }, [p.secaoPedida?.vez]);   // eslint-disable-line react-hooks/exhaustive-deps
  // as sugestões consultam o frete no ML: em segundo plano, e de novo quando o anúncio é gravado
  useEffect(() => {
    let vivo = true;
    anunciosApi.sugestoes(salvo.id).then(r => vivo && setSugestoes(r.sugestoes)).catch(() => vivo && setSugestoes([]));
    return () => { vivo = false; };
  }, [salvo]);
  const atual = p.idLinha ?? det.itens[0]?.idLinha;

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? det.itens.filter(i => `${i.sku} ${i.tituloMl || i.nome}`.toLowerCase().includes(t)) : det.itens;
  }, [busca, det.itens]);

  if (!det.categoria) return <Card size="small"><Text type="secondary">Escolha a categoria do ML (aba Anúncio): a tarifa depende dela.</Text></Card>;
  if (!det.itens.length || atual === undefined) return <Card size="small"><Empty description="Este anúncio ainda não tem itens" /></Card>;

  const painel = (
    <PrecoMlCard
      salvo={salvo} det={det} idLinha={atual} onMudarPreco={p.onMudarPreco} onEscolherCenario={p.onEscolherCenario} secaoPedida={pedido}
      sugestoes={sugestoes.filter(s => s.idLinha === atual)} onIrParaItens={p.onIrParaItens}
      formas={(
        <FormasDeVendaCard
          embutido det={det} idLinha={atual} rascunhoItens={p.rascunhoItens} ocupado={p.ocupado}
          onMudarPreco={p.onMudarPreco} onCriar={(q, preco) => p.onCriarForma(atual, q, preco)} onAtivar={p.onAtivar}
          onAnalisar={idLinha => { p.onSelecionar(idLinha); setPedido(x => ({ secao: 'mercado', vez: (x?.vez || 0) + 1 })); }}
        />
      )}
      faixas={<FaixasQuantidadeCard embutido det={det} onMudar={p.onMudarFaixas} />}
    />
  );

  // anúncio de uma linha só: o painel ocupa tudo
  if (det.itens.length === 1) {
    return (
      <>
        <Flex justify="flex-end" style={{ marginBottom: 8 }}><Button size="small" icon={<TableOutlined />} onClick={() => setTabela(true)}>Tabela com tarifa e custo</Button></Flex>
        {painel}
        <Modal open={tabela} onCancel={() => setTabela(false)} footer={null} width="min(1600px, 98vw)" destroyOnHidden title="Preço e lucro">
          <TabelaPrecos salvo={salvo} det={det} rascunhoItens={p.rascunhoItens} onMudarPreco={p.onMudarPreco} selecionado={atual} onSelecionar={id => { p.onSelecionar(id); setTabela(false); }} />
        </Modal>
      </>
    );
  }

  return (
    <Row gutter={12} wrap>
      <Col xs={24} lg={7} xxl={6}>
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', padding: 8, position: 'sticky', top: 0 }}>
          <Flex gap={6} style={{ marginBottom: 8 }}>
            <Input size="small" allowClear placeholder={`Buscar entre ${det.itens.length}`} value={busca} onChange={e => setBusca(e.target.value)} />
            <Tooltip title="Todos numa tabela, com tarifa, frete e custo (para mudar vários preços de uma vez)">
              <Button size="small" icon={<TableOutlined />} onClick={() => setTabela(true)}>Todos</Button>
            </Tooltip>
          </Flex>
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {visiveis.map(i => {
              const f = lucro.doItem(i.idLinha);
              const sel = i.idLinha === atual;
              const alterado = !!p.rascunhoItens[i.idLinha] && 'precoMl' in p.rascunhoItens[i.idLinha];
              const grave = f?.nivel === 'PREJUIZO' || f?.alertas?.some(x => x.grave);
              return (
                <div
                  key={i.idLinha} onClick={() => p.onSelecionar(i.idLinha)}
                  style={{
                    cursor: 'pointer', padding: '6px 8px', borderRadius: 6, marginBottom: 2,
                    background: sel ? '#e6f4ff' : 'transparent', boxShadow: sel ? 'inset 3px 0 0 #1677ff' : undefined, opacity: i.linhaAtiva === false ? 0.55 : 1,
                  }}
                >
                  <Flex justify="space-between" align="center" gap={6}>
                    <Space size={4} style={{ minWidth: 0 }}>
                      {alterado && <Tooltip title="Preço alterado (falta salvar)"><Badge color="#1677ff" /></Tooltip>}
                      <Text strong ellipsis style={{ maxWidth: 150, fontSize: 13 }}>{i.sku}</Text>
                      {i.unidadeMl && <Tag color="purple" style={{ fontSize: 10, marginRight: 0, lineHeight: '16px' }}>{rotuloDaUnidade(i).split(' · ')[0]}</Tag>}
                    </Space>
                    <Text strong style={{ fontSize: 13 }}>{formatarMoeda(i.precoMl ?? i.precoAnuncio)}</Text>
                  </Flex>
                  <Flex justify="space-between" align="center" gap={6}>
                    <Text type="secondary" ellipsis style={{ fontSize: 11, maxWidth: 170 }}>{i.tituloMl || i.nome}</Text>
                    <Space size={4}>
                      {grave && <WarningFilled style={{ color: '#cf1322', fontSize: 12 }} />}
                      {f ? (
                        <Tooltip title={`${SITUACAO_LUCRO[f.nivel]?.texto}: lucro ${formatarMoeda(f.lucro)} · recebe ${formatarMoeda(f.recebe)}`}>
                          <Tag color={SITUACAO_LUCRO[f.nivel]?.cor} style={{ fontSize: 11, marginRight: 0, lineHeight: '16px' }}>
                            {f.lucroSobreCustoPct === null ? 'sem custo' : `${f.lucroSobreCustoPct.toFixed(0)}%`}
                          </Tag>
                        </Tooltip>
                      ) : <Text type="secondary" style={{ fontSize: 11 }}>…</Text>}
                    </Space>
                  </Flex>
                </div>
              );
            })}
            {!visiveis.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada com esse texto" />}
          </div>
        </div>
      </Col>
      <Col xs={24} lg={17} xxl={18}>{painel}</Col>
      <Modal open={tabela} onCancel={() => setTabela(false)} footer={null} width="min(1600px, 98vw)" destroyOnHidden title="Preço e lucro de todos">
        <TabelaPrecos salvo={salvo} det={det} rascunhoItens={p.rascunhoItens} onMudarPreco={p.onMudarPreco} selecionado={atual} onSelecionar={id => { p.onSelecionar(id); setTabela(false); }} />
      </Modal>
    </Row>
  );
};

export default AbaPreco;
