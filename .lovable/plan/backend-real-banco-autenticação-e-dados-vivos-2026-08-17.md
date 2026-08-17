# Backend real: banco, autenticação e dados vivos

Lovable Cloud já foi ativado neste projeto. O próximo passo é sair dos mocks e ligar a plataforma interna a um banco real, com login de verdade e rotas protegidas — preservando todo o design atual.

## 1. Banco de dados

O repositório já traz 8 migrations em `supabase/migrations/` (schema base, produtos/checkouts, afiliados/marketplace, financeiro, equipe/segurança, admin/treinamentos, RLS/functions/triggers e seed de permissões), mais um `seed/demo_data.sql`.

- Aplicar as migrations na ordem 001 → 008, revisando cada uma antes de executar.
- Corrigir o que o banco recusar: tipos/enums duplicados, ordem de FKs, funções `security definer` sem `search_path`, políticas com recursão.
- Garantir `GRANT` explícito para `authenticated` e `service_role` em toda tabela do schema `public` (sem isso a API de dados devolve "permission denied" mesmo com RLS correta).
- Papéis (admin/produtor/afiliado) ficam em tabela própria, lidos por função `security definer` — nunca no `profiles`.
- Trigger que cria `profiles` (e vínculo com empresa) automaticamente no signup.
- Rodar o linter de segurança do banco no fim e corrigir os apontamentos.

Os dados de demonstração (`seed/demo_data.sql`) entram como carga inicial para que as telas não abram vazias.

## 2. Autenticação (login normal)

- Nova rota pública `/auth` com abas Entrar / Criar conta: e-mail + senha, validação, mensagens de erro claras (credenciais inválidas, e-mail já cadastrado, e-mail não confirmado) e estados de carregamento.
- Sessão persistente com listener de mudança de estado registrado na raiz.
- Toda a área `/app` passa a viver sob um layout autenticado: quem não estiver logado é redirecionado para `/auth`.
- Menu do usuário na sidebar mostra nome/e-mail reais e faz logout de verdade (limpa cache e volta para `/auth`).
- A landing pública em `/` continua exatamente como está, com CTA apontando para `/auth`.

## 3. Telas ligadas a dados reais

Prioridade nas telas que representam a operação, todas com carregamento, erro e estado vazio reais:

- **Dashboard** — KPIs, gráfico e listas calculados por consultas agregadas no período selecionado.
- **Transações** — tabela paginada vinda do banco, com busca e filtros aplicados na consulta; gaveta lateral lendo o detalhe e a timeline do pagamento.
- **Produtos / Checkout Builder** — listagem real e criação/edição gravando no banco (preço, comissão, order bump, status).
- **Clientes, Afiliados e Comissões** — leitura real com filtros.
- **Financeiro** — saldos e extrato calculados do razão; solicitação de saque gravando um registro pendente.
- **Developers** — chaves de API e logs de auditoria persistidos; rotação de chave grava no banco.

Demais telas continuam funcionando, migrando para leitura real onde já houver tabela correspondente.

## Detalhes técnicos

- Leitura/escrita via `createServerFn` com o middleware de autenticação do Supabase, chamadas por TanStack Query (`useQuery`/`useMutation`), sem `useEffect` de fetch.
- Mocks de `src/lib/mock/*` deixam de alimentar as telas migradas; ficam apenas os geradores ainda usados por telas não migradas nesta etapa.
- Correção prévia dos erros de tipo atuais em `AdminCommissionsPage`, `SplitEnginePage` e `src/lib/mock/data.ts` (prop `suffix` inexistente no `Input` e opcionais sob `exactOptionalPropertyTypes`).
- Formulários com `react-hook-form` + `zod` onde houver escrita; toasts via `sonner`.
- Confirmação de e-mail: por padrão o cadastro exige confirmação. Se preferir entrar direto após criar a conta, ativo a confirmação automática.

## Validação final

Login de ponta a ponta, rota protegida bloqueando anônimo, um CRUD real gravando e lendo, typecheck limpo e navegação sem erros de console.
