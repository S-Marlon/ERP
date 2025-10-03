// src/modules/Obras/ObrasModule.tsx
import React from 'react';
// import { Routes, Route } from 'react-router-dom';
import { ObrasLista } from './Components/ObrasLista';
import { ObraDetalhes } from './Components/ObraDetalhes';
import { ObraFormulario } from './Components/ObraFormulario';

import './ObrasModule.css';

/**
 * Módulo de Obras
 * Gerencia as rotas /obras, /obras/:id e /obras/novo
 */
export const ObrasModule: React.FC = () => {
  return (


    <ObraFormulario />

    // <div className='flex-row'>
    //   {/* <div><ObrasLista /></div> */}
    //   <div><ObraFormulario /></div>
    //   {/* <div>
    //    <ObraDetalhes />
    //   </div> */}
    // </div>


    // <Routes>
    //   {/* Rota para a Lista de Obras */}
    //   <Route path="/" element={<ObrasLista />} />
      
    //   {/* Rota para Novo Cadastro de Obra */}
    //   <Route path="/novo" element={<ObraFormulario />} />
      
    //   {/* Rota para Detalhes e Edição da Obra. :id é o parâmetro da URL */}
    //   <Route path=":id" element={<ObraDetalhes />} />
    //   <Route path=":id/editar" element={<ObraFormulario />} /> 
      
    //   {/* Opcional: Rota de fallback caso o módulo seja acessado de forma incorreta */}
    //   <Route path="*" element={<h2>Página de Obras não encontrada</h2>} />
    // </Routes>
  );
};