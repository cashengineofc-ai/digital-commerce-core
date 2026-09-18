-- Cash Engine PRO — estado operacional atual: somente Pix.
-- Corrige conteúdo legado de seed sem alterar vendas históricas.

UPDATE public.taxas_plataforma
SET ativo=false,
    updated_at=now()
WHERE metodo_pagamento::text<>'pix'
  AND ativo;

UPDATE public.ajuda_artigos
SET
  resumo='Como funciona a disponibilidade financeira enquanto o Pix é o método operacional atual',
  conteudo='No momento, o método de pagamento operacional é Pix. A disponibilidade e a conciliação dependem da regra registrada na operação e do modo de confirmação utilizado. Cartão e boleto permanecem indisponíveis até existir integração operacional completa. Saques somente são considerados pagos após conciliação ou confirmação real do provedor.',
  conteudo_html='<p>No momento, o método de pagamento operacional é <strong>Pix</strong>.</p><p>A disponibilidade e a conciliação dependem da regra registrada na operação e do modo de confirmação utilizado.</p><p>Cartão e boleto permanecem indisponíveis até existir integração operacional completa.</p><p>Saques somente são considerados pagos após conciliação ou confirmação real do provedor.</p>',
  updated_at=now()
WHERE slug='prazos-liquidacao'
  AND empresa_id IS NULL;

UPDATE public.ajuda_artigos
SET
  resumo='Boas práticas para organizar um checkout claro e confiável',
  conteudo='Use identidade visual consistente, informações objetivas do produto, preço e total sempre visíveis, campos necessários para a operação e os métodos de pagamento realmente disponíveis. Não esconda valores obrigatórios nem apresente formas de pagamento que ainda não estejam operacionais.',
  conteudo_html='<p>Use identidade visual consistente, informações objetivas do produto, preço e total sempre visíveis, campos necessários para a operação e os métodos de pagamento realmente disponíveis.</p><p>Não esconda valores obrigatórios nem apresente formas de pagamento que ainda não estejam operacionais.</p>',
  updated_at=now()
WHERE slug='checkout-alta-conversao'
  AND empresa_id IS NULL;
