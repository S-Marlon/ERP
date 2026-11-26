// Negociação › "Pagamentos já recebidos": o que o cliente já pagou deste orçamento (ex.: o 1/3 antecipado no PIX). Cada
// pagamento vira um sinal (adiantamento) ligado ao orçamento: entra no caixa aberto do dia e, quando o orçamento vira
// venda no PDV, já aparece como "Sinal" para abater do total. Devolver um sinal fica no Caixa.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Flex, Input, Select, Table, Tag, Typography, message } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { CampoDinheiro } from '../../../shared/formularios/CamposNumero';
import { Adiantamento, adiantamentosApi } from '../pdv/services/adiantamentosApi';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMAS = [
  { value: 'PIX', label: 'PIX' }, { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'DEBITO', label: 'Débito' }, { value: 'CREDITO', label: 'Crédito' },
];
const STATUS: Record<string, { texto: string; cor: string }> = {
  ABERTO: { texto: 'a abater na venda', cor: 'blue' }, USADO: { texto: 'usado na venda', cor: 'green' }, DEVOLVIDO: { texto: 'devolvido', cor: 'default' },
};

/** Valor recebido que conta (devolvido não conta). */
export const totalRecebido = (lista: Adiantamento[]) =>
  Math.round(lista.filter(a => a.status !== 'DEVOLVIDO').reduce((s, a) => s + a.valor, 0) * 100) / 100;

export const PagamentosRecebidos: React.FC<{
  idPedido: number; cliente?: { id: number; nome: string } | null; valorSugerido: number; formaSugerida: string | null; aPagar: number;
  onMudou: (lista: Adiantamento[]) => void;
}> = ({ idPedido, cliente, valorSugerido, formaSugerida, aPagar, onMudou }) => {
  const [lista, setLista] = useState<Adiantamento[]>([]);
  const [valor, setValor] = useState<number | null>(null);
  const [forma, setForma] = useState<string>('PIX');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    adiantamentosApi.listar({ origem: 'ORCAMENTO', idOrigem: idPedido, status: 'TODOS' })
      .then(l => { setLista(l); onMudou(l); })
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar os pagamentos.'));
  }, [idPedido]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (formaSugerida && FORMAS.some(f => f.value === formaSugerida)) setForma(formaSugerida); }, [formaSugerida]);

  const recebido = totalRecebido(lista);
  const falta = Math.max(0, Math.round((aPagar - recebido) * 100) / 100);
  const registrar = async () => {
    const v = Number(valor) || 0;
    if (!(v > 0)) { message.warning('Informe o valor recebido.'); return; }
    if (v > falta + 0.004) { message.warning(`Passa do que falta receber (${brl(falta)}).`); return; }
    setSalvando(true);
    try {
      await adiantamentosApi.criar({
        idCliente: cliente?.id ?? null, clienteNome: cliente?.nome, valor: v, forma, origem: 'ORCAMENTO', idOrigem: idPedido,
        observacao: obs.trim() || `Pagamento do orçamento Nº ${idPedido}`,
      });
      message.success(`${brl(v)} registrado como recebido do orçamento Nº ${idPedido}.`);
      setValor(null); setObs(''); carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao registrar.'); } finally { setSalvando(false); }
  };

  return (
    <Card size="small" title="Pagamentos já recebidos"
      extra={<Text type="secondary" style={{ fontSize: 12 }}>recebido <b>{brl(recebido)}</b> · falta <b>{brl(falta)}</b></Text>}>
      {lista.length > 0 && (
        <Table size="small" pagination={false} rowKey="idAdiantamento" dataSource={lista} style={{ marginBottom: 8 }}
          columns={[
            { title: 'Nº', dataIndex: 'idAdiantamento', width: 60 },
            { title: 'Data', width: 100, render: (_, a) => new Date(a.criadoEm).toLocaleDateString('pt-BR') },
            { title: 'Forma', width: 110, render: (_, a) => FORMAS.find(f => f.value === a.forma)?.label || a.forma },
            { title: 'Valor', align: 'right', width: 110, render: (_, a) => brl(a.valor) },
            { title: 'Situação', render: (_, a) => <Tag color={STATUS[a.status]?.cor} style={{ margin: 0 }}>{STATUS[a.status]?.texto || a.status}</Tag> },
            { title: 'Obs.', render: (_, a) => <Text type="secondary" style={{ fontSize: 12 }}>{a.observacao || ''}</Text> },
          ]} />
      )}
      <Flex gap={8} wrap align="center">
        <CampoDinheiro style={{ width: 150 }} min={0} value={valor} placeholder={valorSugerido > 0 ? brl(Math.min(valorSugerido, falta)) : 'Valor'}
          onChange={v => setValor(v === null || v === undefined ? null : Number(v))} />
        <Button size="small" type="link" disabled={!(valorSugerido > 0) || !(falta > 0)} onClick={() => setValor(Math.min(valorSugerido, falta))}>usar {brl(Math.min(valorSugerido, falta))}</Button>
        <Select style={{ width: 140 }} value={forma} onChange={setForma} options={FORMAS} />
        <Input style={{ flex: 1, minWidth: 180 }} maxLength={255} placeholder="Observação (ex.: PIX do sinal de 1/3)" value={obs} onChange={e => setObs(e.target.value)} />
        <Button type="primary" icon={<DollarOutlined />} loading={salvando} disabled={!(falta > 0)} onClick={registrar}>Registrar recebido</Button>
      </Flex>
      <Alert type="info" showIcon style={{ marginTop: 8 }}
        message="O valor entra no caixa aberto de hoje como sinal deste orçamento. Quando o orçamento virar venda no PDV, ele já aparece como “Sinal” e abate do total." />
    </Card>
  );
};
