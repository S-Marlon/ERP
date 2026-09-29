import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Popconfirm,
  message,
  Tooltip,
  Badge,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Divider,
  Input,
  Select,
  Alert,
  Spin,
  Switch,
  Progress
} from 'antd';
import {
  CloudServerOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  InboxOutlined,
  EyeOutlined,
  SearchOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AimOutlined,
  UndoOutlined
} from '@ant-design/icons';
import { getTipoRecursoConfig } from '../../../Compras/StockEntry/tipoRecurso';

const { Text, Title } = Typography;
const { Search } = Input;

const API_BASE = 'http://localhost:3001/api/compras';

type StatusLote = 'RASCUNHO' | 'PRONTO_PARA_APROVACAO' | 'IMPORTADO' | 'DESCARTADO' | 'ERRO';

interface StagingLote {
  id: number;
  chaveAcesso: string;
  numeroNf: string | null;
  emitenteNome: string;
  cnpjEmitente: string;
  valorTotalNf: number;
  totalItens: number;
  totalConferidos: number;
  totalSemVinculo: number;
  totalDivergencias: number;
  status: StatusLote;
  dataCriacao: string;
  erroMensagem?: string | null;
}

interface Verificacao {
  codigo: string;
  mensagem: string;
  itens?: string[];
}

interface AnalisePenteFino {
  aprovavel: boolean;
  bloqueios: Verificacao[];
  avisos: Verificacao[];
  resumo: { totalItens: number; conferidos: number; novos: number; vinculados: number; valorItens: number; valorNota: number };
}

interface StockEntryStagingViewProps {
  onSelectLote?: (loteId: number, itens: any[]) => void;
}

const LOTE_FINALIZADO: StatusLote[] = ['IMPORTADO', 'DESCARTADO'];

const lerMapeamento = (record: any): Record<string, any> => {
  if (!record.mapeamento_json) return {};
  try {
    return typeof record.mapeamento_json === 'string' ? JSON.parse(record.mapeamento_json) : record.mapeamento_json;
  } catch {
    return {};
  }
};

// Preferência do modo foco guardada no navegador (conveniência; pode não estar disponível)
const FOCO_STORAGE_KEY = 'staging.revisao.modoFoco';
const lerPreferenciaFoco = (): boolean => {
  try {
    return localStorage.getItem(FOCO_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const StockEntryStagingView: React.FC<StockEntryStagingViewProps> = ({ onSelectLote }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [lotes, setLotes] = useState<StagingLote[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [termoBusca, setTermoBusca] = useState<string>('');

  // Modal de Cabeçalho / Dados da NF
  const [modalCabecalhoVisible, setModalCabecalhoVisible] = useState(false);
  const [dadosCabecalhoLote, setDadosCabecalhoLote] = useState<any>(null);
  const [loadingCabecalho, setLoadingCabecalho] = useState(false);

  // Modal de revisão (itens + pente-fino + aprovação)
  const [modalVisible, setModalVisible] = useState(false);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState<number | null>(null);
  const [itensLoteModal, setItensLoteModal] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [analise, setAnalise] = useState<AnalisePenteFino | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // Revisão item a item (modo foco): ids dos itens já revisados neste lote
  const [modoFoco, setModoFoco] = useState<boolean>(lerPreferenciaFoco);
  const [revisados, setRevisados] = useState<Set<number>>(new Set());

  const tenantId = 1;

  const loteSelecionado = useMemo(
    () => lotes.find(l => l.id === loteSelecionadoId) || null,
    [lotes, loteSelecionadoId]
  );

  const lotesFiltrados = useMemo(() => {
    let resultado = lotes;
    if (filtroStatus !== 'TODOS') {
      resultado = resultado.filter(l => l.status === filtroStatus);
    }
    if (termoBusca.trim() !== '') {
      const termo = termoBusca.toLowerCase();
      resultado = resultado.filter(l =>
        l.emitenteNome.toLowerCase().includes(termo) ||
        l.chaveAcesso.toLowerCase().includes(termo) ||
        String(l.numeroNf || '').includes(termo) ||
        String(l.id).includes(termo)
      );
    }
    return resultado;
  }, [filtroStatus, termoBusca, lotes]);

  const carregarItensDoLote = async (loteId: number) => {
    setLoadingItens(true);
    try {
      const response = await fetch(`${API_BASE}/lotes/${loteId}/itens?tenant_id=${tenantId}`);
      const data = await response.json();
      const itens = data.success ? data.itens || [] : [];
      setItensLoteModal(itens);
      return itens;
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      message.error('Erro ao carregar itens detalhados do lote.');
      return [];
    } finally {
      setLoadingItens(false);
    }
  };

  const carregarAnalise = async (loteId: number) => {
    setLoadingAnalise(true);
    try {
      const response = await fetch(`${API_BASE}/lotes/${loteId}/analise?tenant_id=${tenantId}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao analisar o lote.');
      setAnalise(data.analise);
    } catch (error: any) {
      console.error('Erro no pente-fino:', error);
      setAnalise(null);
      message.error(error.message || 'Erro ao executar o pente-fino do lote.');
    } finally {
      setLoadingAnalise(false);
    }
  };

  const abrirRevisao = async (loteId: number) => {
    if (loteId !== loteSelecionadoId) setRevisados(new Set());
    setLoteSelecionadoId(loteId);
    setAnalise(null);
    setModalVisible(true);
    await Promise.all([carregarItensDoLote(loteId), carregarAnalise(loteId)]);
  };

  const abrirModalCabecalho = async (loteId: number) => {
    setLoteSelecionadoId(loteId);
    setModalCabecalhoVisible(true);
    setLoadingCabecalho(true);
    try {
      const response = await fetch(`${API_BASE}/lotes/${loteId}?tenant_id=${tenantId}`);
      const data = await response.json();
      if (data.success) {
        setDadosCabecalhoLote(data.lote || {});
      } else {
        message.error(data.error || 'Erro ao carregar dados do cabeçalho do lote.');
      }
    } catch (error) {
      console.error('Erro ao buscar cabeçalho:', error);
      message.error('Erro de conexão ao buscar detalhes do lote.');
    } finally {
      setLoadingCabecalho(false);
    }
  };

  const fetchStagingLotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/lotes?tenant_id=${tenantId}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('O servidor retornou uma resposta inválida (HTML em vez de JSON). Verifique a rota no backend.');
      }

      const data = await response.json();

      if (response.ok && data.success) {
        setLotes((data.lotes || []).map((lote: any) => ({
          ...lote,
          chaveAcesso: lote.chaveAcesso || '',
          emitenteNome: lote.emitenteNome || 'Fornecedor não identificado',
          cnpjEmitente: lote.cnpjEmitente || '',
          status: lote.status || 'RASCUNHO',
          dataCriacao: lote.dataCriacao ? new Date(lote.dataCriacao).toLocaleString() : '-',
        })));
      } else {
        throw new Error(data.error || 'Erro ao carregar lotes.');
      }
    } catch (error: any) {
      console.error('Erro na requisição de lotes:', error);
      message.error(error.message || 'Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStagingLotes();
  }, []);

  const handleAprovarLote = async (id: number) => {
    setAprovando(true);
    try {
      const response = await fetch(`${API_BASE}/lotes/${id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        message.success(data.message || `Lote #${id} aprovado e integrado ao estoque.`);
        setModalVisible(false);
        fetchStagingLotes();
        return;
      }
      // 422: o pente-fino do servidor encontrou pendências (estado mudou desde a análise)
      if (data.analise) setAnalise(data.analise);
      throw new Error(data.error || 'Erro ao aprovar o lote.');
    } catch (error: any) {
      console.error('Erro ao aprovar lote:', error);
      message.error(error.message || 'Erro ao comunicar com o servidor para aprovação.');
    } finally {
      setAprovando(false);
    }
  };

  const handleDescartarLote = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/lotes/${id}?tenant_id=${tenantId}`, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok && data.success) {
        message.info(`Lote #${id} descartado.`);
        fetchStagingLotes();
      } else {
        throw new Error(data.error || 'Erro ao descartar o lote.');
      }
    } catch (error: any) {
      console.error('Erro ao descartar lote:', error);
      message.error(error.message || 'Erro ao comunicar com o servidor para descarte.');
    }
  };

  // Retoma a conferência na tela de entrada (ela recarrega o XML salvo e restaura o estado da staging)
  const handleReanalisar = async (id: number) => {
    if (onSelectLote) {
      const itens = await carregarItensDoLote(id);
      onSelectLote(id, itens);
      return;
    }
    navigate(`/compras/entrada-nfe?lote=${id}`);
  };

  const alternarModoFoco = (ativo: boolean) => {
    setModoFoco(ativo);
    try {
      localStorage.setItem(FOCO_STORAGE_KEY, String(ativo));
    } catch {
      // sem storage: a preferência vale só nesta sessão
    }
  };

  const marcarRevisado = (id: number, revisado: boolean) => {
    setRevisados(prev => {
      const next = new Set(prev);
      if (revisado) next.add(id); else next.delete(id);
      return next;
    });
  };

  const marcarTodosRevisados = () => setRevisados(new Set(itensLoteModal.map(i => i.id)));

  // Próximo item a revisar (o primeiro ainda não revisado)
  const itemAtualId = useMemo(
    () => itensLoteModal.find(i => !revisados.has(i.id))?.id ?? null,
    [itensLoteModal, revisados]
  );

  // Modo foco: itens já revisados + o item atual; os seguintes aparecem conforme a revisão avança
  const itensVisiveis = useMemo(() => {
    if (!modoFoco) return itensLoteModal;
    const indiceAtual = itensLoteModal.findIndex(i => i.id === itemAtualId);
    return indiceAtual === -1 ? itensLoteModal : itensLoteModal.slice(0, indiceAtual + 1);
  }, [modoFoco, itensLoteModal, itemAtualId]);

  const totalRevisados = itensLoteModal.filter(i => revisados.has(i.id)).length;
  const revisaoCompleta = itensLoteModal.length > 0 && totalRevisados === itensLoteModal.length;

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'RASCUNHO':
        return <Tag color="warning">Em conferência</Tag>;
      case 'PRONTO_PARA_APROVACAO':
        return <Tag color="processing">Pronto p/ Aprovação</Tag>;
      case 'IMPORTADO':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Importado</Tag>;
      case 'DESCARTADO':
        return <Tag color="default">Descartado</Tag>;
      case 'ERRO':
        return <Tag color="error">Erro de Staging</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const itemColumns = [
    {
      title: 'Item da NF (XML)',
      key: 'origem_nf',
      width: '28%',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <Tag color="default" style={{ fontSize: 10 }}>Seq #{record.item_nfe_seq || '-'}</Tag>
            <Text code style={{ fontSize: 11 }}>Cód: {record.codigo_fornecedor || '-'}</Text>
          </Space>
          <Text strong style={{ fontSize: 12 }}>{record.nome_fornecedor || 'Item sem descrição no XML'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>NCM: {record.ncm_original || '-'}</Text>
        </Space>
      )
    },
    {
      title: 'Conferência',
      key: 'conferencia',
      width: '16%',
      render: (_: any, record: any) => {
        const qtdNota = Number(record.quantidade || 0);
        const qtdRec = Number(record.quantidade_recebida || 0);
        const divergencia = Math.abs(qtdNota - qtdRec) > 0.0001;
        const conferido = Number(record.is_confirmed) === 1;
        return (
          <Space direction="vertical" size={2}>
            <Text style={{ fontSize: 11 }}>NF: {qtdNota} {record.unidade_original || ''}</Text>
            <Text type={divergencia ? 'danger' : 'success'} style={{ fontSize: 13, fontWeight: 'bold' }}>
              Rec.: {qtdRec} {record.unidade_original || ''}
            </Text>
            <Space size={4}>
              {conferido ? <Tag color="success" style={{ margin: 0 }}>Conferido</Tag> : <Tag color="warning" style={{ margin: 0 }}>Pendente</Tag>}
              {divergencia && <Tag color="error" style={{ margin: 0 }}>Divergente</Tag>}
            </Space>
          </Space>
        );
      }
    },
    {
      title: 'Destino no Sistema',
      key: 'destino_sistema',
      width: '26%',
      render: (_: any, record: any) => {
        const mapeamento = lerMapeamento(record);
        const tipo = getTipoRecursoConfig(mapeamento.tipo_recurso || 'PRODUTO');
        const vinculado = Boolean(record.produto_id_sistema);
        const novo = !vinculado && Boolean(String(record.sku_sugerido || '').trim());
        return (
          <Space direction="vertical" size={3}>
            {vinculado ? (
              <Tag color="success" style={{ margin: 0, fontSize: 11 }}>🔗 Vinculado · #{record.produto_id_sistema}</Tag>
            ) : novo ? (
              <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>✨ Novo item no catálogo</Tag>
            ) : (
              <Tag color="error" style={{ margin: 0, fontSize: 11 }}>Sem código interno</Tag>
            )}
            <Text strong style={{ fontSize: 12, color: '#0050b3' }}>
              {record.sku_sistema || record.sku_sugerido || '—'}
            </Text>
            {novo && record.nome_item_sugerido && (
              <Text type="secondary" style={{ fontSize: 11 }}>{record.nome_item_sugerido}</Text>
            )}
            <Space size={4} wrap>
              <Tag color={tipo.color} style={{ fontSize: 10, margin: 0 }}>{tipo.label}</Tag>
              {mapeamento.gtin_manual && <Tag style={{ fontSize: 10, margin: 0 }}>GTIN: {mapeamento.gtin_manual}</Tag>}
            </Space>
          </Space>
        );
      }
    },
    {
      title: 'Custos',
      key: 'financeiro',
      width: '18%',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0} style={{ fontSize: 11 }}>
          <Text type="secondary">Unit. NF: {formatCurrency(Number(record.preco_custo_unitario))}</Text>
          <Text type="secondary">Frete: {formatCurrency(Number(record.frete_rateado))}</Text>
          <Text strong style={{ fontSize: 12 }}>Unit. final: {formatCurrency(Number(record.custo_unitario_final))}</Text>
          <Text strong style={{ color: '#3f8600', fontSize: 12 }}>Total: {formatCurrency(Number(record.valor_total_nfe))}</Text>
        </Space>
      )
    },
    {
      title: 'Revisão',
      key: 'revisao',
      width: '12%',
      align: 'center' as const,
      render: (_: any, record: any) => {
        if (revisados.has(record.id)) {
          return (
            <Space direction="vertical" size={2} align="center">
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>Revisado</Tag>
              <Button type="link" size="small" icon={<UndoOutlined />} onClick={() => marcarRevisado(record.id, false)} style={{ padding: 0, fontSize: 11 }}>
                Desfazer
              </Button>
            </Space>
          );
        }
        const atual = record.id === itemAtualId;
        return (
          <Button
            type={atual ? 'primary' : 'default'}
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => marcarRevisado(record.id, true)}
          >
            {atual && modoFoco ? 'Confirmar e próximo' : 'Confirmar'}
          </Button>
        );
      }
    }
  ];

  const columns = [
    {
      title: 'Lote / NF',
      dataIndex: 'chaveAcesso',
      key: 'chaveAcesso',
      render: (text: string, record: StagingLote) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <Text strong style={{ color: '#1890ff' }}>Lote #{record.id}</Text>
            {record.numeroNf && <Tag style={{ margin: 0 }}>NF {record.numeroNf}</Tag>}
          </Space>
          <Button
            type="link"
            icon={<FileTextOutlined />}
            onClick={() => abrirModalCabecalho(record.id)}
            style={{ padding: 0, height: 'auto', fontSize: '12px' }}
          >
            Dados da NF (Cabeçalho)
          </Button>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {text ? `${text.substring(0, 20)}...${text.substring(text.length - 10)}` : '-'}
          </Text>
        </Space>
      )
    },
    {
      title: 'Fornecedor',
      dataIndex: 'emitenteNome',
      key: 'emitenteNome',
      render: (text: string, record: StagingLote) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text || 'Não identificado'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>CNPJ: {record.cnpjEmitente || '-'}</Text>
          {record.valorTotalNf > 0 && <Text style={{ fontSize: 11 }}>Total NF: {formatCurrency(record.valorTotalNf)}</Text>}
        </Space>
      )
    },
    {
      title: 'Itens',
      key: 'metricas',
      render: (_: any, record: StagingLote) => (
        <Space direction="vertical" size={4} align="start">
          <Button type="link" icon={<EyeOutlined />} onClick={() => abrirRevisao(record.id)} style={{ padding: 0 }}>
            <Badge count={record.totalItens} showZero style={{ backgroundColor: '#108ee9', marginRight: 4 }} />
            Ver Itens
          </Button>
          <Space size={4} wrap>
            <Tooltip title="Itens conferidos">
              <Tag color={record.totalConferidos === record.totalItens && record.totalItens > 0 ? 'success' : 'warning'} style={{ margin: 0 }}>
                {record.totalConferidos}/{record.totalItens} conferidos
              </Tag>
            </Tooltip>
            {record.totalSemVinculo > 0 && <Tag color="error" style={{ margin: 0 }}>{record.totalSemVinculo} sem vínculo</Tag>}
            {record.totalDivergencias > 0 && <Tag color="orange" style={{ margin: 0 }}>{record.totalDivergencias} divergente(s)</Tag>}
          </Space>
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: StagingLote) => (
        <Space direction="vertical" size={0}>
          {renderStatusTag(status)}
          {record.erroMensagem && (
            <Tooltip title={record.erroMensagem}>
              <Text type="danger" style={{ fontSize: 10, cursor: 'pointer' }}>Ver motivo do erro</Text>
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: 'Data Criação',
      dataIndex: 'dataCriacao',
      key: 'dataCriacao',
      render: (date: string) => <Text style={{ fontSize: 12 }}>{date}</Text>
    },
    {
      title: 'Ações Disponíveis',
      key: 'acoes',
      align: 'center' as const,
      render: (_: any, record: StagingLote) => {
        const finalizado = LOTE_FINALIZADO.includes(record.status);
        return (
          <Space size="small">
            <Tooltip title="Retomar a conferência na tela de entrada da NF">
              <Button
                type="primary"
                ghost
                size="small"
                icon={<ArrowRightOutlined />}
                disabled={finalizado}
                onClick={() => handleReanalisar(record.id)}
              >
                Reanalisar
              </Button>
            </Tooltip>

            <Tooltip title="Revisar o pente-fino e dar entrada oficial no estoque">
              <Button
                type="primary"
                size="small"
                icon={<SafetyCertificateOutlined />}
                disabled={finalizado}
                onClick={() => abrirRevisao(record.id)}
                style={finalizado ? undefined : { backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                Revisar e Aprovar
              </Button>
            </Tooltip>

            <Tooltip title="Descartar a NF (o histórico é mantido)">
              <Popconfirm
                title="Descartar lote"
                description="O lote fica marcado como DESCARTADO e não poderá mais ser aprovado."
                onConfirm={() => handleDescartarLote(record.id)}
                okText="Sim, descartar"
                cancelText="Cancelar"
                okButtonProps={{ danger: true }}
                disabled={finalizado}
              >
                <Button danger size="small" icon={<DeleteOutlined />} disabled={finalizado}>
                  Descartar
                </Button>
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  const renderPenteFino = () => {
    if (loadingAnalise) {
      return <div style={{ textAlign: 'center', padding: 16 }}><Spin tip="Executando pente-fino..." /></div>;
    }
    if (!analise) return null;

    const { resumo } = analise;
    return (
      <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 12 }}>
        <Alert
          type={analise.aprovavel ? 'success' : 'error'}
          showIcon
          message={analise.aprovavel ? 'Pente-fino aprovado: lote pronto para entrada no estoque' : 'Pente-fino com bloqueios: resolva antes de aprovar'}
          description={
            <Space size={16} wrap style={{ fontSize: 12 }}>
              <span>{resumo.conferidos}/{resumo.totalItens} conferidos</span>
              <span>{resumo.vinculados} vinculado(s)</span>
              <span>{resumo.novos} novo(s) no catálogo</span>
              <span>Itens: {formatCurrency(resumo.valorItens)}</span>
              <span>NF + frete adicional: {formatCurrency(resumo.valorNota)}</span>
            </Space>
          }
        />
        {analise.bloqueios.map(b => (
          <Alert
            key={b.codigo}
            type="error"
            showIcon
            message={b.mensagem}
            description={b.itens?.length ? `Itens da NF: ${b.itens.join(', ')}` : undefined}
          />
        ))}
        {analise.avisos.map(a => (
          <Alert
            key={a.codigo}
            type="warning"
            showIcon
            message={a.mensagem}
            description={a.itens?.length ? `Itens da NF: ${a.itens.join(', ')}` : undefined}
          />
        ))}
      </Space>
    );
  };

  const loteFinalizado = loteSelecionado ? LOTE_FINALIZADO.includes(loteSelecionado.status) : false;

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Card style={{ marginBottom: 24, borderRadius: 8 }} variant="borderless">
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="middle">
              <CloudServerOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>Gerenciamento de Lotes em Staging</Title>
                <Text type="secondary">
                  Revise o pente-fino das notas conferidas e dê a entrada definitiva no estoque.
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<ReloadOutlined />} onClick={fetchStagingLotes} loading={loading}>
              Atualizar Dados
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="Em conferência"
              value={lotes.filter(l => l.status === 'RASCUNHO').length}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="Prontos para Aprovação"
              value={lotes.filter(l => l.status === 'PRONTO_PARA_APROVACAO').length}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic
              title="Importados"
              value={lotes.filter(l => l.status === 'IMPORTADO').length}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8} style={{ marginBottom: 8 }}>
            <Search
              placeholder="Buscar por fornecedor, NF, ID ou chave..."
              allowClear
              onChange={(e) => setTermoBusca(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              value={filtroStatus}
              onChange={(val) => setFiltroStatus(val)}
              style={{ width: '100%' }}
              options={[
                { value: 'TODOS', label: 'Todos os Status' },
                { value: 'RASCUNHO', label: 'Em conferência' },
                { value: 'PRONTO_PARA_APROVACAO', label: 'Pronto para Aprovação' },
                { value: 'IMPORTADO', label: 'Importado' },
                { value: 'DESCARTADO', label: 'Descartado' }
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card variant="borderless" style={{ borderRadius: 8 }}>
        <Table
          dataSource={lotesFiltrados}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>

      {/* Revisão do lote: pente-fino + itens + aprovação */}
      <Modal
        title={`Revisão do Lote #${loteSelecionadoId || ''}${loteSelecionado?.numeroNf ? ` · NF ${loteSelecionado.numeroNf}` : ''}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={1200}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            Fechar
          </Button>,
          <Button key="reanalisar" icon={<ReloadOutlined />} onClick={() => loteSelecionadoId && abrirRevisao(loteSelecionadoId)}>
            Refazer pente-fino
          </Button>,
          !loteFinalizado && (
            <Popconfirm
              key="aprovar"
              title="Dar entrada no estoque"
              description={revisaoCompleta
                ? 'Os itens entram no estoque e o lote fica IMPORTADO. Esta ação não pode ser desfeita pela tela.'
                : `Você revisou ${totalRevisados} de ${itensLoteModal.length} itens. Aprovar mesmo assim? Os itens entram no estoque e o lote fica IMPORTADO.`}
              onConfirm={() => loteSelecionadoId && handleAprovarLote(loteSelecionadoId)}
              okText="Aprovar"
              cancelText="Cancelar"
              disabled={!analise?.aprovavel}
            >
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={aprovando}
                disabled={!analise?.aprovavel}
                style={analise?.aprovavel ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : undefined}
              >
                Aprovar e Dar Entrada
              </Button>
            </Popconfirm>
          )
        ]}
      >
        {renderPenteFino()}
        <Divider style={{ margin: '12px 0' }} />
        <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
          <Col>
            <Space size={8}>
              <Switch checked={modoFoco} onChange={alternarModoFoco} size="small" />
              <Text strong><AimOutlined /> Modo foco</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {modoFoco ? 'Um item por vez: confirme para liberar o próximo.' : 'Todos os itens visíveis.'}
              </Text>
            </Space>
          </Col>
          <Col>
            <Space size={12}>
              <Progress
                percent={itensLoteModal.length ? Math.round((totalRevisados / itensLoteModal.length) * 100) : 0}
                size="small"
                style={{ width: 160, margin: 0 }}
                format={() => `${totalRevisados}/${itensLoteModal.length}`}
              />
              {!modoFoco && !revisaoCompleta && (
                <Button size="small" onClick={marcarTodosRevisados}>Marcar todos como revisados</Button>
              )}
            </Space>
          </Col>
        </Row>
        <Table
          dataSource={itensVisiveis}
          columns={itemColumns}
          rowKey="id"
          loading={loadingItens}
          pagination={modoFoco ? false : { pageSize: 6 }}
          scroll={modoFoco ? { y: 420 } : undefined}
          size="small"
          onRow={(record: any) => ({
            style: record.id === itemAtualId ? { background: '#e6f4ff' } : undefined
          })}
        />
        {modoFoco && revisaoCompleta && (
          <Alert type="success" showIcon style={{ marginTop: 8 }} message="Todos os itens foram revisados." />
        )}
      </Modal>

      {/* Cabeçalho e dados da NF */}
      <Modal
        title={`Cabeçalho e Informações da NF - Lote #${loteSelecionadoId || ''}`}
        open={modalCabecalhoVisible}
        onCancel={() => setModalCabecalhoVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setModalCabecalhoVisible(false)}>
            Fechar
          </Button>
        ]}
        width={700}
      >
        {loadingCabecalho ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">Carregando informações fiscais do lote...</Text>
          </div>
        ) : dadosCabecalhoLote ? (
          <div style={{ padding: '8px 0' }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">Número da NF:</Text>
                <div><Text strong>{dadosCabecalhoLote.numero_nf || '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Série:</Text>
                <div><Text strong>{dadosCabecalhoLote.serie || dadosCabecalhoLote.dados_nota_fiscal?.serie || '-'}</Text></div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Chave de Acesso:</Text>
                <div><Text code>{dadosCabecalhoLote.chave_acesso || '-'}</Text></div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Fornecedor (Emitente):</Text>
                <div><Text strong>{dadosCabecalhoLote.emitente_nome || dadosCabecalhoLote.razao_social_fornecedor || '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">CNPJ do Fornecedor:</Text>
                <div><Text>{dadosCabecalhoLote.cnpj_fornecedor || '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Data de Emissão:</Text>
                <div>
                  <Text>
                    {dadosCabecalhoLote.data_emissao || dadosCabecalhoLote.dados_nota_fiscal?.dataEmissao
                      ? new Date(dadosCabecalhoLote.data_emissao || dadosCabecalhoLote.dados_nota_fiscal.dataEmissao).toLocaleString()
                      : '-'}
                  </Text>
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Valor Total da NF:</Text>
                <div>
                  <Text strong style={{ color: '#3f8600', fontSize: 15 }}>
                    {formatCurrency(Number(dadosCabecalhoLote.valor_total_nf_xml || dadosCabecalhoLote.valor_total_nf || 0))}
                  </Text>
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Frete Adicional:</Text>
                <div><Text>{formatCurrency(Number(dadosCabecalhoLote.frete_adicional_valor || 0))} ({dadosCabecalhoLote.frete_adicional_metodo || 'N/D'})</Text></div>
              </Col>
            </Row>

            {dadosCabecalhoLote.dados_nota_fiscal && (
              <>
                <Divider style={{ margin: '16px 0 12px 0' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>Metadados Fiscais Adicionais (JSON):</Text>
                <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 150, overflow: 'auto', fontSize: 11, marginTop: 4 }}>
                  {JSON.stringify(dadosCabecalhoLote.dados_nota_fiscal, null, 2)}
                </pre>
              </>
            )}
          </div>
        ) : (
          <Text type="danger">Nenhum dado encontrado para este lote.</Text>
        )}
      </Modal>
    </div>
  );
};
