// Ficha do poço › "Ficha de campo (A4)": pré-visualização e impressão da ficha de campo da perfuração preenchida com o
// que o poço já tem (cliente, local, estrutura, bomba); o resto sai em linha para anotar à mão. Também sai em branco.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Segmented, Space, Tag, Typography, message } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { ConfigProcesso, conjuntoApi, ConjuntoDoPoco, PocoCompleto, processoApi, urlArquivo } from './obrasApi';
import { CAMPOS_DO_MODELO, htmlEmBranco, semImpressao } from './documentosEmBranco';
import { camposVazios, destaquePrevia } from './camposKit';
import { valoresFichaDoPoco } from './fichaCampoPoco';

const { Text } = Typography;
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const FichaCampoPocoModal: React.FC<{ aberto: boolean; ficha: PocoCompleto | null; onFechar: () => void }> = ({ aberto, ficha, onFechar }) => {
  const [cfg, setCfg] = useState<ConfigProcesso | null>(null);
  const [conj, setConj] = useState<ConjuntoDoPoco | null>(null);
  const [modo, setModo] = useState<'PREENCHIDA' | 'BRANCO'>('PREENCHIDA');
  const quadro = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!aberto || !ficha) return;
    Promise.all([processoApi.config(), conjuntoApi.doPoco(ficha.poco.idPoco).catch(() => null)])
      .then(([c, j]) => { setCfg(c); setConj(j); })
      .catch(e => message.error(e instanceof Error ? e.message : 'Erro ao carregar.'));
  }, [aberto, ficha]);

  const valores = useMemo(() => (ficha
    ? valoresFichaDoPoco(ficha.poco, ficha.proprietario ? { nome: ficha.proprietario.nome, telefone: ficha.proprietario.telefone } : null,
      ficha.estrutura, conj?.atual || null, hojeIso())
    : null), [ficha, conj]);
  const html = (paraImprimir: boolean) => {
    if (!cfg) return '';
    const h = htmlEmBranco('FICHA', cfg, urlArquivo(cfg.logo), modo === 'PREENCHIDA' ? valores : null);
    return paraImprimir ? h : destaquePrevia(semImpressao(h), null, false);
  };
  const previa = useMemo(() => html(false), [cfg, modo, valores]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const doc = quadro.current?.contentDocument;
    if (!doc || !previa) return;
    doc.open(); doc.write(previa); doc.close();
  }, [previa]);

  const imprimir = () => {
    const w = window.open('', '_blank');
    if (!w) { message.warning('O navegador bloqueou a janela: libere os pop-ups para este endereço.'); return; }
    w.document.open(); w.document.write(html(true)); w.document.close();
  };
  const chaves = CAMPOS_DO_MODELO.FICHA.flatMap(g => g.chaves);
  const preenchidos = valores ? chaves.length - camposVazios(chaves, valores) : 0;

  return (
    <Modal open={aberto} onCancel={onFechar} width={940} destroyOnHidden
      title={<Space wrap>Pré-visualização (A4) · Ficha de campo da perfuração{ficha && <Tag>{ficha.poco.identificacao}</Tag>}</Space>}
      footer={<Space>
        <Button onClick={onFechar}>Fechar</Button>
        <Button type="primary" icon={<PrinterOutlined />} disabled={!cfg} onClick={imprimir}>Imprimir</Button>
      </Space>}
      styles={{ body: { paddingTop: 4 } }}>
      <Space style={{ marginBottom: 8 }} wrap>
        <Segmented value={modo} onChange={v => setModo(v as typeof modo)}
          options={[{ value: 'PREENCHIDA', label: 'Com os dados do poço' }, { value: 'BRANCO', label: 'Em branco' }]} />
        {modo === 'PREENCHIDA' && <Text type="secondary" style={{ fontSize: 12 }}>
          {preenchidos} de {chaves.length} campos vêm do poço (cliente, local, estrutura e bomba); o resto sai em linha para anotar à mão.
        </Text>}
      </Space>
      <div style={{ background: '#e5e7eb', padding: 8, borderRadius: 6 }}>
        <iframe ref={quadro} title="Pré-visualização da ficha de campo"
          style={{ width: '100%', maxWidth: 860, height: '70vh', display: 'block', margin: '0 auto', border: '1px solid #d1d5db', background: '#e5e7eb' }} />
      </div>
    </Modal>
  );
};
