// Table.types.ts
export type TableVariant = 'default' | 'striped' | 'borderless';

/**
 * Define a estrutura de uma coluna da tabela.
 * A chave (key) deve corresponder à chave no objeto de dados.
 */
export interface TableColumn<T> {
  /** A chave do dado no objeto, usada para acessar o valor. */
  key: keyof T;
  /** O título visível no cabeçalho da tabela. */
  header: string;
  /** (Opcional) Uma função para renderizar o conteúdo da célula de forma customizada. */
  render?: (item: T) => React.ReactNode;
}

/**
 * Define as propriedades (props) do componente Table.
 */
export interface TableProps<T> {
  /** Um array de objetos que representam as linhas da tabela. */
  data: T[];
  /** Um array de definições de colunas. */
  columns: TableColumn<T>[];
  /** (Opcional) Título/legenda para a tabela (usando a tag <caption>). */
  caption?: string;
}