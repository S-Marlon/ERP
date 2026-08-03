import { BrowserRouter } from "react-router-dom";
import { UIProvider } from './context/UIContext';
import AppLayout from './AppLayout';

export default function App() {
  return (
    <UIProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </UIProvider>
  );
}