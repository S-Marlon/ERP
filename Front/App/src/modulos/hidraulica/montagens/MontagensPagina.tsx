// Módulo Hidráulica · Montagens: OS de montagem de mangueiras (em construção nesta etapa).
import React from 'react';
import { Empty, Typography } from 'antd';

const MontagensPagina: React.FC = () => (
  <div style={{ padding: 16 }}>
    <Typography.Title level={3} style={{ margin: 0 }}>Montagens de mangueiras</Typography.Title>
    <Empty style={{ marginTop: 40 }} description="OS de montagem: próxima etapa" />
  </div>
);

export default MontagensPagina;
