// Foto da família: vale para os itens que não têm foto própria (ficha do produto e anúncios do Mercado Livre).
// Envia arquivo, cola link ou imagem copiada; "compacto" é um botão com miniatura, "cartao" mostra a foto grande.
import React, { useState } from 'react';
import { Avatar, Button, Image, Popconfirm, Space, Spin, Typography, message } from 'antd';
import { DeleteOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import EnviarFotoPopover from '../../../shared/components/EnviarFotoPopover';
import { definirImagemFamilia, enviarImagemFamilia } from './FamilyManager.api';

const { Text } = Typography;

interface Props {
  idFamilia: number;
  nome?: string | null;
  imagem: string | null;
  onAlterada: (imagem: string | null) => void;
  modo?: 'compacto' | 'cartao';
  /** texto do cartão quando o item não tem foto própria */
  itemSemFoto?: boolean;
}

// Aviso de foto pequena para o Mercado Livre (a foto fica salva do mesmo jeito)
const avisarSePequena = (src: string) => {
  const img = new window.Image();
  img.onload = () => {
    if (Math.max(img.naturalWidth, img.naturalHeight) < 500) {
      message.warning(`Foto da família com ${img.naturalWidth}×${img.naturalHeight} px: o Mercado Livre pede ao menos 500 px num dos lados.`, 6);
    }
  };
  img.src = src;
};

const FotoFamiliaControle: React.FC<Props> = ({ idFamilia, nome, imagem, onAlterada, modo = 'cartao', itemSemFoto }) => {
  const [salvando, setSalvando] = useState(false);

  const executar = async (acao: () => Promise<{ imagem: string | null }>, ok: string) => {
    setSalvando(true);
    try {
      const r = await acao();
      message.success(ok);
      if (r.imagem) avisarSePequena(r.imagem);
      onAlterada(r.imagem);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar a foto da família.');
    } finally {
      setSalvando(false);
    }
  };

  const popover = (gatilho: React.ReactNode) => (
    <EnviarFotoPopover
      titulo={`Foto da família${nome ? ` · ${nome}` : ''}`}
      disabled={salvando}
      onArquivo={f => executar(() => enviarImagemFamilia(idFamilia, f), 'Foto da família salva.')}
      onUrl={u => executar(() => definirImagemFamilia(idFamilia, u), 'Foto da família salva.')}
    >
      {gatilho}
    </EnviarFotoPopover>
  );

  if (modo === 'compacto') {
    return popover(
      <Button size="small" loading={salvando}
        icon={imagem ? <Avatar shape="square" size={18} src={imagem} style={{ marginTop: -2 }} /> : <UploadOutlined />}>
        {imagem ? 'Foto da família' : 'Enviar foto da família'}
      </Button>
    );
  }

  return (
    <div style={{ border: '1px dashed #91caff', background: '#f0f7ff', borderRadius: 8, padding: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
      <Spin spinning={salvando} size="small">
        {imagem
          ? <Image src={imagem} width={72} height={72} style={{ objectFit: 'contain', background: '#fff', borderRadius: 6 }} />
          : <Avatar shape="square" size={72} icon={<PictureOutlined />} style={{ background: '#fff', color: '#bbb' }} />}
      </Spin>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong>Foto da família{nome ? `: ${nome}` : ''}</Text>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {imagem
              ? (itemSemFoto ? 'Este item não tem foto própria: usa esta (no catálogo e no Mercado Livre).' : 'Vale para os itens da família sem foto própria. Este item usa as fotos dele.')
              : 'A família não tem foto. Coloque uma e ela vale para todos os itens sem foto própria.'}
          </Text>
        </div>
        <Space size={4} style={{ marginTop: 4 }}>
          {popover(<Button size="small" icon={<UploadOutlined />}>{imagem ? 'Trocar' : 'Enviar ou colar link'}</Button>)}
          {imagem && (
            <Popconfirm title="Tirar a foto da família?" description="Os itens sem foto própria ficam sem foto." okText="Tirar"
              onConfirm={() => executar(() => definirImagemFamilia(idFamilia, null), 'Foto da família removida.')}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      </div>
    </div>
  );
};

export default FotoFamiliaControle;
