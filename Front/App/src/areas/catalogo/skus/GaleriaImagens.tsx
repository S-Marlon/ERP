// Galeria das fotos de um item, na ordem em que vão para os canais: arrastar para ordenar (a 1ª é a principal; a de
// medidas fica logo depois), estrela, setas, excluir e adicionar (arquivo, link ou Ctrl+V). Usada no cadastro do SKU e
// na aba Fotos do anúncio do ML.
import React, { useEffect, useState } from 'react';
import { Button, Flex, Image, Popconfirm, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, LeftOutlined, PlusOutlined, RightOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import EnviarFotoPopover from '../../../shared/components/EnviarFotoPopover';
import { AnexoItem, adicionarAnexo, enviarArquivoAnexo, ordenarImagens, removerAnexo } from './CatalogSku.service';
import { AvisoFoto, avisosDaFoto, comMedidasEmSegundo, ehImagemDeMedidas, moverFoto } from './galeriaFotos';

const { Text } = Typography;

const TEXTO_AVISO: Record<AvisoFoto, { cor: string; texto: string; dica: string }> = {
  PEQUENA: { cor: 'red', texto: 'pequena', dica: 'Menor que 500 px: o ML recusa esta foto.' },
  PRINCIPAL_COM_MEDIDAS: { cor: 'orange', texto: 'principal com texto', dica: 'O ML pede a foto principal com fundo branco e sem textos. Arraste a foto do produto para o 1º lugar.' },
  FORA_DO_LIMITE: { cor: 'default', texto: 'não vai', dica: 'Passa do limite de fotos da categoria do ML.' },
  REPETIDA: { cor: 'gold', texto: 'repetida', dica: 'A mesma foto já está antes na lista: pode excluir.' },
};
const FALHA = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23f5f5f5'/><text x='50' y='54' font-size='10' text-anchor='middle' fill='%23999'>sem imagem</text></svg>";

/** O que a galeria faz ao mexer: no item (padrão, pelos anexos) ou noutro dono, como a galeria da família. */
export interface AcoesGaleria {
  ordenar: (ids: number[]) => Promise<unknown>;
  remover: (id: number) => Promise<unknown>;
  enviar: (arquivo: File) => Promise<unknown>;
  link: (url: string) => Promise<unknown>;
}

interface Props {
  idItem?: number;                   // fotos do item (anexos); sem ele, use `acoes`
  acoes?: AcoesGaleria;
  imagens: AnexoItem[];
  onChange: () => void;              // recarregar depois de qualquer alteração
  limite?: number;                   // fotos que o canal aceita (as demais ficam marcadas)
  tamanho?: number;                  // lado da miniatura
  semAdicionar?: boolean;            // quem usa já tem o próprio envio (ex.: área de arrastar arquivos)
  acaoExtra?: (foto: AnexoItem) => React.ReactNode;
  rotuloPrincipal?: string;          // texto da 1ª (padrão "principal")
  regraMedidas?: boolean;            // imagem de medidas logo depois da principal (padrão sim)
  etiqueta?: (foto: AnexoItem) => React.ReactNode;
  corBorda?: string;                 // cor da moldura das fotos (ex.: roxo = da família, azul = da variação)
  bordaDe?: (foto: AnexoItem) => string | undefined;   // moldura de cada foto (ex.: pelo papel na família)
  semPrincipal?: boolean;            // a posição não decide a principal (família: o papel decide): sem estrela nem destaque
}

const GaleriaImagens: React.FC<Props> = ({ idItem, acoes: acoesProprias, imagens, onChange, limite, tamanho = 96, semAdicionar, acaoExtra, rotuloPrincipal = 'principal', regraMedidas = true, etiqueta, corBorda, bordaDe, semPrincipal }) => {
  const acoes: AcoesGaleria = acoesProprias || {
    ordenar: ids => ordenarImagens(idItem!, ids),
    remover: id => removerAnexo(idItem!, id),
    enviar: f => enviarArquivoAnexo(idItem!, f),
    link: u => adicionarAnexo(idItem!, u, 'FOTO_GALERIA'),
  };
  const [lista, setLista] = useState(imagens);
  useEffect(() => { setLista(imagens); }, [imagens]);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [medidas, setMedidas] = useState<Record<string, { w: number; h: number }>>({});

  const executar = async (acao: () => Promise<unknown>, sucesso?: string) => {
    setSalvando(true);
    try {
      await acao();
      if (sucesso) message.success(sucesso);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao atualizar as fotos.');
      setLista(imagens);
    } finally {
      setSalvando(false);
      onChange();
    }
  };
  const reordenar = (de: number, para: number) => {
    const movida = moverFoto(lista, de, para);
    const nova = regraMedidas ? comMedidasEmSegundo(movida) : movida;
    if (nova.every((f, k) => f.id_anexo === lista[k].id_anexo)) return;
    setLista(nova);
    executar(() => acoes.ordenar(nova.map(f => f.id_anexo)));
  };

  const largura = tamanho + 16;
  return (
    <Spin spinning={salvando} size="small">
      <Image.PreviewGroup>
        <Flex wrap gap={10} align="flex-start">
          {lista.map((foto, k) => {
            const principal = k === 0 && !semPrincipal;
            const avisos = avisosDaFoto(foto, k, lista, medidas[foto.url_anexo], limite).filter(a => regraMedidas || a !== 'PRINCIPAL_COM_MEDIDAS');
            return (
              <div
                key={foto.id_anexo}
                draggable={!salvando}
                onDragStart={e => { setArrastando(k); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => { if (arrastando === null) return; e.preventDefault(); setSobre(k); }}
                onDragLeave={() => setSobre(s => (s === k ? null : s))}
                onDrop={e => { e.preventDefault(); if (arrastando !== null) reordenar(arrastando, k); setArrastando(null); setSobre(null); }}
                onDragEnd={() => { setArrastando(null); setSobre(null); }}
                style={{
                  width: largura, padding: 6, borderRadius: 8, background: '#fff', cursor: 'grab',
                  border: sobre === k && arrastando !== k ? '2px dashed #1677ff' : bordaDe?.(foto) || (principal ? '2px solid #faad14' : corBorda ? `2px solid ${corBorda}` : '1px solid #e5e7eb'),
                  opacity: arrastando === k ? 0.4 : avisos.includes('FORA_DO_LIMITE') ? 0.55 : 1,
                }}
              >
                <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 11 }}>{k + 1}ª{principal ? ` · ${rotuloPrincipal}` : ''}</Text>
                  {ehImagemDeMedidas(foto.nome_arquivo) && <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>medidas</Tag>}
                  {etiqueta?.(foto)}
                </Flex>
                <Image
                  src={foto.url_anexo} width={tamanho} height={tamanho} fallback={FALHA} draggable={false}
                  style={{ objectFit: 'contain', borderRadius: 4, background: '#fafafa' }}
                  onLoad={e => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.naturalWidth) setMedidas(m => (m[foto.url_anexo] ? m : { ...m, [foto.url_anexo]: { w: el.naturalWidth, h: el.naturalHeight } }));
                  }}
                />
                <div style={{ minHeight: 18, marginTop: 2 }}>
                  {avisos.map(a => (
                    <Tooltip key={a} title={TEXTO_AVISO[a].dica}><Tag color={TEXTO_AVISO[a].cor} style={{ margin: '0 2px 0 0', fontSize: 10, lineHeight: '16px' }}>{TEXTO_AVISO[a].texto}</Tag></Tooltip>
                  ))}
                </div>
                <Flex justify="space-between" align="center">
                  {!semPrincipal && (
                    <Tooltip title={principal ? `Foto ${rotuloPrincipal}` : `Fazer ${rotuloPrincipal} (vai para o 1º lugar)`}>
                      <Button type="text" size="small" disabled={principal || salvando} onClick={() => reordenar(k, 0)}
                        icon={principal ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} />
                    </Tooltip>
                  )}
                  <Button type="text" size="small" icon={<LeftOutlined />} disabled={k === 0 || salvando} onClick={() => reordenar(k, k - 1)} />
                  <Button type="text" size="small" icon={<RightOutlined />} disabled={k === lista.length - 1 || salvando} onClick={() => reordenar(k, k + 1)} />
                  {acaoExtra?.(foto)}
                  <Popconfirm title="Excluir esta foto?" okText="Excluir" okButtonProps={{ danger: true }}
                    onConfirm={() => executar(() => acoes.remover(foto.id_anexo), 'Foto excluída.')}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={salvando} />
                  </Popconfirm>
                </Flex>
              </div>
            );
          })}
          {!semAdicionar && (
            <EnviarFotoPopover
              titulo="Adicionar foto"
              onArquivo={f => executar(() => acoes.enviar(f), 'Foto adicionada.')}
              onUrl={u => executar(() => acoes.link(u), 'Foto adicionada.')}
            >
              <div style={{
                width: largura, height: tamanho + 74, borderRadius: 8, border: '1px dashed #91caff', background: '#f5faff', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <PlusOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                <Text style={{ fontSize: 12, color: '#1677ff' }}>Adicionar</Text>
              </div>
            </EnviarFotoPopover>
          )}
        </Flex>
      </Image.PreviewGroup>
    </Spin>
  );
};

export default GaleriaImagens;
