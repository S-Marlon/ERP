// CSS-in-JS (CSS Puro)
export const styles: { [key: string]: React.CSSProperties } = {

  header: {
    borderBottom: '1px solid #a0a0a0',
    paddingBottom: '5px',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    color: '#111827',
    fontWeight: 700
  },
  sku: {
    margin: 0,
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '99px',
    fontSize: '10px',
    fontWeight: 700
  },
  btnClose: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#9ca3af'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
  },
  section: {
    marginBottom: '10px'
  },
  sectionTitle: {
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: '10px',
    fontWeight: 600
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: '#4b5563',
  },
  label: {
    fontSize: '12px',
    color: '#4b5563',
    fontWeight: 500
  },
  // input: {
  //   padding: '8px 12px',
  //   borderRadius: '6px',
  //   border: '1px solid #d1d5db',
  //   fontSize: '14px',
  //   outline: 'none'
  // },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',    // Espaço consistente entre os itens
    width: '100%',  // Faz a linha ocupar toda a largura
    justifyContent: 'space-between', // Opcional: empurra o badge para o final da linha
    padding: '10px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
},
  switch: {
    width: '40px',
    height: '20px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: '0.3s'
  },
  switchHandle: {
    width: '16px',
    height: '16px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: '0.3s'
  },
  marginBox: {
    marginTop: '16px',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px'
  },
  footer: {
    padding: '10px 12px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    gap: '12px',
    backgroundColor: '#f9fafb'
  },
  btnSave: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  btnCancel: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#fff',
    color: '#4b5563',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  // ... seus estilos existentes
  input: {
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    transition: 'all 0.2s ease', // Suaviza a transição da cor
    outline: 'none',
  },
  
  btnReset: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background 0.2s'
  },

 
  tabsContainer: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  tabButton: {
    padding: '8px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#6b7280',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabButtonActive: {
    borderBottom: '2px solid #2563eb',
    color: '#2563eb',
    fontWeight: '600'

  }
};
