// Unidades da nota na conferência: mostra como cada sigla da NF será tratada (M → MT) e pergunta
// o que significa uma sigla que o sistema não conhece. A resposta vira regra no dicionário de unidades
// (só deste fornecedor ou para todos) e vale para as próximas notas.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Radio, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import {
  ResolucaoUnidade, resolverUnidadesEntrada, salvarEquivalenciaUnidade, UnidadeCadastro,
} from '../../api/comprasApi';

const { Text } = Typography;

const ORIGEM_LABEL: Record<string, string> = {
  fornecedor: 'regra deste fornecedor',
  geral: 'regra geral do dicionário',
  cadastro: 'unidade do cadastro',
};

export const normalizarSiglaNota = (sigla: unknown) => String(sigla ?? '').trim().toUpperCase();

export const useUnidadesEntrada = (cnpj: string, siglas: string[]) => {
  const [resolucoes, setResolucoes] = useState<Record<string, ResolucaoUnidade>>({});
  const [unidades, setUnidades] = useState<UnidadeCadastro[]>([]);
  const [idFornecedor, setIdFornecedor] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const chave = useMemo(() => [...new Set(siglas.map(normalizarSiglaNota).filter(Boolean))].sort().join(','), [siglas]);

  const recarregar = useCallback(async () => {
    if (!chave) { setResolucoes({}); return; }
    try {
      const r = await resolverUnidadesEntrada(cnpj, chave.split(','));
      setResolucoes(r.resolucoes);
      setUnidades(r.unidades);
      setIdFornecedor(r.idFornecedor);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao consultar as unidades da nota.');
    }
  }, [cnpj, chave]);

  useEffect(() => { recarregar(); }, [recarregar]);

  const naoReconhecidas = useMemo(
    () => Object.values(resolucoes).filter(r => r.origem === null).map(r => r.siglaNota),
    [resolucoes],
  );
  return { resolucoes, unidades, idFornecedor, naoReconhecidas, erro, recarregar };
};

// Etiqueta da unidade na linha: "M → MT" (traduzida), "M ?" (precisa definir) ou só a sigla
export const UnidadeNotaTag: React.FC<{
  sigla?: string | null;
  resolucao?: ResolucaoUnidade;
  readOnly?: boolean;
  onDefinir: (sigla: string) => void;
}> = ({ sigla, resolucao, readOnly, onDefinir }) => {
  const s = normalizarSiglaNota(sigla);
  if (!s) return <Tag>-</Tag>;
  if (!resolucao) return <Tag>{s}</Tag>;
  if (resolucao.origem === null) {
    return (
      <Tooltip title="Unidade que o sistema não conhece: clique e diga a qual unidade do cadastro ela equivale.">
        <Tag color="red" icon={<QuestionCircleOutlined />} style={{ cursor: readOnly ? 'default' : 'pointer', marginInlineEnd: 0 }}
          onClick={() => !readOnly && onDefinir(s)}>{s}</Tag>
      </Tooltip>
    );
  }
  if (resolucao.siglaInterna !== s) {
    return (
      <Tooltip title={<>Na nota: {s}. No estoque: {resolucao.siglaInterna} ({ORIGEM_LABEL[resolucao.origem]}).{!readOnly && ' Clique para mudar.'}</>}>
        <Tag color="green" style={{ cursor: readOnly ? 'default' : 'pointer', marginInlineEnd: 0 }} onClick={() => !readOnly && onDefinir(s)}>
          {s} → {resolucao.siglaInterna}
        </Tag>
      </Tooltip>
    );
  }
  return <Tag style={{ marginInlineEnd: 0 }}>{s}</Tag>;
};

// "O que é 'M' para este fornecedor?"
export const ModalDefinirUnidade: React.FC<{
  sigla: string | null;
  cnpj: string;
  fornecedorCadastrado: boolean;
  unidades: UnidadeCadastro[];
  atual?: ResolucaoUnidade;
  onFechar: () => void;
  onSalvo: () => void;
}> = ({ sigla, cnpj, fornecedorCadastrado, unidades, atual, onFechar, onSalvo }) => {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const modo = Form.useWatch('modo', form);
  const escopo = Form.useWatch('escopo', form);

  useEffect(() => {
    if (!sigla) return;
    form.resetFields();
    const sugestao = atual?.siglaInterna && unidades.some(u => u.sigla === atual.siglaInterna) ? atual.siglaInterna : undefined;
    form.setFieldsValue({
      modo: 'existente',
      siglaInterna: sugestao,
      siglaNova: sigla,
      descricao: '',
      escopo: fornecedorCadastrado ? 'fornecedor' : 'geral',
    });
  }, [sigla]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      await salvarEquivalenciaUnidade({
        siglaEntrada: sigla!,
        siglaInterna: v.modo === 'existente' ? v.siglaInterna : String(v.siglaNova).trim().toUpperCase(),
        descricaoInterna: v.modo === 'nova' ? String(v.descricao || '').trim() : undefined,
        escopo: v.escopo,
        cnpj,
      });
      message.success('Unidade definida. Vale também para as próximas notas.');
      onSalvo();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar a unidade.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal open={Boolean(sigla)} title={<>O que é <Tag color="blue" style={{ fontSize: 14 }}>{sigla}</Tag> nesta nota?</>}
      okText="Salvar" cancelText="Cancelar" onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden width={480}>
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="modo" style={{ marginBottom: 8 }}>
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="existente">É uma unidade que já existe no cadastro</Radio>
              <Radio value="nova">É uma unidade nova (cadastrar agora)</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        {modo === 'existente' ? (
          <Form.Item name="siglaInterna" label="Equivale a" rules={[{ required: true, message: 'Escolha a unidade.' }]}>
            <Select showSearch optionFilterProp="label" placeholder="Escolha a unidade do cadastro"
              options={unidades.map(u => ({ value: u.sigla, label: `${u.sigla} - ${u.descricao}` }))} />
          </Form.Item>
        ) : (
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="siglaNova" label="Sigla no sistema" style={{ width: 130 }}
              rules={[{ required: true, whitespace: true, message: 'Informe a sigla.' }, { max: 10, message: 'Até 10 letras.' }]}>
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="descricao" label="Nome" style={{ flex: 1, marginLeft: 8 }}
              rules={[{ required: true, whitespace: true, message: 'Informe o nome (ex.: Quilograma).' }]}>
              <Input placeholder="Ex.: Metro, Quilograma, Milheiro" />
            </Form.Item>
          </Space.Compact>
        )}

        <Form.Item name="escopo" label="Vale para" style={{ marginBottom: 6 }}>
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="fornecedor" disabled={!fornecedorCadastrado}>
                Só este fornecedor{!fornecedorCadastrado && <Text type="secondary" style={{ fontSize: 11 }}> (cadastre o fornecedor antes)</Text>}
              </Radio>
              <Radio value="geral">Todos os fornecedores</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        {escopo === 'geral' && (
          <Alert type="info" showIcon style={{ padding: '4px 8px', fontSize: 12 }}
            message={`Toda nota com "${sigla}" passará a ser tratada assim. Se algum fornecedor usar "${sigla}" com outro sentido (ex.: M = milheiro), crie uma regra só para ele.`} />
        )}
      </Form>
    </Modal>
  );
};

// Aviso no topo da conferência quando há sigla não reconhecida (bloqueia a aprovação)
export const AvisoUnidadesNaoReconhecidas: React.FC<{ siglas: string[]; readOnly?: boolean; onDefinir: (s: string) => void }> = ({ siglas, readOnly, onDefinir }) =>
  siglas.length === 0 ? null : (
    <Alert type="error" showIcon style={{ padding: '4px 10px' }}
      message={<span>
        Unidade da nota não reconhecida: {siglas.map(s => (
          <Button key={s} size="small" danger type="dashed" disabled={readOnly} style={{ marginInline: 2 }} onClick={() => onDefinir(s)}>{s} ?</Button>
        ))} diga a qual unidade do cadastro ela equivale (a entrada não é aprovada sem isso).
      </span>} />
  );
