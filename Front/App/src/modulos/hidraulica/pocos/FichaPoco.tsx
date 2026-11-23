// Obras de poços › ficha completa do poço (abre por cima de qualquer tela: busca, mapa, ficha do cliente): dados e
// localização, proprietário, os contratos/obras do poço (formal ou informal, relatório, documentos, garantia) e o
// histórico com a manutenção. Também o "hospedeiro" das fichas globais (poço e cliente), montado uma vez na página.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Col, Descriptions, Drawer, Empty, Row, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import {
  CopyOutlined, EditOutlined, EnvironmentOutlined, FileTextOutlined, FolderOpenOutlined, GlobalOutlined, ToolOutlined, UserOutlined, WarningOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import { dataBr, foneBr, obrasApi, PocoCompleto, SERVICOS, SITUACOES_OBRA, TIPOS_CONTRATO } from './obrasApi';
import { abrirFichaCliente, abrirObra, abrirPoco, documentosDaObra, fichasPocos, useFichaPocos, verNoMapa } from './navPocos';
import { HistoricoDoPoco } from './ManutencaoPocos';
import { ClienteFicha } from './ClientesPoco';
import { ConjuntoPoco } from './ConjuntoPoco';
import { GRUPOS_OCORRENCIA } from './ocorrencias';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SITUACAO_POCO: Record<string, { texto: string; cor: string }> = { ATIVO: { texto: 'Ativo', cor: 'green' }, SECO: { texto: 'Seco', cor: 'default' }, DESATIVADO: { texto: 'Desativado', cor: 'default' } };

export const FichaPoco: React.FC<{ idPoco: number | null; aba?: string; onFechar: () => void }> = ({ idPoco, aba: abaPedida, onFechar }) => {
  const [d, setD] = useState<PocoCompleto | null>(null);
  const [aba, setAba] = useState('DADOS');
  useEffect(() => {
    setD(null);
    if (!idPoco) return;
    obrasApi.pocoCompleto(idPoco).then(r => { setD(r); setAba(abaPedida || (r.contratos.length ? 'CONTRATOS' : 'DADOS')); }).catch(e => message.error(e.message));
  }, [idPoco]);
  const ir = (fn: () => void) => { onFechar(); fn(); };
  const p = d?.poco, dono = d?.proprietario;
  const gps = p && p.latitude !== null && p.longitude !== null ? `${p.latitude}, ${p.longitude}` : null;
  const fone = String(dono?.telefone || '').replace(/\D/g, '');
  const local = p ? [p.endereco, p.bairro, p.cidade && `${p.cidade}${p.uf ? `/${p.uf}` : ''}`].filter(Boolean).join(' · ') : '';

  const abas = d && p ? [
    {
      key: 'CONTRATOS', label: `Contratos e obras (${d.contratos.length})`, children: (
        <Table size="small" rowKey="idObra" pagination={false} dataSource={d.contratos}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma obra ligada a este poço" /> }}
          columns={[
            { title: 'Nº', dataIndex: 'idObra', width: 55 },
            {
              title: 'Obra', render: (_, o) => (
                <div style={{ lineHeight: 1.35 }}>
                  <Text strong>{o.titulo}</Text>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>
                    {o.servicos.map(s => SERVICOS[s]).join(' + ')}
                    {o.cliente && o.idCliente !== dono?.idCliente ? ` · cliente: ${o.cliente}` : ''}
                    {' · '}{o.dataTermino ? `concluída ${dataBr(o.dataTermino)}` : o.dataInicio ? `iniciada ${dataBr(o.dataInicio)}` : `criada ${dataBr(o.criadaEm)}`}
                  </Text></div>
                </div>
              ),
            },
            {
              title: 'Contrato', width: 190, render: (_, o) => (
                <Space size={2} wrap>
                  <Tag color={SITUACOES_OBRA[o.situacao].cor}>{SITUACOES_OBRA[o.situacao].texto}</Tag>
                  <Tooltip title={TIPOS_CONTRATO[o.tipoContrato].dica}><Tag color={TIPOS_CONTRATO[o.tipoContrato].cor}>{TIPOS_CONTRATO[o.tipoContrato].texto}</Tag></Tooltip>
                  {o.aditivos > 0 && <Tag>{o.aditivos} aditivo(s)</Tag>}
                  {o.temRelatorio && <Tag color="blue">relatório</Tag>}
                </Space>
              ),
            },
            {
              title: 'Valor', width: 120, align: 'right', render: (_, o) => (
                <>{brl(o.total)}{o.aReceber > 0 && <div><Text type="warning" style={{ fontSize: 12 }}>falta {brl(o.aReceber)}</Text></div>}</>
              ),
            },
            { title: 'Garantia até', width: 100, render: (_, o) => dataBr(o.garantiaAte) },
            {
              title: '', width: 120, render: (_, o) => (
                <Space size={0}>
                  <Tooltip title="Abrir a obra"><Button size="small" type="text" icon={<FolderOpenOutlined />} onClick={() => ir(() => abrirObra(o.idObra, 'ORCAMENTO'))} /></Tooltip>
                  <Tooltip title={o.temRelatorio ? 'Relatório técnico da obra' : 'Relatório técnico (ainda sem dados de campo)'}>
                    <Button size="small" type="text" icon={<ToolOutlined style={{ color: o.temRelatorio ? '#1677ff' : undefined }} />} onClick={() => ir(() => abrirObra(o.idObra, 'RELATORIO'))} />
                  </Tooltip>
                  <Tooltip title="Documentos: orçamento, contrato, aditivos, laudo e adesivo para ver e imprimir">
                    <Button size="small" type="text" icon={<FileTextOutlined />} onClick={() => ir(() => documentosDaObra(o.idObra))} />
                  </Tooltip>
                </Space>
              ),
            },
          ]} />
      ),
    },
    {
      key: 'DADOS', label: 'Dados e localização', children: (
        <Descriptions size="small" bordered column={{ xs: 1, md: 2 }} items={[
          {
            key: 'dono', label: 'Proprietário', children: dono
              ? <Button type="link" size="small" style={{ padding: 0 }} icon={<UserOutlined />} onClick={() => abrirFichaCliente(dono.idCliente)}>{dono.nome}</Button>
              : <Text type="secondary">sem proprietário cadastrado</Text>,
          },
          { key: 'fone', label: 'Telefone', children: dono?.telefone ? foneBr(dono.telefone) : '—' },
          { key: 'local', label: 'Endereço', span: 2, children: local || '—' },
          {
            key: 'gps', label: 'GPS', span: 2, children: gps ? (
              <Space wrap>
                <Text copyable={{ text: gps, icon: <CopyOutlined /> }}>{gps}</Text>
                <Button size="small" icon={<EnvironmentOutlined />} onClick={() => ir(() => verNoMapa(p.latitude!, p.longitude!, p.idPoco))}>Ver no mapa</Button>
                <Button size="small" icon={<GlobalOutlined />} href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank">Google Maps (rota)</Button>
              </Space>
            ) : <Text type="secondary">sem GPS</Text>,
          },
          { key: 'prof', label: 'Profundidade', children: p.profundidadeM ? `${p.profundidadeM} m` : '—' },
          { key: 'diam', label: 'Diâmetro', children: p.diametro || '—' },
          { key: 'vaz', label: 'Vazão', children: p.vazaoLh ? `${p.vazaoLh.toLocaleString('pt-BR')} L/h` : '—' },
          { key: 'niv', label: 'NE / ND', children: p.nivelEstaticoM !== null || p.nivelDinamicoM !== null ? `${p.nivelEstaticoM ?? '—'} / ${p.nivelDinamicoM ?? '—'} m` : '—' },
          { key: 'solo', label: 'Solo', children: p.tipoSolo || '—' },
          { key: 'perf', label: 'Perfurado', children: <>{p.perfuradoPor === 'NOS' ? 'por nós' : p.perfuradoPor === 'TERCEIRO' ? `por ${p.perfuradoPorNome || 'terceiro'}` : 'não se sabe por quem'}{p.dataPerfuracao ? ` em ${dataBr(p.dataPerfuracao)}` : ''}</> },
          { key: 'obs', label: 'Observação', span: 2, children: p.observacao || '—' },
        ]} />
      ),
    },
    { key: 'BOMBA', label: 'Bomba e instalação', children: <ConjuntoPoco idPoco={p.idPoco} onAbrirObra={id => ir(() => abrirObra(id))} /> },
    { key: 'HISTORICO', label: 'Histórico e manutenção', children: <HistoricoDoPoco idPoco={p.idPoco} onAbrirObra={onFechar} /> },
  ] : [];

  return (
    <Drawer open={!!idPoco} onClose={onFechar} width={1000} destroyOnHidden loading={!!idPoco && !d}
      title={p ? <Space wrap><EnvironmentOutlined />{p.identificacao}<Tag color={SITUACAO_POCO[p.situacao]?.cor}>{SITUACAO_POCO[p.situacao]?.texto || p.situacao}</Tag>
        {d?.resumo.sensores && <Tag color="purple">sensores</Tag>}</Space> : 'Poço'}
      extra={p && <Space wrap>
        {fone.length >= 10 && <Button icon={<WhatsAppOutlined />} onClick={() => window.open(`https://wa.me/55${fone}`, '_blank')}>WhatsApp</Button>}
        {dono && <Button icon={<UserOutlined />} onClick={() => abrirFichaCliente(dono.idCliente)}>Cliente</Button>}
        {gps && <Button icon={<EnvironmentOutlined />} onClick={() => ir(() => verNoMapa(p.latitude!, p.longitude!, p.idPoco))}>Mapa</Button>}
        <Button icon={<EditOutlined />} onClick={() => ir(() => abrirPoco(p.idPoco))}>Editar dados</Button>
      </Space>}>
      {d && p && (
        <>
          <Row gutter={12} style={{ marginBottom: 8 }}>
            <Col xs={12} md={5}><Statistic title="Profundidade" value={p.profundidadeM ? `${p.profundidadeM} m` : '—'} /></Col>
            <Col xs={12} md={5}><Statistic title="Vazão" value={p.vazaoLh ? `${p.vazaoLh.toLocaleString('pt-BR')} L/h` : '—'} /></Col>
            <Col xs={12} md={5}><Statistic title="Nível estático" value={p.nivelEstaticoM !== null ? `${p.nivelEstaticoM} m` : '—'} /></Col>
            <Col xs={12} md={4}><Statistic title="Contratos" value={d.resumo.contratos} /></Col>
            <Col xs={24} md={5}>
              <Statistic title="Garantia" value={d.resumo.garantiaAte ? `até ${dataBr(d.resumo.garantiaAte)}` : '—'}
                valueStyle={{ fontSize: 16, color: d.resumo.garantiaAte ? (d.resumo.emGarantia ? '#389e0d' : '#8c8c8c') : undefined }} />
            </Col>
          </Row>
          <Space direction="vertical" size={6} style={{ width: '100%', marginBottom: 8 }}>
            <Text type="secondary"><UserOutlined /> {dono ? `${dono.nome}${dono.telefone ? ` · ${foneBr(dono.telefone)}` : ''}` : 'sem proprietário'} · <EnvironmentOutlined /> {local || 'sem endereço'}</Text>
            <Text type="secondary"><ToolOutlined /> {d.conjunto
              ? <a onClick={() => setAba('BOMBA')}>{d.conjunto.resumo}{d.conjunto.anosDeUso !== null ? ` · ${d.conjunto.anosDeUso < 1 ? 'menos de 1 ano' : `${d.conjunto.anosDeUso} ano(s)`} de uso` : ''}</a>
              : <a onClick={() => setAba('BOMBA')}>bomba não registrada</a>}</Text>
            {!gps && <Alert type="warning" showIcon message="Poço sem GPS: em Editar dados, cole a localização (ex.: do WhatsApp ou do Google Maps) para ele aparecer no mapa." />}
            {/* Ocorrências do checklist dos relatórios: o que já deu problema neste poço (o que se repete fica em destaque) */}
            {!!d.ocorrencias?.length && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}><WarningOutlined /> Ocorrências registradas nos relatórios:</Text>
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {d.ocorrencias.map(o => (
                    <Tooltip key={o.codigo} title={`${GRUPOS_OCORRENCIA[o.grupo]?.titulo || ''} · ${o.vezes > 1 ? `${o.vezes} vezes, a última` : 'marcada'} em ${o.ultimaVez ? dataBr(o.ultimaVez) : 'data não informada'} (${o.origem})`}>
                      <Tag color={o.vezes > 1 ? 'red' : GRUPOS_OCORRENCIA[o.grupo]?.cor} style={{ margin: 0 }}>{o.rotulo}{o.vezes > 1 ? ` ×${o.vezes}` : ''}</Tag>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </Space>
          <Tabs activeKey={aba} onChange={setAba} items={abas} />
        </>
      )}
    </Drawer>
  );
};

/** As fichas globais do módulo (montado uma vez na página): abrem pela busca, pelo mapa ou de uma ficha para outra. */
export const FichasPocos: React.FC = () => {
  const f = useFichaPocos();
  const fechar = () => fichasPocos.abrir(null);
  return (
    <>
      <FichaPoco idPoco={f?.tipo === 'POCO' ? f.id : null} aba={f?.aba} onFechar={fechar} />
      <ClienteFicha idCliente={f?.tipo === 'CLIENTE' ? f.id : null} onFechar={fechar} onSalvo={() => undefined} />
    </>
  );
};
