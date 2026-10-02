// Revisão final da entrada (somente leitura): o que vai acontecer com cada linha, o pente-fino do servidor
// (bloqueios e avisos) e, se estiver tudo certo, a aprovação que dá entrada no estoque.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Modal, Row, Space, Spin, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, FileAddOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { analisarLoteStaging, AnaliseLote } from '../api/comprasApi';
import { getTipoRecursoConfig, TIPO_RECURSO_PADRAO } from './tipoRecurso';
import { DEPOSITOS, destinosEfetivos } from './depositos';

const { Text } = Typography;
const brl = (v: number, casas = 2) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

interface Props {
  open: boolean;
  loteId: number | null;
  items: any[];
  nota: { numero?: string; serie?: string; fornecedor?: string; valorNota: number; freteAdicional: number; custoAjustado: number };
  aprovando: boolean;
  onClose: () => void;
  onAprovar: () => void;
}

export const RevisaoFinalModal: React.FC<Props> = ({ open, loteId, items, nota, aprovando, onClose, onAprovar }) => {
  const [analise, setAnalise] = useState<AnaliseLote | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const analisar = async () => {
    if (!loteId) return;
    setCarregando(true);
    setErro(null);
    try {
      setAnalise(await analisarLoteStaging(loteId));
    } catch (e: any) {
      setAnalise(null);
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { if (open) analisar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, loteId]);

  // Linha a linha: o que vai acontecer (vincular ou cadastrar), para onde vai e quanto entra
  const linhas = useMemo(() => items.map((i: any) => {
    const m = i.mapeamento;
    const recebida = Number(i.receivedQuantity ?? i.quantidade) || 0;
    const fator = Number(m?.conversaoCompra?.fator) || 1;
    const unidadeNf = String(i.unidade || 'UN').toUpperCase();
    const unidadeBase = String(m?.conversaoCompra?.unidade_base || unidadeNf).toUpperCase();
    const tipo = i.tipoRecurso || TIPO_RECURSO_PADRAO;
    return {
      chave: i.tempId,
      seq: i.nItem,
      descricao: i.descricao,
      codigo: i.sku,
      acao: m?.mode === 'DRAFT' ? 'NOVO' : m?.mode === 'EXISTING_DIRECT' || i.produtoIdSistema ? 'VINCULO' : 'SEM',
      sku: m?.mode === 'DRAFT' ? (m?.draftIdentity?.sku_comercial || null) : (m?.existingProduct?.sku || i.skuSistema || i.mappedId),
      nome: m?.mode === 'DRAFT' ? (m?.draftIdentity?.nome_comercial || m?.draftIdentity?.nome_interno) : (m?.existingProduct?.nome || i.nomeItemSugerido),
      temPreco: m?.mode !== 'DRAFT' || Boolean(m?.configVendas),
      tipo,
      destinos: destinosEfetivos(i.destinos, recebida, tipo),
      recebida,
      quantidadeNf: Number(i.quantidade) || 0,
      unidadeNf,
      fator,
      unidadeBase,
      custoUnitario: Number(i.valorUnitario) || 0,
      total: recebida * (Number(i.valorUnitario) || 0),
    };
  }), [items]);

  const novos = linhas.filter(l => l.acao === 'NOVO').length;
  const vinculados = linhas.filter(l => l.acao === 'VINCULO').length;
  const divergentes = linhas.filter(l => Math.abs(l.recebida - l.quantidadeNf) > 0.0001).length;
  // Quanto (em custo) vai para cada depósito
  const porDeposito = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of linhas) {
      for (const d of l.destinos) mapa.set(d.deposito, (mapa.get(d.deposito) || 0) + d.quantidade * l.custoUnitario);
    }
    return [...mapa.entries()];
  }, [linhas]);

  const podeAprovar = Boolean(analise?.aprovavel) && !carregando && !erro;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1200}
      destroyOnClose
      title={`Revisão final da entrada · NF ${nota.numero || ''}${nota.serie ? `/${nota.serie}` : ''}${nota.fornecedor ? ` · ${nota.fornecedor}` : ''}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Somente leitura. Para mudar algo, volte à conferência.</Text>
          <Space>
            <Button onClick={onClose}>Voltar e corrigir</Button>
            <Tooltip title={podeAprovar ? 'Dá entrada no estoque e cadastra os itens novos (não dá para desfazer pela conferência; correções depois são feitas pela nota)' : 'Resolva os bloqueios antes de aprovar'}>
              <Button type="primary" icon={<CheckCircleOutlined />} disabled={!podeAprovar} loading={aprovando} onClick={onAprovar}
                style={podeAprovar ? { background: '#52c41a', borderColor: '#52c41a' } : undefined}>
                Aprovar e dar entrada no estoque
              </Button>
            </Tooltip>
          </Space>
        </div>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Números da entrada */}
        <Row gutter={[12, 12]}>
          <Col xs={12} md={4}><Statistic title="Linhas" value={linhas.length} valueStyle={{ fontSize: 20 }} /></Col>
          <Col xs={12} md={4}><Statistic title="Vínculos" value={vinculados} valueStyle={{ fontSize: 20 }} /></Col>
          <Col xs={12} md={4}><Statistic title="Itens novos" value={novos} valueStyle={{ fontSize: 20, color: novos ? '#1677ff' : undefined }} /></Col>
          <Col xs={12} md={4}><Statistic title="Total da nota" value={brl(nota.valorNota)} valueStyle={{ fontSize: 20 }} /></Col>
          <Col xs={12} md={4}><Statistic title="Frete adicional" value={brl(nota.freteAdicional)} valueStyle={{ fontSize: 20 }} /></Col>
          <Col xs={12} md={4}><Statistic title="Custo da entrada" value={brl(nota.custoAjustado)} valueStyle={{ fontSize: 20, color: '#389e0d', fontWeight: 700 }} /></Col>
        </Row>
        <Space size={6} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>Vai para:</Text>
          {porDeposito.map(([dep, valor]) => (
            <Tag key={dep} color={DEPOSITOS[dep as keyof typeof DEPOSITOS]?.color} style={{ margin: 0 }}>
              {DEPOSITOS[dep as keyof typeof DEPOSITOS]?.label || dep}: {brl(valor)}
            </Tag>
          ))}
          {divergentes > 0 && <Tag color="orange" style={{ margin: 0 }}>{divergentes} linha(s) com quantidade diferente da nota</Tag>}
        </Space>

        {/* Pente-fino do servidor */}
        <Spin spinning={carregando}>
          {erro ? (
            <Alert type="error" showIcon message="Não foi possível analisar o lote" description={erro}
              action={<Button size="small" icon={<ReloadOutlined />} onClick={analisar}>Tentar de novo</Button>} />
          ) : analise && (
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Alert
                type={analise.aprovavel ? 'success' : 'error'}
                showIcon
                message={analise.aprovavel ? 'Tudo certo: a nota pode entrar no estoque.' : `${analise.bloqueios.length} bloqueio(s): resolva na conferência antes de aprovar.`}
                description={analise.bloqueios.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {analise.bloqueios.map(b => <li key={b.codigo}>{b.mensagem}{b.itens?.length ? ` (linhas ${b.itens.join(', ')})` : ''}</li>)}
                  </ul>
                )}
                action={<Button size="small" type="text" icon={<ReloadOutlined />} onClick={analisar}>Reanalisar</Button>}
              />
              {analise.avisos.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`${analise.avisos.length} aviso(s): não impedem a entrada, mas confira`}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {analise.avisos.map(a => <li key={a.codigo}>{a.mensagem}{a.itens?.length ? ` (linhas ${a.itens.join(', ')})` : ''}</li>)}
                    </ul>
                  }
                />
              )}
            </Space>
          )}
        </Spin>

        {/* Linhas (somente leitura) */}
        <Table
          size="small"
          rowKey="chave"
          dataSource={linhas}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 1000, y: 380 }}
          columns={[
            { title: '#', dataIndex: 'seq', width: 44 },
            {
              title: 'Item da nota', key: 'nf',
              render: (_, l) => (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{l.descricao}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Cód. forn. {l.codigo || '-'}</Text>
                </div>
              ),
            },
            {
              title: 'Vai para', key: 'acao', width: 260,
              render: (_, l) => l.acao === 'SEM' ? <Tag color="red">Sem vínculo</Tag> : (
                <div>
                  <Space size={4}>
                    {l.acao === 'NOVO'
                      ? <Tag color="blue" icon={<FileAddOutlined />} style={{ margin: 0 }}>Cadastro novo</Tag>
                      : <Tag icon={<LinkOutlined />} style={{ margin: 0 }}>Vínculo</Tag>}
                    <b style={{ fontSize: 12 }}>{l.sku || <Text type="secondary" style={{ fontSize: 11 }}>SKU gerado na aprovação</Text>}</b>
                  </Space>
                  <div style={{ fontSize: 11, color: '#595959' }}>{l.nome}</div>
                  {!l.temPreco && <Text type="warning" style={{ fontSize: 11 }}>sem preço de venda</Text>}
                </div>
              ),
            },
            {
              title: 'Tipo / destino', key: 'destino', width: 170,
              render: (_, l) => (
                <Space size={[4, 4]} wrap>
                  <Tag color={getTipoRecursoConfig(l.tipo).color} style={{ margin: 0 }}>{getTipoRecursoConfig(l.tipo).short}</Tag>
                  {l.destinos.map(d => (
                    <Tag key={d.deposito} color={DEPOSITOS[d.deposito].color} style={{ margin: 0 }}>
                      {DEPOSITOS[d.deposito].label}{l.destinos.length > 1 ? ` ${qtd(d.quantidade)}` : ''}
                    </Tag>
                  ))}
                </Space>
              ),
            },
            {
              title: 'Quantidade', key: 'qtd', width: 170, align: 'right' as const,
              render: (_, l) => (
                <div>
                  <div style={{ color: Math.abs(l.recebida - l.quantidadeNf) > 0.0001 ? '#d46b08' : undefined }}>
                    {qtd(l.recebida)} {l.unidadeNf}
                    {Math.abs(l.recebida - l.quantidadeNf) > 0.0001 && <Text type="secondary" style={{ fontSize: 11 }}> (NF {qtd(l.quantidadeNf)})</Text>}
                  </div>
                  {l.fator !== 1 && <Text type="secondary" style={{ fontSize: 11 }}>= {qtd(l.recebida * l.fator)} {l.unidadeBase} no estoque</Text>}
                </div>
              ),
            },
            { title: 'Custo unit.', dataIndex: 'custoUnitario', width: 110, align: 'right' as const, render: (v: number) => brl(v, 4) },
            { title: 'Total', dataIndex: 'total', width: 110, align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
          ]}
        />
      </Space>
    </Modal>
  );
};

export default RevisaoFinalModal;
