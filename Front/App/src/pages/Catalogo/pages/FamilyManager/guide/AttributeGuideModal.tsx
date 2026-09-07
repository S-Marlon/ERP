import React, { useState } from "react";
import { Modal, Button, Tabs, Table, Typography, Space } from "antd";
import { BookOutlined, TableOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface AttributeGuideModalProps {
  visible: boolean;
  onClose: () => void;
  defaultTab?: "dna" | "grade" | "ficha";
}

export const AttributeGuideModal: React.FC<AttributeGuideModalProps> = ({
  visible,
  onClose,
  defaultTab = "dna",
}) => {
  const [activeKey, setActiveKey] = useState<string>(defaultTab);

  // Dados unificados para a tabela de exemplo completo por tipo de produto
  const tableData = [
    {
      key: "1",
      produto: "Rolamento",
      dna: "6204 / 6001 (Família / Série base)",
      grade: "C3, ZZ, 2RS (Folga e Blindagem)",
      ficha: "RPM Máximo, Carga Dinâmica, Carga Estática",
    },
    {
      key: "2",
      produto: "Correia Industrial",
      dna: "A / B / SPZ (Perfil e Seção base)",
      grade: "Comprimento Primitivo (ex: 1200mm, 1500mm)",
      ficha: "Velocidade Linear Máxima, Potência Admissível",
    },
    {
      key: "3",
      produto: "Mangueira Hidráulica",
      dna: "PT500 / R2AT (Norma e Família)",
      grade: "Bitola / Diâmetro (ex: 1/2\", 3/4\")",
      ficha: "Pressão de Trabalho, Raio de Curvatura, Temp.",
    },
    {
      key: "4",
      produto: "Abraçadeira de Nylon",
      dna: "Nylon 6.6 (Matéria-prima base da linha)",
      grade: "Largura x Comprimento (ex: 4.8x200mm), Cor",
      ficha: "Resistência à Tração (kgf), Temp. Limite",
    },
    {
      key: "5",
      produto: "Anel O-Ring",
      dna: "Viton (FKM) / NBR (Composto base)",
      grade: "Diâmetro Interno x Seção (ex: 10 x 2.5mm)",
      ficha: "Dureza Shore A, Resistência a Óleos/Fluidos",
    },
  ];

  const columns = [
    {
      title: "Família / Produto",
      dataIndex: "produto",
      key: "produto",
      width: "22%",
      render: (text: string) => <Text strong style={{ color: "#1e293b" }}>{text}</Text>,
    },
    {
      title: <span style={{ color: "#2563eb" }}>Atributos DNA</span>,
      dataIndex: "dna",
      key: "dna",
      width: "26%",
      render: (text: string) => <Text style={{ color: "#1d4ed8", fontSize: "13px" }}>{text}</Text>,
    },
    {
      title: <span style={{ color: "#7c3aed" }}>Eixos de Variação (SKU)</span>,
      dataIndex: "grade",
      key: "grade",
      width: "26%",
      render: (text: string) => <Text style={{ color: "#6b21a8", fontSize: "13px" }}>{text}</Text>,
    },
    {
      title: <span style={{ color: "#0d9488" }}>Parâmetros Técnicos</span>,
      dataIndex: "ficha",
      key: "ficha",
      width: "26%",
      render: (text: string) => <Text style={{ color: "#115e59", fontSize: "13px" }}>{text}</Text>,
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <BookOutlined style={{ color: "#2563eb" }} />
          <span>Guia Prático: Como estruturar os Atributos no PIM</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ background: "#2563eb" }}>
          Entendi, fechar guia
        </Button>,
      ]}
      width={950}
      centered
    >
      <Paragraph style={{ color: "#475569", marginBottom: "16px" }}>
        Veja abaixo a visão comparativa de como cada componente do seu catálogo deve ser distribuído entre os blocos para garantir a correta geração de SKUs e fichas técnicas:
      </Paragraph>

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          {
            key: "tabela",
            label: (
              <Space>
                <TableOutlined />
                <span style={{ fontWeight: 600 }}>Visão Comparativa Completa</span>
              </Space>
            ),
            children: (
              <Table 
                dataSource={tableData} 
                columns={columns} 
                pagination={false} 
                size="middle" 
                bordered 
                style={{ background: "#fff" }}
              />
            ),
          },
          {
            key: "dna",
            label: <span style={{ color: "#2563eb", fontWeight: 600 }}>Foco: Atributos DNA</span>,
            children: (
              <div style={{ background: "#eff6ff", padding: "16px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <Text strong style={{ color: "#1e40af", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  O que entra no DNA?
                </Text>
                <Paragraph style={{ color: "#1e3a8a", margin: 0, fontSize: "13px" }}>
                  É a base principal que identifica a essência estrutural do item, como a numeração base do rolamento (ex: <strong>6204</strong>, <strong>6001</strong>), a norma da mangueira (<strong>PT500</strong>) ou o perfil da correia. É o ponto de partida do produto antes de definir variações ou métricas de laboratório.
                </Paragraph>
              </div>
            ),
          },
          {
            key: "grade",
            label: <span style={{ color: "#7c3aed", fontWeight: 600 }}>Foco: Eixos de Variação</span>,
            children: (
              <div style={{ background: "#f3e8ff", padding: "16px", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                <Text strong style={{ color: "#6b21a8", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  O que entra em Eixos de Variação?
                </Text>
                <Paragraph style={{ color: "#581c87", margin: 0, fontSize: "13px" }}>
                  Tudo o que altera o part number, a grade comercial ou gera um novo SKU no estoque. No rolamento, por exemplo, entram as variações de folga e blindagem (ex: <strong>C3</strong>, <strong>ZZ</strong>, <strong>2RS</strong>) e as medidas dimensionais de encaixe.
                </Paragraph>
              </div>
            ),
          },
          {
            key: "ficha",
            label: <span style={{ color: "#0d9488", fontWeight: 600 }}>Foco: Parâmetros Técnicos</span>,
            children: (
              <div style={{ background: "#f0fdfa", padding: "16px", borderRadius: "8px", border: "1px solid #ccfbf1" }}>
                <Text strong style={{ color: "#115e59", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  O que entra em Parâmetros Técnicos?
                </Text>
                <Paragraph style={{ color: "#134e4a", margin: 0, fontSize: "13px" }}>
                  São os dados descritivos de engenharia e performance que não criam SKUs novos sozinhos, mas são vitais para o operador consultar (ex: <strong>RPM Máximo</strong>, <strong>Carga Dinâmica Crítica</strong>, <strong>Carga Estática</strong> e <strong>Torque de giro</strong>).
                </Paragraph>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};