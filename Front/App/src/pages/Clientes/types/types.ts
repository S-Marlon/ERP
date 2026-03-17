export interface Cliente {
  id_cliente?: number;
  nome_razao: string;
  cpf_cnpj: string;
  tipo_cliente: string;
}

export interface PrecoEspecial {
  id_regra?: number;
  id_cliente: number;
  id_produto: number;
  descricao_produto?: string; // Para exibir na lista
  preco_custo: number; // Para validação
  preco_venda_padrao: number;
  tipo_desconto: 'VALOR_FIXO' | 'PERCENTUAL';
  valor: number;
  data_validade?: string;
}