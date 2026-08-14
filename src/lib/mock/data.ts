export type TransactionStatus = "aprovada" | "pendente" | "recusada" | "estornada";
export type PaymentMethod = "Pix" | "Cartão" | "Boleto";

export type Transaction = {
  id: string;
  customer: string;
  product: string;
  amount: number;
  method: PaymentMethod;
  status: TransactionStatus;
  affiliate: string | null;
  date: string;
};

export const transactions: Transaction[] = [
  { id: "TRX-90412", customer: "Marina Alves", product: "Método Escala 7", amount: 197, method: "Pix", status: "aprovada", affiliate: "Rafael Lima", date: "2026-08-14T14:32:00Z" },
  { id: "TRX-90411", customer: "Diego Souza", product: "Mentoria Cash Pro", amount: 1497, method: "Cartão", status: "aprovada", affiliate: null, date: "2026-08-14T13:58:00Z" },
  { id: "TRX-90410", customer: "Camila Ferreira", product: "Pack Criativos 2026", amount: 89.9, method: "Pix", status: "pendente", affiliate: "Ana Prado", date: "2026-08-14T13:21:00Z" },
  { id: "TRX-90409", customer: "Lucas Martins", product: "Método Escala 7", amount: 197, method: "Cartão", status: "recusada", affiliate: "Rafael Lima", date: "2026-08-14T12:47:00Z" },
  { id: "TRX-90408", customer: "Beatriz Nunes", product: "Curso Tráfego Direto", amount: 397, method: "Cartão", status: "aprovada", affiliate: null, date: "2026-08-14T12:02:00Z" },
  { id: "TRX-90407", customer: "Rodrigo Pinto", product: "Comunidade CE PRO", amount: 49.9, method: "Pix", status: "aprovada", affiliate: "Ana Prado", date: "2026-08-14T11:35:00Z" },
  { id: "TRX-90406", customer: "Juliana Castro", product: "Mentoria Cash Pro", amount: 1497, method: "Boleto", status: "pendente", affiliate: null, date: "2026-08-14T10:58:00Z" },
  { id: "TRX-90405", customer: "Felipe Andrade", product: "Pack Criativos 2026", amount: 89.9, method: "Pix", status: "aprovada", affiliate: "Bruno Reis", date: "2026-08-14T10:14:00Z" },
  { id: "TRX-90404", customer: "Tatiane Rocha", product: "Método Escala 7", amount: 197, method: "Cartão", status: "estornada", affiliate: "Rafael Lima", date: "2026-08-13T21:40:00Z" },
  { id: "TRX-90403", customer: "Gustavo Mendes", product: "Curso Tráfego Direto", amount: 397, method: "Pix", status: "aprovada", affiliate: "Bruno Reis", date: "2026-08-13T20:12:00Z" },
  { id: "TRX-90402", customer: "Larissa Dias", product: "Comunidade CE PRO", amount: 49.9, method: "Cartão", status: "aprovada", affiliate: null, date: "2026-08-13T19:03:00Z" },
  { id: "TRX-90401", customer: "Eduardo Ramos", product: "Método Escala 7", amount: 197, method: "Pix", status: "aprovada", affiliate: "Ana Prado", date: "2026-08-13T18:22:00Z" },
  { id: "TRX-90400", customer: "Patrícia Gomes", product: "Mentoria Cash Pro", amount: 1497, method: "Cartão", status: "recusada", affiliate: null, date: "2026-08-13T17:44:00Z" },
  { id: "TRX-90399", customer: "Vinícius Barros", product: "Pack Criativos 2026", amount: 89.9, method: "Pix", status: "aprovada", affiliate: "Bruno Reis", date: "2026-08-13T16:31:00Z" },
  { id: "TRX-90398", customer: "Aline Cardoso", product: "Curso Tráfego Direto", amount: 397, method: "Cartão", status: "aprovada", affiliate: "Rafael Lima", date: "2026-08-13T15:19:00Z" },
  { id: "TRX-90397", customer: "Henrique Melo", product: "Comunidade CE PRO", amount: 49.9, method: "Pix", status: "pendente", affiliate: null, date: "2026-08-13T14:07:00Z" },
  { id: "TRX-90396", customer: "Sofia Ribeiro", product: "Método Escala 7", amount: 197, method: "Cartão", status: "aprovada", affiliate: "Ana Prado", date: "2026-08-13T12:55:00Z" },
  { id: "TRX-90395", customer: "Otávio Freitas", product: "Mentoria Cash Pro", amount: 1497, method: "Pix", status: "aprovada", affiliate: null, date: "2026-08-13T11:26:00Z" },
];

export type Product = {
  id: string;
  name: string;
  price: number;
  commission: number;
  sales: number;
  revenue: number;
  status: "ativo" | "rascunho" | "pausado";
};

export const products: Product[] = [
  { id: "PRD-101", name: "Método Escala 7", price: 197, commission: 30, sales: 1284, revenue: 252948, status: "ativo" },
  { id: "PRD-102", name: "Mentoria Cash Pro", price: 1497, commission: 20, sales: 212, revenue: 317364, status: "ativo" },
  { id: "PRD-103", name: "Curso Tráfego Direto", price: 397, commission: 40, sales: 638, revenue: 253286, status: "ativo" },
  { id: "PRD-104", name: "Pack Criativos 2026", price: 89.9, commission: 50, sales: 1902, revenue: 170989.8, status: "ativo" },
  { id: "PRD-105", name: "Comunidade CE PRO", price: 49.9, commission: 25, sales: 2410, revenue: 120259, status: "ativo" },
  { id: "PRD-106", name: "Workshop Split Avançado", price: 297, commission: 35, sales: 148, revenue: 43956, status: "pausado" },
  { id: "PRD-107", name: "Templates de Checkout", price: 129, commission: 45, sales: 0, revenue: 0, status: "rascunho" },
];

export type Affiliate = {
  id: string;
  name: string;
  sales: number;
  commission: number;
  conversion: number;
};

export const affiliates: Affiliate[] = [
  { id: "AFF-01", name: "Rafael Lima", sales: 412, commission: 68420.5, conversion: 8.4 },
  { id: "AFF-02", name: "Ana Prado", sales: 388, commission: 61240.2, conversion: 7.9 },
  { id: "AFF-03", name: "Bruno Reis", sales: 271, commission: 42115.8, conversion: 6.5 },
  { id: "AFF-04", name: "Carla Souto", sales: 190, commission: 30880.4, conversion: 5.8 },
  { id: "AFF-05", name: "Thiago Nogueira", sales: 142, commission: 22014.9, conversion: 5.1 },
];

export type LedgerEntry = {
  id: string;
  description: string;
  type: "credito" | "debito";
  amount: number;
  date: string;
};

export const ledger: LedgerEntry[] = [
  { id: "LG-5011", description: "Venda aprovada · Método Escala 7", type: "credito", amount: 197, date: "2026-08-14T14:32:00Z" },
  { id: "LG-5010", description: "Taxa de processamento", type: "debito", amount: 9.85, date: "2026-08-14T14:32:00Z" },
  { id: "LG-5009", description: "Comissão de afiliado · Rafael Lima", type: "debito", amount: 59.1, date: "2026-08-14T14:32:00Z" },
  { id: "LG-5008", description: "Venda aprovada · Mentoria Cash Pro", type: "credito", amount: 1497, date: "2026-08-14T13:58:00Z" },
  { id: "LG-5007", description: "Saque solicitado", type: "debito", amount: 12000, date: "2026-08-13T18:00:00Z" },
  { id: "LG-5006", description: "Venda aprovada · Curso Tráfego Direto", type: "credito", amount: 397, date: "2026-08-13T15:19:00Z" },
  { id: "LG-5005", description: "Estorno · Método Escala 7", type: "debito", amount: 197, date: "2026-08-13T21:40:00Z" },
  { id: "LG-5004", description: "Venda aprovada · Pack Criativos 2026", type: "credito", amount: 89.9, date: "2026-08-13T16:31:00Z" },
];

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  date: string;
  result: "sucesso" | "falha";
};

export const auditLogs: AuditLog[] = [
  { id: "LOG-8801", actor: "Kelvin", action: "Gerou nova chave de API", date: "2026-08-14T09:12:00Z", result: "sucesso" },
  { id: "LOG-8800", actor: "Sistema", action: "Webhook order.paid entregue", date: "2026-08-14T08:41:00Z", result: "sucesso" },
  { id: "LOG-8799", actor: "Ana Prado", action: "Tentativa de login", date: "2026-08-13T23:02:00Z", result: "falha" },
  { id: "LOG-8798", actor: "Kelvin", action: "Aprovou saque de R$ 12.000,00", date: "2026-08-13T18:00:00Z", result: "sucesso" },
  { id: "LOG-8797", actor: "Kelvin", action: "Editou regra de split", date: "2026-08-13T15:44:00Z", result: "sucesso" },
];

export const kpis = {
  volume: 1284930.55,
  sales: 3241,
  revenue: 486210.3,
  approvalRate: 92.4,
};

export const salesSeries = [
  { day: "01", volume: 28400 },
  { day: "04", volume: 33210 },
  { day: "07", volume: 29850 },
  { day: "10", volume: 41230 },
  { day: "13", volume: 38940 },
  { day: "16", volume: 47110 },
  { day: "19", volume: 52380 },
  { day: "22", volume: 48920 },
  { day: "25", volume: 61240 },
  { day: "28", volume: 68410 },
  { day: "30", volume: 74920 },
];

export function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
