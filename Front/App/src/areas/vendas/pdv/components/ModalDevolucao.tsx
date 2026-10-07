// Devolução parcial/total de uma venda e troca (devolução em crédito na loja + nova venda no PDV).
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Checkbox, Input, InputNumber, Modal, Radio, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { DadosDevolucao, devolucoesService, ReembolsoDevolucao } from '../services/salesService';
import { caixaStore } from '../../caixa/caixaStore';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const REEMBOLSOS: Array<{ valor: ReembolsoDevolucao; rotulo: string; ajuda: string }> = [
  { valor: 'DINHEIRO', rotulo: 'Dinheiro', ajuda: 'sai do caixa aberto' },
  { valor: 'PIX', rotulo: 'PIX', ajuda: 'sai do caixa aberto' },
  { valor: 'DEBITO', rotulo: 'Estorno no débito', ajuda: 'sai do caixa aberto' },
  { valor: 'CREDITO', rotulo: 'Estorno no crédito', ajuda: 'sai do caixa aberto' },
  { valor: 'CREDITO_LOJA', rotulo: 'Crédito na loja', ajuda: 'fica como saldo do cliente para a próxima compra' },
  { valor: 'ABATER_PRAZO', rotulo: 'Abater do a prazo', ajuda: 'reduz as parcelas em aberto desta venda' },
];

/** Troca: devolução em crédito na loja e o PDV abre com o crédito disponível no pagamento. */
export const CHAVE_TROCA = 'troca';

export const ModalDevolucao: React.FC<{ idVenda: number | null; onFechar: () => void; onConcluido: () => void }> = ({ idVenda, onFechar, onConcluido }) => {
  const navigate = useNavigate();
  const [dados, setDados] = useState<DadosDevolucao | null>(null);
  const [qtd, setQtd] = useState<Record<number, number | null>>({});
  const [voltaEstoque, setVoltaEstoque] = useState<Record<number, boolean>>({});
  const [reembolso, setReembolso] = useState<ReembolsoDevolucao>('DINHEIRO');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!idVenda) return;
    setDados(null); setQtd({}); setVoltaEstoque({}); setReembolso('DINHEIRO'); setMotivo('');
    devolucoesService.dados(idVenda).then(setDados).catch(e => { message.error(e.message); onFechar(); });
  }, [idVenda]); // eslint-disable-line react-hooks/exhaustive-deps

  // Estimativa (o servidor fecha os centavos exatos)
  const estimado = useMemo(() => (dados?.itens || []).reduce((a, i) => a + (Number(qtd[i.idVendaItem]) || 0) * i.valorUnitarioPago, 0), [dados, qtd]);
  const algumItem = Object.values(qtd).some(v => Number(v) > 0);
  const opcoes = REEMBOLSOS.filter(r => r.valor !== 'ABATER_PRAZO' || (dados?.saldoPrazo || 0) > 0);

  const enviar = async (troca: boolean) => {
    if (!dados) return;
    if (!motivo.trim()) { message.warning('Informe o motivo.'); return; }
    setSalvando(true);
    try {
      const r = await devolucoesService.registrar(dados.idVenda, {
        itens: dados.itens.filter(i => Number(qtd[i.idVendaItem]) > 0).map(i => ({ idVendaItem: i.idVendaItem, quantidade: Number(qtd[i.idVendaItem]), voltaEstoque: voltaEstoque[i.idVendaItem] !== false })),
        reembolso: troca ? 'CREDITO_LOJA' : reembolso,
        motivo,
      });
      caixaStore.recarregar();
      onConcluido();
      if (troca) {
        message.success(`Devolução ${r.idDevolucao}: crédito de ${brl(r.valor)}. Escolha os itens da troca.`);
        navigate(`/vendas/pdv?${CHAVE_TROCA}=${r.idDevolucao}`);
      } else {
        message.success(`Devolução ${r.idDevolucao} registrada: ${brl(r.valor)}.`);
      }
      onFechar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao registrar a devolução.';
      message.error(msg);
      if (/caixa/i.test(msg)) caixaStore.mostrar('abrir');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={idVenda !== null} onCancel={onFechar} width={820} title={`Devolução da venda Nº ${idVenda ?? ''}`} destroyOnHidden
      footer={[
        <Button key="v" onClick={onFechar}>Voltar</Button>,
        <Button key="t" disabled={!algumItem} loading={salvando} onClick={() => enviar(true)}>Trocar (crédito + nova venda)</Button>,
        <Button key="d" type="primary" danger disabled={!algumItem} loading={salvando} onClick={() => enviar(false)}>Devolver {brl(estimado)}</Button>,
      ]}>
      {!dados ? <Spin /> : (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Text type="secondary">
            {dados.cliente} · venda de {new Date(dados.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} · total {brl(dados.total)}
            {dados.totalDevolvido > 0 && <> · <Tag color="orange">já devolvido {brl(dados.totalDevolvido)}</Tag></>}
          </Text>
          {dados.status !== 'CONCLUIDA' && <Alert type="error" showIcon message="Venda cancelada: não aceita devolução." />}
          <Table size="small" rowKey="idVendaItem" pagination={false} dataSource={dados.itens} columns={[
            { title: 'Item', key: 'i', render: (_, i) => <span>{i.nome} <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}</Text>{i.servico && <Tag style={{ fontSize: 10, marginLeft: 4 }}>serviço</Tag>}</span> },
            { title: 'Vendido', key: 'v', width: 90, align: 'right' as const, render: (_, i) => `${i.quantidade.toLocaleString('pt-BR')} ${i.unidade}` },
            { title: 'Pago/un.', dataIndex: 'valorUnitarioPago', width: 90, align: 'right' as const, render: (v: number) => brl(v) },
            {
              title: 'Devolver', key: 'd', width: 150,
              render: (_, i) => (i.restante <= 0
                ? <Text type="secondary">tudo devolvido</Text>
                : <InputNumber size="small" min={0} max={i.restante} precision={3} decimalSeparator="," style={{ width: 130 }} placeholder={`até ${i.restante}`}
                    value={qtd[i.idVendaItem] ?? null} onChange={v => setQtd(x => ({ ...x, [i.idVendaItem]: v }))}
                    addonAfter={<a onClick={() => setQtd(x => ({ ...x, [i.idVendaItem]: i.restante }))}>tudo</a>} />),
            },
            {
              title: 'Volta ao estoque', key: 'e', width: 120, align: 'center' as const,
              render: (_, i) => (i.servico ? '—' : (
                <Checkbox checked={voltaEstoque[i.idVendaItem] !== false} disabled={!(Number(qtd[i.idVendaItem]) > 0)}
                  onChange={e => setVoltaEstoque(x => ({ ...x, [i.idVendaItem]: e.target.checked }))}>
                  {voltaEstoque[i.idVendaItem] === false ? <Text type="danger" style={{ fontSize: 12 }}>defeito</Text> : 'sim'}
                </Checkbox>
              )),
            },
          ]} />
          <div>
            <Text strong>Como devolver o valor</Text>
            <Radio.Group value={reembolso} onChange={e => setReembolso(e.target.value)} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {opcoes.map(o => <Radio.Button key={o.valor} value={o.valor}>{o.rotulo}</Radio.Button>)}
            </Radio.Group>
            <div><Text type="secondary" style={{ fontSize: 12 }}>
              {REEMBOLSOS.find(r => r.valor === reembolso)?.ajuda}
              {reembolso === 'ABATER_PRAZO' && ` (saldo a prazo: ${brl(dados.saldoPrazo)})`}
              {reembolso === 'CREDITO_LOJA' && !dados.idCliente && ' — venda sem cliente: o crédito só fica disponível numa troca agora'}
            </Text></div>
          </div>
          <Input placeholder="Motivo (obrigatório): não serviu, defeito, troca de medida..." value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={255} />
          {dados.devolucoes.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Devoluções anteriores: {dados.devolucoes.map(d => `Nº ${d.idDevolucao} (${brl(d.valor)}, ${d.reembolso.toLowerCase().replace('_', ' ')})`).join(' · ')}
            </Text>
          )}
        </Space>
      )}
    </Modal>
  );
};

export default ModalDevolucao;
