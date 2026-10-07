import React, { useState, useEffect } from "react";
import { Modal, Button, Tabs, Table, Typography, Space } from "antd";
import { 
  BookOutlined, 
  TableOutlined, 
  TagOutlined, 
  AppstoreOutlined, 
  FileTextOutlined,
  ShopOutlined
} from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface AttributeGuideModalProps {
  visible: boolean;
  onClose: () => void;
  defaultTab?: "tabela" | "dna" | "grade" | "ficha" | "marca";
}

export const AttributeGuideModal: React.FC<AttributeGuideModalProps> = ({
  visible,
  onClose,
  defaultTab = "tabela",
}) => {
  const [activeKey, setActiveKey] = useState<string>(defaultTab);

  useEffect(() => {
    if (visible) {
      setActiveKey(defaultTab);
    }
  }, [visible, defaultTab]);

  const tableData = [
    {
      key: "1",
      produto: "Rolamento",
      dna: "6204 / 6001 (Série base e Tipo)",
      grade: "C3, ZZ, 2RS (Folga, Blindagem e Marca*)",
      ficha: "RPM Máximo, Carga Dinâmica, Carga Estática",
    },
    {
      key: "2",
      produto: "Correia Industrial",
      dna: "A / B / SPZ (Perfil e Seção base)",
      grade: "Comprimento Primitivo (ex: 1200mm)",
      ficha: "Velocidade Linear Máxima, Potência",
    },
    {
      key: "3",
      produto: "Mangueira Hidráulica",
      dna: "PT500 / R2AT (Norma e Família)",
      grade: "Bitola / Diâmetro (ex: 1/2\", 3/4\")",
      ficha: "Pressão de Trabalho, Temp. Limite",
    },
    {
      key: "4",
      produto: "Abraçadeira de Nylon",
      dna: "Nylon 6.6 (Matéria-prima base)",
      grade: "Largura x Comprimento, Cor",
      ficha: "Resistência à Tração (kgf)",
    },
    {
      key: "5",
      produto: "Anel O-Ring",
      dna: "Viton (FKM) / NBR (Composto)",
      grade: "Diâmetro Interno x Seção",
      ficha: "Dureza Shore A, Resistência a Óleos",
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
      render: (text: string) => <Text style={{ color: "#1d4ed8", fontSize: "12px" }}>{text}</Text>,
    },
    {
      title: <span style={{ color: "#7c3aed" }}>Eixos de Variação (Grade)</span>,
      dataIndex: "grade",
      key: "grade",
      width: "26%",
      render: (text: string) => <Text style={{ color: "#6b21a8", fontSize: "12px" }}>{text}</Text>,
    },
    {
      title: <span style={{ color: "#0d9488" }}>Parâmetros Técnicos</span>,
      dataIndex: "ficha",
      key: "ficha",
      width: "26%",
      render: (text: string) => <Text style={{ color: "#115e59", fontSize: "12px" }}>{text}</Text>,
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
      width={1000}
      centered
    >
      <Paragraph style={{ color: "#475569", marginBottom: "16px", fontSize: "13px" }}>
        Entenda a visão comparativa de como cada componente do seu catálogo deve ser distribuído entre os blocos para garantir a correta geração de SKUs, nomes automáticos e fichas técnicas:
      </Paragraph>

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          {
            key: "tabela",
            label: (
              <Space size={6}>
                <TableOutlined />
                <span style={{ fontWeight: 600 }}>Visão Comparativa</span>
              </Space>
            ),
            children: (
              <>
                <Table 
                  dataSource={tableData} 
                  columns={columns} 
                  pagination={false} 
                  size="small" 
                  bordered 
                  style={{ background: "#fff", marginBottom: "12px" }}
                />
                <Text type="secondary" style={{ fontSize: "11px", display: "block" }}>
                  * Nota: A <strong>Marca</strong> possui comportamento flexível e pode ser configurada por família. Veja a aba <em>Regra da Marca</em> para detalhes.
                </Text>
              </>
            ),
          },
          {
            key: "marca",
            label: (
              <span style={{ color: "#d97706", fontWeight: 600 }}>
                <ShopOutlined style={{ marginRight: "4px" }} /> Regra da Marca (Guia Especial)
              </span>
            ),
            children: (
              <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                <Text strong style={{ color: "#b45309", fontSize: "14px", display: "block", marginBottom: "12px" }}>
                  Como a Marca deve ser tratada no PIM?
                </Text>
                
                <Paragraph style={{ color: "#78350f", fontSize: "12.5px", marginBottom: "8px" }}>
                  A marca não se comporta de forma igual para todos os produtos. No seu seletor de família, você deve definir o papel dela com base na regra de negócio da categoria:
                </Paragraph>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  <div style={{ background: "#fff", padding: "10px 12px", borderRadius: "6px", border: "1px solid #fef3c7" }}>
                    <Text strong style={{ color: "#92400e", display: "block", fontSize: "13px" }}>
                      1. Marca na Ficha Técnica (SKU Unificado / Múltiplos Fornecedores)
                    </Text>
                    <Text style={{ color: "#78350f", fontSize: "12px" }}>
                      Use para itens comuns (ex: Abraçadeiras, parafusos, tubos genéricos). O SKU do sistema é único (ex: <code>ABR-12-50</code>) e a marca serve apenas como dado técnico de apoio. Se faltar a marca A no estoque, você pode faturar a marca B para o mesmo SKU sem conflito.
                    </Text>
                  </div>

                  <div style={{ background: "#fff", padding: "10px 12px", borderRadius: "6px", border: "1px solid #fef3c7" }}>
                    <Text strong style={{ color: "#92400e", display: "block", fontSize: "13px" }}>
                      2. Marca no DNA (Identidade Fixa do Modelo)
                    </Text>
                    <Text style={{ color: "#78350f", fontSize: "12px" }}>
                      Use quando o produto é fabricado exclusivamente por uma marca específica que define o nome comercial base, mas sem criar variações complexas de grade.
                    </Text>
                  </div>

                  <div style={{ background: "#fff", padding: "10px 12px", borderRadius: "6px", border: "1px solid #fef3c7" }}>
                    <Text strong style={{ color: "#92400e", display: "block", fontSize: "13px" }}>
                      3. Marca na Grade (SKU Segregado por Fabricante - Ex: Rolamentos)
                    </Text>
                    <Text style={{ color: "#78350f", fontSize: "12px" }}>
                      Use quando a marca for um fator **crítico de decisão técnica**. Se um cliente exige um rolamento <code>6204</code> da marca <strong>SKF</strong>, ele não aceita uma marca genérica equivalente na mesma linha de pedido. O PIM obrigatoriamente separará em SKUs diferentes (ex: <code>ROL-6204-SKF</code> e <code>ROL-6204-FAG</code>).
                    </Text>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "dna",
            label: (
              <span style={{ color: "#2563eb", fontWeight: 600 }}>
                <TagOutlined style={{ marginRight: "4px" }} /> Foco: DNA
              </span>
            ),
            children: (
              <div style={{ background: "#eff6ff", padding: "16px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                <Text strong style={{ color: "#1e40af", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  O que entra no DNA?
                </Text>
                <Paragraph style={{ color: "#1e3a8a", margin: 0, fontSize: "13px" }}>
                  É a base principal que identifica a essência estrutural do item, como a numeração base do rolamento (ex: <strong>6204</strong>), a norma da mangueira (<strong>PT500</strong>) ou o perfil da correia. É o esqueleto imutável do produto.
                </Paragraph>
              </div>
            ),
          },
          {
            key: "grade",
            label: (
              <span style={{ color: "#7c3aed", fontWeight: 600 }}>
                <AppstoreOutlined style={{ marginRight: "4px" }} /> Foco: Variação (Grade)
              </span>
            ),
            children: (
              <div style={{ background: "#f3e8ff", padding: "16px", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                <Text strong style={{ color: "#6b21a8", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  O que entra em Eixos de Variação?
                </Text>
                <Paragraph style={{ color: "#581c87", margin: 0, fontSize: "13px" }}>
                  Tudo o que altera o part number, a grade comercial ou gera um novo SKU físico no estoque (ex: folga, blindagem <strong>2RS/ZZ</strong> e, se configurado, a <strong>Marca</strong>).
                </Paragraph>
              </div>
            ),
          },
          {
            key: "ficha",
            label: (
              <span style={{ color: "#0d9488", fontWeight: 600 }}>
                <FileTextOutlined style={{ marginRight: "4px" }} /> Foco: Ficha Técnica
              </span>
            ),
            children: (
              <div style={{ background: "#f0fdfa", padding: "16px", borderRadius: "8px", border: "1px solid #ccfbf1" }}>
                <Text strong style={{ color: "#115e59", fontSize: "14px", display: "block", marginBottom: "8px" }}>
                  O que entra em Parâmetros Técnicos?
                </Text>
                <Paragraph style={{ color: "#134e4a", margin: 0, fontSize: "13px" }}>
                  Dados descritivos de engenharia e performance que não criam SKUs novos sozinhos, mas ajudam na especificação e busca (ex: <strong>RPM Máximo</strong>, <strong>Carga Dinâmica</strong>).
                </Paragraph>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};