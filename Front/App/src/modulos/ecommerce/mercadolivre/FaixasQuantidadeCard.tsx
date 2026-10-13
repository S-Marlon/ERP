// Preço por quantidade no ML (compradores empresa / B2B): até 5 faixas "a partir de N un., X% de desconto".
// No anúncio aparecem como botões 1 · 5 · 10 · 24... para quem compra com CNPJ.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Flex, InputNumber, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, FaixaQuantidade, formatarMoeda } from './mercadoLivreApi';

const { Text } = Typography;
const PADRAO: FaixaQuantidade[] = [{ minimo: 5, desconto: 5 }, { minimo: 10, desconto: 8 }, { minimo: 24, desconto: 10 }];

interface Props { det: AnuncioDetalhe; onSalvar: (faixas: FaixaQuantidade[]) => Promise<void> | void }

const FaixasQuantidadeCard: React.FC<Props> = ({ det, onSalvar }) => {
  const [faixas, setFaixas] = useState<FaixaQuantidade[]>(det.faixasQuantidade);
  const [noMl, setNoMl] = useState<{ noMl: FaixaQuantidade[]; sugestao: { quantidade: number; desconto: number; incoerente: boolean }[] } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setFaixas(det.faixasQuantidade); }, [det.faixasQuantidade]);

  const preco = det.itens[0]?.precoAnuncio ?? 0;
  const mudou = JSON.stringify(faixas) !== JSON.stringify(det.faixasQuantidade) || (!det.faixasGerenciadas && faixas.length > 0);
  const temPublicado = det.itens.some(i => i.ml.mlbId && i.ml.status !== 'closed' && i.ml.status !== 'deleted');

  const mudar = (k: number, campo: keyof FaixaQuantidade, v: number | null) =>
    setFaixas(fs => fs.map((f, i) => (i === k ? { ...f, [campo]: v ?? 0 } : f)));

  const verNoMl = async () => {
    setLendo(true);
    try {
      const r = await anunciosApi.faixasNoMl(det.id, (faixas.length ? faixas.map(f => f.minimo) : [5, 10, 24, 48, 100]).join(','));
      setNoMl(r);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setLendo(false);
    }
  };

  const salvar = async (lista: FaixaQuantidade[]) => {
    setSalvando(true);
    try { await onSalvar([...lista].sort((a, b) => a.minimo - b.minimo)); } finally { setSalvando(false); }
  };

  return (
    <Card
      size="small" style={{ marginBottom: 16 }}
      title={<Space>Preço por quantidade<Tag color="blue">compradores empresa (CNPJ)</Tag></Space>}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>No anúncio: botões 1 · {faixas.map(f => f.minimo).join(' · ') || '…'}</Text>}
    >
      {!det.contaB2B && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="Sua conta do ML não está habilitada para preço por quantidade (B2B): o ML vai recusar." />}
      {!det.faixasGerenciadas && (
        <Alert type="info" showIcon style={{ marginBottom: 8 }}
          message="O ERP ainda não mexe nas faixas deste anúncio."
          description="Se ele já tem faixas criadas pelo site do ML, elas continuam lá até você salvar faixas aqui (aí o ERP passa a cuidar delas)." />
      )}
      <Table<FaixaQuantidade & { k: number }>
        size="small" pagination={false} rowKey="k" dataSource={faixas.map((f, k) => ({ ...f, k }))}
        locale={{ emptyText: 'Sem faixas: o comprador empresa paga o preço normal em qualquer quantidade.' }}
        columns={[
          {
            title: 'A partir de', width: 150,
            render: (_, f) => <InputNumber min={2} max={100} precision={0} value={f.minimo} suffix="un." style={{ width: '100%' }} onChange={v => mudar(f.k, 'minimo', v)} />,
          },
          {
            title: 'Desconto', width: 140,
            render: (_, f) => <InputNumber min={0.01} max={99.99} step={0.5} precision={2} decimalSeparator="," value={f.desconto} suffix="%" style={{ width: '100%' }} onChange={v => mudar(f.k, 'desconto', v)} />,
          },
          {
            title: 'Preço por unidade',
            render: (_, f) => preco > 0
              ? <Text>{formatarMoeda(Math.round(preco * (1 - f.desconto / 100) * 100) / 100)} <Text type="secondary" style={{ fontSize: 12 }}>({det.itens[0]?.sku})</Text></Text>
              : '—',
          },
          { title: '', width: 40, render: (_, f) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setFaixas(fs => fs.filter((_, i) => i !== f.k))} /> },
        ]}
      />
      <Flex justify="space-between" wrap gap={8} style={{ marginTop: 8 }}>
        <Space wrap>
          <Button size="small" icon={<PlusOutlined />} disabled={faixas.length >= 5}
            onClick={() => setFaixas(fs => (fs.length ? [...fs, { minimo: Math.min(100, fs[fs.length - 1].minimo * 2), desconto: Math.min(99, fs[fs.length - 1].desconto + 2) }] : PADRAO))}>
            {faixas.length ? 'Faixa' : 'Começar com 5 · 10 · 24'}
          </Button>
          {det.faixasAtacado.length > 0 && (
            <Tooltip title={`Do atacado do cadastro: ${det.faixasAtacado.map(f => `${f.minimo}+ un. −${f.desconto}%`).join(', ')}`}>
              <Button size="small" onClick={() => setFaixas(det.faixasAtacado)}>Copiar do atacado do cadastro</Button>
            </Tooltip>
          )}
          {temPublicado && <Button size="small" loading={lendo} onClick={verNoMl}>Ver no ML e sugestão</Button>}
        </Space>
        <Space>
          {det.faixasGerenciadas && det.faixasQuantidade.length > 0 && (
            <Button size="small" danger onClick={() => salvar([])} loading={salvando}>Tirar as faixas</Button>
          )}
          <Button size="small" type="primary" disabled={!mudou} loading={salvando} onClick={() => salvar(faixas)}>
            {temPublicado ? 'Salvar e mandar ao ML' : 'Salvar'}
          </Button>
        </Space>
      </Flex>
      {noMl && (
        <Alert
          type="info" showIcon style={{ marginTop: 8 }} closable onClose={() => setNoMl(null)}
          message={noMl.noMl.length ? `No ML hoje: ${noMl.noMl.map(f => `${f.minimo}+ un. −${f.desconto}%`).join(' · ')}` : 'No ML hoje: sem faixas.'}
          description={
            <Space direction="vertical" size={4}>
              {noMl.sugestao.length
                ? <Text>Sugestão do ML (pela economia de frete): {noMl.sugestao.map(s => `${s.quantidade}+ −${s.desconto}%${s.incoerente ? ' (não aceita)' : ''}`).join(' · ')}</Text>
                : <Text type="secondary">O ML não sugeriu valores para este item: vale a faixa que você definir.</Text>}
              <Space>
                {noMl.noMl.length > 0 && <Button size="small" onClick={() => setFaixas(noMl.noMl)}>Usar as que estão no ML</Button>}
                {noMl.sugestao.some(s => !s.incoerente) && (
                  <Button size="small" onClick={() => setFaixas(noMl.sugestao.filter(s => !s.incoerente).map(s => ({ minimo: s.quantidade, desconto: s.desconto })))}>Usar a sugestão</Button>
                )}
              </Space>
            </Space>
          }
        />
      )}
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        Desconto em % sobre o preço do anúncio: se o preço muda (ou entra promoção), o ML recalcula as faixas sozinho. Até 5 faixas, o desconto sempre maior na quantidade maior.
      </Text>
    </Card>
  );
};

export default FaixasQuantidadeCard;
