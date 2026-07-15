import React from 'react';
import { Card, Space, Typography, Input, Select, Row, Col, InputNumber, Tag } from 'antd';
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
  const handleInjetarToken = (token: string) => {
    const templateAtual = grupoSelecionado.templateNomeComercial || '';
    onAtualizarTemplateComercial(`${templateAtual}${token}`);
  };

  return (
    <Card 
      title="Painel de Simulação de Nome e SKU"
      headStyle={{ borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}
      style={{ borderRadius: 8, border: '1px solid #f0f0f0' }} 
      bodyStyle={{ padding: 16 }}
    >
      <Row gutter={[16, 16]}>
        {/* Painel Esquerdo: Nome Comercial */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card type="inner" title="Preview do Nome Comercial" size="small" bodyStyle={{ padding: 12 }} style={{ borderRadius: 6 }}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 6, fontSize: '12px' }}>
                Nome gerado com base no template atual da família.
              </Typography.Paragraph>
              <div style={{ minHeight: 64, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
                <Typography.Text strong style={{ color: '#1e293b' }}>
                  {previewNomeSimulado || 'Aguardando parâmetros...'}
                </Typography.Text>
              </div>
            </Card>

            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong type="secondary">Template do Nome</Typography.Text>
              <Input
                value={grupoSelecionado.templateNomeComercial || ''}
                onChange={e => onAtualizarTemplateComercial(e.target.value)}
                placeholder="Ex: {FAMILIA} {POTENCIA}HP"
                allowClear
              />
            </Space>

            <div>
              <Typography.Text strong type="secondary">Injetar Variáveis</Typography.Text>
              <Space wrap style={{ marginTop: 6 }} size={[4, 4]}>
                <Tag
                  color="blue"
                  style={{ cursor: 'pointer', borderRadius: 4 }}
                  onClick={() => handleInjetarToken('{FAMILIA}')}
                >
                  {'{FAMILIA}'}
                </Tag>
                {grupoSelecionado.atributos.map(attr => (
                  <Tag
                    key={attr.id}
                    style={{ cursor: 'pointer', borderRadius: 4 }}
                    onClick={() => handleInjetarToken(`{${attr.nome}}`)}
                  >
                    {`{${attr.nome}}`}
                  </Tag>
                ))}
              </Space>
            </div>
          </Space>
        </Col>

        {/* Painel Central: Composição de SKU */}
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card type="inner" title="Preview de SKU Estruturado" size="small" bodyStyle={{ padding: 12 }} style={{ borderRadius: 6 }}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 6, fontSize: '12px' }}>
                Código SKU baseado no padrão do grupo.
              </Typography.Paragraph>
              <div style={{ minHeight: 64, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
                <Typography.Text code strong style={{ fontSize: '14px' }}>
                  {previewSkuSimulado || 'AGUARDANDO_PARAMETROS'}
                </Typography.Text>
              </div>
            </Card>

            <Row gutter={8}>
              <Col span={12}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Typography.Text strong type="secondary">Sigla Base</Typography.Text>
                  <Input
                    value={grupoSelecionado.siglaSku || ''}
                    onChange={e => onAtualizarSiglaSku(e.target.value)}
                    placeholder="Ex: BOM"
                    allowClear
                  />
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Typography.Text strong type="secondary">Separador</Typography.Text>
                  <Select
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

            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text strong type="secondary">Template do SKU</Typography.Text>
              <Input
                value={grupoSelecionado.templateSku || '{SIGLA}{SEPARADOR}{VARIAÇÃO}'}
                onChange={e => onAtualizarTemplateSku(e.target.value)}
                placeholder="Ex: {SIGLA}-{POTENCIA}"
                allowClear
              />
            </Space>
          </Space>
        </Col>

        {/* Painel Direito: Valores de Teste dos Atributos */}
        <Col xs={24} lg={8}>
          <Card type="inner" title="Valores de Simulação" size="small" bodyStyle={{ padding: 12 }} style={{ borderRadius: 6, maxHeight: 310, overflowY: 'auto' }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {grupoSelecionado.atributos.map(attr => {
                const dicionario = obterDicionarioOpcoes(attr.exemplos);
                const identificadorInput = attr.nome;
                const valorAtual = valoresTeste[identificadorInput] || '';
                const isDisabled = attr.estaSendoUtilizado || attr.origem === 'categoria';

                const coresMapeamento: Record<string, string> = {
                  grade: 'green',
                  dna: 'blue',
                };

                return (
                  <div 
                    key={attr.id} 
                    style={{ 
                      padding: 10, 
                      borderRadius: 6, 
                      border: '1px solid #f0f0f0', 
                      background: '#fff' 
                    }}
                  >
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography.Text strong style={{ fontSize: '12px' }}>{attr.nome}</Typography.Text>
                        <Tag 
                          color={coresMapeamento[attr.classificacao] || 'default'} 
                          style={{ margin: 0, fontSize: '10px', height: '18px', display: 'flex', alignItems: 'center', borderRadius: 4 }}
                        >
                          {attr.classificacao === 'ficha' ? 'Ficha' : attr.classificacao.toUpperCase()}
                        </Tag>
                      </div>

                      <Input
                        size="small"
                        value={valorAtual}
                        onChange={e => onMudancaValorTeste(identificadorInput, e.target.value)}
                        placeholder="Ex: Valor de simulação..."
                        list={`list-${identificadorInput}`}
                        disabled={isDisabled}
                      />
                      <datalist id={`list-${identificadorInput}`}>
                        {dicionario.map((d, idx) => (
                          <option key={idx} value={d.value || d.label} />
                        ))}
                      </datalist>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 2 }}>
                        <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Prioridade SKU</Typography.Text>
                        <InputNumber
                          size="small"
                          min={0}
                          value={attr.ordemSku || 0}
                          onChange={value => onAtualizarOrdemSku?.(String(attr.id), Number(value) || 0)}
                          style={{ width: 70 }}
                          disabled={!onAtualizarOrdemSku}
                        />
                      </div>
                    </Space>
                  </div>
                );
              })}
            </Space>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};