import React from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Typography, Breadcrumb, Button, Space } from "antd";
import {
  FileTextOutlined,
  BarChartOutlined,
  BuildOutlined,
  LineChartOutlined,
  SolutionOutlined,
  PieChartOutlined
} from "@ant-design/icons";

const { Title, Text } = Typography;

interface ReportLink {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}

interface ReportSection {
  category: string;
  icon: React.ReactNode;
  reports: ReportLink[];
}

export default function RelatoriosPage() {
  // Configuração dos grupos de relatórios e seus respectivos caminhos (rotas)
  const reportSections: ReportSection[] = [
    {
      category: "Serviços Técnicos e Obras",
      icon: <BuildOutlined style={{ color: "#1890ff" }} />,
      reports: [
        {
          title: "Perfuração e Instalação de Poços",
          description: "Gerar relatório técnico detalhado de campo para impressão em A4/PDF.",
          path: "/relatorios/poco", // Caminho da tela que criamos anteriormente
          icon: <FileTextOutlined />
        },
        {
          title: "Cronograma de Obras Ativas",
          description: "Visão consolidada de prazos, equipe e status das perfurações.",
          path: "/obras/relatorio-cronograma",
          icon: <BarChartOutlined />
        }
      ]
    },
    {
      category: "Estoque e Suprimentos",
      icon: <SolutionOutlined style={{ color: "#52c41a" }} />,
      reports: [
        {
          title: "Análise de Curva ABC e Giro",
          description: "Identificação de produtos de alto impacto e itens sem giro no estoque.",
          path: "/estoque/analise-abc",
          icon: <PieChartOutlined />
        },
        {
          title: "Histórico de Movimentações (Auditoria)",
          description: "Rastreabilidade completa de entradas, saídas e ajustes manuais.",
          path: "/estoque/operacoes",
          icon: <LineChartOutlined />
        }
      ]
    }
  ];

  return (
    <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
      
      {/* NAVEGAÇÃO */}
      <Breadcrumb style={{ marginBottom: "16px" }}>
        <Breadcrumb.Item>ERP Central</Breadcrumb.Item>
        <Breadcrumb.Item>Painel de Relatórios</Breadcrumb.Item>
      </Breadcrumb>

      {/* HEADER DA PÁGINA */}
      <div style={{ marginBottom: "24px" }}>
        <Title level={2} style={{ margin: 0 }}>
          📊 Central de Relatórios e Documentos
        </Title>
        <Text type="secondary">
          Selecione o módulo operacional desejado para gerar e exportar dados analíticos.
        </Text>
      </div>

      {/* RENDERIZAÇÃO DAS SEÇÕES */}
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {reportSections.map((section, sIdx) => (
          <Card 
            key={sIdx}
            title={
              <Space>
                {section.icon}
                <span>{section.category}</span>
              </Space>
            }
            bordered={false}
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", borderRadius: "8px" }}
          >
            <Row gutter={[16, 16]}>
              {section.reports.map((report, rIdx) => (
                <Col xs={24} sm={12} md={8} key={rIdx}>
                  <Card 
                    type="inner" 
                    title={report.title}
                    style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                    bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}
                  >
                    <div style={{ marginBottom: "16px" }}>
                      <Text type="secondary" style={{ fontSize: "0.85rem" }}>
                        {report.description}
                      </Text>
                    </div>
                    
                    <Link to={report.path}>
                      <Button type="primary" ghost block icon={report.icon}>
                        Acessar Relatório
                      </Button>
                    </Link>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </Space>

    </div>
  );
}