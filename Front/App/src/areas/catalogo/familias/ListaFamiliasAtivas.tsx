import React from "react";
import { Card, Space, TreeSelect, Input, Empty, Button, Tag } from "antd";
import { STATUS_FAMILIA_CONFIG } from "./CatalogManager.types";
import { FolderOpenOutlined, PlusOutlined } from "@ant-design/icons";
import Swal from "sweetalert2";

// Tipos para as famílias e dados da árvore
interface Familia {
  id: string | number;
  nome: string;
  codigo?: string;
  status?: string;
  categoria?: string;
}

interface ArvoreNode {
  value: string | number;
  title: React.ReactNode;
  children?: ArvoreNode[];
}

interface ListaFamiliasAtivasProps {
  brandColor?: string;
  categoriaFiltroId: string | number | undefined;
  setCategoriaFiltroId: (value: string | number | undefined) => void;
  dadosArvoreAntd: ArvoreNode[];
  pesquisaFamilia: string;
  setPesquisaFamilia: (value: string) => void;
  familiasFiltradas: Familia[];
  familiasAgrupadas: Record<string, Familia[]>;
  grupoSelecionado: Familia | null;
  temAlteracoes?: boolean;
  handleSelecionarGrupo: (id: string | number) => void;
  handleCriarGrupo: () => void;
}

export default function ListaFamiliasAtivas({
  brandColor = "#1890ff",
  categoriaFiltroId,
  setCategoriaFiltroId,
  dadosArvoreAntd,
  pesquisaFamilia,
  setPesquisaFamilia,
  familiasFiltradas = [],
  familiasAgrupadas = {},
  grupoSelecionado,
  temAlteracoes = false,
  handleSelecionarGrupo,
  handleCriarGrupo,
}: ListaFamiliasAtivasProps) {
  return (
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
          body: { padding: "6px" },
        }}
      >
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          {/* Filtro por Categoria */}
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

          {/* Campo de Pesquisa */}
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

          {/* Lista de Famílias com Scroll */}
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
                              key={fam.id}
                              onClick={() => {
                                if (temAlteracoes) {
                                  Swal.fire({
                                    title: "Alterações não salvas",
                                    text: "Deseja descartar as alterações atuais e abrir outra família?",
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonText: "Sim, trocar",
                                    cancelButtonText: "Ficar aqui",
                                  }).then((res) => {
                                    if (res.isConfirmed) handleSelecionarGrupo(fam.id);
                                  });
                                } else {
                                  handleSelecionarGrupo(fam.id);
                                }
                              }}
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
                                {fam.status && fam.status !== 'ATIVO' && (
                                  <Tag
                                    color={STATUS_FAMILIA_CONFIG[fam.status as keyof typeof STATUS_FAMILIA_CONFIG]?.color}
                                    style={{ marginLeft: 6, fontSize: 9, padding: '0 4px', lineHeight: '14px' }}
                                  >
                                    {STATUS_FAMILIA_CONFIG[fam.status as keyof typeof STATUS_FAMILIA_CONFIG]?.label || fam.status}
                                  </Tag>
                                )}
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
                  )
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

          {/* Botão Nova Família */}
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
  );
}