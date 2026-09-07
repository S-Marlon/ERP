import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => res.json({ message: 'API ERP rodando!' }));

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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