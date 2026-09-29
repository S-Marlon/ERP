import React, { useState, useEffect } from 'react';
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
  Select
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
  FileTextOutlined 
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Search } = Input;

interface StagingLote {
  id: number;
  chaveAcesso: string;
  emitenteNome: string;
  cnpjEmitente: string;
  totalItens: number;
  totalDivergencias: number;
  status: 'RASCUNHO' | 'PROCESSANDO' | 'ERRO' | 'PRONTO_PARA_APROVACAO';
  dataCriacao: string;
  erroMensagem?: string | null;
}

interface StockEntryStagingViewProps {
  onSelectLote?: (loteId: number, itens: any[]) => void;
}

export const StockEntryStagingView: React.FC<StockEntryStagingViewProps> = ({ onSelectLote }) => {
  const [loading, setLoading] = useState(false);
  const [lotes, setLotes] = useState<StagingLote[]>([]);
  const [lotesFiltrados, setLotesFiltrados] = useState<StagingLote[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [termoBusca, setTermoBusca] = useState<string>('');

  // Estados para o Modal de Cabeçalho / Dados da NF
  const [modalCabecalhoVisible, setModalCabecalhoVisible] = useState(false);
  const [dadosCabecalhoLote, setDadosCabecalhoLote] = useState<any>(null);
  const [loadingCabecalho, setLoadingCabecalho] = useState(false);

  // Estados para controle do Modal de visualização dos itens
  const [modalVisible, setModalVisible] = useState(false);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState<number | null>(null);
  const [itensLoteModal, setItensLoteModal] = useState<any[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const tenantId = 1;

  const carregarItensDoLote = async (loteId: number) => {
    setLoadingItens(true);
    try {
      const response = await fetch(`http://localhost:3001/api/compras/lotes/${loteId}/itens?tenant_id=${tenantId}`);
      const data = await response.json();

      if (data.success) {
        setItensLoteModal(data.itens || []);
        return data.itens || [];
      }
      return [];
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
      message.error("Erro ao carregar itens detalhados do lote.");
      return [];
    } finally {
      setLoadingItens(false);
    }
  };

  const abrirModalItens = async (loteId: number) => {
    setLoteSelecionadoId(loteId);
    setModalVisible(true);
    await carregarItensDoLote(loteId);
  };

  const abrirModalCabecalho = async (loteId: number) => {
    setLoteSelecionadoId(loteId);
    setModalCabecalhoVisible(true);
    setLoadingCabecalho(true);
    try {
      const response = await fetch(`http://localhost:3001/api/compras/lotes/#${loteId}?tenant_id=${tenantId}`);
      const data = await response.json();
      if (data.success) {
        setDadosCabecalhoLote(data.lote || {});
      } else {
        message.error("Erro ao carregar dados do cabeçalho do lote.");
      }
    } catch (error) {
      console.error("Erro ao buscar cabeçalho:", error);
      message.error("Erro de conexão ao buscar detalhes do lote.");
    } finally {
      setLoadingCabecalho(false);
    }
  };

  const fetchStagingLotes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/compras/lotes?tenant_id=${tenantId}`);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error("O servidor retornou uma resposta inválida (HTML em vez de JSON). Verifique a rota no backend.");
      }

      const data = await response.json();

      if (response.ok && data.success) {
        const formattedLotes = (data.lotes || []).map((lote: any) => ({
          id: lote.id,
          chaveAcesso: lote.chaveAcesso || '',
          emitenteNome: lote.emitenteNome || 'Fornecedor não identificado',
          cnpjEmitente: lote.cnpjEmitente || '',
          totalItens: lote.totalItens || 0,
          totalDivergencias: lote.totalDivergencias || 0,
          status: lote.status || 'RASCUNHO',
          dataCriacao: lote.dataCriacao ? new Date(lote.dataCriacao).toLocaleString() : '-',
          erroMensagem: lote.erroMensagem || null
        }));
        setLotes(formattedLotes);
        setLotesFiltrados(formattedLotes);
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

  // Filtragem de Lotes
  useEffect(() => {
    let resultado = lotes;
    if (filtroStatus !== 'TODOS') {
      resultado = resultado.filter(l => l.status === filtroStatus);
    }
    if (termoBusca.trim() !== '') {
      const termo = termoBusca.toLowerCase();
      resultado = resultado.filter(l => 
        l.emitenteNome.toLowerCase().includes(termo) || 
        l.chaveAcesso.toLowerCase().includes(termo) ||
        String(l.id).includes(termo)
      );
    }
    setLotesFiltrados(resultado);
  }, [filtroStatus, termoBusca, lotes]);

  const handleAprovarLote = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/compras/lotes/${id}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success(`Lote #${id} aprovado e integrado ao estoque oficial com sucesso!`);
        fetchStagingLotes();
      } else {
        throw new Error(data.error || 'Erro ao aprovar o lote.');
      }
    } catch (error: any) {
      console.error('Erro ao aprovar lote:', error);
      message.error(error.message || 'Erro ao comunicar com o servidor para aprovação.');
    }
  };

  const handleDeclinarLote = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/compras/lotes/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLotes(prev => prev.filter(l => l.id !== id));
        message.info(`Lote #${id} declinado e descartado com sucesso.`);
      } else {
        throw new Error(data.error || 'Erro ao descartar o lote.');
      }
    } catch (error: any) {
      console.error('Erro ao descartar lote:', error);
      message.error(error.message || 'Erro ao comunicar com o servidor para exclusão.');
    }
  };

  const handleReanalisar = async (id: number) => {
    message.loading({ content: `Carregando dados do Lote #${id}...`, key: 'reanalise' });
    const itens = await carregarItensDoLote(id);
    message.success({ content: `Redirecionando para reanálise do Lote #${id}...`, key: 'reanalise', duration: 2 });

    if (onSelectLote) {
      onSelectLote(id, itens);
    }
  };

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'RASCUNHO':
        return <Tag color="warning">Rascunho</Tag>;
      case 'PRONTO_PARA_APROVACAO':
        return <Tag color="success">Pronto p/ Aprovação</Tag>;
      case 'ERRO':
        return <Tag color="error">Erro de Staging</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const itemColumns = [
    {
      title: '1. Dados Originais da NF (XML)',
      key: 'origem_nf',
      width: '25%',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <Tag color="default" style={{ fontSize: 10 }}>Seq #{record.item_nfe_seq || '1'}</Tag>
            <Text code style={{ fontSize: 11 }}>Cód: {record.codigo_fornecedor || '-'}</Text>
          </Space>
          <Text strong style={{ fontSize: 12 }}>{record.nome_fornecedor || 'Item sem descrição no XML'}</Text>
          
        </Space>
      )
    }, {
      title: '1. Dados  (XML)',
      key: 'origem_nf',
      width: '17%',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2}>
          
          <Space size={8} style={{ fontSize: 11 }} orientation='vertical'>
            <Text type="secondary">NCM: {record.ncm_original || '-'}</Text>
            <Text type="secondary">Qtd NF: <b>{record.quantidade || 0} {record.unidade_original || ''}</b></Text>
          </Space>
        </Space>
      )
    },
    {
      title: '2. Conferência Física',
      key: 'conferencia',
      width: '15%',
      render: (_: any, record: any) => {
        const qtdNota = Number(record.quantidade || 0);
        const qtdRec = Number(record.quantidade_recebida || qtdNota);
        const divergencia = qtdNota !== qtdRec;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 11 }}>Recebido:</Text>
            <Text type={divergencia ? 'danger' : 'success'} style={{ fontSize: 13, fontWeight: 'bold' }}>
              {qtdRec} {record.unidade_original || ''}
            </Text>
            {divergencia && <Tag color="error" style={{ fontSize: 9, marginTop: 2 }}>Divergente</Tag>}
          </Space>
        );
      }
    },
    {
      title: '3. Destino no Sistema (ERP)',
      key: 'destino_sistema',
      width: '10%',
      render: (_: any, record: any) => {
        const hasVinculo = Boolean(record.produto_id_sistema || record.sku_sistema);
        return (
          <Space direction="vertical" size={3}>
            {hasVinculo ? (
              <>
                <Tag color="success" style={{ margin: 0, fontSize: 11 }}>
                  🔗 Produto Vinculado (ID #{record.produto_id_sistema})
                </Tag>
                
              </>
            ) : (
              <>
                <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
                  ✨ Criação de Novo Produto
                </Tag>
             
              </>
            )}
            
            <Space size={4} wrap style={{ marginTop: 2 }}>
              {record.familia && <Tag style={{ fontSize: 9, margin: 0 }}>Família: {record.familia}</Tag>}
              <Tag color="cyan" style={{ fontSize: 9, margin: 0 }}>Tipo: {record.tipo_entrada || 'COMPRA_NORMAL'}</Tag>
            </Space>
          </Space>
        );
      }
    },
    {
      title: '3. Destino no Sistema (ERP)',
      key: 'destino_sistema',
      width: '12%',
      render: (_: any, record: any) => {
        const hasVinculo = Boolean(record.produto_id_sistema || record.sku_sistema);
        return (
          <Space direction="vertical" size={3}>
            {hasVinculo ? (
              <>
              
                <Text strong style={{ fontSize: 12, color: '#0050b3' }}>
                  SKU: {record.sku_sistema || 'N/D'}
                </Text>
              </>
            ) : (
              <>
                
                <Text type="secondary" style={{ fontSize: 11 }}>
                  SKU Sugerido: {record.sku_sugerido || record.codigo_fornecedor || 'Gerado auto'}
                </Text>
              </>
            )}
            
            
          </Space>
        );
      }
    }, 
    {
      title: '4. Custos Finais',
      key: 'financeiro',
      width: '22%',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0} style={{ fontSize: 11 }}>
          <Text type="secondary">Unit: R$ {Number(record.preco_custo_unitario || 0).toFixed(2)}</Text>
          <Text type="secondary">Frete/Imp: R$ {(Number(record.frete_rateado || 0) + Number(record.ipi || 0) + Number(record.icms_st || 0)).toFixed(2)}</Text>
          <Text strong style={{ color: '#3f8600', fontSize: 12, marginTop: 2 }}>
            Total: R$ {Number(record.custo_total_final || 0).toFixed(2)}
          </Text>
        </Space>
      )
    },
     {
      title: '',
      key: 'financeiro',
      width: '10%',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0} style={{ fontSize: 11 }}>
          <Button> Aprovar
            </Button>
        </Space>
      )
    }
  ];

  const columns = [
    {
      title: 'ID / Chave',
      dataIndex: 'chaveAcesso',
      key: 'chaveAcesso',
      render: (text: string, record: StagingLote) => (
        <Space direction="vertical" size={0}>
          <div>


          <Text strong style={{ color: '#1890ff' }}>Lote #{record.id}</Text>
           <Button 
            type="link" 
            icon={<FileTextOutlined />} 
            onClick={() => abrirModalCabecalho(record.id)}
            style={{ padding: 0, height: 'auto', fontSize: '12px' }}
          >
            Dados da NF (Cabeçalho)
          </Button>
          </div>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {text ? `${text.substring(0, 20)}...${text.substring(text.length - 10)}` : '-'}
          </Text>
           {/* Botão integrado para abrir o cabeçalho */}
         
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
          <Text type="secondary" style={{ fontSize: 11 }}>CNPJ: {record.cnpjEmitente}</Text>
        </Space>
      )
    },
    {
      title: 'Métricas / Itens',
      key: 'metricas',
      render: (_: any, record: StagingLote) => (
        <Space direction="vertical" size={4} align="start">
          <Space size="middle">
            <Tooltip title="Clique para ver os itens detalhados">
              <Button 
                type="link" 
                icon={<EyeOutlined />} 
                onClick={() => abrirModalItens(record.id)}
                style={{ padding: 0 }}
              >
                <Badge count={record.totalItens} style={{ backgroundColor: '#108ee9', marginRight: 4 }} />
                Ver Itens
              </Button>
            </Tooltip>
            <Tooltip title="Divergências encontradas">
              <Badge count={record.totalDivergencias} style={{ backgroundColor: record.totalDivergencias > 0 ? '#ff4d4f' : '#52c41a' }} />
            </Tooltip>
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
      render: (_: any, record: StagingLote) => (
        <Space size="small">
          <Tooltip title="Retomar / Reanalisar na tela de conferência">
            <Button 
              type="primary" 
              ghost 
              size="small" 
              icon={<ArrowRightOutlined />}
              onClick={() => handleReanalisar(record.id)}
            >
              Reanalisar
            </Button>
          </Tooltip>

          <Tooltip title="Aprovar e dar entrada oficial">
            <Popconfirm
              title="Aprovar Lote"
              description="Tem certeza que deseja aprovar este lote e efetivar a entrada no estoque?"
              onConfirm={() => handleAprovarLote(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button 
                type="primary" 
                size="small" 
                icon={<CheckCircleOutlined />}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                Aprovar
              </Button>
            </Popconfirm>
          </Tooltip>

          <Tooltip title="Declinar / Descartar rascunho">
            <Popconfirm
              title="Descartar Staging"
              description="Atenção: Todos os dados salvos deste rascunho serão apagados permanentemente."
              onConfirm={() => handleDeclinarLote(record.id)}
              okText="Sim, excluir"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
            >
              <Button 
                danger 
                size="small" 
                icon={<DeleteOutlined />}
              >
                Declinar
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

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
                  Visualize, reanalise, aprove ou descarte notas fiscais em rascunho e tabelas de staging.
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={fetchStagingLotes} 
              loading={loading}
            >
              Atualizar Dados
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card variant="borderless" style={{ borderRadius: 8 }}>
            <Statistic 
              title="Total de Lotes em Staging" 
              value={lotes.length} 
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
              title="Com Erro / Divergências" 
              value={lotes.filter(l => l.status === 'ERRO' || l.totalDivergencias > 0).length} 
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 8, marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8} style={{ marginBottom: 8 }}>
            <Search 
              placeholder="Buscar por fornecedor, ID ou chave..." 
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
                { value: 'RASCUNHO', label: 'Rascunho' },
                { value: 'PRONTO_PARA_APROVACAO', label: 'Pronto para Aprovação' },
                { value: 'ERRO', label: 'Com Erro' }
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

      {/* Modal para Visualizar os Itens do Lote */}
      <Modal
        title={`Itens do Lote de Importação #${loteSelecionadoId || ''}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setModalVisible(false)}>
            Fechar
          </Button>
        ]}
        width={1200}
      >
        <Divider style={{ margin: '12px 0' }} />
        <Table
          dataSource={itensLoteModal}
          columns={itemColumns}
          rowKey="id"
          loading={loadingItens}
          pagination={{ pageSize: 6 }}
          size="small"
        />
      </Modal>

      {/* Modal para Visualizar o Cabeçalho e Dados da NF */}
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
                <div><Text strong>{dadosCabecalhoLote.numero_nf || dadosCabecalhoLote.numeroNF || '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Série:</Text>
                <div><Text strong>{dadosCabecalhoLote.serie || '-'}</Text></div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Chave de Acesso:</Text>
                <div><Text code>{dadosCabecalhoLote.chave_acesso || dadosCabecalhoLote.chaveAcesso || '-'}</Text></div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Fornecedor (Emitente):</Text>
                <div><Text strong>{dadosCabecalhoLote.razao_social_fornecedor || dadosCabecalhoLote.emitenteNome || '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">CNPJ do Fornecedor:</Text>
                <div><Text>{dadosCabecalhoLote.cnpj_fornecedor || dadosCabecalhoLote.cnpjEmitente || '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Data de Emissão:</Text>
                <div><Text>{dadosCabecalhoLote.data_emissao ? new Date(dadosCabecalhoLote.data_emissao).toLocaleString() : '-'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Valor Total da NF:</Text>
                <div><Text strong style={{ color: '#3f8600', fontSize: 15 }}>R$ {Number(dadosCabecalhoLote.valor_total_nf || 0).toFixed(2)}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Frete Adicional:</Text>
                <div><Text>R$ {Number(dadosCabecalhoLote.frete_adicional_valor || 0).toFixed(2)} ({dadosCabecalhoLote.frete_adicional_metodo || 'N/D'})</Text></div>
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