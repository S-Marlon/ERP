import React, { useState, useMemo, useEffect } from 'react';
import { Input, Select, Checkbox, Tooltip, Tag, Spin, Button, Modal, Form } from 'antd';
import Swal from 'sweetalert2';
import { 
  getAtributosGlobais, 
  getGruposAtributos, 
  getUnidadesMedida, 
  createAtributoGlobal, 
  updateAtributoGlobal, 
  deleteAtributoGlobal,
} from './GlobalAttributeManager.api';
import { 
  IAtributoGlobal, 
  GrupoVisualAPIResponse, 
  UnidadeAPIResponse, 
  TipoDadoAtributo, 
  EscopoComercial 
} from './GlobalAttributeManager.types';

export const GlobalAttributeManager: React.FC = () => {
  // --- INSTÂNCIAS DOS FORMULÁRIOS DO ANTD ---
  const [formGrupo] = Form.useForm();
  const [formAtributo] = Form.useForm();

  // --- ESTADOS DE DADOS DA API ---
  const [unidades, setUnidades] = useState<UnidadeAPIResponse[]>([]);
  const [grupos, setGrupos] = useState<GrupoVisualAPIResponse[]>([]);
  const [atributos, setAtributos] = useState<IAtributoGlobal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // --- ESTADOS DOS MODAIS (VISIBILIDADE) ---
  const [isModalGrupoOpen, setIsModalGrupoOpen] = useState(false);
  const [isModalAtributoOpen, setIsModalAtributoOpen] = useState(false);

  // --- FILTROS ---
  const [grupoAtivoFiltro, setGrupoAtivoFiltro] = useState<string>('todos');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // --- ESTADO DE EDIÇÃO INLINE ---
  const [idAtributoEmEdicao, setIdAtributoEmEdicao] = useState<string | null>(null);
  const [formEdicao, setFormEdicao] = useState<IAtributoGlobal | null>(null);

  // Assistente de Tipo para renderizar condicionalmente as opções da lista no modal
  const [tipoAtributoSelecionado, setTipoAtributoSelecionado] = useState<TipoDadoAtributo>('texto');
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>('');

  // --- CARGA INICIAL DOS DADOS ---
  const carregarDadosDoBanco = async () => {
    setLoading(true);
    try {
      const [listaUnidades, listaGrupos, listaAtributos] = await Promise.all([
        getUnidadesMedida(1),
        getGruposAtributos(1),
        getAtributosGlobais(1)
      ]);
      setUnidades(listaUnidades || []);
      setGrupos(listaGrupos || []);
      setAtributos(listaAtributos || []);
    } catch (err: any) {
      Swal.fire('Erro!', `Falha na sincronização de dados: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosDoBanco();
  }, []);

  // --- AUTO-GERADOR DE CÓDIGO SLUG (PARA O FORMULÁRIO DO MODAL) ---
  const handleNomeAttrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    const slug = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-_]/g, '')
      .replace(/[\s-]+/g, '_');
    
    formAtributo.setFieldsValue({ nome, codigo: slug });
  };

  // --- CRIAÇÃO DE GRUPO ---
  const handleCriarGrupo = async (valores: any) => {
    setIsSaving(true);
    try {
      const payload = { nome: valores.nome.trim(), descricao: valores.descricao?.trim() };
      // await createGrupoAtributo(payload, 1); 
      
      setGrupos(prev => [...prev, { id: String(Date.now()), ...payload }]);
      
      Swal.fire('Sucesso!', 'Grupo Semântico criado com sucesso.', 'success');
      formGrupo.resetFields();
      setIsModalGrupoOpen(false);
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', `Não foi possível salvar o grupo: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- CRIAÇÃO DE ATRIBUTO ---
  const handleCriarAtributo = async (valores: any) => {
    setIsSaving(true);
    try {
      const payload = {
        grupoId: valores.grupoId,
        nome: valores.nome.trim(),
        codigo: valores.codigo.trim(),
        tipo: valores.tipo,
        escopoPadrao: valores.escopoPadrao,
        unidadeId: valores.unidadeId || undefined,
        sufixo: valores.sufixo?.trim() || undefined,
        obrigatorioPadrao: !!valores.obrigatorioPadrao,
        pesquisavel: valores.pesquisavel !== false, // default true
        valoresSugeridos: valores.tipo === 'lista' ? valores.valoresSugeridos?.trim() : undefined
      };

      await createAtributoGlobal(payload, 1);
      Swal.fire('Salvo!', 'Atributo persistido no pool global!', 'success');
      
      formAtributo.resetFields();
      setTipoAtributoSelecionado('texto');
      setUnidadeSelecionada('');
      setIsModalAtributoOpen(false);
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- MOTOR DE FILTROS ---
  const atributosExibidos = useMemo(() => {
    let resultado = atributos;

    const filtroLimpo = String(grupoAtivoFiltro || '').trim();
    if (filtroLimpo && filtroLimpo !== 'todos') {
      resultado = resultado.filter(attr => String(attr.grupoId || '').trim() === filtroLimpo);
    }

    const buscaLimpa = buscaTexto.toLowerCase().trim();
    if (buscaLimpa) {
      resultado = resultado.filter(attr => 
        attr.nome.toLowerCase().includes(buscaLimpa) || 
        attr.codigo.toLowerCase().includes(buscaLimpa)
      );
    }

    return resultado;
  }, [atributos, grupoAtivoFiltro, buscaTexto]);

  // --- SALVAR EDIÇÃO INLINE ---
  const handleSalvarEdicao = async () => {
    if (!formEdicao || !formEdicao.id) return;

    const original = atributos.find(a => a.id === formEdicao.id);
    if (original && original.codigo !== formEdicao.codigo) {
      const resultadoSwal = await Swal.fire({
        title: 'Mudar Código Técnico?',
        text: 'Isso pode quebrar os relacionamentos e históricos de produtos existentes!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sim, alterar',
        cancelButtonText: 'Cancelar'
      });
      if (!resultadoSwal.isConfirmed) return;
    }

    try {
      await updateAtributoGlobal(formEdicao.id, formEdicao, 1);
      Swal.fire('Atualizado!', 'Atributo updated com sucesso.', 'success');
      setIdAtributoEmEdicao(null);
      setFormEdicao(null);
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro!', err.message, 'error');
    }
  };

  // --- INICIAR EDIÇÃO ---
  const handleIniciarEdicao = (attr: IAtributoGlobal) => {
    setIdAtributoEmEdicao(attr.id);
    setFormEdicao({ ...attr });
  };

  // --- EXCLUSÃO DE ATRIBUTO ---
  const handleDeletarAtributo = async (idAtributo: string) => {
    const confirmacao = await Swal.fire({
      title: 'Remover Atributo?',
      text: "Esta ação não pode ser desfeita no Dicionário PIM!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacao.isConfirmed) return;

    try {
      await deleteAtributoGlobal(idAtributo, 1);
      Swal.fire('Deletado!', 'O atributo foi removido.', 'success');
      carregarDadosDoBanco();
    } catch (err: any) {
      Swal.fire('Erro de Integridade', err.message, 'error');
    }
  };

  const handleDeletarGrupo = (id: string) => {
    const temVinculo = atributos.some(a => String(a.grupoId || '').trim() === String(id).trim());
    if (temVinculo) {
      Swal.fire('Bloqueado', 'Não é possível deletar grupos que possuem atributos vinculados.', 'error');
      return;
    }
    setGrupos(grupos.filter(g => String(g.id).trim() !== String(id).trim()));
    if (String(grupoAtivoFiltro).trim() === String(id).trim()) setGrupoAtivoFiltro('todos');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '16px' }}>
        <Spin size="large" />
        <h3 style={{ fontFamily: 'system-ui', color: '#454f5b' }}>Sincronizando Dicionário PIM com o Banco de Dados...</h3>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      
      {/* HEADER DA TELA */}
      <div style={{ marginBottom: '24px', borderBottom: '1px solid #e1e4e8', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: '#111213' }}>🌐 PIM - Dicionário de Atributos Globais</h2>
          <p style={{ margin: '4px 0 0 0', color: '#637381', fontSize: '14px' }}>
            Gerencie os esquemas de dados técnicos, escopos comerciais e taxonomia global do catálogo.
          </p>
        </div>
        
        {/* BOTÕES DE DISPARO DOS MODAIS */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button type="default" onClick={() => setIsModalGrupoOpen(true)} style={{ borderColor: '#212b36', color: '#212b36', fontWeight: 600 }}>
            📁 Criar Grupo Semântico
          </Button>
          <Button type="primary" onClick={() => setIsModalAtributoOpen(true)} style={{ background: '#0050b3', fontWeight: 600 }}>
            🧬 Novo Atributo Global
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        
        {/* COLUNA ESQUERDA: NAVEGAÇÃO DE GRUPO */}
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e1e4e8', height: 'fit-content' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: '#637381', letterSpacing: '0.5px' }}>
            Filtro por Grupos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div onClick={() => setGrupoAtivoFiltro('todos')} style={{ padding: '8px 12px', background: grupoAtivoFiltro === 'todos' ? '#f0f7ff' : '#f8fafc', border: '1px solid', borderColor: grupoAtivoFiltro === 'todos' ? '#0050b3' : '#e2e8f0', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: grupoAtivoFiltro === 'todos' ? 700 : 500 }}>🌟 Todos</span>
              <Tag color="blue">{atributos.length}</Tag>
            </div>

            {grupos.map(g => {
              const qtd = atributos.filter(a => String(a.grupoId || '').trim() === String(g.id).trim()).length;
              const isSelected = String(grupoAtivoFiltro).trim() === String(g.id).trim();
              return (
                <div key={g.id} onClick={() => setGrupoAtivoFiltro(String(g.id))} style={{ padding: '8px 12px', background: isSelected ? '#f0f7ff' : '#fff', border: '1px solid', borderColor: isSelected ? '#0050b3' : '#e1e4e8', borderRadius: '4px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 600 }}>{g.nome}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Tag>{qtd}</Tag>
                      <button onClick={(e) => { e.stopPropagation(); handleDeletarGrupo(g.id); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUNA DIREITA: GRID DA TABELA + BUSCA TEXTO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <Input 
            size="large"
            placeholder="🔍 Filtrar atributos por nome ou código técnico em tempo real..." 
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
            allowClear
          />

          {/* TABELA PRINCIPAL */}
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e1e4e8', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f4f6f8', color: '#454f5b' }}>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e1e4e8' }}>Nome / Código</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e1e4e8' }}>Grupo</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e1e4e8' }}>Escopo</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e1e4e8' }}>Tipo / Unid</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e1e4e8' }}>Regras & Indexação</th>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e1e4e8', width: '100px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {atributosExibidos.map(attr => {
                  const isEditing = idAtributoEmEdicao === attr.id;
                  const grupo = grupos.find(g => String(g.id).trim() === String(attr.grupoId || '').trim());
                  const unidade = unidades.find(u => String(u.id).trim() === String(attr.unidadeId || '').trim());
                  const escopoColors: Record<string, string> = { dna: 'gold', grade: 'green', ficha: 'blue' };

                  if (isEditing && formEdicao) {
                    return (
                      <tr key={attr.id} style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
                        <td style={{ padding: '8px' }}>
                          <Input size="small" value={formEdicao.nome} onChange={e => setFormEdicao({...formEdicao, nome: e.target.value})} style={{ marginBottom: '4px', fontWeight: 'bold' }} />
                          <Input size="small" value={formEdicao.codigo} onChange={e => setFormEdicao({...formEdicao, codigo: e.target.value})} style={{ fontSize: '11px', fontFamily: 'monospace' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <Select size="small" value={formEdicao.grupoId} onChange={val => setFormEdicao({...formEdicao, grupoId: val})} style={{ width: '100%' }}>
                            {grupos.map(g => <Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>)}
                          </Select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <Select size="small" value={formEdicao.escopoPadrao} onChange={(val: any) => setFormEdicao({...formEdicao, escopoPadrao: val})} style={{ width: '100%' }}>
                            <Select.Option value="ficha">FICHA</Select.Option>
                            <Select.Option value="grade">GRADE</Select.Option>
                            <Select.Option value="dna">DNA</Select.Option>
                          </Select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <Select size="small" value={formEdicao.tipo} onChange={(val: any) => setFormEdicao({...formEdicao, tipo: val})} style={{ width: '100%', marginBottom: '4px' }}>
                            <Select.Option value="texto">texto</Select.Option>
                            <Select.Option value="numero">numero</Select.Option>
                            <Select.Option value="decimal">decimal</Select.Option>
                            <Select.Option value="boolean">boolean</Select.Option>
                            <Select.Option value="lista">lista</Select.Option>
                          </Select>
                          <Input size="small" placeholder="Sufixo" value={formEdicao.sufixo || ''} disabled={!!formEdicao.unidadeId} onChange={e => setFormEdicao({...formEdicao, sufixo: e.target.value || undefined})} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          {/* Bug fixado: lodrigatorioPadrao -> obrigatorioPadrao */}
                          <Checkbox checked={formEdicao.obrigatorioPadrao} onChange={e => setFormEdicao({...formEdicao, obrigatorioPadrao: e.target.checked})}>Obrigatorio</Checkbox>
                          <Checkbox checked={formEdicao.pesquisavel} onChange={e => setFormEdicao({...formEdicao, pesquisavel: e.target.checked})}>Pesquisável</Checkbox>
                          {formEdicao.tipo === 'lista' && (
                            <Input size="small" placeholder="Opções" value={formEdicao.valoresSugeridos || ''} onChange={e => setFormEdicao({...formEdicao, valoresSugeridos: e.target.value})} style={{ marginTop: '4px' }} />
                          )}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <Button size="small" type="primary" onClick={handleSalvarEdicao} style={{ marginRight: '4px', background: '#16a34a' }}>💾</Button>
                          <Button size="small" onClick={() => { setIdAtributoEmEdicao(null); setFormEdicao(null); }}>✕</Button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={attr.id} style={{ borderBottom: '1px solid #f4f6f8' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#212b36' }}>{attr.nome}</div>
                        <div style={{ fontSize: '11px', color: '#919eab', fontFamily: 'monospace' }}>{attr.codigo}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span>{grupo?.nome || 'Sem Grupo'}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Tag color={escopoColors[attr.escopoPadrao] || 'default'}>{attr.escopoPadrao?.toUpperCase()}</Tag>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <code>{attr.tipo}</code>
                        {unidade && <span style={{ marginLeft: '6px', color: '#0050b3', fontWeight: 'bold' }}>({unidade.simbolo})</span>}
                        {attr.sufixo && <Tag color="warning" style={{ marginLeft: '6px' }}>{attr.sufixo}</Tag>}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {attr.valoresSugeridos ? <span style={{ color: '#16a34a' }}>Opções: {attr.valoresSugeridos}</span> : <span style={{ color: '#919eab', fontStyle: 'italic', fontSize: '11px' }}>Livre</span>}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {attr.obrigatorioPadrao && <Tag color="error">OBRIGATÓRIO</Tag>}
                            <Tag color={attr.pesquisavel ? 'processing' : 'default'}>{attr.pesquisavel ? '🔍 BUSCA' : '🚫 IGNORAR'}</Tag>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <Tooltip title="Editar"><Button type="text" onClick={() => handleIniciarEdicao(attr)}>✏️</Button></Tooltip>
                        <Tooltip title="Excluir"><Button type="text" danger onClick={() => attr.id && handleDeletarAtributo(attr.id)}>🗑️</Button></Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================= MODAL: CRIAR GRUPO SEMÂNTICO ================= */}
      <Modal
        title="➕ Criar Grupo Semântico"
        open={isModalGrupoOpen}
        onCancel={() => { formGrupo.resetFields(); setIsModalGrupoOpen(false); }}
        footer={null}
        destroyOnClose
      >
        <Form form={formGrupo} layout="vertical" onFinish={handleCriarGrupo} style={{ marginTop: '16px' }}>
          <Form.Item name="nome" label="Nome do Grupo" rules={[{ required: true, message: 'Insira o nome do grupo!' }]}>
            <Input placeholder="Ex: Especificações Elétricas" />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição">
            <Input placeholder="Ex: Agrupador de voltagem, amperagem e carga" />
          </Form.Item>
          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0, marginTop: '24px' }}>
            <Button onClick={() => setIsModalGrupoOpen(false)} style={{ marginRight: '8px' }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={isSaving} style={{ background: '#212b36', borderColor: '#212b36' }}>
              Salvar Grupo
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* ================= MODAL: NOVO ATRIBUTO ESTRUTURAL ================= */}
      <Modal
        title="🧬 Novo Atributo Estrutural (Pool Global)"
        open={isModalAtributoOpen}
        onCancel={() => { formAtributo.resetFields(); setIsModalAtributoOpen(false); setTipoAtributoSelecionado('texto'); setUnidadeSelecionada(''); }}
        footer={null}
        width={650}
        destroyOnClose
      >
        <Form 
          form={formAtributo} 
          layout="vertical" 
          onFinish={handleCriarAtributo} 
          initialValues={{ tipo: 'texto', escopoPadrao: 'ficha', pesquisavel: true }}
          style={{ marginTop: '16px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item name="grupoId" label="Grupo Vinculado" rules={[{ required: true, message: 'Selecione o grupo!' }]}>
              <Select placeholder="Selecione o Grupo">
                {grupos.map(g => <Select.Option key={g.id} value={g.id}>{g.nome}</Select.Option>)}
              </Select>
            </Form.Item>

            <Form.Item name="nome" label="Nome do Atributo" rules={[{ required: true, message: 'Insira o nome!' }]}>
              <Input placeholder="Ex: Diâmetro do Eixo" onChange={handleNomeAttrChange} />
            </Form.Item>

            <Form.Item name="codigo" label="Código Técnico (DB Key)" rules={[{ required: true, message: 'Insira o código técnico!' }]}>
              <Input placeholder="diametro_eixo" style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }} />
            </Form.Item>

            <Form.Item name="escopoPadrao" label="Escopo Comercial">
              <Select>
                <Select.Option value="ficha">Ficha (Especificação/Filtro)</Select.Option>
                <Select.Option value="grade">Grade (Gera Variante Física)</Select.Option>
                <Select.Option value="dna">DNA (Regra de Identidade SKU)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="tipo" label="Tipo de Dado">
              <Select onChange={(val: TipoDadoAtributo) => setTipoAtributoSelecionado(val)}>
                <Select.Option value="texto">Texto Livre</Select.Option>
                <Select.Option value="numero">Inteiro Numérico</Select.Option>
                <Select.Option value="decimal">Decimal</Select.Option>
                <Select.Option value="boolean">Booleano</Select.Option>
                <Select.Option value="lista">Lista de Opções</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="unidadeId" label="Unidade de Medida (Global)">
              <Select placeholder="Nenhuma" allowClear onChange={(val) => setUnidadeSelecionada(val)}>
                {unidades.map(u => <Select.Option key={u.id} value={u.id}>{u.nome} ({u.simbolo})</Select.Option>)}
              </Select>
            </Form.Item>
          </div>

          <Form.Item name="sufixo" label="⚡ Sufixo Direto / Rápido (Desabilitado se houver Unidade Global)">
            <Input placeholder="Ex: HP, RPM, BAR" disabled={!!unidadeSelecionada} style={{ borderColor: '#b25e00' }} />
          </Form.Item>

          {/* RENDERIZAÇÃO CONDICIONAL BASEADA NO TIPO DE DADO */}
          {tipoAtributoSelecionado === 'lista' && (
            <Form.Item name="valoresSugeridos" label="Opções da Lista (Separadas por vírgula)" rules={[{ required: true, message: 'Insira ao menos uma opção!' }]}>
              <Input placeholder="Ex: 10mm, 20mm, 30mm" style={{ borderColor: '#0050b3' }} />
            </Form.Item>
          )}

          <div style={{ display: 'flex', gap: '24px', margin: '8px 0 24px 0' }}>
            <Form.Item name="obrigatorioPadrao" valuePropName="checked" noStyle>
              <Checkbox>Tornar obrigatório por padrão</Checkbox>
            </Form.Item>
            <Form.Item name="pesquisavel" valuePropName="checked" noStyle>
              <Checkbox>Indexar na Busca Ativa do E-commerce/ERP 🔍</Checkbox>
            </Form.Item>
          </div>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 0 }}>
            <Button onClick={() => setIsModalAtributoOpen(false)} style={{ marginRight: '8px' }}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={isSaving} style={{ background: '#0050b3' }}>
              + Criar Atributo Global
            </Button>
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};