// Correção de uma linha de nota já aprovada: item errado (vínculo) ou conversão errada (fator).
// Primeiro simula (mostra o que sai de onde e entra onde); só depois confirma.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, InputNumber, Modal, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { SearchOutlined, SwapOutlined } from '@ant-design/icons';
import { buscarItensCatalogo, ItemCatalogoBusca } from '../api/comprasApi';
import { getTipoRecursoConfig } from '../entradaNf/tipoRecurso';
import { corrigirLinhaNota, ItemNota, ResultadoCorrecao } from './notasEntradaApi';

const { Text } = Typography;
const money = (v: number, casas = 2) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

interface Props {
  idLote: number;
  linha: ItemNota | null;
  onClose: () => void;
  onCorrigido: () => void;
}

export const ModalCorrigirLinha: React.FC<Props> = ({ idLote, linha, onClose, onCorrigido }) => {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ItemCatalogoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [item, setItem] = useState<{ id: number; sku: string; nome: string; unidade: string | null } | null>(null);
  const [fator, setFator] = useState<number>(1);
  const [motivo, setMotivo] = useState('');
  const [inativar, setInativar] = useState(false);
  const [simulacao, setSimulacao] = useState<ResultadoCorrecao | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; detalhes?: string[] } | null>(null);
  const [processando, setProcessando] = useState(false);

  // Começa no item e no fator atuais da linha
  useEffect(() => {
    if (!linha) return;
    setBusca('');
    setResultados([]);
    setItem(linha.idItem ? { id: linha.idItem, sku: linha.skuItem || '', nome: linha.nomeItem || '', unidade: linha.unidadeBase } : null);
    setFator(linha.fatorConversao || 1);
    setMotivo('');
    setInativar(false);
    setSimulacao(null);
    setErro(null);
  }, [linha]);

  // Qualquer mudança invalida a simulação anterior
  useEffect(() => { setSimulacao(null); setErro(null); }, [item?.id, fator]);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) { setResultados([]); return; }
    const controller = new AbortController();
    setBuscando(true);
    const t = setTimeout(() => {
      buscarItensCatalogo(termo, 1, controller.signal)
        .then(setResultados)
        .catch(() => setResultados([]))
        .finally(() => { if (!controller.signal.aborted) setBuscando(false); });
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [busca]);

  if (!linha) return null;
  const unidadeNf = (linha.unidadeNf || 'UN').toUpperCase();
  const recebida = linha.quantidadeRecebida ?? linha.quantidadeNf;
  const mudouItem = item !== null && item.id !== linha.idItem;
  const mudouFator = Math.abs(fator - (linha.fatorConversao || 1)) > 0.000001;
  const podeSimular = item !== null && fator > 0 && (mudouItem || mudouFator);

  const executar = async (simular: boolean) => {
    if (!item) return;
    setProcessando(true);
    setErro(null);
    try {
      const r = await corrigirLinhaNota(idLote, linha.idStaging, { idItemNovo: item.id, fator, motivo, inativarAnterior: inativar, simular });
      if (simular) setSimulacao(r);
      else {
        message.success(r.itemAnterior.inativado ? `Linha corrigida. ${r.itemAnterior.sku} foi inativado.` : 'Linha corrigida.');
        onCorrigido();
      }
    } catch (e: any) {
      setErro({ mensagem: e.message, detalhes: e.detalhes });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Modal
      open
      width={820}
      title={<Space><SwapOutlined /> Corrigir linha {linha.seq} da nota</Space>}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button disabled={!podeSimular} loading={processando && !simulacao} onClick={() => executar(true)}>Simular</Button>
          <Button type="primary" danger disabled={!simulacao || motivo.trim().length < 3} loading={processando && Boolean(simulacao)} onClick={() => executar(false)}>
            Confirmar correção
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Como a linha entrou */}
        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontWeight: 600 }}>{linha.descricaoNf}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Cód. forn. {linha.codigoFornecedor || '-'} · {qtd(recebida)} {unidadeNf} a {money(linha.custoUnitarioFinal, 4)}/{unidadeNf}
          </Text>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Entrou em <b>{linha.skuItem}</b> ({linha.nomeItem}) · 1 {unidadeNf} = {qtd(linha.fatorConversao || 1)} {linha.unidadeBase || 'un'}
            {' '}→ <b>{qtd(linha.quantidadeEstoque || 0)} {linha.unidadeBase || 'un'}</b> a {money(linha.custoEstoque || 0, 4)}
          </div>
        </div>

        {/* Item certo */}
        <div>
          <Text strong style={{ fontSize: 12 }}>Item certo</Text>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Buscar outro item por SKU, nome ou marca (deixe como está para corrigir só a conversão)"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ marginTop: 4 }}
          />
          {busca.trim().length >= 2 && (
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, marginTop: 4 }}>
              {buscando ? <div style={{ padding: 12, textAlign: 'center' }}><Spin size="small" /></div>
                : resultados.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada encontrado" />
                  : resultados.map(r => {
                    const t = getTipoRecursoConfig(r.tipoRecurso);
                    return (
                      <div key={r.id} onClick={() => { setItem({ id: r.id, sku: r.sku, nome: r.name, unidade: r.unitOfMeasure || null }); setBusca(''); }}
                        style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #fafafa' }}>
                        <span><b>{r.sku}</b> · {r.name}</span>
                        <Space size={4}>
                          {r.unitOfMeasure && <Tag style={{ margin: 0 }}>{r.unitOfMeasure}</Tag>}
                          {r.status !== 'ATIVO' && <Tag color="red" style={{ margin: 0 }}>{r.status}</Tag>}
                          <Tag color={t.color} style={{ margin: 0 }}>{t.short}</Tag>
                        </Space>
                      </div>
                    );
                  })}
            </div>
          )}
          {item && (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {mudouItem ? <Tag color="blue">novo</Tag> : <Tag>mesmo item</Tag>}
              <b>{item.sku}</b> · {item.nome}
            </div>
          )}
        </div>

        {/* Conversão */}
        <Space align="center" wrap>
          <Text strong style={{ fontSize: 12 }}>Conversão:</Text>
          <Text>1 <b>{unidadeNf}</b> =</Text>
          <InputNumber min={0.000001} value={fator} onChange={v => setFator(Number(v) || 0)} style={{ width: 100 }} />
          <Text>{item?.unidade || linha.unidadeBase || 'unidade base'}</Text>
          {fator > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              → entra {qtd(recebida * fator)} a {money(linha.custoUnitarioFinal / fator, 4)} cada
            </Text>
          )}
        </Space>

        <Input.TextArea rows={2} placeholder="Motivo da correção (obrigatório para confirmar)" value={motivo} onChange={e => setMotivo(e.target.value)} />

        {erro && (
          <Alert type="error" showIcon message={erro.mensagem}
            description={erro.detalhes?.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{erro.detalhes.map(d => <li key={d}>{d}</li>)}</ul> : undefined} />
        )}

        {simulacao && (
          <div>
            <Text strong style={{ fontSize: 12 }}>O que vai acontecer</Text>
            <Table
              size="small"
              rowKey={(m, i) => `${m.tipo}-${m.idItem}-${m.deposito}-${i}`}
              pagination={false}
              dataSource={simulacao.movimentos}
              style={{ marginTop: 4 }}
              columns={[
                { title: 'Movimento', key: 't', width: 110, render: (_, m) => <Tag color={m.tipo === 'ENTRADA' ? 'green' : 'red'}>{m.tipo === 'ENTRADA' ? 'Entrada' : 'Estorno'}</Tag> },
                { title: 'Item', dataIndex: 'sku' },
                { title: 'Depósito', dataIndex: 'deposito', width: 120 },
                { title: 'Qtd', key: 'q', width: 90, align: 'right' as const, render: (_, m) => qtd(m.quantidade) },
                { title: 'Saldo', key: 's', width: 120, align: 'right' as const, render: (_, m) => `${qtd(m.saldoAnterior)} → ${qtd(m.saldoPosterior)}` },
                { title: 'Custo médio', key: 'c', width: 110, align: 'right' as const, render: (_, m) => money(m.custoMedio, 4) },
              ]}
            />
            <Space direction="vertical" size={2} style={{ marginTop: 6, fontSize: 12 }}>
              {simulacao.fornecedorVinculado && <Text type="secondary">O código do fornecedor passa a apontar para {simulacao.itemNovo.sku} nas próximas notas.</Text>}
              {simulacao.gtinMovido && <Text type="secondary">O código de barras da nota sai de {simulacao.itemAnterior.sku} e vai para {simulacao.itemNovo.sku}.</Text>}
              {mudouItem && (simulacao.itemAnterior.podeInativar ? (
                <Checkbox checked={inativar} onChange={e => setInativar(e.target.checked)}>
                  Inativar {simulacao.itemAnterior.sku} (fica sem estoque e sem outro uso, provavelmente cadastrado por engano)
                </Checkbox>
              ) : (
                <Text type="secondary">{simulacao.itemAnterior.sku} continua ativo (tem outro estoque ou movimento).</Text>
              ))}
            </Space>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default ModalCorrigirLinha;
