# Cash Engine PRO — validação pós-migration

Este diretório contém verificações que **não devem criar dados demonstrativos em produção**.

## Regressões transacionais

`team_settings_rollback.sql` e `commerce_runtime_rollback.sql` criam fixtures sintéticas apenas dentro de transações terminadas com `ROLLBACK`. Execute sempre o arquivo inteiro, com uma conexão SQL confiável, após as migrations descritas em `../releases/20260918_STATUS.md`. Não execute trechos isolados nem substitua o rollback por commit. Não há chamadas a provedores, envio de mensagens ou movimentação real de dinheiro.

O primeiro cobre autorização/equipe/configurações; o segundo cobre publicação, order bump, reserva de link único, retry de pedido e contabilização idempotente. Não substituem testes de concorrência, navegador ou provedor.

## `post_migration_diagnostic.sql`

Valida, somente por leitura:

- presença das tabelas críticas;
- inexistência de regra ativa de taxa para cartão/boleto;
- RLS das tabelas exclusivas do Admin Global;
- ausência de `EXECUTE` de browser em funções reservadas ao backend;
- presença das RPCs centrais;
- conciliação estrutural de pedidos reais, itens, taxas, comissões e split.

A consulta final usa no máximo 20 pedidos reais já existentes e não altera situação, saldo, saque, estorno ou pagamento.

## Matriz de teste manual em ambiente de validação

Use duas empresas reais/de teste isoladas no ambiente de validação, não dados fictícios persistidos em produção:

1. conta comum da Empresa A;
2. administrador/owner da Empresa A;
3. conta da Empresa B;
4. Admin Global.

Confirme que a conta comum e o admin da empresa não acessam `/admin`, RPCs `fn_admin_*` nem dados da Empresa B. O Admin Global deve acessar somente as funções explicitamente globais.

Para dinheiro, nunca execute transferência, estorno bancário ou pagamento real só para teste. Valide os estados até o ponto anterior à ação externa ou use sandbox oficial do provedor quando existir.
