Table Core_clientes {
  id_cliente int [pk, increment]

  tipo_pessoa enum // PF | PJ  segmento varchar

  nome_razao varchar [not null]
  nome_fantasia varchar
  cpf_cnpj varchar [not null]

  inscricao_estadual varchar
  inscricao_municipal varchar

  status_cliente varchar
  aceita_marketing boolean

  ultima_compra datetime

  created_at datetime
  updated_at datetime
}

Table core_clientes_pj {
  id_cliente bigint [pk]

  razao_social varchar [not null]

  nome_fantasia varchar

  cnpj varchar [unique, not null]

  inscricao_estadual varchar
  inscricao_municipal varchar

  created_at datetime
  updated_at datetime
}

Table core_clientes_pf {
  id_cliente bigint [pk]

  nome varchar [not null]

  cpf varchar [unique, not null]

  rg varchar

  data_nascimento date

  genero varchar

  created_at datetime
  updated_at datetime
}

Table Core_cliente_enderecos {
  id_endereco int [pk, increment]

  id_cliente int [not null]

  tipo enum // COBRANCA, ENTREGA, PRINCIPAL etc

  logradouro varchar
  numero varchar
  complemento varchar
  bairro varchar
  cidade varchar
  estado varchar
  cep varchar
  pais varchar

  referencia varchar

  created_at datetime
  updated_at datetime

  latitude varchar
longitude varchar

  principal boolean


}

Ref: Core_cliente_enderecos.id_cliente > Core_clientes.id_cliente


Table Core_cliente_contatos {
  id int [pk, increment]

  id_cliente int [not null]

  nome varchar
  telefone varchar

  tipo varchar // COMERCIAL, FINANCEIRO, etc

  principal boolean
  whatsapp boolean

  referencia varchar

  created_at datetime
  updated_at datetime


   nome_contato varchar

  setor enum
  // COMERCIAL | FINANCEIRO | SUPORTE | DIRETORIA | COMPRAS

  cargo varchar




  observacoes text

}

Ref: Core_cliente_contatos.id_cliente > Core_clientes.id_cliente

Table Core_cliente_emails {
  id int [pk, increment]

  id_cliente int [not null]

  email varchar [not null]

  tipo varchar

  principal boolean
  verificado boolean

  created_at datetime
  updated_at datetime


  setor enum
  // COMERCIAL | FINANCEIRO | FISCAL | NFE | SUPORTE



  recebe_nfe boolean
  recebe_marketing boolean
  recebe_cobranca boolean

}

Ref: Core_cliente_emails.id_cliente > Core_clientes.id_cliente

Table cliente_credito {
  id int [pk, increment]

  id_cliente int [not null]

  limite_credito decimal
  dia_vencimento int
  status_credito varchar

  score_credito int

  created_at datetime
  updated_at datetime
}

Ref: cliente_credito.id_cliente > Core_clientes.id_cliente

Table cliente_financeiro {
  id int [pk, increment]

  id_cliente int [not null]

  saldo_devedor_atual decimal

  total_aberto decimal
  total_pago decimal
  total_atrasado decimal

  created_at datetime
  updated_at datetime
}

Ref: cliente_financeiro.id_cliente > Core_clientes.id_cliente

Table cliente_crm {
  id int [pk, increment]

  id_cliente int [not null]

  classificacao varchar
  potencial varchar
  score_comercial int

  segmento varchar

  created_at datetime
  updated_at datetime
}

Ref: cliente_crm.id_cliente > Core_clientes.id_cliente

Table Core_cliente_documentos {
  id int [pk, increment]

  id_cliente int [not null]

  tipo varchar // RG, CONTRATO, COMPROVANTE, OUTRO
  // RG | CPF | CONTRATO | COMPROVANTE | OUTRO
  nome varchar

 storage_provider varchar
storage_path varchar
mime_type varchar
size bigint
hash varchar

extensao varchar

  observacao varchar

  created_at datetime
  updated_at datetime









}

Ref: Core_cliente_documentos.id_cliente > Core_clientes.id_cliente

Table cliente_atividades {
  id int [pk, increment]

  id_cliente int [not null]

  tipo varchar // LIGACAO, VENDA, COBRANCA, VISITA, OBSERVACAO
  titulo varchar
  descricao text

  prioridade varchar // BAIXA, MEDIA, ALTA, URGENTE

  data datetime

  created_by int

  created_at datetime
}

Ref: cliente_atividades.id_cliente > Core_clientes.id_cliente

Table tags {
  id int [pk, increment]

  nome varchar [not null]
  cor varchar

  created_at datetime


  tenant_id bigint


}

Table cliente_tags {
  id_cliente int
  id_tag int

  created_at datetime

  indexes {
    (id_cliente, id_tag) [pk]
  }
}

Ref: cliente_tags.id_cliente > Core_clientes.id_cliente
Ref: cliente_tags.id_tag > tags.id


Table cliente_precos_especiais {
  id int [pk, increment]

  id_cliente int [not null]
  id_produto int [not null]

  tipo_desconto varchar // VALOR_FIXO | PERCENTUAL

  preco_final decimal // ex: 10.00
  percentual_desconto decimal

  motivo varchar // concorrência, fidelidade, volume

  ativo boolean

  data_inicio datetime
  data_fim datetime

  created_at datetime
}

Ref: cliente_precos_especiais.id_cliente > Core_clientes.id_cliente

Table cliente_eventos {
  id int [pk, increment]

  id_cliente int [not null]

  tipo varchar
  // COMPRA, PAGAMENTO, ATRASO, LIGACAO, ORCAMENTO, DESCONTO, VISITA

  origem varchar
  // vendas, crm, financeiro, sistema, manual

  referencia_id int // id da venda, conta, etc

  valor decimal

  payload json // FLEXÍVEL (muito importante)

  data datetime

  created_at datetime
}

Table cliente_metricas_snapshot {
  id int [pk, increment]

  id_cliente int

  data_ref datetime

  score_credito int
  score_comercial int

  limite_credito decimal
  saldo_devedor decimal

  total_compras_30d decimal
  total_compras_90d decimal

  compras_count_30d int

  created_at datetime
}

Table cliente_perfil_agregado {
  id int [pk, increment]

  id_cliente int

  ticket_medio decimal

  frequencia_compra_dias int

  dias_desde_ultima_compra int

  total_gasto decimal

  total_compras int

  categoria_frequente varchar

  sensibilidade_preco varchar
  // BAIXA | MEDIA | ALTA

  risco_inadimplencia decimal

  probabilidade_churn decimal

  valor_lifetime_estimado decimal

  updated_at datetime
}

