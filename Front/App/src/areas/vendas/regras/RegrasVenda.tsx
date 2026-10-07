// Vendas › Regras de venda: limite de desconto sem autorização, senha de autorização e
// o que fazer com venda abaixo do custo. Valem no servidor (o PDV não consegue contornar).
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Radio, Space, Tag, Typography, message } from 'antd';
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';

const { Text, Title } = Typography;
const API = `${API_URL}/api/vendas/configuracoes`;

interface Regras { descontoMaxPercentual: number; politicaAbaixoCusto: 'PERMITIR' | 'AVISAR' | 'BLOQUEAR'; temSenha: boolean }

const ler = async (r: Response, erro: string) => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || erro);
  return d;
};

const RegrasVenda: React.FC = () => {
  const [form] = Form.useForm();
  const [regras, setRegras] = useState<Regras | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const r: Regras = await ler(await fetch(API), 'Erro ao carregar as regras.');
      setRegras(r);
      form.setFieldsValue({ descontoMaxPercentual: r.descontoMaxPercentual, politicaAbaixoCusto: r.politicaAbaixoCusto, senhaAtual: '', novaSenha: '', confirmar: '' });
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar as regras.');
    }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const r: Regras = await ler(await fetch(API, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descontoMaxPercentual: v.descontoMaxPercentual,
          politicaAbaixoCusto: v.politicaAbaixoCusto,
          senhaAtual: v.senhaAtual || undefined,
          novaSenha: v.novaSenha || undefined,
        }),
      }), 'Erro ao salvar as regras.');
      setRegras(r);
      form.setFieldsValue({ senhaAtual: '', novaSenha: '', confirmar: '' });
      message.success('Regras de venda salvas.');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar as regras.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Regras de venda</Title>
          <Text type="secondary">Valem no servidor: o PDV não consegue passar do limite sem a senha de autorização.</Text>
        </div>

        {regras && !regras.temSenha && (
          <Alert type="warning" showIcon message="Nenhuma senha de autorização definida"
            description="Sem senha, desconto acima do limite (e venda abaixo do custo, na política Avisar) é recusado no PDV. Defina a senha abaixo." />
        )}

        <Card size="small">
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item name="descontoMaxPercentual" label="Desconto máximo sem autorização"
              extra="Soma do desconto nos itens e no total, sobre o preço de tabela (varejo/atacado). Acima disso, pede a senha."
              rules={[{ required: true, message: 'Informe o limite.' }]}>
              <InputNumber min={0} max={100} precision={2} decimalSeparator="," addonAfter="%" style={{ width: 180 }} />
            </Form.Item>

            <Form.Item name="politicaAbaixoCusto" label="Venda abaixo do custo (custo médio do estoque)">
              <Radio.Group>
                <Space direction="vertical">
                  <Radio value="PERMITIR">Permitir <Text type="secondary">— vende sem perguntar</Text></Radio>
                  <Radio value="AVISAR">Pedir autorização <Tag color="blue">recomendado</Tag></Radio>
                  <Radio value="BLOQUEAR">Bloquear <Text type="secondary">— nem com senha</Text></Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Card size="small" type="inner" title={<Space><SafetyCertificateOutlined /> Senha de autorização {regras?.temSenha ? <Tag color="green">definida</Tag> : <Tag color="red">não definida</Tag>}</Space>}>
              {regras?.temSenha && (
                <Form.Item name="senhaAtual" label="Senha atual (obrigatória para salvar qualquer alteração)"
                  rules={[{ required: true, message: 'Informe a senha atual.' }]}>
                  <Input.Password prefix={<LockOutlined />} autoComplete="current-password" style={{ maxWidth: 280 }} />
                </Form.Item>
              )}
              <Space wrap>
                <Form.Item name="novaSenha" label={regras?.temSenha ? 'Nova senha (opcional)' : 'Definir senha'}
                  rules={[{ min: 4, message: 'Pelo menos 4 caracteres.' }]}>
                  <Input.Password autoComplete="new-password" style={{ width: 220 }} />
                </Form.Item>
                <Form.Item name="confirmar" label="Confirmar senha" dependencies={['novaSenha']}
                  rules={[({ getFieldValue }) => ({
                    validator: (_, valor) => (!getFieldValue('novaSenha') || valor === getFieldValue('novaSenha')
                      ? Promise.resolve() : Promise.reject(new Error('As senhas não conferem.'))),
                  })]}>
                  <Input.Password autoComplete="new-password" style={{ width: 220 }} />
                </Form.Item>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>A senha fica guardada criptografada. Quem autoriza informa o nome e o motivo, que ficam gravados na venda.</Text>
            </Card>

            <Button type="primary" style={{ marginTop: 14 }} loading={salvando} onClick={salvar}>Salvar regras</Button>
          </Form>
        </Card>
      </Space>
    </div>
  );
};

export default RegrasVenda;
