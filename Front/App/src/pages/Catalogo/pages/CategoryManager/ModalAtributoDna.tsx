import React, { useState } from 'react';
import { Modal, Tabs, Form, Input, Select, Switch, Button, message, Space, Divider } from 'antd';
import { LockOutlined, PlusOutlined, LinkOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

interface ModalAtributoDnaProps {
  visible: boolean;
  onClose: () => void;
  onSalvarVinculoOuCriar: (dados: any) => void;
  atributosGlobaisDisponiveis: Array<{ id: string; nome: string; sufixo: string }>;
}

export const ModalAtributoDna: React.FC<ModalAtributoDnaProps> = ({
  visible,
  onClose,
  onSalvarVinculoOuCriar,
  atributosGlobaisDisponiveis,
}) => {
  const [formCriar] = Form.useForm();
  const [formVincular] = Form.useForm();
  const [tipoDadoSelecionado, setTipoDadoSelecionado] = useState<string>('texto');

  // Submissão da Aba de Criação de um Novo Atributo de DNA
  const handleCriarSubmit = (values: any) => {
    const payloadNovoAtributo = {
      ...values,
      escopoComercial: 'dna',
      imutavelPeloLojista: true, // DNA estrutural é sempre rígido nas filhas
      herdar: true,
      sobrescreve: false,
    };
    onSalvarVinculoOuCriar(payloadNovoAtributo);
    message.success('Atributo de DNA estrutural criado com sucesso!');
    formCriar.resetFields();
    onClose();
  };

  // Submissão da Aba de Vínculo de Atributo Existente
  const handleVincularSubmit = (values: any) => {
    const atributoSelecionado = atributosGlobaisDisponiveis.find(a => a.id === values.atributoId);
    if (!atributoSelecionado) return;

    const payloadVinculo = {
      ...atributoSelecionado,
      escopoComercial: 'dna',
      imutavelPeloLojista: true,
      herdar: true,
      sobrescreve: false,
    };
    onSalvarVinculoOuCriar(payloadVinculo);
    message.success('Atributo de DNA vinculado com sucesso!');
    formVincular.resetFields();
    onClose();
  };

  const itensAbas = [
    {
      key: 'vincular',
      label: (
        <span>
          <LinkOutlined /> Vincular Existente
        </span>
      ),
      children: (
        <Form form={formVincular} layout="vertical" onFinish={handleVincularSubmit}>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
            Selecione um atributo macro de DNA já existente na base corporativa para herdar nesta família.
          </p>
          <Form.Item
            name="atributoId"
            label="Atributo Global de DNA"
            rules={[{ required: true, message: 'Por favor, selecione um atributo!' }]}
          >
            <Select
              showSearch
              placeholder="Digite para buscar (ex: Material Base, Norma Técnica)..."
              optionFilterProp="children"
              options={atributosGlobaisDisponiveis.map(a => ({
                value: a.id,
                label: `${a.nome} (_${a.sufixo})`,
              }))}
            />
          </Form.Item>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
            🔒 <strong>Regra de Herança:</strong> Este atributo será propagado obrigatoriamente e de forma imutável para todas as subcategorias filhas.
          </div>
          <Divider />
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#0e7490', borderColor: '#0e7490' }}>
              Vincular DNA
            </Button>
          </Space>
        </Form>
      ),
    },
    {
      key: 'criar',
      label: (
        <span>
          <PlusOutlined /> Criar Novo DNA
        </span>
      ),
      children: (
        <Form 
          form={formCriar} 
          layout="vertical" 
          onFinish={handleCriarSubmit}
          initialValues={{ tipoDado: 'texto', obrigatorio: true, imutavelPeloLojista: true }}
        >
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
            Cadastre um novo parâmetro estrutural e imutável de engenharia para esta raiz de taxonomia.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <Form.Item
              name="nome"
              label="Nome do Atributo de DNA"
              rules={[{ required: true, message: 'Informe o nome!' }]}
            >
              <Input placeholder="Ex: Norma Construtiva / Material Base" />
            </Form.Item>

            <Form.Item
              name="sufixo"
              label="Sufixo Técnico (Slug)"
              rules={[{ required: true, message: 'Informe o sufixo!' }]}
            >
              <Input placeholder="Ex: norma_tec" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Form.Item
              name="tipoDado"
              label="Tipo de Dado"
              rules={[{ required: true }]}
            >
              <Select onChange={(val) => setTipoDadoSelecionado(val)} options={[
                { value: 'texto', label: 'Texto Livre / Máscara' },
                { value: 'lista', label: 'Lista Suspensa (Whitelist)' },
                { value: 'booleano', label: 'Sim / Não (Booleano)' },
              ]} />
            </Form.Item>

            <Form.Item
              name="unidadeMedida"
              label="Unidade de Medida (Opcional)"
            >
              <Input placeholder="Ex: mm, polegada, kg" />
            </Form.Item>
          </div>

          {tipoDadoSelecionado === 'lista' && (
            <Form.Item
              name="dominioValores"
              label="Valores Permitidos (Separados por vírgula)"
              rules={[{ required: true, message: 'Insira ao menos um valor para a whitelist!' }]}
            >
              <Input.TextArea placeholder="Ex: Aço Inox 316, Aço Galvanizado, Latão Forjado" rows={2} />
            </Form.Item>
          )}

          <div style={{ background: '#ecfeff', padding: '12px', borderRadius: '6px', border: '1px solid #cffafe', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: '#0e7490', fontSize: '12px' }}>Parâmetros de Governança Automáticos:</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#155e75' }}>
              <span>🔒 Imutável para o Lojista na Ponta (Herança Rígida)</span>
              <Form.Item name="imutavelPeloLojista" valuePropName="checked" noStyle>
                <Switch disabled checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#155e75' }}>
              <span>⚠️ Obrigatório para Validação de SKU / Publicação</span>
              <Form.Item name="obrigatorio" valuePropName="checked" noStyle>
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </div>
          </div>

          <Divider />
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#0e7490', borderColor: '#0e7490' }}>
              Salvar e Criar DNA
            </Button>
          </Space>
        </Form>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0e7490' }}>
          <SafetyCertificateOutlined />
          <span>Gerenciar Atributo de DNA Estrutural</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Tabs defaultActiveKey="vincular" items={itensAbas} />
    </Modal>
  );
};