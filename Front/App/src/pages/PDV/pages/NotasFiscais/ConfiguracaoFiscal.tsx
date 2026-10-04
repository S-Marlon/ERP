// Configuração fiscal: dados da empresa emitente e como emitir (ambiente, provedor ou direto, fila ou automático, numeração, tributação)
import React, { useEffect, useState } from 'react';
import { Alert, AutoComplete, Button, Card, Col, Form, Input, InputNumber, Radio, Row, Select, Space, Spin, Typography, message } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import { ConfigFiscal, DadosConfiguracao, EmitenteFiscal, fiscalApi } from './fiscalApi';

const { Text } = Typography;

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

interface Valores { emitente: Partial<EmitenteFiscal>; configuracao: ConfigFiscal }

export const ConfiguracaoFiscal: React.FC<{ onSalvo?: (d: DadosConfiguracao) => void }> = ({ onSalvo }) => {
  const [form] = Form.useForm<Valores>();
  const [dados, setDados] = useState<DadosConfiguracao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emissor = Form.useWatch(['configuracao', 'emissor'], form);
  const ambiente = Form.useWatch(['configuracao', 'ambiente'], form);

  const aplicar = (d: DadosConfiguracao) => {
    setDados(d);
    form.setFieldsValue({ emitente: d.emitente || { crt: 4, uf: 'SP' }, configuracao: d.config });
  };
  useEffect(() => { fiscalApi.configuracao().then(aplicar).catch(e => message.error(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async (v: Valores) => {
    setSalvando(true);
    try {
      const d = await fiscalApi.salvarConfiguracao(v.emitente, v.configuracao);
      aplicar(d);
      onSalvo?.(d);
      message.success('Configuração fiscal salva.');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (!dados) return <Spin />;
  const segredo = (ok: boolean, nome: string, uso: string) => (
    <div style={{ fontSize: 12 }}>
      {ok ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : <CloseCircleTwoTone twoToneColor="#bfbfbf" />} <code>{nome}</code> <Text type="secondary">— {uso}</Text>
    </div>
  );

  return (
    <Form form={form} layout="vertical" onFinish={salvar} requiredMark={false}>
      <Row gutter={[14, 14]}>
        <Col xs={24} xl={13}>
          <Card size="small" title="Empresa emitente">
            <Row gutter={10}>
              <Col xs={24} md={8}><Form.Item name={['emitente', 'cnpj']} label="CNPJ" rules={[{ required: true }]}><Input placeholder="00.000.000/0000-00" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name={['emitente', 'inscricaoEstadual']} label="Inscrição estadual" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}>
                <Form.Item name={['emitente', 'crt']} label="Regime">
                  <Select options={[{ value: 4, label: 'MEI' }, { value: 1, label: 'Simples Nacional' }, { value: 2, label: 'Simples (excesso de sublimite)' }, { value: 3, label: 'Regime normal' }]} />
                </Form.Item>
              </Col>
              <Col xs={24} md={14}><Form.Item name={['emitente', 'razaoSocial']} label="Razão social" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item></Col>
              <Col xs={24} md={10}><Form.Item name={['emitente', 'nomeFantasia']} label="Nome fantasia (vai na mensagem ao cliente)"><Input maxLength={60} /></Form.Item></Col>
              <Col xs={24} md={14}><Form.Item name={['emitente', 'logradouro']} label="Logradouro"><Input maxLength={120} /></Form.Item></Col>
              <Col xs={8} md={4}><Form.Item name={['emitente', 'numero']} label="Número"><Input maxLength={20} /></Form.Item></Col>
              <Col xs={16} md={6}><Form.Item name={['emitente', 'complemento']} label="Complemento"><Input maxLength={60} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name={['emitente', 'bairro']} label="Bairro"><Input maxLength={60} /></Form.Item></Col>
              <Col xs={12} md={5}><Form.Item name={['emitente', 'cep']} label="CEP"><Input placeholder="00000-000" /></Form.Item></Col>
              <Col xs={12} md={7}><Form.Item name={['emitente', 'municipio']} label="Município"><Input maxLength={60} /></Form.Item></Col>
              <Col xs={12} md={4}><Form.Item name={['emitente', 'uf']} label="UF"><Select showSearch options={UFS.map(u => ({ value: u, label: u }))} /></Form.Item></Col>
              <Col xs={12} md={8}>
                <Form.Item name={['emitente', 'codigoMunicipioIbge']} label="Código IBGE do município" tooltip="7 dígitos. São Paulo capital: 3550308. Consulte em ibge.gov.br › Códigos dos municípios.">
                  <Input maxLength={7} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}><Form.Item name={['emitente', 'telefone']} label="Telefone"><Input maxLength={20} /></Form.Item></Col>
              <Col xs={12} md={8}><Form.Item name={['emitente', 'email']} label="E-mail"><Input maxLength={120} /></Form.Item></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={11}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Card size="small" title="Emissão">
              <Form.Item name={['configuracao', 'ambiente']} label="Ambiente">
                <Radio.Group optionType="button" options={[{ value: 'HOMOLOGACAO', label: 'Homologação (teste)' }, { value: 'PRODUCAO', label: 'Produção' }]} />
              </Form.Item>
              {ambiente === 'PRODUCAO' && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Em produção as notas têm valor fiscal." />}
              <Form.Item name={['configuracao', 'modoEmissao']} label="Quando emitir">
                <Radio.Group options={[
                  { value: 'FILA', label: 'Fila: aprovo as vendas do dia e emito' },
                  { value: 'AUTOMATICA', label: 'Automático ao concluir a venda' },
                ]} />
              </Form.Item>
              <Form.Item name={['configuracao', 'emissor']} label="Quem transmite à SEFAZ">
                <Radio.Group optionType="button" options={[{ value: 'PROVEDOR', label: 'Provedor contratado' }, { value: 'DIRETO', label: 'Direto (certificado A1)' }]} />
              </Form.Item>
              {emissor !== 'DIRETO' && (
                <Form.Item name={['configuracao', 'provedor']} label="Provedor" extra={`Disponíveis no sistema: ${dados.provedores.join(', ')}. SIMULADO autoriza em homologação para testar a fila.`}>
                  <AutoComplete options={dados.provedores.map(p => ({ value: p }))} filterOption={false} />
                </Form.Item>
              )}
              <Row gutter={10}>
                <Col span={6}><Form.Item name={['configuracao', 'serieNfce']} label="Série NFC-e"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name={['configuracao', 'proximoNumeroNfce']} label="Próx. nº"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name={['configuracao', 'serieNfe']} label="Série NF-e"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name={['configuracao', 'proximoNumeroNfe']} label="Próx. nº"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Form.Item name={['configuracao', 'cscId']} label="Id do CSC (token do QR Code da NFC-e, gerado no portal da SEFAZ)"><Input maxLength={10} style={{ width: 160 }} /></Form.Item>
            </Card>

            <Card size="small" title="Tributação padrão">
              <Row gutter={10}>
                <Col span={6}><Form.Item name={['configuracao', 'csosnPadrao']} label="CSOSN"><Input maxLength={3} /></Form.Item></Col>
                <Col span={6}><Form.Item name={['configuracao', 'cfopPadrao']} label="CFOP"><Input maxLength={4} /></Form.Item></Col>
                <Col span={6}><Form.Item name={['configuracao', 'csosnSt']} label="CSOSN com ST"><Input maxLength={3} /></Form.Item></Col>
                <Col span={6}><Form.Item name={['configuracao', 'cfopSt']} label="CFOP com ST"><Input maxLength={4} /></Form.Item></Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 12 }}>
                MEI/Simples: 102 e 5102. Item com CEST (substituição tributária) usa 500 e 5405. Exceções por item no cadastro fiscal do produto. Confirme com seu contador.
              </Text>
            </Card>

            <Card size="small" title="Senhas e certificado (arquivo .env do backend)">
              {segredo(dados.segredos.provedorToken, 'FISCAL_PROVEDOR_TOKEN', 'token da API do provedor')}
              {segredo(dados.segredos.cscToken, 'FISCAL_CSC_TOKEN', 'CSC da NFC-e (emissão direta)')}
              {segredo(dados.segredos.certificado, 'FISCAL_CERTIFICADO_ARQUIVO / _SENHA', 'certificado A1 (emissão direta)')}
            </Card>
          </Space>
        </Col>
      </Row>
      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <Button type="primary" htmlType="submit" loading={salvando}>Salvar configuração</Button>
      </div>
    </Form>
  );
};

export default ConfiguracaoFiscal;
