// Fotos entre o ML e o ERP: as que cada item usa no anúncio do ML (marcando as que já estão no cadastro), trazer para o
// cadastro do ERP e buscar fotos de outro anúncio ou do catálogo do ML pelo link/código.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Flex, Image, Input, Modal, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { CloudDownloadOutlined, PictureOutlined, SearchOutlined, StarFilled } from '@ant-design/icons';
import { anunciosApi, BuscaFotosMl, FotoMl, FotosItemMl } from './mercadoLivreApi';

const { Text } = Typography;

interface Props { idAnuncio: number | null; idItemInicial?: number | null; onFechar: () => void; onImportado: () => void }

/** Grade de fotos com seleção (as que já estão no ERP não se selecionam). */
const Grade: React.FC<{ fotos: FotoMl[]; selecionadas: Set<string>; onAlternar: (url: string) => void }> = ({ fotos, selecionadas, onAlternar }) => (
  <Image.PreviewGroup>
    <Flex wrap gap={10}>
      {fotos.map(f => (
        <div key={f.url} style={{ width: 120, border: `2px solid ${selecionadas.has(f.url) ? '#1677ff' : '#f0f0f0'}`, borderRadius: 8, padding: 4, background: '#fff' }}>
          <Image src={f.url} width={108} height={108} style={{ objectFit: 'contain', borderRadius: 4 }} />
          <Flex justify="space-between" align="center" style={{ marginTop: 4 }}>
            {f.noErp
              ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>já no ERP</Tag>
              : <Checkbox checked={selecionadas.has(f.url)} onChange={() => onAlternar(f.url)}><Text style={{ fontSize: 11 }}>trazer</Text></Checkbox>}
            <Text type="secondary" style={{ fontSize: 10 }}>{f.tamanho || ''}</Text>
          </Flex>
        </div>
      ))}
    </Flex>
  </Image.PreviewGroup>
);

const FotosMlModal: React.FC<Props> = ({ idAnuncio, idItemInicial, onFechar, onImportado }) => {
  const [itens, setItens] = useState<FotosItemMl[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [idItem, setIdItem] = useState<number | null>(null);
  const [selDoAnuncio, setSelDoAnuncio] = useState<Set<string>>(new Set());
  const [ref, setRef] = useState('');
  const [busca, setBusca] = useState<BuscaFotosMl | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [selDaBusca, setSelDaBusca] = useState<Set<string>>(new Set());
  const [gravando, setGravando] = useState(false);

  const carregar = async () => {
    if (!idAnuncio) return;
    setCarregando(true);
    try {
      const r = await anunciosApi.fotos(idAnuncio);
      setItens(r);
      setIdItem(atual => atual ?? idItemInicial ?? r.find(i => i.ml.some(f => !f.noErp))?.idItem ?? r[0]?.idItem ?? null);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => {
    setItens([]); setIdItem(null); setSelDoAnuncio(new Set()); setBusca(null); setSelDaBusca(new Set()); setRef('');
    if (idAnuncio) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAnuncio]);
  useEffect(() => { setSelDoAnuncio(new Set()); }, [idItem]);

  const item = itens.find(i => i.idItem === idItem) || null;
  const faltando = useMemo(() => itens.filter(i => i.ml.some(f => !f.noErp)), [itens]);
  const alternar = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (url: string) =>
    setter(s => { const n = new Set(s); if (n.has(url)) n.delete(url); else n.add(url); return n; });

  const importar = async (pedido: { idItem: number; fotos: { url: string; idMl?: string }[] }[], ok: string) => {
    if (!idAnuncio || !pedido.some(p => p.fotos.length)) { message.info('Nenhuma foto escolhida.'); return; }
    setGravando(true);
    try {
      const r = await anunciosApi.importarFotos(idAnuncio, pedido);
      message.success(r.importadas ? `${r.importadas} foto(s) ${ok}` : 'Essas fotos já estavam no ERP.');
      setSelDoAnuncio(new Set()); setSelDaBusca(new Set());
      await carregar();
      onImportado();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setGravando(false);
    }
  };

  const buscar = async () => {
    if (!ref.trim()) return;
    setBuscando(true);
    try { setBusca(await anunciosApi.buscarFotos(ref)); setSelDaBusca(new Set()); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setBuscando(false); }
  };

  const daBusca = (busca?.fotos || []).filter(f => selDaBusca.has(f.url)).map(f => ({ url: f.url }));

  return (
    <Modal
      open={idAnuncio !== null} onCancel={onFechar} footer={null} width="min(1100px, 96vw)" style={{ top: 24 }} destroyOnHidden
      title={<Space><PictureOutlined />Fotos: Mercado Livre ↔ ERP</Space>}
    >
      <Spin spinning={carregando || gravando}>
        <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
          <Select
            style={{ minWidth: 360 }} value={idItem ?? undefined} onChange={setIdItem} showSearch optionFilterProp="label" placeholder="Item"
            options={itens.map(i => {
              const falta = i.ml.filter(f => !f.noErp).length;
              return { value: i.idItem, label: `${i.sku} · ${i.nome}${falta ? ` · ${falta} foto(s) no ML fora do ERP` : ''}` };
            })}
          />
          {faltando.length > 0 && (
            <Tooltip title="Traz para o cadastro do ERP todas as fotos que os itens usam no ML e ainda não estão no ERP">
              <Button icon={<CloudDownloadOutlined />} onClick={() => importar(faltando.map(i => ({ idItem: i.idItem, fotos: i.ml.filter(f => !f.noErp).map(f => ({ url: f.url, idMl: f.id })) })), 'trazidas do ML para o ERP.')}>
                Trazer todas do ML ({faltando.reduce((s, i) => s + i.ml.filter(f => !f.noErp).length, 0)})
              </Button>
            </Tooltip>
          )}
        </Flex>

        {item && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card
              size="small" title={<Space>No anúncio do ML{item.mlbId && <Tag>{item.mlbId}</Tag>}</Space>}
              extra={item.ml.some(f => !f.noErp) && (
                <Space>
                  <Button size="small" disabled={!selDoAnuncio.size}
                    onClick={() => importar([{ idItem: item.idItem, fotos: item.ml.filter(f => selDoAnuncio.has(f.url)).map(f => ({ url: f.url, idMl: f.id })) }], `trazidas para ${item.sku}.`)}>
                    Trazer selecionadas ({selDoAnuncio.size})
                  </Button>
                  <Button size="small" type="primary"
                    onClick={() => importar([{ idItem: item.idItem, fotos: item.ml.filter(f => !f.noErp).map(f => ({ url: f.url, idMl: f.id })) }], `trazidas para ${item.sku}.`)}>
                    Trazer as que faltam
                  </Button>
                </Space>
              )}
            >
              {!item.mlbId ? <Text type="secondary">Item ainda não publicado no ML.</Text>
                : item.ml.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem fotos no ML" />
                : <Grade fotos={item.ml} selecionadas={selDoAnuncio} onAlternar={alternar(setSelDoAnuncio)} />}
              {item.mlbId && item.ml.length > 0 && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                  Foto que o ERP mandou por link (ex.: site do fornecedor) o ML guarda uma cópia com outro endereço: pode aparecer como "trazer" mesmo já estando no ERP. Compare com as do ERP abaixo.
                </Text>
              )}
            </Card>

            <Card size="small" title={`No cadastro do ERP (${item.erp.length})`}>
              {item.erp.length === 0 ? <Text type="secondary">Sem foto no ERP.</Text> : (
                <Image.PreviewGroup>
                  <Flex wrap gap={10}>
                    {item.erp.map(f => (
                      <div key={f.idAnexo} style={{ position: 'relative' }}>
                        <Image src={f.url} width={96} height={96} style={{ objectFit: 'contain', border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff' }} />
                        {f.principal && <Tooltip title="Foto principal"><StarFilled style={{ position: 'absolute', top: 4, left: 4, color: '#faad14' }} /></Tooltip>}
                      </div>
                    ))}
                  </Flex>
                </Image.PreviewGroup>
              )}
            </Card>

            <Card size="small" title={<Space><SearchOutlined />Buscar em outro anúncio ou no catálogo do ML</Space>}>
              <Input.Search
                placeholder="Cole o link do anúncio ou do produto do ML (ou o código MLB…)" enterButton="Buscar" value={ref}
                onChange={e => setRef(e.target.value)} onSearch={buscar} loading={buscando} allowClear
              />
              {busca && (
                <div style={{ marginTop: 10 }}>
                  <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
                    <Space wrap>
                      <Tag color={busca.origem === 'CATALOGO' ? 'blue' : busca.proprio ? 'green' : 'orange'}>
                        {busca.origem === 'CATALOGO' ? 'Catálogo do ML' : busca.proprio ? 'Anúncio seu' : 'Anúncio de outro vendedor'}
                      </Tag>
                      <Text strong>{busca.titulo}</Text>
                    </Space>
                    <Space>
                      <Button size="small" disabled={!daBusca.length} onClick={() => item && importar([{ idItem: item.idItem, fotos: daBusca }], `postas em ${item.sku}.`)}>
                        Para {item.sku} ({daBusca.length})
                      </Button>
                      {itens.length > 1 && (
                        <Button size="small" disabled={!daBusca.length} onClick={() => importar(itens.map(i => ({ idItem: i.idItem, fotos: daBusca })), 'postas nos itens do anúncio.')}>
                          Para todos os {itens.length} itens
                        </Button>
                      )}
                    </Space>
                  </Flex>
                  {busca.origem === 'ANUNCIO' && !busca.proprio && (
                    <Alert type="warning" showIcon style={{ marginBottom: 8 }}
                      message="Foto de outro vendedor tem dono: o ML pode recusar ou pausar o anúncio por denúncia de direito autoral."
                      description={busca.catalogo ? <>Este anúncio é do catálogo <b>{busca.catalogo}</b>: as fotos do catálogo (do fabricante) são mais seguras. Cole o link do produto (/p/{busca.catalogo}).</> : 'Prefira fotos suas, do fabricante ou do catálogo do ML.'} />
                  )}
                  {busca.fotos.length === 0 ? <Text type="secondary">Sem fotos.</Text>
                    : <Grade fotos={busca.fotos} selecionadas={selDaBusca} onAlternar={alternar(setSelDaBusca)} />}
                </div>
              )}
            </Card>
          </Space>
        )}
        {!item && !carregando && <Empty description="Nenhum item neste anúncio." />}
      </Spin>
    </Modal>
  );
};

export default FotosMlModal;
