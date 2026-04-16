import './App.css'
import './forms.css'
import { BrowserRouter } from "react-router-dom";
import { UIProvider } from './context/UIContext';


import AppLayout from './AppLayout';

function App() {
  return (
     <UIProvider>
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  </UIProvider>
  );
}

export default App