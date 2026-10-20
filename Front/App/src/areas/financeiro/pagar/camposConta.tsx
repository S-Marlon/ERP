// Campos comuns das contas da loja: quem recebe (um nome, ex.: Copel, ou um fornecedor cadastrado) e a categoria.
// useDadosConta carrega categorias e fornecedores uma vez para os formulários.
import React, { useCallback, useEffect, useState } from 'react';
import { Input, Segmented, Select, Space, message } from 'antd';
import { CategoriaConta, pagarApi } from './pagarApi';
import { opcoesDeCategoria } from './contasForm';

export const useDadosConta = (aberto: boolean) => {
  const [categorias, setCategorias] = useState<CategoriaConta[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: number; nome: string }[]>([]);
  const recarregarCategorias = useCallback(() => pagarApi.categorias().then(setCategorias).catch(e => message.error(e.message)), []);
  useEffect(() => {
    if (!aberto) return;
    recarregarCategorias();
    pagarApi.fornecedores().then(setFornecedores).catch(() => setFornecedores([]));
  }, [aberto, recarregarCategorias]);
  return { categorias, fornecedores, recarregarCategorias };
};

export const QuemRecebe: React.FC<{
  idFornecedor: number | null; favorecido: string | null; fornecedores: { id: number; nome: string }[];
  onChange: (v: { idFornecedor: number | null; favorecido: string | null }) => void;
}> = ({ idFornecedor, favorecido, fornecedores, onChange }) => {
  const [modo, setModo] = useState<'NOME' | 'CADASTRO'>(idFornecedor ? 'CADASTRO' : 'NOME');
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Segmented size="small" value={modo} onChange={v => { setModo(v as 'NOME' | 'CADASTRO'); onChange({ idFornecedor: null, favorecido: null }); }}
        options={[{ value: 'NOME', label: 'Só o nome' }, { value: 'CADASTRO', label: 'Fornecedor cadastrado' }]} />
      {modo === 'NOME' ? (
        <Input placeholder="Ex.: Copel, Sanepar, Imobiliária Silva" maxLength={100} value={favorecido || ''}
          onChange={e => onChange({ idFornecedor: null, favorecido: e.target.value })} />
      ) : (
        <Select showSearch optionFilterProp="label" placeholder="Escolha o fornecedor" style={{ width: '100%' }} value={idFornecedor ?? undefined}
          options={fornecedores.map(f => ({ value: f.id, label: f.nome }))} onChange={(v: number) => onChange({ idFornecedor: v, favorecido: null })} />
      )}
    </Space>
  );
};

export const SelectCategoria: React.FC<{ categorias: CategoriaConta[]; value: number | null; onChange: (v: number | null) => void }> = ({ categorias, value, onChange }) => (
  <Select allowClear showSearch optionFilterProp="label" placeholder="Para onde vai o dinheiro (ex.: Energia elétrica)" style={{ width: '100%' }}
    value={value ?? undefined} options={opcoesDeCategoria(categorias, 'DESPESA', value)} onChange={v => onChange((v as number) ?? null)} />
);
