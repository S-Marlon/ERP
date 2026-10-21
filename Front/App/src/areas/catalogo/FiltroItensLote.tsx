// Filtro das telas em lote do catálogo (varejo e atacado, logística): categoria com as subcategorias, famílias da
// categoria (com "adicionar todas"), tag, marcas das famílias/categoria e busca. Trocar a categoria ou as famílias
// tira da seleção o que deixou de valer.
import React from 'react';
import { Col, Flex, Input, Row, Select, Space, TreeSelect, Typography } from 'antd';
import type { FiltroPolitica, OpcoesPolitica } from './precos/politicaPrecoApi';
import { arvoreCategorias, familiasDaCategoria, marcasDoFiltro } from './precos/politicaPrecoTela';

const { Text } = Typography;

interface Props {
  opcoes: OpcoesPolitica | null;
  filtro: FiltroPolitica;
  setFiltro: React.Dispatch<React.SetStateAction<FiltroPolitica>>;
  onEnter?: () => void;
}

const FiltroItensLote: React.FC<Props> = ({ opcoes, filtro, setFiltro, onEnter }) => {
  const familiasDaCat = opcoes ? familiasDaCategoria(opcoes, filtro.idCategoria) : [];
  const marcasOpcoes = opcoes ? marcasDoFiltro(opcoes, filtro) : [];
  const comMarcaValida = (f: FiltroPolitica): FiltroPolitica => {
    if (!f.idsMarcas?.length || !opcoes) return f;
    const validas = new Set(marcasDoFiltro(opcoes, f).map(m => m.id));
    return { ...f, idsMarcas: f.idsMarcas.filter(id => validas.has(id)) };
  };
  const escolherCategoria = (idCategoria: number | null) => setFiltro(f => {
    const validas = new Set((opcoes ? familiasDaCategoria(opcoes, idCategoria) : []).map(x => x.id));
    return comMarcaValida({ ...f, idCategoria, idsFamilias: (f.idsFamilias || []).filter(id => validas.has(id)) });
  });
  const escolherFamilias = (idsFamilias: number[]) => setFiltro(f => comMarcaValida({ ...f, idsFamilias }));
  const temRecorte = !!filtro.idCategoria || (filtro.idsFamilias || []).length > 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <div>
        <Text>Categoria (com as subcategorias)</Text>
        <TreeSelect allowClear showSearch treeNodeFilterProp="title" style={{ width: '100%' }} placeholder="Ex.: Rolamentos"
          treeData={opcoes ? arvoreCategorias(opcoes.categorias) : []} value={filtro.idCategoria ?? undefined}
          onChange={v => escolherCategoria((v as number) ?? null)} />
      </div>
      <div>
        <Flex justify="space-between">
          <Text>Famílias{filtro.idCategoria ? ` da categoria (${familiasDaCat.length})` : ''}</Text>
          <Space size={8}>
            {filtro.idCategoria && familiasDaCat.length > 0 && (
              <a onClick={() => escolherFamilias(familiasDaCat.map(x => x.id))}>adicionar todas ({familiasDaCat.length})</a>
            )}
            {(filtro.idsFamilias || []).length > 0 && <a onClick={() => escolherFamilias([])}>limpar</a>}
          </Space>
        </Flex>
        <Select mode="multiple" allowClear showSearch optionFilterProp="label" style={{ width: '100%' }}
          placeholder={filtro.idCategoria ? 'Todas as da categoria (ou escolha algumas)' : 'Ex.: Rolamento 608, Rolamento 6004'}
          maxTagCount="responsive" options={familiasDaCat.map(f => ({ value: f.id, label: `${f.nome} (${f.itens})` }))}
          value={filtro.idsFamilias || []} onChange={v => escolherFamilias(v)} />
      </div>
      <Row gutter={8}>
        <Col span={12}>
          <Text>Tag</Text>
          <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Ex.: bicicleta"
            options={(opcoes?.tags || []).map(t => ({ value: t.id, label: t.nome }))} value={filtro.idTag ?? undefined}
            onChange={v => setFiltro(f => ({ ...f, idTag: (v as number) ?? null }))} />
        </Col>
        <Col span={12}>
          <Text>Marca{temRecorte ? ` (${marcasOpcoes.length})` : ''}</Text>
          <Select mode="multiple" allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} maxTagCount="responsive"
            placeholder={temRecorte ? 'Todas as do filtro' : 'Todas'} notFoundContent="Nenhuma marca nos itens do filtro"
            options={marcasOpcoes.map(m => ({ value: m.id, label: m.nome }))} value={filtro.idsMarcas || []}
            onChange={v => setFiltro(f => ({ ...f, idsMarcas: v as number[] }))} />
        </Col>
        <Col span={24}>
          <Text>Busca (nome, SKU ou família)</Text>
          <Input allowClear placeholder="Ex.: Rolamento 62" value={filtro.busca} onChange={e => setFiltro(f => ({ ...f, busca: e.target.value }))} onPressEnter={onEnter} />
        </Col>
      </Row>
      <Text type="secondary" style={{ fontSize: 12 }}>Os filtros se somam (ex.: categoria Rolamentos + tag bicicleta). Até 500 itens por vez.</Text>
    </Space>
  );
};

export default FiltroItensLote;
