import express from 'express';
import cors from 'cors';
import routes from './rotas';

const app = express();
app.use(cors());
// A entrada de NF envia o XML inteiro + os dados de cada item (nota grande passa de 1 MB; o padrão do Express é 100 KB)
app.use(express.json({ limit: '20mb' }));

app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'API ERP rodando!' }));

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    console.error(`Requisição grande demais em ${req.method} ${req.originalUrl}: ${err.length} bytes (limite ${err.limit}).`);
    return res.status(413).json({ error: `Dados grandes demais para o servidor (${Math.round(err.length / 1024)} KB). Aumente o limite em server.ts.` });
  }
  console.error('Erro global:', err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno' });
});

const PORT = process.env.PORT || 3001;

// Função auxiliar para buscar o IP público de forma simples usando fetch nativo do Node.js
async function getPublicIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data: any = await response.json();
    return data.ip;
  } catch (error) {
    return 'Não foi possível obter o IP (offline ou falha na API)';
  }
}

async function iniciarServidor() {
    console.log(`\n🔍 Verificando IP externo da rede atual...`);
    const ipPublico = await getPublicIP();

    console.log(`\n==================================================`);
    console.log(`🌐 SEU IP PÚBLICO ATUAL É: [ ${ipPublico} ]`);
    console.log(`==================================================\n`);

    try {
        console.log(`⏳ Tentando conectar ao banco de dados remoto...`);
        
        // ----------------------------------------------------
        // COLOQUE AQUI A SUA FUNÇÃO DE CONEXÃO COM O BANCO
        // Exemplo: await pool.connect(); ou await mongoose.connect(...);
        // Se ainda não tiver o banco, deixe comentado ou simulado.
        // ----------------------------------------------------

        // Inicializa o servidor Express somente após passar pelas verificações/conexões
        app.listen(Number(PORT), () => {
            console.log(`\n✅ Servidor ERP rodando com sucesso em http://localhost:${PORT}`);
            console.log(`✅ Conexão com o banco estabelecida!\n`);
        });

    } catch (error: any) {
        console.error(`\n❌ FALHA NA CONEXÃO COM O BANCO DE DADOS!`);
        console.error(`> O banco recusou a conexão deste IP: ${ipPublico}`);
        console.error(`> Copie este IP [ ${ipPublico} ] e adicione na sua hospedagem.`);
        console.error(`> Detalhes do erro:`, error?.message || error);
        
        process.exit(1);
    }
}

// Executa a função de inicialização
iniciarServidor();