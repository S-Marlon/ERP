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
app.listen(PORT, () => console.log(`200 Servidor ERP rodando na porta ${PORT}`));
