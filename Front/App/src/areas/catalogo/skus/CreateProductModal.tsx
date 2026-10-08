// Cadastrar produtos pelo catálogo com a compra sem nota (spot/avulsa): um ou vários itens da mesma compra nascem já
// classificados e com preço, e a compra entra pela entrada de NF (staging) — estoque e custo entram na aprovação.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Collapse, DatePicker, Divider, Flex, Form, Input, InputNumber, Modal, Select, Tag, Typography, message, theme,
} from 'antd';
import type { FormInstance } from 'antd';
import { DeleteOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { ClassificacaoPim, CLASSIFICACAO_VAZIA, ClassificacaoItem } from '../../compras/entradaNf/itens/ClassificacaoPim';
import { TIPOS_RECURSO } from '../../compras/entradaNf/tipoRecurso';
import { foraDaVenda } from '../../compras/entradaNf/edicaoLote';
import { CNPJ_COMPRA_AVULSA, NOME_COMPRA_AVULSA, montarXmlSemNota, validarSemNota } from '../../compras/entradaNf/semNota/entradaSemNota';
import { mapeamentoItemAvulso } from '../../compras/entradaNf/semNota/itemAvulso';
import type { MappingPayload } from '../../compras/entradaNf/itens/ProductMappingModal';
import { createSupplier, getFornecedores, FornecedorLista } from '../../parceiros/fornecedores/fornecedores.api';
import { fatorTaxaPreco } from '../../../shared/core/precos/taxaPreco';
import SeletorUnidade from '../unidades/SeletorUnidade';

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MARKUP_PADRAO = 1.8;

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
}

interface ItemForm {
  nome?: string;
  skuCustomizado?: string;
  tipoRecurso: string;
  ean?: string;
  ncm?: string;
  codigoFornecedor?: string;
  classificacao: ClassificacaoItem;
  quantidade?: number;
  unidade: string;
  custoUnitario?: number;
  markup?: number;
  precoVenda?: number;
}

interface Valores {
  fornecedor: number | 'AVULSA';
  data: Dayjs;
  observacao?: string;
  frete?: number;
  desconto?: number;
  itens: ItemForm[];
}

const novoItem = (): ItemForm => ({ tipoRecurso: 'PRODUTO', unidade: 'UN', quantidade: 1, markup: MARKUP_PADRAO, classificacao: CLASSIFICACAO_VAZIA });

// Preço = custo × markup × taxa da maquininha embutida (o mesmo cálculo da entrada de NF)
const precoDoMarkup = (custo: number, markup: number) => Math.round(custo * markup * fatorTaxaPreco() * 100) / 100;

/** Campos de um item da compra (um painel por item). */
const CamposItem: React.FC<{ form: FormInstance<Valores>; nome: number }> = ({ form, nome }) => {
  const item: Partial<ItemForm> = Form.useWatch(['itens', nome], form) || {};
  const vendavel = !foraDaVenda(item.tipoRecurso);
  const custo = Number(item.custoUnitario) || 0;
  const definir = (campo: keyof ItemForm, valor: unknown) => form.setFieldValue(['itens', nome, campo], valor);

  return (
    <>
      <Flex gap={12} wrap>
        <Form.Item name={[nome, 'nome']} label="Nome do produto" rules={[{ required: true, whitespace: true, message: 'Informe o nome' }]} style={{ flex: '3 1 280px' }}>
          <Input maxLength={120} placeholder="Ex.: Graxa azul de lítio 500g" />
        </Form.Item>
        <Form.Item name={[nome, 'skuCustomizado']} label="SKU" tooltip="Código que você usa para o produto. Vazio: o sistema gera um sequencial." style={{ flex: '1 1 140px' }}>
          <Input maxLength={60} placeholder="Gerado se vazio" disabled={!vendavel} />
        </Form.Item>
        <Form.Item name={[nome, 'tipoRecurso']} label="Tipo" style={{ flex: '1 1 170px' }}>
          <Select options={TIPOS_RECURSO.filter(t => t.value !== 'SERVICO').map(t => ({ value: t.value, label: t.label }))} />
        </Form.Item>
      </Flex>
      <Flex gap={12} wrap>
        <Form.Item name={[nome, 'ean']} label="Código de barras (EAN)" style={{ flex: '1 1 160px' }}>
          <Input maxLength={14} placeholder="Opcional" />
        </Form.Item>
        <Form.Item name={[nome, 'ncm']} label="NCM" tooltip="Sem NCM o item fica pendente para emitir nota fiscal na venda." style={{ flex: '1 1 120px' }}>
          <Input maxLength={10} placeholder="Opcional" />
        </Form.Item>
        <Form.Item name={[nome, 'codigoFornecedor']} label="Código na loja" tooltip="Código do produto na loja onde comprou (opcional)" style={{ flex: '1 1 130px' }}>
          <Input maxLength={60} placeholder="Opcional" />
        </Form.Item>
      </Flex>

      <Form.Item name={[nome, 'classificacao']} label="Classificação" style={{ marginBottom: 12 }}>
        <ClassificacaoPim value={item.classificacao || CLASSIFICACAO_VAZIA} onChange={c => definir('classificacao', c)} />
      </Form.Item>

      <Flex gap={12} wrap align="flex-end">
        <Form.Item name={[nome, 'quantidade']} label="Quantidade" rules={[{ required: true, message: 'Quantidade' }]} style={{ flex: '1 1 110px' }}>
          <InputNumber min={0.0001} decimalSeparator="," style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name={[nome, 'unidade']} label="Unidade" rules={[{ required: true, message: 'Unidade' }]} style={{ flex: '0 1 100px' }}>
          <SeletorUnidade style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name={[nome, 'custoUnitario']} label="Custo unitário" rules={[{ required: true, message: 'Custo' }]} style={{ flex: '1 1 130px' }}>
          <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }}
            onChange={c => definir('precoVenda', c ? precoDoMarkup(Number(c), Number(item.markup) || MARKUP_PADRAO) : undefined)} />
        </Form.Item>
        {vendavel && (
          <>
            <Form.Item name={[nome, 'markup']} label="Markup" style={{ flex: '0 1 120px' }}>
              <InputNumber min={0.01} step={0.1} precision={4} decimalSeparator="," suffix="×" style={{ width: '100%' }}
                onChange={m => definir('precoVenda', m && custo ? precoDoMarkup(custo, Number(m)) : undefined)} />
            </Form.Item>
            <Form.Item name={[nome, 'precoVenda']} label="Preço de venda" style={{ flex: '1 1 140px' }}>
              <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }}
                onChange={p => { if (p && custo > 0) definir('markup', Math.round((Number(p) / (custo * fatorTaxaPreco())) * 10000) / 10000); }} />
            </Form.Item>
          </>
        )}
      </Flex>
    </>
  );
};

export default function CreateProductModal({ open, onClose }: CreateProductModalProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [form] = Form.useForm<Valores>();
  const [fornecedores, setFornecedores] = useState<FornecedorLista[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState<string[]>(['0']);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setAberto(['0']);
    getFornecedores().then(setFornecedores).catch(() => setFornecedores([]));
  }, [open, form]);

  const itens: Partial<ItemForm>[] = Form.useWatch('itens', form) || [];
  const frete = Number(Form.useWatch('frete', form)) || 0;
  const desconto = Number(Form.useWatch('desconto', form)) || 0;
  const totalProdutos = itens.reduce((a, i) => a + (Number(i?.quantidade) || 0) * (Number(i?.custoUnitario) || 0), 0);

  const continuar = async () => {
    let v: Valores;
    try {
      v = await form.validateFields();
    } catch (e) {
      // Abre os itens com campo faltando, para o operador achar o erro
      const campos = (e as { errorFields?: Array<{ name: Array<string | number> }> })?.errorFields || [];
      const comErro = new Set<string>(campos.filter(f => f.name[0] === 'itens').map(f => String(f.name[1])));
      if (comErro.size) setAberto(atual => [...new Set([...atual, ...comErro])]);
      return;
    }
    const escolhido = v.fornecedor === 'AVULSA' ? null : fornecedores.find(f => f.id_pessoa === v.fornecedor);
    const fornecedor = escolhido
      ? { cnpj: escolhido.cnpj, nome: escolhido.razao_social, uf: escolhido.enderecos?.find(e => e.principal)?.estado || undefined }
      : { cnpj: CNPJ_COMPRA_AVULSA, nome: NOME_COMPRA_AVULSA };
    const dados = {
      fornecedor, data: v.data.toDate(), numero: Number(String(Date.now()).slice(-9)), observacao: v.observacao,
      frete: v.frete || 0, desconto: v.desconto || 0,
      itens: v.itens.map(i => ({
        descricao: String(i.nome || '').trim(), codigo: i.codigoFornecedor, ean: i.ean, ncm: i.ncm,
        unidade: i.unidade, quantidade: Number(i.quantidade), custoUnitario: Number(i.custoUnitario),
      })),
    };
    const erros = validarSemNota(dados);
    if (erros.length) { message.warning(erros.join(' ')); return; }

    // Mesmo SKU em dois itens da compra viraria um produto só: avisa antes
    const skus = v.itens.map(i => String(i.skuCustomizado || '').trim().toUpperCase()).filter(Boolean);
    if (new Set(skus).size !== skus.length) { message.warning('Dois itens com o mesmo SKU. Use SKUs diferentes ou deixe em branco.'); return; }

    setEnviando(true);
    try {
      if (!escolhido) await createSupplier({ cnpj: CNPJ_COMPRA_AVULSA, name: NOME_COMPRA_AVULSA, fantasyName: 'COMPRA AVULSA' });
      const mapeamentos: Record<string, MappingPayload> = {};
      v.itens.forEach((i, n) => {
        mapeamentos[String(n + 1)] = mapeamentoItemAvulso({
          nItem: n + 1, nome: String(i.nome), skuCustomizado: i.skuCustomizado, tipoRecurso: i.tipoRecurso, unidade: i.unidade,
          custoUnitario: Number(i.custoUnitario), markup: Number(i.markup) || MARKUP_PADRAO, classificacao: i.classificacao,
          codigoFornecedor: i.codigoFornecedor, ean: i.ean,
        });
      });
      onClose();
      navigate('/compras/entrada-nfe', { state: { entradaSemNota: { xml: montarXmlSemNota(dados), mapeamentos } } });
      message.info(`${v.itens.length} produto(s) prontos na entrada sem nota: confira e dê entrada para lançar o estoque.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao preparar o cadastro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      title="Cadastrar produtos (compra sem nota)"
      open={open}
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={(
        <Flex justify="space-between" align="center" gap={8} wrap>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Abre a entrada de mercadorias já preenchida. O estoque e o custo entram quando você der entrada.
          </Typography.Text>
          <Flex gap={8}>
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="primary" icon={<ShoppingCartOutlined />} loading={enviando} onClick={continuar}>Continuar para a entrada</Button>
          </Flex>
        </Flex>
      )}
    >
      <Form form={form} layout="vertical" requiredMark={false}
        initialValues={{ fornecedor: 'AVULSA', data: dayjs(), itens: [novoItem()] }}>
        <Divider style={{ margin: '0 0 12px' }}>Compra</Divider>
        <Flex gap={12} wrap>
          <Form.Item name="fornecedor" label="Comprado de" style={{ flex: '2 1 260px' }}>
            <Select showSearch optionFilterProp="label" options={[
              { value: 'AVULSA', label: `${NOME_COMPRA_AVULSA} — sem fornecedor` },
              ...fornecedores.map(f => ({ value: f.id_pessoa, label: `${f.nome_fantasia || f.razao_social} · ${f.cnpj}` })),
            ]} />
          </Form.Item>
          <Form.Item name="data" label="Data da compra" rules={[{ required: true, message: 'Informe a data' }]} style={{ flex: '0 1 150px' }}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={d => d.isAfter(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="observacao" label="Observação" style={{ flex: '2 1 220px' }}>
            <Input maxLength={200} placeholder="Ex.: loja, recibo nº, quem comprou" />
          </Form.Item>
        </Flex>

        <Divider style={{ margin: '4px 0 12px' }}>Itens</Divider>
        <Form.List name="itens">
          {(campos, { add, remove }) => (
            <Flex vertical gap={8}>
              <Collapse
                activeKey={aberto}
                onChange={k => setAberto(Array.isArray(k) ? k : [k])}
                items={campos.map(({ key, name }, n) => {
                  const i = itens[n] || {};
                  const subtotal = (Number(i.quantidade) || 0) * (Number(i.custoUnitario) || 0);
                  return {
                    key: String(name),
                    forceRender: true,
                    label: (
                      <Flex gap={8} align="center" wrap>
                        <Tag style={{ margin: 0 }}>{n + 1}</Tag>
                        <Typography.Text strong>{String(i.nome || '').trim() || 'Novo item'}</Typography.Text>
                        {Number(i.quantidade) > 0 && <Typography.Text type="secondary">{i.quantidade} {i.unidade}</Typography.Text>}
                      </Flex>
                    ),
                    extra: (
                      <Flex gap={8} align="center" onClick={e => e.stopPropagation()}>
                        <Typography.Text strong>{brl(subtotal)}</Typography.Text>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={campos.length === 1}
                          onClick={() => { remove(name); setAberto(a => a.filter(x => x !== String(name))); }} />
                      </Flex>
                    ),
                    children: <div key={key}><CamposItem form={form} nome={name} /></div>,
                  };
                })}
              />
              <Button type="dashed" icon={<PlusOutlined />} block
                onClick={() => {
                  add(novoItem());
                  // O item novo abre e os outros fecham, para a lista não ficar comprida
                  const proximo = String(Math.max(-1, ...campos.map(c => c.name)) + 1);
                  setAberto([proximo]);
                }}>
                Adicionar outro item
              </Button>
            </Flex>
          )}
        </Form.List>

        <Flex gap={12} wrap justify="flex-end" align="flex-end"
          style={{ marginTop: 12, padding: '10px 12px', borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
          <Form.Item name="frete" label="Frete pago" tooltip="Dividido entre os itens: entra no custo" style={{ width: 140, marginBottom: 0 }}>
            <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="desconto" label="Desconto" style={{ width: 140, marginBottom: 0 }}>
            <InputNumber prefix="R$" min={0} precision={2} decimalSeparator="," style={{ width: '100%' }} />
          </Form.Item>
          <Flex vertical align="flex-end" style={{ minWidth: 190 }}>
            <Typography.Text type="secondary">{itens.length} item(ns) · produtos {brl(totalProdutos)}</Typography.Text>
            <Typography.Text strong style={{ fontSize: 18 }}>Total da compra {brl(totalProdutos + frete - desconto)}</Typography.Text>
          </Flex>
        </Flex>
      </Form>
    </Modal>
  );
}
