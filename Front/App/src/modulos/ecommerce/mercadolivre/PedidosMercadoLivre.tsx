// Aba Pedidos: vendas do Mercado Livre que entraram (ou não) como venda no ERP.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Flex, Popconfirm, Row, Segmented, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CloudDownloadOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { anunciosApi, formatarMoeda, PedidoMl, pedidosApi, SituacaoPedido, SituacaoSincronizacao } from './mercadoLivreApi';
import RecebiveisMl from './RecebiveisMl';
import ResultadoRealMl from './ResultadoRealMl';

const { Text } = Typography;

const ROTULO: Record<SituacaoPedido, { texto: string; cor: string; dica: string }> = {
  VENDA: { texto: 'Venda no ERP', cor: 'green', dica: 'Virou venda e o estoque já baixou.' },
  VENDA_CANCELADA: { texto: 'Venda cancelada', cor: 'default', dica: 'A venda do ERP foi cancelada (estoque devolvido).' },
  CANCELADO_NO_ML: { texto: 'Cancelado no ML', cor: 'red', dica: 'O comprador ou o ML cancelou depois da venda. Se a mercadoria não saiu (ou voltou), cancele a venda no ERP para devolver o estoque.' },
  CANCELADO: { texto: 'Cancelado', cor: 'default', dica: 'Cancelado no ML antes de ser pago: não virou venda.' },
  PENDENTE: { texto: 'Pendente', cor: 'orange', dica: 'Não virou venda: veja o motivo e tente de novo.' },
  AGUARDANDO: { texto: 'Aguardando pagamento', cor: 'blue', dica: 'Vira venda quando o ML confirmar o pagamento.' },
};

type Filtro = 'todos' | 'atencao' | 'vendas';

const PedidosMercadoLivre: React.FC = () => {
  const [pedidos, setPedidos] = useState<PedidoMl[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [auto, setAuto] = useState<SituacaoSincronizacao | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setPedidos(await pedidosApi.listar()); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
    anunciosApi.situacaoSincronizacao().then(setAuto).catch(() => null);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const buscar = async () => {
    setBuscando(true);
    setErroBusca(null);
    try {
      const r = await pedidosApi.buscar();
      message.success(r.lidos
        ? `${r.lidos} pedido(s) lidos: ${r.vendas} venda(s) nova(s)${r.pendentes ? `, ${r.pendentes} pendente(s)` : ''}${r.canceladosNoMl ? `, ${r.canceladosNoMl} cancelado(s) no ML` : ''}.`
        : 'Nenhum pedido novo no Mercado Livre.');
      carregar();
    } catch (e) {
      setErroBusca(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setBuscando(false);
    }
  };

  const reprocessar = async (p: PedidoMl) => {
    try {
      const r = await pedidosApi.reprocessar(p.id);
      if (r.idVenda) message.success(`Pedido ${p.mlOrderId} virou a venda #${r.idVenda}.`);
      else message.warning(r.erro || 'Ainda não virou venda.');
      carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  const cancelarVenda = async (p: PedidoMl) => {
    if (!p.idVenda) return;
    try {
      await pedidosApi.cancelarVenda(p.idVenda, `Pedido ${p.mlOrderId} cancelado no Mercado Livre`);
      message.success(`Venda #${p.idVenda} cancelada: estoque devolvido.`);
      carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  // MEI: comprador CNPJ precisa de nota
  const atencao = (p: PedidoMl) => p.situacao === 'PENDENTE' || p.situacao === 'CANCELADO_NO_ML' || (p.situacao === 'VENDA' && p.exigeNota);
  const visiveis = useMemo(() => pedidos.filter(p => filtro === 'todos' || (filtro === 'atencao' ? atencao(p) : p.situacao === 'VENDA')), [pedidos, filtro]);
  const vendas = pedidos.filter(p => p.situacao === 'VENDA');
  const somar = (lista: PedidoMl[], campo: 'total' | 'liquido') => lista.reduce((s, p) => s + p[campo], 0);
  const qtdAtencao = pedidos.filter(atencao).length;
  const permissao = erroBusca && /UNAUTHORIZED|policy/i.test(erroBusca);

  return (
    <>
      {erroBusca && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setErroBusca(null)}
          message={permissao ? 'O Mercado Livre não liberou a leitura dos pedidos' : erroBusca}
          description={permissao && (
            <>No aplicativo do ERP no ML (developers.mercadolivre.com.br › Meus aplicativos › Configuração e scopes) dê <b>Leitura e escrita</b> em
              "Venda e envios de um produto" e salve. Depois, na aba <b>Conta</b>, desconecte e conecte de novo (a autorização nova traz a permissão).</>
          )}
        />
      )}
      <RecebiveisMl onAlterado={carregar} />
      <ResultadoRealMl atualizar={pedidos.length} />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Vendas do ML" value={vendas.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Vendido (itens)" value={formatarMoeda(somar(vendas, 'total'))} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Líquido a receber do ML" value={formatarMoeda(somar(vendas, 'liquido'))} valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Precisam de atenção" value={qtdAtencao} valueStyle={{ color: qtdAtencao ? '#cf1322' : undefined }} /></Card></Col>
      </Row>

      <Card size="small">
        <Flex justify="space-between" wrap gap={8} style={{ marginBottom: 12 }}>
          <Space wrap>
            <Segmented<Filtro> value={filtro} onChange={setFiltro} options={[
              { value: 'todos', label: 'Todos' },
              { value: 'atencao', label: `Precisam de atenção (${qtdAtencao})` },
              { value: 'vendas', label: `Vendas (${vendas.length})` },
            ]} />
            {auto && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Busca sozinho a cada {auto.intervaloMin} min{auto.ultimaEm ? ` · última: ${new Date(auto.ultimaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                {auto.erroPedidos ? ' · última busca com erro' : ''}
              </Text>
            )}
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<CloudDownloadOutlined />} onClick={buscar} loading={buscando}>Buscar pedidos agora</Button>
          </Space>
        </Flex>

        <Table<PedidoMl>
          size="middle" rowKey="id" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description={pedidos.length ? 'Nada neste filtro.' : 'Nenhum pedido do Mercado Livre ainda. As vendas pagas entram aqui sozinhas e viram venda no ERP.'} /> }}
          expandable={{
            expandedRowRender: p => (
              <Space direction="vertical" size={4}>
                {p.itens.map(i => (
                  <Text key={i.mlbId + i.titulo}>{i.quantidade}× {i.titulo} <Text type="secondary">({i.mlbId}{i.sku ? ` · SKU ${i.sku}` : ''}) · {formatarMoeda(i.precoUnitario)}</Text></Text>
                ))}
                {p.erro && <Alert type={p.situacao === 'VENDA' ? 'warning' : 'error'} showIcon message={p.erro} />}
              </Space>
            ),
          }}
          columns={[
            { title: 'Data', dataIndex: 'data', width: 130, render: (v: string | null) => v ? v.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1') : '—' },
            {
              title: 'Pedido',
              render: (_, p) => (
                <div>
                  <a href={`https://www.mercadolivre.com.br/vendas/${p.mlOrderId}/detalhe`} target="_blank" rel="noreferrer"><LinkOutlined /> {p.mlOrderId}</a>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>{p.comprador}</Text></div>
                  <div><Text style={{ fontSize: 12 }}>{p.itens.map(i => `${i.quantidade}× ${i.titulo}`).join(' · ').slice(0, 90)}</Text></div>
                </div>
              ),
            },
            { title: 'Total', dataIndex: 'total', width: 100, align: 'right', render: formatarMoeda },
            {
              title: 'Tarifas', width: 120, align: 'right',
              render: (_, p) => (
                <Tooltip title={`Comissão ${formatarMoeda(p.comissao)}${p.frete ? ` + frete pago por você ${formatarMoeda(p.frete)}` : ''}`}>
                  <Text type="secondary">-{formatarMoeda(p.comissao + p.frete)}</Text>
                </Tooltip>
              ),
            },
            {
              title: 'Líquido', width: 120, align: 'right',
              render: (_, p) => (
                <div style={{ lineHeight: 1.25 }}>
                  <Text strong>{formatarMoeda(p.liquido)}</Text>
                  {p.titulo && p.titulo.status !== 'CANCELADO' && (
                    <div><Text type="secondary" style={{ fontSize: 11 }}>{p.titulo.status === 'ABERTO' ? 'a receber' : p.titulo.status.toLowerCase()} {p.titulo.vencimento.split('-').reverse().slice(0, 2).join('/')}</Text></div>
                  )}
                </div>
              ),
            },
            {
              title: <Tooltip title="Líquido − custo do ERP gravado na venda">Lucro</Tooltip>, width: 110, align: 'right',
              render: (_, p) => (p.lucro === null ? <Text type="secondary">—</Text> : (
                <Tooltip title={`${formatarMoeda(p.liquido)} recebidos − custo ${formatarMoeda(p.custo)}`}>
                  <Text strong style={{ color: p.lucro < 0 ? '#cf1322' : '#389e0d' }}>{formatarMoeda(p.lucro)}</Text>
                </Tooltip>
              )),
            },
            {
              title: 'Situação', width: 210,
              render: (_, p) => (
                <Space direction="vertical" size={2}>
                  <Tooltip title={ROTULO[p.situacao].dica}><Tag color={ROTULO[p.situacao].cor}>{ROTULO[p.situacao].texto}</Tag></Tooltip>
                  {p.idVenda && <Text type="secondary" style={{ fontSize: 12 }}>Venda #{p.idVenda}</Text>}
                  {p.exigeNota && p.situacao === 'VENDA' && (
                    <Tooltip title="O comprador é empresa (CNPJ): mesmo como MEI, emita a nota fiscal (pode ser pelo emissor gratuito do próprio Mercado Livre, em Vendas › Notas fiscais).">
                      <Tag color="red">CNPJ: emitir nota</Tag>
                    </Tooltip>
                  )}
                </Space>
              ),
            },
            {
              title: '', width: 150, align: 'right',
              render: (_, p) => (
                <Space direction="vertical" size={4}>
                  {p.situacao === 'PENDENTE' && <Button size="small" onClick={() => reprocessar(p)}>Tentar de novo</Button>}
                  {p.situacao === 'CANCELADO_NO_ML' && (
                    <Popconfirm
                      title={`Cancelar a venda #${p.idVenda} no ERP?`}
                      description={<div style={{ maxWidth: 300 }}>O estoque dos itens volta. Faça isso se a mercadoria não saiu ou já voltou.</div>}
                      okText="Cancelar venda" okButtonProps={{ danger: true }} onConfirm={() => cancelarVenda(p)}
                    >
                      <Button size="small" danger>Cancelar venda no ERP</Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
};

export default PedidosMercadoLivre;
