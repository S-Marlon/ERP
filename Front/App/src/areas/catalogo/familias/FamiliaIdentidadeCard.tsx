import React, { useState, useEffect } from 'react';
import { Alert, Card, Flex, Space, Button, Tooltip, Typography, Tag, Modal, Form, Input, Select, Tabs, TreeSelect, message } from 'antd';
import type { TreeSelectProps } from 'antd';
import { CheckCircleOutlined, EditOutlined, DollarOutlined, FileTextOutlined, InfoCircleOutlined, InboxOutlined, PictureOutlined, ReadOutlined, ShopOutlined, ShareAltOutlined } from '@ant-design/icons';
import ImageDisplay from '../../../shared/components/ui/ImageGallery/ImageDysplay';
import { STATUS_FAMILIA_CONFIG } from './CatalogManager.types';

const { Text, Title } = Typography;

interface FamiliaIdentidadeCardProps {
  grupoSelecionado?: {
    id?: string | number;
    nome?: string;
    siglaSku?: string;
    descricao?: string;
    status?: string;
    tipoItem?: string;
    ncmPadrao?: string;
    cestPadrao?: string;
    unidadeBase?: string;
    cor?: string;
    imagem?: string;
    idMarca?: string | number;
    nomeMarca?: string;
    margemMinima?: number | string;
    margemMaxima?: number | string;
    markupPadrao?: number | string;
    estoqueMinimo?: number | string;
    loteMinimo?: number | string;
    curvaAbc?: string;
    comportamentoMarca?: string;
    prioridadeExposicao?: string;
    unidadeMedidaBase?: string;
    atributos?: Array<{ nome: string; classificacao?: string; valorPadraoFamilia?: string; valorPadraoGrupo?: string; origem?: string }>;
    categoriaPai?: string | number;
    categoriaPaiNome?: string;
    marcaComportamento?: string;
    saude?: { bloqueios: Array<{ codigo: string; mensagem: string }>; avisos: Array<{ codigo: string; mensagem: string }> };
  };
  grupoImage?: string;
  brandColor?: string;
  onSalvarIdentidade?: (valores: any) => void; 
  // Categoria da família (os itens herdam os atributos dela e das categorias acima)
  arvoreCategorias?: TreeSelectProps["treeData"];
  onMudarCategoria?: (idCategoria: string | undefined) => void;
  // Cabeçalho da família (a tela de famílias usa este card como cabeçalho)
  /** Ações à direita (Excluir, Desfazer, Salvar) */
  acoes?: React.ReactNode;
  /** Papel da marca + marca da família (controles da tela) */
  marca?: React.ReactNode;
  qtdItens?: number;
  temAlteracoes?: boolean;
  onAbrirGuia?: () => void;
}

export const FamiliaIdentidadeCard: React.FC<FamiliaIdentidadeCardProps> = ({
  grupoSelecionado,
  grupoImage,
  brandColor,
  onSalvarIdentidade,
  arvoreCategorias,
  onMudarCategoria,
  acoes,
  marca,
  qtdItens,
  temAlteracoes,
  onAbrirGuia,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [form] = Form.useForm();

  useEffect(() => {
    if (grupoSelecionado && isModalOpen) {
      form.setFieldsValue({
        nome: grupoSelecionado.nome,
        status: grupoSelecionado.status,
        unidadeBase: grupoSelecionado.unidadeMedidaBase ?? grupoSelecionado.unidadeBase,
        tipoItem: grupoSelecionado.tipoItem,
        ncmPadrao: grupoSelecionado.ncmPadrao,
        cestPadrao: grupoSelecionado.cestPadrao,
        imagem: grupoSelecionado.imagem || grupoImage,
        cor: grupoSelecionado.cor || brandColor,
        idMarca: grupoSelecionado.idMarca,
        margemMinima: grupoSelecionado.margemMinima,
        margemMaxima: grupoSelecionado.margemMaxima,
        markupPadrao: grupoSelecionado.markupPadrao,
        estoqueMinimo: grupoSelecionado.estoqueMinimo,
        loteMinimo: grupoSelecionado.loteMinimo,
        curvaAbc: grupoSelecionado.curvaAbc,
        comportamentoMarca: grupoSelecionado.comportamentoMarca,
        prioridadeExposicao: grupoSelecionado.prioridadeExposicao,
      });
    }
  }, [grupoSelecionado, grupoImage, brandColor, form, isModalOpen]);

  const handleAbrirModalLocal = () => {
    setActiveTab('1');
    setIsModalOpen(true);
  };

  const handleFecharModal = () => {
    setIsModalOpen(false);
  };

  const handleSalvar = async () => {
    try {
      const values = await form.validateFields();
      if (onSalvarIdentidade) {
        onSalvarIdentidade({
          id: grupoSelecionado?.id,
          ...values,
          // A família guarda a unidade em 'unidadeMedidaBase'
          unidadeMedidaBase: values.unidadeBase,
        });
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('DETALHE DO ERRO DE VALIDAÇÃO:', error);
      const errorFields = error?.errorFields;
      if (errorFields && errorFields.length > 0) {
        const primeiroCampoComErro = errorFields[0].name[0];
        if (['nome', 'status', 'imagem', 'unidadeBase', 'tipoItem'].includes(primeiroCampoComErro)) {
          setActiveTab('1');
        } else if (['comportamentoMarca', 'prioridadeExposicao'].includes(primeiroCampoComErro)) {
          setActiveTab('2');
        } else if (['ncmPadrao', 'cestPadrao'].includes(primeiroCampoComErro)) {
          setActiveTab('3');
        } else if (['margemMinima', 'margemMaxima', 'markupPadrao'].includes(primeiroCampoComErro)) {
          setActiveTab('4');
        } else if (['estoqueMinimo', 'loteMinimo', 'curvaAbc'].includes(primeiroCampoComErro)) {
          setActiveTab('5');
        }
      }
      message.error('Por favor, verifique os campos obrigatórios nas abas.');
    }
  };

  const accentColor = grupoSelecionado?.cor || brandColor || "#1677ff";
  const status = (grupoSelecionado?.status || 'RASCUNHO') as keyof typeof STATUS_FAMILIA_CONFIG;
  const cfg = STATUS_FAMILIA_CONFIG[status] || STATUS_FAMILIA_CONFIG.RASCUNHO;
  const bloqueios = grupoSelecionado?.saude?.bloqueios || [];
  const avisos = grupoSelecionado?.saude?.avisos || [];
  const herdados = (grupoSelecionado?.atributos || []).filter(a => a.origem === 'herdados').length;
  const categoria = grupoSelecionado?.categoriaPai ? String(grupoSelecionado.categoriaPai) : undefined;
  // DNA = atributos de papel DNA com o valor fixo da família (ex.: Material: NBR)
  const dna = (grupoSelecionado?.atributos || []).filter(a => a.classificacao === 'dna');
  const g = grupoSelecionado;
  const dados: Array<[string, React.ReactNode]> = [
    ['Unidade', g?.unidadeMedidaBase || g?.unidadeBase || '—'],
    ['SPED', g?.tipoItem || '—'],
    ['NCM', g?.ncmPadrao ? <Text code style={{ fontSize: 12 }}>{g.ncmPadrao}</Text> : '—'],
    ['Margem', g?.margemMinima || g?.margemMaxima ? `${g?.margemMinima || '–'}% a ${g?.margemMaxima || '–'}%` : '—'],
    ['Markup', g?.markupPadrao ? `${g.markupPadrao}x` : '—'],
    ['Estoque mín.', g?.estoqueMinimo || '—'],
    ['Curva', g?.curvaAbc || '—'],
  ];

  return (
    <>
      <Card size="small" style={{ borderLeft: `4px solid ${bloqueios.length ? '#cf1322' : accentColor}` }} styles={{ body: { padding: 12 } }}>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {/* Nome, situação e ações */}
          <Flex justify="space-between" align="flex-start" wrap gap={12}>
            <Flex gap={12} align="center" style={{ minWidth: 0 }}>
              <ImageDisplay size="48px" rounded="8px" src={g?.imagem || grupoImage || undefined} />
              <Space direction="vertical" size={2} style={{ minWidth: 0 }}>
                <Space size={8} wrap>
                  <Title level={4} style={{ margin: 0 }}>{g?.nome || 'Família sem nome'}</Title>
                  <Tooltip title={bloqueios.length ? bloqueios.map(b => b.mensagem).join(' · ') : status === 'ATIVO' ? 'Itens com os obrigatórios preenchidos vão para o PDV e os canais.' : 'Itens desta família só publicam quando ela estiver ativa.'}>
                    <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag>
                  </Tooltip>
                  {temAlteracoes && <Tag color="warning" icon={<InfoCircleOutlined />} style={{ margin: 0 }}>Alterações não salvas</Tag>}
                </Space>
                <Space size={8} wrap>
                  <Text type="secondary">{qtdItens ?? 0} item(ns)</Text>
                  {g?.siglaSku && <Text type="secondary">· sigla <Text code>{g.siglaSku}</Text></Text>}
                  {dna.length > 0 && (
                    <Text type="secondary">· DNA: {dna.map(a => `${a.nome} ${a.valorPadraoFamilia || a.valorPadraoGrupo || '(sem valor)'}`).join(' · ')}</Text>
                  )}
                </Space>
              </Space>
            </Flex>
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={handleAbrirModalLocal}>Editar dados</Button>
              {acoes}
            </Space>
          </Flex>

          {/* Categoria (os itens herdam os atributos dela) e marca */}
          <Flex gap={16} wrap align="center">
            <Space size={6} wrap>
              <Tooltip title="Os itens da família herdam os atributos desta categoria e das categorias acima dela">
                <Text style={{ color: categoria ? '#389e0d' : '#d48806', fontSize: 12 }}><ShareAltOutlined /> Categoria{categoria ? ` · herda ${herdados} atributo(s)` : ' · não herda atributos'}</Text>
              </Tooltip>
              <TreeSelect
                size="small"
                style={{ width: 260 }}
                value={categoria}
                treeData={arvoreCategorias || []}
                placeholder="Escolher categoria..."
                allowClear
                showSearch
                treeNodeFilterProp="title"
                treeDefaultExpandAll
                disabled={!onMudarCategoria}
                status={categoria ? undefined : 'warning'}
                onChange={(v) => onMudarCategoria?.(v ? String(v) : undefined)}
              />
            </Space>
            {marca}
          </Flex>

          {/* Dados da família (editados em "Editar dados") */}
          <Flex gap={4} wrap style={{ padding: '6px 10px', borderRadius: 6, background: '#f8fafc' }}>
            {dados.map(([rotulo, valor], i) => (
              <span key={rotulo} style={{ fontSize: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{rotulo}</Text> <Text strong style={{ fontSize: 12 }}>{valor}</Text>
                {i < dados.length - 1 && <Text type="secondary" style={{ margin: '0 6px' }}>·</Text>}
              </span>
            ))}
          </Flex>

          {/* Regras mínimas (o servidor recalcula ao salvar) */}
          {!g?.saude ? (
            <Text type="secondary" style={{ fontSize: 12 }}>Salve a família para calcular as regras.</Text>
          ) : bloqueios.length === 0 && avisos.length === 0 ? (
            <Flex justify="space-between" align="center">
              <Text style={{ color: '#389e0d', fontSize: 12 }}><CheckCircleOutlined /> A família atende a todas as regras mínimas.</Text>
              {onAbrirGuia && <Button size="small" type="link" icon={<ReadOutlined />} onClick={onAbrirGuia}>Guia de regras</Button>}
            </Flex>
          ) : (
            <Alert
              type={bloqueios.length ? 'error' : 'warning'}
              showIcon
              message={bloqueios.length ? `Família bloqueada: ${bloqueios.length} regra(s) a corrigir` : `${avisos.length} aviso(s)`}
              description={(
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {[...bloqueios, ...avisos].map(r => <li key={r.codigo}>{r.mensagem}</li>)}
                </ul>
              )}
              action={onAbrirGuia && <Button size="small" type="link" icon={<ReadOutlined />} onClick={onAbrirGuia}>Guia</Button>}
            />
          )}
          {temAlteracoes && g?.saude && <Text type="secondary" style={{ fontSize: 12 }}>Há alterações não salvas: as regras são recalculadas ao salvar.</Text>}
        </Space>
      </Card>

      {/* Modal de Edição Avançada da Família por Abas */}
      <Modal
        title="Configurações e Identidade da Família"
        open={isModalOpen}
        onOk={handleSalvar}
        onCancel={handleFecharModal}
        okText="Salvar Alterações"
        cancelText="Cancelar"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: '12px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane={false}
            items={[
              {
                key: '1',
                label: (
                  <span>
                    <InfoCircleOutlined />
                    Identidade & DNA
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <Form.Item
                      name="nome"
                      label="Nome da Família"
                      rules={[{ required: true, message: 'Por favor, insira o nome da família!' }]}
                    >
                      <Input placeholder="Ex: Rolamento Rígido de Esferas" />
                    </Form.Item>

                    <Form.Item
                      name="status"
                      label="Status da Família"
                      tooltip="Rascunho: em estruturação, fora do PDV e dos canais. Bloqueada: definida pelo sistema quando faltam regras mínimas."
                    >
                      <Select
                        options={[
                          { value: 'RASCUNHO', label: 'Rascunho (em estruturação)' },
                          { value: 'ATIVO', label: 'Ativa' },
                          { value: 'INATIVO', label: 'Inativa' },
                          { value: 'BLOQUEADO_INCONSISTENCIA', label: 'Bloqueada por inconsistência', disabled: true },
                        ]}
                      />
                    </Form.Item>


                    <Form.Item name="imagem" label="URL da Imagem da Família">
                      <Input placeholder="https://..." prefix={<PictureOutlined />} />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <Form.Item name="unidadeBase" label="Unidade Base">
                        <Input placeholder="Ex: PC, KG, UN" />
                      </Form.Item>

                      <Form.Item name="tipoItem" label="Tipo SPED">
                        <Select
                          placeholder="Selecione o tipo"
                          options={[
                            { value: 'PA', label: 'PA - Produto Acabado' },
                            { value: 'MP', label: 'MP - Matéria-Prima' },
                            { value: 'ME', label: 'ME - Material de Embalagem' },
                            { value: 'AI', label: 'AI - Ativo Imobilizado' },
                          ]}
                        />
                      </Form.Item>
                    </div>
                  </div>
                ),
              },
              {
                key: '2',
                label: (
                  <span>
                    <ShopOutlined />
                    Comportamento da Marca
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                      <Form.Item name="prioridadeExposicao" label="Prioridade de Exposição">
                        <Select
                          placeholder="Selecione a prioridade"
                          options={[
                            { value: 'alta', label: 'Alta (Destaque principal)' },
                            { value: 'media', label: 'Média (Padrão)' },
                            { value: 'baixa', label: 'Baixa (Cauda longa)' },
                          ]}
                        />
                      </Form.Item>
                    </div>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      * Alinha o comportamento comercial desta família de acordo com as diretrizes da marca.
                    </Text>
                  </div>
                ),
              },
              {
                key: '3',
                label: (
                  <span>
                    <FileTextOutlined />
                    Fiscal
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <Form.Item name="ncmPadrao" label="NCM Padrão">
                        <Input placeholder="Ex: 6109.10.00" />
                      </Form.Item>

                      <Form.Item name="cestPadrao" label="CEST Padrão">
                        <Input placeholder="Ex: 28.038.00" />
                      </Form.Item>
                    </div>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      * Regras fiscais e exigências básicas herdadas em cascata para os SKUs filhos.
                    </Text>
                  </div>
                ),
              },
              {
                key: '4',
                label: (
                  <span>
                    <DollarOutlined />
                    Comercial
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <Form.Item name="margemMinima" label="Margem Mínima (%)">
                        <Input type="number" placeholder="Ex: 30" />
                      </Form.Item>

                      <Form.Item name="margemMaxima" label="Margem Máxima (%)">
                        <Input type="number" placeholder="Ex: 70" />
                      </Form.Item>

                      <Form.Item name="markupPadrao" label="Markup Padrão">
                        <Input type="number" placeholder="Ex: 2.5" />
                      </Form.Item>
                    </div>
                  </div>
                ),
              },
              {
                key: '5',
                label: (
                  <span>
                    <InboxOutlined />
                    Estoque / Planejamento
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <Form.Item name="estoqueMinimo" label="Estoque Mínimo">
                        <Input type="number" placeholder="Ex: 10" />
                      </Form.Item>

                      <Form.Item name="loteMinimo" label="Lote Mín. Produção">
                        <Input type="number" placeholder="Ex: 50" />
                      </Form.Item>

                      <Form.Item name="curvaAbc" label="Curva ABC">
                        <Select
                          placeholder="Selecione"
                          options={[
                            { value: 'A', label: 'Curva A (Alta)' },
                            { value: 'B', label: 'Curva B (Media)' },
                            { value: 'C', label: 'Curva C (Baixa)' },
                          ]}
                        />
                      </Form.Item>
                    </div>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      * Parâmetros de planejamento de estoque e reposição aplicados à família.
                    </Text>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  );
};