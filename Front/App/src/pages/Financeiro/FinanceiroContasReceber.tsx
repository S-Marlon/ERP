// Financeiro › Contas a Receber: parcelas das vendas a prazo, recebimento (entra no caixa aberto),
// estorno de recebimento e crédito do cliente (limite e bloqueio para venda a prazo).
import React, { useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Drawer, Empty, Input, InputNumber, Modal, Row, Segmented, Select,
  Space, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { CreditCardOutlined, DollarOutlined, ReloadOutlined, RollbackOutlined, SearchOutlined } from '@ant-design/icons';
import { Baixa, dataBr, receberApi, ResumoReceber, ROTULO_SITUACAO, SituacaoCliente, Titulo } from './receber/receberApi';
import { ROTULO_FORMA } from '../PDV/caixa/caixaApi';
import { caixaStore, useCaixa } from '../PDV/caixa/caixaStore';
import { buscarClientesPdv, ClienteBusca } from '../PDV/services/api/products';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const erroDe = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);
const FORMAS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'];

// ---------------------------------------------------------------------------------------------
// Receber uma parcela
// ---------------------------------------------------------------------------------------------
const ModalReceber: React.FC<{ titulo: Titulo | null; onFechar: () => void; onRecebido: () => void }> = ({ titulo, onFechar, onRecebido }) => {
  const { caixa, carregado } = useCaixa();
  const [forma, setForma] = useState('DINHEIRO');
  const [valor, setValor] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!titulo) return;
    setForma('DINHEIRO');
    setValor(titulo.saldo);
    setObservacao('');
    if (!carregado) caixaStore.recarregar();
  }, [titulo]); // eslint-disable-line react-hooks/exhaustive-deps

  const receber = async () => {
    if (!titulo) return;
    setSalvando(true);
    try {
      const r = await receberApi.receber(titulo.idTitulo, forma, Number(valor) || 0, observacao);
      message.success(r.status === 'PAGO' ? 'Parcela quitada.' : 'Recebimento parcial registrado.');
      caixaStore.recarregar();
      onRecebido();
    } catch (e) {
      message.error(erroDe(e, 'Erro ao registrar o recebimento.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={Boolean(titulo)} title={titulo ? `Receber · ${titulo.cliente}` : ''} okText="Receber" cancelText="Cancelar"
      onOk={receber} confirmLoading={salvando} onCancel={onFechar} width={440} destroyOnHidden
      okButtonProps={{ disabled: !caixa || !(Number(valor) > 0) }}>
      {titulo && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            {titulo.descricao || `Parcela ${titulo.parcela}/${titulo.totalParcelas}`} · vence {dataBr(titulo.vencimento)} ·
            saldo <b>{brl(titulo.saldo)}</b>{titulo.diasAtraso > 0 && <Text type="danger"> · {titulo.diasAtraso} dia(s) de atraso</Text>}
          </Text>
          {carregado && !caixa && (
            <Alert type="warning" showIcon message="O recebimento entra no caixa do dia: abra o caixa primeiro."
              action={<Button size="small" onClick={() => caixaStore.mostrar('abrir')}>Abrir caixa</Button>} />
          )}
          <Select value={forma} onChange={setForma} style={{ width: '100%' }} options={FORMAS.map(f => ({ value: f, label: ROTULO_FORMA[f] || f }))} />
          <InputNumber prefix="R$" min={0} max={titulo.saldo} precision={2} decimalSeparator="," style={{ width: '100%' }} size="large"
            value={valor} onChange={setValor} />
          {Number(valor) > 0 && Number(valor) < titulo.saldo && <Text type="secondary" style={{ fontSize: 12 }}>Recebimento parcial: fica {brl(titulo.saldo - Number(valor))} em aberto.</Text>}
          <Input placeholder="Observação (opcional)" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={255} />
        </Space>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------
// Detalhe da parcela: recebimentos e estorno
// ---------------------------------------------------------------------------------------------
const DrawerTitulo: React.FC<{ titulo: Titulo | null; onFechar: () => void; onAlterado: () => void }> = ({ titulo, onFechar, onAlterado }) => {
  const [baixas, setBaixas] = useState<Baixa[]>([]);
  const carregar = () => { if (titulo) receberApi.baixas(titulo.idTitulo).then(setBaixas).catch(() => setBaixas([])); };
  useEffect(carregar, [titulo]);

  const estornar = (b: Baixa) => {
    let motivo = '';
    Modal.confirm({
      title: `Estornar recebimento de ${brl(b.valor)}?`,
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">O valor sai do caixa aberto e a parcela volta a ficar em aberto.</Text>
          <Input placeholder="Motivo (obrigatório)" onChange={e => { motivo = e.target.value; }} />
        </Space>
      ),
      okText: 'Estornar', okButtonProps: { danger: true }, cancelText: 'Voltar',
      onOk: async () => {
        if (!motivo.trim()) { message.warning('Informe o motivo.'); throw new Error('motivo'); }
        try {
          await receberApi.estornar(b.idBaixa, motivo);
          message.success('Recebimento estornado.');
          caixaStore.recarregar();
          carregar();
          onAlterado();
        } catch (e) {
          message.error(erroDe(e, 'Erro ao estornar.'));
          throw e;
        }
      },
    });
  };

  return (
    <Drawer open={Boolean(titulo)} onClose={onFechar} width={560} title={titulo ? `${titulo.cliente} · parcela ${titulo.parcela}/${titulo.totalParcelas}` : ''}>
      {titulo && (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Descriptions size="small" column={2} bordered items={[
            { key: 'v', label: 'Venda', children: titulo.idVenda ? `#${titulo.idVenda}` : '—' },
            { key: 'd', label: 'Vencimento', children: dataBr(titulo.vencimento) },
            { key: 'val', label: 'Valor', children: brl(titulo.valor) },
            { key: 'p', label: 'Pago', children: brl(titulo.valorPago) },
            { key: 's', label: 'Saldo', children: <b>{brl(titulo.saldo)}</b> },
            { key: 'st', label: 'Situação', children: <Tag color={ROTULO_SITUACAO[titulo.situacao].color}>{ROTULO_SITUACAO[titulo.situacao].label}</Tag> },
          ]} />
          <div>
            <Text strong>Recebimentos</Text>
            {baixas.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum recebimento" /> : (
              <Table size="small" rowKey="idBaixa" pagination={false} dataSource={baixas} columns={[
                { title: 'Quando', dataIndex: 'criadoEm', render: (v: string) => new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) },
                { title: 'Forma', dataIndex: 'forma', render: (f: string) => ROTULO_FORMA[f] || f },
                { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: (v: number, b) => <Text delete={Boolean(b.estornadoEm)}>{brl(v)}</Text> },
                { title: 'Caixa', dataIndex: 'idCaixa', render: (v: number | null, b) => <span>{v ? `#${v}` : '—'} <Text type="secondary" style={{ fontSize: 11 }}>· {b.operador}</Text></span> },
                {
                  title: '', key: 'a', width: 90,
                  render: (_, b) => b.estornadoEm
                    ? <Tag>estornado</Tag>
                    : <Button size="small" danger icon={<RollbackOutlined />} onClick={() => estornar(b)}>Estornar</Button>,
                },
              ]} />
            )}
          </div>
        </Space>
      )}
    </Drawer>
  );
};

// ---------------------------------------------------------------------------------------------
// Crédito do cliente
// ---------------------------------------------------------------------------------------------
const ModalCredito: React.FC<{ aberto: boolean; onFechar: () => void; onSalvo: () => void }> = ({ aberto, onFechar, onSalvo }) => {
  const [termo, setTermo] = useState('');
  const [opcoes, setOpcoes] = useState<ClienteBusca[]>([]);
  const [cliente, setCliente] = useState<ClienteBusca | null>(null);
  const [situacao, setSituacao] = useState<SituacaoCliente | null>(null);
  const [semLimite, setSemLimite] = useState(true);
  const [limite, setLimite] = useState<number | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (aberto) { setCliente(null); setSituacao(null); setTermo(''); setOpcoes([]); } }, [aberto]);
  useEffect(() => {
    if (termo.trim().length < 2) { setOpcoes([]); return; }
    const t = setTimeout(() => buscarClientesPdv(termo).then(setOpcoes), 300);
    return () => clearTimeout(t);
  }, [termo]);
  useEffect(() => {
    if (!cliente) return;
    receberApi.cliente(cliente.id).then(s => {
      setSituacao(s);
      setSemLimite(s.limite === null);
      setLimite(s.limite);
      setBloqueado(s.bloqueado);
      setObservacao(s.observacao || '');
    }).catch(e => message.error(erroDe(e, 'Erro ao carregar o cliente.')));
  }, [cliente]);

  const salvar = async () => {
    if (!cliente) return;
    setSalvando(true);
    try {
      await receberApi.salvarCredito(cliente.id, { limite: semLimite ? null : Number(limite) || 0, bloqueado, observacao });
      message.success('Crédito do cliente salvo.');
      onSalvo();
    } catch (e) {
      message.error(erroDe(e, 'Erro ao salvar o crédito.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={aberto} title="Crédito do cliente (venda a prazo)" okText="Salvar" cancelText="Fechar" onOk={salvar}
      okButtonProps={{ disabled: !cliente }} confirmLoading={salvando} onCancel={onFechar} width={480} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select showSearch filterOption={false} placeholder="Buscar cliente por nome, CPF ou CNPJ" style={{ width: '100%' }}
          onSearch={setTermo} notFoundContent={termo.length < 2 ? 'Digite ao menos 2 letras' : 'Nenhum cliente'}
          value={cliente?.id} onChange={id => setCliente(opcoes.find(o => o.id === id) || null)}
          options={opcoes.map(o => ({ value: o.id, label: `${o.nome}${o.documento ? ` · ${o.documento}` : ''}` }))} />
        {situacao && (
          <>
            <Text type="secondary">
              Em aberto: <b>{brl(situacao.emAberto)}</b>
              {situacao.qtdVencidas > 0 && <Text type="danger"> · {situacao.qtdVencidas} vencida(s) ({brl(situacao.vencido)})</Text>}
            </Text>
            <Space><Switch checked={!semLimite} onChange={v => setSemLimite(!v)} /> Definir limite de crédito</Space>
            {!semLimite && (
              <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} value={limite} onChange={setLimite}
                addonAfter={limite !== null ? `disponível ${brl(Math.max(0, Number(limite) - situacao.emAberto))}` : undefined} />
            )}
            <Space><Switch checked={bloqueado} onChange={setBloqueado} /> Bloquear compras a prazo</Space>
            <Input placeholder="Observação (ex.: motivo do bloqueio)" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={255} />
          </>
        )}
      </Space>
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------------------------
export const FinanceiroContasReceber: React.FC = () => {
  const [situacao, setSituacao] = useState<string>('ABERTO');
  const [busca, setBusca] = useState('');
  const [titulos, setTitulos] = useState<Titulo[]>([]);
  const [resumo, setResumo] = useState<ResumoReceber | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [recebendo, setRecebendo] = useState<Titulo | null>(null);
  const [detalhe, setDetalhe] = useState<Titulo | null>(null);
  const [creditoAberto, setCreditoAberto] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [lista, r] = await Promise.all([receberApi.listar({ situacao, busca: busca.trim() || undefined }), receberApi.resumo()]);
      setTitulos(lista);
      setResumo(r);
    } catch (e) {
      message.error(erroDe(e, 'Erro ao carregar as contas a receber.'));
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, [situacao]); // eslint-disable-line react-hooks/exhaustive-deps

  const indicador = (titulo: string, valor: React.ReactNode, cor?: string, onClick?: () => void) => (
    <Card size="small" hoverable={Boolean(onClick)} onClick={onClick} styles={{ body: { padding: '10px 14px' } }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{valor}</div>
    </Card>
  );

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Contas a Receber</Title>
            <Text type="secondary">Parcelas das vendas a prazo. O recebimento entra no caixa aberto.</Text>
          </div>
          <Space>
            <Button icon={<CreditCardOutlined />} onClick={() => setCreditoAberto(true)}>Crédito de cliente</Button>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          </Space>
        </div>

        <Row gutter={[10, 10]}>
          <Col xs={12} lg={5}>{indicador('Em aberto', brl(resumo?.emAberto || 0), undefined, () => setSituacao('ABERTO'))}</Col>
          <Col xs={12} lg={5}>{indicador(`Vencido${resumo?.qtdVencidos ? ` (${resumo.qtdVencidos})` : ''}`, brl(resumo?.vencido || 0), resumo?.vencido ? '#cf1322' : '#389e0d', () => setSituacao('VENCIDO'))}</Col>
          <Col xs={12} lg={4}>{indicador('Vence hoje', brl(resumo?.venceHoje || 0), resumo?.venceHoje ? '#d48806' : undefined)}</Col>
          <Col xs={12} lg={5}>{indicador('Próximos 7 dias', brl(resumo?.proximos7 || 0))}</Col>
          <Col xs={24} lg={5}>{indicador('Recebido no mês', brl(resumo?.recebidoMes || 0), '#389e0d', () => setSituacao('PAGO'))}</Col>
        </Row>

        <Card size="small">
          <Space wrap style={{ marginBottom: 10 }}>
            <Segmented value={situacao} onChange={v => setSituacao(String(v))} options={[
              { value: 'ABERTO', label: 'Em aberto' }, { value: 'VENCIDO', label: 'Vencidas' }, { value: 'A_VENCER', label: 'A vencer' },
              { value: 'PAGO', label: 'Pagas' }, { value: 'CANCELADO', label: 'Canceladas' }, { value: 'TODOS', label: 'Todas' },
            ]} />
            <Input allowClear prefix={<SearchOutlined />} placeholder="Cliente, descrição ou nº da venda" style={{ width: 260 }}
              value={busca} onChange={e => setBusca(e.target.value)} onPressEnter={carregar} />
            <Button onClick={carregar}>Buscar</Button>
          </Space>
          <Table<Titulo>
            size="small"
            rowKey="idTitulo"
            loading={carregando}
            dataSource={titulos}
            pagination={{ pageSize: 25, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma parcela. Elas nascem das vendas a prazo do PDV." /> }}
            onRow={t => ({ onDoubleClick: () => setDetalhe(t) })}
            columns={[
              { title: 'Vencimento', dataIndex: 'vencimento', width: 105, render: (v: string) => dataBr(v) },
              {
                title: 'Cliente', dataIndex: 'cliente',
                render: (c: string) => <a onClick={() => { setBusca(c); setTimeout(carregar, 0); }}>{c}</a>,
              },
              { title: 'Venda', dataIndex: 'idVenda', width: 80, render: (v: number | null) => (v ? `#${v}` : '—') },
              { title: 'Parcela', key: 'p', width: 75, render: (_, t) => `${t.parcela}/${t.totalParcelas}` },
              { title: 'Valor', dataIndex: 'valor', align: 'right' as const, render: (v: number) => brl(v) },
              { title: 'Pago', dataIndex: 'valorPago', align: 'right' as const, render: (v: number) => (v ? brl(v) : '') },
              { title: 'Saldo', dataIndex: 'saldo', align: 'right' as const, render: (v: number, t) => (t.status === 'ABERTO' ? <b>{brl(v)}</b> : '') },
              {
                title: 'Situação', key: 's', width: 150,
                render: (_, t) => (
                  <Space size={4}>
                    <Tag color={ROTULO_SITUACAO[t.situacao].color} style={{ margin: 0 }}>{ROTULO_SITUACAO[t.situacao].label}</Tag>
                    {t.diasAtraso > 0 && <Text type="danger" style={{ fontSize: 11 }}>{t.diasAtraso}d</Text>}
                  </Space>
                ),
              },
              {
                title: '', key: 'a', width: 150,
                render: (_, t) => (
                  <Space size={4}>
                    {t.status === 'ABERTO' && <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => setRecebendo(t)}>Receber</Button>}
                    <Tooltip title="Recebimentos e estorno"><Button size="small" onClick={() => setDetalhe(t)}>Detalhes</Button></Tooltip>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <ModalReceber titulo={recebendo} onFechar={() => setRecebendo(null)} onRecebido={() => { setRecebendo(null); carregar(); }} />
      <DrawerTitulo titulo={detalhe} onFechar={() => setDetalhe(null)} onAlterado={carregar} />
      <ModalCredito aberto={creditoAberto} onFechar={() => setCreditoAberto(false)} onSalvo={() => setCreditoAberto(false)} />
    </div>
  );
};

