# Cash Engine PRO — validação pós-migration

Este diretório contém verificações que **não devem criar dados demonstrativos em produção**.

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
