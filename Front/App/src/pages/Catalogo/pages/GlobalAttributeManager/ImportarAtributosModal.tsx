import React, { useState, useMemo } from 'react';
import { Modal, Upload, Input, Button, Tabs, message, Space, Typography, Card, Tag, Divider, Row, Col } from 'antd';
import { InboxOutlined, FileTextOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';

interface ImportarAtributosModalProps {
  visible: boolean;
  onClose: () => void;
  onImportarSucesso: (dadosImportados: any) => void;
  gruposDisponiveis: any[];
}

export const ImportarAtributosModal: React.FC<ImportarAtributosModalProps> = ({
  visible,
  onClose,
  onImportarSucesso,
  gruposDisponiveis,
}) => {
  const [tipoInput, setTipoInput] = useState<'texto' | 'arquivo'>('texto');
  const [conteudoTexto, setConteudoTexto] = useState('');
  const [loading, setLoading] = useState(false);

  // Parser em tempo real para o preview
  const dadosPreview = useMemo(() => {
    if (!conteudoTexto.trim()) return null;
    try {
      const parsed = JSON.parse(conteudoTexto);
      return {
        nome: parsed.nome || 'Atributo sem nome',
        codigo: parsed.codigo || 'codigo_tecnico',
        tipo: parsed.tipo || 'texto',
        escopoPadrao: parsed.escopoPadrao || 'ficha',
        tipoComponenteUI: parsed.tipoComponenteUI || 'input',
        opcoesLista: Array.isArray(parsed.opcoesLista) ? parsed.opcoesLista : [],
      };
    } catch {
      return null;
    }
  }, [conteudoTexto]);

  const processarImportacao = () => {
    if (!conteudoTexto.trim()) {
      message.error('Por favor, insira ou cole o conteúdo JSON.');
      return;
    }

    setLoading(true);
    try {
      const dados = JSON.parse(conteudoTexto);
      if (!dados.nome || !dados.codigo) {
        throw new Error('O JSON precisa conter ao menos "nome" e "codigo" do atributo.');
      }

      message.success(`Atributo "${dados.nome}" importado com sucesso!`);
      onImportarSucesso(dados);
      setConteudoTexto('');
      onClose();
    } catch (error: any) {
      message.error(error.message || 'Erro ao processar os dados JSON.');
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
    reader.onerror = () => message.error('Erro ao ler o arquivo.');
    reader.readAsText(file);
    return false;
  };

  return (
    <Modal
      title="🧬 Importação Rápida de Atributo Global por IA (JSON)"
      open={visible}
      onCancel={onClose}
      onOk={processarImportacao}
      confirmLoading={loading}
      okText="Criar Atributo"
      cancelText="Cancelar"
      width={850}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: '13px' }}>
          Peça para a IA gerar a estrutura do atributo global em <b>JSON</b>, cole abaixo e acompanhe o preview em tempo real.
        </Typography.Paragraph>

        <Row gutter={16}>
          {/* Esquerda: Inputs */}
          <Col xs={24} lg={14}>
            <Tabs
              activeKey={tipoInput}
              onChange={(key) => setTipoInput(key as 'texto' | 'arquivo')}
              items={[
                {
                  key: 'texto',
                  label: <span><CodeOutlined /> Colar JSON</span>,
                  children: (
                    <Input.TextArea
                      rows={12}
                      placeholder={`Ex:\n{\n  "nome": "Tensão Elétrica",\n  "codigo": "tensao_eletrica",\n  "tipo": "lista",\n  "escopoPadrao": "dna",\n  "opcoesLista": [\n    { "chave": "110v", "valor": "110V" },\n    { "chave": "220v", "valor": "220V" }\n  ]\n}`}
                      value={conteudoTexto}
                      onChange={(e) => setConteudoTexto(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '12px', borderRadius: 8 }}
                    />
                  ),
                },
                {
                  key: 'arquivo',
                  label: <span><FileTextOutlined /> Enviar Arquivo</span>,
                  children: (
                    <Upload.Dragger beforeUpload={handleFileUpload} maxCount={1} showUploadList={false} style={{ padding: '40px 0', borderRadius: 8 }}>
                      <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#0369a1' }} /></p>
                      <p className="ant-upload-text">Clique ou arraste o JSON aqui</p>
                    </Upload.Dragger>
                  ),
                },
              ]}
            />
          </Col>

          {/* Direita: Visualizador em Tempo Real */}
          <Col xs={24} lg={10}>
            <Card
              size="small"
              title={
                <Space size={6}>
                  <EyeOutlined style={{ color: '#1677ff' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Preview do Atributo</span>
                </Space>
              }
              style={{ height: '100%', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}
              styles={{ body: { padding: '12px', maxHeight: '310px', overflowY: 'auto' } }}
            >
              {dadosPreview ? (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Nome Comercial</Typography.Text>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{dadosPreview.nome}</div>
                  </div>

                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px' }}>Código Técnico (Database)</Typography.Text>
                    <div><Tag color="geekblue" style={{ fontFamily: 'monospace' }}>{dadosPreview.codigo}</Tag></div>
                  </div>

                  <Space size={8}>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Tipo Físico</Typography.Text>
                      <Tag color="purple">{dadosPreview.tipo.toUpperCase()}</Tag>
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Escopo Padrão</Typography.Text>
                      <Tag color="magenta">{dadosPreview.escopoPadrao.toUpperCase()}</Tag>
                    </div>
                  </Space>

                  <Divider style={{ margin: '8px 0' }} />

                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                      Opções da Lista ({dadosPreview.opcoesLista.length})
                    </Typography.Text>
                    {dadosPreview.opcoesLista.length > 0 ? (
                      <Space wrap size={[4, 4]}>
                        {dadosPreview.opcoesLista.map((op: any, idx: number) => (
                          <Tag key={idx} color="cyan" style={{ margin: 0 }}>
                            {op.valor} <span style={{ fontSize: '10px', opacity: 0.7 }}>({op.chave})</span>
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                        Valor livre (sem opções fixas).
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