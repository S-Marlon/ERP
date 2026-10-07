// Unidades: cadastro de unidades internas e o dicionário de unidades de entrada (sigla da NF -> unidade interna).
// Regras por fornecedor nascem na conferência da NF ("O que é 'M' nesta nota?"); aqui dá para ver, criar regras gerais e excluir.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Input, Popconfirm, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  EquivalenciaUnidade, excluirEquivalenciaUnidade, listarEquivalenciasUnidade, salvarEquivalenciaUnidade, UnidadeCadastro,
} from '../../compras/api/comprasApi';

const { Text, Title } = Typography;

const UnidadesPage: React.FC = () => {
  const [equivalencias, setEquivalencias] = useState<EquivalenciaUnidade[]>([]);
  const [unidades, setUnidades] = useState<UnidadeCadastro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [form] = Form.useForm();

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await listarEquivalenciasUnidade();
      setEquivalencias(r.equivalencias);
      setUnidades(r.unidades);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar as unidades.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const usoPorUnidade = useMemo(() => {
    const m = new Map<string, number>();
    equivalencias.forEach(e => m.set(e.siglaInterna, (m.get(e.siglaInterna) || 0) + 1));
    return m;
  }, [equivalencias]);

  const visiveis = equivalencias.filter(e => {
    const t = filtro.trim().toUpperCase();
    return !t || e.siglaEntrada.includes(t) || e.siglaInterna.includes(t) || String(e.fornecedor || '').toUpperCase().includes(t);
  });

  const adicionar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      await salvarEquivalenciaUnidade({ siglaEntrada: v.siglaEntrada, siglaInterna: v.siglaInterna, escopo: 'geral' });
      message.success('Regra geral salva.');
      form.resetFields();
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar a regra.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: number) => {
    try {
      await excluirEquivalenciaUnidade(id);
      message.success('Regra excluída.');
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao excluir a regra.');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Unidades</Title>
            <Text type="secondary">
              Como as siglas que vêm nas notas (M, MTS, UND...) viram as unidades do sistema (MT, UN...).
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
        </div>

        <Row gutter={[14, 14]}>
          <Col xs={24} xl={16}>
            <Card size="small" title="Dicionário de unidades de entrada"
              extra={<Input.Search size="small" allowClear placeholder="Filtrar sigla ou fornecedor" style={{ width: 220 }} onChange={e => setFiltro(e.target.value)} />}>
              <Form form={form} layout="inline" size="small" style={{ marginBottom: 10, rowGap: 6 }}>
                <Form.Item name="siglaEntrada" rules={[{ required: true, whitespace: true, message: 'Sigla da nota' }, { max: 10 }]}>
                  <Input placeholder="Na nota (ex.: MTS)" style={{ width: 150, textTransform: 'uppercase' }} />
                </Form.Item>
                <Text style={{ lineHeight: '24px', marginInlineEnd: 8 }}>→</Text>
                <Form.Item name="siglaInterna" rules={[{ required: true, message: 'Unidade' }]}>
                  <Select showSearch optionFilterProp="label" placeholder="No sistema" style={{ width: 200 }}
                    options={unidades.map(u => ({ value: u.sigla, label: `${u.sigla} - ${u.descricao}` }))} />
                </Form.Item>
                <Button type="primary" icon={<PlusOutlined />} loading={salvando} onClick={adicionar}>Regra geral</Button>
              </Form>
              <Table<EquivalenciaUnidade>
                size="small"
                rowKey="id"
                loading={carregando}
                dataSource={visiveis}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma regra. Elas também são criadas na conferência da NF." /> }}
                columns={[
                  { title: 'Na nota', dataIndex: 'siglaEntrada', width: 110, render: (v: string) => <Tag color="blue">{v}</Tag> },
                  { title: 'No sistema', key: 'interna', width: 200, render: (_, e) => <span><Tag color="green">{e.siglaInterna}</Tag>{e.descricaoInterna}</span> },
                  {
                    title: 'Vale para', key: 'escopo',
                    render: (_, e) => e.idFornecedor ? <span><Tag color="purple">fornecedor</Tag>{e.fornecedor || `#${e.idFornecedor}`}</span> : <Tag>todos</Tag>,
                  },
                  {
                    title: '', key: 'acoes', width: 50, align: 'center' as const,
                    render: (_, e) => (
                      <Popconfirm title="Excluir esta regra?" description="Notas com esta sigla voltam a pedir definição na conferência." onConfirm={() => excluir(e.id)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card size="small" title="Unidades do cadastro">
              <Space size={[6, 6]} wrap>
                {unidades.map(u => (
                  <Tag key={u.id} style={{ padding: '2px 8px' }}>
                    <b>{u.sigla}</b> {u.descricao}{usoPorUnidade.get(u.sigla) ? <Text type="secondary" style={{ fontSize: 11 }}> · {usoPorUnidade.get(u.sigla)} sinônimo(s)</Text> : null}
                  </Tag>
                ))}
              </Space>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                Unidade nova é criada na conferência da NF ("É uma unidade nova"). A ordem de leitura de uma sigla da nota é:
                regra do fornecedor → unidade do cadastro com a mesma sigla → regra geral. Sem nenhuma, a entrada pede a definição.
              </Text>
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default UnidadesPage;
