import { useState } from 'react';
import { Button, Card, Empty, Image, Input, Popconfirm, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, FileTextOutlined, LinkOutlined, PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { AnexoItem, TipoAnexo, adicionarAnexo, definirImagemPrincipal, removerAnexo } from './CatalogSku.service';

const { Text } = Typography;

const TIPOS: { value: TipoAnexo; label: string }[] = [
  { value: 'FOTO_GALERIA', label: 'Foto (galeria)' },
  { value: 'IMAGEM_PRINCIPAL', label: 'Imagem principal' },
  { value: 'MANUAL_TECNICO', label: 'Manual técnico' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'FISPQ', label: 'FISPQ' },
];

const isImagem = (tipo: TipoAnexo) => tipo === 'IMAGEM_PRINCIPAL' || tipo === 'FOTO_GALERIA';

interface AnexosCardProps {
  idItem: number;
  anexos: AnexoItem[];
  onChange: () => void; // recarrega a ficha após qualquer alteração
}

/**
 * Imagens e documentos do item. Por enquanto guarda só o LINK do arquivo hospedado;
 * quando houver um serviço de upload, ele gera a URL e o resto continua igual.
 */
export default function AnexosCard({ idItem, anexos, onChange }: AnexosCardProps) {
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState<TipoAnexo>('FOTO_GALERIA');
  const [salvando, setSalvando] = useState(false);

  const imagens = anexos.filter(a => isImagem(a.tipo_anexo));
  const documentos = anexos.filter(a => !isImagem(a.tipo_anexo));

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setSalvando(true);
    try {
      await acao();
      message.success(sucesso);
      onChange();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Erro ao atualizar anexos.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAdicionar = () => {
    const link = url.trim();
    if (!/^https?:\/\/\S+$/i.test(link)) {
      message.warning('Cole um link válido (começando com http:// ou https://).');
      return;
    }
    executar(() => adicionarAnexo(idItem, link, tipo), 'Anexo adicionado.').then(() => setUrl(''));
  };

  return (
    <Card size="small" title="Imagens e Documentos" bordered={false} style={{ background: '#fafafa' }}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Select value={tipo} onChange={setTipo} options={TIPOS} style={{ width: 170 }} />
        <Input
          prefix={<LinkOutlined />}
          placeholder="Cole o link da imagem ou documento (https://...)"
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.target.value)}
          onPressEnter={handleAdicionar}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={salvando} onClick={handleAdicionar}>Adicionar</Button>
      </Space.Compact>

      {imagens.length === 0 && documentos.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma imagem ou documento" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {imagens.length > 0 && (
            <Image.PreviewGroup>
              <Space wrap size={12}>
                {imagens.map(a => {
                  const principal = a.tipo_anexo === 'IMAGEM_PRINCIPAL';
                  return (
                    <div
                      key={a.id_anexo}
                      style={{ border: principal ? '2px solid #faad14' : '1px solid #d9d9d9', borderRadius: 6, padding: 4, background: '#fff', width: 112 }}
                    >
                      <Image
                        src={a.url_anexo}
                        width={100}
                        height={100}
                        style={{ objectFit: 'contain' }}
                        fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23f5f5f5'/><text x='50' y='54' font-size='10' text-anchor='middle' fill='%23999'>link inválido</text></svg>"
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <Tooltip title={principal ? 'Imagem principal' : 'Definir como principal'}>
                          <Button
                            type="text"
                            size="small"
                            disabled={principal || salvando}
                            icon={principal ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                            onClick={() => executar(() => definirImagemPrincipal(idItem, a.id_anexo), 'Imagem principal definida.')}
                          />
                        </Tooltip>
                        <Popconfirm title="Remover esta imagem?" onConfirm={() => executar(() => removerAnexo(idItem, a.id_anexo), 'Imagem removida.')}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={salvando} />
                        </Popconfirm>
                      </div>
                    </div>
                  );
                })}
              </Space>
            </Image.PreviewGroup>
          )}

          {documentos.length > 0 && (
            <Space direction="vertical" size={4}>
              {documentos.map(a => (
                <Space key={a.id_anexo} size={8}>
                  <FileTextOutlined />
                  <Tag>{TIPOS.find(t => t.value === a.tipo_anexo)?.label || a.tipo_anexo}</Tag>
                  <a href={a.url_anexo} target="_blank" rel="noopener noreferrer">{a.nome_arquivo}</a>
                  <Popconfirm title="Remover este documento?" onConfirm={() => executar(() => removerAnexo(idItem, a.id_anexo), 'Documento removido.')}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={salvando} />
                  </Popconfirm>
                </Space>
              ))}
            </Space>
          )}
        </Space>
      )}

      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
        Por enquanto o sistema guarda apenas o link do arquivo hospedado. A primeira imagem vira a principal automaticamente.
      </Text>
    </Card>
  );
}
