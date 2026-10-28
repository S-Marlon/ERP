// Venda completa (aberta das Contas a Receber): itens, pagamentos, parcelas, devoluções, ajustes e a nota. Na venda a
// prazo, "Ajustar venda" muda quantidade e preço das linhas, tira linha e inclui item; a diferença vai para as parcelas
// em aberto (espalhada, na última ou numa parcela nova) e o estoque acompanha.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Flex, Input, InputNumber, Row, Segmented, Select, Space, Statistic, Table, Tabs, Tag, Tooltip,
  Typography, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { DESTINOS_AJUSTE, DestinoAjuste, ItemNovo, ItemVenda, previaAjuste, vendaApi, VendaCompleta } from './vendaCompletaApi';
import { ROTULO_FORMA } from '../caixa/caixaApi';
import { getPdvProducts } from '../pdv/services/api/products';
import type { Product } from '../pdv/types/product.types';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const dataBr = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '—');
const COR_STATUS: Record<string, string> = { ABERTO: 'blue', PAGO: 'green', CANCELADO: 'default' };
const TIPO_AJUSTE: Record<string, { texto: string; cor: string }> = { ALTERADO: { texto: 'alterado', cor: 'blue' }, INCLUIDO: { texto: 'incluído', cor: 'green' }, REMOVIDO: { texto: 'tirado', cor: 'red' } };

/** Busca de item para incluir (a mesma do PDV). */
const BuscaItem: React.FC<{ onEscolher: (p: Product) => void }> = ({ onEscolher }) => {
  const [termo, setTermo] = useState('');
  const [opcoes, setOpcoes] = useState<Product[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    if (termo.trim().length < 2) { setOpcoes([]); return; }
    const t = setTimeout(() => {
      setBuscando(true);
      getPdvProducts({ searchTerm: termo.trim(), limit: 15, onlyActive: true }).then(r => setOpcoes(r.data)).finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);
  return (
    <Select showSearch filterOption={false} value={null} placeholder="Incluir item: busque por nome ou SKU" style={{ width: '100%' }} loading={buscando}
      onSearch={setTermo} notFoundContent={termo.length < 2 ? 'Digite 2 letras ou mais' : 'Nada encontrado'}
      onChange={(id: number) => { const p = opcoes.find(o => o.id === id); if (p) { onEscolher(p); setTermo(''); setOpcoes([]); } }}
      options={opcoes.map(p => ({ value: p.id, label: <Flex justify="space-between"><span>{p.name} <Text type="secondary" style={{ fontSize: 11 }}>{p.sku}</Text></span><span>{brl(p.salePrice)} · estoque {qtd(p.currentStock)} {p.unitOfMeasure}</span></Flex> }))} />
  );
};

export const VendaCompletaDrawer: React.FC<{ idVenda: number | null; onFechar: () => void; onAlterada?: () => void }> = ({ idVenda, onFechar, onAlterada }) => {
  const [v, setV] = useState<VendaCompleta | null>(null);
  const [editando, setEditando] = useState(false);
  const [editadas, setEditadas] = useState<Record<number, { quantidade: number; precoUnitario: number }>>({});
  const [novos, setNovos] = useState<ItemNovo[]>([]);
  const [destino, setDestino] = useState<DestinoAjuste>('ESPALHAR');
  const [vencimentoNova, setVencimentoNova] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState('ITENS');

  const limparEdicao = () => { setEditando(false); setEditadas({}); setNovos([]); setDestino('ESPALHAR'); setVencimentoNova(null); setMotivo(''); };
  const carregar = useCallback(() => {
    if (!idVenda) return;
    vendaApi.completa(idVenda).then(setV).catch(e => message.error(e.message));
  }, [idVenda]);
  useEffect(() => { setV(null); limparEdicao(); setAba('ITENS'); carregar(); }, [carregar]);

  const previa = v ? previaAjuste(v.itens, editadas, novos) : null;
  const linha = (i: ItemVenda) => editadas[i.idVendaItem] || { quantidade: i.quantidade, precoUnitario: i.precoUnitario };
  const mudar = (i: ItemVenda, x: Partial<{ quantidade: number; precoUnitario: number }>) => setEditadas(a => ({ ...a, [i.idVendaItem]: { ...linha(i), ...x } }));
  const abertas = v ? v.parcelas.filter(p => p.status === 'ABERTO' && p.valor > p.valorPago) : [];

  const salvar = async () => {
    if (!v || !previa) return;
    if (!motivo.trim()) { message.warning('Informe o motivo do ajuste.'); return; }
    if (previa.diferenca > 0 && destino === 'NOVA' && !vencimentoNova) { message.warning('Escolha o vencimento da parcela nova.'); return; }
    setSalvando(true);
    try {
      const r = await vendaApi.ajustar(v.idVenda, {
        linhas: previa.mudadas, novos: novos.map(n => ({ idItem: n.idItem, idUnidade: n.idUnidade, quantidade: n.quantidade, precoUnitario: n.precoUnitario })),
        destino, vencimentoNova, motivo: motivo.trim(),
      });
      message.success(`Venda ajustada: ${brl(r.totalAntes)} → ${brl(r.totalDepois)}${r.parcelaNova ? ' (parcela nova criada)' : ''}.`);
      limparEdicao(); carregar(); onAlterada?.();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao ajustar.'); } finally { setSalvando(false); }
  };

  const colunasItens = [
    {
      title: 'Item', key: 'i', render: (_: unknown, i: ItemVenda) => {
        const q = linha(i).quantidade;
        return (
          <div style={{ opacity: q === 0 ? 0.5 : 1 }}>
            <Text delete={q === 0}>{i.nome}</Text> {i.kit && <Tag>kit</Tag>}{i.servico && <Tag>serviço</Tag>}{q === 0 && i.quantidade > 0 && <Tag color="red">sai da venda</Tag>}
            {i.quantidade === 0 && <Tag>tirado num ajuste</Tag>}
            <div><Text type="secondary" style={{ fontSize: 11 }}>{i.sku}{i.devolvido > 0 ? ` · devolvido ${qtd(i.devolvido)} ${i.unidade || ''}` : ''}</Text></div>
          </div>
        );
      },
    },
    {
      title: 'Qtd.', key: 'q', width: 140, align: 'right' as const, render: (_: unknown, i: ItemVenda) => (editando && !i.kit
        ? <InputNumber size="small" min={i.devolvido} step={1} value={linha(i).quantidade} style={{ width: 110 }} addonAfter={i.unidade || undefined}
            onChange={x => mudar(i, { quantidade: Number(x) || 0 })} />
        : `${qtd(i.quantidade)} ${i.unidade || ''}`),
    },
    {
      title: 'Preço', key: 'p', width: 140, align: 'right' as const, render: (_: unknown, i: ItemVenda) => (editando && !i.kit
        ? <InputNumber size="small" min={0} prefix="R$" decimalSeparator="," value={linha(i).precoUnitario} style={{ width: 120 }} onChange={x => mudar(i, { precoUnitario: Number(x) || 0 })} />
        : <Tooltip title={i.precoTabela !== i.precoUnitario ? `Tabela ${brl(i.precoTabela)}` : undefined}>{brl(i.precoUnitario)}</Tooltip>),
    },
    {
      title: 'Total', key: 't', width: 110, align: 'right' as const, render: (_: unknown, i: ItemVenda) => {
        const e = linha(i);
        const novo = e.quantidade === 0 ? 0 : Math.round(e.quantidade * e.precoUnitario * 100) / 100;
        const mudou = editando && previa?.mudadas.some(m => m.idVendaItem === i.idVendaItem);
        return mudou ? <span><Text delete type="secondary" style={{ fontSize: 11 }}>{brl(i.total)}</Text><br /><b>{brl(novo)}</b></span> : brl(i.total);
      },
    },
    ...(editando ? [{
      title: '', key: 'a', width: 44, render: (_: unknown, i: ItemVenda) => !i.kit && i.quantidade > 0 && (
        linha(i).quantidade === 0
          ? <Tooltip title="Voltar a linha"><Button size="small" type="text" icon={<UndoOutlined />} onClick={() => mudar(i, { quantidade: i.quantidade })} /></Tooltip>
          : <Tooltip title={i.devolvido > 0 ? 'Já teve devolução: não dá para tirar tudo' : 'Tirar da venda'}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={i.devolvido > 0} onClick={() => mudar(i, { quantidade: 0 })} />
            </Tooltip>
      ),
    }] : []),
  ];

  return (
    <Drawer open={!!idVenda} onClose={onFechar} width={960} destroyOnHidden
      title={v ? <Space>Venda #{v.idVenda}<Tag color={v.status === 'CONCLUIDA' ? 'green' : v.status === 'CANCELADA' ? 'red' : 'default'}>{v.status.toLowerCase()}</Tag></Space> : 'Venda'}
      extra={v && !editando && (
        <Tooltip title={v.travaAjuste || 'Mudar quantidades, preços, tirar ou incluir itens'}>
          <Button type="primary" icon={<EditOutlined />} disabled={!!v.travaAjuste} onClick={() => { setEditando(true); setAba('ITENS'); }}>Ajustar venda</Button>
        </Tooltip>
      )}>
      {!v ? <Card loading /> : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions size="small" column={{ xs: 1, md: 3 }} bordered items={[
            { key: 'c', label: 'Cliente', children: v.cliente || '—' },
            { key: 'd', label: 'Data', children: dataBr(v.criadaEm) },
            { key: 'o', label: 'Operador', children: v.operador || '—' },
            { key: 'n', label: 'Nota fiscal', children: v.nota ? `${v.nota.status.toLowerCase()}${v.nota.numero ? ` · nº ${v.nota.numero}` : ''}` : 'sem nota' },
            { key: 'f', label: 'Pagamento', children: v.pagamentos.map(p => `${ROTULO_FORMA[p.forma] || p.forma} ${brl(p.valor)}${p.parcelas > 1 ? ` em ${p.parcelas}x` : ''}`).join(' · ') || '—' },
            ...(v.observacao ? [{ key: 'obs', label: 'Observação', children: v.observacao }] : []),
          ]} />
          <Row gutter={12}>
            <Col xs={12} md={6}><Statistic title="Total" value={brl(v.totalLiquido)} /></Col>
            <Col xs={12} md={6}><Statistic title="Desconto" value={brl(v.totalDesconto)} valueStyle={{ fontSize: 18 }} /></Col>
            <Col xs={12} md={6}><Statistic title="Devolvido" value={brl(v.totalDevolvido)} valueStyle={{ fontSize: 18 }} /></Col>
            <Col xs={12} md={6}><Statistic title="Em aberto" value={brl(abertas.reduce((s, p) => s + p.valor - p.valorPago, 0))} valueStyle={{ fontSize: 18 }} /></Col>
          </Row>
          {v.travaAjuste && v.status === 'CONCLUIDA' && <Alert type="info" showIcon message={v.travaAjuste} />}
          <Tabs activeKey={aba} onChange={setAba} items={[
            {
              key: 'ITENS', label: `Itens (${v.itens.filter(i => i.quantidade > 0).length})`, children: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Table<ItemVenda> size="small" rowKey="idVendaItem" pagination={false} columns={colunasItens}
                    dataSource={editando ? v.itens.filter(i => i.quantidade > 0) : v.itens} />
                  {editando && (
                    <Card size="small" title="Ajuste da venda" styles={{ body: { display: 'flex', flexDirection: 'column', gap: 10 } }}>
                      {novos.length > 0 && (
                        <Table<ItemNovo & { k: number }> size="small" pagination={false} rowKey="k" dataSource={novos.map((n, k) => ({ ...n, k }))} columns={[
                          { title: 'Item incluído', render: (_, n) => <>{n.nome} <Tag color="green">novo</Tag><div><Text type="secondary" style={{ fontSize: 11 }}>{n.sku}</Text></div></> },
                          { title: 'Qtd.', width: 140, align: 'right', render: (_, n) => <InputNumber size="small" min={0.0001} value={n.quantidade} style={{ width: 110 }} addonAfter={n.unidade || undefined}
                            onChange={x => setNovos(l => l.map((y, k) => (k === n.k ? { ...y, quantidade: Number(x) || 0 } : y)))} /> },
                          { title: 'Preço', width: 140, align: 'right', render: (_, n) => <InputNumber size="small" min={0} prefix="R$" decimalSeparator="," value={n.precoUnitario} style={{ width: 120 }}
                            onChange={x => setNovos(l => l.map((y, k) => (k === n.k ? { ...y, precoUnitario: Number(x) || 0 } : y)))} /> },
                          { title: 'Total', width: 110, align: 'right', render: (_, n) => brl(Math.round(n.quantidade * n.precoUnitario * 100) / 100) },
                          { title: '', width: 44, render: (_, n) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setNovos(l => l.filter((_, k) => k !== n.k))} /> },
                        ]} />
                      )}
                      <BuscaItem onEscolher={p => setNovos(l => [...l, { idItem: p.id, nome: p.name, sku: p.sku, idUnidade: p.idUnidadeVenda ?? null, unidade: p.unitOfMeasure, quantidade: 1, precoUnitario: p.salePrice }])} />
                      {previa && previa.mudou && (
                        <Alert type={previa.diferenca > 0 ? 'warning' : previa.diferenca < 0 ? 'success' : 'info'} showIcon
                          message={<span>Itens: {brl(previa.totalItensAntes)} → <b>{brl(previa.totalItensDepois)}</b> · diferença <b>{previa.diferenca > 0 ? '+' : ''}{brl(previa.diferenca)}</b></span>}
                          description={previa.diferenca > 0 ? 'O acréscimo entra nas parcelas e respeita o limite de crédito do cliente.'
                            : previa.diferenca < 0 ? 'A redução sai das parcelas em aberto (parcela paga não muda).' : 'Sem diferença de valor (só estoque).'} />
                      )}
                      {previa && previa.diferenca !== 0 && (
                        <Flex gap={8} wrap align="center">
                          <Text>Diferença:</Text>
                          <Segmented value={destino} onChange={x => setDestino(x as DestinoAjuste)}
                            options={(Object.keys(DESTINOS_AJUSTE) as DestinoAjuste[]).filter(d => previa.diferenca > 0 || d !== 'NOVA').map(d => ({ value: d, label: DESTINOS_AJUSTE[d] }))} />
                          {destino === 'NOVA' && previa.diferenca > 0 && (
                            <DatePicker format="DD/MM/YYYY" placeholder="Vencimento" value={vencimentoNova ? dayjs(vencimentoNova) : null}
                              onChange={d => setVencimentoNova(d ? d.format('YYYY-MM-DD') : null)} />
                          )}
                          {!abertas.length && destino !== 'NOVA' && previa.diferenca > 0 && <Text type="danger" style={{ fontSize: 12 }}>Nenhuma parcela em aberto: use "parcela nova".</Text>}
                        </Flex>
                      )}
                      <Input placeholder="Motivo do ajuste (obrigatório): ex.: cliente levou mais 2 canos" maxLength={255} value={motivo} onChange={e => setMotivo(e.target.value)} />
                      <Flex justify="flex-end" gap={8}>
                        <Button onClick={limparEdicao}>Desistir</Button>
                        <Button type="primary" icon={<SaveOutlined />} loading={salvando} disabled={!previa?.mudou} onClick={salvar}>Gravar ajuste</Button>
                      </Flex>
                    </Card>
                  )}
                </Space>
              ),
            },
            {
              key: 'PARCELAS', label: `Parcelas (${v.parcelas.length})`, children: (
                <Table size="small" rowKey="idTitulo" pagination={false} dataSource={v.parcelas} locale={{ emptyText: 'Sem parcelas a prazo.' }} columns={[
                  { title: 'Parcela', render: (_, p) => `${p.parcela}/${p.totalParcelas}` },
                  { title: 'Vencimento', render: (_, p) => (p.vencimento ? dataBr(p.vencimento) : 'sem prazo') },
                  { title: 'Valor', align: 'right', render: (_, p) => brl(p.valor) },
                  { title: 'Pago', align: 'right', render: (_, p) => (p.valorPago ? brl(p.valorPago) : '') },
                  { title: 'Situação', render: (_, p) => <Tag color={COR_STATUS[p.status] || 'default'}>{p.status.toLowerCase()}</Tag> },
                ]} />
              ),
            },
            {
              key: 'HISTORICO', label: `Histórico (${v.ajustes.length + v.devolucoes.length})`, children: (
                v.ajustes.length + v.devolucoes.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum ajuste nem devolução." /> : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {v.ajustes.map(a => (
                      <Card key={`a${a.idAjuste}`} size="small"
                        title={<Space>Ajuste · {dataBr(a.em)} · {a.operador}<Tag color={a.diferenca > 0 ? 'orange' : a.diferenca < 0 ? 'green' : 'default'}>{a.diferenca > 0 ? '+' : ''}{brl(a.diferenca)}</Tag></Space>}
                        extra={<Text type="secondary" style={{ fontSize: 12 }}>{brl(a.totalAntes)} → {brl(a.totalDepois)} · {DESTINOS_AJUSTE[a.destino]?.toLowerCase()}</Text>}>
                        <Text type="secondary">{a.motivo}</Text>
                        {a.itens.map((x, k) => (
                          <div key={k} style={{ fontSize: 12 }}>
                            <Tag color={TIPO_AJUSTE[x.tipo].cor}>{TIPO_AJUSTE[x.tipo].texto}</Tag>{x.nome}: {qtd(x.quantidadeAntes)} → {qtd(x.quantidadeDepois)} {x.unidade || ''}
                            {x.precoAntes !== x.precoDepois && x.tipo === 'ALTERADO' ? ` · preço ${brl(x.precoAntes)} → ${brl(x.precoDepois)}` : ''} · {brl(x.totalAntes)} → {brl(x.totalDepois)}
                          </div>
                        ))}
                      </Card>
                    ))}
                    {v.devolucoes.map(d => (
                      <Card key={`d${d.idDevolucao}`} size="small" title={<Space>Devolução · {dataBr(d.em)} · {d.operador}<Tag color="purple">{brl(d.valor)}</Tag></Space>}>
                        <Text type="secondary">{d.motivo} · {ROTULO_FORMA[d.reembolso] || d.reembolso.toLowerCase().replace('_', ' ')}</Text>
                      </Card>
                    ))}
                  </Space>
                )
              ),
            },
          ]} />
        </Space>
      )}
    </Drawer>
  );
};

export default VendaCompletaDrawer;
