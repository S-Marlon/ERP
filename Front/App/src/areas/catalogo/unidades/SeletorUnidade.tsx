// Seletor de unidade dos itens (UN, PC, MT, LT...) a partir do cadastro (Catálogo › Unidades).
// Unidade nova só com confirmação e nome — evita siglas repetidas ou digitadas errado ("PAR" x "PR", "M" x "MT").
import React, { useEffect, useState } from 'react';
import { Button, Divider, Form, Input, Modal, Select, message } from 'antd';
import type { SelectProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';

export interface UnidadeItem { id_unidade: number; sigla: string; descricao: string }

// Cadastro carregado uma vez e compartilhado entre os seletores da tela
let cache: UnidadeItem[] | null = null;
let carregando: Promise<UnidadeItem[]> | null = null;
const ouvintes = new Set<(u: UnidadeItem[]) => void>();

const carregarUnidades = (forcar = false): Promise<UnidadeItem[]> => {
  if (cache && !forcar) return Promise.resolve(cache);
  if (carregando && !forcar) return carregando;
  carregando = fetch(`${API_URL}/api/catalogo/itens-unidades?tenant_id=1`)
    .then(r => r.json())
    .then(d => {
      cache = (d.unidades || []).map((u: UnidadeItem) => ({ ...u, sigla: String(u.sigla).toUpperCase() }));
      ouvintes.forEach(o => o(cache!));
      return cache!;
    })
    .catch(() => cache || [])
    .finally(() => { carregando = null; });
  return carregando;
};

const criarUnidade = async (sigla: string, descricao: string): Promise<UnidadeItem> => {
  const r = await fetch(`${API_URL}/api/catalogo/itens-unidades?tenant_id=1`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sigla, descricao }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || 'Erro ao cadastrar a unidade.');
  await carregarUnidades(true);
  return d.unidade;
};

/** Cadastro de unidades (para quem precisa do nome de uma sigla). */
export const useUnidadesItens = () => {
  const [lista, setLista] = useState<UnidadeItem[]>(cache || []);
  useEffect(() => {
    ouvintes.add(setLista);
    carregarUnidades().then(setLista);
    return () => { ouvintes.delete(setLista); };
  }, []);
  return lista;
};

interface Props extends Omit<SelectProps, 'value' | 'onChange' | 'options' | 'mode'> {
  value?: string | null;
  /** Recebe a sigla escolhida e a unidade do cadastro */
  onChange?: (sigla: string, unidade: UnidadeItem | null) => void;
  /** Siglas que não podem ser escolhidas (ex.: unidades que o item já tem) */
  excluir?: string[];
  /** Permite cadastrar unidade nova (padrão: sim) */
  permitirNova?: boolean;
}

export const SeletorUnidade: React.FC<Props> = ({ value, onChange, excluir = [], permitirNova = true, placeholder = 'Unidade', ...resto }) => {
  const unidades = useUnidadesItens();
  const [busca, setBusca] = useState('');
  const [nova, setNova] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm<{ sigla: string; descricao: string }>();
  const fora = new Set(excluir.map(s => s.toUpperCase()));
  const atual = value ? String(value).toUpperCase() : undefined;

  const opcoes = [
    ...unidades.filter(u => !fora.has(u.sigla) || u.sigla === atual)
      .map(u => ({ value: u.sigla, label: u.descricao && u.descricao !== u.sigla ? `${u.sigla} – ${u.descricao}` : u.sigla })),
    // Sigla gravada que não está no cadastro (item antigo): aparece para não sumir
    ...(atual && !unidades.some(u => u.sigla === atual) ? [{ value: atual, label: `${atual} (fora do cadastro)` }] : []),
  ];

  const abrirNova = () => {
    form.setFieldsValue({ sigla: busca.trim().toUpperCase().slice(0, 5), descricao: '' });
    setNova(true);
  };

  const confirmarNova = async () => {
    const v = await form.validateFields();
    const sigla = v.sigla.trim().toUpperCase();
    if (unidades.some(u => u.sigla === sigla)) {
      onChange?.(sigla, unidades.find(u => u.sigla === sigla) || null);
      setNova(false);
      return;
    }
    setSalvando(true);
    try {
      const u = await criarUnidade(sigla, v.descricao.trim());
      message.success(`Unidade ${u.sigla} – ${u.descricao} cadastrada.`);
      onChange?.(u.sigla, u);
      setNova(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao cadastrar a unidade.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Select
        showSearch
        placeholder={placeholder}
        value={atual}
        options={opcoes}
        popupMatchSelectWidth={false}
        onSearch={setBusca}
        filterOption={(input, o) => String(o?.label ?? '').toUpperCase().includes(input.toUpperCase())}
        onChange={(v: string) => onChange?.(v, unidades.find(u => u.sigla === v) || null)}
        notFoundContent={busca ? `"${busca.toUpperCase()}" não está no cadastro` : 'Nenhuma unidade'}
        popupRender={menu => (
          <>
            {menu}
            {permitirNova && (
              <>
                <Divider style={{ margin: '4px 0' }} />
                <Button type="text" block icon={<PlusOutlined />} style={{ textAlign: 'left' }} onMouseDown={e => e.preventDefault()} onClick={abrirNova}>
                  Criar unidade nova{busca ? ` "${busca.toUpperCase().slice(0, 5)}"` : ''}
                </Button>
              </>
            )}
          </>
        )}
        {...resto}
      />
      <Modal open={nova} title="Criar unidade nova" okText="Cadastrar" cancelText="Cancelar" confirmLoading={salvando} destroyOnHidden
        onOk={confirmarNova} onCancel={() => setNova(false)}>
        <p style={{ marginTop: 0, color: '#64748b' }}>
          Confira se ela já não existe com outra sigla (ex.: Par é <b>PR</b>, Metro é <b>MT</b>). A unidade nova vale para todos os itens.
        </p>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="sigla" label="Sigla" rules={[{ required: true, pattern: /^[A-Za-z0-9]{1,5}$/, message: 'De 1 a 5 letras ou números (ex.: GL)' }]}>
            <Input maxLength={5} autoFocus onChange={e => form.setFieldValue('sigla', e.target.value.toUpperCase())} />
          </Form.Item>
          <Form.Item name="descricao" label="Nome" rules={[{ required: true, whitespace: true, message: 'Informe o nome (ex.: Galão)' }]}>
            <Input maxLength={60} placeholder="Ex.: Galão" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SeletorUnidade;
