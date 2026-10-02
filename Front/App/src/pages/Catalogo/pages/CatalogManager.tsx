// Painel do catálogo (PIM): saúde do cadastro em números reais, o fluxo de cadastro e os módulos do catálogo.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Col, Progress, Row, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import {
  AlertOutlined, AppstoreOutlined, ArrowRightOutlined, BarChartOutlined, BarcodeOutlined, ClusterOutlined, DollarOutlined,
  FileDoneOutlined, FileTextOutlined, FolderOutlined, MergeCellsOutlined, PlusOutlined, ReloadOutlined,
  SafetyCertificateOutlined, SyncOutlined, TagsOutlined, ToolOutlined,
} from '@ant-design/icons';
import { getPendenciasPim } from './PendenciasPim/pendenciasApi';
import { getDuplicados } from './ItensDuplicados/duplicadosApi';
import { getTipoRecursoConfig } from '../../Compras/StockEntry/tipoRecurso';

const { Text, Title } = Typography;

interface ResumoCatalogo {
  itens: { total: number; ativos: number; inativos: number; porTipo: Record<string, number> };
  publicacao: { itensVenda: number; publicaveis: number; foraDoPdv: number };
  cadastro: { semClassificacao: number; semFamilia: number; semPreco: number; semGtin: number };
  estrutura: { familias: { total: number; porStatus: Record<string, number> }; categorias: number; atributos: number; marcas: number };
  entradas: { aguardandoAprovacao: number; importadas30dias: number };
}

const getResumo = async (): Promise<ResumoCatalogo> => {
  const r = await fetch('http://localhost:3001/api/catalogo/resumo?tenant_id=1');
  const d = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error('O servidor não conhece o resumo do catálogo ainda: reinicie o backend (npm start).');
  if (!r.ok) throw new Error(d.error || 'Erro ao carregar o resumo do catálogo.');
  return d;
};

const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export const CatalogManager: React.FC = () => {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<ResumoCatalogo | null>(null);
  const [pendencias, setPendencias] = useState<{ total: number; criticos: number } | null>(null);
  const [duplicados, setDuplicados] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const [r, p, d] = await Promise.allSettled([getResumo(), getPendenciasPim({ tipo: 'VENDA', limit: 1 }), getDuplicados()]);
    if (r.status === 'fulfilled') setResumo(r.value); else message.error(r.reason?.message);
    if (p.status === 'fulfilled') setPendencias({ total: p.value.totalItensComPendencia, criticos: p.value.criticos });
    if (d.status === 'fulfilled') setDuplicados(d.value.length);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const familiasAtencao = resumo
    ? (resumo.estrutura.familias.porStatus.RASCUNHO || 0) + (resumo.estrutura.familias.porStatus.BLOQUEADO_INCONSISTENCIA || 0) + (resumo.estrutura.familias.porStatus.INATIVO || 0)
    : 0;
  const noPdv = resumo ? pct(resumo.publicacao.publicaveis, resumo.publicacao.itensVenda) : 0;

  // ---------------------------------------------------------------- indicadores
  const indicador = (titulo: string, valor: React.ReactNode, rodape: React.ReactNode, onClick?: () => void, cor?: string) => (
    <Card size="small" hoverable={Boolean(onClick)} onClick={onClick} style={{ height: '100%' }} styles={{ body: { padding: '10px 14px' } }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: cor }}>{valor}</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>{rodape}</div>
    </Card>
  );

  // ---------------------------------------------------------------- lacunas de cadastro (atalhos para as pendências)
  const lacunas = resumo ? [
    { rotulo: 'Sem preço de venda', valor: resumo.cadastro.semPreco, base: resumo.publicacao.itensVenda, codigo: 'SEM_PRECO', critico: true },
    { rotulo: 'Sem família nem categoria', valor: resumo.cadastro.semClassificacao, base: resumo.itens.ativos, codigo: 'SEM_CLASSIFICACAO' },
    { rotulo: 'Sem código de barras', valor: resumo.cadastro.semGtin, base: resumo.publicacao.itensVenda, codigo: 'SEM_GTIN' },
  ] : [];

  // ---------------------------------------------------------------- fluxo do cadastro (regras do PIM)
  const fluxo = [
    { titulo: 'Categoria', icone: <FolderOutlined />, rota: '/catalogo/categorias', regra: 'Árvore mercadológica. Atributos ligados aqui são herdados pelas subcategorias.' },
    { titulo: 'Família', icone: <ClusterOutlined />, rota: '/catalogo/familias', regra: 'Agrupa os SKUs do mesmo produto. Atributos: DNA (igual para todos), Grade (diferencia os SKUs) e Ficha. Define o papel da marca e a categoria.' },
    { titulo: 'Item (SKU)', icone: <AppstoreOutlined />, rota: '/catalogo/gerenciador', regra: 'Nasce na entrada de NF ou no cadastro. SKU raiz gerado pelo sistema; SKU Customizado único e editável.' },
    { titulo: 'Preço', icone: <DollarOutlined />, rota: '/catalogo/preco', regra: 'Unidades de venda e faixas de varejo/atacado sobre o custo base.' },
    { titulo: 'PDV', icone: <SafetyCertificateOutlined />, rota: '/catalogo/pendencias', regra: 'Publicado quando a família está ativa e os atributos obrigatórios estão preenchidos. Só o depósito Venda aparece.' },
  ];

  // ---------------------------------------------------------------- módulos
  const modulos: Array<{ titulo: string; descricao: string; rota: string; icone: React.ReactNode; contador?: React.ReactNode; destaque?: boolean }> = [
    {
      titulo: 'Produtos (SKUs)', rota: '/catalogo/gerenciador', icone: <AppstoreOutlined />,
      descricao: 'Lista do catálogo, ficha completa do item (identidade, ficha técnica, preços, fornecedores, estoque) e etiquetas.',
      contador: resumo && <Tag style={{ margin: 0 }}>{resumo.itens.ativos} ativos</Tag>,
    },
    {
      titulo: 'Pendências do PIM', rota: '/catalogo/pendencias', icone: <AlertOutlined />, destaque: Boolean(pendencias?.criticos),
      descricao: 'Itens com cadastro a completar, por família: obrigatórios vazios, família não ativa, sem preço, sem GTIN, grade vazia.',
      contador: pendencias && (pendencias.criticos > 0
        ? <Tag color="red" style={{ margin: 0 }}>{pendencias.criticos} críticos</Tag>
        : <Tag color="green" style={{ margin: 0 }}>em dia</Tag>),
    },
    {
      titulo: 'Itens duplicados', rota: '/catalogo/duplicados', icone: <MergeCellsOutlined />, destaque: Boolean(duplicados),
      descricao: 'Itens que parecem o mesmo produto (mesmo código de fornecedor ou nome). Unifica estoque, vínculos e GTINs.',
      contador: duplicados !== null && (duplicados > 0
        ? <Tag color="orange" style={{ margin: 0 }}>{duplicados} suspeita(s)</Tag>
        : <Tag color="green" style={{ margin: 0 }}>nenhum</Tag>),
    },
    {
      titulo: 'Famílias', rota: '/catalogo/familias', icone: <ClusterOutlined />,
      descricao: 'DNA, grade e ficha dos atributos, papel da marca, template de nome e SKU, saúde da família.',
      contador: resumo && (
        <Space size={4}>
          <Tag style={{ margin: 0 }}>{resumo.estrutura.familias.total}</Tag>
          {familiasAtencao > 0 && (
            <Tooltip title="Em rascunho, inativas ou bloqueadas: os itens delas ficam fora do PDV">
              <Tag color="orange" style={{ margin: 0 }}>{familiasAtencao} não ativa(s)</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      titulo: 'Categorias', rota: '/catalogo/categorias', icone: <FolderOutlined />,
      descricao: 'Árvore de categorias e herança de atributos entre os níveis.',
      contador: resumo && <Tag style={{ margin: 0 }}>{resumo.estrutura.categorias}</Tag>,
    },
    {
      titulo: 'Atributos', rota: '/catalogo/atributos', icone: <ToolOutlined />,
      descricao: 'Dicionário de especificações: tipo (lista, número, sim/não...), opções e unidades.',
      contador: resumo && <Tag style={{ margin: 0 }}>{resumo.estrutura.atributos}</Tag>,
    },
    {
      titulo: 'Marcas', rota: '/catalogo/marcas', icone: <TagsOutlined />,
      descricao: 'Marcas dos produtos; na família a marca pode ser DNA (fixa) ou grade (gera variação).',
      contador: resumo && <Tag style={{ margin: 0 }}>{resumo.estrutura.marcas}</Tag>,
    },
    {
      titulo: 'Precificação', rota: '/catalogo/preco', icone: <DollarOutlined />,
      descricao: 'Unidades de venda, faixas de atacado, custo gerencial e alerta de custo defasado.',
      contador: resumo && resumo.cadastro.semPreco > 0 && <Tag color="red" style={{ margin: 0 }}>{resumo.cadastro.semPreco} sem preço</Tag>,
    },
    {
      titulo: 'Entrada de NF-e', rota: '/compras/entrada-nfe', icone: <FileTextOutlined />,
      descricao: 'Onde os itens nascem: vincular ou cadastrar com classificação, conversão, destino e preço.',
      contador: resumo && resumo.entradas.aguardandoAprovacao > 0 && (
        <Tag color="blue" style={{ margin: 0 }}>{resumo.entradas.aguardandoAprovacao} em conferência</Tag>
      ),
    },
    {
      titulo: 'Notas de Entrada', rota: '/compras/notas', icone: <FileDoneOutlined />,
      descricao: 'Histórico das notas, alertas de entrada errada e correção de vínculo ou conversão.',
      contador: resumo && <Tag style={{ margin: 0 }}>{resumo.entradas.importadas30dias} em 30 dias</Tag>,
    },
  ];

  const roadmap = [
    { titulo: 'Gerador de grade', descricao: 'Criar em lote os SKUs de uma família a partir dos valores de grade.', icone: <BarcodeOutlined /> },
    { titulo: 'Publicação omnichannel', descricao: 'Mapear atributos e publicar em e-commerce (Mercado Livre, Shopify...).', icone: <SyncOutlined /> },
    { titulo: 'Homologação de itens', descricao: 'Aprovação técnica de itens novos antes de liberar para venda.', icone: <SafetyCertificateOutlined /> },
    { titulo: 'Curva ABC por atributo', descricao: 'Quais variações (cor, tamanho, potência) mais vendem.', icone: <BarChartOutlined /> },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Catálogo (PIM)</Title>
            <Text type="secondary">Cadastro mestre dos itens: classificação, atributos, preços e o que vai para o PDV.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/catalogo/gerenciador')}>Produtos</Button>
          </Space>
        </div>

        <Spin spinning={carregando && !resumo}>
          {/* Saúde do catálogo */}
          <Row gutter={[10, 10]}>
            <Col xs={12} lg={6}>
              {indicador('Itens ativos', resumo?.itens.ativos ?? '—', resumo && (
                <Space size={4} wrap>
                  {Object.entries(resumo.itens.porTipo).map(([tipo, qtd]) => (
                    <Tag key={tipo} color={getTipoRecursoConfig(tipo).color} style={{ margin: 0, fontSize: 11 }}>{getTipoRecursoConfig(tipo).short} {qtd}</Tag>
                  ))}
                  {resumo.itens.inativos > 0 && <Text type="secondary" style={{ fontSize: 11 }}>· {resumo.itens.inativos} inativos</Text>}
                </Space>
              ), () => navigate('/catalogo/gerenciador'))}
            </Col>
            <Col xs={12} lg={6}>
              {indicador('Publicados no PDV', resumo ? `${noPdv}%` : '—', resumo && (
                <div>
                  <Progress percent={noPdv} showInfo={false} size="small" strokeColor={noPdv >= 90 ? '#52c41a' : noPdv >= 70 ? '#faad14' : '#ff4d4f'} style={{ margin: 0 }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {resumo.publicacao.publicaveis} de {resumo.publicacao.itensVenda} itens de venda
                    {resumo.publicacao.foraDoPdv > 0 && <> · <Text type="danger" style={{ fontSize: 11 }}>{resumo.publicacao.foraDoPdv} fora</Text></>}
                  </Text>
                </div>
              ), () => navigate('/catalogo/pendencias'), noPdv >= 90 ? '#389e0d' : undefined)}
            </Col>
            <Col xs={12} lg={6}>
              {indicador('Pendências críticas', pendencias?.criticos ?? '—', pendencias && (
                <Text type="secondary" style={{ fontSize: 11 }}>{pendencias.total} item(ns) com algo a completar</Text>
              ), () => navigate('/catalogo/pendencias'), pendencias?.criticos ? '#cf1322' : '#389e0d')}
            </Col>
            <Col xs={12} lg={6}>
              {indicador('Notas em conferência', resumo?.entradas.aguardandoAprovacao ?? '—', resumo && (
                <Text type="secondary" style={{ fontSize: 11 }}>{resumo.entradas.importadas30dias} nota(s) com entrada nos últimos 30 dias</Text>
              ), () => navigate('/compras/notas'))}
            </Col>
          </Row>
        </Spin>

        <Row gutter={[14, 14]}>
          {/* Fluxo do cadastro + lacunas */}
          <Col xs={24} xl={16}>
            <Card size="small" title="Como o cadastro funciona" styles={{ body: { padding: 12 } }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', flexWrap: 'wrap' }}>
                {fluxo.map((f, i) => (
                  <React.Fragment key={f.titulo}>
                    <div
                      onClick={() => navigate(f.rota)}
                      style={{ flex: '1 1 150px', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', background: '#fafafa' }}
                    >
                      <Space size={6} style={{ fontWeight: 600 }}><span style={{ color: '#1677ff' }}>{f.icone}</span>{f.titulo}</Space>
                      <div style={{ fontSize: 11, color: '#595959', marginTop: 4, lineHeight: 1.4 }}>{f.regra}</div>
                    </div>
                    {i < fluxo.length - 1 && <div style={{ display: 'flex', alignItems: 'center', color: '#bfbfbf' }}><ArrowRightOutlined /></div>}
                  </React.Fragment>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card size="small" title="Lacunas de cadastro" styles={{ body: { padding: 12 } }} style={{ height: '100%' }}>
              {!resumo ? <Text type="secondary">—</Text> : (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {lacunas.map(l => (
                    <div key={l.codigo} onClick={() => navigate(`/catalogo/pendencias?codigo=${l.codigo}`)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{l.rotulo}</span>
                        <b style={{ color: l.valor === 0 ? '#389e0d' : l.critico ? '#cf1322' : '#d48806' }}>{l.valor} de {l.base}</b>
                      </div>
                      <Progress percent={pct(l.valor, l.base)} showInfo={false} size="small" strokeColor={l.critico ? '#ff4d4f' : '#faad14'} style={{ margin: 0 }} />
                    </div>
                  ))}
                  <Text type="secondary" style={{ fontSize: 11 }}>Clique para abrir a lista filtrada nas Pendências do PIM.</Text>
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        {/* Módulos */}
        <div>
          <Text strong style={{ fontSize: 15 }}>Módulos</Text>
          <Row gutter={[10, 10]} style={{ marginTop: 6 }}>
            {modulos.map(m => (
              <Col key={m.titulo} xs={24} md={12} xl={8} xxl={6}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(m.rota)}
                  style={{ height: '100%', borderColor: m.destaque ? '#ffccc7' : undefined }}
                  styles={{ body: { padding: '10px 12px' } }}
                >
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ fontSize: 20, color: m.destaque ? '#cf1322' : '#1677ff', lineHeight: 1 }}>
                      {m.destaque ? <Badge dot offset={[2, 0]}>{m.icone}</Badge> : m.icone}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                        <Text strong>{m.titulo}</Text>
                        {m.contador}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{m.descricao}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Próximos passos */}
        <div>
          <Text strong style={{ fontSize: 15 }}>Próximos passos</Text>
          <Row gutter={[10, 10]} style={{ marginTop: 6 }}>
            {roadmap.map(r => (
              <Col key={r.titulo} xs={24} md={12} xl={6}>
                <div style={{ border: '1px dashed #d9d9d9', borderRadius: 8, padding: '8px 12px', height: '100%', background: '#fcfcfc' }}>
                  <Space size={6} style={{ color: '#8c8c8c' }}>{r.icone}<Text type="secondary" strong>{r.titulo}</Text></Space>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{r.descricao}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Space>
    </div>
  );
};

export default CatalogManager;
