import React from 'react';

interface Montagem {
  id?: string;
  name: string;
  items: { name: string; quantity: number }[];
  services: { name: string }[];
}

interface Props {
  montagens: Montagem[];
  onRemove: (id: string) => void;
  readonly?: boolean;
}

const OSMontagemList: React.FC<Props> = ({
  montagens,
  onRemove,
  readonly,
}) => {
  if (!montagens.length) return null;

  return (
    <div>
      <h3>🔧 Montagens</h3>

      {montagens.map((m, index) => (
        <div key={m.id || index} style={{ marginBottom: '10px' }}>
          <strong>{m.name}</strong>

          <ul>
            {m.items.map((i, idx) => (
              <li key={idx}>
                {i.quantity}x {i.name}
              </li>
            ))}
          </ul>

          <small>
            Serviços: {m.services.map(s => s.name).join(', ')}
          </small>

          {!readonly && (
            <button onClick={() => m.id && onRemove(m.id)}>
              Remover
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default OSMontagemList;