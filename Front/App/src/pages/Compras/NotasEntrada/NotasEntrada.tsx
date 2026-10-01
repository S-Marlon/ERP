// Notas de entrada (modelo novo): registro das NF-e importadas, situação da conferência, itens e o que entrou no estoque.
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button, Card, Col, Descriptions, Drawer, Dropdown, Input, Modal, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { CopyOutlined, DownloadOutlined, EyeOutlined, FileSearchOutlined, MoreOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';

// Sinais de que a linha entrou errada (a correção do vínculo/conversão fica no detalhe da nota)
const ROTULO_ALERTA: Record<string, string> = {
  CUSTO_DESTOA: 'Custo fora do padrão',
  CODIGO_EM_OUTRO_ITEM: 'Código já usado em outro item',
  GTIN_DIVERGENTE: 'GTIN diferente do item',
};
import { useNavigate } from 'react-router-dom';
import { Deposito, DEPOSITOS_ESTOQUE } from '../../Estoque/api/estoqueItensApi';
import {
  descartarNota, detalheNota, DetalheNota, formatarCnpj, ItemNota, listarNotas, NotaEntrada, ResumoNotas, SITUACOES_NOTA,
} from './notasEntradaApi';
import ModalCorrigirLinha from './ModalCorrigirLinha';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const data = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '-');
const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const diasAtras = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const hoje = () => new Date().toISOString().slice(0, 10);

// Detalhe da nota: cabeçalho, totais do XML e itens com o vínculo e a entrada no estoque
const DetalheNotaDrawer: React.FC<{ idLote: number | null; onClose: () => void; onAbrirEntrada: (id: number) => void }> = ({ idLote, onClose, onAbrirEntrada }) => {
  const [nota, setNota] = useState<DetalheNota | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [linhaCorrigir, setLinhaCorrigir] = useState<ItemNota | null>(null);
  const navigate = useNavigate();

  const carregar = () => {
    if (!idLote) { setNota(null); return; }
    setCarregando(true);
    detalheNota(idLote).then(setNota).catch(e => message.error(e.message)).finally(() => setCarregando(false));
  };
  useEffect(carregar, [idLote]);

  const t = nota?.totais;
  return (
    <Drawer
      open={!!idLote}
      onClose={onClose}
      width={1080}
      loading={carregando}
      title={nota ? `NF ${nota.numero}${nota.serie ? `/${nota.serie}` : ''} · ${nota.fantasia || nota.fornecedor}` : 'Nota'}
      extra={nota && (
        <Space>
          <Tag color={SITUACOES_NOTA[nota.situacao].color}>{SITUACOES_NOTA[nota.situacao].label}</Tag>
          <Button type="primary" onClick={() => onAbrirEntrada(nota.idLote)}>
            {nota.situacao === 'IMPORTADA' ? 'Ver na Entrada de NF-e' : 'Continuar conferência'}
          </Button>
        </Space>
      )}
    >
      {nota && t && (
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
          <Descriptions size="small" bordered column={{ xs: 1, md: 3 }}>
            <Descriptions.Item label="Fornecedor" span={2}>
              {nota.fornecedor}{nota.cnpj ? ` · ${formatarCnpj(nota.cnpj)}` : ''}
              {nota.emitente?.municipio && <span style={{ color: '#64748b' }}> · {nota.emitente.municipio}/{nota.emitente.uf}</span>}
            </Descriptions.Item>
            <Descriptions.Item label="Emissão">{data(nota.emissao)}</Descriptions.Item>
            <Descriptions.Item label="Chave de acesso" span={2}>
              <Typography.Text copyable={{ text: nota.chave, icon: <CopyOutlined /> }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {nota.chave}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Entrada no sistema">{dataHora(nota.entradaEm)}</Descriptions.Item>
          </Descriptions>

          <Row gutter={[8, 8]}>
            {[
              ['Produtos', t.produtos], ['Frete (NF)', t.frete], ['Desconto', -t.desconto], ['IPI', t.ipi],
              ['ICMS-ST', t.icmsSt], ['Outras', t.outros], ['Total da NF', t.nota],
              [`Frete adicional${t.freteAdicionalMetodo ? ` (${t.freteAdicionalMetodo})` : ''}`, t.freteAdicional],
            ].map(([rotulo, valor]) => (
              <Col key={String(rotulo)} xs={12} md={6} lg={3}>
                <Card size="small" styles={{ body: { padding: 8 } }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{rotulo}</div>
                  <div style={{ fontWeight: 700 }}>{money(Number(valor))}</div>
                </Card>
              </Col>
            ))}
          </Row>

          {(nota.resumo.comAlerta || 0) > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${nota.resumo.comAlerta} linha(s) com sinal de entrada errada`}
              description="Passe o mouse nas tags laranja para ver o motivo (custo fora do padrão das outras compras, código do fornecedor já usado em outro item, GTIN diferente). Use Corrigir na linha para acertar vínculo ou conversão."
              action={nota.itens.some(i => (i.alertas || []).some(a => a.codigo === 'CODIGO_EM_OUTRO_ITEM')) && (
                <Button size="small" onClick={() => navigate('/catalogo/duplicados')}>Ver itens duplicados</Button>
              )}
            />
          )}

          <Table<ItemNota>
            size="small"
            rowKey="idStaging"
            dataSource={nota.itens}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            scroll={{ x: 1000 }}
            columns={[
              { title: '#', dataIndex: 'seq', width: 42 },
              {
                title: 'Item na NF', key: 'nf',
                render: (_, i) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.descricaoNf}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      Cód. forn.: {i.codigoFornecedor || '-'}{i.ean ? ` · GTIN ${i.ean}` : ''}
                    </div>
                  </div>
                ),
              },
              {
                title: 'Qtd NF', key: 'qnf', width: 110, align: 'right' as const,
                render: (_, i) => (
                  <span>
                    {qtd(i.quantidadeNf)} {i.unidadeNf}
                    {i.quantidadeRecebida !== null && Math.abs(i.quantidadeRecebida - i.quantidadeNf) > 0.0001 && (
                      <Tooltip title="Quantidade conferida diferente da NF"><div style={{ color: '#dc2626', fontSize: 11 }}>recebido {qtd(i.quantidadeRecebida)}</div></Tooltip>
                    )}
                  </span>
                ),
              },
              {
                title: 'Vinculado a', key: 'item',
                render: (_, i) => (i.skuItem ? (
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.nomeItem}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {i.skuItem}
                      {i.tipoEntrada !== 'PRODUTO' && <Tag style={{ marginLeft: 6, fontSize: 10 }}>{i.tipoEntrada}</Tag>}
                    </div>
                    <Space size={4} style={{ marginTop: 3 }} wrap>
                      {(i.correcoes || 0) > 0 && (
                        <Tooltip title="Vínculo ou conversão corrigidos depois da aprovação">
                          <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>corrigida{(i.correcoes || 0) > 1 ? ` (${i.correcoes}x)` : ''}</Tag>
                        </Tooltip>
                      )}
                      {i.status === 'IMPORTADO' && i.idItem && (
                        <Button size="small" type="link" style={{ padding: 0, height: 18, fontSize: 12 }} onClick={() => setLinhaCorrigir(i)}>
                          Corrigir
                        </Button>
                      )}
                    </Space>
                    {(i.alertas || []).map(a => (
                      <Tooltip key={a.codigo} title={a.mensagem}>
                        <Tag color="orange" icon={<WarningOutlined />} style={{ marginTop: 3, fontSize: 10, whiteSpace: 'normal' }}>
                          {ROTULO_ALERTA[a.codigo] || a.codigo}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                ) : <Tag color="red">Sem vínculo</Tag>),
              },
              {
                title: 'Entrou no estoque', key: 'est', width: 170, align: 'right' as const,
                render: (_, i) => (i.quantidadeEstoque !== null ? (
                  <Tooltip title={i.fatorConversao && i.fatorConversao !== 1 ? `Fator ${qtd(i.fatorConversao)} (${i.unidadeNf} → ${i.unidadeBase})` : undefined}>
                    <div>
                      <b style={{ color: '#16a34a' }}>+{qtd(i.quantidadeEstoque)} {i.unidadeBase}</b>
                      {(i.depositos.length > 1 || (i.depositos[0] && i.depositos[0].deposito !== 'VENDA')) && (
                        <div>
                          {i.depositos.map(d => (
                            <Tag key={d.deposito} color={DEPOSITOS_ESTOQUE[d.deposito as Deposito]?.color} style={{ margin: '2px 0 0 4px', fontSize: 10, lineHeight: '14px' }}>
                              {DEPOSITOS_ESTOQUE[d.deposito as Deposito]?.label || d.deposito} {qtd(d.quantidade)}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                ) : <span style={{ color: '#94a3b8' }}>{nota.situacao === 'IMPORTADA' ? 'não entrou' : 'pendente'}</span>),
              },
              { title: 'Custo un. NF', dataIndex: 'custoUnitarioNf', width: 110, align: 'right' as const, render: (v: number) => money(v) },
              {
                title: 'Custo final', key: 'cf', width: 120, align: 'right' as const,
                render: (_, i) => (
                  <Tooltip title={i.freteRateado > 0 ? `Inclui frete rateado de ${money(i.freteRateado)}` : undefined}>
                    <b>{money(i.custoUnitarioFinal)}</b>
                    <div style={{ fontSize: 11, color: '#64748b' }}>total {money(i.custoTotalFinal)}</div>
                  </Tooltip>
                ),
              },
              {
                title: '', key: 'conf', width: 36,
                render: (_, i) => (i.conferido ? <Tooltip title="Conferido">✅</Tooltip> : <Tooltip title="Não conferido">⏳</Tooltip>),
              },
            ]}
          />
        </Space>
      )}

      {idLote && linhaCorrigir && (
        <ModalCorrigirLinha
          idLote={idLote}
          linha={linhaCorrigir}
          onClose={() => setLinhaCorrigir(null)}
          onCorrigido={() => { setLinhaCorrigir(null); carregar(); }}
        />
      )}
    </Drawer>
  );
};

const exportarCsv = (notas: NotaEntrada[]) => {
  const cab = ['Numero', 'Serie', 'Fornecedor', 'CNPJ', 'Emissao', 'Entrada', 'Valor NF', 'Itens', 'Conferidos', 'Situacao', 'Chave'];
  const linhas = notas.map(n => [
    n.numero, n.serie || '', n.fornecedor, formatarCnpj(n.cnpj), data(n.emissao), dataHora(n.entradaEm),
    n.valorNf.toFixed(2).replace('.', ','), n.totalItens, n.conferidos, SITUACOES_NOTA[n.situacao].label, n.chave,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  const blob = new Blob(['﻿' + [cab.join(';'), ...linhas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notas_entrada_${hoje()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const NotasEntrada: React.FC = () => {
  const navigate = useNavigate();
  const [notas, setNotas] = useState<NotaEntrada[]>([]);
  const [resumo, setResumo] = useState<ResumoNotas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [filtros, setFiltros] = useState({ de: diasAtras(90), ate: hoje(), situacao: '', busca: '', incluirDescartadas: false });
  const [notaAberta, setNotaAberta] = useState<number | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await listarNotas(filtros);
      setNotas(r.data);
      setResumo(r.resumo);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [filtros]);
  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada })), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const abrirEntrada = (idLote: number) => navigate(`/compras/entrada-nfe?lote=${idLote}`);

  const descartar = (n: NotaEntrada) => Modal.confirm({
    title: `Descartar a NF ${n.numero}?`,
    content: 'A conferência em andamento é abandonada (nada entra no estoque). A nota fica registrada como descartada.',
    okText: 'Descartar',
    okType: 'danger',
    onOk: async () => {
      try {
        await descartarNota(n.idLote);
        message.success(`NF ${n.numero} descartada.`);
        carregar();
      } catch (e: any) {
        Modal.error({ title: 'Não foi possível descartar', content: e.message });
      }
    },
  });

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Notas de Entrada</h2>
          <Space wrap>
            <Button type="primary" icon={<FileSearchOutlined />} onClick={() => navigate('/compras/entrada-nfe')}>Nova entrada de NF-e</Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportarCsv(notas)} disabled={notas.length === 0}>Exportar CSV</Button>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          </Space>
        </div>

        {resumo && (
          <Row gutter={[12, 12]}>
            {[
              { titulo: 'Notas no período', valor: String(resumo.notas), situacao: '' },
              { titulo: 'Entrada realizada', valor: `${resumo.importadas} · ${money(resumo.valorImportado)}`, situacao: 'IMPORTADA' },
              { titulo: 'Pendentes de entrada', valor: `${resumo.pendentes} · ${money(resumo.valorPendente)}`, situacao: 'EM_CONFERENCIA' },
            ].map(c => (
              <Col key={c.titulo} xs={24} md={8}>
                <Card
                  size="small"
                  hoverable={!!c.situacao}
                  onClick={() => c.situacao && setFiltros(f => ({ ...f, situacao: f.situacao === c.situacao ? '' : c.situacao }))}
                  style={filtros.situacao && filtros.situacao === c.situacao ? { borderColor: '#1677ff' } : undefined}
                >
                  <Statistic title={c.titulo} value={c.valor} valueStyle={{ fontSize: 18, fontWeight: 700 }} />
                </Card>
              </Col>
            ))}
          </Row>
        )}

        <Card size="small">
          <Space wrap style={{ marginBottom: 8 }}>
            <Input type="date" value={filtros.de} max={filtros.ate} onChange={e => setFiltros(f => ({ ...f, de: e.target.value }))} style={{ width: 150 }} />
            <span>até</span>
            <Input type="date" value={filtros.ate} min={filtros.de} onChange={e => setFiltros(f => ({ ...f, ate: e.target.value }))} style={{ width: 150 }} />
            <Select
              style={{ width: 200 }}
              value={filtros.situacao}
              onChange={v => setFiltros(f => ({ ...f, situacao: v }))}
              options={[{ value: '', label: 'Todas as situações' }, ...Object.entries(SITUACOES_NOTA)
                .filter(([k]) => k !== 'DESCARTADA' || filtros.incluirDescartadas)
                .map(([k, v]) => ({ value: k, label: v.label }))]}
            />
            <Input.Search allowClear placeholder="Nº, fornecedor, CNPJ ou chave" style={{ width: 280 }} value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} />
            <Space size={4}><Switch size="small" checked={filtros.incluirDescartadas} onChange={v => setFiltros(f => ({ ...f, incluirDescartadas: v }))} /> Descartadas</Space>
          </Space>

          <Table<NotaEntrada>
            rowKey="idLote"
            size="small"
            loading={carregando}
            dataSource={notas}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 30, hideOnSinglePage: true }}
            onRow={n => ({ onDoubleClick: () => setNotaAberta(n.idLote) })}
            columns={[
              {
                title: 'NF', key: 'nf', width: 110,
                render: (_, n) => <b>{n.numero}{n.serie && n.serie !== '0' ? `/${n.serie}` : ''}</b>,
              },
              {
                title: 'Fornecedor', key: 'forn',
                render: (_, n) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{n.fantasia || n.fornecedor}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{formatarCnpj(n.cnpj)}</div>
                  </div>
                ),
              },
              { title: 'Emissão', dataIndex: 'emissao', width: 100, render: (v: string | null) => data(v) },
              { title: 'Entrada', dataIndex: 'entradaEm', width: 130, render: (v: string) => dataHora(v) },
              { title: 'Valor NF', dataIndex: 'valorNf', width: 120, align: 'right' as const, render: (v: number) => <b>{money(v)}</b> },
              {
                title: 'Conferência', key: 'conf', width: 140,
                render: (_, n) => (
                  <div>
                    <span>{n.conferidos}/{n.totalItens} itens</span>
                    {n.semVinculo > 0 && n.situacao !== 'IMPORTADA' && <div style={{ fontSize: 11, color: '#dc2626' }}>{n.semVinculo} sem vínculo</div>}
                  </div>
                ),
              },
              {
                title: 'Situação', dataIndex: 'situacao', width: 150,
                render: (s: NotaEntrada['situacao']) => <Tag color={SITUACOES_NOTA[s].color}>{SITUACOES_NOTA[s].label}</Tag>,
              },
              {
                title: '', key: 'acoes', width: 90, fixed: 'right' as const,
                render: (_, n) => (
                  <Space size={0}>
                    <Tooltip title="Detalhes da nota"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setNotaAberta(n.idLote)} /></Tooltip>
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          { key: 'abrir', label: n.situacao === 'IMPORTADA' ? 'Ver na Entrada de NF-e' : 'Continuar conferência' },
                          { key: 'staging', label: 'Revisar no Staging', disabled: n.situacao === 'IMPORTADA' || n.situacao === 'DESCARTADA' },
                          { type: 'divider' },
                          { key: 'descartar', label: 'Descartar', danger: true, disabled: n.situacao === 'IMPORTADA' || n.situacao === 'DESCARTADA' },
                        ],
                        onClick: ({ key }) => {
                          if (key === 'abrir') abrirEntrada(n.idLote);
                          if (key === 'staging') navigate('/stagings');
                          if (key === 'descartar') descartar(n);
                        },
                      }}
                    >
                      <Button type="text" size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <DetalheNotaDrawer idLote={notaAberta} onClose={() => setNotaAberta(null)} onAbrirEntrada={id => { setNotaAberta(null); abrirEntrada(id); }} />
    </div>
  );
};

export default NotasEntrada;
