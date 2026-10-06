// Boletos da nota de entrada: lança as duplicatas do XML (ajustáveis) no contas a pagar, dispensa com motivo
// (nota paga à vista) ou desfaz. Enquanto houver duplicata sem lançamento, a aprovação da nota fica bloqueada.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Input, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { CobrancaDaNota, dataBr, FORMAS_PAGAMENTO, FormaPagamento, ParcelaLancamento, pagarApi } from '../../../Financeiro/pagar/pagarApi';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface LinhaEdicao extends ParcelaLancamento { chave: number }

const STATUS_TITULO: Record<string, { cor: string; rotulo: string }> = {
  ABERTO: { cor: 'gold', rotulo: 'Em aberto' }, PAGO: { cor: 'green', rotulo: 'Pago' }, CANCELADO: { cor: 'default', rotulo: 'Cancelado' },
};

export const CobrancaNota: React.FC<{ idLote: number; dados: CobrancaDaNota | null; onAlterado: () => void }> = ({ idLote, dados, onAlterado }) => {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<LinhaEdicao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [dispensando, setDispensando] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Parcelas começam iguais às duplicatas do XML (o operador ajusta se o boleto vier diferente)
  useEffect(() => {
    setLinhas((dados?.cobranca.duplicatas || []).map((d, i) => ({
      chave: i, numero: d.numero, vencimento: d.vencimento || '', valor: d.valor, codigoBarras: null, forma: 'BOLETO' as FormaPagamento,
    })));
  }, [dados?.idLote, dados?.cobranca.duplicatas]);

  if (!dados) return <Text type="secondary">Carregando a cobrança...</Text>;
  const s = dados.situacao;
  const ativos = dados.titulos.filter(t => t.status !== 'CANCELADO');
  const lancado = ativos.length > 0;
  const total = Math.round(linhas.reduce((a, l) => a + (Number(l.valor) || 0), 0) * 100) / 100;
  const alterar = (chave: number, campo: Partial<LinhaEdicao>) => setLinhas(ls => ls.map(l => (l.chave === chave ? { ...l, ...campo } : l)));

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setSalvando(true);
    try {
      await acao();
      message.success(sucesso);
      setDispensando(false); setMotivo('');
      onAlterado();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setSalvando(false);
    }
  };

  const lancar = () => executar(
    () => pagarApi.lancar(idLote, linhas.map(l => ({ numero: l.numero, vencimento: l.vencimento, valor: l.valor, codigoBarras: l.codigoBarras, forma: l.forma }))),
    `${linhas.length} parcela(s) lançada(s) no contas a pagar.`
  );

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      {lancado ? (
        <Alert type="success" showIcon message={`Lançado no contas a pagar: ${ativos.length} parcela(s), total ${brl(s.totalTitulos)}.`}
          description={s.duplicatas > 0 && Math.abs(s.totalTitulos - s.totalDuplicatas) > 0.009
            ? <Text type="warning">Diferente do total das duplicatas da nota ({brl(s.totalDuplicatas)}).</Text> : undefined} />
      ) : s.dispensado ? (
        <Alert type="info" showIcon message="Cobrança dispensada" description={dados.financeiroObservacao} />
      ) : s.duplicatas > 0 ? (
        <Alert type="warning" showIcon message={`${s.duplicatas} boleto(s) desta nota ainda não lançado(s) no contas a pagar`}
          description="A aprovação da nota fica bloqueada até lançar os boletos ou dispensar (nota já paga / à vista)." />
      ) : (
        <Alert type="info" showIcon message="A nota não traz duplicatas no grupo de cobrança."
          description="Se o fornecedor mandou boleto por fora, adicione as parcelas abaixo e lance." />
      )}

      {!dados.fornecedor.id && !lancado && (
        <Alert type="error" showIcon message="Fornecedor da nota não cadastrado: cadastre-o antes de lançar os boletos." />
      )}

      {lancado ? (
        <>
          <Table size="small" rowKey="idTitulo" pagination={false} dataSource={ativos} columns={[
            { title: 'Parcela', key: 'p', width: 80, render: (_, t) => `${t.parcela}/${t.totalParcelas}` },
            { title: 'Documento', dataIndex: 'numeroDocumento', width: 110 },
            { title: 'Vencimento', dataIndex: 'vencimento', width: 100, render: (v: string, t) => <Text type={t.vencido ? 'danger' : undefined}>{dataBr(v)}</Text> },
            { title: 'Valor', dataIndex: 'valor', width: 110, align: 'right' as const, render: (v: number) => brl(v) },
            { title: 'Forma', dataIndex: 'forma', width: 100, render: (v: string) => FORMAS_PAGAMENTO.find(f => f.value === v)?.label || v },
            { title: 'Situação', dataIndex: 'status', render: (v: string, t) => <Tag color={STATUS_TITULO[v]?.cor}>{STATUS_TITULO[v]?.rotulo}{t.pagoEm ? ` em ${dataBr(t.pagoEm)}` : ''}</Tag> },
          ]} />
          <Space>
            <Popconfirm title="Desfazer o lançamento?" description="As parcelas em aberto desta nota são canceladas no contas a pagar." okText="Desfazer" cancelText="Voltar"
              onConfirm={() => executar(() => pagarApi.desfazer(idLote), 'Lançamento desfeito.')}>
              <Button danger loading={salvando}>Desfazer lançamento</Button>
            </Popconfirm>
            <Button type="link" onClick={() => navigate('/financeiro/pagar')}>Abrir contas a pagar</Button>
          </Space>
        </>
      ) : s.dispensado ? (
        <Button loading={salvando} onClick={() => executar(() => pagarApi.desfazer(idLote), 'Dispensa desfeita.')}>Desfazer dispensa</Button>
      ) : (
        <>
          <Table size="small" rowKey="chave" pagination={false} dataSource={linhas}
            locale={{ emptyText: 'Nenhuma parcela' }}
            footer={() => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button size="small" icon={<PlusOutlined />}
                  onClick={() => setLinhas(ls => [...ls, { chave: Date.now(), numero: null, vencimento: '', valor: 0, codigoBarras: null, forma: 'BOLETO' }])}>
                  Parcela
                </Button>
                <span>
                  Total <b>{brl(total)}</b>
                  {s.duplicatas > 0 && Math.abs(total - s.totalDuplicatas) > 0.009 && <Text type="warning"> (nota: {brl(s.totalDuplicatas)})</Text>}
                </span>
              </div>
            )}
            columns={[
              { title: 'Nº', key: 'n', width: 90, render: (_, l) => <Input size="small" value={l.numero || ''} onChange={e => alterar(l.chave, { numero: e.target.value || null })} /> },
              { title: 'Vencimento', key: 'v', width: 140, render: (_, l) => <Input size="small" type="date" value={l.vencimento} onChange={e => alterar(l.chave, { vencimento: e.target.value })} /> },
              {
                title: 'Valor', key: 'valor', width: 120,
                render: (_, l) => <InputNumber size="small" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} value={l.valor} onChange={v => alterar(l.chave, { valor: Number(v) || 0 })} />,
              },
              {
                title: 'Forma', key: 'f', width: 120,
                render: (_, l) => <Select size="small" style={{ width: '100%' }} value={l.forma} options={FORMAS_PAGAMENTO} onChange={v => alterar(l.chave, { forma: v })} />,
              },
              {
                title: 'Linha digitável (opcional)', key: 'cb',
                render: (_, l) => <Input size="small" placeholder="cole quando o boleto chegar" value={l.codigoBarras || ''} onChange={e => alterar(l.chave, { codigoBarras: e.target.value || null })} />,
              },
              { title: '', key: 'x', width: 36, render: (_, l) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLinhas(ls => ls.filter(x => x.chave !== l.chave))} /> },
            ]}
          />
          {dispensando ? (
            <Space.Compact style={{ width: '100%' }}>
              <Input autoFocus placeholder="Motivo: nota paga à vista no PIX, boleto lançado manualmente..." value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={220}
                onPressEnter={() => executar(() => pagarApi.dispensar(idLote, motivo), 'Cobrança dispensada.')} />
              <Button type="primary" loading={salvando} onClick={() => executar(() => pagarApi.dispensar(idLote, motivo), 'Cobrança dispensada.')}>Dispensar</Button>
              <Button onClick={() => setDispensando(false)}>Voltar</Button>
            </Space.Compact>
          ) : (
            <Space>
              <Button type="primary" loading={salvando} disabled={!linhas.length || !dados.fornecedor.id} onClick={lancar}>Lançar no contas a pagar</Button>
              {s.duplicatas > 0 && <Button onClick={() => setDispensando(true)}>Dispensar (já paga / à vista)</Button>}
            </Space>
          )}
        </>
      )}
    </Space>
  );
};

export default CobrancaNota;
