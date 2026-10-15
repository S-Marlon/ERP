// Aba Fotos do editor: em cima a galeria da família (a 1ª é a principal-modelo, base do editor de imagem; as outras
// entram em todas as variações), embaixo a galeria de cada variação na ordem em que vai para o ML (principal -> medidas
// -> o resto como arrastar), com adicionar, excluir, copiar para as outras variações e levar para a família. Vale na
// hora no cadastro do ERP; os itens já publicados recebem as fotos em "Enviar atributos, fotos e descrição".
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Flex, Popover, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { ColumnWidthOutlined, CopyOutlined, EditOutlined, PictureOutlined, ReloadOutlined, VerticalAlignTopOutlined } from '@ant-design/icons';
import type { AnuncioDetalhe } from '../mercadoLivreApi';
import GaleriaImagens from '../../../../areas/catalogo/skus/GaleriaImagens';
import { AnexoItem, copiarImagem, listarImagensDosItens } from '../../../../areas/catalogo/skus/CatalogSku.service';
import GaleriaFamilia, { COR_FAMILIA, COR_VARIACAO } from '../../../../areas/catalogo/familias/GaleriaFamilia';
import { FotoFamilia, fotosFamiliaApi } from '../../../../areas/catalogo/familias/FamilyManager.api';
import { fotosNoCanal } from '../../../../areas/catalogo/skus/galeriaFotos';
import { umaLinhaPorItem } from '../linhasAnuncio';

const EditorImagemModal = lazy(() => import('../../../../areas/catalogo/imagens/editor/EditorImagemModal'));
import { entradaDoAnuncio } from '../entradaEditorMl';
const GeradorMedidasModal = lazy(() => import('../GeradorMedidasModal'));
const FotosMlModal = lazy(() => import('../FotosMlModal'));

const { Text } = Typography;

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;
  onAlterado: () => void;   // recarrega o anúncio (contagem de fotos, foto de cada item)
}

/** Botão de copiar a foto para outras variações (escolhe quais). */
const CopiarPara: React.FC<{ foto: AnexoItem; origem: number; itens: AnuncioDetalhe['itens']; onCopiado: () => void }> = ({ foto, origem, itens, onCopiado }) => {
  const outros = itens.filter(i => i.idItem !== origem);
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [copiando, setCopiando] = useState(false);
  if (!outros.length) return null;
  const copiar = async () => {
    setCopiando(true);
    try {
      const r = await copiarImagem(foto.id_anexo, marcados);
      message.success(r.message);
      setAberto(false);
      onCopiado();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao copiar a foto.');
    } finally {
      setCopiando(false);
    }
  };
  return (
    <Popover
      trigger="click" open={aberto} onOpenChange={v => { setAberto(v); if (v) setMarcados(outros.map(i => i.idItem)); }}
      title="Copiar esta foto para"
      content={(
        <Flex vertical gap={8} style={{ maxWidth: 320 }}>
          <Checkbox checked={marcados.length === outros.length} indeterminate={!!marcados.length && marcados.length < outros.length}
            onChange={e => setMarcados(e.target.checked ? outros.map(i => i.idItem) : [])}>Todas as outras variações</Checkbox>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <Checkbox.Group value={marcados} onChange={v => setMarcados(v as number[])} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              options={outros.map(i => ({ value: i.idItem, label: i.sku }))} />
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>Entra no fim da galeria de cada uma (quem já tem fica como está).</Text>
          <Button type="primary" size="small" icon={<CopyOutlined />} disabled={!marcados.length} loading={copiando} onClick={copiar}>
            Copiar para {marcados.length}
          </Button>
        </Flex>
      )}
    >
      <Tooltip title="Copiar para outras variações"><Button type="text" size="small" icon={<CopyOutlined />} /></Tooltip>
    </Popover>
  );
};

const AbaFotos: React.FC<Props> = ({ salvo: salvoLinhas, det: detLinhas, onAlterado }) => {
  // as fotos são do item: o item vendido em duas unidades aparece uma vez só
  const salvo = umaLinhaPorItem(salvoLinhas);
  const det = umaLinhaPorItem(detLinhas);
  const [fotos, setFotos] = useState<Record<number, AnexoItem[]>>({});
  const [carregando, setCarregando] = useState(false);
  // editor: false fechado; true abre pedindo a foto; número = abre direto nesta foto da família
  const [editor, setEditor] = useState<boolean | number>(false);
  const [medidas, setMedidas] = useState(false);
  const [fotosMl, setFotosMl] = useState(false);
  const limite = det.categoria?.maxFotos || 10;
  const ids = det.itens.map(i => i.idItem).join(',');

  const carregar = useCallback(async () => {
    if (!ids) return;
    setCarregando(true);
    try {
      const r = await listarImagensDosItens(ids.split(',').map(Number));
      setFotos(Object.fromEntries(r.itens.map(i => [i.idItem, i.imagens])));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao ler as fotos.');
    } finally {
      setCarregando(false);
    }
  }, [ids]);
  useEffect(() => { carregar(); }, [carregar]);
  const mudou = () => { carregar(); onAlterado(); };
  const [versaoFamilia, setVersaoFamilia] = useState(0);
  // fotos da família: entram em cada variação na hora de ir ao ML (a prévia de cada uma mostra onde)
  const [daFamilia, setDaFamilia] = useState<FotoFamilia[]>([]);
  useEffect(() => {
    if (!det.idFamilia) { setDaFamilia([]); return; }
    fotosFamiliaApi.listar(det.idFamilia).then(r => setDaFamilia(r.fotos)).catch(() => setDaFamilia([]));
  }, [det.idFamilia, versaoFamilia]);
  const levarParaFamilia = async (idAnexo: number) => {
    if (!det.idFamilia) return;
    try {
      await fotosFamiliaApi.doItem(det.idFamilia, idAnexo);
      message.success('Foto na galeria da família: vale para todas as variações.');
      setVersaoFamilia(v => v + 1);
      onAlterado();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao levar a foto para a família.');
    }
  };

  const publicados = det.itens.filter(i => i.ml.mlbId).length;
  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space direction="vertical" size={0}>
            <Text strong><PictureOutlined /> Fotos de cada variação</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Ordem: principal → medidas → as outras como você arrastar. O ML recebe até {limite} fotos por variação.
            </Text>
          </Space>
          <Space wrap>
            <Tooltip title="Cotas, setas, textos e balões que você posiciona; aplica em todos os itens com a medida de cada um">
              <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => setEditor(true)}>Editor de imagem</Button>
            </Tooltip>
            <Button size="small" icon={<ColumnWidthOutlined />} onClick={() => setMedidas(true)}>Gerador de medidas</Button>
            <Tooltip title="Ver as fotos que os itens usam no ML, trazer para o cadastro do ERP ou buscar fotos de outro anúncio/catálogo">
              <Button size="small" icon={<PictureOutlined />} onClick={() => setFotosMl(true)}>Fotos ML ↔ ERP</Button>
            </Tooltip>
            <Tooltip title="Ler as fotos de novo"><Button size="small" icon={<ReloadOutlined />} onClick={carregar} /></Tooltip>
          </Space>
        </Flex>
        {publicados > 0 && (
          <Alert type="info" showIcon style={{ marginTop: 10 }}
            message={`As mudanças valem na hora no cadastro. Para os ${publicados} item(ns) já no ML, use "Enviar atributos, fotos e descrição".`} />
        )}
      </Card>

      {det.idFamilia && (
        <Card
          size="small" style={{ marginBottom: 12, borderColor: COR_FAMILIA }}
          title={<Space wrap><Text strong>Família {det.familia}</Text><Tag color="purple">vale para todas as variações</Tag></Space>}
        >
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            A <b>1ª (modelo)</b> é a foto do produto: vai como principal na variação sem foto própria e é a base do editor de imagem, que guarda nela as
            cotas e textos. As <b>outras</b> (aplicação, embalagem) entram em todas as variações, depois das fotos de cada uma.
          </Text>
          <GaleriaFamilia idFamilia={det.idFamilia} recarregar={versaoFamilia} onChange={f => { setDaFamilia(f); onAlterado(); }} onEditar={idFoto => setEditor(idFoto)} />
        </Card>
      )}

      <Spin spinning={carregando && !Object.keys(fotos).length}>
        <Flex vertical gap={12}>
          {det.itens.map(i => {
            const lista = fotos[i.idItem] || [];
            const noMl = fotosNoCanal(lista.map(f => ({ url: f.url_anexo, nome: f.nome_arquivo })), daFamilia.map(f => ({ url: f.url, nome: f.nome })));
            const herdadas = noMl.filter(f => f.daFamilia).length;
            return (
              <Card key={i.idItem} size="small"
                title={(
                  <Space wrap size={6}>
                    <Text strong>{i.sku}</Text>
                    <Text type="secondary" style={{ fontWeight: 400 }} ellipsis>{i.tituloMl || i.nome}</Text>
                    <Tooltip title={`${lista.length} própria(s) + ${herdadas} da família = ${noMl.length} no ML (até ${limite})`}>
                      <Tag color={noMl.length > limite ? 'orange' : noMl.length ? 'default' : 'red'}>{noMl.length} de {limite}{herdadas ? ` · ${herdadas} da família` : ''}</Tag>
                    </Tooltip>
                    {i.ml.mlbId && <Tag color="green">no ML</Tag>}
                  </Space>
                )}
              >

                <GaleriaImagens
                  idItem={i.idItem} imagens={lista} onChange={mudou} limite={limite} corBorda={COR_VARIACAO}
                  acaoExtra={foto => (
                    <>
                      <CopiarPara foto={foto} origem={i.idItem} itens={det.itens} onCopiado={mudou} />
                      {det.idFamilia && (
                        <Tooltip title="Levar para a família (mesmo arquivo): entra como foto comum de todas as variações. Lá dá para fazer dela a modelo.">
                          <Button type="text" size="small" icon={<VerticalAlignTopOutlined />} onClick={() => levarParaFamilia(foto.id_anexo)} />
                        </Tooltip>
                      )}
                    </>
                  )}
                />
                {herdadas > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #f0f0f0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Vai ao ML assim: <b style={{ color: COR_VARIACAO }}>azul</b> é da variação, <b style={{ color: COR_FAMILIA }}>roxo</b> vem da família (mude na galeria lá em cima).</Text>
                    <Flex wrap gap={6} style={{ marginTop: 6 }}>
                      {noMl.map((f, k) => (
                        <Tooltip key={f.url} title={`${k + 1}ª${k === 0 ? ' (principal)' : ''}: ${f.nome}${f.daFamilia ? ' · da família' : ''}${k >= limite ? ' · passa do limite, não vai' : ''}`}>
                          <div style={{ position: 'relative', width: 54, opacity: k >= limite ? 0.4 : 1 }}>
                            <img src={f.url} alt="" style={{ width: 54, height: 54, objectFit: 'contain', borderRadius: 4, background: '#fafafa', border: `2px solid ${f.daFamilia ? COR_FAMILIA : COR_VARIACAO}`, display: 'block' }} />
                            <span style={{ position: 'absolute', top: 1, left: 3, fontSize: 10, fontWeight: 600, color: '#555', background: 'rgba(255,255,255,.85)', borderRadius: 3, padding: '0 3px' }}>{k + 1}</span>
                          </div>
                        </Tooltip>
                      ))}
                    </Flex>
                  </div>
                )}
              </Card>
            );
          })}
          {!det.itens.length && <Empty description="Este anúncio ainda não tem itens" />}
        </Flex>
      </Spin>

      <Suspense fallback={null}>
        {editor !== false && <EditorImagemModal entrada={entradaDoAnuncio(salvo, typeof editor === 'number' ? editor : null)} onFechar={() => setEditor(false)} onSalvo={mudou} />}
        {medidas && <GeradorMedidasModal det={salvo} onFechar={() => setMedidas(false)} onSalvo={mudou} />}
        {fotosMl && <FotosMlModal idAnuncio={det.id} idItemInicial={null} onFechar={() => setFotosMl(false)} onImportado={mudou} />}
      </Suspense>
    </>
  );
};

export default AbaFotos;
