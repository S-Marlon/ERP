// Vendas › Orçamentos: válidos, vencidos e os que viraram venda; imprimir, PDF, WhatsApp, vender (abre no PDV) e excluir.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, DatePicker, Dropdown, Empty, Input, Modal, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CarOutlined, DeleteOutlined, FilePdfOutlined, FileTextOutlined, PrinterOutlined, ReloadOutlined, ShoppingCartOutlined, SlidersOutlined, UserAddOutlined, WhatsAppOutlined, RiseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { pedidosFaturadosApi } from '../pedidos/pedidosFaturadosApi';
import { imprimirOrcamento, PedidoAbertoDetalhe, PedidoAbertoResumo, pedidosAbertosApi } from '../pdv/services/pedidosAbertosApi';
import { SITUACAO_PEDIDO } from '../pdv/components/PedidosAbertosPDV';
import { baixarPdfOrcamento, EnviarOrcamentoWhatsapp } from './EnviarOrcamento';
import { imprimirEspelhoNf } from '../vendasDoDia/impressaoVenda';
import { ResultadoPedidoModal } from '../resultado/ResultadoPedidoModal';
import { ClientePdvModal } from '../pdv/components/ClientePdvModal';
import { telefoneDoTexto } from '../../../shared/utils/whatsapp';
import { AberturaNegociacao, NegociacaoDrawer } from '../negociacao/NegociacaoDrawer';
import { aberturaDoOrcamento } from '../negociacao/negociacaoApi';
import { FORMATOS_DATA } from '../../../shared/formularios/numeros';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

const ItensDoOrcamento: React.FC<{ id: number }> = ({ id }) => {
  const [d, setD] = useState<PedidoAbertoDetalhe | null>(null);
  useEffect(() => { pedidosAbertosApi.detalhe(id).then(setD).catch(() => setD(null)); }, [id]);
  if (!d) return <Text type="secondary">Carregando...</Text>;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Table size="small" rowKey={(_, i) => String(i)} pagination={false} dataSource={d.itens} columns={[
        { title: 'Código', dataIndex: 'sku', width: 140 },
        { title: 'Item', dataIndex: 'nome' },
        { title: 'Qtd', key: 'q', align: 'right' as const, render: (_, i) => `${i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${i.unidade || ''}` },
        { title: 'Unitário', dataIndex: 'precoUnitario', align: 'right' as const, render: (v: number) => brl(v) },
        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
      ]} />
      {d.observacao && <Text type="secondary" style={{ fontSize: 12 }}>Observações: {d.observacao}</Text>}
    </Space>
  );
};

const Orcamentos: React.FC = () => {
  const navigate = useNavigate();
  const [situacao, setSituacao] = useState('ABERTOS');
  const [resultado, setResultado] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<PedidoAbertoResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [semCliente, setSemCliente] = useState<PedidoAbertoResumo | null>(null);
  const [negociando, setNegociando] = useState<AberturaNegociacao | null>(null);
  // Orçamento virando pedido faturado (empresa, entrega depois)
  const [virandoPedido, setVirandoPedido] = useState<PedidoAbertoResumo | null>(null);
  const [dadosPedido, setDadosPedido] = useState({ previsaoEntrega: null as string | null, enderecoEntrega: '', pedidoCliente: '' });
  const [criandoPedido, setCriandoPedido] = useState(false);
  const criarPedido = async () => {
    if (!virandoPedido) return;
    setCriandoPedido(true);
    try {
      const r = await pedidosFaturadosApi.criar({ idOrcamento: virandoPedido.id, ...dadosPedido });
      setVirandoPedido(null);
      if (r.faltas.length) message.warning(`Pedido Nº ${r.id} criado. Ainda sem saldo livre: ${r.faltas.map(f => f.nome).join(', ')}.`, 8);
      else message.success(`Pedido Nº ${r.id} criado: material reservado.`);
      navigate(`/vendas/pedidos-faturados?id=${r.id}`);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao criar o pedido.'); } finally { setCriandoPedido(false); }
  };
  const negociar = async (id: number) => {
    try { setNegociando(aberturaDoOrcamento(await pedidosAbertosApi.detalhe(id))); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao abrir.'); }
  };

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await pedidosAbertosApi.listar('ORCAMENTO', situacao, busca.trim())); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao listar.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [situacao]); // eslint-disable-line react-hooks/exhaustive-deps

  const imprimir = async (id: number) => {
    try { await imprimirOrcamento(await pedidosAbertosApi.detalhe(id)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao imprimir.'); }
  };
  const espelhoNf = async (id: number, modelo?: '55' | '65') => {
    try { await imprimirEspelhoNf(id, modelo); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao montar o espelho da nota.'); }
  };
  // Orçamento sem cliente: acha pelo telefone anotado ou cadastra (nome e telefone) e liga o orçamento a ele
  const definirCliente = async (c: { id: number; nome: string } | null) => {
    const o = semCliente;
    setSemCliente(null);
    if (!o || !c) return;
    try {
      await pedidosAbertosApi.definirCliente(o.id, c.id);
      message.success(`Orçamento Nº ${o.id} agora está no nome de ${c.nome}.`);
      carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao definir o cliente.'); }
  };
  const excluir = async (id: number) => {
    try { await pedidosAbertosApi.excluir(id); message.success('Orçamento excluído.'); carregar(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao excluir.'); }
  };

  const total = lista.reduce((a, o) => a + o.total, 0);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Orçamentos</Title>
            <Text type="secondary">Criados no PDV (botão Orçamento). Preços congelados até a validade; não mexem em estoque nem caixa.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/vendas/pdv')}>Novo no PDV</Button>
          </Space>
        </div>

        <Card size="small">
          <Space wrap style={{ marginBottom: 10, justifyContent: 'space-between', width: '100%' }}>
            <Space wrap>
              <Segmented value={situacao} onChange={v => setSituacao(String(v))} options={[
                { value: 'ABERTOS', label: 'Em aberto' }, { value: 'VALIDO', label: 'Válidos' }, { value: 'VENCIDO', label: 'Vencidos' },
                { value: 'CONVERTIDO', label: 'Viraram venda' }, { value: 'TODOS', label: 'Todos' },
              ]} />
              <Input.Search allowClear placeholder="Cliente, contato, item ou nº" style={{ width: 280 }}
                value={busca} onChange={e => setBusca(e.target.value)} onSearch={carregar} />
            </Space>
            <Text type="secondary">{lista.length} orçamento(s) · {brl(total)}</Text>
          </Space>
          <Table<PedidoAbertoResumo>
            size="small"
            rowKey="id"
            loading={carregando}
            dataSource={lista}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            expandable={{ expandedRowRender: o => <ItensDoOrcamento id={o.id} /> }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum orçamento" /> }}
            columns={[
              { title: 'Nº', dataIndex: 'id', width: 70 },
              { title: 'Emitido', dataIndex: 'criadoEm', width: 95, render: (v: string) => dataBr(String(v)) },
              {
                title: 'Cliente', key: 'c',
                render: (_, o) => (
                  <div style={{ lineHeight: 1.2 }}>
                    <Space size={6}>
                      <span>{o.cliente}</span>
                      {!o.idCliente && o.situacao !== 'CONVERTIDO' && (
                        <Tooltip title={o.contato ? 'Achar o cliente pelo telefone ou cadastrar com nome e telefone' : 'Escolher ou cadastrar o cliente'}>
                          <Button size="small" type="link" icon={<UserAddOutlined />} style={{ padding: 0, height: 18 }} onClick={() => setSemCliente(o)}>
                            Cadastrar cliente
                          </Button>
                        </Tooltip>
                      )}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11 }}>{[o.contato, `${o.qtdItens} item(ns)`, o.operador].filter(Boolean).join(' · ')}</Text>
                  </div>
                ),
              },
              {
                title: 'Validade', key: 'v', width: 150,
                render: (_, o) => (
                  <Space size={4}>
                    <span>{dataBr(o.validade)}</span>
                    <Tag color={SITUACAO_PEDIDO[o.situacao].color} style={{ margin: 0 }}>{SITUACAO_PEDIDO[o.situacao].label}</Tag>
                  </Space>
                ),
              },
              {
                title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120,
                render: (v: number, o) => (
                  <Tooltip title={o.total > 0 ? `Margem bruta ${(((o.total - o.custo) / o.total) * 100).toFixed(1).replace('.', ',')}%` : undefined}><b>{brl(v)}</b></Tooltip>
                ),
              },
              {
                title: '', key: 'a', width: 350,
                render: (_, o) => (
                  <Space size={4}>
                    {o.situacao === 'CONVERTIDO'
                      ? o.virouPedido
                        ? <Button size="small" type="link" onClick={() => navigate(`/vendas/pedidos-faturados?id=${o.idVendaGerada}`)}>pedido Nº {o.idVendaGerada}</Button>
                        : <Button size="small" type="link" onClick={() => navigate('/vendas/do-dia')}>venda Nº {o.idVendaGerada}</Button>
                      : <Button size="small" type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate(`/vendas/pdv?orcamento=${o.id}`)}>Vender</Button>}
                    {o.situacao === 'VALIDO' && (
                      <Tooltip title="Pedido faturado: empresa, entrega depois, NF-e e boletos (reserva o material)">
                        <Button size="small" icon={<CarOutlined />} onClick={() => { setDadosPedido({ previsaoEntrega: null, enderecoEntrega: '', pedidoCliente: '' }); setVirandoPedido(o); }}>Pedido</Button>
                      </Tooltip>
                    )}
                    {o.situacao !== 'CONVERTIDO' && (
                      <Tooltip title="Negociar: margem por item, por categoria e do orçamento, faixas por quantidade">
                        <Button size="small" icon={<SlidersOutlined />} onClick={() => negociar(o.id)} />
                      </Tooltip>
                    )}
                    <Tooltip title="Imprimir"><Button size="small" icon={<PrinterOutlined />} onClick={() => imprimir(o.id)} /></Tooltip>
                    <Tooltip title="Baixar PDF"><Button size="small" icon={<FilePdfOutlined />} onClick={() => baixarPdfOrcamento(o.id)} /></Tooltip>
                    <Tooltip title="Resultado: quanto o pedido deixa de lucro e se está bom"><Button size="small" icon={<RiseOutlined />} onClick={() => setResultado(o.id)} /></Tooltip>
                    <Dropdown trigger={['click']} menu={{
                      items: [
                        { key: 'auto', label: 'Espelho da nota (modelo pelo cliente)' },
                        { key: '55', label: 'Espelho NF-e (modelo 55, cliente com CNPJ/endereço)' },
                        { key: '65', label: 'Espelho NFC-e (modelo 65, consumidor)' },
                      ],
                      onClick: ({ key }) => espelhoNf(o.id, key === 'auto' ? undefined : key as '55' | '65'),
                    }}>
                      <Tooltip title="Dados para emitir a nota à mão (produtos com NCM, CFOP, CSOSN, cliente e pagamento)">
                        <Button size="small" icon={<FileTextOutlined />} />
                      </Tooltip>
                    </Dropdown>
                    <Tooltip title="Enviar o PDF pelo WhatsApp">
                      <Button size="small" icon={<WhatsAppOutlined style={{ color: '#25d366' }} />} onClick={() => setEnviando(o.id)} />
                    </Tooltip>
                    {o.situacao !== 'CONVERTIDO' && (
                      <Popconfirm title="Excluir o orçamento?" okText="Excluir" cancelText="Não" onConfirm={() => excluir(o.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
      <EnviarOrcamentoWhatsapp id={enviando} onClose={() => setEnviando(null)} />
      <Modal open={!!virandoPedido} title={`Orçamento Nº ${virandoPedido?.id ?? ''} → pedido faturado`} okText="Criar pedido" cancelText="Voltar"
        confirmLoading={criandoPedido} onOk={criarPedido} onCancel={() => setVirandoPedido(null)} okButtonProps={{ disabled: !virandoPedido?.idCliente }} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>O material fica <b>reservado</b> (o balcão não vende), pelos preços deste orçamento. Depois: faturar (NF-e e parcelas) e entregar.</Text>
          {!virandoPedido?.idCliente && <Alert type="error" showIcon title="Defina o cliente do cadastro no orçamento antes (nota e contas a receber precisam dele)." />}
          <Input addonBefore="Pedido de compra do cliente" placeholder="Nº da OC (opcional)" maxLength={60} value={dadosPedido.pedidoCliente}
            onChange={e => setDadosPedido({ ...dadosPedido, pedidoCliente: e.target.value })} />
          <DatePicker style={{ width: '100%' }} format={FORMATOS_DATA} placeholder="Previsão de entrega" disabledDate={d => d.isBefore(dayjs(), 'day')}
            value={dadosPedido.previsaoEntrega ? dayjs(dadosPedido.previsaoEntrega) : null}
            onChange={v => setDadosPedido({ ...dadosPedido, previsaoEntrega: v ? v.format('YYYY-MM-DD') : null })} />
          <Input placeholder="Endereço de entrega (vazio = retira na loja)" maxLength={255} value={dadosPedido.enderecoEntrega}
            onChange={e => setDadosPedido({ ...dadosPedido, enderecoEntrega: e.target.value })} />
        </Space>
      </Modal>
      <NegociacaoDrawer abrir={negociando} onFechar={() => setNegociando(null)}
        onSalvo={id => { setNegociando(null); message.success(`Orçamento Nº ${id} salvo.`); carregar(); }} />
      <ClientePdvModal
        open={!!semCliente}
        titulo={semCliente ? `Cliente do orçamento Nº ${semCliente.id}` : undefined}
        buscaInicial={semCliente ? telefoneDoTexto(semCliente.contato) || '' : ''}
        onSelecionar={definirCliente}
        onFechar={() => setSemCliente(null)}
      />
      <ResultadoPedidoModal idVenda={resultado} onFechar={() => setResultado(null)} />
    </div>
  );
};

export default Orcamentos;
