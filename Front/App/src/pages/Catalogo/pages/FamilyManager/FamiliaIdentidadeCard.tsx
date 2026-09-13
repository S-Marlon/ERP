import React, { useState, useEffect } from 'react';
import { Card, Col, Space, Button, Tooltip, Typography, Tag, Modal, Form, Input, Select, Tabs } from 'antd';
import { EditOutlined, DollarOutlined, FileTextOutlined, InfoCircleOutlined, InboxOutlined } from '@ant-design/icons';
import ImageDisplay from '../../../../components/ui/ImageGallery/ImageDysplay';

const { Text } = Typography;

interface FamiliaIdentidadeCardProps {
  grupoSelecionado?: {
    nome?: string;
    unidadeMedidaBase?: string;
    tipoItem?: string;
    ncmPadrao?: string;
    cestPadrao?: string;
    margemMinima?: number | string;
    margemMaxima?: number | string;
    markupPadrao?: number | string;
    estoqueMinimo?: number | string;
    loteMinimo?: number | string;
    curvaAbc?: string;
  };
  grupoImage?: string;
  brandColor?: string;
  onSalvarIdentidade?: (valores: any) => void; 
}

export const FamiliaIdentidadeCard: React.FC<FamiliaIdentidadeCardProps> = ({
  grupoSelecionado,
  grupoImage,
  brandColor,
  onSalvarIdentidade,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Atualiza os campos do formulário sempre que o grupo selecionado mudar
  useEffect(() => {
    if (grupoSelecionado) {
      form.setFieldsValue({
        nome: grupoSelecionado.nome,
        unidadeMedidaBase: grupoSelecionado.unidadeMedidaBase,
        tipoItem: grupoSelecionado.tipoItem,
        ncmPadrao: grupoSelecionado.ncmPadrao,
        cestPadrao: grupoSelecionado.cestPadrao,
        margemMinima: grupoSelecionado.margemMinima,
        margemMaxima: grupoSelecionado.margemMaxima,
        markupPadrao: grupoSelecionado.markupPadrao,
        estoqueMinimo: grupoSelecionado.estoqueMinimo,
        loteMinimo: grupoSelecionado.loteMinimo,
        curvaAbc: grupoSelecionado.curvaAbc,
      });
    }
  }, [grupoSelecionado, form]);

  const handleAbrirModalLocal = () => {
    setIsModalOpen(true);
  };

  const handleFecharModal = () => {
    setIsModalOpen(false);
  };

  const handleSalvar = () => {
    form.validateFields().then((values) => {
      if (onSalvarIdentidade) {
        onSalvarIdentidade(values);
      }
      setIsModalOpen(false);
    }).catch((info) => {
      console.log('Validate Failed:', info);
    });
  };

  return (
    <>
        <Card
          title={
            <Space size={6}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: brandColor || "#1677ff",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                Identidade da Família
              </span>
            </Space>
          }
          size="small"
          style={{
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.01)",
            height: "100%",
          }}
          styles={{
            header: {
              borderBottom: "1px solid #f1f5f9",
              minHeight: "38px",
              background: "#f8fafc",
              borderRadius: "10px 10px 0 0",
              padding: "0 10px",
            },
            body: { padding: "12px" },
          }}
          extra={
            <Tooltip title="Editar Identidade e Regras">
              <Button
                type="text"
                size="small"
                icon={
                  <EditOutlined
                    style={{
                      fontSize: "12px",
                      color: brandColor || "#1677ff",
                    }}
                  />
                }
                onClick={handleAbrirModalLocal}
              />
            </Tooltip>
          }
        >
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Space size={10} align="center">
              <ImageDisplay
                size="40px"
                src={grupoImage || undefined}
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                }}
              />
              <div>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  NOME DA FAMÍLIA
                </Text>
                <Text
                  style={{
                    color: "#0f172a",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {grupoSelecionado?.nome || "Sem nome"}
                </Text>
              </div>
            </Space>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                paddingTop: "6px",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <div>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  UNIDADE BASE
                </Text>
                <Tag style={{ margin: 0, fontSize: "11px", fontWeight: 600 }}>
                  {grupoSelecionado?.unidadeMedidaBase || "PC"}
                </Tag>
              </div>
              <div>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  TIPO SPED
                </Text>
                <Tag
                  color="blue"
                  style={{ margin: 0, fontSize: "11px", fontWeight: 600 }}
                >
                  {grupoSelecionado?.tipoItem || "PA"}
                </Tag>
              </div>
              <div>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  NCM PADRÃO
                </Text>
                <Text
                  style={{
                    color: "#334155",
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                >
                  {grupoSelecionado?.ncmPadrao || "Não informado"}
                </Text>
              </div>
              <div>
                <Text
                  style={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    display: "block",
                    fontWeight: 600,
                  }}
                >
                  ESTOQUE MÍN.
                </Text>
                <Text
                  style={{
                    color: "#334155",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {grupoSelecionado?.estoqueMinimo || "Não def."}
                </Text>
              </div>
            </div>
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
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: '12px' }}>
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: '1',
                label: (
                  <span>
                    <InfoCircleOutlined />
                    Identidade
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <Form.Item
                      name="nome"
                      label="Nome da Família"
                      rules={[{ required: true, message: 'Por favor, insira o nome da família!' }]}
                    >
                      <Input placeholder="Ex: Camiseta Básica" />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <Form.Item name="unidadeMedidaBase" label="Unidade Base">
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
                      * Esses valores serão herdados por padrão para os SKUs filhos gerados nesta família.
                    </Text>
                  </div>
                ),
              },
              {
                key: '3',
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
                key: '4',
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