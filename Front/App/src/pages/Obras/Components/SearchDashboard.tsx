import React, { useState, ChangeEvent, useMemo, useEffect } from 'react';
import Typography from '../../../components/ui/Typography';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import './SearchDashboard.css';
import Card from '../../../components/ui/Card';

// ----------------- TIPOS E DADOS MOCKADOS -----------------

// Tipos para os resultados de busca
interface ResultadoBusca {
  id: string;
  idr: string;
  tipo: 'Cliente' | 'Contrato' | 'Poco';
  titulo: string;
  subDetalhe: string;
}

// Dados mockados para simular a base de dados (mantido como fallback)
const DADOS_MOCK: ResultadoBusca[] = [
  { id: 'cli-001',idr: 'cli-001', tipo: 'Cliente', titulo: 'João da Silva (PF)', subDetalhe: '000.111.222-33' },
  { id: 'cli-002',idr: 'cli-001', tipo: 'Cliente', titulo: 'Empresa Alpha Ltda (PJ)', subDetalhe: '11.222.333/0001-44' },
  { id: 'cont-005',idr: 'cli-001', tipo: 'Contrato', titulo: 'Poço Novo - Fazenda Esperança', subDetalhe: 'Cliente: João da Silva' },
  { id: 'cont-008',idr: 'cli-001', tipo: 'Contrato', titulo: 'Aprofundamento - Sítio da Pedra', subDetalhe: 'Cliente: Empresa Alpha' },
  { id: 'poco-101',idr: 'cli-001', tipo: 'Poco', titulo: 'Poço Principal - Fazenda Esperança', subDetalhe: 'Vazão: 5.8 m³/h' },
  { id: 'poco-102',idr: 'cli-001', tipo: 'Poco', titulo: 'Poço Secundário - Construtora Beta', subDetalhe: 'Vazão: 0 m³/h (Pendente)' },
];

// Tipos para o estado de filtros
type FiltroTipo = 'Todos' | 'Cliente' | 'Contrato' | 'Poço';

// ----------------- FUNÇÕES AUXILIARES -----------------

/**
 * Mapeia os dados brutos de uma tabela para o formato ResultadoBusca.
 * ATENÇÃO: Os campos (r.nome, r.cpf, r.nome_contrato, r.vazao, etc.) devem
 * ser ajustados para corresponder aos nomes reais das colunas em suas tabelas MySQL.
 * * @param rows Dados brutos do banco (sua tabela).
 * @param type O tipo a ser atribuído (Cliente, Contrato, Poco).
 * @returns Array de ResultadoBusca.
 */
const mapToResultadoBusca = (rows: any[], type: ResultadoBusca['tipo']): ResultadoBusca[] => {
     return rows.map((r, idx) => {
        let idr = '';
        let titulo = '';
        let subDetalhe = ''; // Este campo será o CPF, CÓDIGO, VAZÃO, etc.

        // Lógica de mapeamento baseada no tipo de dado
        if (type === 'Cliente') {
            // Mapeamento para CLIENTE
            idr = String(r.cpf_cnpj ?? r.cnpj ?? 'CPF/CNPJ não disponível')
            titulo = String(r.nome ?? r.razao_social ?? `Cliente ${idx + 1}`);
            // SUBDETALHE: Usa o CPF ou o CNPJ
            subDetalhe = String(r.fk_endereco_principal ?? 'CPF/CNPJ não disponível');
        } else if (type === 'Contrato') {
            // Mapeamento para CONTRATO
            // Ex: r.numero_contrato ou r.titulo
            idr = String(r.codigo_contrato ?? 'CPF/CNPJ não disponível')

            titulo = String(r.fk_cliente ?? `Contrato ${idx + 1}`); 
            // SUBDETALHE: Usa o código do contrato (ou o nome/ID do cliente relacionado)
            subDetalhe = String(r.valor_total ?? 'Detalhe do Contrato não disponível');
        } else if (type === 'Poco') {
            // Mapeamento para POÇO
            // Ex: r.nome_poco ou r.localizacao
            idr = String(r.fk_contrato ?? 'CPF/CNPJ não disponível')

            titulo = String(r.fk_cliente ?? `Poço ${idx + 1}`);
            // SUBDETALHE: Usa a vazão e/ou o status
            subDetalhe = String(r.profundidade_atual ?? 'Vazão/Status não disponível');
        }

        return {
            // ID: Geralmente é a chave primária da tabela
            id: String(r.id ?? r._id ?? `err-${type}-${idx}`),
            idr: idr,
            tipo: type,
            titulo: titulo,
            subDetalhe: subDetalhe, // O campo dinâmico que você queria
        };
    });
};

// ----------------- COMPONENTE -----------------

const SearchDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'Todos' | 'Cliente' | 'Contrato' | 'Poço'>('Todos');

  // Estado para resultados vindos do servidor
  const [serverResults, setServerResults] = useState<ResultadoBusca[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const urls = [
      { url: 'http://localhost:3001/clientes', tipo: 'Cliente' as const },
      { url: 'http://localhost:3001/contratos', tipo: 'Contrato' as const },
      { url: 'http://localhost:3001/pocos', tipo: 'Poco' as const },
    ];

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      let fetchError: string | null = null;

      try {
        // Usa Promise.all para buscar todos os dados em paralelo
        const responses = await Promise.all(
          urls.map(item => 
            fetch(item.url, { signal: controller.signal })
              .then(res => {
                if (!res.ok) throw new Error(`${item.tipo} - HTTP ${res.status}`);
                return res.json();
              })
              .then(json => {
                const rows = json.data ?? json; // Espera { data: rows } ou apenas o array
                return mapToResultadoBusca(rows, item.tipo); // Mapeia os dados
              })
              // Captura erros de cada fetch, mas continua com os outros
              .catch(err => {
                console.error(`Falha ao buscar ${item.tipo}:`, err);
                // Armazena a primeira mensagem de erro para exibir ao usuário
                if (!fetchError) fetchError = err.message; 
                return []; // Retorna array vazio para que Promise.all não falhe
              })
          )
        );

        // Junta todos os arrays de resultados
        const allResults = responses.flat();
        
        if (fetchError) {
             setError(`Alguns dados falharam ao carregar. Detalhe do erro: ${fetchError}`);
        } else if (allResults.length === 0) {
             // Só exibe esta mensagem se não houver erro anterior e a busca for vazia
             setError('Nenhum dado retornado de todas as rotas (clientes, contratos, poços).');
        } else {
             setError(null); // Limpa o erro se a busca foi bem sucedida
        }

        setServerResults(allResults);

      } catch (err: any) {
        // Este catch pega apenas erros de rede graves ou se o AbortController agiu
        if (err.name !== 'AbortError') setError(err.message || 'Erro de rede desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, []); // Array de dependência vazio para rodar apenas no mont

  // Define a fonte dos resultados: dados do servidor (se houver) ou mockados
  const sourceResults = serverResults !== null ? serverResults : DADOS_MOCK;

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value);
  const handleFilterChange = (tipo: 'Todos' | 'Cliente' | 'Contrato' | 'Poço') => setFilterType(tipo);

  const resultadosFiltrados = useMemo(() => {
    let resultados = sourceResults;
    if (filterType !== 'Todos') {
      // O tipo no estado é 'Poço', mas o tipo na interface é 'Poco'
      const tipoBusca = filterType === 'Poço' ? 'Poco' : filterType; 
      resultados = resultados.filter(item => item.tipo === tipoBusca);
    }
    if (searchTerm.trim() === '') return resultados;
    const term = searchTerm.toLowerCase();
    return resultados.filter(item =>
      item.titulo.toLowerCase().includes(term) ||
      item.subDetalhe.toLowerCase().includes(term)
    );
  }, [searchTerm, filterType, sourceResults]);

  const handleItemClick = (item: ResultadoBusca) => {
    // Implemente aqui a lógica de navegação real (e.g., usando useHistory/useNavigate)
    alert(`Navegando para: ${item.tipo} - ${item.titulo}`);
  };

  return (
    <Card variant="highlight" className="search-dashboard-container">
      <Typography variant="h1Alt" className="main-title">Busca Global</Typography>

      {/* Exibe erro ou loading */}
      {loading && <Typography variant="pMuted">Carregando resultados...</Typography>}
      {error && <Typography variant="pMuted" style={{ color: 'red' }}>Erro: {error}</Typography>}
      {/* Fim da exibição de erro/loading */}

      <div className="content-area">
        <div className="results-list">
          <div className="results-header">
            <Typography variant="h3">Resultados ({resultadosFiltrados.length})</Typography>
            <div>
              <Typography variant="strong" as="label">Filtrar Por:</Typography>
              {['Todos', 'Cliente', 'Contrato', 'Poço'].map((tipo) => (
                <Button
                  key={tipo}
                  // TypeScript: Forçamos o tipo para garantir que a comparação funcione
                  variant={filterType === tipo ? "primary" : "outline"}
                  style={{ marginLeft: 8 }}
                  onClick={() => handleFilterChange(tipo as FiltroTipo)}
                >
                  {tipo}
                </Button>
              ))}
            </div>
          </div>

          {resultadosFiltrados.length > 0 ? (
            resultadosFiltrados.map(item => (
              <div
                key={item.id}
                // Adiciona classe para estilização específica por tipo
                className={`result-item result-item-${item.tipo.toLowerCase()}`} 
                onClick={() => handleItemClick(item)}
              >
                <div className='innertable'>
                  <div className="flex-column item-column-type">
                    <Typography variant="strong" className="item-type">{item.tipo}</Typography>
                    <Typography variant="small" className="item-id">{item.idr}</Typography>
                  </div>
                  <div className="flex-column item-column-title">
                    <Typography variant="small" className="item-label">Nome</Typography>
                    <Typography variant="p" className="item-title">{item.titulo}</Typography>
                  </div>
                  <div className="flex-column item-column-detail">
                    <Typography variant="small" className="item-label">Detalhe Secundário</Typography>
                    <Typography variant="p" className="item-detail">{item.subDetalhe}</Typography>
                  </div>
                  <div className="flex-column item-column-status">
                    {/* Placeholder de Badge. A cor e o texto deveriam ser dinâmicos */}
                    <Badge color="warning">Em Andamento</Badge> 
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">
              <Typography variant="p">
                Nenhum resultado encontrado para <strong>"{searchTerm}"</strong> no filtro de <strong>{filterType}</strong>.
              </Typography>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SearchDashboard;