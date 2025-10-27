export interface SummaryMetrics {
  total: number;
  media: number;
  maximo: number;
  minimo: number;
  qtdVendas: number;
  ticketMedio: number;

  produtoTop: {
    nome: string;
    valor: number;
  } | null;

  categoriaTop: {
    nome: string;
    valor: number;
  } | null;

  periodo: {
    inicio: string;
    fim: string;
  };
}
