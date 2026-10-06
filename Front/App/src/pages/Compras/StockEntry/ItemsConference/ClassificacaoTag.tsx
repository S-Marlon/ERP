// Onde a linha da nota vai parar no catálogo: família/categoria do item novo (editável aqui)
// ou a classificação atual do item já cadastrado (editada no editor de catálogo).
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { ApartmentOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { linhaItemNovo, linhaSemVinculo } from '../edicaoLote';

export interface NomesCatalogo {
  familias: Map<number, { nome: string; status: string; categoriaId: number | null }>;
  categorias: Map<number, string>; // id -> caminho (Pai › Filha)
  marcas?: Map<number, string>;
}

export interface ClassificacaoCatalogo {
  familia: { id: number; nome: string; status: string } | null;
  categoria: { id: number; nome: string } | null;
}

interface Props {
  item: any;
  nomes: NomesCatalogo;
  catalogo?: ClassificacaoCatalogo;   // item vinculado
  readOnly?: boolean;
  onEditar?: () => void;               // item novo: abre a classificação da linha
}

const ultimo = (caminho: string) => caminho.split(' › ').pop() || caminho;
const estilo = { margin: 0, fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const };

export const ClassificacaoTag: React.FC<Props> = ({ item, nomes, catalogo, readOnly, onEditar }) => {
  if (linhaSemVinculo(item)) return null;

  if (linhaItemNovo(item)) {
    const d = item.mapeamento.draftIdentity;
    const familia = d.familia_id ? nomes.familias.get(Number(d.familia_id)) : null;
    const idCategoria = familia ? familia.categoriaId : (d.categoria_id ? Number(d.categoria_id) : null);
    const caminho = idCategoria ? nomes.categorias.get(idCategoria) : null;
    const qtdAtributos = d.atributos ? Object.keys(d.atributos).length : 0;
    const marca = d.marca_id ? (nomes.marcas?.get(Number(d.marca_id)) || `Marca #${d.marca_id}`) : null;
    const clicavel = !readOnly && onEditar;

    if (!d.familia_id && !d.categoria_id) {
      return (
        <Tooltip title={clicavel ? 'Item novo sem família/categoria: clique para classificar (opcional)' : 'Item novo sem família/categoria'}>
          <Tag color="orange" icon={<ExclamationCircleOutlined />} style={{ ...estilo, cursor: clicavel ? 'pointer' : 'default' }} onClick={clicavel ? onEditar : undefined}>
            Sem classificação{marca ? ` · ${marca}` : ''}
          </Tag>
        </Tooltip>
      );
    }
    const texto = familia
      ? `${familia.nome}${caminho ? ` · ${ultimo(caminho)}` : ''}`
      : d.familia_id ? `Família #${d.familia_id}` : (caminho ? ultimo(caminho) : `Categoria #${d.categoria_id}`);
    return (
      <Tooltip title={
        <div>
          <div>Família: {familia?.nome || (d.familia_id ? `#${d.familia_id}` : '—')}{familia && familia.status !== 'ATIVO' ? ` (${familia.status.toLowerCase()})` : ''}</div>
          <div>Categoria: {caminho || '—'}</div>
          <div>Marca: {marca || '— (ou a marca DNA da família)'}</div>
          <div>Atributos preenchidos: {qtdAtributos || 'nenhum (completar no editor)'}</div>
          {clicavel && <div style={{ marginTop: 4, opacity: 0.8 }}>Clique para alterar</div>}
        </div>
      }>
        <Tag color="geekblue" icon={<ApartmentOutlined />} style={{ ...estilo, cursor: clicavel ? 'pointer' : 'default' }} onClick={clicavel ? onEditar : undefined}>
          {texto}{marca ? ` · ${marca}` : ''}{qtdAtributos > 0 ? ` · ${qtdAtributos} atrib.` : ''}
        </Tag>
      </Tooltip>
    );
  }

  // Item já cadastrado: classificação atual no catálogo (só leitura aqui)
  if (!catalogo) return null;
  const texto = catalogo.familia
    ? `${catalogo.familia.nome}${catalogo.categoria ? ` · ${catalogo.categoria.nome}` : ''}`
    : catalogo.categoria ? catalogo.categoria.nome : 'Sem família no catálogo';
  return (
    <Tooltip title="Classificação atual do item no catálogo. Para mudar, use o editor de catálogo.">
      <Tag icon={<ApartmentOutlined />} style={{ ...estilo, color: '#595959' }}>{texto}</Tag>
    </Tooltip>
  );
};

export default ClassificacaoTag;
