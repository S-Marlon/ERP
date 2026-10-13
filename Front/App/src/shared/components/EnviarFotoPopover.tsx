// Envio de foto em um lugar só: escolher arquivo, colar o link (https://...) ou colar a imagem copiada (Ctrl+V).
import React, { useState } from 'react';
import { Button, Input, Popover, Space, Typography, Upload, message } from 'antd';
import { LinkOutlined, UploadOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  titulo?: string;
  onArquivo: (arquivo: File) => Promise<void> | void;
  onUrl: (url: string) => Promise<void> | void;
  disabled?: boolean;
  children: React.ReactNode;     // o que abre o popover (miniatura, botão...)
}

const EnviarFotoPopover: React.FC<Props> = ({ titulo = 'Foto', onArquivo, onUrl, disabled, children }) => {
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState('');
  const [salvando, setSalvando] = useState(false);

  const executar = async (acao: () => Promise<void> | void) => {
    setSalvando(true);
    try {
      await acao();
      setUrl('');
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  };

  const usarLink = () => {
    const link = url.trim();
    if (!/^https?:\/\/\S+$/i.test(link)) { message.warning('Cole um link válido (começando com http:// ou https://).'); return; }
    executar(() => onUrl(link));
  };

  // Imagem copiada (print, "copiar imagem" do navegador) colada direto no campo
  const colar = (e: React.ClipboardEvent) => {
    const arquivo = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'));
    if (!arquivo) return;
    e.preventDefault();
    executar(() => onArquivo(arquivo));
  };

  const conteudo = (
    <Space direction="vertical" size={8} style={{ width: 340 }}>
      <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={f => { executar(() => onArquivo(f)); return false; }}>
        <Button icon={<UploadOutlined />} block loading={salvando}>Escolher arquivo do computador</Button>
      </Upload>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          prefix={<LinkOutlined />} placeholder="Cole o link da imagem ou a imagem (Ctrl+V)" value={url} autoFocus
          onChange={e => setUrl(e.target.value)} onPressEnter={usarLink} onPaste={colar} disabled={salvando}
        />
        <Button type="primary" onClick={usarLink} loading={salvando}>Usar</Button>
      </Space.Compact>
      <Text type="secondary" style={{ fontSize: 11 }}>Para o Mercado Livre: pelo menos 500 px num dos lados (ideal 1200), fundo claro.</Text>
    </Space>
  );

  return (
    <Popover
      trigger="click" open={!disabled && aberto} onOpenChange={v => setAberto(v)} title={titulo} content={conteudo}
      destroyOnHidden placement="bottomLeft"
    >
      <span style={{ cursor: disabled ? 'default' : 'pointer', display: 'inline-block' }}>{children}</span>
    </Popover>
  );
};

export default EnviarFotoPopover;
