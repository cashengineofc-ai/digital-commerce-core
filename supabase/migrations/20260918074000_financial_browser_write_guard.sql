-- Financial records are produced by authenticated backend/RPC workflows.
-- Legacy tenant-wide ALL policies must not allow forging credits or paid orders.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
  public.pedidos,public.pedido_itens,public.transacoes,public.transacoes_parcelas,
  public.saldos,public.saques,public.estornos,public.chargebacks,public.repasses,
  public.comissoes,public.lancamentos_contabeis,public.taxa_operacao_snapshots,
  public.split_distribuicoes,public.split_regras,public.split_regra_beneficiarios,
  public.link_pagamento_reservas,public.pedido_estoque_reservas
FROM PUBLIC,anon,authenticated;
