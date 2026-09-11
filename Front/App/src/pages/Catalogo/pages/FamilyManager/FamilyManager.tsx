// FamilyManager.tsx
import React, { useMemo } from "react";
import {
  TreeSelect,
  Input,
  Row,
  Col,
  Card,
  Typography,
  Space,
  Button,
  Alert,
  Tooltip,
  Table,
  Tag,
  Empty,
  Badge,
  Form,
  Modal,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  ShoppingCartOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import Swal from "sweetalert2";

// Hook desacoplado
import { useCatalogState } from "./useCatalogState";

// Importações dos helpers
import {
  gerarPreviewSku,
  gerarPreviewNome,
  construirArvoreAntd,
} from "./CatalogManager.helpers";

// Componentes externos
import { PainelSimulador } from "./components/PainelSimulador";
import ImageDisplay from "../../../../components/ui/ImageGallery/ImageDysplay";
import { ImportarFamiliaModal } from "./ImportarFamiliaModal";
import { AttributeGuideModal } from "./guide/AttributeGuideModal";

const { Title, Text } = Typography;

export const FamilyManager: React.FC = () => {
  // Instância do formulário do Ant Design para o Modal de Pendências
  const [formPendencia] = Form.useForm();

  const {
    grupoSelecionado,
    categorias,
    previewSkuSimulado,
    previewNomeSimulado,
    grupoImage,
    loading,
    error,
    isModalAberto,
    setIsModalAberto,
    handleSelecionarGrupo,
    handleCriarGrupo,
    handleSalvarGrupoNoBanco,
    handleAbrirModal,
    tabelaAlvoModal,
    brandColor,
    itensFiltradosDoGrupo,
    pesquisaItem,
    setPesquisaItem,
    familiasFiltradas,
    pesquisaFamilia,
    setPesquisaFamilia,
    familiasAgrupadas,
    categoriaFiltroId,
    setCategoriaFiltroId,
    setIsImportModalOpen,
    isImportModalOpen,
    isModalOpen,
    setIsModalOpen,
    guideTab,
    handleCloseGuideModal,
    valoresTeste,
    onMudancaValorTeste,
    onAtualizarTemplateComercial,
    onAtualizarTemplateSku,
    onAtualizarSiglaSku,
    onAtualizarSeparadorSku,
    onAtualizarOrdemSku,
    itensDaFamilia,
    carregandoItens,
    setItensDaFamilia,
    setGrupoSelecionadoId,
    handlePadronizarNomesFamilia,
    handlePadronizarSkusFamilia,
    isModalPendenciaOpen,
    setIsModalPendenciaOpen,
    atributosPendentes,
    // Funções e estados de normalização individual adicionados aqui:
    handleTentarNormalizarIndividual,
    handleNormalizarItemSku,
    handleNormalizarItemNome,
    handleSalvarAtributosPendentes,
    itemEmEdicaoPendencia,
    modalFormalizacaoAberto,
    setModalFormalizacaoAberto,
    itensPendentesFormalizacao,
    setItensPendentesFormalizacao,
    handleProcessarFormalizacaoLote,
    handleAtualizarAtributoItemPendente,
    handleSalvarEContinuarFormalizacao,
  } = useCatalogState();

  const dadosArvoreAntd = useMemo(() => {
    return construirArvoreAntd(categorias);
  }, [categorias]);

  const atributosDNA = useMemo(() => {
    return grupoSelecionado
      ? grupoSelecionado.atributos.filter((attr) => attr.classificacao === "dna")
      : [];
  }, [grupoSelecionado]);

  const atributosVariacao = useMemo(() => {
    return grupoSelecionado
      ? grupoSelecionado.atributos.filter((attr) => attr.classificacao === "grade")
      : [];
  }, [grupoSelecionado]);

  const atributosFichaTecnica = useMemo(() => {
    return grupoSelecionado
      ? grupoSelecionado.atributos.filter((attr) => attr.classificacao === "ficha")
      : [];
  }, [grupoSelecionado]);

  const handleNovaFamiliaImportada = (novaFamilia: any) => {
    if (novaFamilia?.id) {
      setGrupoSelecionadoId(novaFamilia.id);
    }
  };

  const handleExcluirAtributo = (tipo: string, record: any) => {
    Swal.fire({
      title: "Excluir Atributo?",
      text: `Deseja remover o atributo "${record.nome}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#637381",
      confirmButtonText: "Sim, excluir!",
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire("Excluído!", "Atributo removido com sucesso.", "success");
      }
    });
  };

  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        padding: "8px 12px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Header unificado estilo SaaS */}
      <Card
        bordered={false}
        style={{
          marginBottom: 8,
          borderRadius: 10,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
        }}
      >
        <Row align="middle" justify="space-between" gutter={[8, 8]}>
          <Col>
            <Space direction="vertical" size={1}>
              <Tooltip
                title={
                  <Space size={8}>
                    <Badge status={loading ? "processing" : "success"} />
                    <Text type="secondary" style={{ fontSize: "13px" }}>
                      {loading
                        ? "Sincronizando com o banco..."
                        : "Banco de dados sincronizado e pronto"}
                    </Text>
                  </Space>
                }
              >
                <Title
                  level={3}
                  style={{ margin: 0, fontWeight: 760, letterSpacing: "-0.02em" }}
                >
                  Gerenciamento de Família PIM
                </Title>
              </Tooltip>
            </Space>
            <Tag color="processing" style={{ marginTop: 4 }}>
              Família: {grupoSelecionado?.nome || "Nenhuma"}
            </Tag>
          </Col>

          <Col>
            <Space size={8}>
              <Button
                type="primary"
                ghost
                onClick={() => setIsImportModalOpen(true)}
                style={{ fontWeight: 600 }}
              >
                ✨ Importar Família por IA
              </Button>

              <Button type="default" onClick={handlePadronizarNomesFamilia}>
                Padronizar Nomes da Família
              </Button>

              <Button type="default" onClick={handlePadronizarSkusFamilia}>
                Padronizar SKUs da Família
              </Button>
            </Space>
          </Col>

          <Col>
            <Space size={12}>
              <Button
                type="default"
                size="large"
                onClick={handleCriarGrupo}
                loading={loading}
                icon={<PlusOutlined />}
                style={{ borderRadius: 8, fontWeight: 500 }}
              >
                Nova Família
              </Button>
              {grupoSelecionado && (
                <Button
                  type="primary"
                  size="large"
                  onClick={handleSalvarGrupoNoBanco}
                  loading={loading}
                  style={{
                    backgroundColor: brandColor,
                    borderColor: brandColor,
                    borderRadius: 8,
                    fontWeight: 500,
                  }}
                >
                  Salvar Alterações
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Falha de Sincronização"
          description={error}
          style={{ marginBottom: 24, borderRadius: 8 }}
          action={
            <Button size="small" danger onClick={() => window.location.reload()}>
              Recarregar
            </Button>
          }
        />
      )}

      <Row gutter={[12, 12]}>
        {/* Coluna 1: Famílias Ativas */}
        <Col xs={24} md={6} lg={4}>
          <Card
            title={
              <Space size={8}>
                <FolderOpenOutlined style={{ color: brandColor }} />
                <span style={{ fontWeight: 700, fontSize: "14px" }}>
                  Famílias Ativas
                </span>
              </Space>
            }
            style={{
              borderRadius: 12,
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
            }}
            styles={{
              header: { borderBottom: "1px solid #f1f5f9" },
              body: { padding: "12px" },
            }}
          >
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ width: "100%" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#64748b",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Filtrar por Categoria:
                </span>
                <TreeSelect
                  style={{ width: "100%" }}
                  value={categoriaFiltroId}
                  onChange={(val) => setCategoriaFiltroId(val)}
                  treeData={[
                    { value: "TODAS", title: "📂 Todas as Categorias" },
                    ...(dadosArvoreAntd || []),
                  ]}
                  placeholder="Selecionar Categoria..."
                  treeDefaultExpandAll={false}
                  allowClear
                  showSearch
                  treeNodeFilterProp="title"
                />
              </div>

              <Input.Search
                placeholder="Buscar família..."
                value={pesquisaFamilia}
                onChange={(e) => setPesquisaFamilia(e.target.value)}
                allowClear
                enterButton={false}
                style={{ borderRadius: 6 }}
              />

              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid #f1f5f9",
                  margin: "4px 0",
                }}
              />

              <div
                style={{
                  maxHeight: "380px",
                  overflowY: "auto",
                  paddingRight: "4px",
                }}
              >
                {familiasFiltradas.length > 0 ? (
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    {Object.entries(familiasAgrupadas).map(
                      ([categoria, listaFamilias]) => (
                        <div key={categoria}>
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#94a3b8",
                              textTransform: "uppercase",
                              marginBottom: "6px",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {categoria} ({listaFamilias.length})
                          </div>

                          <Space
                            direction="vertical"
                            size={6}
                            style={{ width: "100%" }}
                          >
                            {listaFamilias.map((fam) => {
                              const estaSelecionado = fam.id === grupoSelecionado?.id;
                              return (
                                <div
                                  key={fam.id} // <--- A chave DEVE ficar aqui no elemento raiz do loop
                                  onClick={() => handleSelecionarGrupo(fam.id)}
                                  style={{
                                    padding: "10px 12px",
                                    backgroundColor: estaSelecionado ? "#f0f7ff" : "#f8fafc",
                                    borderRadius: "8px",
                                    border: estaSelecionado ? `1px solid ${brandColor}` : "1px solid #e2e8f0",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                  }}
                                >
                                 <span style={{ fontWeight: 600, fontSize: "12px", color: "#1e293b", display: "block" }}>
    {fam.nome}
  </span>
  {fam.codigo && (
    <span style={{ fontSize: "10px", color: "#64748b", fontFamily: "monospace" }}>
      Código: {fam.codigo}
    </span>
  )}
                                </div>
                              );
                            })}
                          </Space>
                        </div>
                      ),
                    )}
                  </Space>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span style={{ fontSize: "12px" }}>
                        Nenhuma família encontrada
                      </span>
                    }
                  />
                )}
              </div>

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                style={{
                  borderColor: brandColor,
                  color: brandColor,
                  borderRadius: 8,
                  marginTop: "4px",
                }}
                onClick={handleCriarGrupo}
              >
                Nova Família
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Coluna 2: Configuração Central */}
        <Col xs={24} md={18} lg={15}>
          {grupoSelecionado ? (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Row gutter={[8, 8]}>
                {/* 1. Identidade da Família */}
                <Col xs={24} lg={10}>
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
                      <Tooltip title="Editar Identidade">
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
                          onClick={() =>
                            handleAbrirModal && handleAbrirModal("dna")
                          }
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
                            CEST PADRÃO
                          </Text>
                          <Text
                            style={{
                              color: "#334155",
                              fontSize: "11px",
                              fontFamily: "monospace",
                            }}
                          >
                            {grupoSelecionado?.cestPadrao || "Não informado"}
                          </Text>
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Col>

                {/* 2. Painel do Simulador Unificado */}
                <Col xs={24} lg={14}>
                  <PainelSimulador
                    familiaSelecionada={grupoSelecionado}
                    valoresTeste={valoresTeste}
                    onMudancaValorTeste={onMudancaValorTeste}
                    onAtualizarTemplateComercial={onAtualizarTemplateComercial}
                    onAtualizarTemplateSku={onAtualizarTemplateSku}
                    onAtualizarSiglaSku={onAtualizarSiglaSku}
                    onAtualizarSeparadorSku={onAtualizarSeparadorSku}
                    onAtualizarOrdemSku={onAtualizarOrdemSku}
                    previewNomeSimulado={previewNomeSimulado}
                    previewSkuSimulado={previewSkuSimulado}
                    brandColor={brandColor}
                    itensDaFamilia={itensDaFamilia}
                    carregandoItens={carregandoItens}
                  />
                </Col>
              </Row>

           <Row gutter={[16, 16]} align="stretch">
  {/* Tabelas de Atributos */}
  <Col span={24}>
    <Row gutter={[16, 16]} align="stretch">
      
      {/* Atributos DNA */}
      <Col xs={24} lg={8}>
        <Card
          style={{
            height: "100%",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.01)",
            display: "flex",
            flexDirection: "column",
          }}
          styles={{
            header: {
              borderBottom: "1px solid #f1f5f9",
              minHeight: "38px",
              background: "#f8fafc",
              borderRadius: "10px 10px 0 0",
              padding: "0 12px",
            },
            body: {
              padding: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            },
          }}
          title={
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Tooltip title="Atributos DNA compõem o SKU do item.">
                <InfoCircleOutlined
                  style={{ fontSize: "11px", color: "#64748b" }}
                />
              </Tooltip>
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: brandColor || "#1677ff",
                }}
              ></span>
              Atributos DNA
            </span>
          }
          extra={
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: "11px" }} />}
              style={{
                color: brandColor,
                fontWeight: 600,
                height: 24,
                width: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => handleAbrirModal("dna")}
            />
          }
        >
          <Table
            size="small"
            dataSource={atributosDNA}
            columns={[
              {
                title: "Nome",
                dataIndex: "nome",
                key: "nome",
                render: (text: string) => (
                  <span
                    style={{
                      fontWeight: 500,
                      color: "#334155",
                      fontSize: "12px",
                    }}
                  >
                    {text}
                  </span>
                ),
              },
              {
                title: "Ações",
                key: "acoes",
                width: 60,
                align: "right" as const,
                render: (_: any, record: any) => (
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <DeleteOutlined
                        style={{ color: "#64748b", fontSize: "12px" }}
                      />
                    }
                    onClick={() =>
                      handleExcluirAtributo("dna", record)
                    }
                  />
                ),
              },
            ]}
            rowKey="id"
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      Nenhum atributo DNA
                    </span>
                  }
                />
              ),
            }}
          />
        </Card>
      </Col>

      {/* Atributos Variação (Grade) */}
      <Col xs={24} lg={8}>
        <Card
          style={{
            height: "100%",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.01)",
            display: "flex",
            flexDirection: "column",
          }}
          styles={{
            header: {
              borderBottom: "1px solid #f1f5f9",
              minHeight: "38px",
              background: "#f8fafc",
              borderRadius: "10px 10px 0 0",
              padding: "0 12px",
            },
            body: {
              padding: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            },
          }}
          title={
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#9333ea",
                }}
              ></span>
              Atributos de Variação (Grade)
            </span>
          }
          extra={
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: "11px" }} />}
              style={{
                color: "#9333ea",
                fontWeight: 600,
                height: 24,
                width: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => handleAbrirModal("grade")}
            />
          }
        >
          <Table
            size="small"
            dataSource={atributosVariacao}
            columns={[
              {
                title: "Nome",
                dataIndex: "nome",
                key: "nome",
                render: (text: string) => (
                  <span
                    style={{
                      fontWeight: 500,
                      color: "#334155",
                      fontSize: "12px",
                    }}
                  >
                    {text}
                  </span>
                ),
              },
            ]}
            rowKey="id"
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      Nenhum atributo de variação
                    </span>
                  }
                />
              ),
            }}
          />
        </Card>
      </Col>

      {/* Atributos Ficha Técnica */}
      <Col xs={24} lg={8}>
        <Card
          style={{
            height: "100%",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.01)",
            display: "flex",
            flexDirection: "column",
          }}
          styles={{
            header: {
              borderBottom: "1px solid #f1f5f9",
              minHeight: "38px",
              background: "#f8fafc",
              borderRadius: "10px 10px 0 0",
              padding: "0 12px",
            },
            body: {
              padding: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            },
          }}
          title={
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#0891b2",
                }}
              ></span>
              Atributos de Ficha Técnica
            </span>
          }
          extra={
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined style={{ fontSize: "11px" }} />}
              style={{
                color: "#0891b2",
                fontWeight: 600,
                height: 24,
                width: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => handleAbrirModal("ficha")}
            />
          }
        >
          <Table
            size="small"
            dataSource={atributosFichaTecnica}
            columns={[
              {
                title: "Nome",
                dataIndex: "nome",
                key: "nome",
                render: (text: string) => (
                  <span
                    style={{
                      fontWeight: 500,
                      color: "#334155",
                      fontSize: "12px",
                    }}
                  >
                    {text}
                  </span>
                ),
              },
            ]}
            rowKey="id"
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      Nenhum atributo de ficha técnica
                    </span>
                  }
                />
              ),
            }}
          />
        </Card>
      </Col>

    </Row>
  </Col>
</Row>
            </Space>
          ) : (
            <Card
              style={{
                borderRadius: 10,
                textAlign: "center",
                padding: "60px 0",
                border: "1px dashed #cbd5e1",
                background: "#fafafa",
              }}
            >
              <Empty
                description={
                  <span style={{ color: "#64748b", fontSize: "12px" }}>
                    Selecione ou crie uma família na barra lateral para começar a configurar.
                  </span>
                }
              />
            </Card>
          )}
        </Col>


   {/* Coluna 3: Itens da Família */}
<Col xs={24} md={18} lg={5}>
  <Card
    title={
      <Space size={8}>
        <ShoppingCartOutlined style={{ color: brandColor || "#1677ff" }} />
        <span style={{ fontWeight: 700, fontSize: "14px" }}>
          Itens da Família
        </span>
      </Space>
    }
    style={{
      borderRadius: 10,
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
      height: "100%",
    }}
    styles={{
      header: {
        borderBottom: "1px solid #f1f5f9",
        background: "#f8fafc",
        borderRadius: "10px 10px 0 0",
        minHeight: "38px",
        padding: "0 12px",
      },
      body: { padding: "12px" },
    }}
  >
    {grupoSelecionado ? (
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Input
          size="small"
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          placeholder="Filtrar SKU ou nome..."
          value={pesquisaItem}
          onChange={(e) => setPesquisaItem(e.target.value)}
          allowClear
          style={{ borderRadius: 6 }}
        />

        <div
          style={{
            maxHeight: "360px",
            overflowY: "auto",
            paddingRight: "6px",
          }}
        >
          {(itensFiltradosDoGrupo ?? []).length > 0 ? (
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {(itensFiltradosDoGrupo ?? []).map((item) => {
                const skuEsperado = typeof gerarPreviewSku === 'function' ? gerarPreviewSku(grupoSelecionado, grupoSelecionado.atributos || [], item.valoresAtributos || {}) : item.sku;
                
                const nomeProcessado = typeof gerarPreviewNome === 'function' ? gerarPreviewNome(grupoSelecionado, item.valoresAtributos || {}) : item.nome;
                const nomeEsperado = nomeProcessado && !nomeProcessado.includes('[') ? nomeProcessado : item.nome;

                // Verificação de Atributos Ausentes / Faltantes
                const atributosObrigatorios = grupoSelecionado?.atributos || [];
                const possuiAtributosFaltantes = atributosObrigatorios.some((attr) => {
                  const valor = item.valoresAtributos?.[attr.id || attr.nome];
                  return !valor || String(valor).trim() === "";
                });

                const divergenciaSku = Boolean(skuEsperado && item.sku !== skuEsperado);
                const divergenciaNome = Boolean(nomeEsperado && item.nome !== nomeEsperado);

                let tipoDivergencia = null;
                if (possuiAtributosFaltantes) {
                  tipoDivergencia = "Atributos não formalizados";
                } else if (divergenciaSku && divergenciaNome) {
                  tipoDivergencia = "SKU e Nome divergentes";
                } else if (divergenciaSku) {
                  tipoDivergencia = "SKU divergente";
                } else if (divergenciaNome) {
                  tipoDivergencia = "Nome divergente";
                }

                const temAlerta = Boolean(tipoDivergencia);

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px",
                      backgroundColor: temAlerta ? "#fffbeb" : "#ffffff",
                      borderRadius: "8px",
                      border: `1px solid ${temAlerta ? "#fde68a" : "#e2e8f0"}`,
                      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.02)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Barra lateral indicadora de status (Vermelho/Amarelo se pendente, Verde se OK) */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: "4px",
                        backgroundColor: possuiAtributosFaltantes ? "#ef4444" : (temAlerta ? "#d97706" : "#22c55e"),
                      }}
                    />

                    {/* Cabeçalho do Item: SKU, Tag de Alerta e Engrenagem */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingLeft: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "12px",
                          color: "#0f172a",
                          fontFamily: "monospace",
                        }}
                      >
                        {item.sku}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {temAlerta && (
                          <span
                            style={{
                              fontSize: "10px",
                              backgroundColor: possuiAtributosFaltantes ? "#fee2e2" : "#fef3c7",
                              color: possuiAtributosFaltantes ? "#991b1b" : "#b45309",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              fontWeight: 600,
                              border: `1px solid ${possuiAtributosFaltantes ? "#fca5a5" : "#fcd34d"}`,
                            }}
                          >
                            {tipoDivergencia}
                          </span>
                        )}

                        {/* Engrenagem para alterar atributos do item */}
                        <Tooltip title="Alterar atributos do item">
                          <Button
                            type="text"
                            size="small"
                            icon={<SettingOutlined style={{ fontSize: "13px", color: "#64748b" }} />}
                            style={{
                              height: 22,
                              width: 22,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                            }}
                            onClick={() => {
                              if (typeof handleEditarAtributosItem === 'function') {
                                handleEditarAtributosItem(item);
                              } else {
                                Swal.fire("Editar Atributos", `Abrir configuração de atributos para o SKU: ${item.sku}`, "info");
                              }
                            }}
                          />
                        </Tooltip>
                      </div>
                    </div>

                    {/* Nome do Produto */}
                    <div style={{ paddingLeft: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span
                        style={{
                          fontSize: "11.5px",
                          color: "#334155",
                          lineHeight: "1.4",
                          fontWeight: 500,
                        }}
                      >
                        Prod: {item.nome || item.nomeItem || item.nomeComercial || "Produto sem nome"}
                      </span>
                    </div>

                    {/* Botões de Ação na base do Card do Item (se houver divergência de nome/SKU e atributos estiverem preenchidos) */}
                    {temAlerta && !possuiAtributosFaltantes && (
                      <div
                        style={{
                          marginTop: "4px",
                          paddingTop: "8px",
                          borderTop: "1px dashed #fde68a",
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "4px",
                        }}
                      >
                        <Button
                          size="small"
                          type="default"
                          style={{
                            fontSize: "10px",
                            padding: "0 2px",
                            height: "24px",
                            color: "#b45309",
                            borderColor: "#fcd34d",
                            backgroundColor: "#fff",
                          }}
                          onClick={() => handleNormalizarItemNome(item)}
                        >
                          Corrigir Nome
                        </Button>

                        <Button
                          size="small"
                          type="default"
                          style={{
                            fontSize: "10px",
                            padding: "0 2px",
                            height: "24px",
                            color: "#b45309",
                            borderColor: "#fcd34d",
                            backgroundColor: "#fff",
                          }}
                          onClick={() => handleNormalizarItemSku(item)}
                        >
                          Corrigir SKU
                        </Button>

                        <Button
                          size="small"
                          type="primary"
                          style={{
                            fontSize: "10px",
                            padding: "0 2px",
                            height: "24px",
                            backgroundColor: "#d97706",
                            borderColor: "#d97706",
                          }}
                          onClick={() => handleTentarNormalizarIndividual(item)}
                        >
                          Padronizar Ambos
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </Space>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Nenhum SKU encontrado
                </span>
              }
            />
          )}
        </div>

        {/* Botões de Ação em Lote na base do Card */}
        <Space direction="vertical" size={8} style={{ width: "100%", marginTop: "4px" }}>
          <Button
            type="dashed"
            size="small"
            block
            icon={<ThunderboltOutlined />}
            style={{
              borderColor: brandColor,
              color: brandColor,
              borderRadius: 6,
              height: "30px",
            }}
            onClick={handleProcessarFormalizacaoLote}
          >
            Formalizar / Gerar Lote SKU
          </Button>

          <Button
            type="default"
            size="small"
            block
            onClick={handlePadronizarNomesFamilia}
            style={{ height: "28px" }}
          >
            Padronizar Nomes da Família (Lote)
          </Button>

          <Button
            type="default"
            size="small"
            block
            onClick={handlePadronizarSkusFamilia}
            style={{ height: "28px" }}
          >
            Padronizar SKUs da Família (Lote)
          </Button>
        </Space>
      </Space>
    ) : (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Selecione uma família para ver os itens
          </span>
        }
      />
    )}
  </Card>
</Col>


      </Row>

      {/* Modais auxiliares */}
      <ImportarFamiliaModal
        visible={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportarSucesso={handleNovaFamiliaImportada}
      />

      <Modal
        title="⚠️ Atributos Pendentes para Normalização"
        open={isModalPendenciaOpen}
        onCancel={() => setIsModalPendenciaOpen(false)}
        onOk={() => {
          formPendencia.validateFields().then((values) => {
            handleSalvarAtributosPendentes(values);
            Swal.fire("Sucesso!", "Atributos preenchidos e item normalizado.", "success");
          });
        }}
        okText="Salvar e Normalizar"
        cancelText="Cancelar"
      >
        <Alert
          message="Atenção"
          description="Existem atributos obrigatórios utilizados no template de SKU ou Nome que estão sem valor para este item. Preencha-os abaixo para prosseguir:"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={formPendencia} layout="vertical">
          {(atributosPendentes ?? []).map((attr) => (
            <Form.Item
              key={attr.id}
              name={attr.id}
              label={attr.nome || attr.label}
              rules={[{ required: true, message: `O campo ${attr.nome || attr.label} é obrigatório!` }]}
              initialValue={itemEmEdicaoPendencia?.valoresAtributos?.[attr.id] || ""}
            >
              <Input placeholder={`Digite o valor para ${attr.nome || attr.label}...`} />
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* Modal Modular Único para preenchimento de Atributos Pendentes em Lote */}
<Modal
  title={
    <Space>
      <ThunderboltOutlined style={{ color: brandColor || "#1677ff" }} />
      <span>Formalização de Itens - Atributos Pendentes</span>
    </Space>
  }
  open={modalFormalizacaoAberto}
  onCancel={() => setModalFormalizacaoAberto(false)}
  onOk={handleSalvarEContinuarFormalizacao}
  okText="Salvar e Concluir Lote"
  cancelText="Cancelar"
  width={650}
  destroyOnClose
>
  <div style={{ marginBottom: "12px", fontSize: "13px", color: "#64748b" }}>
    Identificamos itens na família <strong>{grupoSelecionado?.nome}</strong> que possuem atributos obrigatórios não preenchidos. Por favor, ajuste abaixo para concluir a formalização:
  </div>

  <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {(itensPendentesFormalizacao || []).map((item, index) => (
        <div
          key={item.id || index}
          style={{
            padding: "12px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "12px", color: "#0f172a", fontFamily: "monospace" }}>
              SKU: {item.sku || `Item #${index + 1}`}
            </span>
            <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600 }}>
              Atributos incompletos
            </span>
          </div>

          <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500 }}>
            {item.nome}
          </span>

          {/* Renderização dinâmica dos campos/atributos exigidos pela família para este item */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "4px" }}>
            {(grupoSelecionado?.atributos || []).map((attr) => {
              const valorAtual = item.valoresAtributos?.[attr.id || attr.nome] || "";
              return (
                <div key={attr.id || attr.nome} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#475569" }}>
                    {attr.nome}:
                  </label>
                  <Input
                    size="small"
                    placeholder={`Preencher ${attr.nome}`}
                    defaultValue={valorAtual}
                    onChange={(e) => {
                      // Atualiza de forma reativa no estado temporário do item pendente
                      handleAtualizarAtributoItemPendente(item.id, attr.id || attr.nome, e.target.value);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Space>
  </div>
</Modal>

      <AttributeGuideModal
        visible={isModalOpen}
        onClose={handleCloseGuideModal}
        defaultTab={guideTab}
      />
    </div>
  );
};