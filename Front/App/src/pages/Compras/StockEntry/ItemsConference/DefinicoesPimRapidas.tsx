// Definições rápidas do PIM na entrada de NF: criar categoria ou família (com os atributos principais)
// sem sair da tela. O ajuste fino (templates, DNA com valor fixo, marca) continua nas telas do catálogo.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Checkbox, Form, Input, Modal, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { createFamilia, getAtributosGlobais, updateFamilia } from '../../../Catalogo/pages/FamilyManager/FamilyManager.api';
import { createCategory } from '../../../Catalogo/pages/CategoryManager/categoryService';
import { PAPEL_ATRIBUTO } from '../../../Catalogo/pages/CatalogSkus/CampoAtributo';
import type { AtributoFicha } from '../../../Catalogo/pages/CatalogSkus/CatalogSku.service';
import { getAtributosParaItem } from '../../api/comprasApi';

const { Text } = Typography;

export interface CategoriaOpcaoRapida { id: number; caminho: string }
interface AtributoPool { id: string; nome: string }

// Pool de atributos: carregado uma vez por sessão da tela
let cachePool: Promise<AtributoPool[]> | null = null;
const carregarPool = () => {
  if (!cachePool) {
    cachePool = getAtributosGlobais(1)
      .then(l => l.map(a => ({ id: String(a.id), nome: a.nome })).sort((a, b) => a.nome.localeCompare(b.nome)))
      .catch(err => { cachePool = null; throw err; });
  }
  return cachePool;
};

const usePool = (aberto: boolean) => {
  const [pool, setPool] = useState<AtributoPool[]>([]);
  useEffect(() => { if (aberto) carregarPool().then(setPool).catch(() => setPool([])); }, [aberto]);
  return pool;
};

// Sigla sugerida a partir do nome: iniciais das palavras relevantes (ex: "Mangueira Hidráulica" → MH)
const sugerirSigla = (nome: string) => {
  const palavras = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .split(/[^A-Z0-9]+/).filter(p => p.length > 2 || /\d/.test(p));
  if (palavras.length === 0) return '';
  if (palavras.length === 1) return palavras[0].slice(0, 3);
  return palavras.slice(0, 4).map(p => p[0]).join('');
};

// Atributos que a categoria escolhida já passa adiante (para não repetir na família)
const useHerdadosDaCategoria = (categoriaId: number | null | undefined) => {
  const [herdados, setHerdados] = useState<AtributoFicha[]>([]);
  useEffect(() => {
    if (!categoriaId) { setHerdados([]); return; }
    let ativo = true;
    getAtributosParaItem(null, categoriaId)
      .then(r => { if (ativo) setHerdados(r.atributos || []); })
      .catch(() => { if (ativo) setHerdados([]); });
    return () => { ativo = false; };
  }, [categoriaId]);
  return herdados;
};

const ListaHerdados: React.FC<{ herdados: AtributoFicha[] }> = ({ herdados }) => herdados.length === 0 ? null : (
  <div style={{ marginTop: -6, marginBottom: 10 }}>
    <Text type="secondary" style={{ fontSize: 11 }}>Já vêm da categoria: </Text>
    {herdados.map(a => (
      <Tag key={a.atributoId} color={PAPEL_ATRIBUTO[a.papel]?.color} style={{ fontSize: 10, marginBottom: 2 }}>{a.nome}</Tag>
    ))}
  </div>
);

// ---------------------------------------------------------------------------------------------
// Nova categoria
// ---------------------------------------------------------------------------------------------
interface NovaCategoriaProps {
  open: boolean;
  categorias: CategoriaOpcaoRapida[];
  paiInicial?: number | null;
  onFechar: () => void;
  onCriada: (id: number) => void;
}

export const ModalNovaCategoria: React.FC<NovaCategoriaProps> = ({ open, categorias, paiInicial, onFechar, onCriada }) => {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const pool = usePool(open);
  const paiId = Form.useWatch('paiId', form);
  const herdados = useHerdadosDaCategoria(paiId);

  useEffect(() => {
    if (open) { form.resetFields(); form.setFieldsValue({ paiId: paiInicial ?? undefined }); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    const v = await form.validateFields();
    const grade: string[] = v.grade || [];
    const ficha: string[] = (v.ficha || []).filter((id: string) => !grade.includes(id));
    setSalvando(true);
    try {
      const r = await createCategory({
        nome: String(v.nome).trim(),
        parentId: v.paiId ? String(v.paiId) : null,
        percentualMargemSugerida: null,
        modoExibicao: 'grade',
        atributosHeranca: [
          ...grade.map((id, i) => ({ id, escopoComercial: 'grade', obrigatorio: true, pesquisavel: true, ordem: i })),
          ...ficha.map((id, i) => ({ id, escopoComercial: 'ficha', obrigatorio: false, pesquisavel: true, ordem: grade.length + i })),
        ],
      } as never);
      message.success('Categoria criada.');
      onCriada(Number(r.id));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao criar a categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const opcoesPool = pool.filter(a => !herdados.some(h => String(h.atributoId) === a.id)).map(a => ({ value: a.id, label: a.nome }));

  return (
    <Modal open={open} title="Nova categoria" okText="Criar categoria" cancelText="Cancelar"
      onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden width={520}>
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="nome" label="Nome" rules={[{ required: true, whitespace: true, message: 'Informe o nome.' }]}>
          <Input placeholder="Ex: Terminais hidráulicos" autoFocus />
        </Form.Item>
        <Form.Item name="paiId" label="Dentro de (categoria pai)">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Nenhuma (categoria raiz)"
            options={categorias.map(c => ({ value: c.id, label: c.caminho }))} />
        </Form.Item>
        <ListaHerdados herdados={herdados} />
        <Form.Item name="grade" label={<Tooltip title={PAPEL_ATRIBUTO.grade.ajuda}>Atributos de grade (mudam de um item para outro)</Tooltip>}>
          <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="Ex: Bitola, Rosca" options={opcoesPool} />
        </Form.Item>
        <Form.Item name="ficha" label={<Tooltip title={PAPEL_ATRIBUTO.ficha.ajuda}>Atributos de ficha (informativos)</Tooltip>}>
          <Select mode="multiple" allowClear showSearch optionFilterProp="label" placeholder="Opcional" options={opcoesPool} />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 11 }}>
          Os atributos valem para todas as famílias e itens dentro desta categoria. Para criar um atributo que ainda não existe, use Catálogo › Atributos.
        </Text>
      </Form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------------------------
// Nova família
// ---------------------------------------------------------------------------------------------
interface NovaFamiliaProps {
  open: boolean;
  categorias: CategoriaOpcaoRapida[];
  categoriaInicial?: number | null;
  nomeInicial?: string;
  onFechar: () => void;
  onCriada: (id: number) => void;
  onNovaCategoria: () => void;
  // Categoria recém-criada pelo botão "nova categoria" (entra selecionada)
  categoriaCriada?: number | null;
}

export const ModalNovaFamilia: React.FC<NovaFamiliaProps> = ({
  open, categorias, categoriaInicial, nomeInicial, onFechar, onCriada, onNovaCategoria, categoriaCriada,
}) => {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const pool = usePool(open);
  const categoriaId = Form.useWatch('categoriaId', form);
  const nome = Form.useWatch('nome', form);
  const grade: string[] = Form.useWatch('grade', form) || [];
  const herdados = useHerdadosDaCategoria(categoriaId);
  const [siglaTocada, setSiglaTocada] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setSiglaTocada(false);
      form.setFieldsValue({ categoriaId: categoriaInicial ?? undefined, nome: nomeInicial || undefined, sigla: sugerirSigla(nomeInicial || ''), ativar: true });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (categoriaCriada) form.setFieldsValue({ categoriaId: categoriaCriada }); }, [categoriaCriada]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!siglaTocada) form.setFieldsValue({ sigla: sugerirSigla(nome || '') }); }, [nome]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradeHerdada = herdados.filter(a => a.papel === 'grade').length;
  const temGrade = grade.length + gradeHerdada > 0;

  const salvar = async () => {
    const v = await form.validateFields();
    const gradeSel: string[] = v.grade || [];
    const fichaSel: string[] = (v.ficha || []).filter((id: string) => !gradeSel.includes(id));
    setSalvando(true);
    try {
      const r = await createFamilia({
        nome: String(v.nome).trim(),
        categoriaPai: v.categoriaId ? String(v.categoriaId) : '',
        siglaSku: String(v.sigla || '').trim().toUpperCase() || undefined,
      } as never);
      const id = String(r.id);
      // Atributos próprios (texto digitado que não existe no pool vira um atributo novo, do tipo texto)
      const doPool = (valor: string) => pool.find(a => a.id === valor);
      const montar = (valor: string, papel: 'grade' | 'ficha', i: number) => {
        const existente = doPool(valor);
        return {
          id: existente ? existente.id : `novo-${i}-${valor}`,
          nome: existente ? existente.nome : valor.trim(),
          tipoDado: 'texto',
          classificacao: papel,
          obrigatorio: papel === 'grade',
          compoeSku: papel === 'grade',
          ordemSku: i + 1,
          origem: 'locais',
        };
      };
      const atributos = [...gradeSel.map((a, i) => montar(a, 'grade', i)), ...fichaSel.map((a, i) => montar(a, 'ficha', gradeSel.length + i))];
      if (atributos.length > 0 || v.ativar) {
        const res = await updateFamilia(id, { atributos, ...(v.ativar ? { status: 'ATIVO' } : {}) } as never) as { status?: string; message?: string };
        if (v.ativar && res.status && res.status !== 'ATIVO') {
          message.warning(res.message || 'Família criada, mas ainda não atende às regras para ficar ativa. Complete em Catálogo › Famílias.');
        } else {
          message.success(v.ativar ? 'Família criada e ativa.' : 'Família criada como rascunho.');
        }
      } else {
        message.success('Família criada como rascunho.');
      }
      cachePool = null;
      onCriada(Number(id));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao criar a família.');
    } finally {
      setSalvando(false);
    }
  };

  const opcoesPool = useMemo(
    () => pool.filter(a => !herdados.some(h => String(h.atributoId) === a.id)).map(a => ({ value: a.id, label: a.nome })),
    [pool, herdados],
  );

  return (
    <Modal open={open} title="Nova família" okText="Criar família" cancelText="Cancelar"
      onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden width={560}>
      <Form form={form} layout="vertical" size="small">
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="nome" label="Nome" style={{ flex: 1 }} rules={[{ required: true, whitespace: true, message: 'Informe o nome.' }]}>
            <Input placeholder="Ex: Terminal reto JIC fêmea" autoFocus />
          </Form.Item>
          <Form.Item name="sigla" label={<Tooltip title="Prefixo do SKU dos itens da família (ex: TRJ-08-08)">Sigla</Tooltip>} style={{ width: 110, marginLeft: 8 }}>
            <Input maxLength={8} onChange={() => setSiglaTocada(true)} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="categoriaId" label={
          <Space size={8}>Categoria<a style={{ fontSize: 12 }} onClick={onNovaCategoria}>+ nova categoria</a></Space>
        }>
          <Select allowClear showSearch optionFilterProp="label" placeholder="Sem categoria (não herda atributos)"
            options={categorias.map(c => ({ value: c.id, label: c.caminho }))} />
        </Form.Item>
        <ListaHerdados herdados={herdados} />
        <Form.Item name="grade" label={<Tooltip title={PAPEL_ATRIBUTO.grade.ajuda}>Atributos de grade (o que muda de um item para outro)</Tooltip>}
          extra={<span style={{ fontSize: 11 }}>Escolha da lista ou digite um nome novo e tecle Enter para criar.</span>}>
          <Select mode="tags" allowClear showSearch optionFilterProp="label" placeholder="Ex: Bitola, Rosca" options={opcoesPool} />
        </Form.Item>
        <Form.Item name="ficha" label={<Tooltip title={PAPEL_ATRIBUTO.ficha.ajuda}>Atributos de ficha (informativos)</Tooltip>}>
          <Select mode="tags" allowClear showSearch optionFilterProp="label" placeholder="Opcional" options={opcoesPool} />
        </Form.Item>
        <Form.Item name="ativar" valuePropName="checked" style={{ marginBottom: 4 }}>
          <Checkbox>Ativar a família agora (os itens já podem ir para o PDV)</Checkbox>
        </Form.Item>
        {!temGrade && (
          <Alert type="info" showIcon style={{ padding: '4px 8px', fontSize: 12 }}
            message="Sem atributo de grade a família não fica ativa: os itens dela não teriam como se diferenciar." />
        )}
      </Form>
    </Modal>
  );
};
