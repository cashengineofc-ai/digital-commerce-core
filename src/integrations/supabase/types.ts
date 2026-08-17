export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categorias_produtos: {
        Row: {
          ativa: boolean | null
          banner_url: string | null
          categoria_pai_id: string | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          destaque: boolean | null
          empresa_id: string
          id: string
          imagem_url: string | null
          meta_descricao: string | null
          meta_titulo: string | null
          nome: string
          ordem: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean | null
          banner_url?: string | null
          categoria_pai_id?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          destaque?: boolean | null
          empresa_id: string
          id?: string
          imagem_url?: string | null
          meta_descricao?: string | null
          meta_titulo?: string | null
          nome: string
          ordem?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean | null
          banner_url?: string | null
          categoria_pai_id?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          destaque?: boolean | null
          empresa_id?: string
          id?: string
          imagem_url?: string | null
          meta_descricao?: string | null
          meta_titulo?: string | null
          nome?: string
          ordem?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_produtos_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          afiliado_requerido: boolean | null
          banner_url: string | null
          created_at: string
          criado_por: string | null
          cupom_id: string | null
          cupons_aceitos: string[] | null
          customizacao_override: Json | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          frete_tipo: string | null
          frete_valor_gratis_minimo: number | null
          ga4_id: string | null
          gtm_id: string | null
          id: string
          imagem_url: string | null
          maximo_por_cliente: number | null
          maximo_total_vendas: number | null
          nome: string
          obrigar_cadastro: boolean | null
          permite_convidado: boolean | null
          permite_multiplos_cupons: boolean | null
          permitir_valor_personalizado: boolean | null
          pixel_facebook_id: string | null
          pixel_google_id: string | null
          politica_privacidade: string | null
          prazo_expiracao: number | null
          produto_id: string | null
          produtos_config: Json
          publicacao_data: string | null
          slug: string
          status: Database["public"]["Enums"]["status_checkout"]
          taxa_afiliado_padrao: number | null
          template_id: string | null
          termos_servico: string | null
          total_arrecadado: number | null
          total_vendido: number | null
          unidade_expiracao: string | null
          updated_at: string
          url_cancelamento: string | null
          url_falha: string | null
          url_sucesso: string | null
          valor_maximo: number | null
          valor_minimo: number | null
          valor_sugerido: number | null
          webhook_url: string | null
        }
        Insert: {
          afiliado_requerido?: boolean | null
          banner_url?: string | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          cupons_aceitos?: string[] | null
          customizacao_override?: Json | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          frete_tipo?: string | null
          frete_valor_gratis_minimo?: number | null
          ga4_id?: string | null
          gtm_id?: string | null
          id?: string
          imagem_url?: string | null
          maximo_por_cliente?: number | null
          maximo_total_vendas?: number | null
          nome: string
          obrigar_cadastro?: boolean | null
          permite_convidado?: boolean | null
          permite_multiplos_cupons?: boolean | null
          permitir_valor_personalizado?: boolean | null
          pixel_facebook_id?: string | null
          pixel_google_id?: string | null
          politica_privacidade?: string | null
          prazo_expiracao?: number | null
          produto_id?: string | null
          produtos_config?: Json
          publicacao_data?: string | null
          slug: string
          status?: Database["public"]["Enums"]["status_checkout"]
          taxa_afiliado_padrao?: number | null
          template_id?: string | null
          termos_servico?: string | null
          total_arrecadado?: number | null
          total_vendido?: number | null
          unidade_expiracao?: string | null
          updated_at?: string
          url_cancelamento?: string | null
          url_falha?: string | null
          url_sucesso?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          valor_sugerido?: number | null
          webhook_url?: string | null
        }
        Update: {
          afiliado_requerido?: boolean | null
          banner_url?: string | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          cupons_aceitos?: string[] | null
          customizacao_override?: Json | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          frete_tipo?: string | null
          frete_valor_gratis_minimo?: number | null
          ga4_id?: string | null
          gtm_id?: string | null
          id?: string
          imagem_url?: string | null
          maximo_por_cliente?: number | null
          maximo_total_vendas?: number | null
          nome?: string
          obrigar_cadastro?: boolean | null
          permite_convidado?: boolean | null
          permite_multiplos_cupons?: boolean | null
          permitir_valor_personalizado?: boolean | null
          pixel_facebook_id?: string | null
          pixel_google_id?: string | null
          politica_privacidade?: string | null
          prazo_expiracao?: number | null
          produto_id?: string | null
          produtos_config?: Json
          publicacao_data?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["status_checkout"]
          taxa_afiliado_padrao?: number | null
          template_id?: string | null
          termos_servico?: string | null
          total_arrecadado?: number | null
          total_vendido?: number | null
          unidade_expiracao?: string | null
          updated_at?: string
          url_cancelamento?: string | null
          url_falha?: string | null
          url_sucesso?: string | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          valor_sugerido?: number | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_checkout"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          aceita_marketing: boolean | null
          aceita_termos: boolean | null
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          data_primeira_compra: string | null
          data_ultima_compra: string | null
          deleted_at: string | null
          email: string
          empresa_id: string
          estado: string | null
          id: string
          integrado_hotmart_id: string | null
          integrado_kiwify_id: string | null
          integrado_monetizze_id: string | null
          logradouro: string | null
          metadata: Json | null
          nivel_cliente: string | null
          nome_completo: string
          nome_social: string | null
          numero: string | null
          observacoes: string | null
          origem_captacao: string | null
          pais: string | null
          pontos_fidelidade: number | null
          rg: string | null
          sexo: string | null
          status: Database["public"]["Enums"]["status_ativo"]
          tags: string[] | null
          telefone: string | null
          ticket_medio: number | null
          tipo_pessoa: string | null
          total_gasto: number | null
          total_pedidos: number | null
          updated_at: string
        }
        Insert: {
          aceita_marketing?: boolean | null
          aceita_termos?: boolean | null
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          data_primeira_compra?: string | null
          data_ultima_compra?: string | null
          deleted_at?: string | null
          email: string
          empresa_id: string
          estado?: string | null
          id?: string
          integrado_hotmart_id?: string | null
          integrado_kiwify_id?: string | null
          integrado_monetizze_id?: string | null
          logradouro?: string | null
          metadata?: Json | null
          nivel_cliente?: string | null
          nome_completo: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pais?: string | null
          pontos_fidelidade?: number | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_ativo"]
          tags?: string[] | null
          telefone?: string | null
          ticket_medio?: number | null
          tipo_pessoa?: string | null
          total_gasto?: number | null
          total_pedidos?: number | null
          updated_at?: string
        }
        Update: {
          aceita_marketing?: boolean | null
          aceita_termos?: boolean | null
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          data_primeira_compra?: string | null
          data_ultima_compra?: string | null
          deleted_at?: string | null
          email?: string
          empresa_id?: string
          estado?: string | null
          id?: string
          integrado_hotmart_id?: string | null
          integrado_kiwify_id?: string | null
          integrado_monetizze_id?: string | null
          logradouro?: string | null
          metadata?: Json | null
          nivel_cliente?: string | null
          nome_completo?: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pais?: string | null
          pontos_fidelidade?: number | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_ativo"]
          tags?: string[] | null
          telefone?: string | null
          ticket_medio?: number | null
          tipo_pessoa?: string | null
          total_gasto?: number | null
          total_pedidos?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          categoria_ids: string[] | null
          codigo: string
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          desconto_maximo: number | null
          descricao: string | null
          empresa_id: string
          exclusivo_primeira_compra: boolean | null
          id: string
          max_usos: number | null
          permite_empilhamento: boolean | null
          produto_ids: string[] | null
          status: Database["public"]["Enums"]["status_cupom"]
          tipo: Database["public"]["Enums"]["tipo_cupom"]
          updated_at: string
          usos_count: number | null
          usos_por_cliente: number | null
          valor: number
          valor_minimo_pedido: number | null
        }
        Insert: {
          categoria_ids?: string[] | null
          codigo: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          desconto_maximo?: number | null
          descricao?: string | null
          empresa_id: string
          exclusivo_primeira_compra?: boolean | null
          id?: string
          max_usos?: number | null
          permite_empilhamento?: boolean | null
          produto_ids?: string[] | null
          status?: Database["public"]["Enums"]["status_cupom"]
          tipo?: Database["public"]["Enums"]["tipo_cupom"]
          updated_at?: string
          usos_count?: number | null
          usos_por_cliente?: number | null
          valor: number
          valor_minimo_pedido?: number | null
        }
        Update: {
          categoria_ids?: string[] | null
          codigo?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          desconto_maximo?: number | null
          descricao?: string | null
          empresa_id?: string
          exclusivo_primeira_compra?: boolean | null
          id?: string
          max_usos?: number | null
          permite_empilhamento?: boolean | null
          produto_ids?: string[] | null
          status?: Database["public"]["Enums"]["status_cupom"]
          tipo?: Database["public"]["Enums"]["tipo_cupom"]
          updated_at?: string
          usos_count?: number | null
          usos_por_cliente?: number | null
          valor?: number
          valor_minimo_pedido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cupons_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cupons_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          configuracoes: Json | null
          created_at: string
          deleted_at: string | null
          email: string | null
          estado: string | null
          id: string
          ie: string | null
          im: string | null
          logotipo_url: string | null
          logradouro: string | null
          nome_fantasia: string
          numero: string | null
          pais: string | null
          plano: string | null
          razao_social: string | null
          segmento: string | null
          site: string | null
          status: Database["public"]["Enums"]["status_ativo"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          configuracoes?: Json | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logotipo_url?: string | null
          logradouro?: string | null
          nome_fantasia: string
          numero?: string | null
          pais?: string | null
          plano?: string | null
          razao_social?: string | null
          segmento?: string | null
          site?: string | null
          status?: Database["public"]["Enums"]["status_ativo"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          configuracoes?: Json | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logotipo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string
          numero?: string | null
          pais?: string | null
          plano?: string | null
          razao_social?: string | null
          segmento?: string | null
          site?: string | null
          status?: Database["public"]["Enums"]["status_ativo"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          cargo: string | null
          codigo_convite: string
          convidado_por: string
          created_at: string
          email: string
          empresa_id: string
          expira_em: string
          id: string
          link_afiliado_base: string | null
          mensagem: string | null
          nome: string | null
          role_id: string | null
          status: string
          taxa_comissao_padrao: number | null
          tipo: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          cargo?: string | null
          codigo_convite: string
          convidado_por: string
          created_at?: string
          email: string
          empresa_id: string
          expira_em?: string
          id?: string
          link_afiliado_base?: string | null
          mensagem?: string | null
          nome?: string | null
          role_id?: string | null
          status?: string
          taxa_comissao_padrao?: number | null
          tipo: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          cargo?: string | null
          codigo_convite?: string
          convidado_por?: string
          created_at?: string
          email?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          link_afiliado_base?: string | null
          mensagem?: string | null
          nome?: string | null
          role_id?: string | null
          status?: string
          taxa_comissao_padrao?: number | null
          tipo?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      links_pagamento: {
        Row: {
          afiliado_id: string | null
          campanha_nome: string | null
          checkout_id: string | null
          codigo_unico: string
          contador_usos: number | null
          cpf_cliente_obrigatorio: boolean | null
          created_at: string
          criado_por: string | null
          cupom_id: string | null
          data_expiracao: string | null
          deleted_at: string | null
          descricao: string | null
          email_cliente_obrigatorio: boolean | null
          empresa_id: string
          endereco_cliente_obrigatorio: boolean | null
          fonte_trafego: string | null
          id: string
          max_usos: number | null
          mensagem_sucesso_personalizada: string | null
          metadata: Json | null
          moeda: string | null
          nome_cliente_obrigatorio: boolean | null
          notificar_email_criador: boolean | null
          notificar_whatsapp_criador: boolean | null
          permite_editar_valor: boolean | null
          produto_id: string | null
          status: Database["public"]["Enums"]["status_link_pagamento"]
          telefone_cliente_obrigatorio: boolean | null
          termo_utm: string | null
          tipo: Database["public"]["Enums"]["tipo_link_pagamento"]
          titulo: string
          updated_at: string
          url_redirecionamento_sucesso: string | null
          valor: number
          valor_original: number | null
          webhook_url: string | null
        }
        Insert: {
          afiliado_id?: string | null
          campanha_nome?: string | null
          checkout_id?: string | null
          codigo_unico: string
          contador_usos?: number | null
          cpf_cliente_obrigatorio?: boolean | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          data_expiracao?: string | null
          deleted_at?: string | null
          descricao?: string | null
          email_cliente_obrigatorio?: boolean | null
          empresa_id: string
          endereco_cliente_obrigatorio?: boolean | null
          fonte_trafego?: string | null
          id?: string
          max_usos?: number | null
          mensagem_sucesso_personalizada?: string | null
          metadata?: Json | null
          moeda?: string | null
          nome_cliente_obrigatorio?: boolean | null
          notificar_email_criador?: boolean | null
          notificar_whatsapp_criador?: boolean | null
          permite_editar_valor?: boolean | null
          produto_id?: string | null
          status?: Database["public"]["Enums"]["status_link_pagamento"]
          telefone_cliente_obrigatorio?: boolean | null
          termo_utm?: string | null
          tipo?: Database["public"]["Enums"]["tipo_link_pagamento"]
          titulo: string
          updated_at?: string
          url_redirecionamento_sucesso?: string | null
          valor?: number
          valor_original?: number | null
          webhook_url?: string | null
        }
        Update: {
          afiliado_id?: string | null
          campanha_nome?: string | null
          checkout_id?: string | null
          codigo_unico?: string
          contador_usos?: number | null
          cpf_cliente_obrigatorio?: boolean | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          data_expiracao?: string | null
          deleted_at?: string | null
          descricao?: string | null
          email_cliente_obrigatorio?: boolean | null
          empresa_id?: string
          endereco_cliente_obrigatorio?: boolean | null
          fonte_trafego?: string | null
          id?: string
          max_usos?: number | null
          mensagem_sucesso_personalizada?: string | null
          metadata?: Json | null
          moeda?: string | null
          nome_cliente_obrigatorio?: boolean | null
          notificar_email_criador?: boolean | null
          notificar_whatsapp_criador?: boolean | null
          permite_editar_valor?: boolean | null
          produto_id?: string | null
          status?: Database["public"]["Enums"]["status_link_pagamento"]
          telefone_cliente_obrigatorio?: boolean | null
          termo_utm?: string | null
          tipo?: Database["public"]["Enums"]["tipo_link_pagamento"]
          titulo?: string
          updated_at?: string
          url_redirecionamento_sucesso?: string | null
          valor?: number
          valor_original?: number | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_pagamento_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pagamento_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pagamento_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pagamento_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_pagamento_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          acao: Database["public"]["Enums"]["tipo_operacao"]
          created_at: string
          descricao: string | null
          id: string
          modulo: string
          nome_exibicao: string
          recurso: string
        }
        Insert: {
          acao: Database["public"]["Enums"]["tipo_operacao"]
          created_at?: string
          descricao?: string | null
          id?: string
          modulo: string
          nome_exibicao: string
          recurso: string
        }
        Update: {
          acao?: Database["public"]["Enums"]["tipo_operacao"]
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string
          nome_exibicao?: string
          recurso?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          altura: number | null
          arquivos_download: string[] | null
          atributos: Json | null
          avaliacao_media: number | null
          categoria_id: string | null
          comissao_valor_fixo: number | null
          comprimento: number | null
          configuracoes: Json | null
          created_at: string
          criado_por: string | null
          custo: number | null
          deleted_at: string | null
          descricao_curta: string | null
          descricao_longa: string | null
          destaque: boolean | null
          empresa_id: string
          especificacoes: Json | null
          estoque: number | null
          estoque_minimo: number | null
          galeria_urls: string[] | null
          gerencia_estoque: boolean | null
          id: string
          imagem_principal_url: string | null
          integracao_id_externo: string | null
          juros_ao_dia: number | null
          juros_parcelamento: number | null
          lancamento: boolean | null
          largura: number | null
          mais_vendido: boolean | null
          max_parcelas: number | null
          meta_descricao: string | null
          meta_palavras_chave: string | null
          meta_titulo: string | null
          moeda: string | null
          multa_atraso: number | null
          ncm: string | null
          nome: string
          origem_mercadoria: string | null
          parcela_minima: number | null
          periodo_assinatura: number | null
          permite_cancelar: boolean | null
          permite_parcelamento: boolean | null
          peso: number | null
          politica_reembolso: string | null
          preco: number
          preco_promocional: number | null
          promocao_fim: string | null
          promocao_inicio: string | null
          publicacao_data: string | null
          published_at: string | null
          receita_total: number | null
          seo_json: Json | null
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["status_produto"]
          subtitulo: string | null
          tags: string[] | null
          taxa_comissao_afiliado: number | null
          termos_uso: string | null
          tipo: Database["public"]["Enums"]["tipo_produto"]
          total_avaliacoes: number | null
          total_vendido: number | null
          trial_dias: number | null
          unidade_periodo: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          altura?: number | null
          arquivos_download?: string[] | null
          atributos?: Json | null
          avaliacao_media?: number | null
          categoria_id?: string | null
          comissao_valor_fixo?: number | null
          comprimento?: number | null
          configuracoes?: Json | null
          created_at?: string
          criado_por?: string | null
          custo?: number | null
          deleted_at?: string | null
          descricao_curta?: string | null
          descricao_longa?: string | null
          destaque?: boolean | null
          empresa_id: string
          especificacoes?: Json | null
          estoque?: number | null
          estoque_minimo?: number | null
          galeria_urls?: string[] | null
          gerencia_estoque?: boolean | null
          id?: string
          imagem_principal_url?: string | null
          integracao_id_externo?: string | null
          juros_ao_dia?: number | null
          juros_parcelamento?: number | null
          lancamento?: boolean | null
          largura?: number | null
          mais_vendido?: boolean | null
          max_parcelas?: number | null
          meta_descricao?: string | null
          meta_palavras_chave?: string | null
          meta_titulo?: string | null
          moeda?: string | null
          multa_atraso?: number | null
          ncm?: string | null
          nome: string
          origem_mercadoria?: string | null
          parcela_minima?: number | null
          periodo_assinatura?: number | null
          permite_cancelar?: boolean | null
          permite_parcelamento?: boolean | null
          peso?: number | null
          politica_reembolso?: string | null
          preco?: number
          preco_promocional?: number | null
          promocao_fim?: string | null
          promocao_inicio?: string | null
          publicacao_data?: string | null
          published_at?: string | null
          receita_total?: number | null
          seo_json?: Json | null
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["status_produto"]
          subtitulo?: string | null
          tags?: string[] | null
          taxa_comissao_afiliado?: number | null
          termos_uso?: string | null
          tipo?: Database["public"]["Enums"]["tipo_produto"]
          total_avaliacoes?: number | null
          total_vendido?: number | null
          trial_dias?: number | null
          unidade_periodo?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          altura?: number | null
          arquivos_download?: string[] | null
          atributos?: Json | null
          avaliacao_media?: number | null
          categoria_id?: string | null
          comissao_valor_fixo?: number | null
          comprimento?: number | null
          configuracoes?: Json | null
          created_at?: string
          criado_por?: string | null
          custo?: number | null
          deleted_at?: string | null
          descricao_curta?: string | null
          descricao_longa?: string | null
          destaque?: boolean | null
          empresa_id?: string
          especificacoes?: Json | null
          estoque?: number | null
          estoque_minimo?: number | null
          galeria_urls?: string[] | null
          gerencia_estoque?: boolean | null
          id?: string
          imagem_principal_url?: string | null
          integracao_id_externo?: string | null
          juros_ao_dia?: number | null
          juros_parcelamento?: number | null
          lancamento?: boolean | null
          largura?: number | null
          mais_vendido?: boolean | null
          max_parcelas?: number | null
          meta_descricao?: string | null
          meta_palavras_chave?: string | null
          meta_titulo?: string | null
          moeda?: string | null
          multa_atraso?: number | null
          ncm?: string | null
          nome?: string
          origem_mercadoria?: string | null
          parcela_minima?: number | null
          periodo_assinatura?: number | null
          permite_cancelar?: boolean | null
          permite_parcelamento?: boolean | null
          peso?: number | null
          politica_reembolso?: string | null
          preco?: number
          preco_promocional?: number | null
          promocao_fim?: string | null
          promocao_inicio?: string | null
          publicacao_data?: string | null
          published_at?: string | null
          receita_total?: number | null
          seo_json?: Json | null
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["status_produto"]
          subtitulo?: string | null
          tags?: string[] | null
          taxa_comissao_afiliado?: number | null
          termos_uso?: string | null
          tipo?: Database["public"]["Enums"]["tipo_produto"]
          total_avaliacoes?: number | null
          total_vendido?: number | null
          trial_dias?: number | null
          unidade_periodo?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          concedido_por: string | null
          created_at: string
          data_concessao: string
          empresa_id: string
          expira_em: string | null
          id: string
          profile_id: string
          role_id: string
        }
        Insert: {
          concedido_por?: string | null
          created_at?: string
          data_concessao?: string
          empresa_id: string
          expira_em?: string | null
          id?: string
          profile_id: string
          role_id: string
        }
        Update: {
          concedido_por?: string | null
          created_at?: string
          data_concessao?: string
          empresa_id?: string
          expira_em?: string | null
          id?: string
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_concedido_por_fkey"
            columns: ["concedido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bairro: string | null
          bio: string | null
          cargo: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          departamento: string | null
          email: string
          empresa_id: string | null
          estado: string | null
          id: string
          is_admin_global: boolean
          is_owner: boolean
          logradouro: string | null
          nome_completo: string
          numero: string | null
          pais: string | null
          preferencias: Json | null
          sexo: string | null
          status: Database["public"]["Enums"]["status_ativo"]
          telefone: string | null
          ultimo_ip: string | null
          ultimo_login: string | null
          ultimo_user_agent: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bairro?: string | null
          bio?: string | null
          cargo?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          departamento?: string | null
          email: string
          empresa_id?: string | null
          estado?: string | null
          id: string
          is_admin_global?: boolean
          is_owner?: boolean
          logradouro?: string | null
          nome_completo: string
          numero?: string | null
          pais?: string | null
          preferencias?: Json | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_ativo"]
          telefone?: string | null
          ultimo_ip?: string | null
          ultimo_login?: string | null
          ultimo_user_agent?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bairro?: string | null
          bio?: string | null
          cargo?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          departamento?: string | null
          email?: string
          empresa_id?: string | null
          estado?: string | null
          id?: string
          is_admin_global?: boolean
          is_owner?: boolean
          logradouro?: string | null
          nome_completo?: string
          numero?: string | null
          pais?: string | null
          preferencias?: Json | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_ativo"]
          telefone?: string | null
          ultimo_ip?: string | null
          ultimo_login?: string | null
          ultimo_user_agent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          cor: string | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          is_admin: boolean
          is_sistema: boolean
          nivel: number | null
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          is_admin?: boolean
          is_sistema?: boolean
          nivel?: number | null
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          is_admin?: boolean
          is_sistema?: boolean
          nivel?: number | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_checkout: {
        Row: {
          ativo: boolean | null
          banner_url: string | null
          campos_personalizados: Json | null
          cor_fundo: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          cor_texto: string | null
          created_at: string
          css_customizado: string | null
          deleted_at: string | null
          empresa_id: string | null
          fonte: string | null
          ga4_id: string | null
          gtm_id: string | null
          hotmart_id: string | null
          id: string
          imagem_fundo_url: string | null
          is_padrao: boolean | null
          layout: string | null
          logo_url: string | null
          mensagem_sucesso: string | null
          mostrar_bandeiras_cartao: boolean | null
          mostrar_desconto_pix: number | null
          mostrar_pagamento_boleto: boolean | null
          mostrar_pagamento_cartao: boolean | null
          mostrar_pagamento_pix: boolean | null
          nome: string
          parcelamento_juros: number | null
          parcelamento_maximo: number | null
          parcelamento_sem_juros: number | null
          pedir_cpf: boolean | null
          pedir_endereco: boolean | null
          pedir_genero: boolean | null
          pedir_nascimento: boolean | null
          pedir_rg: boolean | null
          pedir_telefone: boolean | null
          pixel_facebook_id: string | null
          pixel_google_id: string | null
          scripts_customizados: string | null
          secoes_visiveis: Json | null
          slug: string
          subtitulo_checkout: string | null
          tag_manager_id: string | null
          termo_compromisso: string | null
          titulo_checkout: string | null
          updated_at: string
          url_redirecionamento_sucesso: string | null
          valor_minimo_parcela: number | null
          video_fundo_url: string | null
        }
        Insert: {
          ativo?: boolean | null
          banner_url?: string | null
          campos_personalizados?: Json | null
          cor_fundo?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto?: string | null
          created_at?: string
          css_customizado?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          fonte?: string | null
          ga4_id?: string | null
          gtm_id?: string | null
          hotmart_id?: string | null
          id?: string
          imagem_fundo_url?: string | null
          is_padrao?: boolean | null
          layout?: string | null
          logo_url?: string | null
          mensagem_sucesso?: string | null
          mostrar_bandeiras_cartao?: boolean | null
          mostrar_desconto_pix?: number | null
          mostrar_pagamento_boleto?: boolean | null
          mostrar_pagamento_cartao?: boolean | null
          mostrar_pagamento_pix?: boolean | null
          nome: string
          parcelamento_juros?: number | null
          parcelamento_maximo?: number | null
          parcelamento_sem_juros?: number | null
          pedir_cpf?: boolean | null
          pedir_endereco?: boolean | null
          pedir_genero?: boolean | null
          pedir_nascimento?: boolean | null
          pedir_rg?: boolean | null
          pedir_telefone?: boolean | null
          pixel_facebook_id?: string | null
          pixel_google_id?: string | null
          scripts_customizados?: string | null
          secoes_visiveis?: Json | null
          slug: string
          subtitulo_checkout?: string | null
          tag_manager_id?: string | null
          termo_compromisso?: string | null
          titulo_checkout?: string | null
          updated_at?: string
          url_redirecionamento_sucesso?: string | null
          valor_minimo_parcela?: number | null
          video_fundo_url?: string | null
        }
        Update: {
          ativo?: boolean | null
          banner_url?: string | null
          campos_personalizados?: Json | null
          cor_fundo?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cor_texto?: string | null
          created_at?: string
          css_customizado?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          fonte?: string | null
          ga4_id?: string | null
          gtm_id?: string | null
          hotmart_id?: string | null
          id?: string
          imagem_fundo_url?: string | null
          is_padrao?: boolean | null
          layout?: string | null
          logo_url?: string | null
          mensagem_sucesso?: string | null
          mostrar_bandeiras_cartao?: boolean | null
          mostrar_desconto_pix?: number | null
          mostrar_pagamento_boleto?: boolean | null
          mostrar_pagamento_cartao?: boolean | null
          mostrar_pagamento_pix?: boolean | null
          nome?: string
          parcelamento_juros?: number | null
          parcelamento_maximo?: number | null
          parcelamento_sem_juros?: number | null
          pedir_cpf?: boolean | null
          pedir_endereco?: boolean | null
          pedir_genero?: boolean | null
          pedir_nascimento?: boolean | null
          pedir_rg?: boolean | null
          pedir_telefone?: boolean | null
          pixel_facebook_id?: string | null
          pixel_google_id?: string | null
          scripts_customizados?: string | null
          secoes_visiveis?: Json | null
          slug?: string
          subtitulo_checkout?: string | null
          tag_manager_id?: string | null
          termo_compromisso?: string | null
          titulo_checkout?: string | null
          updated_at?: string
          url_redirecionamento_sucesso?: string | null
          valor_minimo_parcela?: number | null
          video_fundo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_checkout_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      status_ativo: "ativo" | "inativo" | "suspenso" | "bloqueado"
      status_checkout: "rascunho" | "publicado" | "arquivado"
      status_cupom: "ativo" | "inativo" | "expirado"
      status_link_pagamento: "ativo" | "expirado" | "usado" | "desativado"
      status_produto: "rascunho" | "publicado" | "arquivado" | "indisponivel"
      tipo_cupom: "percentual" | "valor_fixo" | "frete_gratis"
      tipo_desconto: "percentual" | "valor_fixo"
      tipo_link_pagamento:
        | "simples"
        | "produto"
        | "assinatura"
        | "doacao"
        | "personalizado"
      tipo_operacao:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "approve"
        | "manage"
      tipo_produto: "fisico" | "digital" | "assinatura" | "servico" | "ingresso"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_ativo: ["ativo", "inativo", "suspenso", "bloqueado"],
      status_checkout: ["rascunho", "publicado", "arquivado"],
      status_cupom: ["ativo", "inativo", "expirado"],
      status_link_pagamento: ["ativo", "expirado", "usado", "desativado"],
      status_produto: ["rascunho", "publicado", "arquivado", "indisponivel"],
      tipo_cupom: ["percentual", "valor_fixo", "frete_gratis"],
      tipo_desconto: ["percentual", "valor_fixo"],
      tipo_link_pagamento: [
        "simples",
        "produto",
        "assinatura",
        "doacao",
        "personalizado",
      ],
      tipo_operacao: [
        "create",
        "read",
        "update",
        "delete",
        "approve",
        "manage",
      ],
      tipo_produto: ["fisico", "digital", "assinatura", "servico", "ingresso"],
    },
  },
} as const
