// Entrada sem nota (compra avulsa): o operador digita os itens; vira um XML interno e segue o fluxo da entrada de NF.
// Só a entrada sem nota tem lista editável — nota com XML de verdade não se edita.
import React, { useEffect, useState } from 'react';
import { Alert, Button, DatePicker, Descriptions, Divider, Flex, Form, Input, InputNumber, Modal, Select, Tooltip, Typography, message, theme } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { createSupplier, getFornecedores, FornecedorLista } from '../../../parceiros/fornecedores/fornecedores.api';
import SeletorUnidade from '../../../catalogo/unidades/SeletorUnidade';
import {
  CNPJ_COMPRA_AVULSA, DadosSemNota, ItemSemNota, NOME_COMPRA_AVULSA, alteracoesDaLista, montarXmlSemNota, validarSemNota,
} from './entradaSemNota';

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cnpjFmt = (c: string) => (c === CNPJ_COMPRA_AVULSA ? 'sem fornecedor' : c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'));

export type AlteracoesLista = ReturnType<typeof alteracoesDaLista>;

interface Valores {
  fornecedor: number | 'AVULSA';
  data: Dayjs;
  observacao?: string;
  frete?: number;
  desconto?: number;
  itens: ItemSemNota[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** XML interno gerado: a tela carrega como se fosse uma nota. Na edição, vão junto as linhas alteradas. */
  onGerar: (xml: string, alteracoes?: AlteracoesLista) => void;
  /** Entrada sem nota já aberta: edita a lista dela (fornecedor e data ficam fixos: fazem parte da chave) */
  base?: DadosSemNota | null;
}

const ITEM_VAZIO: Partial<ItemSemNota> = { unidade: 'UN', quantidade: 1 };

export const EntradaSemNotaModal: React.FC<Props> = ({ open, onClose, onGerar, base }) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm<Valores>();
  const [fornecedores, setFornecedores] = useState<FornecedorLista[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const editando = Boolean(base);

  useEffect(() => {
    if (!open) return;
    setErros([]);
    form.resetFields();
    if (base) {
      form.setFieldsValue({ observacao: base.observacao, frete: base.frete || undefined, desconto: base.desconto || undefined, itens: base.itens });
    } else {
      getFornecedores().then(setFornecedores).catch(() => setFornecedores([]));
    }
  }, [open, base, form]);

  const itens: ItemSemNota[] = Form.useWatch('itens', form) || [];
  const frete = Number(Form.useWatch('frete', form)) || 0;
  const desconto = Number(Form.useWatch('desconto', form)) || 0;
  const totalProdutos = itens.reduce((a, i) => a + (Number(i?.quantidade) || 0) * (Number(i?.custoUnitario) || 0), 0);

  const gerar = async () => {
    const v = await form.validateFields();
    const linhas = (v.itens || []).map(i => ({ ...i, descricao: String(i.descricao || '').trim() }));
    const comuns = { observacao: v.observacao, frete: v.frete || 0, desconto: v.desconto || 0, itens: linhas };

    if (base) {
      const dados: DadosSemNota = { ...base, ...comuns };
      const problemas = validarSemNota(dados);
      if (problemas.length) { setErros(problemas); return; }
      onGerar(montarXmlSemNota(dados), alteracoesDaLista(base.itens, linhas));
      onClose();
      return;
    }

    const escolhido = v.fornecedor === 'AVULSA' ? null : fornecedores.find(f => f.id_pessoa === v.fornecedor);
    const fornecedor = escolhido
      ? { cnpj: escolhido.cnpj, nome: escolhido.razao_social, uf: escolhido.enderecos?.find(e => e.principal)?.estado || undefined }
      : { cnpj: CNPJ_COMPRA_AVULSA, nome: NOME_COMPRA_AVULSA };
    const dados: DadosSemNota = { fornecedor, data: v.data.toDate(), numero: Number(String(Date.now()).slice(-9)), ...comuns };
    const problemas = validarSemNota(dados);
    if (problemas.length) { setErros(problemas); return; }
    setErros([]);
    setGerando(true);
    try {
      // Fornecedor genérico: cadastra na primeira vez (o backend devolve o existente se já houver)
      if (!escolhido) await createSupplier({ cnpj: CNPJ_COMPRA_AVULSA, name: NOME_COMPRA_AVULSA, fantasyName: 'COMPRA AVULSA' });
      onGerar(montarXmlSemNota(dados));
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao preparar a entrada.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} width={1000} destroyOnHidden confirmLoading={gerando} onOk={gerar} cancelText="Cancelar"
      title={editando ? 'Editar itens da entrada sem nota' : 'Entrada sem nota (compra avulsa)'}
      okText={editando ? 'Salvar lista' : 'Carregar na conferência'}>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {editando
          ? 'Linha com quantidade, custo ou descrição alterados volta para conferência; com a unidade alterada, também precisa ser classificada de novo. As demais continuam como estão.'
          : 'Para itens comprados sem nota fiscal. Depois de carregar, a entrada segue igual a uma nota: classificação no PIM, custo, preço e o estoque entra na aprovação.'}
      </Typography.Paragraph>

      <Form form={form} layout="vertical" initialValues={{ fornecedor: 'AVULSA', data: dayjs(), itens: [ITEM_VAZIO] }} requiredMark={false}>
        {editando && base ? (
          <Flex gap={12} wrap align="flex-end">
            <Descriptions size="small" column={2} style={{ flex: '2 1 360px' }}
              items={[
                { key: 'f', label: 'Comprado de', children: `${base.fornecedor.nome} (${cnpjFmt(base.fornecedor.cnpj)})` },
                { key: 'd', label: 'Data', children: dayjs(base.data).format('DD/MM/YYYY') },
              ]} />
            <Form.Item name="observacao" label="Observação" style={{ flex: '2 1 240px', marginBottom: 8 }}>
              <Input maxLength={200} placeholder="Ex.: loja, recibo nº, quem comprou" />
            </Form.Item>
          </Flex>
        ) : (
          <Flex gap={12} wrap>
            <Form.Item name="fornecedor" label="Comprado de" style={{ flex: '2 1 280px', marginBottom: 8 }}>
              <Select showSearch optionFilterProp="label" options={[
                { value: 'AVULSA', label: `${NOME_COMPRA_AVULSA} — sem fornecedor` },
                ...fornecedores.map(f => ({ value: f.id_pessoa, label: `${f.nome_fantasia || f.razao_social} · ${f.cnpj}` })),
              ]} />
            </Form.Item>
            <Form.Item name="data" label="Data da compra" rules={[{ required: true, message: 'Informe a data' }]} style={{ flex: '0 1 160px', marginBottom: 8 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} />
            </Form.Item>
            <Form.Item name="observacao" label="Observação" style={{ flex: '2 1 240px', marginBottom: 8 }}>
              <Input maxLength={200} placeholder="Ex.: loja, recibo nº, quem comprou" />
            </Form.Item>
          </Flex>
        )}

        <Divider style={{ margin: '8px 0' }}>Itens</Divider>
        <Form.List name="itens">
          {(campos, { add, remove }) => (
            <Flex vertical gap={6}>
              {campos.map(({ key, name }, n) => {
                const linha = itens[n];
                const subtotal = (Number(linha?.quantidade) || 0) * (Number(linha?.custoUnitario) || 0);
                const nova = editando && !linha?.nItem;
                return (
                  <Flex key={key} gap={6} wrap align="flex-start"
                    style={{ padding: 8, borderRadius: token.borderRadius, background: nova ? token.colorSuccessBg : token.colorFillQuaternary }}>
                    <Form.Item name={[name, 'nItem']} hidden><InputNumber /></Form.Item>
                    <Tooltip title={nova ? 'Item novo' : `Linha ${linha?.nItem ?? n + 1}`}>
                      <Typography.Text type="secondary" style={{ width: 24, paddingTop: 5 }}>{nova ? '+' : (linha?.nItem ?? n + 1)}</Typography.Text>
                    </Tooltip>
                    <Form.Item name={[name, 'descricao']} rules={[{ required: true, whitespace: true, message: 'Descrição' }]} style={{ flex: '3 1 240px', margin: 0 }}>
                      <Input placeholder="Descrição do item" maxLength={120} />
                    </Form.Item>
                    <Form.Item name={[name, 'quantidade']} rules={[{ required: true, message: 'Qtd' }]} style={{ flex: '0 0 90px', margin: 0 }}>
                      <InputNumber placeholder="Qtd" min={0.0001} decimalSeparator="," style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name={[name, 'unidade']} rules={[{ required: true, message: 'Un' }]} style={{ flex: '0 0 130px', margin: 0 }}>
                      <SeletorUnidade placeholder="Un" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name={[name, 'custoUnitario']} rules={[{ required: true, message: 'Custo' }]} style={{ flex: '0 0 130px', margin: 0 }}>
                      <InputNumber placeholder="Custo unit." prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} />
                    </Form.Item>
                    <Tooltip title="Código do produto (opcional): se você já usa um código, ele ajuda a reconhecer o item nas próximas compras">
                      <Form.Item name={[name, 'codigo']} style={{ flex: '1 1 100px', margin: 0 }}>
                        <Input placeholder="Código" maxLength={60} />
                      </Form.Item>
                    </Tooltip>
                    <Form.Item name={[name, 'ean']} style={{ flex: '1 1 130px', margin: 0 }}>
                      <Input placeholder="Cód. barras (EAN)" maxLength={14} />
                    </Form.Item>
                    <Tooltip title="NCM (opcional aqui): sem ele o item fica pendente para emitir nota na venda">
                      <Form.Item name={[name, 'ncm']} style={{ flex: '0 0 110px', margin: 0 }}>
                        <Input placeholder="NCM" maxLength={10} />
                      </Form.Item>
                    </Tooltip>
                    <Typography.Text strong style={{ flex: '0 0 90px', textAlign: 'right', paddingTop: 5 }}>{brl(subtotal)}</Typography.Text>
                    <Tooltip title={editando && !nova ? 'Remover da entrada (a conferência dessa linha se perde)' : 'Remover'}>
                      <Button type="text" danger icon={<DeleteOutlined />} disabled={campos.length === 1} onClick={() => remove(name)} />
                    </Tooltip>
                  </Flex>
                );
              })}
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add(ITEM_VAZIO)} block>Adicionar item</Button>
            </Flex>
          )}
        </Form.List>

        <Flex gap={12} wrap justify="flex-end" align="flex-end" style={{ marginTop: 12 }}>
          <Form.Item name="frete" label="Frete pago" style={{ width: 150, marginBottom: 0 }}>
            <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="desconto" label="Desconto" style={{ width: 150, marginBottom: 0 }}>
            <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} />
          </Form.Item>
          <Flex vertical align="flex-end" style={{ minWidth: 180 }}>
            <Typography.Text type="secondary">{itens.length} item(ns) · produtos {brl(totalProdutos)}</Typography.Text>
            <Typography.Text strong style={{ fontSize: 18 }}>Total {brl(totalProdutos + frete - desconto)}</Typography.Text>
          </Flex>
        </Flex>
      </Form>

      {erros.length > 0 && (
        <Alert type="error" showIcon style={{ marginTop: 12 }} title="Corrija antes de continuar" description={<Flex vertical>{erros.map(e => <span key={e}>{e}</span>)}</Flex>} />
      )}
    </Modal>
  );
};
