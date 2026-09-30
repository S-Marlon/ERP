import React, { useState, useEffect } from 'react';
import { Card, Space, Button, Tooltip, Typography, Tag, Modal, Form, Input, Select, Tabs, message, Radio } from 'antd';
import { EditOutlined, DollarOutlined, FileTextOutlined, InfoCircleOutlined, InboxOutlined, PictureOutlined, ShopOutlined, ShareAltOutlined, SafetyCertificateOutlined, CodeSandboxOutlined, AppstoreOutlined, TagOutlined } from '@ant-design/icons';
import ImageDisplay from '../../../../components/ui/ImageGallery/ImageDysplay';

const { Text } = Typography;

interface FamiliaIdentidadeCardProps {
  grupoSelecionado?: {
    id?: string | number;
    nome?: string;
    descricao?: string;
    status?: string;
    tipoItem?: string;
    ncmPadrao?: string;
    cestPadrao?: string;
    unidadeBase?: string;
    cor?: string;
    imagem?: string;
    idMarca?: string | number;
    nomeMarca?: string;
    margemMinima?: number | string;
    margemMaxima?: number | string;
    markupPadrao?: number | string;
    estoqueMinimo?: number | string;
    loteMinimo?: number | string;
    curvaAbc?: string;
    comportamentoMarca?: string;
    prioridadeExposicao?: string;
    unidadeMedidaBase?: string;
    atributos?: Array<{ nome: string; classificacao?: string; valorPadraoFamilia?: string; valorPadraoGrupo?: string }>;
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
  const [activeTab, setActiveTab] = useState('1');
  const [form] = Form.useForm();

  useEffect(() => {
    if (grupoSelecionado && isModalOpen) {
      form.setFieldsValue({
        nome: grupoSelecionado.nome,
        status: grupoSelecionado.status,
        unidadeBase: grupoSelecionado.unidadeMedidaBase ?? grupoSelecionado.unidadeBase,
        tipoItem: grupoSelecionado.tipoItem,
        ncmPadrao: grupoSelecionado.ncmPadrao,
        cestPadrao: grupoSelecionado.cestPadrao,
        imagem: grupoSelecionado.imagem || grupoImage,
        cor: grupoSelecionado.cor || brandColor,
        idMarca: grupoSelecionado.idMarca,
        margemMinima: grupoSelecionado.margemMinima,
        margemMaxima: grupoSelecionado.margemMaxima,
        markupPadrao: grupoSelecionado.markupPadrao,
        estoqueMinimo: grupoSelecionado.estoqueMinimo,
        loteMinimo: grupoSelecionado.loteMinimo,
        curvaAbc: grupoSelecionado.curvaAbc,
        comportamentoMarca: grupoSelecionado.comportamentoMarca,
        prioridadeExposicao: grupoSelecionado.prioridadeExposicao,
      });
    }
  }, [grupoSelecionado, grupoImage, brandColor, form, isModalOpen]);

  const handleAbrirModalLocal = () => {
    setActiveTab('1');
    setIsModalOpen(true);
  };

  const handleFecharModal = () => {
    setIsModalOpen(false);
  };

  const handleSalvar = async () => {
    try {
      const values = await form.validateFields();
      if (onSalvarIdentidade) {
        onSalvarIdentidade({
          id: grupoSelecionado?.id,
          ...values,
          // A família guarda a unidade em 'unidadeMedidaBase'
          unidadeMedidaBase: values.unidadeBase,
        });
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('DETALHE DO ERRO DE VALIDAÇÃO:', error);
      const errorFields = error?.errorFields;
      if (errorFields && errorFields.length > 0) {
        const primeiroCampoComErro = errorFields[0].name[0];
        if (['nome', 'status', 'imagem', 'unidadeBase', 'tipoItem'].includes(primeiroCampoComErro)) {
          setActiveTab('1');
        } else if (['comportamentoMarca', 'prioridadeExposicao'].includes(primeiroCampoComErro)) {
          setActiveTab('2');
        } else if (['ncmPadrao', 'cestPadrao'].includes(primeiroCampoComErro)) {
          setActiveTab('3');
        } else if (['margemMinima', 'margemMaxima', 'markupPadrao'].includes(primeiroCampoComErro)) {
          setActiveTab('4');
        } else if (['estoqueMinimo', 'loteMinimo', 'curvaAbc'].includes(primeiroCampoComErro)) {
          setActiveTab('5');
        }
      }
      message.error('Por favor, verifique os campos obrigatórios nas abas.');
    }
  };

  const accentColor = grupoSelecionado?.cor || brandColor || "#618c3f";

  function setMarcaComportamento(novoComportamento: any) {
    throw new Error('Function not implemented.');
  }

  function setTemAlteracoes(arg0: boolean) {
    throw new Error('Function not implemented.');
  }

  return (
    <>
      <Card
        title={
          <Space size={8}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: accentColor,
                display: "inline-block",
                boxShadow: `0 0 0 2px ${accentColor}25`
              }}
            />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
              Identidade & Herança da Família
            </span>
          </Space>
        }
        size="small"
        style={{
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 4px 0 rgba(0, 0, 0, 0.02)",
          height: "100%",
        }}
        styles={{
          header: {
            borderBottom: "1px solid #f1f5f9",
            minHeight: "40px",
            background: "#f8fafc",
            borderRadius: "12px 12px 0 0",
            padding: "0 14px",
          },
          body: { padding: "14px" },
        }}
        extra={
          <Tooltip title="Editar Identidade e Regras">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ fontSize: "13px", color: accentColor }} />}
              onClick={handleAbrirModalLocal}
              style={{ fontWeight: 600 }}
            >
              Editar
            </Button>
          </Tooltip>
        }
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {/* Cabeçalho Principal com Imagem e Nome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '6px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
            <ImageDisplay
              size="44px"
              src={grupoSelecionado?.imagem || grupoImage || undefined}
              style={{
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid #e2e8f0",
                background: "#fff",
                flexShrink: 0
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: "#64748b", fontSize: "10px", display: "block", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Família Ativa
              </Text>
              <Text style={{ color: "#0f172a", fontSize: "14px", fontWeight: 800, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {grupoSelecionado?.nome || "Sem nome definido"}
              </Text>
            </div>
            <Tooltip title="Propagação Automática em Cascata Ativa para os SKUs Filhos">
              <Tag icon={<ShareAltOutlined />} color="success" style={{ margin: 0, fontSize: '10px', fontWeight: 600 }}>
                Herança Ativa
              </Tag>
            </Tooltip>

             {/* DESTAQUE: DNA Estrutural Macro (Exigência 1 do Guia) */}
          <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <Space size={4}>
                <CodeSandboxOutlined style={{ color: '#16a34a', fontSize: '12px' }} />
                <Text style={{ color: '#166534', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                  DNA Estrutural Macro (Herdado do Pai)
                </Text>
              </Space>
              <Tag color="green" style={{ fontSize: '9px', margin: 0, border: 'none' }}>Norma / Série</Tag>
            </div>
            <Text style={{ color: '#14532d', fontSize: '12px', fontWeight: 700, display: 'block' }}>
              {(() => {
                // DNA = atributos de papel DNA com o valor fixo da família (ex: Material: NBR)
                const dna = (grupoSelecionado?.atributos || []).filter(a => a.classificacao === 'dna');
                if (dna.length === 0) return 'Nenhum atributo de DNA configurado';
                return dna
                  .map(a => `${a.nome}: ${a.valorPadraoFamilia || a.valorPadraoGrupo || '(sem valor fixo)'}`)
                  .join(' · ');
              })()}
            </Text>
          </div>
          </div>


          {/* Grid de Atributos Chave Organizados por Blocos Visuais */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5 , 1fr)", gap: "8px" }}>


            
             {/* Bloco Estrutural / Identificação */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Marca
              </Text>
              <Text style={{ color: "#1e293b", fontSize: "12px", fontWeight: 700 }}>
                {grupoSelecionado?.nomeMarca || "Sem Marca"}
              </Text>
            </div>

             {/* Bloco Estrutural / Identificação */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Part Number
              </Text>
              <Text style={{ color: "#1e293b", fontSize: "12px", fontWeight: 700 }}>
                {grupoSelecionado?.unidadeBase || "Sem Marca"}
              </Text>
            </div>

            {/* Bloco Estrutural / Identificação */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Unidade Base
              </Text>
              <Text style={{ color: "#1e293b", fontSize: "12px", fontWeight: 700 }}>
                {grupoSelecionado?.unidadeBase || "PC"}
              </Text>
            </div>

            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Tipo SPED
              </Text>
              <Tag color="blue" style={{ margin: 0, fontSize: "10px", fontWeight: 700, border: 'none' }}>
                {grupoSelecionado?.tipoItem || "PA"}
              </Tag>
            </div>

            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                NCM Padrão
              </Text>
              <Text style={{ color: "#334155", fontSize: "11px", fontFamily: "monospace", fontWeight: 600 }}>
                {grupoSelecionado?.ncmPadrao || "Não informado"}
              </Text>
            </div>

            {/* Bloco Comercial / Margens */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Margem Mín / Máx
              </Text>
              <Text style={{ color: "#1e293b", fontSize: "11px", fontWeight: 700 }}>
                {grupoSelecionado?.margemMinima ? `${grupoSelecionado.margemMinima}%` : "-"} / {grupoSelecionado?.margemMaxima ? `${grupoSelecionado.margemMaxima}%` : "-"}
              </Text>
            </div>

            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Markup Padrão
              </Text>
              <Text style={{ color: "#0284c7", fontSize: "11px", fontWeight: 700 }}>
                {grupoSelecionado?.markupPadrao ? `${grupoSelecionado.markupPadrao}x` : "-"}
              </Text>
            </div>

            {/* Bloco Logístico / Estoque */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
              <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                Estoque Mín.
              </Text>
              <Text style={{ color: "#1e293b", fontSize: "11px", fontWeight: 700 }}>
                {grupoSelecionado?.estoqueMinimo || "Não def."}
              </Text>
            </div>

            {/* Rodapé do Card com Status de Governança */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9', gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text style={{ color: "#94a3b8", fontSize: "9px", display: "block", fontWeight: 700, textTransform: 'uppercase' }}>
                    Curva ABC / Classificação
                  </Text>
                  <Text style={{ color: "#1e293b", fontSize: "11px", fontWeight: 700 }}>
                    {grupoSelecionado?.curvaAbc ? `Curva ${grupoSelecionado.curvaAbc}` : "Não definida"}
                  </Text>
                </div>
                <Tooltip title="Governança ativa: SKUs sem atributos obrigatórios exigidos pela família bloqueiam exportação para Marketplaces.">
                  <Tag icon={<SafetyCertificateOutlined />} color="warning" style={{ margin: 0, fontSize: '10px' }}>
                    Bloqueio de Marketplaces Ativo
                  </Tag>
                </Tooltip>
              </div>
            </div>

          </div>

          {/* PREPARAÇÃO FUTURA: Aviso/Indicação visual dos Escopos Rígidos (Grades e Ficha Técnica dos Filhos) */}
          <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={6}>
              <AppstoreOutlined style={{ color: '#64748b', fontSize: '12px' }} />
             <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
             <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
             <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
             Comportamento da Marca nesta Família:
             </span>
             <Tooltip title="Define onde a marca atua: se é apenas Ficha Técnica, parte do DNA, ou Grade.">
             <InfoCircleOutlined style={{ fontSize: "12px", color: "#64748b", cursor: "pointer" }} />
             </Tooltip>
             </div>
             
             <div style={{ width: "350px", maxWidth: "100%" }}>
             
             <Radio.Group
             buttonStyle="solid"
             value={'marcaComportamento'}
             onChange={(e) => {
             const novoComportamento = e.target.value;
             if (typeof setMarcaComportamento === 'function') {
             setMarcaComportamento(novoComportamento);
             }
             // Força o gatilho de alterações pendentes na família local
             setTemAlteracoes(true);
             }}
             style={{ width: '100%', display: 'flex' }}
             size="small"
             >
             <Radio.Button value="dna" style={{ flex: 1, textAlign: 'center', fontSize: '11px' }}>
             <TagOutlined style={{ marginRight: '4px' }} /> DNA
             </Radio.Button>
             <Radio.Button value="grade" style={{ flex: 1, textAlign: 'center', fontSize: '11px' }}>
             <AppstoreOutlined style={{ marginRight: '4px' }} /> Grade (SKU)
             </Radio.Button>
             <Radio.Button value="ficha" style={{ flex: 1, textAlign: 'center', fontSize: '11px' }}>
             <FileTextOutlined style={{ marginRight: '4px' }} /> Ficha
             </Radio.Button>
             </Radio.Group>
             
             </div>
             </div>
             
             
             <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", width: "100%" }}>
                     
                   
             
                     {/* Bloco do Meio */}
                     <div style={{ 
                       padding: "10px", 
                       borderRadius: "8px", 
                      
                       transition: "all 0.3s ease",
                       display: "flex",
                       flexDirection: "column",
                       alignItems: "center",
                       justifyContent: "center",
                       textAlign: "center"
                     }}>
                       <span style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                         Posição: Grade (SKU)
                       </span>
                    
                     </div>
             
                     {/* Bloco da Direita */}
                     <div style={{ 
                       padding: "10px", 
                       borderRadius: "8px", 
                     
                       transition: "all 0.3s ease",
                       display: "flex",
                       flexDirection: "column",
                       alignItems: "center",
                       justifyContent: "center",
                       textAlign: "center"
                     }}>
                       <span style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                         Posição: Ficha
                       </span>
                       
                     </div>
             
                   </div>
            </Space>
            <Tag style={{ fontSize: '9px', margin: 0, color: '#64748b', background: '#f1f5f9', border: 'none' }}>Pronto p/ Expansão</Tag>
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
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: '12px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane={false}
            items={[
              {
                key: '1',
                label: (
                  <span>
                    <InfoCircleOutlined />
                    Identidade & DNA
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <Form.Item
                      name="nome"
                      label="Nome da Família"
                      rules={[{ required: true, message: 'Por favor, insira o nome da família!' }]}
                    >
                      <Input placeholder="Ex: Rolamento Rígido de Esferas" />
                    </Form.Item>

                    <Form.Item
                      name="status"
                      label="Status da Família"
                      tooltip="Rascunho: em estruturação, fora do PDV e dos canais. Bloqueada: definida pelo sistema quando faltam regras mínimas."
                    >
                      <Select
                        options={[
                          { value: 'RASCUNHO', label: 'Rascunho (em estruturação)' },
                          { value: 'ATIVO', label: 'Ativa' },
                          { value: 'INATIVO', label: 'Inativa' },
                          { value: 'BLOQUEADO_INCONSISTENCIA', label: 'Bloqueada por inconsistência', disabled: true },
                        ]}
                      />
                    </Form.Item>


                    <Form.Item name="imagem" label="URL da Imagem da Família">
                      <Input placeholder="https://..." prefix={<PictureOutlined />} />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <Form.Item name="unidadeBase" label="Unidade Base">
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
                    <ShopOutlined />
                    Comportamento da Marca
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                      <Form.Item name="prioridadeExposicao" label="Prioridade de Exposição">
                        <Select
                          placeholder="Selecione a prioridade"
                          options={[
                            { value: 'alta', label: 'Alta (Destaque principal)' },
                            { value: 'media', label: 'Média (Padrão)' },
                            { value: 'baixa', label: 'Baixa (Cauda longa)' },
                          ]}
                        />
                      </Form.Item>
                    </div>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      * Alinha o comportamento comercial desta família de acordo com as diretrizes da marca.
                    </Text>
                  </div>
                ),
              },
              {
                key: '3',
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
                      * Regras fiscais e exigências básicas herdadas em cascata para os SKUs filhos.
                    </Text>
                  </div>
                ),
              },
              {
                key: '4',
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
                key: '5',
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