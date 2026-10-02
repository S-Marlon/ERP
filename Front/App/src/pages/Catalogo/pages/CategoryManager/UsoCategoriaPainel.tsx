// Lateral "Uso da categoria": subcategorias, famílias e itens que estão nela, com as ações de incluir e tirar.
// Regra do PIM: item de família herda a categoria da família; só item sem família entra direto na categoria.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Modal, Popconfirm, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { ApartmentOutlined, AppstoreOutlined, CloseOutlined, FolderAddOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Categoria } from './CategoryManager.types';
import { definirCategoriaDaFamilia, getUsoCategoria, UsoCategoria, vincularItensCategoria } from './categoryService';
import { getFamilies } from '../FamilyManager/FamilyManager.api';
import { STATUS_FAMILIA_CONFIG } from '../FamilyManager/CatalogManager.types';
import { buscarItensCatalogo, ItemCatalogoBusca } from '../../../Compras/api/comprasApi';

const { Text } = Typography;

interface Props {
  categoria: Categoria;
  categorias: Categoria[];
  onSelecionar: (id: string) => void;
  onNovaSubcategoria: () => void;
  onAlterado: () => void;     // recarrega as contagens da árvore
}

const titulo = (texto: string, extra?: React.ReactNode) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{texto}</span>
    {extra}
  </div>
);

export const UsoCategoriaPainel: React.FC<Props> = ({ categoria, categorias, onSelecionar, onNovaSubcategoria, onAlterado }) => {
  const navigate = useNavigate();
  const [uso, setUso] = useState<UsoCategoria | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [familiasTodas, setFamiliasTodas] = useState<Array<{ id: string; nome: string; status: string; categoriaPai: string; categoriaPaiNome: string }>>([]);
  const [familiaEscolhida, setFamiliaEscolhida] = useState<string | undefined>();
  const [buscaItem, setBuscaItem] = useState('');
  const [resultados, setResultados] = useState<ItemCatalogoBusca[]>([]);
  const [itensEscolhidos, setItensEscolhidos] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const nova = categoria.id.startsWith('temp-');
  const subcategorias = categorias.filter(c => c.parentId === categoria.id);

  const carregar = async () => {
    if (nova) { setUso({ familias: [], itensDiretos: [], itensPelasFamilias: 0 }); return; }
    setCarregando(true);
    try {
      const [u, f] = await Promise.all([getUsoCategoria(categoria.id), getFamilies(1)]);
      setUso(u);
      setFamiliasTodas(f.map(x => ({ id: String(x.id), nome: x.nome, status: x.status, categoriaPai: String(x.categoriaPai || ''), categoriaPaiNome: x.categoriaPaiNome || '' })));
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar o uso da categoria.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); setFamiliaEscolhida(undefined); setItensEscolhidos([]); setBuscaItem(''); }, [categoria.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca de itens para incluir direto
  useEffect(() => {
    const termo = buscaItem.trim();
    if (termo.length < 2) { setResultados([]); return; }
    const controller = new AbortController();
    const t = setTimeout(() => {
      buscarItensCatalogo(termo, 1, controller.signal).then(setResultados).catch(() => setResultados([]));
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [buscaItem]);

  const familiasFora = useMemo(() => familiasTodas.filter(f => f.categoriaPai !== categoria.id), [familiasTodas, categoria.id]);

  const moverFamilia = (id: string) => {
    const f = familiasTodas.find(x => x.id === id);
    if (!f) return;
    Modal.confirm({
      title: `Colocar "${f.nome}" em ${categoria.nome}?`,
      content: (
        <div style={{ fontSize: 13 }}>
          {f.categoriaPaiNome ? <>Hoje ela está em <b>{f.categoriaPaiNome}</b>. </> : 'Hoje ela está sem categoria. '}
          Os itens da família passam a herdar os atributos desta categoria (e das categorias acima dela).
        </div>
      ),
      okText: 'Colocar nesta categoria',
      onOk: async () => {
        try {
          await definirCategoriaDaFamilia(id, categoria.id);
          message.success(`Família "${f.nome}" agora está em ${categoria.nome}.`);
          setFamiliaEscolhida(undefined);
          await carregar();
          onAlterado();
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : 'Erro ao mudar a categoria da família.');
        }
      },
    });
  };

  const tirarFamilia = async (id: number) => {
    try {
      await definirCategoriaDaFamilia(id, null);
      message.success('Família tirada da categoria.');
      await carregar();
      onAlterado();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao tirar a família da categoria.');
    }
  };

  const alterarItens = async (ids: number[], acao: 'adicionar' | 'remover') => {
    setSalvando(true);
    try {
      const r = await vincularItensCategoria(categoria.id, ids, acao);
      if (r.alterados) message.success(acao === 'adicionar' ? `${r.alterados} item(ns) incluído(s) na categoria.` : 'Item tirado da categoria.');
      if (r.ignorados.length) {
        Modal.info({
          title: `${r.ignorados.length} item(ns) não foram incluídos`,
          content: (
            <div style={{ fontSize: 13 }}>
              Estes itens estão numa família e a categoria deles vem da família. Para mudar, coloque a família nesta categoria:
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{r.ignorados.map(i => <li key={i.idItem}>{i.sku} (família {i.familia})</li>)}</ul>
            </div>
          ),
        });
      }
      setItensEscolhidos([]);
      setBuscaItem('');
      await carregar();
      onAlterado();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao alterar os itens da categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const statusFamilia = (s: string) => STATUS_FAMILIA_CONFIG[s as keyof typeof STATUS_FAMILIA_CONFIG];

  return (
    <Spin spinning={carregando}>
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uso da categoria</span>
          {!nova && <Button size="small" type="text" icon={<ReloadOutlined />} onClick={carregar} />}
        </div>

        <Card size="small" style={{ background: '#f8fafc' }} styles={{ body: { padding: '6px 10px' } }}>
          {[
            ['Subcategorias', subcategorias.length],
            ['Famílias', uso?.familias.length ?? categoria.qtdFamilias ?? 0],
            ['Itens pelas famílias', uso?.itensPelasFamilias ?? 0],
            ['Itens direto nela', uso?.itensDiretos.length ?? categoria.qtdProdutos ?? 0],
          ].map(([rot, qtd]) => (
            <div key={rot as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: '20px' }}>
              <span style={{ color: '#64748b' }}>{rot}</span><b>{qtd}</b>
            </div>
          ))}
        </Card>

        {nova ? (
          <Text type="secondary" style={{ fontSize: 12 }}>Salve a categoria para incluir famílias, subcategorias e itens.</Text>
        ) : (
          <>
            {/* Subcategorias */}
            <div>
              {titulo('Subcategorias', <Button size="small" type="link" icon={<FolderAddOutlined />} onClick={onNovaSubcategoria} style={{ padding: 0 }}>Nova</Button>)}
              {subcategorias.length === 0 ? <Text type="secondary" style={{ fontSize: 11 }}>Nenhuma.</Text> : (
                <Space size={[4, 4]} wrap>
                  {subcategorias.map(s => <Tag key={s.id} style={{ cursor: 'pointer', margin: 0 }} onClick={() => onSelecionar(s.id)}>{s.nome}</Tag>)}
                </Space>
              )}
            </div>

            {/* Famílias */}
            <div>
              {titulo('Famílias')}
              {(uso?.familias.length || 0) === 0 ? <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Nenhuma família nesta categoria.</Text> : (
                <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 6 }}>
                  {uso!.familias.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, border: '1px solid #f1f5f9', borderRadius: 6, padding: '3px 6px' }}>
                      <ApartmentOutlined style={{ color: '#2563eb' }} />
                      <Tooltip title="Abrir a família">
                        <a style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => navigate(`/catalogo/familias?familia=${f.id}`)}>{f.nome}</a>
                      </Tooltip>
                      <Text type="secondary" style={{ fontSize: 11 }}>{f.qtdItens}</Text>
                      {f.status !== 'ATIVO' && <Tag color={statusFamilia(f.status)?.color} style={{ margin: 0, fontSize: 10 }}>{statusFamilia(f.status)?.label || f.status}</Tag>}
                      <Popconfirm title="Tirar esta família da categoria?" description="Os itens dela deixam de herdar os atributos desta categoria." onConfirm={() => tirarFamilia(f.id)}>
                        <Button size="small" type="text" danger icon={<CloseOutlined />} style={{ width: 20, height: 20 }} />
                      </Popconfirm>
                    </div>
                  ))}
                </Space>
              )}
              <Select
                size="small"
                showSearch
                allowClear
                value={familiaEscolhida}
                placeholder="+ Colocar uma família aqui"
                style={{ width: '100%' }}
                optionFilterProp="label"
                onChange={v => { setFamiliaEscolhida(v); if (v) moverFamilia(v); }}
                options={familiasFora.map(f => ({ value: f.id, label: `${f.nome}${f.categoriaPaiNome ? ` (em ${f.categoriaPaiNome})` : ' (sem categoria)'}` }))}
                notFoundContent="Todas as famílias já estão aqui"
              />
            </div>

            {/* Itens direto */}
            <div>
              {titulo('Itens direto nela')}
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Só itens sem família (os de família herdam a categoria dela).</Text>
              {(uso?.itensDiretos.length || 0) > 0 && (
                <Space direction="vertical" size={2} style={{ width: '100%', marginBottom: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {uso!.itensDiretos.map(i => (
                    <div key={i.idItem} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <AppstoreOutlined style={{ color: '#64748b' }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.nome}>
                        <b>{i.sku}</b> {i.nome}
                      </span>
                      <Popconfirm title="Tirar este item da categoria?" onConfirm={() => alterarItens([i.idItem], 'remover')}>
                        <Button size="small" type="text" danger icon={<CloseOutlined />} style={{ width: 20, height: 20 }} />
                      </Popconfirm>
                    </div>
                  ))}
                </Space>
              )}
              <Select
                mode="multiple"
                size="small"
                style={{ width: '100%' }}
                placeholder="+ Buscar itens por SKU ou nome"
                value={itensEscolhidos}
                onChange={setItensEscolhidos}
                filterOption={false}
                onSearch={setBuscaItem}
                searchValue={buscaItem}
                notFoundContent={buscaItem.trim().length < 2 ? 'Digite ao menos 2 letras' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada encontrado" />}
                options={resultados
                  .filter(r => !uso?.itensDiretos.some(d => d.idItem === r.id))
                  .map(r => ({ value: r.id, label: `${r.sku} · ${r.name}${r.category ? ` (${r.category})` : ''}` }))}
              />
              {itensEscolhidos.length > 0 && (
                <Button size="small" type="primary" icon={<PlusOutlined />} loading={salvando} style={{ marginTop: 6 }} block
                  onClick={() => alterarItens(itensEscolhidos, 'adicionar')}>
                  Incluir {itensEscolhidos.length} item(ns) nesta categoria
                </Button>
              )}
            </div>
          </>
        )}
      </Space>
    </Spin>
  );
};

export default UsoCategoriaPainel;
