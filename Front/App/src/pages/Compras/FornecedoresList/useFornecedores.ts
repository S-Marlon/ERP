import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { getFornecedores, createSupplier } from './fornecedores.api';

export interface FornecedorAggregate {
  id_pessoa: number;
  nome_razao: string;
  nome_fantasia?: string;
  documento: string;
  status: 'ATIVO' | 'INATIVO';
  email: string;
  telefone: string;
  cidade: string;
  estado: string;
  inscricao_estadual?: string;
}

export interface NovoFornecedor {
  razao_social: string; cnpj: string; nome_fantasia?: string; inscricao_estadual?: string;
  email?: string; telefone?: string; cidade?: string; estado?: string;
}

const normalizar = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const useFornecedores = (tenantId: number = 1) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fornecedores, setFornecedores] = useState<FornecedorAggregate[]>([]);
  const [idAtivo, setIdAtivo] = useState<number | null>(null);

  const fetchFornecedores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFornecedores(tenantId);
      const lista: FornecedorAggregate[] = data.map(item => {
        const endereco = item.enderecos?.find(e => Boolean(Number(e.principal))) || item.enderecos?.[0];
        return {
          id_pessoa: Number(item.id_pessoa),
          nome_razao: item.razao_social,
          nome_fantasia: item.nome_fantasia || undefined,
          documento: item.cnpj || '',
          status: item.status || 'ATIVO',
          email: item.email || '',
          telefone: item.telefone || '',
          cidade: endereco?.cidade || '',
          estado: endereco?.estado || '',
          inscricao_estadual: item.inscricao_estadual || undefined,
        };
      });
      setFornecedores(lista);
      // Mantém o selecionado; sem seleção, abre o primeiro
      setIdAtivo(atual => (atual && lista.some(f => f.id_pessoa === atual) ? atual : lista[0]?.id_pessoa ?? null));
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err);
      message.error('Não foi possível carregar a lista de fornecedores.');
      setFornecedores([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchFornecedores(); }, [fetchFornecedores]);

  // Busca por apelido, razão social, CNPJ (com ou sem pontuação) e cidade
  const fornecedoresFiltrados = useMemo(() => {
    const termo = normalizar(searchTerm.trim());
    if (!termo) return fornecedores;
    const digitos = searchTerm.replace(/\D/g, '');
    return fornecedores.filter(f =>
      normalizar(f.nome_razao).includes(termo) ||
      normalizar(f.nome_fantasia).includes(termo) ||
      normalizar(f.cidade).includes(termo) ||
      (digitos.length >= 3 && f.documento.replace(/\D/g, '').includes(digitos))
    );
  }, [fornecedores, searchTerm]);

  const handleCreateFornecedor = async (values: NovoFornecedor) => {
    setLoading(true);
    try {
      const r = await createSupplier({
        cnpj: values.cnpj, name: values.razao_social, fantasyName: values.nome_fantasia || '',
        stateRegistration: values.inscricao_estadual, phone: values.telefone, email: values.email,
        endereco: values.cidade ? { cidade: values.cidade, estado: values.estado } : undefined,
      }, tenantId);
      message.success(r.message || 'Fornecedor cadastrado.');
      await fetchFornecedores();
      if (r.id_pessoa) setIdAtivo(Number(r.id_pessoa));
      return true;
    } catch (err) {
      console.error(err);
      message.error(err instanceof Error ? err.message : 'Erro ao salvar o fornecedor.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading, searchTerm, setSearchTerm, fornecedores, fornecedoresFiltrados, idAtivo, setIdAtivo, fetchFornecedores, handleCreateFornecedor,
  };
};
