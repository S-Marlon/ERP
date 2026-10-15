// Aba Fotos do editor: a galeria de cada variação na ordem em que vai para o ML (principal -> medidas -> o resto como
// arrastar), com adicionar, excluir, copiar uma foto para as outras variações e as ferramentas de imagem. Vale na hora
// no cadastro do ERP; os itens já publicados recebem as fotos em "Enviar atributos, fotos e descrição".
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Flex, Popover, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { ColumnWidthOutlined, CopyOutlined, EditOutlined, PictureOutlined, ReloadOutlined } from '@ant-design/icons';
import type { AnuncioDetalhe } from '../mercadoLivreApi';
import GaleriaImagens from '../../../../areas/catalogo/skus/GaleriaImagens';
import { AnexoItem, copiarImagem, listarImagensDosItens } from '../../../../areas/catalogo/skus/CatalogSku.service';
import FotoFamiliaControle from '../../../../areas/catalogo/familias/FotoFamiliaControle';

const EditorImagemModal = lazy(() => import('../editorImagem/EditorImagemModal'));
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

const AbaFotos: React.FC<Props> = ({ salvo, det, onAlterado }) => {
  const [fotos, setFotos] = useState<Record<number, AnexoItem[]>>({});
  const [carregando, setCarregando] = useState(false);
  const [editor, setEditor] = useState(false);
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
        <Card size="small" style={{ marginBottom: 12 }} title={<Space><Text strong>Todas as variações</Text><Tag>família {det.familia}</Tag></Space>}>
          <Flex align="center" gap={12} wrap>
            <FotoFamiliaControle modo="compacto" idFamilia={det.idFamilia} nome={det.familia} imagem={det.fotoFamilia} onAlterada={onAlterado} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Hoje a família tem uma foto, usada pelas variações sem foto própria. A galeria da família (fotos que entram em todas as variações) vem na próxima etapa.
            </Text>
          </Flex>
        </Card>
      )}

      <Spin spinning={carregando && !Object.keys(fotos).length}>
        <Flex vertical gap={12}>
          {det.itens.map(i => {
            const lista = fotos[i.idItem] || [];
            return (
              <Card key={i.idItem} size="small"
                title={(
                  <Space wrap size={6}>
                    <Text strong>{i.sku}</Text>
                    <Text type="secondary" style={{ fontWeight: 400 }} ellipsis>{i.tituloMl || i.nome}</Text>
                    <Tag color={lista.length > limite ? 'orange' : lista.length ? 'default' : 'red'}>{lista.length} de {limite}</Tag>
                    {i.ml.mlbId && <Tag color="green">no ML</Tag>}
                  </Space>
                )}
              >
                {!lista.length && det.fotoFamilia && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Sem foto própria: vai para o ML com a foto da família.</Text>
                )}
                <GaleriaImagens
                  idItem={i.idItem} imagens={lista} onChange={mudou} limite={limite}
                  acaoExtra={foto => <CopiarPara foto={foto} origem={i.idItem} itens={det.itens} onCopiado={mudou} />}
                />
              </Card>
            );
          })}
          {!det.itens.length && <Empty description="Este anúncio ainda não tem itens" />}
        </Flex>
      </Spin>

      <Suspense fallback={null}>
        {editor && <EditorImagemModal det={salvo} onFechar={() => setEditor(false)} onSalvo={mudou} />}
        {medidas && <GeradorMedidasModal det={salvo} onFechar={() => setMedidas(false)} onSalvo={mudou} />}
        {fotosMl && <FotosMlModal idAnuncio={det.id} idItemInicial={null} onFechar={() => setFotosMl(false)} onImportado={mudou} />}
      </Suspense>
    </>
  );
};

export default AbaFotos;
