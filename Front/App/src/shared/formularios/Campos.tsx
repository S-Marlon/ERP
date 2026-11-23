// Campos padrão dos cadastros (CPF/CNPJ, telefone, CEP, UF). Dentro de um <Form.Item> recebem value/onChange do antd:
// o formulário guarda só os números e o campo mostra a máscara. Regras de validação em ./documentos (regraCpf...).
import { useState } from 'react';
import { Input, Select, Spin, message } from 'antd';
import type { InputProps, SelectProps } from 'antd';
import { buscarCep, cepValido, limparTelefone, mascaraCep, mascaraCnpj, mascaraCpf, mascaraCpfCnpj, mascaraTelefone, soDigitos, UFS } from './documentos';
import type { EnderecoDoCep } from './documentos';

type CampoTexto = Omit<InputProps, 'value' | 'onChange'> & { value?: string | null; onChange?: (digitos: string) => void };

const tamanhos = { CPF: 11, CNPJ: 14, CPF_CNPJ: 14 } as const;
const mascaras = { CPF: mascaraCpf, CNPJ: mascaraCnpj, CPF_CNPJ: mascaraCpfCnpj } as const;

/** CPF, CNPJ ou os dois (até 11 números é CPF). Guarda só os números. */
export const CampoCpfCnpj = ({ value, onChange, tipo = 'CPF_CNPJ', placeholder, ...resto }: CampoTexto & { tipo?: 'CPF' | 'CNPJ' | 'CPF_CNPJ' }) => (
  <Input
    {...resto}
    inputMode="numeric"
    value={mascaras[tipo](value)}
    placeholder={placeholder ?? (tipo === 'CPF' ? '000.000.000-00' : tipo === 'CNPJ' ? '00.000.000/0000-00' : 'CPF ou CNPJ')}
    onChange={e => onChange?.(soDigitos(e.target.value).slice(0, tamanhos[tipo]))}
  />
);

/** Telefone com DDD; colar "+55 11 ..." tira o 55. Guarda só os números. */
export const CampoTelefone = ({ value, onChange, placeholder, ...resto }: CampoTexto) => (
  <Input
    {...resto}
    inputMode="tel"
    value={mascaraTelefone(limparTelefone(value))}
    placeholder={placeholder ?? '(00) 00000-0000'}
    onChange={e => onChange?.(limparTelefone(e.target.value).slice(0, 11))}
  />
);

/**
 * CEP: ao completar os 8 números consulta o ViaCEP e chama onEndereco (a tela preenche rua, bairro, cidade e UF).
 * CEP que não existe só avisa; sem internet o operador digita o endereço.
 */
export const CampoCep = ({ value, onChange, onEndereco, placeholder, ...resto }: CampoTexto & { onEndereco?: (e: EnderecoDoCep) => void }) => {
  const [buscando, setBuscando] = useState(false);
  const consultar = async (cep: string) => {
    if (!onEndereco || !cepValido(cep)) return;
    setBuscando(true);
    try {
      const e = await buscarCep(cep);
      if (e) onEndereco(e);
      else message.warning('CEP não encontrado: confira os números ou preencha o endereço à mão.');
    } catch {
      message.warning('Não foi possível consultar o CEP agora; preencha o endereço à mão.');
    } finally {
      setBuscando(false);
    }
  };
  return (
    <Input
      {...resto}
      inputMode="numeric"
      value={mascaraCep(value)}
      placeholder={placeholder ?? '00000-000'}
      suffix={buscando ? <Spin size="small" /> : <span />}
      onChange={e => {
        const cep = soDigitos(e.target.value).slice(0, 8);
        onChange?.(cep);
        if (cep.length === 8 && cep !== soDigitos(value)) consultar(cep);
      }}
    />
  );
};

/** As 27 UFs, com busca pela sigla. */
export const CampoUf = (props: Omit<SelectProps<string>, 'options'>) => (
  <Select<string>
    showSearch
    allowClear
    placeholder="UF"
    popupMatchSelectWidth={false}
    {...props}
    options={UFS.map(uf => ({ value: uf, label: uf }))}
  />
);
