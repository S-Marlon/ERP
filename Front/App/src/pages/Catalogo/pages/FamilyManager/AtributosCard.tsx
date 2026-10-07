import React from "react";
import { Card, Button, Table, Tooltip, Empty, Tag, Dropdown, MenuProps, Switch, InputNumber, Input, Select } from "antd";
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined, StarFilled, SwapOutlined } from "@ant-design/icons";

export type PapelAtributo = "dna" | "grade" | "ficha";

interface AtributosCardProps {
  titulo: string;
  cor: string;
  papel: PapelAtributo;
  dataSource: any[];
  onOpenModal: () => void;
  onDelete?: (record: any) => void;
  onMover?: (record: any, novaClassificacao: string) => void;
  // Configuração do atributo na família (as 3 perguntas: papel, entra no código, obrigatório)
  onAlterar?: (record: any, patch: Record<string, unknown>) => void;
  tooltipText?: string;
  onInfoClick?: () => void;
  emptyText: string;
  showDelete?: boolean;
}

const PAPEIS: { key: PapelAtributo; label: string }[] = [
  { key: "dna", label: "Mover para DNA (igual em todos os itens)" },
  { key: "grade", label: "Mover para Grade (muda de item para item)" },
  { key: "ficha", label: "Mover para Ficha Técnica (informativo)" },
];

// Herdado da categoria ou atributo de sistema (marca): configuração não é editável aqui
const somenteLeitura = (record: any) => record.isMarcaSistema || record.origem === "herdados";

export const AtributosCard: React.FC<AtributosCardProps> = ({
  titulo,
  cor,
  papel,
  dataSource,
  onOpenModal,
  onDelete,
  onMover,
  onAlterar,
  tooltipText,
  onInfoClick,
  emptyText,
  showDelete = false,
}) => {
  const criarMenuMover = (record: any): MenuProps => ({
    items: PAPEIS.filter((op) => op.key !== (record.classificacao || "ficha")).map((op) => ({
      key: op.key,
      label: op.label,
      onClick: () => onMover?.(record, op.key),
    })),
  });

  const opcoesDoAtributo = (record: any) =>
    (record.opcoesValidas || []).map((o: any) => ({ value: o.valor ?? o, label: o.valor ?? o }));

  const columns = [
    {
      title: "Atributo",
      dataIndex: "nome",
      key: "nome",
      render: (text: string, record: any) => {
        if (record.isMarcaSistema) {
          return (
            <Tag color="purple" icon={<StarFilled style={{ fontSize: "10px" }} />} style={{ margin: 0, fontWeight: 600, fontSize: "11px" }}>
              MARCA (Sistema)
            </Tag>
          );
        }
        return (
          <span style={{ fontWeight: 500, color: "#334155", fontSize: "12px" }}>
            {text}
            {record.origem === "herdados" && (
              <Tooltip title="Vem da categoria: a configuração é feita na categoria.">
                <Tag style={{ marginLeft: 4, fontSize: 10, padding: "0 4px" }}>da categoria</Tag>
              </Tooltip>
            )}
          </span>
        );
      },
    },
    ...(papel === "dna"
      ? [{
          title: <Tooltip title="Valor igual para todos os itens da família (ex: Material = NBR)">Valor fixo</Tooltip>,
          key: "valorFixo",
          width: 120,
          render: (_: any, record: any) => {
            if (record.isMarcaSistema) return null;
            const valor = record.valorPadraoFamilia ?? record.valorPadraoGrupo ?? "";
            if (somenteLeitura(record)) return <span style={{ fontSize: 11 }}>{valor || "—"}</span>;
            const opcoes = opcoesDoAtributo(record);
            return opcoes.length > 0 ? (
              <Select
                size="small"
                style={{ width: "100%" }}
                value={valor || undefined}
                placeholder="Definir"
                status={valor ? undefined : "warning"}
                options={opcoes}
                onChange={(v) => onAlterar?.(record, { valorPadraoFamilia: v, valorPadraoGrupo: v })}
              />
            ) : (
              <Input
                size="small"
                value={valor}
                placeholder="Definir"
                status={valor ? undefined : "warning"}
                onChange={(e) => onAlterar?.(record, { valorPadraoFamilia: e.target.value, valorPadraoGrupo: e.target.value })}
              />
            );
          },
        }]
      : []),
    {
      title: <Tooltip title="Entra no código (SKU) e no nome gerados pelo template, na posição indicada">código ?</Tooltip>,
      key: "codigo",
      width: 90,
      render: (_: any, record: any) => {
        if (record.isMarcaSistema) return null;
        const bloqueado = somenteLeitura(record);
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Switch
              size="small"
              checked={Boolean(record.compoeSku)}
              disabled={bloqueado}
              onChange={(v) => onAlterar?.(record, { compoeSku: v, ordemSku: v ? Math.max(1, Number(record.ordemSku) || 1) : 0 })}
            />
            {record.compoeSku && (
              <InputNumber
                size="small"
                min={1}
                max={20}
                value={Number(record.ordemSku) || 1}
                disabled={bloqueado}
                style={{ width: 44 }}
                onChange={(v) => onAlterar?.(record, { ordemSku: Number(v) || 1 })}
              />
            )}
          </span>
        );
      },
    },
    {
      title: <Tooltip title="Item sem este valor fica pendente e não é publicado">Obrig.</Tooltip>,
      key: "obrigatorio",
      width: 56,
      align: "center" as const,
      render: (_: any, record: any) =>
        record.isMarcaSistema ? null : (
          <Switch
            size="small"
            checked={Boolean(record.obrigatorio)}
            disabled={somenteLeitura(record)}
            onChange={(v) => onAlterar?.(record, { obrigatorio: v })}
          />
        ),
    },
    ...(showDelete
      ? [
          {
            title: "",
            key: "acoes",
            width: 60,
            align: "right" as const,
            render: (_: any, record: any) => {
              if (somenteLeitura(record)) return null;
              return (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "2px" }}>
                  <Dropdown menu={criarMenuMover(record)} trigger={["click"]}>
                    <Tooltip title="Mudar o papel do atributo">
                      <Button
                        type="text"
                        size="small"
                        icon={<SwapOutlined style={{ color: "#2563eb", fontSize: "12px" }} />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Tooltip>
                  </Dropdown>
                  <Tooltip title="Remover da família (valores já preenchidos nos itens são preservados)">
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
    <div >
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
          body: { padding: 0, flex: 1, display: "flex", flexDirection: "column" },
        }}
        title={
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
            {tooltipText && (
              <Tooltip title={tooltipText}>
                <InfoCircleOutlined style={{ fontSize: "11px", color: "#64748b", cursor: "pointer" }} onClick={onInfoClick} />
              </Tooltip>
            )}
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: cor }}></span>
            {titulo}
          </span>
        }
        extra={
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined style={{ fontSize: "11px" }} />}
            style={{ color: cor, fontWeight: 600, height: 24, width: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
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
          rowClassName={(record: any) => (record.isMarcaSistema ? "linha-marca-sistema" : record.origem === "herdados" ? "linha-herdada" : "")}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: "11px", color: "#94a3b8" }}>{emptyText}</span>}
              />
            ),
          }}
        />
      </Card>

      <style>{`
        .linha-marca-sistema { background-color: #faf5ff !important; }
        .linha-marca-sistema:hover > td { background-color: #f3e8ff !important; }
        .linha-herdada { background-color: #f8fafc !important; color: #64748b; }
      `}</style>
      </div>
  );
};
