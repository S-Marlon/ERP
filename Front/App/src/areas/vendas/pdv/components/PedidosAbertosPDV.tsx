// PDV: salvar orçamento e a lista de vendas suspensas / orçamentos (retomar, converter, imprimir, excluir).
import React, { useEffect, useState } from 'react';
import { Button, Drawer, Empty, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, PrinterOutlined, RollbackOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { imprimirOrcamento, PedidoAbertoResumo, pedidosAbertosApi } from '../services/pedidosAbertosApi';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

export const SITUACAO_PEDIDO: Record<string, { label: string; color: string }> = {
  VALIDO: { label: 'Válido', color: 'green' },
  VENCIDO: { label: 'Vencido', color: 'orange' },
  CONVERTIDO: { label: 'Virou venda', color: 'blue' },
  SUSPENSA: { label: 'Suspensa', color: 'purple' },
};

// ---------------------------------------------------------------------------------------------
// Salvar orçamento
// ---------------------------------------------------------------------------------------------
export interface DadosOrcamento { contato: string; validadeDias: number; observacao: string }

export const ModalSalvarOrcamento: React.FC<{
  aberto: boolean; cliente: string; total: number; salvando: boolean;
  onFechar: () => void; onSalvar: (dados: DadosOrcamento) => void;
}> = ({ aberto, cliente, total, salvando, onFechar, onSalvar }) => {
  const [form] = Form.useForm<DadosOrcamento>();
  useEffect(() => { if (aberto) form.setFieldsValue({ contato: '', validadeDias: 7, observacao: '' }); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal open={aberto} title="Salvar como orçamento" okText="Salvar orçamento" cancelText="Voltar" confirmLoading={salvando}
      onCancel={onFechar} onOk={async () => onSalvar(await form.validateFields())} destroyOnHidden width={440}>
      <Space direction="vertical" style={{ width: '100%' }} size={2}>
        <Text>Cliente: <b>{cliente || 'Consumidor final'}</b> · Total: <b>{brl(total)}</b></Text>
        <Text type="secondary" style={{ fontSize: 12 }}>Os preços ficam congelados até a validade. Não mexe no estoque nem no caixa.</Text>
      </Space>
      <Form form={form} layout="vertical" style={{ marginTop: 10 }}>
        <Form.Item name="contato" label="Contato para retorno (telefone/WhatsApp)">
          <Input placeholder="(11) 99999-0000" maxLength={100} />
        </Form.Item>
        <Form.Item name="validadeDias" label="Válido por">
          <InputNumber min={1} max={180} addonAfter="dias" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="observacao" label="Observações (saem no orçamento impresso)">
          <Input.TextArea rows={2} maxLength={255} placeholder="Ex.: prazo de entrega, condições" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------
// Suspensas e orçamentos
// ---------------------------------------------------------------------------------------------
export const DrawerPedidosAbertos: React.FC<{
  aberto: boolean; abaInicial?: 'SUSPENSA' | 'ORCAMENTO'; carrinhoComItens: boolean;
  onFechar: () => void; onAbrir: (id: number, tipo: 'SUSPENSA' | 'ORCAMENTO') => void; onAlterado?: () => void;
}> = ({ aberto, abaInicial = 'SUSPENSA', carrinhoComItens, onFechar, onAbrir, onAlterado }) => {
  const [aba, setAba] = useState<'SUSPENSA' | 'ORCAMENTO'>(abaInicial);
  const [lista, setLista] = useState<PedidoAbertoResumo[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);

  const carregar = async (tipo = aba) => {
    setCarregando(true);
    try { setLista(await pedidosAbertosApi.listar(tipo, 'ABERTOS', busca.trim())); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao listar.'); } finally { setCarregando(false); }
  };
  useEffect(() => { if (aberto) { setAba(abaInicial); carregar(abaInicial); } }, [aberto, abaInicial]); // eslint-disable-line react-hooks/exhaustive-deps

  const imprimir = async (id: number) => {
    try { await imprimirOrcamento(await pedidosAbertosApi.detalhe(id)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao imprimir.'); }
  };
  const excluir = async (id: number) => {
    try { await pedidosAbertosApi.excluir(id); message.success('Excluído.'); carregar(); onAlterado?.(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao excluir.'); }
  };
  const abrir = (p: PedidoAbertoResumo) => {
    const continuar = () => onAbrir(p.id, p.tipo);
    if (!carrinhoComItens) { continuar(); return; }
    Modal.confirm({
      title: 'O carrinho atual tem itens',
      content: p.tipo === 'SUSPENSA' ? 'Retomar esta venda substitui os itens do carrinho. Suspenda a venda atual antes, se quiser guardá-la.' : 'Abrir o orçamento substitui os itens do carrinho.',
      okText: 'Substituir', cancelText: 'Voltar', onOk: continuar,
    });
  };

  return (
    <Drawer open={aberto} onClose={onFechar} width={720} title="Vendas suspensas e orçamentos">
      <Tabs activeKey={aba} onChange={k => { setAba(k as 'SUSPENSA' | 'ORCAMENTO'); carregar(k as 'SUSPENSA' | 'ORCAMENTO'); }}
        items={[{ key: 'SUSPENSA', label: 'Suspensas' }, { key: 'ORCAMENTO', label: 'Orçamentos em aberto' }]} />
      <Input.Search allowClear placeholder="Cliente, contato, item ou nº" style={{ marginBottom: 10 }}
        value={busca} onChange={e => setBusca(e.target.value)} onSearch={() => carregar()} />
      <Table<PedidoAbertoResumo>
        size="small"
        rowKey="id"
        loading={carregando}
        dataSource={lista}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={aba === 'SUSPENSA' ? 'Nenhuma venda suspensa' : 'Nenhum orçamento em aberto'} /> }}
        columns={[
          { title: 'Nº', dataIndex: 'id', width: 60 },
          {
            title: 'Cliente', key: 'c',
            render: (_, p) => (
              <div style={{ lineHeight: 1.2 }}>
                <div>{p.cliente}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>{[p.contato, `${p.qtdItens} item(ns)`, p.operador].filter(Boolean).join(' · ')}</Text>
              </div>
            ),
          },
          {
            title: aba === 'SUSPENSA' ? 'Suspensa em' : 'Validade', key: 'd', width: 110,
            render: (_, p) => (aba === 'SUSPENSA'
              ? new Date(p.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : <Space direction="vertical" size={0}><span>{dataBr(p.validade)}</span><Tag color={SITUACAO_PEDIDO[p.situacao].color} style={{ margin: 0, fontSize: 10 }}>{SITUACAO_PEDIDO[p.situacao].label}</Tag></Space>),
          },
          { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 100, render: (v: number) => <b>{brl(v)}</b> },
          {
            title: '', key: 'a', width: 170,
            render: (_, p) => (
              <Space size={4}>
                <Button size="small" type="primary" icon={aba === 'SUSPENSA' ? <RollbackOutlined /> : <ShoppingCartOutlined />} onClick={() => abrir(p)}>
                  {aba === 'SUSPENSA' ? 'Retomar' : 'Vender'}
                </Button>
                {aba === 'ORCAMENTO' && <Tooltip title="Imprimir"><Button size="small" icon={<PrinterOutlined />} onClick={() => imprimir(p.id)} /></Tooltip>}
                <Popconfirm title="Excluir?" okText="Excluir" cancelText="Não" onConfirm={() => excluir(p.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Drawer>
  );
};
