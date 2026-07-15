import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Row, Col, Card, Form, Input, Typography, Space, Divider, Drawer } from 'antd';
import { 
  PhoneOutlined, 
  MailOutlined, 
  EnvironmentOutlined,
  CheckCircleOutlined,
  MenuOutlined,
  PictureOutlined
} from '@ant-design/icons';
import Swal from 'sweetalert2';

// Importação correta e segura do Footer
const { Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const colors = {
  primary: '#660000',
  primaryDark: '#4A0000',
  accent: '#D4AF37',
  lightBg: '#F9F6F6',
  darkBg: '#1C0000',
  textDark: '#2B2B2B',
  placeholderGray: '#E5E5E5'
};

const ImagePlaceholder: React.FC<{ height?: string; text: string }> = ({ height = '300px', text }) => (
  <div 
    style={{
      width: '100%',
      height: height,
      backgroundColor: colors.placeholderGray,
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      border: '2px dashed #cccccc',
      color: '#777777',
      padding: '20px',
      textAlign: 'center',
      aspectRatio: '16/9'
    }}
  >
    <PictureOutlined style={{ fontSize: '40px', marginBottom: '10px', color: '#999999' }} aria-hidden="true" />
    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>[Imagem: {text}]</span>
  </div>
);

export const IndustrialLandingPage: React.FC = () => {
  const [form] = Form.useForm();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = (values: any) => {
    Swal.fire({
      title: 'Orçamento Solicitado!',
      text: `Olá ${values.name}, recebemos sua lista de materiais. Nosso especialista técnico entrará em contato via WhatsApp em minutos!`,
      icon: 'success',
      confirmButtonText: 'Fechar',
      confirmButtonColor: colors.primary,
    }).then(() => {
      form.resetFields();
    });
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setDrawerVisible(false);
  };

  const menuItems = [
    { key: 'home', label: <a href="#hero" onClick={(e) => scrollToSection(e, 'hero')}>Início</a> },
    { key: 'prensagem', label: <a href="#seo-prensagem" onClick={(e) => scrollToSection(e, 'seo-prensagem')}>Prensagem de Mangueiras</a> },
    { key: 'rolamentos', label: <a href="#seo-rolamentos" onClick={(e) => scrollToSection(e, 'seo-rolamentos')}>Rolamentos e Correias</a> },
    { key: 'produtos', label: <a href="#produtos-linha" onClick={(e) => scrollToSection(e, 'produtos-linha')}>Linha Industrial</a> },
    { key: 'contact', label: <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Orçamentos</a> },
  ];

  return (
    <Layout style={{ minHeight: '100vh', fontFamily: 'sans-serif', color: colors.textDark }}>
      
      {/* NAVBAR */}
      <header 
        style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 1000, 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: colors.primary,
          padding: '0 5%',
          height: '64px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '20px', letterSpacing: '1px' }}>
          <span style={{ color: colors.accent }}>ATI</span>MANG
        </div>

        {!isMobile && (
          <nav aria-label="Menu Principal" style={{ display: 'flex', alignItems: 'center', flexGrow: 1, justifyContent: 'flex-end' }}>
            <Menu
              theme="dark"
              mode="horizontal"
              disabledOverflow
              style={{ background: 'transparent', borderBottom: 'none', minWidth: '450px', display: 'flex', justifyContent: 'flex-end' }}
              items={menuItems}
            />
            <Button 
              type="primary" 
              style={{ backgroundColor: colors.accent, borderColor: colors.accent, color: '#000', marginLeft: '20px', fontWeight: 'bold' }}
              onClick={(e: any) => scrollToSection(e, 'contact')}
            >
              Cotar Agora
            </Button>
          </nav>
        )}

        {isMobile && (
          <Button 
            type="text" 
            aria-label="Abrir menu de navegação"
            icon={<MenuOutlined style={{ color: '#fff', fontSize: '22px' }} />} 
            onClick={() => setDrawerVisible(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        )}
      </header>

      {/* DRAWER MOBILE */}
      <Drawer
        title={<span style={{ color: colors.primary, fontWeight: 'bold' }}>Navegação</span>}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={280}
      >
        <Menu
          mode="vertical"
          items={menuItems}
          style={{ borderRight: 'none', fontSize: '16px' }}
        />
        <Button 
          type="primary" 
          block
          style={{ backgroundColor: colors.accent, borderColor: colors.accent, color: '#000', fontWeight: 'bold', marginTop: '20px' }}
          onClick={(e: any) => scrollToSection(e, 'contact')}
        >
          Cotar Agora
        </Button>
      </Drawer>

      {/* CONTEÚDO */}
      <Content>
        {/* HERO SECTION */}
        <section 
          id="hero" 
          style={{ 
            background: `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`, 
            padding: isMobile ? '40px 5%' : '60px 5%',
            color: '#fff',
          }}
        >
          <Row gutter={[32, 32]} align="middle">
            <Col xs={24} lg={15}>
              <Title level={1} style={{ color: '#fff', fontSize: 'clamp(24px, 4vw, 40px)', marginBottom: '20px', lineHeight: '1.2' }}>
                Fornecedor de Equipamentos Industriais: Especialista em Prensagem de Mangueira Hidráulica e Rolamentos
              </Title>
              <Paragraph style={{ color: '#F5E6E6', fontSize: 'clamp(14px, 2vw, 18px)', marginBottom: '30px' }}>
                Evite máquinas e linhas de produção paradas. Garanta alta performance com nossa linha completa de mangueiras hidráulicas sob medida, conexões de alta pressão, correias industriais, graxas especiais e óleo hidráulico 68.
              </Paragraph>
              <Space size="middle" wrap style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  size="large" 
                  style={{ backgroundColor: colors.accent, borderColor: colors.accent, color: '#000', fontWeight: 'bold' }}
                  onClick={(e: any) => scrollToSection(e, 'contact')}
                >
                  Solicitar Orçamento de Prensagem
                </Button>
                <Button 
                  ghost 
                  size="large" 
                  style={{ color: '#fff', borderColor: '#fff' }}
                  onClick={(e: any) => scrollToSection(e, 'seo-prensagem')}
                >
                  Conhecer Nossas Soluções
                </Button>
              </Space>
            </Col>
            <Col xs={24} lg={9}>
              <article style={{ 
                borderLeft: `4px solid ${colors.accent}`, 
                padding: '25px', 
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px'
              }}>
                <Title level={3} style={{ color: '#fff', marginTop: 0, fontSize: '20px' }}>Prensagem de Mangueiras Pronta Entrega</Title>
                <Text style={{ color: '#fff', display: 'block', marginBottom: '15px' }}>
                  Montagem técnica de mangueiras para lavadoras, sistemas de freio automotivo e maquinário pesado com máxima vedação.
                </Text>
                <div style={{ marginBottom: '15px' }}>
                  <ImagePlaceholder text="Oficina de Prensagem / Maquinário pesado" height="140px" />
                </div>
                <Paragraph style={{ color: colors.accent, fontWeight: 'bold', fontSize: '16px', marginBottom: 0 }}>
                  Fale com nossos técnicos agora!
                </Paragraph>
              </article>
            </Col>
          </Row>
        </section>

        {/* SEÇÃO SEO 1 */}
        <section id="seo-prensagem" style={{ padding: isMobile ? '40px 20px' : '60px 5%', background: '#fff' }}>
          <Row gutter={[40, 24]} align="middle">
            <Col xs={24} md={12}>
              <header>
                <Text style={{ color: colors.primary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px', display: 'block' }}>
                  Serviço Técnico Especializado
                </Text>
                <Title level={2} style={{ color: colors.primaryDark, marginTop: '5px', marginBottom: '20px', fontSize: 'clamp(20px, 3.5vw, 32px)', textAlign: isMobile ? 'left' : 'justify' }}>
                  Onde fazer Prensagem de Mangueira Hidráulica com Segurança?
                </Title>
              </header>
              <Paragraph style={{ fontSize: '16px', color: '#555', textAlign: isMobile ? 'left' : 'justify', lineHeight: '1.6' }}>
                Nossa oficina mecânica industrial é referência em <strong>prensagem de mangueira hidráulica</strong> de alta, média e extrema pressão. Trabalhamos com terminais prensados sob medida para tratores, prensas e sistemas hidráulicos complexos. 
              </Paragraph>
              <Paragraph style={{ fontSize: '16px', color: '#555', textAlign: isMobile ? 'left' : 'justify', lineHeight: '1.6', marginBottom: 0 }}>
                Também realizamos com precisão a montagem e troca de <strong>mangueiras de lavadoras de alta pressão</strong> (residenciais e comerciais) e <strong>mangueiras de freio automotivas</strong>, garantindo flexibilidade e resistência a picos de pressão extrema.
              </Paragraph>
            </Col>
            
            <Col xs={24} md={12}>
              <div style={{ marginBottom: '16px' }}>
                <ImagePlaceholder text="Mangueiras Hidráulicas e Conexões Detalhadas" height={isMobile ? '160px' : '220px'} />
              </div>
              <Card 
                style={{ 
                  background: colors.lightBg, 
                  borderLeft: `6px solid ${colors.primary}`,
                  borderRadius: '0 8px 8px 0' 
                }}
                bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
              >
                <Title level={3} style={{ color: colors.primaryDark, fontSize: '18px', marginTop: 0, marginBottom: '12px' }}>
                  Aplicações de Mangueiras que Prensamos:
                </Title>
                <Space direction="vertical" size={isMobile ? 'small' : 'middle'} style={{ width: '100%', display: 'flex' }}>
                  {[
                    'Mangueiras Hidráulicas de 1/4" a 2" (Trama de Aço)',
                    'Mangueiras para Lavadoras de Postos e Lava-Rápido',
                    'Sistemas de Freio a Ar e Hidráulico Automotivo',
                    'Conexões, Terminais Flangeados, NPT e JIC'
                  ].map((item, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <CheckCircleOutlined style={{ color: colors.primary, fontSize: '16px', marginTop: '4px', flexShrink: 0 }} aria-hidden="true" />
                      <Text style={{ color: '#444', fontSize: '15px', lineHeight: '1.4' }}>{item}</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>
        </section>

        {/* SEÇÃO SEO 2 */}
        <section id="seo-rolamentos" style={{ padding: isMobile ? '40px 5%' : '60px 5%', background: colors.lightBg }}>
          <Row gutter={[40, 32]} align="middle">
            <Col xs={24} md={12} style={{ order: isMobile ? 2 : 1 }}>
              <div style={{ marginBottom: '20px' }}>
                <ImagePlaceholder text="Catálogo de Rolamentos e Correias Industriais" height="220px" />
              </div>
              <div style={{ padding: '30px', background: colors.primary, color: '#fff', borderRadius: '8px' }}>
                <Title level={3} style={{ color: '#fff', marginTop: 0, fontSize: '20px' }}>Linha de Transmissão & Lubrificação</Title>
                <Paragraph style={{ color: '#F5E6E6' }}>
                  Distribuímos rolamentos industriais e automotivos certificados, além de fluidos que atendem rigorosas normas técnicas internacionais.
                </Paragraph>
                <Button 
                  style={{ backgroundColor: colors.accent, borderColor: colors.accent, color: '#000', fontWeight: 'bold' }}
                  onClick={(e: any) => scrollToSection(e, 'contact')}
                >
                  Consultar Tabela de Rolamentos
                </Button>
              </div>
            </Col>

            <Col xs={24} md={12} style={{ order: isMobile ? 1 : 2 }}>
              <Text style={{ color: colors.primary, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Distribuidor Autorizado</Text>
              <Title level={2} style={{ color: colors.primaryDark, marginTop: '5px', fontSize: 'clamp(20px, 3.5vw, 32px)' }}>
                Catálogo Completo de Rolamentos Industriais e Correias de Transmissão
              </Title>
              <Paragraph style={{ fontSize: '16px', color: '#555', textAlign: 'justify' }}>
                Se você busca um fornecedor confiável de <strong>rolamentos</strong> de esferas, rolos cilíndricos ou de agulha, nós temos a solução. Mantemos parcerias com as maiores marcas do mercado para garantir menor atrito e maior vida útil ao seu maquinário.
              </Paragraph>
              <Paragraph style={{ fontSize: '16px', color: '#555', textAlign: 'justify' }}>
                Além de rolamentos, suprimos sua demanda de reposição com <strong>correias industriais em V</strong>, correias sincronizadoras e uma linha completa de lubrificantes essenciais, incluindo o requisitado <strong>óleo hidráulico 68</strong> e graxas especiais para rolamentos de alta rotação e temperatura.
              </Paragraph>
            </Col>
          </Row>
        </section>

        {/* GRADE DE PRODUTOS */}
        <section id="produtos-linha" style={{ padding: isMobile ? '40px 5%' : '60px 5%', background: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <Title level={2} style={{ color: colors.primaryDark, fontSize: 'clamp(20px, 3.5vw, 32px)' }}>Equipamentos, Peças e Suprimentos Industriais</Title>
            <Text style={{ fontSize: '16px', color: '#666' }}>Tudo o que sua manutenção preventiva ou corretiva precisa em um só lugar</Text>
          </div>
          
          <Row gutter={[24, 24]}>
            {[
              { title: "Prensagem Hidráulica", desc: "Montagem técnica de mangueiras hidráulicas sob medida e terminais de alta pressão com entrega rápida." },
              { title: "Rolamentos de Esfera e Rolo", desc: "Amplo estoque de rolamentos industriais e automotivos para redutores, motores e mancais." },
              { title: "Mangueiras de Lavadora e Freio", desc: "Mangueiras de alta pressão para lavadoras profissionais e mangueiras de freio para veículos pesados e leves." },
              { title: "Correias de Transmissão", desc: "Correias em V, sincronizadoras e transportadoras para a perfeita transmissão de potência mecânica." },
              { title: "Óleo Hidráulico 68 e Graxas", desc: "Óleo 68 mineral premium para sistemas hidráulicos industriais e graxas lubrificantes de alta aderência." },
              { title: "Conexões e Terminais", desc: "Adaptadores, niples, engates rápidos e conexões pneumáticas de alta durabilidade em aço e latão." }
            ].map((item, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <Card 
                  title={item.title} 
                  bordered={false} 
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', height: '100%' }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <div style={{ marginBottom: '15px' }}>
                    <ImagePlaceholder text={item.title} height="120px" />
                  </div>
                  <p>{item.desc}</p>
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        {/* FORMULÁRIO */}
        <section id="contact" style={{ padding: isMobile ? '40px 5%' : '60px 5%', background: colors.lightBg }}>
          <Row gutter={[40, 40]} justify="center">
            <Col xs={24} lg={10}>
              <Title level={2} style={{ color: colors.primaryDark, fontSize: 'clamp(20px, 3.5vw, 32px)' }}>Solicite Cotação de Mão de Obra e Peças</Title>
              <Paragraph style={{ fontSize: '16px', color: '#555', marginBottom: '30px' }}>
                Preencha o formulário para receber o preço de <strong>prensagem de mangueiras</strong>, códigos específicos de <strong>rolamentos</strong> ou cotação por volume de <strong>óleo 68</strong>. Respondemos rapidamente via WhatsApp corporativo.
              </Paragraph>
              
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <address style={{ fontStyle: 'normal' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <Title level={5} style={{ margin: 0, color: colors.primary }}><PhoneOutlined /> Central de Vendas & WhatsApp</Title>
                    <Text style={{ fontSize: '16px', fontWeight: 'bold' }}>(11) 99999-9999 / (11) 4444-4444</Text>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <Title level={5} style={{ margin: 0, color: colors.primary }}><MailOutlined /> E-mail Comercial</Title>
                    <Text style={{ fontSize: '16px' }}>orcamento@atimang.com.br</Text>
                  </div>
                  <div>
                    <Title level={5} style={{ margin: 0, color: colors.primary }}><EnvironmentOutlined /> Distribuidora e Oficina Técnica</Title>
                    <Text style={{ fontSize: '16px' }}>Av. Industrial do Sangue de Boi, 1500 - Distrito Industrial - Cidade/UF</Text>
                  </div>
                </address>
              </Space>
            </Col>
            
            <Col xs={24} lg={12}>
              <Card style={{ borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: 'none' }}>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  requiredMark={false}
                >
                  <Form.Item
                    label="Nome Completo ou Razão Social"
                    name="name"
                    rules={[{ required: true, message: 'Campo obrigatório.' }]}
                  >
                    <Input placeholder="Ex: Metalúrgica ou Nome do Comprador" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="E-mail"
                    name="email"
                    rules={[{ required: true, type: 'email', message: 'Insira um e-mail válido.' }]}
                  >
                    <Input placeholder="Ex: compras@suaempresa.com" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="WhatsApp / Telefone para Contato"
                    name="phone"
                    rules={[{ required: true, message: 'Campo obrigatório.' }]}
                  >
                    <Input placeholder="Ex: (11) 99999-9999" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="Descreva os itens ou serviços"
                    name="message"
                    rules={[{ required: true, message: 'Descreva o que precisa cotar.' }]}
                  >
                    <TextArea 
                      rows={4} 
                      placeholder="Ex: Preciso de orçamento para prensagem de 2 mangueiras de lavadora de 10 metros, 4 rolamentos de esferas cód. 6206 e 2 baldes de óleo 68." 
                    />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      size="large" 
                      block 
                      style={{ backgroundColor: colors.primary, borderColor: colors.primary, fontWeight: 'bold', height: '50px' }}
                    >
                      Enviar Lista para Cotação Técnica
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        </section>
           {/* RODAPÉ SEM ERROS E COMPATÍVEL COM O ANT DESIGN */}
      <Footer 
        style={{ 
          background: colors.darkBg, 
          color: '#B39999', 
          padding: isMobile ? '40px 20px' : '60px 5%',
          clear: 'both',
          width: '100%'
        }}
      >
        <Row gutter={[32, 32]}>
          <Col xs={24} md={10}>
            <Title level={4} style={{ color: '#fff', marginTop: 0 }}><span style={{ color: colors.accent }}>ATI</span>MANG</Title>
            <Paragraph style={{ color: '#B39999', textAlign: isMobile ? 'left' : 'justify' }}>
              Seu parceiro estratégico em suprimentos industriais e mecânicos. Especialistas em mangueiras hidráulicas automotivas, de lavadoras e industriais, rolamentos de alta performance, correias em V e óleos lubrificantes.
            </Paragraph>
          </Col>
          
          <Col xs={24} md={7}>
            <Title level={5} style={{ color: '#fff', marginTop: 0 }}>Nossos Serviços</Title>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: '2' }}>
              <li style={{ marginBottom: '8px' }}>• Prensagem de Mangueira Hidráulica Eficiente</li>
              <li style={{ marginBottom: '8px' }}>• Troca de Mangueiras de Lavadoras</li>
              <li style={{ marginBottom: '8px' }}>• Linha de Mangueiras de Freio e Direção</li>
              <li style={{ marginBottom: '8px' }}>• Distribuição de Rolamentos e Mancais</li>
              <li>• Correias Industriais e Óleo Hidráulico 68</li>
            </ul>
          </Col>
          
          <Col xs={24} md={7}>
            <Title level={5} style={{ color: '#fff', marginTop: 0 }}>Atendimento Industrial</Title>
            <Paragraph style={{ color: '#B39999', marginBottom: '8px' }}>
              <strong>Segunda a Sexta:</strong> 07:30 às 18:00
            </Paragraph>
            <Paragraph style={{ color: '#B39999', marginBottom: 0 }}>
              <strong>Sábados:</strong> 08:00 às 12:00 (Plantão de Prensagem)
            </Paragraph>
          </Col>
        </Row>
        
        <Divider style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />
        
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#8A7070' }}>
          © {new Date().getFullYear()} Atimang | Fornecedor de Componentes Hidráulicos e Industriais. Todos os direitos reservados.
        </div>
      </Footer>
      </Content>

   
    </Layout>
  );
};