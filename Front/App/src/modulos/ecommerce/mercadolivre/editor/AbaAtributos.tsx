// Aba Atributos do editor: de onde vem cada atributo que o ML pede (cadastro, marca ou valor fixo) e o valor que
// sai em cada item. As mudanças vão para o rascunho.
import React, { useEffect, useMemo, useState } from 'react';
import { AutoComplete, Button, Card, Empty, InputNumber, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { AnuncioDetalhe, AtributoML, ItemDoAnuncio, ValorAtributo } from '../mercadoLivreApi';

const { Text } = Typography;

/** Valor fixo de um atributo, conforme o tipo do ML (grava ao sair do campo). */
const ValorFixo: React.FC<{ atributo: AtributoML; valor: Extract<ValorAtributo, { origem: 'fixo' }> | null; onMudar: (v: ValorAtributo | null) => void }> = ({ atributo, valor, onMudar }) => {
  const [texto, setTexto] = useState(valor?.valor || '');
  const [unidade, setUnidade] = useState(valor?.unidade || atributo.unidadePadrao || atributo.unidades[0] || null);
  useEffect(() => { setTexto(valor?.valor || ''); setUnidade(valor?.unidade || atributo.unidadePadrao || atributo.unidades[0] || null); }, [valor, atributo]);

  const confirmar = (t = texto, u = unidade) => {
    const limpo = String(t ?? '').trim();
    if (!limpo) { if (valor) onMudar(null); return; }
    const opcao = atributo.valores.find(v => v.nome.toLowerCase() === limpo.toLowerCase());
    if (limpo === valor?.valor && (u || null) === (valor?.unidade || null)) return;
    onMudar({ origem: 'fixo', valor: opcao?.nome || limpo, valorId: opcao?.id || null, unidade: atributo.tipo === 'number_unit' ? u : null });
  };

  if (atributo.tipo === 'number_unit') {
    return (
      <Space.Compact style={{ width: '100%' }}>
        <InputNumber style={{ width: '100%' }} value={texto === '' ? null : Number(texto)} onChange={v => setTexto(v === null ? '' : String(v))} onBlur={() => confirmar()} decimalSeparator="," />
        <Select style={{ width: 90 }} value={unidade} options={atributo.unidades.map(u => ({ value: u, label: u }))} onChange={u => { setUnidade(u); confirmar(texto, u); }} />
      </Space.Compact>
    );
  }
  if (atributo.tipo === 'number') {
    return <InputNumber style={{ width: '100%' }} value={texto === '' ? null : Number(texto)} onChange={v => setTexto(v === null ? '' : String(v))} onBlur={() => confirmar()} decimalSeparator="," />;
  }
  if (atributo.tipo === 'boolean') {
    const opcoes = atributo.valores.length ? atributo.valores : [{ id: '', nome: 'Sim' }, { id: '', nome: 'Não' }];
    return <Select style={{ width: '100%' }} value={texto || undefined} placeholder="Escolha" options={opcoes.map(o => ({ value: o.nome, label: o.nome }))} onChange={v => { setTexto(v); confirmar(v); }} />;
  }
  return (
    <AutoComplete
      style={{ width: '100%' }} value={texto} onChange={setTexto} onBlur={() => confirmar()} onSelect={(v: string) => { setTexto(v); confirmar(v); }}
      placeholder={atributo.valores.length ? 'Escolha ou digite' : 'Digite o valor'}
      options={atributo.valores.filter(v => !texto || v.nome.toLowerCase().includes(texto.toLowerCase())).slice(0, 50).map(v => ({ value: v.nome }))}
    />
  );
};

interface Props {
  salvo: AnuncioDetalhe;                    // como está no banco (para marcar o que mudou)
  det: AnuncioDetalhe;                      // com o rascunho aplicado
  onMudar: (idAtributo: string, valor: ValorAtributo | null) => void;
  comErro: Set<string>;
}

const AbaAtributos: React.FC<Props> = ({ salvo, det, onMudar, comErro }) => {
  const [todos, setTodos] = useState(false);
  const [fixoEmEdicao, setFixoEmEdicao] = useState<Set<string>>(new Set());

  const visiveis = useMemo(
    () => det.atributosCategoria.filter(a => todos || a.obrigatorio || a.permiteVariar || det.atributos[a.id] || fixoEmEdicao.has(a.id) || comErro.has(a.id)),
    [det, todos, fixoEmEdicao, comErro]
  );
  const mudou = (id: string) => JSON.stringify(salvo.atributos[id] ?? null) !== JSON.stringify(det.atributos[id] ?? null);

  const resumoValores = (a: AtributoML) => {
    if (mudou(a.id)) return <Text type="secondary" style={{ fontSize: 12 }}>Salve para ver os valores de cada item.</Text>;
    const valores = det.itens.map(i => i.valores[a.id]);
    const preenchidos = valores.filter(Boolean) as NonNullable<ItemDoAnuncio['valores'][string]>[];
    const faltam = valores.length - preenchidos.length;
    const distintos = [...new Set(preenchidos.map(v => `${v.valor}${v.unidade ? ` ${v.unidade}` : ''}`))];
    const foraDaLista = a.tipo === 'list' && a.valores.length > 0 && preenchidos.some(v => !v.valorId);
    return (
      <Space size={4} wrap>
        {distintos.length === 0 && <Text type={a.obrigatorio ? 'danger' : 'secondary'}>sem valor</Text>}
        {distintos.length === 1 && <Text>{distintos[0]}</Text>}
        {distintos.length > 1 && (
          <Tooltip title={distintos.slice(0, 30).join(' · ')}>
            <Text>{distintos.length} valores: {distintos.slice(0, 3).join(', ')}{distintos.length > 3 ? '…' : ''}</Text>
          </Tooltip>
        )}
        {det.eixos.includes(a.id) && <Tag color="blue">variação</Tag>}
        {faltam > 0 && distintos.length > 0 && <Tag color={a.obrigatorio ? 'red' : 'default'}>falta em {faltam}</Tag>}
        {foraDaLista && <Tooltip title="Algum valor não bate com a lista do ML: ele pode recusar ou trocar"><Tag color="orange">fora da lista</Tag></Tooltip>}
      </Space>
    );
  };

  if (!det.categoria) return <Card size="small"><Empty description="Escolha a categoria (aba Anúncio) para ver o que o ML pede." image={Empty.PRESENTED_IMAGE_SIMPLE} /></Card>;

  return (
    <Card
      size="small" title="Atributos do Mercado Livre"
      extra={<Space size={6}><Text type="secondary" style={{ fontSize: 12 }}>Mostrar todos ({det.atributosCategoria.length})</Text><Switch size="small" checked={todos} onChange={setTodos} /></Space>}
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Ligue cada atributo a um dado do cadastro (muda por item, ex.: Bitola) ou a um valor fixo para o anúncio todo.
        Mais atributos preenchidos = mais exposição na busca do ML.
      </Text>
      <Table<AtributoML>
        size="small" rowKey="id" dataSource={visiveis} pagination={false}
        rowClassName={a => (mudou(a.id) ? 'ml-linha-alterada' : comErro.has(a.id) ? 'ml-linha-erro' : '')}
        columns={[
          {
            title: 'Atributo', width: 220,
            render: (_, a) => (
              <div>
                <Text strong={a.obrigatorio}>{a.nome}</Text>
                <div>
                  <Space size={2} wrap>
                    {a.obrigatorio && <Tag color="red" style={{ fontSize: 11 }}>obrigatório</Tag>}
                    {a.permiteVariar && <Tooltip title="Pode ser o que diferencia as variações"><Tag color="blue" style={{ fontSize: 11 }}>pode variar</Tag></Tooltip>}
                    {mudou(a.id) && <Tag color="processing" style={{ fontSize: 11 }}>alterado</Tag>}
                  </Space>
                </div>
              </div>
            ),
          },
          {
            title: 'De onde vem', width: 320,
            render: (_, a) => {
              const v = det.atributos[a.id];
              const atual = v ? (v.origem === 'erp' ? `erp:${v.atributoId}` : v.origem) : fixoEmEdicao.has(a.id) ? 'fixo' : '';
              return (
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Select
                    style={{ width: '100%' }} value={atual} showSearch optionFilterProp="label" popupMatchSelectWidth={false}
                    onChange={(x: string) => {
                      setFixoEmEdicao(s => { const n = new Set(s); if (x === 'fixo') n.add(a.id); else n.delete(a.id); return n; });
                      if (x === '') onMudar(a.id, null);
                      else if (x === 'marca') onMudar(a.id, { origem: 'marca' });
                      else if (x === 'fixo') { if (v && v.origem !== 'fixo') onMudar(a.id, null); }
                      else onMudar(a.id, { origem: 'erp', atributoId: Number(x.slice(4)) });
                    }}
                    options={[
                      { value: '', label: '— sem valor —' },
                      { value: 'fixo', label: 'Valor fixo (o mesmo em todos)' },
                      { value: 'marca', label: 'Marca do item' },
                      ...(det.atributosErp.length ? [{ label: 'Do cadastro (por item)', options: det.atributosErp.map(e => ({ value: `erp:${e.id}`, label: e.nome })) }] : []),
                    ]}
                  />
                  {(v?.origem === 'fixo' || (!v && fixoEmEdicao.has(a.id))) && (
                    <ValorFixo atributo={a} valor={v?.origem === 'fixo' ? v : null} onMudar={x => onMudar(a.id, x)} />
                  )}
                </Space>
              );
            },
          },
          { title: 'Valor no anúncio', render: (_, a) => resumoValores(a) },
        ]}
      />
      {!todos && det.atributosCategoria.length > visiveis.length && (
        <Button type="link" size="small" onClick={() => setTodos(true)}>
          + {det.atributosCategoria.length - visiveis.length} atributos opcionais (ajudam na busca do ML)
        </Button>
      )}
    </Card>
  );
};

export default AbaAtributos;
