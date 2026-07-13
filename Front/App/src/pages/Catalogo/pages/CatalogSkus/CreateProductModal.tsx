import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Switch, 
  Row, 
  Col, 
  Divider, 
  Tooltip,
  Space,
  Button
} from 'antd';
import { InfoCircleOutlined, RocketOutlined } from '@ant-design/icons';
import Swal from 'sweetalert2';

const { Option } = Select;

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: any) => void;
  loading?: boolean;
}

interface Atributo {
  id: number;
  nome: string;
  tipo: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
  sufixo?: string;
  simbolo_unidade?: string;
  origem: 'categoria' | 'familia';
  opcoes?: { id: number; valor: string; }[];
}

export default function CreateProductModal({ open, onClose, onSave, loading = false }: CreateProductModalProps) {
  const [form] = Form.useForm();
  const [atributosDinamicos, setAtributosDinamicos] = useState<Atributo[]>([]);

  const unidadesMedida = [
    { simbolo: 'PC', nome: 'Peça' },
    { simbolo: 'UN', nome: 'Unidade' },
    { simbolo: 'mm', nome: 'Milímetros' },
    { simbolo: 'M', metro: 'Metro' },
    { simbolo: 'Kg', nome: 'Quilogramas' },
  ];

  const categorias = [
    { id: 1, nome: '⚙️ HIDRÁULICA INDUSTRIAL' },
    { id: 2, nome: '🛢️ MANGUEIRAS E TUBOS' },
    { id: 3, nome: '🔄 TRANSMISSÃO E ROLAMENTOS' }
  ];

  const familias = [
    { id: 1, categoria_id: 1, nome: 'Motobombas', unidade_base: 'PC' },
    { id: 2, categoria_id: 3, nome: 'TESTE', unidade_base: 'UN' }
  ];

  const proveedores = [
    { id: 101, nome: 'Ebara Bombas América do Sul' },
    { id: 102, nome: 'Gates do Brasil Comercial' },
    { id: 103, nome: 'Distribuidora de Rolamentos SKF' }
  ];

  const carregarAtributosGerais = (categoriaId: number, familiaId?: number) => {
    let atributosFinais: Atributo[] = [];
    if (categoriaId === 1) {
      atributosFinais = [
        { id: 3, nome: 'Diâmetro Interno', tipo: 'decimal', simbolo_unidade: 'mm', origem: 'categoria' },
        { id: 6, nome: 'Pressão Máxima de Trabalho', tipo: 'numero', simbolo_unidade: 'BAR', origem: 'categoria' }
      ];
    }
    if (familiaId === 1) {
      atributosFinais = [
        { id: 1, nome: 'Voltagem', tipo: 'lista', origem: 'familia', opcoes: [{ id: 1, valor: '110V' }, { id: 2, valor: '220V' }, { id: 3, valor: '380V (Trifásico)' }, { id: 4, valor: 'Bivolt' }] },
        { id: 2, nome: 'Potência do Motor', tipo: 'numero', sufixo: 'HP', origem: 'familia' },
        { id: 5, nome: 'Peso Líquido', tipo: 'decimal', simbolo_unidade: 'Kg', origem: 'familia' }
      ];
    }
    setAtributosDinamicos(atributosFinais);
  };

  const handleCategoriaChange = (categoriaId: number) => {
    form.setFieldsValue({ familia_id: undefined });
    carregarAtributosGerais(categoriaId);
  };

  const handleFamiliaChange = (familiaId: number) => {
    const categoriaId = form.getFieldValue('categoria_id');
    const familiaSelecionada = familias.find(f => f.id === familiaId);
    
    if (familiaSelecionada) {
      form.setFieldsValue({ uom: familiaSelecionada.unidade_base });
    }
    
    carregarAtributosGerais(categoriaId, familiaId);
  };

  // Função central para processar os dados do formulário e gerar o mock estruturado
  const processFormData = (values: any) => {
    // Gerar código automático se não for inserido
    const codigoFinal = values.codItem 
      ? values.codItem.toUpperCase() 
      : `AUTO-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const atributosFormatados = Object.keys(values.atributos || {}).map(key => {
      const attrId = key.replace('attr_', '');
      const metaAttr = atributosDinamicos.find(a => a.id === Number(attrId));
      const val = values.atributos[key];

      return {
        atributo_id: Number(attrId),
        tipo_entidade: 'produto',
        valor_texto: metaAttr?.tipo === 'texto' ? val : null,
        valor_numero: metaAttr?.tipo === 'numero' ? val : null,
        valor_decimal: metaAttr?.tipo === 'decimal' ? val : null,
        valor_boolean: metaAttr?.tipo === 'boolean' ? (val ? 1 : 0) : null,
        valor_data: metaAttr?.tipo === 'data' ? val?.format('YYYY-MM-DD HH:mm:ss') : null,
        opcao_id: metaAttr?.tipo === 'lista' ? val : null,
      };
    });

    return {
      tenant_id: 1,
      nome: values.nome,
      codItem: codigoFinal,
      categoria_id: values.categoria_id,
      familia_id: values.familia_id || null,
      uom: values.uom,
      fornecedor_id: values.fornecedor_id || null,
      financeiro: {
        preco_custo_fornecedor: values.preco_custo_fornecedor || 0,
        preco_custo_spot: values.preco_custo_spot || 0,
        preco_venda: values.preco_venda,
      },
      atributos_valores: atributosFormatados,
      // Metadados simulados para o Enriquecimento Posterior (Fotos, etc)
      midia: [],
      status: 'rascunho'
    };
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const produtoMockado = processFormData(values);

      Swal.fire({
        title: 'Confirmar Cadastro?',
        text: `O produto será salvo com o código: ${produtoMockado.codItem}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, salvar!',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          onSave(produtoMockado);
          Swal.fire('Salvo!', 'Produto base criado com sucesso.', 'success');
        }
      });

    } catch (error) {
      console.error(error);
    }
  };

  const handleEnrichment = async () => {
    try {
      const values = await form.validateFields();
      const produtoMockado = processFormData(values);

      Swal.fire({
        title: 'Ir para Enriquecimento?',
        text: 'Você preencheu os dados bases. Vamos te redirecionar para a tela completa (Galeria de Fotos, Árvore Mercadológica Avançada, etc).',
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#722ed1',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sim, enriquecer!',
        cancelButtonText: 'Voltar'
      }).then((result) => {
        if (result.isConfirmed) {
          // Aqui injetamos o payload completo com a flag extra do fluxo expandido
          onSave({
            ...produtoMockado,
            _flow: 'enriquecimento_avancado',
            status: 'em_enriquecimento'
          });
          Swal.fire('Redirecionando...', 'Abrindo painel multimídia do SKU.', 'success');
        }
      });

    } catch (error) {
      Swal.fire('Campos Pendentes', 'Por favor, preencha os dados obrigatórios iniciais antes de enriquecer.', 'warning');
    }
  };

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAtributosDinamicos([]);
    }
  }, [open, form]);

  const renderDynamicField = (attr: Atributo) => {
    const label = attr.simbolo_unidade || attr.sufixo 
      ? `${attr.nome} (${attr.simbolo_unidade || attr.sufixo})` 
      : attr.nome;

    switch (attr.tipo) {
      case 'lista':
        return (
          <Form.Item name={['atributos', `attr_${attr.id}`]} label={label} key={attr.id}>
            <Select placeholder="Selecione" allowClear>
              {attr.opcoes?.map(op => <Option key={op.id} value={op.id}>{op.valor}</Option>)}
            </Select>
          </Form.Item>
        );
      case 'numero':
        return (
          <Form.Item name={['atributos', `attr_${attr.id}`]} label={label} key={attr.id}>
            <InputNumber style={{ width: '100%' }} precision={0} />
          </Form.Item>
        );
      case 'decimal':
        return (
          <Form.Item name={['atributos', `attr_${attr.id}`]} label={label} key={attr.id}>
            <InputNumber style={{ width: '100%' }} precision={2} step={0.01} />
          </Form.Item>
        );
      case 'boolean':
        return (
          <Form.Item name={['atributos', `attr_${attr.id}`]} label={label} key={attr.id} valuePropName="checked">
            <Switch checkedChildren="Sim" unCheckedChildren="Não" />
          </Form.Item>
        );
      default:
        return (
          <Form.Item name={['atributos', `attr_${attr.id}`]} label={label} key={attr.id}>
            <Input placeholder="Digite o valor" />
          </Form.Item>
        );
    }
  };

  return (
    <Modal
      title="Cadastrar Novo Produto (Item Base)"
      open={open}
      onCancel={onClose}
      width={780}
      footer={[
        <Button key="back" onClick={onClose}>
          Cancelar
        </Button>,
        <Button 
          key="enrich" 
          type="default" 
          icon={<RocketOutlined style={{ color: '#722ed1' }} />} 
          style={{ borderColor: '#722ed1', color: '#722ed1' }}
          onClick={handleEnrichment}
        >
          Enriquecer Produto (Completo)
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          Salvar Produto
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" name="create_product_form">
        <Divider style={{ margin: '0 0 16px 0' }}>Dados Estruturais & Unidade</Divider>
        <Row gutter={16}>
          <Col span={6}>
            {/* Removido o required aqui para permitir a geração automática pelo Math.random */}
            <Form.Item name="codItem" label="Código Base">
              <Input placeholder="Deixe em branco p/ auto-gerar" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="nome" label="Nome do Produto / Agrupador" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Input placeholder="Ex: Motobomba Ebara Centrifuga" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item 
              name="uom" 
              label="UOM (Unidade)" 
              rules={[{ required: true, message: 'Selecione ou digite' }]}
            >
              <Select 
                placeholder="Ex: PC, UN"
                showSearch
                onSearch={(value) => {
                  if (value) form.setFieldsValue({ uom: value });
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={unidadesMedida.map(u => ({
                  value: u.simbolo,
                  label: `${u.simbolo} - ${u.nome}`
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="categoria_id" label="Categoria" rules={[{ required: true, message: 'Obrigatório' }]}>
              <Select placeholder="Selecione" onChange={handleCategoriaChange}>
                {categorias.map(cat => <Option key={cat.id} value={cat.id}>{cat.nome}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.categoria_id !== currentValues.categoria_id}>
              {({ getFieldValue }) => {
                const categoriaSelecionada = getFieldValue('categoria_id');
                const familiasFiltradas = familias.filter(f => Number(f.categoria_id) === Number(categoriaSelecionada));

                return (
                  <Form.Item name="familia_id" label="Família de SKUs (Opcional)">
                    <Select 
                      placeholder={categoriaSelecionada ? "Selecione" : "Selecione uma categoria primeiro"} 
                      onChange={handleFamiliaChange} 
                      allowClear
                      disabled={!categoriaSelecionada}
                    >
                      {familiasFiltradas.map(fam => (
                        <Option key={fam.id} value={fam.id}>{fam.nome}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Col>
        </Row>  

        <Divider orientation="left" style={{ marginTop: 16 }}>Atribuição Comercial & Precificação</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="fornecedor_id" label="Fornecedor Principal">
              <Select placeholder="Selecione o parceiro" allowClear>
                {proveedores.map(p => <Option key={p.id} value={p.id}>{p.nome}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col span={6}>
            <Form.Item 
              name="preco_custo_fornecedor" 
              label={
                <Space>
                  Custo Tabela
                  <Tooltip title="Preço acordado em contrato com o fornecedor.">
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  </Tooltip>
                </Space>
              }
            >
              <InputNumber style={{ width: '100%' }} precision={2} min={0} addonBefore="R$" placeholder="0,00" />
            </Form.Item>
          </Col>

          <Col span={6}>
            <Form.Item 
              name="preco_custo_spot" 
              label={
                <Space>
                  Custo Spot
                  <Tooltip title="Preço pago em compras sob demanda / mercado spot.">
                    <InfoCircleOutlined style={{ color: '#fa8c16' }} />
                  </Tooltip>
                </Space>
              }
            >
              <InputNumber style={{ width: '100%' }} precision={2} min={0} addonBefore="R$" placeholder="0,00" />
            </Form.Item>
          </Col>

          <Col span={6}>
            <Form.Item 
              name="preco_venda" 
              label="Preço Venda Base"
              rules={[{ required: true, message: 'Informe o preço' }]}
            >
              <InputNumber style={{ width: '100%' }} precision={2} min={0} addonBefore="R$" placeholder="0,00" />
            </Form.Item>
          </Col>
        </Row>

        {atributosDinamicos.length > 0 && (
          <>
            <Divider style={{ marginTop: 16 }}>
              {form.getFieldValue('familia_id') ? 'Especificações Técnicas da Família' : 'Especificações Técnicas da Categoria'}
            </Divider>
            <Row gutter={16}>
              {atributosDinamicos.map(attr => (
                <Col span={12} key={attr.id}>
                  {renderDynamicField(attr)}
                </Col>
              ))}
            </Row>
          </>
        )}
      </Form>
    </Modal>
  );
}