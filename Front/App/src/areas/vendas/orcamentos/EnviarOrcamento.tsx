// Orçamento em PDF: baixar e mandar pelo WhatsApp. O wa.me não leva arquivo: quando o navegador sabe compartilhar
// arquivos (celular, Windows com o app do WhatsApp) o PDF vai direto; senão baixa o PDF e abre a conversa com o texto.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Space, Typography, message } from 'antd';
import { CopyOutlined, DownloadOutlined, ShareAltOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { lerConfiguracoes } from '../../../shared/core/configuracoes/configuracoes';
import { formatarTelefone, linkWhatsapp, telefoneDoTexto } from '../../../shared/utils/whatsapp';
import { PedidoAbertoDetalhe, pedidosAbertosApi } from '../pdv/services/pedidosAbertosApi';
import { gerarPdfOrcamento, mensagemOrcamento, nomeArquivoOrcamento, nomeEmpresa } from './orcamentoPdf';

const { Text } = Typography;

const arquivoPdf = (o: PedidoAbertoDetalhe) =>
  new File([gerarPdfOrcamento(o, lerConfiguracoes().empresa) as BlobPart], nomeArquivoOrcamento(o), { type: 'application/pdf' });

const baixar = (f: File) => {
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Baixa o PDF do orçamento (botão da lista). */
export const baixarPdfOrcamento = async (id: number) => {
  try { baixar(arquivoPdf(await pedidosAbertosApi.detalhe(id))); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao gerar o PDF.'); }
};

const podeCompartilhar = (f: File) => {
  try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] }); } catch { return false; }
};

export const EnviarOrcamentoWhatsapp: React.FC<{ id: number | null; onClose: () => void }> = ({ id, onClose }) => {
  const [o, setO] = useState<PedidoAbertoDetalhe | null>(null);
  const [telefone, setTelefone] = useState('');
  const [texto, setTexto] = useState('');

  useEffect(() => {
    setO(null);
    if (!id) return;
    pedidosAbertosApi.detalhe(id).then(d => {
      setO(d);
      setTelefone(formatarTelefone(d.telefoneCliente || telefoneDoTexto(d.contato) || ''));
      setTexto(mensagemOrcamento(d, nomeEmpresa(lerConfiguracoes().empresa)));
    }).catch(e => { message.error(e.message); onClose(); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const arquivo = useMemo(() => (o ? arquivoPdf(o) : null), [o]);
  const compartilha = !!arquivo && podeCompartilhar(arquivo);
  const digitos = telefone.replace(/\D/g, '');
  const telefoneOk = digitos.length >= 10;

  const compartilhar = async () => {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo], text: texto, title: arquivo.name });
      onClose();
    } catch (e: any) {
      if (e?.name !== 'AbortError') message.error('Não deu para compartilhar. Use "Baixar PDF e abrir conversa".');
    }
  };

  const abrirConversa = () => {
    if (!arquivo) return;
    baixar(arquivo);
    window.open(linkWhatsapp(digitos, texto), '_blank');
    message.info(`PDF baixado (${arquivo.name}). Na conversa, anexe pelo clipe › Documento ou arraste o arquivo.`, 8);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); message.success('Mensagem copiada.'); } catch { message.error('O navegador não deixou copiar.'); }
  };

  return (
    <Modal
      open={!!id}
      onCancel={onClose}
      title={<span><WhatsAppOutlined style={{ color: '#25d366' }} /> Enviar orçamento{o ? ` Nº ${o.id}` : ''} pelo WhatsApp</span>}
      footer={null}
      destroyOnHidden
      loading={!o}
      width={560}
    >
      {o && arquivo && (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Text type="secondary">Cliente</Text>
            <div><b>{o.cliente}</b>{o.contato ? <Text type="secondary"> · {o.contato}</Text> : null}</div>
          </div>
          <div>
            <Text type="secondary">WhatsApp do cliente</Text>
            <Input
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              onBlur={() => setTelefone(formatarTelefone(telefone))}
              placeholder="(11) 98888-7777"
              status={telefone && !telefoneOk ? 'warning' : undefined}
              allowClear
            />
            {!telefone && <Text type="secondary" style={{ fontSize: 12 }}>Sem número: o WhatsApp abre para você escolher o contato.</Text>}
          </div>
          <div>
            <Text type="secondary">Mensagem</Text>
            <Input.TextArea value={texto} onChange={e => setTexto(e.target.value)} autoSize={{ minRows: 3, maxRows: 6 }} />
          </div>
          <Alert
            type="info"
            showIcon
            message={compartilha
              ? 'Compartilhar manda o PDF direto: escolha o WhatsApp na janela que abrir e depois o contato.'
              : 'O link do WhatsApp não leva arquivo: o PDF é baixado e a conversa abre com a mensagem. É só anexar o PDF (clipe › Documento) ou arrastar para a conversa.'}
          />
          <Space wrap style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button icon={<CopyOutlined />} onClick={copiar}>Copiar mensagem</Button>
            <Button icon={<DownloadOutlined />} onClick={() => baixar(arquivo)}>Só baixar o PDF</Button>
            {compartilha && <Button icon={<ShareAltOutlined />} onClick={compartilhar}>Compartilhar PDF</Button>}
            <Button
              type="primary"
              icon={<WhatsAppOutlined />}
              style={{ background: '#25d366' }}
              disabled={!!telefone && !telefoneOk}
              onClick={abrirConversa}
            >
              Baixar PDF e abrir conversa
            </Button>
          </Space>
        </Space>
      )}
    </Modal>
  );
};
