import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Row, Col, Card, Typography, Breadcrumb, Button, Space, Tag, message } from "antd";
import { salvarModulo, useModulos } from "../../../modulos/modulosStore";
import { relatoriosDosModulos } from "../../../modulos/registroModulos";
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

  // Atalhos dos módulos ligados entram na categoria deles (o de Poços tem card fixo abaixo)
  const { ativos } = useModulos();
  const navigate = useNavigate();
  const [ativando, setAtivando] = useState(false);
  const POCOS = { codigo: 'HIDRAULICA_POCOS', path: '/modulos/hidraulica/pocos' };
  const pocosLigado = ativos.has(POCOS.codigo);
  // Desligado: liga o módulo e abre a tela
  const abrirPocos = async () => {
    if (pocosLigado) { navigate(POCOS.path); return; }
    setAtivando(true);
    try {
      await salvarModulo(POCOS.codigo, true);
      navigate(POCOS.path);
    } catch (e) {
      const texto = e instanceof Error ? e.message : '';
      message.error(/desconhecido|Rota não encontrada/i.test(texto)
        ? 'O servidor ainda não conhece o módulo de Poços: reinicie o backend e clique de novo.'
        : texto || 'Não foi possível ativar o módulo de Poços.');
    } finally {
      setAtivando(false);
    }
  };
  for (const r of relatoriosDosModulos(ativos).filter(x => x.path !== POCOS.path)) {
    const link = { title: r.titulo, description: r.descricao, path: r.path, icon: <FileTextOutlined /> };
    const secao = reportSections.find(x => x.category.toLowerCase() === r.categoria.toLowerCase());
    if (secao) secao.reports.unshift(link);
    else reportSections.unshift({ category: r.categoria, icon: <BuildOutlined style={{ color: "#1890ff" }} />, reports: [link] });
  }

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

      {/* POÇOS ARTESIANOS: sempre visível; liga o módulo se estiver desligado */}
      <Card style={{ marginBottom: "24px", borderRadius: "8px", borderLeft: "4px solid #1890ff" }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} md={16}>
            <Space direction="vertical" size={2}>
              <Space>
                <BuildOutlined style={{ color: "#1890ff", fontSize: 18 }} />
                <Text strong style={{ fontSize: 16 }}>Poços artesianos</Text>
                {pocosLigado ? <Tag color="green">módulo ligado</Tag> : <Tag>módulo desligado</Tag>}
              </Space>
              <Text type="secondary">
                Relatório técnico completo, cobrança da obra (metros excedentes e pagamentos), teste de vazão, garantia e formulário de campo.
              </Text>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: "right" }}>
            <Button type="primary" size="large" icon={<FileTextOutlined />} loading={ativando} onClick={abrirPocos} block>
              {pocosLigado ? "Abrir relatórios de poço" : "Ativar e abrir"}
            </Button>
          </Col>
        </Row>
      </Card>

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