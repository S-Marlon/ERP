import { useEffect, useState } from 'react';
import { Button, Card, Empty, Input, Popconfirm, Select, Space, Tag, Typography, Upload, message } from 'antd';
import { DeleteOutlined, FileTextOutlined, InboxOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { AnexoItem, TipoAnexo, adicionarAnexo, enviarArquivoAnexo, removerAnexo } from './CatalogSku.service';
import FotoFamiliaControle from '../familias/FotoFamiliaControle';
import GaleriaImagens from './GaleriaImagens';

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
  /** família do item: a foto dela vale quando o item não tem foto própria */
  familia?: { id: number; nome: string | null; imagem: string | null } | null;
}

/**
 * Imagens e documentos do item: arraste arquivos (ficam no servidor do ERP, em Backend/uploads)
 * ou cole o link de um arquivo já hospedado. A primeira imagem vira a principal.
 */
export default function AnexosCard({ idItem, anexos, onChange, familia }: AnexosCardProps) {
  const [fotoFamilia, setFotoFamilia] = useState<string | null>(familia?.imagem || null);
  useEffect(() => { setFotoFamilia(familia?.imagem || null); }, [familia?.id, familia?.imagem]);
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

  // Vários arquivos de uma vez: envia um por um (fotos viram galeria; PDF vira manual técnico)
  const [enviando, setEnviando] = useState(0);
  const enviar = async (arquivo: File) => {
    if (arquivo.size > 10 * 1024 * 1024) { message.warning(`${arquivo.name}: maior que 10 MB.`); return; }
    setEnviando(n => n + 1);
    try {
      await enviarArquivoAnexo(idItem, arquivo);
      onChange();
    } catch (err: unknown) {
      message.error(`${arquivo.name}: ${err instanceof Error ? err.message : 'erro ao enviar.'}`);
    } finally {
      setEnviando(n => n - 1);
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
      {familia && (
        <div style={{ marginBottom: 8 }}>
          <FotoFamiliaControle
            idFamilia={familia.id} nome={familia.nome} imagem={fotoFamilia} itemSemFoto={imagens.length === 0}
            onAlterada={setFotoFamilia}
          />
        </div>
      )}
      <Upload.Dragger
        multiple
        showUploadList={false}
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        beforeUpload={(arquivo) => { enviar(arquivo as File); return false; }}
        disabled={salvando}
        style={{ marginBottom: 8, padding: 4 }}
      >
        <p style={{ margin: 0 }}><InboxOutlined style={{ fontSize: 28, color: '#1677ff' }} /></p>
        <Text>{enviando > 0 ? `Enviando ${enviando} arquivo(s)...` : 'Arraste fotos ou PDF aqui, ou clique para escolher'}</Text>
        <div><Text type="secondary" style={{ fontSize: 11 }}>JPG, PNG, WEBP ou PDF, até 10 MB cada. Vários de uma vez.</Text></div>
      </Upload.Dragger>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Select value={tipo} onChange={setTipo} options={TIPOS} style={{ width: 170 }} />
        <Input
          prefix={<LinkOutlined />}
          placeholder="...ou cole o link de um arquivo já hospedado (https://...)"
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
          {imagens.length > 0 && <GaleriaImagens idItem={idItem} imagens={imagens} onChange={onChange} semAdicionar />}

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
        Arraste para mudar a ordem: a 1ª é a principal e a de medidas fica logo depois. É nessa ordem que as fotos vão para o Mercado Livre.
      </Text>
    </Card>
  );
}
