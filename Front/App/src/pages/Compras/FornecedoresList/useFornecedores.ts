import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import { getFornecedores, createSupplier } from './fornecedores.api'; // Ajuste o caminho do import da sua API

export interface FornecedorAggregate {
  id_pessoa: number;
  tipo_pessoa: 'PF' | 'PJ';
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

export const useFornecedores = (tenantId: number = 1) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fornecedores, setFornecedores] = useState<FornecedorAggregate[]>([]);
  const [fornecedorAtivo, setFornecedorAtivo] = useState<FornecedorAggregate | null>(null);

  // 🟢 Busca real de fornecedores diretamente na API do backend
  const fetchFornecedores = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFornecedores(tenantId);
      
      // Mapeia o formato retornado pelo backend para o padrão esperado pelo front/interface
      const listaMapeada: FornecedorAggregate[] = data.map((item: any) => ({
        id_pessoa: item.id_pessoa,
        tipo_pessoa: item.tipo_pessoa || 'PJ',
        nome_razao: item.razao_social,
        nome_fantasia: item.nome_fantasia,
        documento: item.cnpj || item.documento || '',
        status: item.status || 'ATIVO',
        email: item.email || '',
        telefone: item.telefone || '',
        cidade: item.enderecos?.[0]?.cidade || 'Não informada',
        estado: item.enderecos?.[0]?.estado || 'SP',
        inscricao_estadual: item.inscricao_estadual
      }));

      setFornecedores(listaMapeada);
      
      // Se houver registros e nenhum ativo selecionado, define o primeiro por padrão
      if (listaMapeada.length > 0 && !fornecedorAtivo) {
        setFornecedorAtivo(listaMapeada[0]);
      } else if (listaMapeada.length === 0) {
        setFornecedorAtivo(null);
      }
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err);
      message.error('Não foi possível carregar a lista de fornecedores.');
      setFornecedores([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, fornecedorAtivo]);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const fornecedoresFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase().trim();
    if (!termo) return fornecedores;
    return fornecedores.filter(f => 
      f.nome_razao.toLowerCase().includes(termo) || 
      f.documento.includes(termo) ||
      (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(termo))
    );
  }, [fornecedores, searchTerm]);

  // 🟢 Cadastro real usando a API
  const handleCreateFornecedor = async (values: any) => {
    setLoading(true);
    try {
      const supplierData = {
        cnpj: values.tipo_pessoa === 'PJ' ? values.cnpj : (values.documento || ''),
        name: values.tipo_pessoa === 'PJ' ? values.razao_social : values.nome_pf,
        fantasyName: values.nome_fantasia || values.razao_social || values.nome_pf
      };

      const res = await createSupplier(supplierData, tenantId);
      
      message.success('Fornecedor registrado com sucesso!');
      
      // Atualiza a lista buscando do backend novamente para garantir consistência
      await fetchFornecedores();
      
      return true;
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Erro ao salvar o fornecedor.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    searchTerm,
    setSearchTerm,
    fornecedores,
    fornecedorAtivo,
    setFornecedorAtivo,
    fornecedoresFiltrados,
    fetchFornecedores,
    handleCreateFornecedor
  };
};