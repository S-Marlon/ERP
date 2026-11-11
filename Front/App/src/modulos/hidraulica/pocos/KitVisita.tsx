// Kit de visita: os modelos (proposta, tabela de preços, contrato, autorização de metragem adicional), cada um em branco
// ou preenchido com o que o vendedor já sabe. Preenchido, a pré-visualização marca de amarelo o que falta e em amarelo
// forte o campo que está sendo editado; o que ficar vazio sai como linha para preencher à mão. Os valores valem para
// todos os modelos da visita. Marca os que vai levar e imprime todos de uma vez (ou só o que está vendo).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Flex, Input, InputNumber, Row, Segmented, Select, Space, Tag, Typography, message } from 'antd';
import { ClearOutlined, PrinterOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ConfigProcesso, ITENS_PRONTOS, processoApi, urlArquivo } from './obrasApi';
import { CAMPOS_DO_MODELO, htmlEmBranco, impressaoSeparada, juntarPaginas, ModeloBranco, MODELOS_BRANCO, PADRAO_PROPOSTA, semImpressao } from './documentosEmBranco';
import { campoDe, camposVazios, destaquePrevia, ValoresKit } from './camposKit';
import { navPocos } from './navPocos';

const { Text } = Typography;
type Modo = 'BRANCO' | 'PREENCHIDA';

const imprimir = (html: string) => {
  const w = window.open('', '_blank');
  if (!w) { message.warning('O navegador bloqueou a janela: libere os pop-ups para este endereço.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

const rotuloDoCampo = (k: string) => {
  const m = /^qtd_(\d+)$/.exec(k);
  if (m) { const p = ITENS_PRONTOS[Number(m[1])]; return p ? `${p.rotulo} (${p.item.unidade})` : k; }
  return campoDe(k)?.rotulo || k;
};

const idDoCampo = (chave: string) => `kit-campo-${chave}`;

/** Leva o cursor ao campo do formulário (clique na folha da pré-visualização). */
const focarCampo = (chave: string) => {
  const el = document.getElementById(idDoCampo(chave));
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.focus({ preventScroll: true });
  return true;
};

/** O campo do formulário conforme o tipo; o foco diz qual destacar na pré-visualização. */
const EntradaCampo: React.FC<{ chave: string; valor: ValoresKit[string]; onChange: (v: ValoresKit[string]) => void; onFoco: (k: string | null) => void }> = ({ chave, valor, onChange, onFoco }) => {
  const c = campoDe(chave)!;
  const foco = { id: idDoCampo(chave), onFocus: () => onFoco(chave), onBlur: () => onFoco(null) };
  if (c.tipo === 'longo') return <Input.TextArea size="small" autoSize={{ minRows: 2, maxRows: 5 }} value={(valor as string) || ''} onChange={e => onChange(e.target.value)} {...foco} />;
  if (c.tipo === 'escolha') {
    return <Select size="small" allowClear style={{ width: '100%' }} value={(valor as string) || undefined} onChange={v => onChange(v ?? null)} options={c.opcoes?.map(o => ({ value: o.valor, label: o.rotulo }))} {...foco} />;
  }
  if (c.tipo === 'numero' || c.tipo === 'moeda') {
    return <InputNumber size="small" min={0} style={{ width: '100%' }} value={valor === null || valor === undefined || valor === '' ? null : Number(valor)}
      prefix={c.tipo === 'moeda' ? 'R$' : undefined} suffix={c.sufixo} decimalSeparator="," onChange={v => onChange(v === null ? null : Number(v))} {...foco} />;
  }
  if (c.tipo === 'data' || c.tipo === 'extenso_data') return <Input size="small" type="date" value={(valor as string) || ''} onChange={e => onChange(e.target.value || null)} {...foco} />;
  return <Input size="small" allowClear placeholder={c.dica} value={(valor as string) || ''} onChange={e => onChange(e.target.value)} {...foco} />;
};

const KitVisita: React.FC = () => {
  const [cfg, setCfg] = useState<ConfigProcesso | null>(null);
  const [vendo, setVendo] = useState<ModeloBranco>('PROPOSTA');
  const [marcados, setMarcados] = useState<ModeloBranco[]>(['PROPOSTA', 'TABELA']);
  const [modos, setModos] = useState<Record<ModeloBranco, Modo>>({ PROPOSTA: 'BRANCO', TABELA: 'BRANCO', CONTRATO: 'BRANCO', AUTORIZACAO: 'BRANCO', FICHA: 'BRANCO' });
  const [valores, setValores] = useState<ValoresKit>({});
  const [ativo, setAtivo] = useState<string | null>(null);
  const quadro = useRef<HTMLIFrameElement>(null);
  useEffect(() => { processoApi.config().then(setCfg).catch(e => message.error(e.message)); }, []);

  const logo = cfg ? urlArquivo(cfg.logo) : null;
  const html = (id: ModeloBranco) => htmlEmBranco(id, cfg!, logo, modos[id] === 'PREENCHIDA' ? valores : null);
  const preenchida = modos[vendo] === 'PREENCHIDA';
  const previa = useMemo(() => (cfg ? destaquePrevia(semImpressao(htmlEmBranco(vendo, cfg, logo, preenchida ? valores : null)), preenchida ? ativo : null, preenchida) : ''),
    [cfg, vendo, logo, preenchida, valores, ativo]);

  // escreve a página no quadro sem recarregar o endereço; segura a rolagem e leva até o campo em edição
  useEffect(() => {
    const doc = quadro.current?.contentDocument;
    if (!doc || !previa) return;
    const rolagem = doc.scrollingElement?.scrollTop || 0;
    doc.open(); doc.write(previa); doc.close();
    const alvo = ativo && preenchida ? doc.querySelector(`[data-campo="${ativo}"]`) : null;
    if (alvo) alvo.scrollIntoView({ block: 'center' });
    else if (doc.scrollingElement) doc.scrollingElement.scrollTop = rolagem;
    if (!preenchida) return;
    // clicar num campo da folha (amarelo ou já preenchido) leva o cursor direto para ele no formulário
    const aoClicar = (ev: MouseEvent) => {
      const chave = (ev.target as Element | null)?.closest?.('[data-campo]')?.getAttribute('data-campo');
      if (chave && !focarCampo(chave)) message.info('Este campo não está no formulário deste modelo.');
    };
    doc.addEventListener('click', aoClicar);
    return () => doc.removeEventListener('click', aoClicar);
  }, [previa]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return <Card loading />;

  const marcar = (id: ModeloBranco, sim: boolean) => setMarcados(m => (sim ? MODELOS_BRANCO.map(x => x.id).filter(x => x === id || m.includes(x)) : m.filter(x => x !== id)));
  const mudar = (k: string, v: ValoresKit[string]) => setValores(a => ({ ...a, [k]: v }));
  const chavesDe = (id: ModeloBranco) => CAMPOS_DO_MODELO[id].flatMap(g => g.chaves);
  const titulo = MODELOS_BRANCO.find(m => m.id === vendo)?.titulo;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {!cfg.configurado && (
        <Alert type="info" showIcon message="Os modelos saem com o logo e os dados da empresa da configuração."
          action={<Button size="small" icon={<SettingOutlined />} onClick={() => navPocos.ir({ aba: 'atendimento', subvista: 'CONFIG' })}>Preencher</Button>} />
      )}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={preenchida ? 5 : 7}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text type="secondary">Marque o que vai levar. Cada modelo sai em branco ou preenchido com o que você já sabe; o que ficar vazio sai em linha para preencher à mão.</Text>
            {MODELOS_BRANCO.map(m => {
              const faltam = modos[m.id] === 'PREENCHIDA' ? camposVazios(chavesDe(m.id), valores) : 0;
              return (
                <Card key={m.id} size="small" hoverable onClick={() => setVendo(m.id)} styles={{ body: { padding: 10 } }}
                  style={{ borderColor: vendo === m.id ? '#1677ff' : undefined, background: vendo === m.id ? '#f0f7ff' : undefined }}>
                  <Flex gap={10} align="start">
                    <Checkbox checked={marcados.includes(m.id)} onClick={e => e.stopPropagation()} onChange={e => marcar(m.id, e.target.checked)} />
                    <div style={{ flex: 1 }}>
                      <Flex justify="space-between" align="center" gap={6}>
                        <Text strong>{m.titulo}</Text>
                        {modos[m.id] === 'PREENCHIDA' && (faltam ? <Tag color="gold" style={{ margin: 0 }}>faltam {faltam}</Tag> : <Tag color="green" style={{ margin: 0 }}>completo</Tag>)}
                      </Flex>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{m.descricao}</Text></div>
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, display: m.soBranco ? 'none' : undefined }}>
                        <Segmented size="small" block value={modos[m.id]} options={[{ value: 'BRANCO', label: 'Em branco' }, { value: 'PREENCHIDA', label: 'Preenchida' }]}
                          onChange={v => { setModos(a => ({ ...a, [m.id]: v as Modo })); setVendo(m.id); }} />
                      </div>
                    </div>
                  </Flex>
                </Card>
              );
            })}
            <Button type="primary" block icon={<PrinterOutlined />} disabled={!marcados.length} onClick={() => {
              const juntos = marcados.filter(id => !impressaoSeparada(id)), aParte = marcados.filter(impressaoSeparada);
              if (juntos.length) imprimir(juntarPaginas(juntos.map(html)));
              aParte.forEach(id => imprimir(html(id)));
              if (juntos.length && aParte.length) message.info('A ficha de campo sai numa impressão separada (tem o visual do relatório técnico).');
            }}>
              Imprimir os marcados ({marcados.length})
            </Button>
          </Space>
        </Col>
        <Col xs={24} lg={preenchida ? 12 : 17}>
          <Card size="small"
            title={<Space wrap>{`Pré-visualização (A4) · ${titulo}`}{preenchida && <Tag color="gold" style={{ margin: 0 }}>amarelo = falta · clique para preencher</Tag>}</Space>}
            extra={<Button icon={<PrinterOutlined />} onClick={() => imprimir(html(vendo))}>Imprimir este</Button>}
            styles={{ body: { padding: 8, background: '#e5e7eb' } }}>
            <iframe ref={quadro} title="Pré-visualização do modelo"
              style={{ width: '100%', maxWidth: 860, height: '80vh', display: 'block', margin: '0 auto', border: '1px solid #d1d5db', background: '#e5e7eb' }} />
          </Card>
        </Col>
        {preenchida && (
          <Col xs={24} lg={7}>
              <Card size="small" title={`Preencher · ${titulo}`} style={{ position: 'sticky', top: 8 }}
                styles={{ body: { maxHeight: 'calc(80vh + 40px)', overflowY: 'auto' } }}
                extra={<Space size={4}>
                  {vendo === 'PROPOSTA' && (
                    <Button size="small" icon={<ThunderboltOutlined />} onClick={() => setValores(a => ({ ...a, ...PADRAO_PROPOSTA }))}>Padrão 60 m · R$ 18.000</Button>
                  )}
                  <Button size="small" icon={<ClearOutlined />} onClick={() => setValores(a => ({ ...a, ...Object.fromEntries(chavesDe(vendo).map(k => [k, null])) }))}>Limpar</Button>
                </Space>}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  {CAMPOS_DO_MODELO[vendo].map(g => (
                    <div key={g.grupo}>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.grupo}</Text>
                      <Row gutter={[8, 6]} style={{ marginTop: 2 }}>
                        {g.chaves.map(k => {
                          const c = campoDe(k)!;
                          const largo = c.tipo === 'longo' || (c.tipo === 'texto' && c.largura === 0) || c.largura >= 60;
                          return (
                            <Col key={k} span={largo ? 24 : 12}>
                              <Text style={{ fontSize: 12, background: ativo === k ? '#ffca28' : undefined, padding: '0 2px', borderRadius: 2 }}>{rotuloDoCampo(k)}</Text>
                              <EntradaCampo chave={k} valor={valores[k]} onChange={v => mudar(k, v)} onFoco={setAtivo} />
                            </Col>
                          );
                        })}
                      </Row>
                    </div>
                  ))}
                  <Text type="secondary" style={{ fontSize: 12 }}>O que você preenche vale para todos os modelos desta visita (o cliente da proposta já aparece no contrato).</Text>
                </Space>
              </Card>
          </Col>
        )}
      </Row>
    </Space>
  );
};

export default KitVisita;
