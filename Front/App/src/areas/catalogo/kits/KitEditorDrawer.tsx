// Editor de kit: itens usados (com quantidade na unidade base), custo ao vivo, quantos dá para montar e preço.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, Drawer, Empty, Form, Input, InputNumber, Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { atualizarKit, buscarItensParaKit, criarKit, ItemParaKit, Kit } from './kitsApi';
import { adicionarLinha, custoDaLinha, custoDoKit, LinhaKit, podeMontar, precoPorMarkup } from './kitsCalculo';
import { fatorTaxaPreco, lucroLiquido, margemLiquidaPct, useTaxaPreco } from '../../../shared/core/precos/taxaPreco';

const { Text } = Typography;
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Linha = LinhaKit & { nome: string; sku: string; unidade: string };

interface Props {
  aberto: boolean;
  kit: Kit | null; // null = novo
  onFechar: () => void;
  onSalvo: (kit: Kit) => void;
}

const KitEditorDrawer: React.FC<Props> = ({ aberto, kit, onFechar, onSalvo }) => {
  const taxa = useTaxaPreco();
  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [preco, setPreco] = useState<number | null>(null);
  const [markup, setMarkup] = useState<number | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [opcoes, setOpcoes] = useState<ItemParaKit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!aberto) return;
    setNome(kit?.nome || '');
    setSku(kit?.sku || '');
    setPreco(kit ? kit.precoCadastro : null);
    setMarkup(null);
    setOpcoes([]);
    setLinhas((kit?.componentes || []).map(c => ({
      idItem: c.idItem, quantidade: c.quantidade, saldo: c.saldo, custoUnitario: c.custoUnitario, servico: c.servico,
      nome: c.nome, sku: c.sku, unidade: c.unidade,
    })));
  }, [aberto, kit]);

  const buscar = (texto: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 2) { setOpcoes([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        setOpcoes((await buscarItensParaKit(texto.trim())).filter(i => !i.ehKit && i.idItem !== kit?.idItem));
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Erro ao buscar.');
      } finally {
        setBuscando(false);
      }
    }, 300);
  };

  const adicionar = (idItem: number) => {
    const item = opcoes.find(o => o.idItem === idItem);
    if (!item) return;
    setLinhas(ls => adicionarLinha(ls, {
      idItem: item.idItem, quantidade: 1, saldo: item.saldo, custoUnitario: item.custoUnitario, servico: item.servico,
      nome: item.nome, sku: item.sku, unidade: item.unidade,
    }));
  };

  const custo = useMemo(() => custoDoKit(linhas), [linhas]);
  const montar = useMemo(() => podeMontar(linhas), [linhas]);
  const precoAtual = Number(preco) || 0;
  // taxa no deps: recalcula quando a taxa da maquininha carregar
  const lucro = useMemo(() => lucroLiquido(precoAtual, custo), [precoAtual, custo, taxa]);
  const margem = useMemo(() => margemLiquidaPct(precoAtual, custo), [precoAtual, custo, taxa]);

  const aplicarMarkup = (m: number | null) => {
    setMarkup(m);
    if (m && m > 0 && custo > 0) setPreco(precoPorMarkup(custo, m, fatorTaxaPreco()));
  };

  const salvar = async () => {
    if (!nome.trim()) { message.warning('Dê um nome ao kit.'); return; }
    if (linhas.length === 0) { message.warning('Coloque pelo menos um item no kit.'); return; }
    if (linhas.some(l => !(l.quantidade > 0))) { message.warning('Toda quantidade precisa ser maior que zero.'); return; }
    setSalvando(true);
    try {
      const dados = {
        nome: nome.trim(),
        precoVenda: preco,
        componentes: linhas.map(l => ({ idItem: l.idItem, quantidade: l.quantidade })),
        ...(sku.trim() ? { sku: sku.trim() } : {}),
      };
      const salvo = kit ? await atualizarKit(kit.idItem, dados) : await criarKit(dados);
      message.success(kit ? 'Kit salvo.' : `Kit ${salvo.sku} criado.`);
      onSalvo(salvo);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar o kit.');
    } finally {
      setSalvando(false);
    }
  };

  const colunas = [
    {
      title: 'Item', key: 'item',
      render: (_: unknown, l: Linha) => (
        <Space direction="vertical" size={0}>
          <Text>{l.nome}</Text>
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>{l.sku}</Text>
            {l.servico && <Tag color="purple">serviço</Tag>}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Saldo', key: 'saldo', width: 90, align: 'right' as const,
      render: (_: unknown, l: Linha) => (l.servico ? '—' : (
        <Text type={l.saldo < l.quantidade ? 'danger' : undefined}>{l.saldo.toLocaleString('pt-BR')} {l.unidade}</Text>
      )),
    },
    {
      title: 'Qtd. no kit', key: 'qtd', width: 140,
      render: (_: unknown, l: Linha) => (
        <InputNumber
          size="small" min={0.0001} step={1} value={l.quantidade} style={{ width: '100%' }} addonAfter={l.unidade || undefined}
          onChange={v => setLinhas(ls => ls.map(x => (x.idItem === l.idItem ? { ...x, quantidade: Number(v) || 0 } : x)))}
        />
      ),
    },
    { title: 'Custo un.', key: 'cu', width: 100, align: 'right' as const, render: (_: unknown, l: Linha) => brl(l.custoUnitario) },
    { title: 'Custo', key: 'ct', width: 100, align: 'right' as const, render: (_: unknown, l: Linha) => <Text strong>{brl(custoDaLinha(l))}</Text> },
    {
      key: 'x', width: 40,
      render: (_: unknown, l: Linha) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLinhas(ls => ls.filter(x => x.idItem !== l.idItem))} />
      ),
    },
  ];

  return (
    <Drawer
      title={kit ? `Kit ${kit.sku}` : 'Novo kit'}
      open={aberto}
      onClose={onFechar}
      width={880}
      destroyOnHidden
      extra={<Button type="primary" icon={<SaveOutlined />} loading={salvando} onClick={salvar}>Salvar</Button>}
    >
      <Form layout="vertical">
        <Row gutter={12}>
          <Col xs={24} md={16}>
            <Form.Item label="Nome do kit" required>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: MANGUEIRA WAP 1/4 X 10 M COM TERMINAIS" maxLength={255} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="SKU" tooltip="Vazio: gerado automático (KIT-0000)">
              <Input value={sku} onChange={e => setSku(e.target.value.toUpperCase())} placeholder="automático" maxLength={60} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Itens usados no kit" extra="Quantidade na unidade de estoque do item (ex.: metros de mangueira). Na venda, a baixa sai de cada item.">
          <Select
            showSearch
            value={null}
            placeholder="Buscar item por nome, SKU ou medida para adicionar…"
            filterOption={false}
            onSearch={buscar}
            onChange={(v: number) => adicionar(v)}
            loading={buscando}
            notFoundContent={buscando ? 'Buscando…' : 'Digite ao menos 2 letras'}
            popupMatchSelectWidth
            options={opcoes.map(o => ({
              value: o.idItem,
              label: (
                <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                  <span>{o.nome} <Text type="secondary" style={{ fontSize: 12 }}>{o.sku}</Text></span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {o.servico ? 'serviço' : `saldo ${o.saldo.toLocaleString('pt-BR')} ${o.unidade}`} · {brl(o.custoUnitario)}
                  </Text>
                </Space>
              ),
            }))}
          />
        </Form.Item>
      </Form>

      <Table
        size="small"
        rowKey="idItem"
        columns={colunas}
        dataSource={linhas}
        pagination={false}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item no kit ainda" /> }}
        style={{ marginBottom: 16 }}
      />

      <Card size="small" title="Custo e preço">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Statistic title="Custo do kit" value={custo} precision={2} prefix="R$" /></Col>
          <Col xs={12} md={6}>
            <Statistic title="Dá para montar" value={montar === null ? '∞' : montar} suffix={montar === null ? '' : 'kits'}
              valueStyle={{ color: montar === 0 ? '#cf1322' : undefined }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title={`Lucro líquido${taxa.percentual ? ` (taxa ${taxa.percentual}%)` : ''}`} value={lucro} precision={2} prefix="R$"
              valueStyle={{ color: lucro < 0 ? '#cf1322' : '#389e0d' }} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Margem líquida" value={margem} precision={1} suffix="%" valueStyle={{ color: margem < 0 ? '#cf1322' : undefined }} />
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary">Preço de venda</Text>
            <InputNumber style={{ width: '100%' }} min={0} step={1} precision={2} prefix="R$" value={preco} onChange={v => { setPreco(v); setMarkup(null); }} />
          </Col>
          <Col xs={24} md={12}>
            <Text type="secondary">Sugerir pelo markup (líquido, com a taxa)</Text>
            <Space.Compact style={{ width: '100%' }}>
              <InputNumber style={{ width: '100%' }} min={1} step={0.1} precision={2} placeholder="ex.: 1,8" value={markup} onChange={v => aplicarMarkup(v)} />
              {[1.5, 1.8, 2].map(m => <Button key={m} onClick={() => aplicarMarkup(m)} disabled={!(custo > 0)}>{String(m).replace('.', ',')}x</Button>)}
            </Space.Compact>
          </Col>
        </Row>
        {kit?.temFaixas && (
          <Alert style={{ marginTop: 12 }} type="info" showIcon
            message={`O PDV usa a tabela de faixas deste kit (Precificação): ${brl(kit.precoPdv)}. O preço aqui é o de cadastro, usado quando não há faixa.`} />
        )}
      </Card>
    </Drawer>
  );
};

export default KitEditorDrawer;
