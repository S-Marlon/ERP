import React, { useState, useMemo } from 'react';
import { Modal, Upload, Input, Button, Tabs, message, Space, Typography, Card, Tag, Divider, Row, Col } from 'antd';
import { InboxOutlined, FileTextOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import { Grupo as Familia, AtributoConfig } from '../CatalogManager.types';

interface ImportarFamiliaModalProps {
  visible: boolean;
  onClose: () => void;
  onImportarSucesso: (novaFamilia: Familia) => void;
}

export const ImportarFamiliaModal: React.FC<ImportarFamiliaModalProps> = ({
  visible,
  onClose,
  onImportarSucesso,
}) => {
  const [tipoInput, setTipoInput] = useState<'texto' | 'arquivo'>('texto');
  const [conteudoTexto, setConteudoTexto] = useState('');
  const [loading, setLoading] = useState(false);

  // Parser em tempo real para o visualizador (não quebra se o JSON estiver incompleto)
  const dadosPreview = useMemo(() => {
    if (!conteudoTexto.trim()) return null;
    try {
      const parsed = JSON.parse(conteudoTexto);
      return {
        nome: parsed.nome || 'Família sem nome',
        siglaSku: parsed.siglaSku || 'SIGLA',
        templateNomeComercial: parsed.templateNomeComercial || '{FAMILIA}',
        atributos: Array.isArray(parsed.atributos) ? parsed.atributos : [],
      };
    } catch {
      return null; // Enquanto o usuário digita e o JSON está malformado, oculta o preview ou mostra alerta suave
    }
  }, [conteudoTexto]);

  const processarImportacao = () => {
    if (!conteudoTexto.trim()) {
      message.error('Por favor, insira ou cole o conteúdo JSON.');
      return;
    }

    setLoading(true);
    try {
      let dados: any;
      try {
        dados = JSON.parse(conteudoTexto);
      } catch {
        throw new Error('O formato informado não é um JSON válido. Peça à IA para gerar um JSON.');
      }

      if (!dados.nome || !dados.siglaSku) {
        throw new Error('O JSON precisa conter ao menos "nome" e "siglaSku" da família.');
      }

      const novaFamilia: Familia = {
        id: dados.id || Date.now().toString(),
        nome: dados.nome,
        siglaSku: dados.siglaSku,
        separadorSku: dados.separadorSku || '-',
        templateNomeComercial: dados.templateNomeComercial || '{FAMILIA}',
        templateSku: dados.templateSku || '{SIGLA}{S}{VARIAÇÃO}',
        atributos: Array.isArray(dados.atributos) ? dados.atributos : [],
      };

      message.success(`Família "${novaFamilia.nome}" importada com sucesso!`);
      onImportarSucesso(novaFamilia);
      setConteudoTexto('');
      onClose();
    } catch (error: any) {
      message.error(error.message || 'Erro ao processar os dados importados.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = e.target?.result as string;
      if (texto) {
        setConteudoTexto(texto);
        message.success('Arquivo carregado com sucesso!');
      }
    };
    reader.onerror = () => {
      message.error('Erro ao ler o arquivo.');
    };
    reader.readAsText(file);
    return false;
  };

  return (
    <Modal
      title="Importação Rápida de Família por IA (JSON)"
      open={visible}
      onCancel={onClose}
      onOk={processarImportacao}
      confirmLoading={loading}
      okText="Criar Família"
      cancelText="Cancelar"
      width={850}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: '13px' }}>
          Peça para a IA gerar a estrutura da família em <b>JSON</b>, cole abaixo ou envie o arquivo, e acompanhe o preview em tempo real.
        </Typography.Paragraph>

        <Row gutter={16}>
          {/* Coluna da Esquerda: Inputs (Texto ou Arquivo) */}
          <Col xs={24} lg={14}>
            <Tabs
              activeKey={tipoInput}
              onChange={(key) => setTipoInput(key as 'texto' | 'arquivo')}
              items={[
                {
                  key: 'texto',
                  label: (
                    <span>
                      <CodeOutlined /> Colar JSON
                    </span>
                  ),
                  children: (
                    <Input.TextArea
                      rows={12}
                      placeholder={`Ex:\n{\n  "nome": "Abraçadeira de Nylon",\n  "siglaSku": "ABR",\n  "templateNomeComercial": "{FAMILIA} {COR}",\n  "atributos": [\n    { "id": 1, "nome": "Cor", "classificacao": "dna" }\n  ]\n}`}
                      value={conteudoTexto}
                      onChange={(e) => setConteudoTexto(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '12px', borderRadius: 8 }}
                    />
                  ),
                },
                {
                  key: 'arquivo',
                  label: (
                    <span>
                      <FileTextOutlined /> Enviar Arquivo
                    </span>
                  ),
                  children: (
                    <Upload.Dragger
                      beforeUpload={handleFileUpload}
                      maxCount={1}
                      showUploadList={false}
                      style={{ padding: '40px 0', borderRadius: 8 }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined style={{ color: '#0369a1' }} />
                      </p>
                      <p className="ant-upload-text">Clique ou arraste o JSON aqui</p>
                    </Upload.Dragger>
                  ),
                },
              ]}
            />
          </Col>

          {/* Coluna da Direita: Visualizador em Tempo Real */}
          <Col xs={24} lg={10}>
            <Card
              size="small"
              title={
                <Space size={6}>
                  <EyeOutlined style={{ color: '#1677ff' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Preview da Estrutura</span>
                </Space>
              }
              style={{ height: '100%', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}
              styles={{ body: { padding: '12px', maxHeight: '310px', overflowY: 'auto' } }}
            >
              {dadosPreview ? (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Nome da Família</Typography.Text>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{dadosPreview.nome}</div>
                  </div>

                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Sigla / Template SKU</Typography.Text>
                    <div><Tag color="blue">{dadosPreview.siglaSku}</Tag></div>
                  </div>

                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Template Comercial</Typography.Text>
                    <div style={{ fontSize: '12px', fontFamily: 'monospace', background: '#fff', padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                      {dadosPreview.templateNomeComercial}
                    </div>
                  </div>

                  <Divider style={{ margin: '8px 0' }} />

                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                      Atributos Mapeados ({dadosPreview.atributos.length})
                    </Typography.Text>
                    {dadosPreview.atributos.length > 0 ? (
                      <Space wrap size={[4, 4]}>
                        {dadosPreview.atributos.map((attr: any, idx: number) => {
                          const corTag = attr.classificacao === 'dna' ? 'blue' : attr.classificacao === 'grade' ? 'purple' : 'cyan';
                          return (
                            <Tag key={idx} color={corTag} style={{ margin: 0 }}>
                              {attr.nome} <span style={{ fontSize: '10px', opacity: 0.7 }}>({attr.classificacao || 'ficha'})</span>
                            </Tag>
                          );
                        })}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                        Nenhum atributo mapeado ainda.
                      </Typography.Text>
                    )}
                  </div>
                </Space>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                  <EyeOutlined style={{ fontSize: '24px', marginBottom: 8, opacity: 0.5 }} />
                  <div style={{ fontSize: '12px' }}>Aguardando JSON válido para gerar preview...</div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </Modal>
  );
};