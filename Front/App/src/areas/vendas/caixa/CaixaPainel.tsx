// Caixa do PDV: indicador no cabeçalho e os painéis (abrir, resumo, sangria/suprimento, fechar).
// Os painéis ficam montados no cabeçalho do PDV; qualquer tela abre um deles por caixaStore.mostrar(...).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Descriptions, Drawer, Empty, Input, InputNumber, Modal, Select, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { MinusCircleOutlined, PlusCircleOutlined, PrinterOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { caixaApi, FORMAS_SEM_CONFERENCIA, LinhaConferencia, operadorAtual, ResumoCaixa, ROTULO_FORMA, ROTULO_MOVIMENTO, Caixa } from './caixaApi';
import { caixaStore, useCaixa } from './caixaStore';
import { imprimirHtml } from '../../../shared/core/impressao/saida';
import { adiantamentosApi } from '../pdv/services/adiantamentosApi';
import { buscarClientesPdv, ClienteBusca } from '../pdv/services/api/products';

const { Text } = Typography;
export const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hora = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const erroDe = (e: unknown, padrao: string) => (e instanceof Error ? e.message : padrao);

// ---------------------------------------------------------------------------------------------
// Indicador no cabeçalho
// ---------------------------------------------------------------------------------------------
export const CaixaIndicador: React.FC = () => {
  const { caixa, carregado, resumo } = useCaixa();
  useEffect(() => { if (!carregado) caixaStore.recarregar(); }, [carregado]);
  if (!carregado) return null;
  if (!caixa) {
    return (
      <Tooltip title="Sem caixa aberto não é possível vender">
        <Button size="small" danger icon={<LockOutlined />} onClick={() => caixaStore.mostrar('abrir')}>Caixa fechado · Abrir</Button>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={`Dinheiro esperado na gaveta: ${brl(resumo?.dinheiroEsperado || 0)} · clique para sangria, suprimento ou fechamento`}>
      <Button size="small" icon={<UnlockOutlined style={{ color: '#16a34a' }} />} onClick={() => caixaStore.mostrar('resumo')}>
        Caixa {caixa.idCaixa} · {caixa.operador} · desde {new Date(caixa.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </Button>
    </Tooltip>
  );
};

// ---------------------------------------------------------------------------------------------
// Tabela do resumo (usada no painel e no histórico)
// ---------------------------------------------------------------------------------------------
export const TabelaResumoCaixa: React.FC<{ resumo: ResumoCaixa; fechamento?: LinhaConferencia[] }> = ({ resumo, fechamento }) => (
  <Table
    size="small"
    rowKey="forma"
    pagination={false}
    dataSource={resumo.linhas}
    columns={[
      { title: 'Forma', dataIndex: 'forma', render: (f: string) => <b>{ROTULO_FORMA[f] || f}</b> },
      { title: 'Abertura', dataIndex: 'abertura', align: 'right' as const, render: (v: number) => (v ? brl(v) : '') },
      { title: 'Vendas', dataIndex: 'vendas', align: 'right' as const, render: (v: number) => brl(v) },
      { title: 'Entradas', key: 'ent', align: 'right' as const, render: (_, l) => (l.suprimentos + l.recebimentos ? brl(l.suprimentos + l.recebimentos) : '') },
      { title: 'Saídas', key: 'sai', align: 'right' as const, render: (_, l) => (l.sangrias + l.estornos ? <Text type="danger">-{brl(l.sangrias + l.estornos)}</Text> : '') },
      { title: 'Esperado', dataIndex: 'esperado', align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
      ...(fechamento ? [
        { title: 'Contado', key: 'cont', align: 'right' as const, render: (_: unknown, l: { forma: string }) => { const f = fechamento.find(x => x.forma === l.forma); return f ? brl(f.informado) : <Text type="secondary">não conta</Text>; } },
        {
          title: 'Diferença', key: 'dif', align: 'right' as const,
          render: (_: unknown, l: { forma: string }) => {
            const f = fechamento.find(x => x.forma === l.forma);
            if (!f) return '';
            const d = f.diferenca;
            return <Text type={d < 0 ? 'danger' : d > 0 ? 'warning' : 'success'}>{d > 0 ? '+' : ''}{brl(d)}</Text>;
          },
        },
      ] : []),
    ]}
  />
);

export const ListaMovimentosCaixa: React.FC<{ resumo: ResumoCaixa }> = ({ resumo }) => resumo.movimentos.length === 0
  ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem sangria, suprimento ou estorno" />
  : (
    <Table
      size="small"
      rowKey="idMovimento"
      pagination={false}
      dataSource={resumo.movimentos}
      columns={[
        { title: 'Quando', dataIndex: 'criadoEm', width: 95, render: (v: string) => hora(v) },
        { title: 'Tipo', dataIndex: 'tipo', render: (t: string) => <Tag color={ROTULO_MOVIMENTO[t]?.color}>{ROTULO_MOVIMENTO[t]?.label || t}</Tag> },
        { title: 'Motivo', dataIndex: 'motivo', render: (m: string | null, r) => <span>{m || '—'} <Text type="secondary" style={{ fontSize: 11 }}>· {r.operador}</Text></span> },
        {
          title: 'Valor', key: 'valor', align: 'right' as const,
          render: (_, m) => <Text type={ROTULO_MOVIMENTO[m.tipo]?.sinal === -1 ? 'danger' : 'success'}>{ROTULO_MOVIMENTO[m.tipo]?.sinal === -1 ? '-' : '+'}{brl(m.valor)}</Text>,
        },
      ]}
    />
  );

// Comprovante de fechamento (80mm)
export const imprimirFechamento = (caixa: Caixa, resumo: ResumoCaixa, conferencia: LinhaConferencia[], diferencaTotal: number) => {
  const linha = (a: string, b: string) => `<tr><td>${a}</td><td style="text-align:right">${b}</td></tr>`;
  const movimentos = resumo.movimentos
    .map(m => linha(`${ROTULO_MOVIMENTO[m.tipo]?.label || m.tipo}${m.motivo ? ` (${m.motivo})` : ''}`, `${ROTULO_MOVIMENTO[m.tipo]?.sinal === -1 ? '-' : '+'}${m.valor.toFixed(2)}`))
    .join('');
  const html = `<html><head><meta charset="utf-8"><style>
    body{font-family:monospace;font-size:12px;width:72mm;margin:0 auto} h3{text-align:center;margin:4px 0}
    table{width:100%;border-collapse:collapse} td{padding:1px 0} hr{border:0;border-top:1px dashed #000}
  </style></head><body>
    <h3>FECHAMENTO DE CAIXA ${caixa.idCaixa}</h3>
    <table>${linha('Abertura', `${hora(caixa.abertoEm)} · ${caixa.operador}`)}${linha('Fechamento', `${hora(new Date().toISOString())} · ${operadorAtual()}`)}
    ${linha('Troco inicial', brl(caixa.valorAbertura))}${linha('Vendas', `${resumo.vendas.concluidas} · ${brl(resumo.vendas.total)}`)}
    ${resumo.vendas.canceladas ? linha('Canceladas', String(resumo.vendas.canceladas)) : ''}</table><hr/>
    <table><tr><td><b>Forma</b></td><td style="text-align:right"><b>Esperado</b></td><td style="text-align:right"><b>Contado</b></td><td style="text-align:right"><b>Dif.</b></td></tr>
    ${conferencia.map(c => `<tr><td>${ROTULO_FORMA[c.forma] || c.forma}</td><td style="text-align:right">${c.esperado.toFixed(2)}</td><td style="text-align:right">${c.informado.toFixed(2)}</td><td style="text-align:right">${c.diferenca.toFixed(2)}</td></tr>`).join('')}
    </table><hr/>
    ${movimentos ? `<table>${movimentos}</table><hr/>` : ''}
    <table>${linha('<b>DIFERENÇA TOTAL</b>', `<b>${diferencaTotal.toFixed(2)}</b>`)}</table>
    <br/><br/><p>______________________________<br/>Assinatura</p>
  </body></html>`;
  return imprimirHtml(html);
};

// ---------------------------------------------------------------------------------------------
// Painéis
// ---------------------------------------------------------------------------------------------
const ModalAbrir: React.FC = () => {
  const { painel } = useCaixa();
  const [valor, setValor] = useState<number | null>(0);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (painel === 'abrir') setValor(0); }, [painel]);

  const abrir = async () => {
    setSalvando(true);
    try {
      const r = await caixaApi.abrir(Number(valor) || 0);
      caixaStore.aplicar(r.caixa, r.resumo);
      caixaStore.mostrar(null);
      message.success(`Caixa ${r.caixa.idCaixa} aberto.`);
    } catch (e) {
      message.error(erroDe(e, 'Erro ao abrir o caixa.'));
      caixaStore.recarregar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={painel === 'abrir'} title="Abrir caixa" okText="Abrir caixa" cancelText="Cancelar" confirmLoading={salvando}
      onOk={abrir} onCancel={() => caixaStore.mostrar(null)} width={380} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>Operador: <b>{operadorAtual()}</b> <Text type="secondary" style={{ fontSize: 11 }}>(Configurações › Meu Perfil)</Text></Text>
        <Text strong>Troco inicial na gaveta</Text>
        <InputNumber autoFocus prefix="R$" min={0} step={10} precision={2} decimalSeparator="," style={{ width: '100%' }} size="large"
          value={valor} onChange={setValor} onPressEnter={abrir} />
      </Space>
    </Modal>
  );
};

const ModalMovimento: React.FC = () => {
  const { painel, resumo } = useCaixa();
  const tipo = painel === 'SANGRIA' || painel === 'SUPRIMENTO' ? painel : null;
  const [valor, setValor] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setValor(null); setMotivo(''); }, [tipo]);

  const salvar = async () => {
    if (!tipo) return;
    setSalvando(true);
    try {
      const r = await caixaApi.movimento(tipo, Number(valor) || 0, motivo);
      caixaStore.aplicar(r.caixa, r.resumo);
      caixaStore.mostrar('resumo');
      message.success(tipo === 'SANGRIA' ? 'Sangria registrada.' : 'Suprimento registrado.');
    } catch (e) {
      message.error(erroDe(e, 'Erro ao lançar o movimento.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={Boolean(tipo)} title={tipo === 'SANGRIA' ? 'Sangria (retirada de dinheiro)' : 'Suprimento (reforço de troco)'}
      okText="Registrar" cancelText="Voltar" confirmLoading={salvando} onOk={salvar} onCancel={() => caixaStore.mostrar('resumo')}
      okButtonProps={{ disabled: !(Number(valor) > 0) || (tipo === 'SANGRIA' && !motivo.trim()) }} width={400} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }}>
        {tipo === 'SANGRIA' && <Text type="secondary">Dinheiro esperado na gaveta: <b>{brl(resumo?.dinheiroEsperado || 0)}</b></Text>}
        <InputNumber autoFocus prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} size="large" value={valor} onChange={setValor} />
        <Input placeholder={tipo === 'SANGRIA' ? 'Motivo (obrigatório): depósito, pagamento de frete...' : 'Motivo (opcional)'}
          value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={255} onPressEnter={salvar} />
      </Space>
    </Modal>
  );
};

const ModalFechar: React.FC = () => {
  const { painel, resumo, caixa } = useCaixa();
  const aberto = painel === 'fechar';
  const [contagem, setContagem] = useState<Record<string, number | null>>({});
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setContagem({}); setObservacao(''); } }, [aberto]);

  const linhas = useMemo(() => (resumo?.linhas || []).filter(l => !FORMAS_SEM_CONFERENCIA.includes(l.forma)), [resumo]);
  const diferencaDe = (forma: string, esperado: number) => Number(((Number(contagem[forma]) || 0) - esperado).toFixed(2));
  const faltaContar = linhas.filter(l => contagem[l.forma] === undefined || contagem[l.forma] === null).map(l => ROTULO_FORMA[l.forma] || l.forma);

  const fechar = async () => {
    if (!caixa || !resumo) return;
    setSalvando(true);
    try {
      const valores = Object.fromEntries(linhas.map(l => [l.forma, Number(contagem[l.forma]) || 0]));
      const r = await caixaApi.fechar(valores, observacao);
      caixaStore.aplicar(null, null);
      caixaStore.mostrar(null);
      Modal.success({
        title: `Caixa ${r.idCaixa} fechado`,
        content: <span>Diferença total: <b style={{ color: r.diferencaTotal < 0 ? '#cf1322' : r.diferencaTotal > 0 ? '#d48806' : '#389e0d' }}>{brl(r.diferencaTotal)}</b></span>,
        okText: 'Imprimir comprovante',
        onOk: () => imprimirFechamento(caixa, r.resumo, r.conferencia, r.diferencaTotal),
        closable: true,
      });
    } catch (e) {
      message.error(erroDe(e, 'Erro ao fechar o caixa.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={aberto} title={`Fechar caixa ${caixa?.idCaixa ?? ''}`} okText="Fechar caixa" cancelText="Voltar" confirmLoading={salvando}
      onOk={() => Modal.confirm({
        title: faltaContar.length ? `Sem contagem em: ${faltaContar.join(', ')}` : 'Fechar o caixa?',
        content: faltaContar.length ? 'O que não foi contado vale zero e entra como diferença.' : 'Depois de fechado não dá para lançar vendas nem movimentos neste caixa.',
        okText: 'Fechar caixa', cancelText: 'Voltar', onOk: fechar,
      })}
      onCancel={() => caixaStore.mostrar('resumo')} width={560} destroyOnHidden>
      <Text type="secondary">Conte o dinheiro da gaveta e confira cartão/PIX na maquininha e no extrato. Informe o valor contado de cada forma.</Text>
      <Table
        size="small"
        rowKey="forma"
        pagination={false}
        style={{ marginTop: 8 }}
        dataSource={linhas}
        columns={[
          { title: 'Forma', dataIndex: 'forma', render: (f: string) => <b>{ROTULO_FORMA[f] || f}</b> },
          { title: 'Esperado', dataIndex: 'esperado', align: 'right' as const, render: (v: number) => brl(v) },
          {
            title: 'Contado', key: 'contado', width: 150,
            render: (_, l) => (
              <InputNumber size="small" prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }}
                value={contagem[l.forma] ?? null} onChange={v => setContagem(c => ({ ...c, [l.forma]: v }))} />
            ),
          },
          {
            title: 'Diferença', key: 'dif', align: 'right' as const, width: 110,
            render: (_, l) => {
              if (contagem[l.forma] === undefined || contagem[l.forma] === null) return <Text type="secondary">—</Text>;
              const d = diferencaDe(l.forma, l.esperado);
              return <Text type={d < 0 ? 'danger' : d > 0 ? 'warning' : 'success'}>{d > 0 ? '+' : ''}{brl(d)}</Text>;
            },
          },
        ]}
      />
      <Input.TextArea style={{ marginTop: 10 }} rows={2} maxLength={255} placeholder="Observação (ex.: explicação de diferença)"
        value={observacao} onChange={e => setObservacao(e.target.value)} />
    </Modal>
  );
};

// Sinal / adiantamento avulso (entra no caixa e depois paga a venda do cliente)
const ModalSinal: React.FC = () => {
  const { painel } = useCaixa();
  const aberto = painel === 'sinal';
  const [opcoes, setOpcoes] = useState<ClienteBusca[]>([]);
  const [cliente, setCliente] = useState<ClienteBusca | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [forma, setForma] = useState('DINHEIRO');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setCliente(null); setValor(null); setForma('DINHEIRO'); setObservacao(''); setOpcoes([]); } }, [aberto]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await adiantamentosApi.criar({ idCliente: cliente?.id ?? null, clienteNome: cliente?.nome, valor: Number(valor) || 0, forma, observacao });
      message.success(`Sinal Nº ${r.idAdiantamento} recebido. Ele aparece como forma de pagamento "Sinal" na venda do cliente.`);
      caixaStore.recarregar();
      caixaStore.mostrar('resumo');
    } catch (e) {
      message.error(erroDe(e, 'Erro ao receber o sinal.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={aberto} title="Receber sinal (adiantamento)" okText="Receber" cancelText="Voltar" confirmLoading={salvando}
      okButtonProps={{ disabled: !cliente || !(Number(valor) > 0) }} onOk={salvar} onCancel={() => caixaStore.mostrar('resumo')} destroyOnHidden width={440}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>O valor entra no caixa agora e fica guardado em nome do cliente para abater na venda.</Text>
        <Select showSearch filterOption={false} placeholder="Cliente (nome, CPF ou CNPJ)" style={{ width: '100%' }}
          onSearch={t => { if (t.trim().length >= 2) buscarClientesPdv(t).then(setOpcoes); }}
          value={cliente?.id} onChange={id => setCliente(opcoes.find(o => o.id === id) || null)}
          options={opcoes.map(o => ({ value: o.id, label: `${o.nome}${o.documento ? ` · ${o.documento}` : ''}` }))} />
        <Space.Compact style={{ width: '100%' }}>
          <Select value={forma} onChange={setForma} style={{ width: 150 }}
            options={['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TRANSFERENCIA'].map(f => ({ value: f, label: ROTULO_FORMA[f] }))} />
          <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} value={valor} onChange={setValor} />
        </Space.Compact>
        <Input placeholder="Observação (ex.: sinal da encomenda de ...)" value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={255} />
      </Space>
    </Modal>
  );
};

const DrawerResumo: React.FC = () => {
  const { painel, caixa, resumo, carregando } = useCaixa();
  return (
    <Drawer open={painel === 'resumo'} onClose={() => caixaStore.mostrar(null)} width={620}
      title={caixa ? `Caixa ${caixa.idCaixa} · ${caixa.operador}` : 'Caixa'}
      extra={caixa && (
        <Space>
          <Button onClick={() => caixaStore.mostrar('sinal')}>Receber sinal</Button>
          <Button icon={<PlusCircleOutlined />} onClick={() => caixaStore.mostrar('SUPRIMENTO')}>Suprimento</Button>
          <Button icon={<MinusCircleOutlined />} onClick={() => caixaStore.mostrar('SANGRIA')}>Sangria</Button>
          <Button type="primary" danger icon={<LockOutlined />} onClick={() => caixaStore.mostrar('fechar')}>Fechar</Button>
        </Space>
      )}>
      {!caixa || !resumo ? (
        <Empty description="Nenhum caixa aberto"><Button type="primary" onClick={() => caixaStore.mostrar('abrir')}>Abrir caixa</Button></Empty>
      ) : (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Descriptions size="small" column={2} bordered items={[
            { key: 'a', label: 'Aberto em', children: hora(caixa.abertoEm) },
            { key: 't', label: 'Troco inicial', children: brl(caixa.valorAbertura) },
            { key: 'v', label: 'Vendas', children: `${resumo.vendas.concluidas} · ${brl(resumo.vendas.total)}` },
            { key: 'c', label: 'Canceladas', children: resumo.vendas.canceladas },
            { key: 'd', label: 'Dinheiro na gaveta', children: <b style={{ fontSize: 16 }}>{brl(resumo.dinheiroEsperado)}</b> },
            {
              key: 'm', label: 'Margem (líquida de taxas)',
              children: resumo.vendas.total > 0
                ? <Tooltip title={`Taxas de cartão/meios de pagamento: ${brl(resumo.vendas.taxas || 0)}`}>{(((resumo.vendas.total - resumo.vendas.custo - (resumo.vendas.taxas || 0)) / resumo.vendas.total) * 100).toFixed(1)}%</Tooltip>
                : '—',
            },
          ]} />
          <div>
            <Text strong>Por forma de pagamento</Text>
            <TabelaResumoCaixa resumo={resumo} />
          </div>
          <div>
            <Text strong>Movimentos</Text>
            <ListaMovimentosCaixa resumo={resumo} />
          </div>
          <Button size="small" icon={<PrinterOutlined />} loading={carregando} onClick={() => caixaStore.recarregar()}>Atualizar</Button>
        </Space>
      )}
    </Drawer>
  );
};

/** Monta todos os painéis do caixa (fica no cabeçalho do PDV). */
export const CaixaPaineis: React.FC = () => (
  <>
    <ModalAbrir />
    <ModalMovimento />
    <ModalFechar />
    <ModalSinal />
    <DrawerResumo />
  </>
);

/** Aviso na tela de venda quando não há caixa aberto. */
export const AvisoCaixaFechado: React.FC = () => {
  const { caixa, carregado, erro } = useCaixa();
  if (!carregado || caixa) return null;
  return (
    <Alert type="error" showIcon style={{ marginBottom: 8 }}
      message={erro ? `Não foi possível verificar o caixa: ${erro}` : 'Caixa fechado: abra o caixa para vender.'}
      action={<Button size="small" type="primary" danger onClick={() => (erro ? caixaStore.recarregar() : caixaStore.mostrar('abrir'))}>{erro ? 'Tentar de novo' : 'Abrir caixa'}</Button>} />
  );
};
