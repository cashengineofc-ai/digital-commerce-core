# Pix real no checkout existente

## Escopo
Modificar exclusivamente:
- `supabase/functions/mercadopago-checkout/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`
- `src/components/checkout/PublicCheckoutPage.tsx`
- `src/routes/admin.configuracoes.tsx`

Não criar checkout paralelo, rotas, migrações ou alterações visuais fora da nova seção Pix e dos estados Pix já existentes.

## Implementação

### Checkout no servidor
- Reutilizar `buildStaticPixPayload` e `normalizePixTxid` do helper BR Code e gerar o QR PNG em base64 com `qrcode@1.5.4` compatível com Deno.
- Ler a configuração Pix global sem expor a chave no carregamento público; retornar somente modo e tipo de confirmação.
- Validar produto principal, empresa, publicação, exclusão e estoque antes de carregar ou cobrar.
- Extrair order bumps somente de `checkout.produtos_config`; consultar produtos reais disponíveis e retornar apenas identificadores, nomes e valores validados.
- No pagamento, aceitar somente IDs públicos de bumps, revalidar todos e calcular no servidor o valor base, bumps e total final.
- Persistir no metadata o snapshot dos bumps e a composição do total.
- Preservar idempotência. Para Pix por chave, reutilizar exatamente payload, QR, recebedor e valor já persistidos.
- No modo `chave`, criar/reutilizar a transação pendente, gerar TXID/BR Code/QR, persistir os snapshots Pix e retornar “Aguardando conferência”, sem token externo, expiração fictícia ou aprovação automática.
- No modo `provedor`, preservar o Mercado Pago existente, exigir token apenas nesse ramo e registrar `pix_modo='provedor'`.
- No modo desativado, recusar Pix com `pix_not_configured`.

### Webhook Mercado Pago
- Carregar os dados locais necessários e incluir `collector_id` no pagamento recebido.
- Antes de aplicar status pago, validar provedor, ID externo, referência da transação, valor com tolerância de um centavo e collector persistido.
- Marcar o evento como falho e não alterar a transação quando qualquer validação falhar.
- Preservar o mapeamento atual de status; `authorized` não será promovido além do comportamento já existente.

### Checkout público
- Exibir os order bumps validados como checkboxes no estilo atual e recalcular apenas a prévia visual do total.
- Enviar somente `order_bump_ids`; usar o valor final retornado pelo servidor no resultado.
- Remover `autorizada` dos estados considerados pagos.
- Diferenciar Pix por chave e Pix por provedor nos textos existentes.
- Para Pix por chave, mostrar valor, recebedor, QR, copia e cola e “Aguardando conferência”, sem botão “Já paguei”.
- Preservar a confirmação automática do provedor e o polling atual.

### Configurações administrativas
- Adicionar uma única seção Pix funcional, preservando o restante da página.
- Carregar/salvar a configuração pelas RPCs existentes, mantendo campos vazios quando não configurados.
- Oferecer Desativado, Chave Pix com conciliação manual e Provedor integrado, sem exibir segredos.
- Listar Pix pendentes e exigir referência bancária e evidência antes da confirmação manual; atualizar a lista após sucesso.
- Informar claramente que comprovante do comprador não aprova automaticamente.

## Validação
- Confirmar que somente os quatro arquivos permitidos foram alterados.
- Executar a checagem TypeScript e validar o build da preview.
- Testar o helper BR Code com o vetor oficial informado e exigir CRC `1D3D`, sem criar vendas ou checkouts de teste.

## Observação técnica
O helper informado não está visível no estado local atualmente. A implementação manterá o import no caminho solicitado; antes da edição será confirmada a versão sincronizada. Se ele continuar ausente, não será criado um quinto arquivo, respeitando o limite explícito do escopo.
