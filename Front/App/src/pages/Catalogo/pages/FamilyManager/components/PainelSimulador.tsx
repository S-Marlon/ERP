import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Input, Select, Row, Col, InputNumber, Tag, Button, Empty, Modal, Tooltip, Table, Alert } from 'antd';
import { EditOutlined, EyeOutlined, SettingOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Familia, ItemAssociado } from '../CatalogManager.types';
import { obterDicionarioOpcoes, gerarPreviewSku, gerarPreviewNome } from '../CatalogManager.helpers';

const { Text } = Typography;

// Função utilitária: Permite chaves { } para os templates, mas bloqueia caracteres realmente problemáticos
const sanitizarComAlerta = (valor: string): { valorLimpo: string; temErro: boolean } => {
  if (!valor) return { valorLimpo: '', temErro: false };
  const regexProibidos = /[ºª¢¬:?<>\\/|"'*+^~`´[\]]/g;
  const temErro = regexProibidos.test(valor);
  const valorLimpo = valor.replace(regexProibidos, '').trim();
  return { valorLimpo, temErro };
};

interface PainelSimuladorProps {
  familiaSelecionada?: Familia;
  valoresTeste: Record<string, string>;
  onMudancaValorTeste: (id: string, valor: string) => void;
  onAtualizarTemplateComercial: (valor: string) => void;
  onAtualizarTemplateSku: (valor: string) => void;
  onAtualizarSiglaSku: (valor: string) => void;
  onAtualizarOrdemSku?: (atributoId: string, ordem: number) => void;
  previewNomeSimulado: string;
  previewSkuSimulado: string;
  brandColor?: string;
  itensDaFamilia?: ItemAssociado[];
  carregandoItens?: boolean;
  // Funções de aplicação individual e em massa
  onAplicarNomeUnico?: (itemId: string | number, novoNome: string) => void;
  onAplicarSkuUnico?: (itemId: string | number, novoSku: string) => void;
  onAplicarEmMassa?: (itensAtualizados: Array<{ id: string | number; novoNome: string; novoSku: string }>) => void;
}

export const PainelSimulador: React.FC<PainelSimuladorProps> = ({
  familiaSelecionada,
  valoresTeste,
  onMudancaValorTeste,
  onAtualizarTemplateComercial,
  onAtualizarTemplateSku,
  onAtualizarSiglaSku,
  onAtualizarOrdemSku,
  previewNomeSimulado,
  previewSkuSimulado,
  brandColor = '#1677ff',
  itensDaFamilia = [],
  carregandoItens = false,
  onAplicarNomeUnico,
  onAplicarSkuUnico,
  onAplicarEmMassa,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [erroInputSku, setErroInputSku] = useState(false);
  const [erroSiglaSku, setErroSiglaSku] = useState(false);

  // Atributos da família
  const atributosFamilia = familiaSelecionada?.atributos || [];

  // Inicializa o estado garantindo que DNA e Grade já entrem marcados automaticamente
  const [atributosAdicionados, setAtributosAdicionados] = useState<string[]>([]);

  useEffect(() => {
    if (atributosFamilia.length > 0) {
      const idsDnaOuGradeOuUso = atributosFamilia
        .filter(attr => attr.classificacao === 'dna' || attr.classificacao === 'grade' || attr.estaSendoUtilizado || valoresTeste[attr.nome])
        .map(attr => String(attr.id));
      
      setAtributosAdicionados(Array.from(new Set(idsDnaOuGradeOuUso)));
    }
  }, [familiaSelecionada?.id, atributosFamilia.length]);

  const [buscaNome, setBuscaNome] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todos');
  const [atributoSelecionadoParaAdicionar, setAtributoSelecionadoParaAdicionar] = useState<string | undefined>(undefined);

  // Injeção de tokens no Nome Comercial
  const handleInjetarTokenNome = (token: string) => {
    const templateAtual = familiaSelecionada?.templateNomeComercial || '';
    onAtualizarTemplateComercial(`${templateAtual}${token}`);
  };

  // Injeção de tokens no SKU
  const handleInjetarTokenSku = (token: string) => {
    const templateAtual = familiaSelecionada?.templateSku || '';
    onAtualizarTemplateSku(`${templateAtual}${token}`);
  };

  const handleAdicionarAtributoLista = () => {
    if (atributoSelecionadoParaAdicionar && !atributosAdicionados.includes(atributoSelecionadoParaAdicionar)) {
      setAtributosAdicionados([...atributosAdicionados, atributoSelecionadoParaAdicionar]);
      setAtributoSelecionadoParaAdicionar(undefined);
    }
  };

  const atributosDisponiveisParaAdicionar = atributosFamilia.filter(
    attr => !atributosAdicionados.includes(String(attr.id))
  );

  const atributosVisiveis = atributosFamilia.filter(attr => {
    const estaAdicionado = atributosAdicionados.includes(String(attr.id));
    const bateNome = attr.nome.toLowerCase().includes(buscaNome.toLowerCase());
    const bateClassificacao = filtroClassificacao === 'todos' || attr.classificacao === filtroClassificacao;

    return estaAdicionado && bateNome && bateClassificacao;
  });

  // Validação se o SKU possui atributos de grade obrigatórios
  const temAtributoGradeNoSku = atributosFamilia.some(
    attr => attr.classificacao === 'grade' && attr.ordemSku > 0
  );

  // Ação de Aplicar em Massa em todos os itens listados
  const handleExecutarAplicacaoEmMassa = () => {
    if (!onAplicarEmMassa || itensDaFamilia.length === 0) return;

    const itensProcessados = itensDaFamilia.map(item => ({
      id: item.id,
      novoNome: gerarPreviewNome ? gerarPreviewNome(familiaSelecionada, item.valoresAtributos || {}) : previewNomeSimulado,
      novoSku: gerarPreviewSku ? gerarPreviewSku(familiaSelecionada, atributosFamilia, item.valoresAtributos || {}) : previewSkuSimulado
    }));

    onAplicarEmMassa(itensProcessados);
  };

  // Colunas para a tabela de impacto
  const colunasAntesDepois = [
    {
      title: 'Item / ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (text: any, record: ItemAssociado) => (
        <div>
          <Text strong style={{ fontSize: '11px', display: 'block' }}>{record.nome || record.titulo}</Text>
          <Text type="secondary" style={{ fontSize: '9px' }}>ID: #{record.id}</Text>
        </div>
      )
    },
    {
      title: 'Nome Comercial (Atual vs Novo)',
      key: 'nomeComercial',
      render: (_: any, record: ItemAssociado) => {
        const novoNomeCalculado = gerarPreviewNome ? gerarPreviewNome(familiaSelecionada, record.valoresAtributos || {}) : previewNomeSimulado;
        const temDiferenca = record.nomeComercial !== novoNomeCalculado;

        return (
          <div style={{ fontSize: '10px' }}>
            <div style={{ color: '#64748b' }}><strong style={{ color: '#334155' }}>Atual:</strong> {record.nomeComercial || '(Vazio)'}</div>
            <div style={{ color: '#0369a1', marginTop: 2 }}><strong style={{ color: '#0284c7' }}>Novo:</strong> {novoNomeCalculado}</div>
            {temDiferenca && onAplicarNomeUnico && (
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, height: 'auto', fontSize: '10px', marginTop: 2 }}
                onClick={() => onAplicarNomeUnico(record.id, novoNomeCalculado)}
              >
                Aplicar este Nome
              </Button>
            )}
          </div>
        );
      }
    },
    {
      title: 'SKU (Atual vs Novo)',
      key: 'sku',
      render: (_: any, record: ItemAssociado) => {
        const novoSkuCalculado = gerarPreviewSku ? gerarPreviewSku(familiaSelecionada, atributosFamilia, record.valoresAtributos || {}) : previewSkuSimulado;
        const temDiferenca = record.sku !== novoSkuCalculado;

        return (
          <div style={{ fontSize: '10px' }}>
            <div style={{ color: '#64748b' }}><strong style={{ color: '#334155' }}>Atual:</strong> {record.sku || '(Vazio)'}</div>
            <div style={{ color: '#0369a1', marginTop: 2 }}><strong style={{ color: '#0284c7' }}>Novo:</strong> {novoSkuCalculado}</div>
            {temDiferenca && onAplicarSkuUnico && (
              <Button 
                type="link" 
                size="small" 
                style={{ color: '#d97706', padding: 0, height: 'auto', fontSize: '10px', marginTop: 2 }}
                onClick={() => onAplicarSkuUnico(record.id, novoSkuCalculado)}
              >
                Aplicar este SKU
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <>
      {/* 1. PAINEL VISOR (Tela Principal) */}
      <Card
        title={
          <Space size={6}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: brandColor, display: "inline-block" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>Simulador de Nomenclatura e SKU</span>
          </Space>
        }
        size="small"
        style={{
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.01)",
          height: "100%"
        }}
        styles={{
          header: { borderBottom: "1px solid #f1f5f9", minHeight: "38px", background: "#f8fafc", borderRadius: "10px 10px 0 0", padding: "0 10px" },
          body: { padding: "12px" }
        }}
        extra={
          <Tooltip title="Configurar Regras de SKU e Nome">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: "12px", color: brandColor }} />}
              onClick={() => setIsModalOpen(true)}
            >
              <span style={{ fontSize: "11px", fontWeight: 600 }}>Configurar Regras</span>
            </Button>
          </Tooltip>
        }
      >
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <div style={{ background: "#f8fafc", padding: "10px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <Row gutter={8}>
              <Col xs={24} sm={17}>
                <Text style={{ color: "#64748b", fontSize: "10px", display: "block", fontWeight: 600 }}>PREVIEW NOME COMERCIAL</Text>
                <Text style={{ color: "#0f172a", fontSize: "12px", fontWeight: 700 }}>
                  {previewNomeSimulado || "Configure um template comercial..."}
                </Text>
              </Col>
              <Col xs={24} sm={7}>
                <Text style={{ color: "#64748b", fontSize: "10px", display: "block", fontWeight: 600 }}>PREVIEW SKU</Text>
                <Text style={{ color: brandColor, fontSize: "12px", fontWeight: 700, fontFamily: "monospace" }}>
                  {previewSkuSimulado || "SKU-EXEMPLO"}
                </Text>
              </Col>
            </Row>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <Text style={{ color: "#94a3b8", fontSize: "10px", display: "block", fontWeight: 600 }}>SIGLA SKU</Text>
              <Text style={{ color: "#334155", fontSize: "11px", fontFamily: "monospace", fontWeight: 600 }}>{familiaSelecionada?.siglaSku || "N/D"}</Text>
            </div>
            <div>
              <Text style={{ color: "#94a3b8", fontSize: "10px", display: "block", fontWeight: 600 }}>TEMPLATE SKU</Text>
              <Text style={{ color: "#334155", fontSize: "11px", fontFamily: "monospace" }} ellipsis>{familiaSelecionada?.templateSku || "Padrão"}</Text>
            </div>
          </div>

          {!temAtributoGradeNoSku && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <WarningOutlined style={{ color: '#d97706', fontSize: '12px' }} />
              <Text style={{ fontSize: '10px', color: '#b45309' }}>
                Atenção: Nenhum atributo de <b>Grade</b> possui ordem no SKU. Atributos variáveis (como Tamanho) são obrigatórios para diferenciar os itens.
              </Text>
            </div>
          )}
        </Space>
      </Card>

      {/* 2. MODAL DE CONFIGURAÇÃO */}
      <Modal
        title={
          <Space size={8}>
            <SettingOutlined style={{ color: brandColor }} />
            <span>Configuração Avançada de Nomenclatura e SKUs</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={1150}
        footer={[
          <Button key="close" type="primary" style={{ backgroundColor: brandColor, borderColor: brandColor }} onClick={() => setIsModalOpen(false)}>
            Concluir / Salvar
          </Button>
        ]}
        styles={{
          body: { maxHeight: '80vh', overflowY: 'auto', padding: '16px', background: '#f8fafc' }
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {!temAtributoGradeNoSku && (
            <Alert
              type="warning"
              showIcon
              message="Validação de SKU Pendente"
              description="Sua regra atual de SKU não possui atributos do tipo Grade com ordem maior que 0. Lembre-se de configurar a ordem dos atributos de variação para evitar SKUs duplicados."
              style={{ fontSize: '11px', borderRadius: 6 }}
            />
          )}

          <Row gutter={[12, 12]}>
            {/* COLUNA ESQUERDA: Templates e Impacto */}
            <Col xs={24} lg={16}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Row gutter={8}>
                  {/* Bloco Nome Comercial */}
                  <Col span={12}>
                    <Card 
                      type="inner" 
                      title={<Text style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1' }}>Nome Comercial</Text>}
                      size="small" 
                      styles={{ header: { background: '#f0f9ff', padding: '4px 8px' }, body: { padding: '8px' } }}
                      style={{ borderRadius: 6, borderColor: '#bae6fd' }}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                          <Text type="secondary" style={{ fontSize: '9px', fontWeight: 700 }}>PREVIEW</Text>
                          <Text strong style={{ color: '#0f172a', fontSize: '11px', display: 'block' }} ellipsis>{previewNomeSimulado || 'Aguardando...'}</Text>
                        </div>
                        <Input
                          size="small"
                          value={familiaSelecionada?.templateNomeComercial || ''}
                          onChange={e => onAtualizarTemplateComercial(e.target.value)}
                          placeholder="Ex: {FAMILIA} {Tamanho}"
                          allowClear
                        />
                        <Space wrap size={[2, 2]}>
                          <Tag color="blue" style={{ cursor: 'pointer', fontSize: '10px', margin: 0 }} onClick={() => handleInjetarTokenNome('{FAMILIA}')}>
                            {'{FAMILIA}'}
                          </Tag>
                          {atributosFamilia
                            .filter(attr => atributosAdicionados.includes(String(attr.id)))
                            .map(attr => (
                              <Tag key={attr.id} style={{ cursor: 'pointer', fontSize: '10px', margin: 0 }} onClick={() => handleInjetarTokenNome(`{${attr.nome}}`)}>
                                {`{${attr.nome}}`}
                              </Tag>
                            ))}
                        </Space>
                      </Space>
                    </Card>
                  </Col>

                  {/* Bloco Estrutura SKU */}
                  <Col span={12}>
                    <Card 
                      type="inner" 
                      title={<Text style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>Estrutura SKU</Text>}
                      size="small" 
                      styles={{ header: { background: '#f8fafc', padding: '4px 8px' }, body: { padding: '8px' } }}
                      style={{ borderRadius: 6, borderColor: '#e2e8f0' }}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <div style={{ background: '#1e293b', padding: '6px 8px', borderRadius: 4 }}>
                          <Text style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 700 }}>PREVIEW SKU</Text>
                          <Text strong style={{ color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace', display: 'block' }} ellipsis>{previewSkuSimulado || 'AGUARDANDO'}</Text>
                        </div>

                        <div>
                          <Input
                            size="small"
                            value={familiaSelecionada?.templateSku || ''}
                            status={erroInputSku ? 'error' : ''}
                            onChange={e => {
                              const { valorLimpo, temErro } = sanitizarComAlerta(e.target.value);
                              setErroInputSku(temErro);
                              onAtualizarTemplateSku(valorLimpo);
                            }}
                            placeholder="Ex: {Sigla}-{Tamanho}"
                            allowClear
                          />
                          {erroInputSku && (
                            <Text type="danger" style={{ fontSize: '9px', display: 'block', marginTop: 2 }}>
                              ⚠️ Caracteres especiais bloqueados.
                            </Text>
                          )}
                        </div>

                        <div>
                          <Input
                            size="small"
                            value={familiaSelecionada?.siglaSku || ''}
                            status={erroSiglaSku ? 'error' : ''}
                            onChange={e => {
                              const { valorLimpo, temErro } = sanitizarComAlerta(e.target.value);
                              setErroSiglaSku(temErro);
                              onAtualizarSiglaSku(valorLimpo);
                            }}
                            placeholder="Sigla (ex: ABR)"
                            allowClear
                          />
                          {erroSiglaSku && (
                            <Text type="danger" style={{ fontSize: '9px', display: 'block', marginTop: 2 }}>
                              ⚠️ Caracteres especiais bloqueados.
                            </Text>
                          )}
                        </div>

                        <Space wrap size={[2, 2]}>
                          <Tag color="cyan" style={{ cursor: 'pointer', fontSize: '10px', margin: 0 }} onClick={() => handleInjetarTokenSku('{Sigla}')}>
                            {'{Sigla}'}
                          </Tag>
                          {atributosFamilia
                            .filter(attr => attr.classificacao === 'grade' && atributosAdicionados.includes(String(attr.id)))
                            .map(attr => (
                              <Tag key={attr.id} color="geekblue" style={{ cursor: 'pointer', fontSize: '10px', margin: 0 }} onClick={() => handleInjetarTokenSku(`{${attr.nome}}`)}>
                                {`{${attr.nome}}`}
                              </Tag>
                            ))}
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                {/* Tabela de Impacto */}
                <Card
                  type="inner"
                  title={
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size={8}>
                        <EyeOutlined style={{ color: brandColor, fontSize: '14px' }} />
                        <Text style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
                          Impacto nos Itens da Família ({itensDaFamilia.length})
                        </Text>
                      </Space>
                      {onAplicarEmMassa && itensDaFamilia.length > 0 && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckCircleOutlined />}
                          style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontSize: '11px', fontWeight: 600 }}
                          onClick={handleExecutarAplicacaoEmMassa}
                        >
                          Aplicar em Massa ({itensDaFamilia.length})
                        </Button>
                      )}
                    </Space>
                  }
                  size="small"
                  styles={{
                    header: { background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' },
                    body: { padding: '8px', background: '#fff' }
                  }}
                  style={{ borderRadius: 8, borderColor: '#cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                >
                  <Table
                    dataSource={itensDaFamilia}
                    columns={colunasAntesDepois}
                    rowKey="id"
                    loading={carregandoItens}
                    size="middle"
                    pagination={{ pageSize: 6, size: 'small', showSizeChanger: false }}
                    scroll={{ y: 260 }}
                    locale={{ 
                      emptyText: (
                        <Empty 
                          image={Empty.PRESENTED_IMAGE_SIMPLE} 
                          description={<Text type="secondary" style={{ fontSize: '11px' }}>Nenhum item associado a esta família ainda.</Text>} 
                          style={{ margin: '20px 0' }} 
                        />
                      ) 
                    }}
                  />
                </Card>
              </Space>
            </Col>

            {/* COLUNA DIREITA: Valores de Simulação */}
            <Col xs={24} lg={8}>
              <Card 
                type="inner"
                title={
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>Valores de Simulação</Text>
                    <Tag color="cyan" style={{ margin: 0, fontSize: '10px' }}>DNA & Grade Automáticos</Tag>
                  </Space>
                }
                size="small"
                styles={{ header: { background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }, body: { padding: '10px', background: '#fff' } }}
                style={{ borderRadius: 8, borderColor: '#cbd5e1', height: '100%', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  
                  <Row gutter={6}>
                    <Col span={16}>
                      <Select
                        size="small"
                        showSearch
                        style={{ width: '100%' }}
                        placeholder="Adicionar ficha técnica extra..."
                        optionFilterProp="label"
                        value={atributoSelecionadoParaAdicionar}
                        onChange={value => setAtributoSelecionadoParaAdicionar(value)}
                        options={atributosDisponiveisParaAdicionar.map(attr => ({
                          value: String(attr.id),
                          label: `${attr.nome} (${attr.classificacao.toUpperCase()})`
                        }))}
                      />
                    </Col>
                    <Col span={8}>
                      <Button 
                        type="primary" 
                        size="small" 
                        style={{ width: '100%', fontSize: '11px', fontWeight: 600 }}
                        disabled={!atributoSelecionadoParaAdicionar}
                        onClick={handleAdicionarAtributoLista}
                      >
                        + Adicionar
                      </Button>
                    </Col>
                  </Row>

                  <div style={{ maxHeight: 310, overflowY: 'auto', paddingRight: 4 }}>
                    <Row gutter={[6, 6]}>
                      {atributosVisiveis.length === 0 ? (
                        <Col span={24}>
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum atributo na simulação" style={{ margin: '16px 0' }} />
                        </Col>
                      ) : (
                        atributosVisiveis.map(attr => {
                          const dicionario = obterDicionarioOpcoes(attr.exemplos);
                          const identificadorInput = attr.nome;
                          const valorAtual = valoresTeste[identificadorInput] || '';
                          const isDisabled = attr.estaSendoUtilizado || attr.origem === 'categoria';
                          const isDnaOuGrade = attr.classificacao === 'dna' || attr.classificacao === 'grade';

                          return (
                            <Col xs={12} key={attr.id}>
                              <div style={{ 
                                padding: '8px', 
                                borderRadius: 6, 
                                border: isDnaOuGrade ? '1px solid #94a3b8' : '1px solid #e2e8f0', 
                                background: isDnaOuGrade ? '#f8fafc' : '#ffffff' 
                              }}>
                                <Row gutter={[4, 4]} align="middle">
                                  <Col span={24} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Space size={4}>
                                      <Text strong style={{ fontSize: '11px', color: '#1e293b' }}>{attr.nome}</Text>
                                      <Tag color={isDnaOuGrade ? 'blue' : 'default'} style={{ fontSize: '8px', padding: '0 3px', margin: 0, lineHeight: '14px' }}>
                                        {attr.classificacao.toUpperCase()}
                                      </Tag>
                                    </Space>
                                    {!isDisabled && !isDnaOuGrade && (
                                      <Typography.Link 
                                        style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}
                                        onClick={() => setAtributosAdicionados(atributosAdicionados.filter(id => id !== String(attr.id)))}
                                      >
                                        ×
                                      </Typography.Link>
                                    )}
                                  </Col>
                                  
                                  <Col span={15}>
                                    <Input
                                      size="small"
                                      value={valorAtual}
                                      onChange={e => {
                                        const { valorLimpo } = sanitizarComAlerta(e.target.value);
                                        onMudancaValorTeste(identificadorInput, valorLimpo);
                                      }}
                                      placeholder="Aguardando valor..."
                                      list={`list-${identificadorInput}`}
                                      disabled={isDisabled}
                                      style={{ fontSize: '11px' }}
                                    />
                                    <datalist id={`list-${identificadorInput}`}>
                                      {dicionario.map((d, idx) => (
                                        <option key={idx} value={d.value || d.label} />
                                      ))}
                                    </datalist>
                                  </Col>

                                  <Col span={9} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                                    <Text type="secondary" style={{ fontSize: '9px' }}>Ord:</Text>
                                    <InputNumber
                                      size="small"
                                      min={0}
                                      value={attr.ordemSku || 0}
                                      onChange={value => onAtualizarOrdemSku?.(String(attr.id), Number(value) || 0)}
                                      style={{ width: 42, fontSize: '10px' }}
                                      disabled={!onAtualizarOrdemSku}
                                    />
                                  </Col>
                                </Row>
                              </div>
                            </Col>
                          );
                        })
                      )}
                    </Row>
                  </div>
                </Space>
              </Card> 
            </Col>
          </Row>
        </Space>
      </Modal>
    </>
  );
};