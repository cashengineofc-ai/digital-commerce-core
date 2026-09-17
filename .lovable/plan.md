# Atribuição de afiliado no checkout público

## Alterações
- Ler `ref`, `aff` ou `affiliate` da URL, nessa prioridade, remover espaços externos e enviar como `affiliate_code` nas ações de carregamento e pagamento.
- Validar o código no servidor contra link ativo, período, empresa, produto, checkout e link de pagamento atuais; códigos inválidos serão ignorados.
- Persistir somente os IDs obtidos dessa validação na nova transação e nos metadados enviados ao Mercado Pago.
- Preservar a transação existente quando a idempotência já tiver criado uma linha ainda sem identificador do gateway.

## Limites e verificação
- Alterar exclusivamente os dois arquivos solicitados, sem mudanças visuais, textuais ou no fluxo de pagamento.
- Rodar a checagem disponível e confirmar o estado final da compilação.
