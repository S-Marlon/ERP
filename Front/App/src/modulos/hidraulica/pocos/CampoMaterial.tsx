// Campo de material do relatório e da estrutura do poço: escolhe do cadastro de materiais do módulo (com a cor de cada
// um) ou digita livre. Ao escolher do cadastro, avisa quem chamou com o material (para guardar o id, a cor, o
// comprimento da barra e o diâmetro na linha); ao digitar outra coisa, avisa com null.
import React, { useEffect, useSyncExternalStore } from 'react';
import { AutoComplete, Space, Typography } from 'antd';
import { materiaisApi, MaterialPoco } from './obrasApi';
import { corDoMaterial } from './materiaisPoco';

// Cadastro em memória (uma consulta por sessão; recarregar() depois de editar o cadastro)
let lista: MaterialPoco[] = [];
let pedido: Promise<void> | null = null;
const ouvintes = new Set<() => void>();
export const catalogoMateriais = {
  get: () => lista,
  carregar: (forcar = false) => {
    if (pedido && !forcar) return pedido;
    pedido = materiaisApi.cadastro().then(l => { lista = l; ouvintes.forEach(f => f()); }).catch(() => { pedido = null; });
    return pedido;
  },
  assinar: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
};
export const useCatalogoMateriais = () => {
  useEffect(() => { catalogoMateriais.carregar(); }, []);
  return useSyncExternalStore(catalogoMateriais.assinar, catalogoMateriais.get);
};

export const Bolinha: React.FC<{ cor: string | null | undefined }> = ({ cor }) => (
  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: cor || '#d9d9d9', border: '1px solid rgba(0,0,0,.15)', flex: '0 0 auto' }} />
);

interface Props {
  value?: string;
  onChange?: (v: string) => void;
  /** Categorias do cadastro oferecidas (ex.: TUBO e FILTRO no revestimento). */
  categorias: string[];
  onEscolher?: (m: MaterialPoco | null) => void;
  placeholder?: string;
  /** Cor atual da linha (para a bolinha do campo). */
  cor?: string | null;
  style?: React.CSSProperties;
}

export const CampoMaterial: React.FC<Props> = ({ value, onChange, categorias, onEscolher, placeholder, cor, style }) => {
  const catalogo = useCatalogoMateriais();
  const opcoes = catalogo.filter(m => categorias.includes(m.categoria) && m.ativo);
  const busca = String(value || '').toLowerCase();
  return (
    <AutoComplete
      style={style}
      value={value}
      placeholder={placeholder}
      popupMatchSelectWidth={false}
      allowClear
      options={opcoes.filter(m => !busca || m.nome.toLowerCase().includes(busca) || String(value) === m.nome).map(m => ({
        value: m.nome,
        label: (
          <Space size={6}>
            <Bolinha cor={corDoMaterial(m)} />
            <span>{m.nome}</span>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {[m.diametro, m.comprimentoM ? `barra ${String(m.comprimentoM).replace('.', ',')} m` : null, m.marca, m.classe].filter(Boolean).join(' · ')}
            </Typography.Text>
          </Space>
        ),
      }))}
      prefix={cor ? <Bolinha cor={cor} /> : undefined}
      onSelect={(nome: string) => { onChange?.(nome); onEscolher?.(opcoes.find(m => m.nome === nome) || null); }}
      onChange={(texto: string) => { onChange?.(texto); if (!opcoes.some(m => m.nome === texto)) onEscolher?.(null); }}
    />
  );
};
