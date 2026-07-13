import React, { useEffect, useState } from "react";
// Como está no seu código (Isso vai quebrar porque handlePrint precisa do estado que está lá dentro)
import { useRelatorioPoco } from "./useRelatorioPoco";
import {
    Form,
    Input,
    Row,
    Col,
    DatePicker,
    Button,
    Typography,
    Space,
    Checkbox,
    message,
    Card,
    InputNumber,
    Upload,
    Select,
    Collapse,
} from "antd";
import {
    PrinterOutlined,
    ArrowLeftOutlined,
    CompassOutlined,
    BuildOutlined,
    DashboardOutlined,
    UserOutlined,
    AlertOutlined,
    FileImageOutlined,
    SettingOutlined,
    ExperimentOutlined,
    UploadOutlined,
    DownloadOutlined,
    SaveOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

// IMPORTAÇÃO DAS FUNÇÕES DO SEU ARQUIVO DE LÓGICA

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

export default function RelatorioPocoPage() {



    const [isVazaoAprox, setIsVazaoAprox] = useState(false);
    const [isBombaVazao, setIsBombaVazao] = useState(false);




    // ESTADO DOS CHECKBOXES: Controla quais seções entram no relatório final
    const [secoesAtivas, setSecoesAtivas] = useState({
        dadosPoco: true,
        perfuracao: true,
        diagnostico: true,
        bombeamento: true,
        testeVazao: true
    });

    const handleToggleSecao = (secao) => {
        setSecoesAtivas(prev => ({ ...prev, [secao]: !prev[secao] }));
    };


    // 2. Use o hook aqui dentro. Ele vai te dar o 'form' correto e as funções calibradas.
    const {
        form,
        dtTermino,
        garantiaMeses,
        handleValuesChange,
        handlePrint,
        handleExportXML,
        handleImportXML
    } = useRelatorioPoco();


    // Mantemos o setFormData para o caso de renderizações atreladas ao PDF externo
    const [, setFormData] = useState<any>({});


    useEffect(() => {
        form.setFieldsValue({
            perfDe: 0,
            revDe: 0,
            perfDiamUnidade: '"',
            revDiamUnidade: '"',
            diamInternoUnidade: '"'
        });
        setFormData(form.getFieldsValue());
    }, [form]);

    const renderDataGarantiaCalculada = () => {
        if (!dtTermino || !garantiaMeses) return 'Selecione o término da obra e os meses';
        const dataCalculada = dayjs(dtTermino).add(garantiaMeses, 'month');
        return `Válida até: ${dataCalculada.format('DD/MM/YYYY')}`;
    };

    const selectUnidade = (name: string) => (
        <Form.Item name={name} noStyle>
            <Select style={{ width: 75 }}>
                <Option value='"'>pol (")</Option>
                <Option value="mm">mm</Option>
            </Select>
        </Form.Item>
    );

    const handleGetLocation = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    form.setFieldsValue({ localizacao: `${latitude}, ${longitude}` });
                    setFormData(form.getFieldsValue());
                    message.success("Coordenadas obtidas com sucesso!");
                },
                () => message.error("Erro ao obter localização do GPS.")
            );
        }
    };

    return (
        <div style={{ padding: "24px", backgroundColor: "#f5f7fa", minHeight: "100vh" }}>
            <div style={{ maxWidth: "1800px", margin: "0 auto", gap:'10px' }}>

                {/* BARRA DE CONTROLE SUPERIOR */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fff",
                    padding: "16px 24px",
                    borderRadius: "8px",
                    marginBottom: "24px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)"
                }}>
                    <Space size="middle">
                        <Button icon={<ArrowLeftOutlined />} href="/relatorios">Voltar</Button>
                        <Title level={4} style={{ margin: 0, color: "#1f1f1f", fontWeight: 600 }}>
                            Emissão de Relatório Técnico de Poço
                        </Title>
                    </Space>

                    <Space size="small">
                        {/* IMPORTAR: O Hook já gerencia o arquivo internamente */}
                        <Upload
                            beforeUpload={(file) => {
                                handleImportXML(file);
                                return false;
                            }}
                            showUploadList={false}
                            accept=".xml"
                        >
                            <Button icon={<UploadOutlined />}>Importar XML</Button>
                        </Upload>

                        {/* EXPORTAR: Não precisa passar 'form.getFieldsValue()', a função já usa o formData interno */}
                        <Button icon={<DownloadOutlined />} onClick={handleExportXML}>
                            Exportar XML
                        </Button>

                        {/* IMPRIMIR: Permanece igual, acionando a função direta do Hook */}
                        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint} style={{ fontWeight: 500 }}>
                            Gerar e Imprimir PDF
                        </Button>
                    </Space>
                </div>



                {/* FORMULÁRIO DE CAPTURA */}
               <Form 
    form={form} 
    layout="vertical" 
    size="middle" 
    onValuesChange={handleValuesChange}
    style={{ 
        display: "flex", 
        gap: "12px",          // Espaçamento entre o formulário e a barra lateral
        alignItems: "flex-start" // Mantém a barra lateral fixada no topo enquanto você rola o form
    }}
>
                    <Space direction="vertical" size="small" style={{ width: "30%" }} >
                        {/* SEÇÃO 1: DADOS DO CLIENTE */}
                        <Card
                            title={<Space><UserOutlined style={{ color: "#1890ff" }} /><span>Dados do Cliente</span></Space>}
                            bordered={false}
                            style={{ borderRadius: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
                        >
                            <Row gutter={[16, 0]}>
                                <Col xs={24} md={9}><Form.Item label="Nome do Cliente" name="cliente"><Input placeholder="Nome completo ou Razão Social" /></Form.Item></Col>
                                <Col xs={24} md={6}><Form.Item label="CPF/CNPJ" name="documento"><Input placeholder="000.000.000-00" /></Form.Item></Col>
                                <Col xs={24} md={9}><Form.Item label="Celular de Contato" name="celular"><Input placeholder="(00) 00000-0000" /></Form.Item></Col>
                                <Col xs={12} md={4}><Form.Item label="CEP" name="cep"><Input placeholder="00000-000" /></Form.Item></Col>
                                <Col xs={24} md={9}><Form.Item label="Endereço (Rua, Nº)" name="endereco"><Input placeholder="Av. Principal, 123" /></Form.Item></Col>
                                <Col xs={24} md={5}><Form.Item label="Bairro" name="bairro"><Input placeholder="Centro" /></Form.Item></Col>
                                <Col xs={24} md={4}><Form.Item label="Cidade" name="cidade"><Input placeholder="São Paulo" /></Form.Item></Col>
                                <Col xs={12} md={2}><Form.Item label="UF" name="uf"><Input maxLength={2} style={{ textTransform: "uppercase" }} placeholder="SP" /></Form.Item></Col>
                            </Row>
                        </Card>

                        {/* ========================================== */}
                        {/* ESTRUTURA EM SANFONA PARA O RESTANTE       */}
                        {/* ========================================== */}

                        {/* SANFONA 1: DADOS DO POÇO */}
                        {secoesAtivas.dadosPoco && (
                            <Panel
                                header={<Space><DashboardOutlined style={{ color: "#1890ff" }} /><b>1. Dados do Poço</b></Space>}
                                key="dadosPoco"
                                style={{ marginBottom: '16px', background: '#fff', borderRadius: '8px', border: 'none', boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
                            >
                                <Row gutter={[16, 0]}>
                                    <Col xs={24} md={10}>
                                        <Form.Item label="Localização (GPS)" name="localizacao">
                                            <Input placeholder="Coordenadas de Latitude e Longitude" addonAfter={<Button type="text" size="small" icon={<CompassOutlined />} onClick={handleGetLocation} style={{ padding: "0 4px", height: "auto" }}>Obter GPS</Button>} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={6} md={3}><Form.Item label="Última Limpeza" name="dtLimpeza"><DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} /></Form.Item></Col>
                                    <Col xs={12} sm={10} md={4}>
                                        <Form.Item label="Vazão Aproximada" name="vazaoAprox" normalize={(value) => { if (!value) return ''; const limpo = value.replace('~', ''); return isVazaoAprox ? `~${limpo}` : limpo; }}>
                                            <Input addonAfter="L/h" placeholder="5000" addonBefore={<Button type={isVazaoAprox ? "primary" : "text"} size="small" style={{ height: '100%', margin: '-4px -11px', borderRadius: '4px 0 0 4px', backgroundColor: isVazaoAprox ? '#1890ff' : 'transparent', color: isVazaoAprox ? '#fff' : '#8c8c8c', fontWeight: 'bold' }} onClick={() => { const novoEstado = !isVazaoAprox; setIsVazaoAprox(novoEstado); const valorAtual = form.getFieldValue('vazaoAprox') || ''; const valorLimpo = valorAtual.replace('~', ''); form.setFieldsValue({ vazaoAprox: novoEstado ? `~${valorLimpo}` : valorLimpo }); }}>~</Button>} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} sm={12} md={4}><Form.Item label="Profundidade do Poço" name="profundidade"><InputNumber min={0} style={{ width: "100%" }} addonAfter="m" placeholder="0.00" /></Form.Item></Col>
                                    <Col xs={12} sm={12} md={3}><Form.Item label="Diâmetro Interno" name="diametroInterno"><InputNumber style={{ width: "100%" }} placeholder="0.0" min={0} addonAfter={selectUnidade('diamInternoUnidade')} /></Form.Item></Col>
                                </Row>
                            </Panel>
                        )}

                        {/* SEÇÃO 2: DADOS DA OBRA */}
                        <Card
                            title={<Space><DashboardOutlined style={{ color: "#1890ff" }} /><span>Dados do Poço</span></Space>}
                            bordered={false}
                            style={{ borderRadius: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
                        >
                            <Row gutter={[16, 0]}>
                                <Col xs={10}>
                                    <Form.Item label="Localização (GPS)" name="localizacao">
                                        <Input
                                            placeholder="Coordenadas de Latitude e Longitude"
                                            addonAfter={
                                                <Button type="text" size="small" icon={<CompassOutlined />} onClick={handleGetLocation} style={{ padding: "0 4px", height: "auto" }}>
                                                    Obter GPS
                                                </Button>
                                            }
                                        />
                                    </Form.Item>
                                </Col>

                                <Col xs={10} sm={6} md={3}><Form.Item label="Última Limpeza" name="dtLimpeza"><DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} /></Form.Item></Col>




                                <Col xs={12} sm={10} md={4}>
                                    <Form.Item
                                        label="Vazão Aproximada"
                                        name="vazaoAprox"
                                        normalize={(value) => {
                                            if (!value) return '';
                                            // Limpa qualquer '~' existente para não duplicar
                                            const limpo = value.replace('~', '');
                                            // Se estiver ativo, salva com '~', senão salva só o valor limpo
                                            return isVazaoAprox ? `~${limpo}` : limpo;
                                        }}
                                    >
                                        <Input
                                            addonAfter="L/h"
                                            placeholder="5000"
                                            addonBefore={
                                                <Button
                                                    type={isVazaoAprox ? "primary" : "text"}
                                                    size="small"
                                                    style={{
                                                        height: '100%',
                                                        margin: '-4px -11px', // Ajuste para casar perfeitamente no design do Antd
                                                        borderRadius: '4px 0 0 4px',
                                                        backgroundColor: isVazaoAprox ? '#1890ff' : 'transparent',
                                                        color: isVazaoAprox ? '#fff' : '#8c8c8c',
                                                        fontWeight: 'bold'
                                                    }}
                                                    onClick={() => {
                                                        const novoEstado = !isVazaoAprox;
                                                        setIsVazaoAprox(novoEstado);

                                                        // Força o formulário a se atualizar imediatamente com o novo formato
                                                        const valorAtual = form.getFieldValue('vazaoAprox') || '';
                                                        const valorLimpo = valorAtual.replace('~', '');
                                                        form.setFieldsValue({
                                                            vazaoAprox: novoEstado ? `~${valorLimpo}` : valorLimpo
                                                        });
                                                    }}
                                                >
                                                    ~
                                                </Button>
                                            }
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} sm={12} md={4}><Form.Item label="Profundidade do Poço" name="profundidade"><InputNumber min={0} style={{ width: "100%" }} addonAfter="m" placeholder="0.00" /></Form.Item></Col>

                                <Col xs={12} sm={12} md={3}>
                                    <Form.Item label="Diâmetro Interno" name="diametroInterno">
                                        <InputNumber style={{ width: "100%" }} placeholder="0.0" min={0} addonAfter={selectUnidade('diamInternoUnidade')} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                    </Space>

                    <Space direction="vertical" size="large" style={{ width: "55%" }} >
                        <Collapse
                            expandIconPosition="right"
                            style={{ background: 'transparent', border: 'none' }}
                            // Abre todas as seções que estiverem ativas por padrão para facilitar o fluxo contínuo
                            activeKey={Object.keys(secoesAtivas).filter(key => secoesAtivas[key])}
                        >



                           {/* SANFONA 2: PERFURAÇÃO E REVESTIMENTO */}
{secoesAtivas.perfuracao && (
    <Panel
        header={
            <Space>
                <BuildOutlined style={{ color: "#8c5e3c" }} />
                <b style={{ color: "#543d2b" }}>2. Dados de Perfuração e Revestimento</b>
            </Space>
        }
        key="perfuracao"
        style={{ 
            marginBottom: '16px', 
            background: '#fbf8f5', // Fundo marrom terroso bem suave
            borderRadius: '8px', 
            border: '1px solid #e6ded6', // Borda sutil combinando com o fundo
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)" 
        }}
    >
        {/* Cabeçalho de Datas e Informações Gerais */}
        <Row gutter={[16, 12]}>
            <Col xs={12} sm={6} md={5}>
                <Form.Item label="Data de Início" name="dtInicio">
                    <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
                </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={5}>
                <Form.Item label="Data de Término" name="dtTermino">
                    <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
                </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
                <Form.Item label="Tipo de Solo" name="tipoSolo">
                    <Select placeholder="Selecione o tipo de solo">
                        <Option value="Arenoso">Arenoso</Option>
                        <Option value="Argiloso">Argiloso</Option>
                        <Option value="Silte">Silte (Caxeta)</Option>
                        <Option value="Rocha Alterada">Rocha Alterada</Option>
                        <Option value="Rocha Sã (Cristalino)">Rocha Sã (Cristalino)</Option>
                        <Option value="Sedimentar">Sedimentar (Misto)</Option>
                    </Select>
                </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
                <Form.Item label="Período de Garantia" name="garantiaMeses" style={{ marginBottom: '4px' }}>
                    <Select placeholder="Selecione" style={{ width: "100%" }}>
                        {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
                            <Option key={mes} value={mes}>{mes} Meses</Option>
                        ))}
                    </Select>
                </Form.Item>
               
            </Col>
            <Col xs={24} sm={12} md={4}>

 <div style={{ minHeight: "20px" }}>
                    <Text type="secondary" strong style={{ fontSize: "11px", color: "#52c41a" }}>
                        {renderDataGarantiaCalculada()}
                    </Text>
                </div>
            </Col>


        </Row>

        {/* SUB-SEÇÕES DINÂMICAS EM DUAS COLUNAS */}
        <Row gutter={[16, 16]} style={{ marginTop: '12px' }}>
            
            {/* SUB-SEÇÃO DINÂMICA: PERFURAÇÃO */}
            <Col xs={24} lg={12}>
                <Card 
                    size="small" 
                    title={<span style={{ fontSize: '12px', color: '#543d2b' }}>PERFURAÇÃO (ETAPAS / CAMADAS)</span>}
                    style={{ background: "#ffffff", borderRadius: "6px", border: "1px solid #ebdcd0" }}
                >
                    <Form.List name="perfuracoes" initialValue={[{ perfDe: 0 }, {}]}>
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }, index) => (
                                    <Row gutter={[8, 8]} key={key} style={{ alignItems: 'flex-end', marginBottom: '8px' }}>
                                        <Col xs={5} md={4}>
                                            <Form.Item {...restField} label={index === 0 ? "De" : ""} name={[name, 'perfDe']}>
                                                <InputNumber style={{ width: "100%" }} addonAfter="m" disabled placeholder="0" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={6} md={5}>
                                            <Form.Item {...restField} label={index === 0 ? "Até" : ""} name={[name, 'perfAte']}>
                                                <InputNumber 
                                                    style={{ width: "100%" }} 
                                                    addonAfter="m" 
                                                    placeholder={index === 0 ? "Ex: 35" : "Ex: 90"} 
                                                    onChange={(val) => { 
                                                        if (fields[index + 1] !== undefined && val !== null) { 
                                                            const valores = form.getFieldValue('perfuracoes'); 
                                                            valores[index + 1].perfDe = val; 
                                                            form.setFieldsValue({ perfuracoes: valores }); 
                                                        } 
                                                    }} 
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={9} md={11}>
                                            <Form.Item {...restField} label={index === 0 ? "Diâmetro" : ""} name={[name, 'perfDiam']}>
                                                <InputNumber 
                                                    style={{ width: "100%" }} 
                                                    placeholder="0.0" 
                                                    addonAfter={
                                                        <Form.Item name={[name, 'perfDiamUnidade']} noStyle initialValue={'"'}>
                                                            <Select style={{ width: 68 }} size="small">
                                                                <Option value='"'>pol (")</Option>
                                                                <Option value="mm">mm</Option>
                                                            </Select>
                                                        </Form.Item>
                                                    } 
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={4} md={4} style={{ display: 'flex', justifyContent: 'center' }}>
                                            {index > 1 ? (
                                                <Button type="text" danger onClick={() => remove(name)} style={{ padding: 0, height: '32px' }}>Remover</Button>
                                            ) : (
                                                <div style={{ height: '32px' }} /> // Spacer estrutural
                                            )}
                                        </Col>
                                    </Row>
                                ))}
                                <Button type="dashed" onClick={() => { const lista = form.getFieldValue('perfuracoes') || []; const ultimoAte = lista[lista.length - 1]?.perfAte || 0; add({ perfDe: ultimoAte }); }} block style={{ marginTop: '8px', color: '#8c5e3c', borderColor: '#ebdcd0' }}>
                                    + Adicionar Linha de Perfuração
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Card>
            </Col>

            {/* SUB-SEÇÃO DINÂMICA: REVESTIMENTO */}
            <Col xs={24} lg={12}>
                <Card 
                    size="small" 
                    title={<span style={{ fontSize: '12px', color: '#543d2b' }}>REVESTIMENTO</span>}
                    style={{ background: "#ffffff", borderRadius: "6px", border: "1px solid #ebdcd0" }}
                >
                    <Form.List name="revestimentos" initialValue={[{ revDe: 0 }]}>
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }, index) => (
                                    <Row gutter={[6, 6]} key={key} style={{ alignItems: 'flex-end', marginBottom: '8px' }}>
                                        <Col xs={4} md={3}>
                                            <Form.Item {...restField} label={index === 0 ? "De" : ""} name={[name, 'revDe']}>
                                                <InputNumber style={{ width: "100%" }} addonAfter="m" disabled placeholder="0" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={5} md={4}>
                                            <Form.Item {...restField} label={index === 0 ? "Até" : ""} name={[name, 'revAte']}>
                                                <InputNumber 
                                                    style={{ width: "100%" }} 
                                                    addonAfter="m" 
                                                    placeholder="35" 
                                                    onChange={(val) => { 
                                                        if (fields[index + 1] !== undefined && val !== null) { 
                                                            const valores = form.getFieldValue('revestimentos'); 
                                                            valores[index + 1].revDe = val; 
                                                            form.setFieldsValue({ revestimentos: valores }); 
                                                        } 
                                                    }} 
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={6} md={6}>
                                            <Form.Item {...restField} label={index === 0 ? "Diâmetro" : ""} name={[name, 'revDiam']}>
                                                <InputNumber 
                                                    style={{ width: "100%" }} 
                                                    placeholder="0.0" 
                                                    addonAfter={
                                                        <Form.Item name={[name, 'revDiamUnidade']} noStyle initialValue={'"'}>
                                                            <Select style={{ width: 55 }} size="small"><Option value='"'>"</Option><Option value="mm">mm</Option></Select>
                                                        </Form.Item>
                                                    } 
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={5} md={4}>
                                            <Form.Item {...restField} label={index === 0 ? "Mat." : ""} name={[name, 'revMaterial']}>
                                                <Input placeholder="PVC" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={4} md={4}>
                                            <Form.Item {...restField} label={index === 0 ? "União" : ""} name={[name, 'revUniao']}>
                                                <Input placeholder="Rosca" />
                                            </Form.Item>
                                        </Col>
                                        {index > 0 && (
                                            <Col xs={24} style={{ textAlign: 'right', marginTop: '-4px' }}>
                                                <Button type="text" danger size="small" onClick={() => remove(name)} style={{ padding: 0 }}>remover revestimento</Button>
                                            </Col>
                                        )}
                                    </Row>
                                ))}
                                <Button type="dashed" onClick={() => { const lista = form.getFieldValue('revestimentos') || []; const ultimoAte = lista[lista.length - 1]?.revAte || 0; add({ revDe: ultimoAte }); }} block style={{ marginTop: '8px', color: '#8c5e3c', borderColor: '#ebdcd0' }}>
                                    + Adicionar Revestimento Extra
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Card>
            </Col>
        </Row>

        {/* OUTROS REGISTROS DE CONSTRUÇÃO */}
        <div style={{ marginTop: '16px', background: "#ffffff", padding: "16px", borderRadius: "6px", border: "1px solid #ebdcd0" }}>
            <span style={{ fontWeight: "600", display: "block", marginBottom: "12px", color: "#543d2b", fontSize: "12px" }}>
                REGISTROS DE CONSTRUÇÃO E GEOLOGIA
            </span>
            <Row gutter={[16, 12]} style={{ marginBottom: '16px' }}>
                <Col xs={24} sm={12}>
                    <Form.Item name="chkCaimento" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>⚠️ Ocorrência de Caimento / Desmoronamento</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                    <Form.Item name="chkEstruturas" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>🏗️ Interferência com Estruturas Subterrâneas</Checkbox>
                    </Form.Item>
                </Col>
            </Row>
            <Row gutter={[16, 12]}>
                <Col xs={24} md={12}>
                    <Form.Item label="Equipe de Perfuração / Sonda" name="equipePerfuracao">
                        <Input placeholder="Sondador..." />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item label="Responsável Técnico" name="respNomePerf">
                        <Input placeholder="Engenheiro/Geólogo" />
                    </Form.Item>
                </Col>
                <Col xs={24}>
                    <Form.Item label="Observações Geológicas" name="obsGeraisPerfuracao">
                        <TextArea rows={2} placeholder="Descreva o comportamento geológico..." />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    </Panel>
)}

                         {/* SANFONA 3: DIAGNÓSTICO TÉCNICO */}
{secoesAtivas.diagnostico && (
    <Panel
        header={
            <Space>
                <ExperimentOutlined style={{ color: "#08979c" }} />
                <b style={{ color: "#00474f" }}>3. Diagnóstico Técnico</b>
            </Space>
        }
        key="diagnostico"
        style={{ 
            marginBottom: '16px', 
            background: '#ffffff', 
            borderRadius: '8px', 
            border: '1px solid #d9d9d9', 
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)" 
        }}
    >
        {/* BLOCO 1: DINÂMICA E ÁGUA */}
        <div style={{ 
            background: "#f0f7f7", // Azul-ciano suave (laboratorial)
            padding: "16px", 
            borderRadius: "6px", 
            border: "1px solid #c4e8e8", 
            marginBottom: '16px' 
        }}>
            <span style={{ fontWeight: "600", display: "block", marginBottom: "12px", color: "#08979c", fontSize: "12px" }}>
                DINÂMICA DO POÇO E QUALIDADE DA ÁGUA
            </span>
            
            {/* Checkboxes organizados em grid fluido */}
            <Row gutter={[16, 12]} style={{ marginBottom: '16px' }}>
                <Col xs={24} sm={12} md={6}>
                    <Form.Item name="chkReducaoVazao" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>📉 Queda de Vazão</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Form.Item name="chkPresencaFerro" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>🧪 Água Vermelha / Ferro</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Form.Item name="chkAguaNaoLimpou" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>⏳ Água Turva</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Form.Item name="chkLajeInfiltracao" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>🛡️ Risco na Laje</Checkbox>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 12]}>
                <Col xs={24} md={8}>
                    <Form.Item label="Ciclo de Limpeza Química" name="manutPeriodicidadeLimpeza">
                        <Select placeholder="Selecione">
                            <Option value="6_meses">A cada 6 meses</Option>
                            <Option value="12_meses">Anual</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                    <Form.Item label="Diretrizes do Plano Mensal" name="manutDiretrizesTexto">
                        <TextArea rows={1} autoSize={{ minRows: 1, maxRows: 3 }} placeholder="Ex: Monitorar decaimento de vazão e nível dinâmico..." />
                    </Form.Item>
                </Col>
            </Row>
        </div>

        {/* BLOCO 2: MOTOBOMBA */}
        <div style={{ 
            background: "#f8f9fa", // Cinza-técnico industrial
            padding: "16px", 
            borderRadius: "6px", 
            border: "1px solid #e9ecef" 
        }}>
            <span style={{ fontWeight: "600", display: "block", marginBottom: "12px", color: "#495057", fontSize: "12px" }}>
                DIAGNÓSTICO DO CONJUNTO MOTOBOMBA (PARTE ELÉTRICA)
            </span>
            
            <Row gutter={[16, 12]} style={{ marginBottom: '16px' }}>
                <Col xs={24} sm={12}>
                    <Form.Item name="chkEnergiaRuim" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>⚡ Oscilação de Energia</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                    <Form.Item name="chkAquecimentoBomba" valuePropName="checked" style={{ margin: 0 }}>
                        <Checkbox>🔥 Superaquecimento do Motor</Checkbox>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 12]}>
                <Col xs={24} sm={12}>
                    <Form.Item label="Amperagem (Leitura Atual)" name="manutAmperagem">
                        <InputNumber style={{ width: "100%" }} addonAfter="A" placeholder="0.0" />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                    <Form.Item label="Resistência de Isolamento" name="manutMegometro">
                        <InputNumber style={{ width: "100%" }} addonAfter="MΩ" placeholder="Ex: >200" />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    </Panel>
)}

                          {/* SANFONA 4: CONJUNTO DE BOMBEAMENTO */}
{secoesAtivas.bombeamento && (
    <Panel
        header={
            <Space>
                <SettingOutlined style={{ color: "#006d77" }} />
                <b style={{ color: "#004d54" }}>4. Sistema de Bombeamento e Instalação</b>
            </Space>
        }
        key="bombeamento"
        style={{ 
            marginBottom: '16px', 
            background: '#f4f7f9', // Azul-petróleo industrial bem suave
            borderRadius: '8px', 
            border: '1px solid #d1dee2', 
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)" 
        }}
    >
        {/* BLOCO 1: ESPECIFICAÇÕES DO CONJUNTO E TUBULAÇÃO */}
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "6px", border: "1px solid #e1e8eb", marginBottom: '16px' }}>
            <span style={{ fontWeight: "600", display: "block", marginBottom: "16px", color: "#006d77", fontSize: "12px" }}>
                ESPECIFICAÇÕES DA BOMBA E ESTRUTURA EDUTORA
            </span>
            
            <Row gutter={[16, 4]}>
                <Col xs={24} sm={12} md={8}><Form.Item label="Marca da Bomba" name="bombaMarca"><Input placeholder="Ex: Ebara" /></Form.Item></Col>
                <Col xs={24} sm={12} md={8}><Form.Item label="Motor (Modelo/Potência)" name="imgMotorModelo"><Input placeholder="Ex: Franklin 5HP" /></Form.Item></Col>
                <Col xs={24} sm={12} md={8}><Form.Item label="Bombeador" name="imgBombeadorModelo"><Input placeholder="Ex: 4R5ST-18" /></Form.Item></Col>
                
                <Col xs={24} sm={12} md={8}><Form.Item label="Data de Instalação" name="bombaDtInstalacao"><DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} /></Form.Item></Col>
                <Col xs={24} sm={12} md={8}><Form.Item label="Cabeamento Utilizado" name="bombaCabeamento"><Input placeholder="Ex: 3x4mm²" /></Form.Item></Col>
                <Col xs={24} sm={12} md={8}><Form.Item label="Cavalete de Saída" name="bombaCavalete"><Input placeholder="Ex: PEAD / Ferro Galv." /></Form.Item></Col>
            </Row>

            <hr style={{ border: '0', borderTop: '1px dashed #e1e8eb', margin: '8px 0 16px 0' }} />

            <Row gutter={[16, 4]}>
                <Col xs={12} sm={8} md={4}><Form.Item label="Qtd. Tubos (Barras)" name="bombaQtdTubos"><InputNumber min={0} style={{ width: "100%" }} placeholder="0" /></Form.Item></Col>
                <Col xs={12} sm={8} md={4}><Form.Item label="Comp. do Tubo" name="bombaTamTubo"><InputNumber min={0} style={{ width: "100%" }} addonAfter="m" placeholder="6" /></Form.Item></Col>
                <Col xs={12} sm={8} md={5}><Form.Item label="Medida/Diâmetro" name="bombaMedidaTubo"><Input addonAfter={selectUnidade('bombaTuboUnidade')} placeholder="Ex: 2" /></Form.Item></Col>
                <Col xs={12} sm={12} md={6}>
                    <Form.Item label="Material Tubo Edutor" name="bombaTubulacao">
                        <Select placeholder="Selecione">
                            <Option value="Aço Galvanizado">Aço Galvanizado</Option>
                            <Option value="PVC Geomecânico">PVC Geomecânico</Option>
                            <Option value="Tubo Flexível">Tubo Flexível (Subteck/PEX)</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={5}><Form.Item label="Profundidade da Bomba" name="bombaProfundidade"><InputNumber style={{ width: "100%" }} addonAfter="m" placeholder="Ex: 80" /></Form.Item></Col>
            </Row>
        </div>

        {/* BLOCO 2: DADOS OPERACIONAIS E COMPLEMENTARES */}
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "6px", border: "1px solid #e1e8eb" }}>
            <span style={{ fontWeight: "600", display: "block", marginBottom: "16px", color: "#006d77", fontSize: "12px" }}>
                NÍVEIS OPERACIONAIS E RESPONSABILIDADE
            </span>

            <Row gutter={[16, 4]}>
                <Col xs={12} sm={12} md={6}><Form.Item label="Nível Estático (NE)" name="bombaNivelEstatico"><InputNumber style={{ width: "100%" }} addonAfter="m" placeholder="0.00" /></Form.Item></Col>
                <Col xs={12} sm={12} md={6}><Form.Item label="Nível Dinâmico (ND)" name="bombaNivelDinamico"><InputNumber style={{ width: "100%" }} addonAfter="m" placeholder="0.00" /></Form.Item></Col>
                <Col xs={24} md={12}>
                    <Form.Item 
                        label="Vazão Estimada de Operação" 
                        name="bombaVazaoEstimada" 
                        normalize={(value) => { if (!value) return ''; const limpo = value.replace('~', ''); return isBombaVazao ? `~${limpo}` : limpo; }}
                    >
                        <Input 
                            addonAfter="L/h" 
                            placeholder="Ex: 5000"
                            addonBefore={
                                <Button 
                                    type={isBombaVazao ? "primary" : "text"} 
                                    size="small" 
                                    style={{ 
                                        height: '100%', 
                                        margin: '-4px -11px', 
                                        borderRadius: '4px 0 0 4px', 
                                        backgroundColor: isBombaVazao ? '#006d77' : 'transparent', 
                                        color: isBombaVazao ? '#fff' : '#8c8c8c', 
                                        fontWeight: 'bold' 
                                    }} 
                                    onClick={() => { 
                                        const novoEstado = !isBombaVazao; 
                                        setIsBombaVazao(novoEstado); 
                                        const valorAtual = form.getFieldValue('bombaVazaoEstimada') || ''; 
                                        const valorLimpo = valorAtual.replace('~', ''); 
                                        form.setFieldsValue({ bombaVazaoEstimada: novoEstado ? `~${valorLimpo}` : valorLimpo }); 
                                    }}
                                >
                                    ~
                                </Button>
                            } 
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 4]} style={{ marginTop: '8px' }}>
                <Col xs={24} sm={12} md={12}><Form.Item label="Equipe de Instalação" name="equipeInstalacaoBomba"><Input placeholder="Nome da equipe/empresa" /></Form.Item></Col>
                <Col xs={24} sm={12} md={12}><Form.Item label="Nome do Responsável" name="respNomeBomba"><Input placeholder="Técnico/Sondador responsável" /></Form.Item></Col>
                <Col xs={24}><Form.Item label="Observações Gerais do Bombeamento" name="bombaObsGerais"><TextArea rows={2} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Descreva particularidades da instalação elétrica ou hidráulica..." /></Form.Item></Col>
            </Row>
        </div>
    </Panel>
)}

                           {/* SANFONA 5: TESTE DE VAZÃO */}
{secoesAtivas.testeVazao && (
    <Panel
        header={
            <Space>
                <DashboardOutlined style={{ color: "#1d39c4" }} />
                <b style={{ color: "#061178" }}>5. Teste de Vazão e Parâmetros Hidrodinâmicos</b>
            </Space>
        }
        key="testeVazao"
        style={{ 
            marginBottom: '16px', 
            background: '#f0f5ff', // Azul dinâmico/hidrodinâmico sutil
            borderRadius: '8px', 
            border: '1px solid #adc6ff', 
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)" 
        }}
    >
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "6px", border: "1px solid #d6e4ff" }}>
            <span style={{ fontWeight: "600", display: "block", marginBottom: "16px", color: "#1d39c4", fontSize: "12px" }}>
                DADOS EXTRAÍDOS DO ENSAIO DE VAZÃO
            </span>

            {/* Parâmetros rápidos adicionados para enriquecer a seção */}
            <Row gutter={[16, 12]} style={{ marginBottom: '8px' }}>
                <Col xs={24} sm={8}>
                    <Form.Item label="Duração do Ensaio" name="testeVazaoDuracao">
                        <InputNumber style={{ width: "100%" }} addonAfter="horas" placeholder="Ex: 24" />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="Método Utilizado" name="testeVazaoMetodo">
                        <Select placeholder="Selecione">
                            <Option value="Fluxo Contínuo">Fluxo Contínuo</Option>
                            <Option value="Estágios">Estágios Reversíveis</Option>
                            <Option value="Air-Lift">Air-Lift (Compressores)</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                    <Form.Item label="Vazão Estabilizada" name="testeVazaoEstabilizada">
                        <InputNumber style={{ width: "100%" }} addonAfter="m³/h" placeholder="0.00" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 0]}>
                <Col xs={24}>
                    <Form.Item 
                        label="Comportamento da Região e Parâmetros Estendidos" 
                        name="testeVazaoDados"
                        style={{ marginBottom: 0 }}
                    >
                        <TextArea 
                            rows={4} 
                            autoSize={{ minRows: 4, maxRows: 8 }} 
                            placeholder="Descreva detalhadamente o comportamento do nível dinâmico durante as horas de teste, a recuperação do aquífero e as características geográficas ou climáticas marcantes da região..." 
                        />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    </Panel>
)}

                        </Collapse>
                    </Space>

                    <Space direction="vertical" size="large" style={{ width: "15%" }}>

                        {/* SELETOR DE SEÇÕES (PAINEL DE CONTROLE DO OPERADOR) */}
                        <Card
                            title="Seções do Relatório Final"
                            size="small"
                            style={{
                                borderRadius: "8px",
                                border: "1px solid #d9d9d9",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                            }}
                        >
                            {/* Mudamos para vertical para caber perfeitamente na barra de 20% */}
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <Checkbox checked disabled style={{ color: '#1890ff', fontWeight: 'bold' }}>
                                    👤 Dados do Cliente (Fixo)
                                </Checkbox>
                                <Checkbox checked={secoesAtivas.dadosPoco} onChange={() => handleToggleSecao('dadosPoco')}>
                                    📊 1. Dados do Poço
                                </Checkbox>
                                <Checkbox checked={secoesAtivas.perfuracao} onChange={() => handleToggleSecao('perfuracao')}>
                                    🏗️ 2. Perfuração e Revestimento
                                </Checkbox>
                                <Checkbox checked={secoesAtivas.diagnostico} onChange={() => handleToggleSecao('diagnostico')}>
                                    🧪 3. Diagnóstico Técnico
                                </Checkbox>
                                <Checkbox checked={secoesAtivas.bombeamento} onChange={() => handleToggleSecao('bombeamento')}>
                                    ⚙️ 4. Sistema de Bombeamento
                                </Checkbox>
                                <Checkbox checked={secoesAtivas.testeVazao} onChange={() => handleToggleSecao('testeVazao')}>
                                    🧪 5. Teste de Vazão
                                </Checkbox>
                            </Space>
                        </Card>

                        {/* PAINEL DE AÇÕES E IMPRESSÃO */}
                        <Card
                            title="Ações"
                            size="small"
                            style={{
                                borderRadius: "8px",
                                border: "1px solid #d9d9d9",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                            }}
                        >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                {/* Botão de Imprimir / Gerar PDF */}
                                <Button
                                    type="primary"
                                    icon={<PrinterOutlined />}
                                    block
                                    onClick={handlePrint} // Substitua pela sua função de impressão
                                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} // Tom verde para destaque de conclusão
                                >
                                    Imprimir Relatório
                                </Button>

                                {/* Botão de Salvar Rascunho */}
                                <Button
                                    icon={<SaveOutlined />}
                                    block
                                    onClick={handlePrint} // Substitua pela sua função de salvar
                                >
                                    Salvar Rascunho
                                </Button>

                                {/* Botão de Limpar Seleção (Opcional) */}
                                <Button
                                    danger
                                    type="text"
                                    block
                                    onClick={handlePrint} // Substitua pela sua função de reset
                                    style={{ fontSize: '12px' }}
                                >
                                    Resetar Filtros
                                </Button>
                            </Space>
                        </Card>

                    </Space>





                </Form>
            </div>
        </div>
    );
}