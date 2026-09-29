import React from "react";
import { Col, Card, Button, Table, Tooltip, Empty, Tag, Dropdown, MenuProps } from "antd";
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined, StarFilled, SwapOutlined } from "@ant-design/icons";

interface AtributosCardProps {
  titulo: string;
  cor: string;
  dataSource: any[];
  onOpenModal: () => void;
  onDelete?: (record: any) => void;
  onMover?: (record: any, novaClassificacao: string) => void;
  tooltipText?: string;
  onInfoClick?: () => void;
  emptyText: string;
  showDelete?: boolean;
}

export const AtributosCard: React.FC<AtributosCardProps> = ({
  titulo,
  cor,
  dataSource,
  onOpenModal,
  onDelete,
  onMover,
  tooltipText,
  onInfoClick,
  emptyText,
  showDelete = false,
}) => {
  // Gera o menu suspenso para escolher para onde mover o atributo de forma segura
  const criarMenuMover = (record: any): MenuProps => {
    // Identifica qual é a classificação atual baseada na prop ou define um fallback seguro
    const classificacaoAtual = record.classificacao || record.escopo_padrao || "ficha";

    const opcoes = [
      { key: "dna", label: "Mover para DNA" },
      { key: "grade", label: "Mover para Grade (Variação)" },
      { key: "ficha", label: "Mover para Ficha Técnica" },
    ].filter((op) => op.key !== classificacaoAtual);

    return {
      items: opcoes.map((op) => ({
        key: op.key,
        label: op.label,
        onClick: () => {
          if (onMover) {
            onMover(record, op.key);
          }
        },
      })),
    };
  };

  const columns = [
    {
      title: "Nome",
      dataIndex: "nome",
      key: "nome",
      render: (text: string, record: any) => {
        if (record.isMarcaSistema) {
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag 
                color="purple" 
                icon={<StarFilled style={{ fontSize: "10px" }} />}
                style={{ margin: 0, fontWeight: 600, fontSize: "11px" }}
              >
                MARCA (Sistema)
              </Tag>
            </div>
          );
        }

        return (
          <span style={{ fontWeight: 500, color: "#334155", fontSize: "12px" }}>
            {text} {record.codigo ? `(${record.codigo})` : ""}
          </span>
        );
      },
    },
    ...(showDelete
      ? [
          {
            title: "Ações",
            key: "acoes",
            width: 80,
            align: "right" as const,
            render: (_: any, record: any) => {
              if (record.isMarcaSistema) return null;

              return (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "2px" }}>
                  {/* Botão de Mover via Dropdown */}
                  <Dropdown menu={criarMenuMover(record)} trigger={["click"]}>
                    <Tooltip title="Mover atributo para outra seção">
                      <Button
                        type="text"
                        size="small"
                        icon={<SwapOutlined style={{ color: "#2563eb", fontSize: "12px" }} />}
                        onClick={(e) => e.stopPropagation()} // Evita propagação indesejada de clique
                      />
                    </Tooltip>
                  </Dropdown>

                  {/* Botão de Excluir */}
                  <Tooltip title="Excluir atributo">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined style={{ color: "#64748b", fontSize: "12px" }} />}
                      onClick={() => onDelete?.(record)}
                    />
                  </Tooltip>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
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
            {tooltipText && (
              <Tooltip title={tooltipText}>
                <InfoCircleOutlined
                  style={{ fontSize: "11px", color: "#64748b", cursor: "pointer" }}
                  onClick={onInfoClick}
                />
              </Tooltip>
            )}
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: cor,
              }}
            ></span>
            {titulo}
          </span>
        }
        extra={
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined style={{ fontSize: "11px" }} />}
            style={{
              color: cor,
              fontWeight: 600,
              height: 24,
              width: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={onOpenModal}
          />
        }
      >
        <Table
          size="small"
          dataSource={dataSource}
          columns={columns}
          rowKey={(record, index) => record.id || record.codigo || `attr-${index}`}
          pagination={false}
          rowClassName={(record: any) => (record.isMarcaSistema ? "linha-marca-sistema" : "")}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                    {emptyText}
                  </span>
                }
              />
            ),
          }}
        />
      </Card>
      
      <style>{`
        .linha-marca-sistema {
          background-color: #faf5ff !important;
        }
        .linha-marca-sistema:hover > td {
          background-color: #f3e8ff !important;
        }
      `}</style>
    </Col>
  );
};