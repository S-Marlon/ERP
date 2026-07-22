import React, { useState } from 'react';
import { Card, Space, Typography, Input, Select, Row, Col, InputNumber, Tag, Button, Empty } from 'antd';
import { Grupo as Familia } from '../CatalogManager.types';
import { obterDicionarioOpcoes } from '../CatalogManager.helpers';

interface PainelSimuladorProps {
  grupoSelecionado: Familia;
  valoresTeste: Record<string, string>;
  onMudancaValorTeste: (id: string, valor: string) => void;
  onAtualizarTemplateComercial: (valor: string) => void;
  onAtualizarTemplateSku: (valor: string) => void;
  onAtualizarSiglaSku: (valor: string) => void;
  onAtualizarSeparadorSku: (valor: string) => void;
  onAtualizarOrdemSku?: (atributoId: string, ordem: number) => void;
  previewNomeSimulado: string;
  previewSkuSimulado: string;
  brandColor?: string;
}

export const PainelSimulador: React.FC<PainelSimuladorProps> = ({
  grupoSelecionado,
  valoresTeste,
  onMudancaValorTeste,
  onAtualizarTemplateComercial,
  onAtualizarTemplateSku,
  onAtualizarSiglaSku,
  onAtualizarSeparadorSku,
  onAtualizarOrdemSku,
  previewNomeSimulado,
  previewSkuSimulado,
}) => {
  // Estado para armazenar os IDs dos atributos adicionados à simulação
  const [atributosAdicionados, setAtributosAdicionados] = useState<string[]>(() => {
    return grupoSelecionado.atributos
      .filter(attr => valoresTeste[attr.nome] || attr.estaSendoUtilizado)
      .map(attr => String(attr.id));
  });

  const [buscaNome, setBuscaNome] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todos');
  const [atributoSelecionadoParaAdicionar, setAtributoSelecionadoParaAdicionar] = useState<string | undefined>(undefined);

  const handleInjetarToken = (token: string) => {
    const templateAtual = grupoSelecionado.templateNomeComercial || '';
    onAtualizarTemplateComercial(`${templateAtual}${token}`);
  };

  // Função para adicionar o atributo selecionado na lista visível
  const handleAdicionarAtributoLista = () => {
    if (atributoSelecionadoParaAdicionar && !atributosAdicionados.includes(atributoSelecionadoParaAdicionar)) {
      setAtributosAdicionados([...atributosAdicionados, atributoSelecionadoParaAdicionar]);
      setAtributoSelecionadoParaAdicionar(undefined);
    }
  };

  // Filtra a lista completa para o Select (apenas os que NÃO foram adicionados ainda)
  const atributosDisponiveisParaAdicionar = grupoSelecionado.atributos.filter(
    attr => !atributosAdicionados.includes(String(attr.id))
  );

  // Lista de atributos que serão renderizados na tela
  const atributosVisiveis = grupoSelecionado.atributos.filter(attr => {
    const estaAdicionado = atributosAdicionados.includes(String(attr.id));
    const bateNome = attr.nome.toLowerCase().includes(buscaNome.toLowerCase());
    const bateClassificacao = filtroClassificacao === 'todos' || attr.classificacao === filtroClassificacao;
    
    return estaAdicionado && bateNome && bateClassificacao;
  });

  return (
    <Card 
      title="Painel de Simulação de Nome e SKU"
      size="small"
      styles={{
        header: { borderBottom: '1px solid #f0f0f0', fontWeight: 600, padding: '8px 12px' },
        body: { padding: 12 }
      }}
      style={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }} 
    >
      <Row gutter={[12, 12]}>
        {/* Painel Esquerdo: Nome Comercial */}
        <Col xs={24} lg={8}>
          <Card 
            type="inner" 
            title="Nome Comercial" 
            size="small" 
            styles={{ body: { padding: 8 } }}
            style={{ borderRadius: 6, height: '100%', borderColor: '#e0f2fe' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div style={{ 
                padding: '8px 12px', 
                background: '#f0f9ff', 
                borderRadius: 6, 
                border: '1px dashed #bae6fd', 
                minHeight: 40,
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <Typography.Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Preview do Nome
                </Typography.Text>
                <Typography.Text strong style={{ color: '#0369a1', fontSize: '13px' }}>
                  {previewNomeSimulado || 'Aguardando parâmetros...'}
                </Typography.Text>
              </div>

              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Typography.Text strong type="secondary" style={{ fontSize: '11px' }}>Template do Nome</Typography.Text>
                <Input
                  size="small"
                  value={grupoSelecionado.templateNomeComercial || ''}
                  onChange={e => onAtualizarTemplateComercial(e.target.value)}
                  placeholder="Ex: {FAMILIA} {POTENCIA}HP"
                  allowClear
                />
              </Space>

              <div>
                <Typography.Text strong type="secondary" style={{ fontSize: '11px' }}>Injetar Variáveis</Typography.Text>
                <Space wrap style={{ marginTop: 4 }} size={[4, 4]}>
                  <Tag
                    color="blue"
                    style={{ cursor: 'pointer', borderRadius: 4, fontSize: '11px', margin: 0 }}
                    onClick={() => handleInjetarToken('{FAMILIA}')}
                  >
                    {'{FAMILIA}'}
                  </Tag>
                  {grupoSelecionado.atributos
                    .filter(attr => atributosAdicionados.includes(String(attr.id)))
                    .map(attr => (
                      <Tag
                        key={attr.id}
                        style={{ cursor: 'pointer', borderRadius: 4, fontSize: '11px', margin: 0 }}
                        onClick={() => handleInjetarToken(`{${attr.nome}}`)}
                      >
                        {`{${attr.nome}}`}
                      </Tag>
                    ))}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>

        {/* Painel Central: Composição de SKU */}
        <Col xs={24} lg={8}>
          <Card 
            type="inner" 
            title="Estrutura do SKU" 
            size="small" 
            styles={{ body: { padding: 8 } }}
            style={{ borderRadius: 6, height: '100%', borderColor: '#f1f5f9' }}
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div style={{ 
                padding: '8px 12px', 
                background: '#1e293b', 
                borderRadius: 6, 
                minHeight: 40,
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <Typography.Text style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Preview de SKU
                </Typography.Text>
                <Typography.Text strong style={{ color: '#38bdf8', fontSize: '13px', fontFamily: 'monospace' }}>
                  {previewSkuSimulado || 'AGUARDANDO_PARAMETROS'}
                </Typography.Text>
              </div>

              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Typography.Text strong type="secondary" style={{ fontSize: '11px' }}>Template do SKU</Typography.Text>
                <Input
                  size="small"
                  value={grupoSelecionado.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}'}
                  onChange={e => onAtualizarTemplateSku(e.target.value)}
                  placeholder="Ex: {SIGLA}-{POTENCIA}"
                  allowClear
                />
              </Space>

              <Row gutter={8}>
                <Col span={12}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Typography.Text strong type="secondary" style={{ fontSize: '11px' }}>Sigla Base</Typography.Text>
                    <Input
                      size="small"
                      value={grupoSelecionado.siglaSku || ''}
                      onChange={e => onAtualizarSiglaSku(e.target.value)}
                      placeholder="Ex: BOM"
                      allowClear
                    />
                  </Space>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Typography.Text strong type="secondary" style={{ fontSize: '11px' }}>Separador</Typography.Text>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={grupoSelecionado.separadorSku || '-'}
                      onChange={onAtualizarSeparadorSku}
                      options={[
                        { value: '-', label: 'Hífen (-)' },
                        { value: '_', label: 'Under (_)' },
                        { value: '.', label: 'Ponto (.)' },
                        { value: '', label: 'Nenhum' },
                      ]}
                    />
                  </Space>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>

        {/* Painel Inferior: Valores de Teste dos Atributos Selecionados */}
        <Col xs={24} lg={8}>
          <Card 
            type="inner" 
            title="Valores de Simulação (Atributos)" 
            size="small" 
            styles={{ body: { padding: 8 } }}
            style={{ borderRadius: 6, height: '100%' }}
          >
            {/* Barra de Adicionar Atributo Oculto para a Lista */}
            <Row gutter={4} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed #e2e8f0' }}>
              <Col span={18}>
                <Select
                  size="small"
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="Selecionar atributo para adicionar..."
                  optionFilterProp="label"
                  value={atributoSelecionadoParaAdicionar}
                  onChange={value => setAtributoSelecionadoParaAdicionar(value)}
                  options={atributosDisponiveisParaAdicionar.map(attr => ({
                    value: String(attr.id),
                    label: `${attr.nome} (${attr.classificacao.toUpperCase()})`
                  }))}
                />
              </Col>
              <Col span={6}>
                <Button 
                  type="primary" 
                  size="small" 
                  style={{ width: '100%', fontSize: '11px' }}
                  disabled={!atributoSelecionadoParaAdicionar}
                  onClick={handleAdicionarAtributoLista}
                >
                  + Add
                </Button>
              </Col>
            </Row>

            {/* Seção de Filtros */}
            <Row gutter={[6, 6]} style={{ marginBottom: 10 }}>
              <Col xs={14}>
                <Input
                  size="small"
                  placeholder="Filtrar adicionados por nome..."
                  value={buscaNome}
                  onChange={e => setBuscaNome(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={10}>
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={filtroClassificacao}
                  onChange={value => setFiltroClassificacao(value)}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'grade', label: 'Grade' },
                    { value: 'dna', label: 'DNA' },
                    { value: 'ficha', label: 'Ficha' },
                  ]}
                />
              </Col>
            </Row>

            {/* Lista de Atributos Adicionados Filtrados */}
            <Row gutter={[8, 8]} style={{ maxHeight: 210, overflowY: 'auto', paddingRight: 4 }}>
              {atributosVisiveis.length === 0 ? (
                <Col span={24}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum atributo adicionado" style={{ margin: '16px 0' }} />
                </Col>
              ) : (
                atributosVisiveis.map(attr => {
                  const dicionario = obterDicionarioOpcoes(attr.exemplos);
                  const identificadorInput = attr.nome;
                  const valorAtual = valoresTeste[identificadorInput] || '';
                  const isDisabled = attr.estaSendoUtilizado || attr.origem === 'categoria';

                  const coresMapeamento: Record<string, string> = {
                    grade: 'green',
                    dna: 'blue',
                  };

                  return (
                    <Col xs={24} key={attr.id}>
                      <div style={{ 
                        padding: '6px 10px', 
                        borderRadius: 6, 
                        border: '1px solid #f1f5f9', 
                        background: '#f8fafc' 
                      }}>
                        <Row gutter={[4, 4]} align="middle">
                          <Col span={24} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <Typography.Text strong style={{ fontSize: '11px', color: '#334155' }}>
                              {attr.nome}
                            </Typography.Text>
                            <Space size={4}>
                              <Tag 
                                color={coresMapeamento[attr.classificacao] || 'default'} 
                                style={{ margin: 0, fontSize: '9px', height: '16px', display: 'flex', alignItems: 'center', borderRadius: 4, padding: '0 4px' }}
                              >
                                {attr.classificacao === 'ficha' ? 'Ficha' : attr.classificacao.toUpperCase()}
                              </Tag>
                              {!isDisabled && (
                                <Typography.Link 
                                  style={{ color: '#ff4d4f', fontSize: '11px', marginLeft: 4 }}
                                  onClick={() => setAtributosAdicionados(atributosAdicionados.filter(id => id !== String(attr.id)))}
                                >
                                  ×
                                </Typography.Link>
                              )}
                            </Space>
                          </Col>

                          <Col span={14}>
                            <Input
                              size="small"
                              value={valorAtual}
                              onChange={e => onMudancaValorTeste(identificadorInput, e.target.value)}
                              placeholder="Valor simulação..."
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

                          <Col span={10} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                            <Typography.Text type="secondary" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                              Ord:
                            </Typography.Text>
                            <InputNumber
                              size="small"
                              min={0}
                              value={attr.ordemSku || 0}
                              onChange={value => onAtualizarOrdemSku?.(String(attr.id), Number(value) || 0)}
                              style={{ width: '100%', maxWidth: 45, fontSize: '11px' }}
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
          </Card>
        </Col>
      </Row>
    </Card>
  );
};