// Gerador de fotos com a medida: pega a foto de cada item (ou uma só para todos), escreve a medida que vem do cadastro
// (ex.: "20 cm") e salva no cadastro do ERP, item por item. Prévia de todos antes de salvar.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Flex, Input, Modal, Progress, Row, Segmented, Select, Space, Spin, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { BgColorsOutlined, ColumnWidthOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { enviarArquivoAnexo } from '../../../areas/catalogo/skus/CatalogSku.service';
import { AnuncioDetalhe, ItemDoAnuncio } from './mercadoLivreApi';
import { camposDoItem, converterMedidas, modeloPadrao, textoDoModelo } from './etiquetaFoto';
import { canvasParaArquivo, carregarImagem, desenharEtiqueta, EstiloEtiqueta, limparCacheImagens } from './desenhoEtiqueta';

const { Text } = Typography;

const CORES = [
  { valor: '#731717', nome: 'Vinho (loja)' }, { valor: '#111111', nome: 'Preto' }, { valor: '#1554c0', nome: 'Azul' },
  { valor: '#c2410c', nome: 'Laranja' }, { valor: '#15803d', nome: 'Verde' },
];

interface Props { det: AnuncioDetalhe | null; onFechar: () => void; onSalvo: () => void }
interface Previa { item: ItemDoAnuncio; texto: string; subtexto: string; foto: string | null; imagem: string | null; erro: string | null }

const GeradorMedidasModal: React.FC<Props> = ({ det, onFechar, onSalvo }) => {
  const [modelo, setModelo] = useState('');
  const [modeloSub, setModeloSub] = useState('');
  const [unidade, setUnidade] = useState<'original' | 'mm' | 'cm' | 'm'>('original');
  const [estilo, setEstilo] = useState<EstiloEtiqueta>('COTA');
  const [cor, setCor] = useState(CORES[0].valor);
  const [base, setBase] = useState<'ITEM' | 'UMA'>('ITEM');
  const [fotoUnica, setFotoUnica] = useState<string | null>(null);
  const [comoPrincipal, setComoPrincipal] = useState(true);
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [gerando, setGerando] = useState(false);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState<{ feitos: number; total: number } | null>(null);
  const vez = useRef(0);
  useEffect(() => () => { limparCacheImagens(); setPrevias([]); }, []);   // fechou: solta as fotos da memória

  // ao abrir: modelo com o que varia no anúncio; foto única sugerida = a da família
  useEffect(() => {
    if (!det) return;
    setModelo(modeloPadrao(det) || '');
    setModeloSub('');
    setFotoUnica(det.fotoFamilia || det.itens.find(i => i.fotoUrl)?.fotoUrl || null);
    setBase(det.itens.some(i => i.fotoUrl) ? 'ITEM' : 'UMA');
    setMarcados(new Set(det.itens.map(i => i.idItem)));
  }, [det]);

  const campos = useMemo(() => {
    if (!det) return [];
    const nomes = new Map<string, string>();
    for (const i of det.itens) for (const c of camposDoItem(det, i)) if (!nomes.has(c.chave)) nomes.set(c.chave, c.valor);
    return [...nomes.entries()].map(([chave, exemplo]) => ({ chave, exemplo }));
  }, [det]);

  const fotos = useMemo(() => {
    if (!det) return [];
    return [...new Set([det.fotoFamilia, ...det.itens.map(i => i.fotoUrl)].filter((f): f is string => !!f))];
  }, [det]);

  // prévias: refaz quando muda alguma opção (espera parar de digitar)
  useEffect(() => {
    if (!det) return;
    const minha = ++vez.current;
    const t = window.setTimeout(async () => {
      setGerando(true);
      const novas: Previa[] = [];
      for (const item of det.itens) {
        const cs = camposDoItem(det, item);
        const texto = converterMedidas(textoDoModelo(modelo, cs), unidade);
        const subtexto = converterMedidas(textoDoModelo(modeloSub, cs), unidade);
        const foto = base === 'UMA' ? fotoUnica : item.fotoUrl || det.fotoFamilia;
        let imagem: string | null = null;
        let erro: string | null = null;
        if (foto) {
          try {
            const img = await carregarImagem(foto);
            imagem = desenharEtiqueta(img, { texto, subtexto, estilo, cor, lado: 360 }).toDataURL('image/jpeg', 0.8);
          } catch (e) { erro = e instanceof Error ? e.message : 'Erro na foto.'; }
        } else erro = 'Item sem foto: escolha "Uma foto para todos".';
        if (minha !== vez.current) return;
        novas.push({ item, texto, subtexto, foto, imagem, erro });
      }
      if (minha === vez.current) { setPrevias(novas); setGerando(false); }
    }, 350);
    return () => window.clearTimeout(t);
  }, [det, modelo, modeloSub, unidade, estilo, cor, base, fotoUnica]);

  const prontos = previas.filter(p => marcados.has(p.item.idItem) && p.foto && !p.erro && p.texto);

  const salvar = async () => {
    if (!prontos.length) return;
    setSalvando({ feitos: 0, total: prontos.length });
    const falhas: string[] = [];
    for (const [k, p] of prontos.entries()) {
      try {
        const img = await carregarImagem(p.foto!);
        const cv = desenharEtiqueta(img, { texto: p.texto, subtexto: p.subtexto, estilo, cor });
        const nome = `${p.item.sku}-medida.jpg`.replace(/[^\w.-]+/g, '-');
        await enviarArquivoAnexo(p.item.idItem, await canvasParaArquivo(cv, nome), comoPrincipal ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA');
      } catch (e) {
        falhas.push(`${p.item.sku}: ${e instanceof Error ? e.message : 'erro'}`);
      }
      setSalvando({ feitos: k + 1, total: prontos.length });
    }
    setSalvando(null);
    const publicados = prontos.some(p => p.item.ml.mlbId);
    if (falhas.length) message.warning(`${prontos.length - falhas.length} foto(s) salvas; ${falhas.length} com erro: ${falhas[0]}`, 8);
    else message.success(`${prontos.length} foto(s) com medida salvas no cadastro${publicados ? '. Para os itens já no ML, use "Enviar atributos, fotos e descrição".' : '.'}`, 8);
    onSalvo();
    onFechar();
  };

  const inserir = (setter: (f: (v: string) => string) => void, chave: string) => setter(v => `${v}${v && !v.endsWith(' ') ? ' ' : ''}{${chave}}`);

  return (
    <Modal
      open={!!det} onCancel={salvando ? undefined : onFechar} width="min(1240px, 96vw)" style={{ top: 20 }} destroyOnHidden maskClosable={false}
      title={<Space><ColumnWidthOutlined />Fotos com a medida</Space>}
      footer={(
        <Flex justify="space-between" align="center">
          <Text type="secondary">{prontos.length} de {previas.length} item(ns) prontos · salva como {comoPrincipal ? 'foto principal (a atual vai para a galeria)' : 'foto extra na galeria'}</Text>
          <Space>
            <Button onClick={onFechar} disabled={!!salvando}>Fechar</Button>
            <Button type="primary" icon={<PictureOutlined />} disabled={!prontos.length || gerando} loading={!!salvando} onClick={salvar}>Salvar em {prontos.length} item(ns)</Button>
          </Space>
        </Flex>
      )}
    >
      {det && (
        <Row gutter={16}>
          <Col xs={24} lg={8}>
            <Card size="small" title="Texto da medida">
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Texto principal (use os campos)</Text>
                  <Input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="{Comprimento}" />
                  <Flex wrap gap={4} style={{ marginTop: 4 }}>
                    {campos.map(c => (
                      <Tooltip key={c.chave} title={`ex.: ${c.exemplo}`}>
                        <Tag style={{ cursor: 'pointer', margin: 0 }} onClick={() => inserir(setModelo, c.chave)}>+ {c.chave}</Tag>
                      </Tooltip>
                    ))}
                    {!campos.length && <Text type="secondary" style={{ fontSize: 12 }}>Sem campos no cadastro: escreva o texto.</Text>}
                  </Flex>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Segunda linha (opcional)</Text>
                  <Input value={modeloSub} onChange={e => setModeloSub(e.target.value)} placeholder="ex.: {Largura} · Nylon" />
                  <Flex wrap gap={4} style={{ marginTop: 4 }}>
                    {campos.map(c => <Tag key={c.chave} style={{ cursor: 'pointer', margin: 0 }} onClick={() => inserir(setModeloSub, c.chave)}>+ {c.chave}</Tag>)}
                  </Flex>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Unidade</Text>
                  <Segmented block value={unidade} onChange={v => setUnidade(v as typeof unidade)} options={[
                    { value: 'original', label: 'Como está' }, { value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }, { value: 'm', label: 'm' },
                  ]} />
                </div>
              </Space>
            </Card>
            <Card size="small" title="Visual" style={{ marginTop: 12 }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Segmented block value={estilo} onChange={v => setEstilo(v as EstiloEtiqueta)} options={[
                  { value: 'COTA', label: <Tooltip title="Linha com setas de ponta a ponta, como em desenho técnico">Cota (seta)</Tooltip> },
                  { value: 'FAIXA', label: 'Faixa embaixo' },
                  { value: 'SELO', label: 'Selo no canto' },
                ]} />
                <Flex gap={6} wrap align="center">
                  <BgColorsOutlined />
                  {CORES.map(c => (
                    <Tooltip key={c.valor} title={c.nome}>
                      <div onClick={() => setCor(c.valor)} style={{ width: 26, height: 26, borderRadius: 6, background: c.valor, cursor: 'pointer', outline: cor === c.valor ? '3px solid #91caff' : 'none' }} />
                    </Tooltip>
                  ))}
                </Flex>
              </Space>
            </Card>
            <Card size="small" title="Foto de base" style={{ marginTop: 12 }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Segmented block value={base} onChange={v => setBase(v as 'ITEM' | 'UMA')} options={[{ value: 'ITEM', label: 'A de cada item' }, { value: 'UMA', label: 'Uma para todos' }]} />
                {base === 'UMA' && (
                  <>
                    <Select
                      value={fotoUnica ?? undefined} onChange={setFotoUnica} placeholder="Escolha a foto" style={{ width: '100%' }}
                      options={fotos.map((f, k) => ({ value: f, label: <Space><img src={f} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />{f === det.fotoFamilia ? 'Foto da família' : `Foto ${k + 1}`}</Space> }))}
                    />
                    <Upload accept="image/*" showUploadList={false} beforeUpload={f => { setFotoUnica(URL.createObjectURL(f)); return false; }}>
                      <Button size="small" icon={<UploadOutlined />}>Usar uma foto do computador</Button>
                    </Upload>
                  </>
                )}
                <Text type="secondary" style={{ fontSize: 12 }}>Use a foto original, sem medida: a medida é desenhada de novo a cada vez.</Text>
              </Space>
            </Card>
            <Card size="small" style={{ marginTop: 12 }}>
              <Segmented block value={comoPrincipal ? 'P' : 'G'} onChange={v => setComoPrincipal(v === 'P')} options={[
                { value: 'P', label: 'Salvar como principal' }, { value: 'G', label: 'Como foto extra' },
              ]} />
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            {salvando && <Progress percent={Math.round((salvando.feitos / salvando.total) * 100)} style={{ marginBottom: 8 }} />}
            <Spin spinning={gerando && !previas.length}>
              {previas.length === 0 ? <Empty description="Gerando as prévias…" /> : (
                <>
                  <Flex justify="space-between" style={{ marginBottom: 8 }}>
                    <Checkbox
                      checked={marcados.size === det.itens.length} indeterminate={marcados.size > 0 && marcados.size < det.itens.length}
                      onChange={e => setMarcados(e.target.checked ? new Set(det.itens.map(i => i.idItem)) : new Set())}
                    >Todos</Checkbox>
                    {gerando && <Text type="secondary"><Spin size="small" /> atualizando…</Text>}
                  </Flex>
                  <Flex wrap gap={12} style={{ maxHeight: '64vh', overflowY: 'auto' }}>
                    {previas.map(p => (
                      <div key={p.item.idItem} style={{ width: 190, border: '1px solid #f0f0f0', borderRadius: 8, padding: 6, background: '#fff', opacity: marcados.has(p.item.idItem) ? 1 : 0.45 }}>
                        <Checkbox checked={marcados.has(p.item.idItem)} onChange={() => setMarcados(s => { const n = new Set(s); if (n.has(p.item.idItem)) n.delete(p.item.idItem); else n.add(p.item.idItem); return n; })}>
                          <Text strong style={{ fontSize: 12 }}>{p.item.sku}</Text>
                        </Checkbox>
                        {p.imagem ? <img src={p.imagem} alt="" style={{ width: '100%', aspectRatio: '1', marginTop: 4, borderRadius: 4 }} />
                          : <Alert type="warning" style={{ marginTop: 4, fontSize: 11 }} message={p.erro || 'Sem foto'} />}
                        {!p.texto && p.imagem && <Text type="warning" style={{ fontSize: 11 }}>Sem medida no cadastro</Text>}
                      </div>
                    ))}
                  </Flex>
                </>
              )}
            </Spin>
          </Col>
        </Row>
      )}
    </Modal>
  );
};

export default GeradorMedidasModal;
