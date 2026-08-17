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
      afiliados: {
        Row: {
          aprovado_por: string | null
          biografia: string | null
          chave_pix: string | null
          codigo_afiliado: string
          convite_id: string | null
          created_at: string
          dados_bancarios: Json | null
          data_aprovacao: string | null
          deleted_at: string | null
          documentacao_enviada: boolean | null
          documento_titular: string | null
          documentos_verificados: boolean | null
          empresa_id: string
          id: string
          indicado_por_afiliado_id: string | null
          limite_diario_geracao_link: number | null
          link_personalizado: string | null
          metadata: Json | null
          midia_kit_url: string | null
          minimo_saque: number | null
          motivo_rejeicao: string | null
          nivel_rede: number | null
          pontos_desempenho: number | null
          preferencias_comunicacao: Json | null
          profile_id: string | null
          ranking_posicao: number | null
          redes_sociais: Json | null
          regras_especiais: Json | null
          saldo_aprovado: number | null
          saldo_disponivel: number | null
          saldo_pendente: number | null
          status: Database["public"]["Enums"]["status_afiliado"]
          subdominio: string | null
          taxa_comissao_padrao: number | null
          taxa_comissao_recorrente: number | null
          taxa_conversao: number | null
          ticket_medio_vendas: number | null
          tier: string | null
          tipo_chave_pix: string | null
          titular_conta: string | null
          total_cliques: number | null
          total_comissao_bruta: number | null
          total_comissao_liquida: number | null
          total_leads: number | null
          total_sacado: number | null
          total_vendas: number | null
          total_vendas_confirmadas: number | null
          total_visualizacoes: number | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          biografia?: string | null
          chave_pix?: string | null
          codigo_afiliado: string
          convite_id?: string | null
          created_at?: string
          dados_bancarios?: Json | null
          data_aprovacao?: string | null
          deleted_at?: string | null
          documentacao_enviada?: boolean | null
          documento_titular?: string | null
          documentos_verificados?: boolean | null
          empresa_id: string
          id?: string
          indicado_por_afiliado_id?: string | null
          limite_diario_geracao_link?: number | null
          link_personalizado?: string | null
          metadata?: Json | null
          midia_kit_url?: string | null
          minimo_saque?: number | null
          motivo_rejeicao?: string | null
          nivel_rede?: number | null
          pontos_desempenho?: number | null
          preferencias_comunicacao?: Json | null
          profile_id?: string | null
          ranking_posicao?: number | null
          redes_sociais?: Json | null
          regras_especiais?: Json | null
          saldo_aprovado?: number | null
          saldo_disponivel?: number | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_afiliado"]
          subdominio?: string | null
          taxa_comissao_padrao?: number | null
          taxa_comissao_recorrente?: number | null
          taxa_conversao?: number | null
          ticket_medio_vendas?: number | null
          tier?: string | null
          tipo_chave_pix?: string | null
          titular_conta?: string | null
          total_cliques?: number | null
          total_comissao_bruta?: number | null
          total_comissao_liquida?: number | null
          total_leads?: number | null
          total_sacado?: number | null
          total_vendas?: number | null
          total_vendas_confirmadas?: number | null
          total_visualizacoes?: number | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          biografia?: string | null
          chave_pix?: string | null
          codigo_afiliado?: string
          convite_id?: string | null
          created_at?: string
          dados_bancarios?: Json | null
          data_aprovacao?: string | null
          deleted_at?: string | null
          documentacao_enviada?: boolean | null
          documento_titular?: string | null
          documentos_verificados?: boolean | null
          empresa_id?: string
          id?: string
          indicado_por_afiliado_id?: string | null
          limite_diario_geracao_link?: number | null
          link_personalizado?: string | null
          metadata?: Json | null
          midia_kit_url?: string | null
          minimo_saque?: number | null
          motivo_rejeicao?: string | null
          nivel_rede?: number | null
          pontos_desempenho?: number | null
          preferencias_comunicacao?: Json | null
          profile_id?: string | null
          ranking_posicao?: number | null
          redes_sociais?: Json | null
          regras_especiais?: Json | null
          saldo_aprovado?: number | null
          saldo_disponivel?: number | null
          saldo_pendente?: number | null
          status?: Database["public"]["Enums"]["status_afiliado"]
          subdominio?: string | null
          taxa_comissao_padrao?: number | null
          taxa_comissao_recorrente?: number | null
          taxa_conversao?: number | null
          ticket_medio_vendas?: number | null
          tier?: string | null
          tipo_chave_pix?: string | null
          titular_conta?: string | null
          total_cliques?: number | null
          total_comissao_bruta?: number | null
          total_comissao_liquida?: number | null
          total_leads?: number | null
          total_sacado?: number | null
          total_vendas?: number | null
          total_vendas_confirmadas?: number | null
          total_visualizacoes?: number | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afiliados_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_indicado_por_afiliado_id_fkey"
            columns: ["indicado_por_afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliados_produtos: {
        Row: {
          afiliado_id: string
          ativo: boolean | null
          autorizado_em: string | null
          autorizado_por: string | null
          comissao_valor_fixo: number | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          maximo_comissao_periodo: number | null
          produto_id: string
          taxa_comissao_personalizada: number | null
          total_comissao_gerada: number | null
          total_vendas: number | null
          updated_at: string
        }
        Insert: {
          afiliado_id: string
          ativo?: boolean | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          comissao_valor_fixo?: number | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          id?: string
          maximo_comissao_periodo?: number | null
          produto_id: string
          taxa_comissao_personalizada?: number | null
          total_comissao_gerada?: number | null
          total_vendas?: number | null
          updated_at?: string
        }
        Update: {
          afiliado_id?: string
          ativo?: boolean | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          comissao_valor_fixo?: number | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          maximo_comissao_periodo?: number | null
          produto_id?: string
          taxa_comissao_personalizada?: number | null
          total_comissao_gerada?: number | null
          total_vendas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afiliados_produtos_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_produtos_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      comissoes: {
        Row: {
          afiliado_id: string
          aprovado_por: string | null
          cancelado_por: string | null
          cliente_id: string | null
          created_at: string
          data_aprovacao: string | null
          data_cancelamento: string | null
          data_pagamento: string | null
          data_prevista_liberacao: string | null
          deleted_at: string | null
          descontos_aplicados: number | null
          empresa_id: string
          id: string
          id_transacao_externo: string | null
          indicado_por_afiliado_id: string | null
          link_afiliado_id: string | null
          metadata: Json | null
          moeda: string | null
          motivo_cancelamento: string | null
          nota_interna: string | null
          origem_trafego: string | null
          parcela_numero: number | null
          periodo_recorrencia: number | null
          produto_id: string | null
          saque_id: string | null
          status: Database["public"]["Enums"]["status_comissao"]
          taxa_comissao_percentual: number
          taxa_plataforma: number | null
          taxa_processamento: number | null
          tipo_venda: string | null
          total_parcelas: number | null
          transacao_id: string | null
          updated_at: string
          valor_comissao_bruta: number
          valor_comissao_liquida: number
          valor_venda: number
        }
        Insert: {
          afiliado_id: string
          aprovado_por?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_pagamento?: string | null
          data_prevista_liberacao?: string | null
          deleted_at?: string | null
          descontos_aplicados?: number | null
          empresa_id: string
          id?: string
          id_transacao_externo?: string | null
          indicado_por_afiliado_id?: string | null
          link_afiliado_id?: string | null
          metadata?: Json | null
          moeda?: string | null
          motivo_cancelamento?: string | null
          nota_interna?: string | null
          origem_trafego?: string | null
          parcela_numero?: number | null
          periodo_recorrencia?: number | null
          produto_id?: string | null
          saque_id?: string | null
          status?: Database["public"]["Enums"]["status_comissao"]
          taxa_comissao_percentual: number
          taxa_plataforma?: number | null
          taxa_processamento?: number | null
          tipo_venda?: string | null
          total_parcelas?: number | null
          transacao_id?: string | null
          updated_at?: string
          valor_comissao_bruta: number
          valor_comissao_liquida: number
          valor_venda: number
        }
        Update: {
          afiliado_id?: string
          aprovado_por?: string | null
          cancelado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_pagamento?: string | null
          data_prevista_liberacao?: string | null
          deleted_at?: string | null
          descontos_aplicados?: number | null
          empresa_id?: string
          id?: string
          id_transacao_externo?: string | null
          indicado_por_afiliado_id?: string | null
          link_afiliado_id?: string | null
          metadata?: Json | null
          moeda?: string | null
          motivo_cancelamento?: string | null
          nota_interna?: string | null
          origem_trafego?: string | null
          parcela_numero?: number | null
          periodo_recorrencia?: number | null
          produto_id?: string | null
          saque_id?: string | null
          status?: Database["public"]["Enums"]["status_comissao"]
          taxa_comissao_percentual?: number
          taxa_plataforma?: number | null
          taxa_processamento?: number | null
          tipo_venda?: string | null
          total_parcelas?: number | null
          transacao_id?: string | null
          updated_at?: string
          valor_comissao_bruta?: number
          valor_comissao_liquida?: number
          valor_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_indicado_por_afiliado_id_fkey"
            columns: ["indicado_por_afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_link_afiliado_id_fkey"
            columns: ["link_afiliado_id"]
            isOneToOne: false
            referencedRelation: "links_afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
      links_afiliados: {
        Row: {
          afiliado_id: string
          checkout_id: string | null
          codigo_rastreio: string
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          link_pagamento_id: string | null
          nome_campanha: string | null
          parametros_extra: Json | null
          produto_id: string | null
          slug_personalizado: string | null
          status: Database["public"]["Enums"]["status_link_pagamento"]
          taxa_conversao: number | null
          total_cliques: number | null
          total_conversoes: number | null
          total_vendas: number | null
          total_visualizacoes: number | null
          updated_at: string
          url_curta: string | null
          url_destino: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          afiliado_id: string
          checkout_id?: string | null
          codigo_rastreio: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          link_pagamento_id?: string | null
          nome_campanha?: string | null
          parametros_extra?: Json | null
          produto_id?: string | null
          slug_personalizado?: string | null
          status?: Database["public"]["Enums"]["status_link_pagamento"]
          taxa_conversao?: number | null
          total_cliques?: number | null
          total_conversoes?: number | null
          total_vendas?: number | null
          total_visualizacoes?: number | null
          updated_at?: string
          url_curta?: string | null
          url_destino: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          afiliado_id?: string
          checkout_id?: string | null
          codigo_rastreio?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          link_pagamento_id?: string | null
          nome_campanha?: string | null
          parametros_extra?: Json | null
          produto_id?: string | null
          slug_personalizado?: string | null
          status?: Database["public"]["Enums"]["status_link_pagamento"]
          taxa_conversao?: number | null
          total_cliques?: number | null
          total_conversoes?: number | null
          total_vendas?: number | null
          total_visualizacoes?: number | null
          updated_at?: string
          url_curta?: string | null
          url_destino?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_afiliados_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_afiliados_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_afiliados_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_afiliados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_afiliados_link_pagamento_id_fkey"
            columns: ["link_pagamento_id"]
            isOneToOne: false
            referencedRelation: "links_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_afiliados_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
      marketplace_inscricoes: {
        Row: {
          afiliado_id: string
          aprovada_em: string | null
          aprovada_por: string | null
          ativa: boolean | null
          created_at: string
          data_inscricao: string
          data_ultima_venda: string | null
          empresa_id: string
          id: string
          marketplace_produto_id: string
          metadata: Json | null
          motivo_rejeicao: string | null
          produto_id: string | null
          rejeitada_em: string | null
          status: string
          taxa_comissao_aplicada: number | null
          total_comissao_gerada: number | null
          total_vendas: number | null
          updated_at: string
        }
        Insert: {
          afiliado_id: string
          aprovada_em?: string | null
          aprovada_por?: string | null
          ativa?: boolean | null
          created_at?: string
          data_inscricao?: string
          data_ultima_venda?: string | null
          empresa_id: string
          id?: string
          marketplace_produto_id: string
          metadata?: Json | null
          motivo_rejeicao?: string | null
          produto_id?: string | null
          rejeitada_em?: string | null
          status?: string
          taxa_comissao_aplicada?: number | null
          total_comissao_gerada?: number | null
          total_vendas?: number | null
          updated_at?: string
        }
        Update: {
          afiliado_id?: string
          aprovada_em?: string | null
          aprovada_por?: string | null
          ativa?: boolean | null
          created_at?: string
          data_inscricao?: string
          data_ultima_venda?: string | null
          empresa_id?: string
          id?: string
          marketplace_produto_id?: string
          metadata?: Json | null
          motivo_rejeicao?: string | null
          produto_id?: string | null
          rejeitada_em?: string | null
          status?: string
          taxa_comissao_aplicada?: number | null
          total_comissao_gerada?: number | null
          total_vendas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_inscricoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_inscricoes_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_inscricoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_inscricoes_marketplace_produto_id_fkey"
            columns: ["marketplace_produto_id"]
            isOneToOne: false
            referencedRelation: "marketplace_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_inscricoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_produtos: {
        Row: {
          avaliacao_media: number | null
          categoria_marketplace: string | null
          comissao_valor_fixo_oferecida: number | null
          created_at: string
          data_destaque: string | null
          data_publicacao: string | null
          deleted_at: string | null
          descricao_marketplace: string
          destaque_marketplace: boolean | null
          empresa_vendedora_id: string
          enviado_por: string | null
          faixa_etaria: string | null
          galeria_marketplace: string[] | null
          id: string
          imagem_destaque: string
          material_apoio_disponivel: string[] | null
          metadata: Json | null
          motivo_rejeicao: string | null
          nivel_qualidade: number | null
          ordem_destaque: number | null
          palavras_chave: string | null
          politica_reembolso_marketplace: string | null
          preco_marketplace: number
          produto_id: string
          publico_alvo: string | null
          recorrencia_ativa: boolean | null
          revisado_em: string | null
          revisado_por: string | null
          status: Database["public"]["Enums"]["status_marketplace_produto"]
          subcategoria_marketplace: string | null
          subtitulo_marketplace: string | null
          tags_marketplace: string[] | null
          taxa_comissao_oferecida: number
          taxa_comissao_recorrente: number | null
          termos_condicoes_marketplace: string | null
          titulo_marketplace: string
          total_afiliados_ativos: number | null
          total_avaliacoes: number | null
          total_vendas_total: number | null
          updated_at: string
          url_pagina_obrigacoes: string | null
          url_pagina_vendas: string | null
          video_promocional_url: string | null
        }
        Insert: {
          avaliacao_media?: number | null
          categoria_marketplace?: string | null
          comissao_valor_fixo_oferecida?: number | null
          created_at?: string
          data_destaque?: string | null
          data_publicacao?: string | null
          deleted_at?: string | null
          descricao_marketplace: string
          destaque_marketplace?: boolean | null
          empresa_vendedora_id: string
          enviado_por?: string | null
          faixa_etaria?: string | null
          galeria_marketplace?: string[] | null
          id?: string
          imagem_destaque: string
          material_apoio_disponivel?: string[] | null
          metadata?: Json | null
          motivo_rejeicao?: string | null
          nivel_qualidade?: number | null
          ordem_destaque?: number | null
          palavras_chave?: string | null
          politica_reembolso_marketplace?: string | null
          preco_marketplace: number
          produto_id: string
          publico_alvo?: string | null
          recorrencia_ativa?: boolean | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["status_marketplace_produto"]
          subcategoria_marketplace?: string | null
          subtitulo_marketplace?: string | null
          tags_marketplace?: string[] | null
          taxa_comissao_oferecida?: number
          taxa_comissao_recorrente?: number | null
          termos_condicoes_marketplace?: string | null
          titulo_marketplace: string
          total_afiliados_ativos?: number | null
          total_avaliacoes?: number | null
          total_vendas_total?: number | null
          updated_at?: string
          url_pagina_obrigacoes?: string | null
          url_pagina_vendas?: string | null
          video_promocional_url?: string | null
        }
        Update: {
          avaliacao_media?: number | null
          categoria_marketplace?: string | null
          comissao_valor_fixo_oferecida?: number | null
          created_at?: string
          data_destaque?: string | null
          data_publicacao?: string | null
          deleted_at?: string | null
          descricao_marketplace?: string
          destaque_marketplace?: boolean | null
          empresa_vendedora_id?: string
          enviado_por?: string | null
          faixa_etaria?: string | null
          galeria_marketplace?: string[] | null
          id?: string
          imagem_destaque?: string
          material_apoio_disponivel?: string[] | null
          metadata?: Json | null
          motivo_rejeicao?: string | null
          nivel_qualidade?: number | null
          ordem_destaque?: number | null
          palavras_chave?: string | null
          politica_reembolso_marketplace?: string | null
          preco_marketplace?: number
          produto_id?: string
          publico_alvo?: string | null
          recorrencia_ativa?: boolean | null
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["status_marketplace_produto"]
          subcategoria_marketplace?: string | null
          subtitulo_marketplace?: string | null
          tags_marketplace?: string[] | null
          taxa_comissao_oferecida?: number
          taxa_comissao_recorrente?: number | null
          termos_condicoes_marketplace?: string | null
          titulo_marketplace?: string
          total_afiliados_ativos?: number | null
          total_avaliacoes?: number | null
          total_vendas_total?: number | null
          updated_at?: string
          url_pagina_obrigacoes?: string | null
          url_pagina_vendas?: string | null
          video_promocional_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_produtos_empresa_vendedora_id_fkey"
            columns: ["empresa_vendedora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_produtos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_produtos_produto_id_fkey"
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
      rede_afiliados_hierarquia: {
        Row: {
          afiliado_filho_id: string
          afiliado_pai_id: string
          ativa: boolean | null
          created_at: string
          data_associacao: string
          empresa_id: string
          id: string
          lado: string | null
          nivel: number
          posicao: number | null
        }
        Insert: {
          afiliado_filho_id: string
          afiliado_pai_id: string
          ativa?: boolean | null
          created_at?: string
          data_associacao?: string
          empresa_id: string
          id?: string
          lado?: string | null
          nivel?: number
          posicao?: number | null
        }
        Update: {
          afiliado_filho_id?: string
          afiliado_pai_id?: string
          ativa?: boolean | null
          created_at?: string
          data_associacao?: string
          empresa_id?: string
          id?: string
          lado?: string | null
          nivel?: number
          posicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rede_afiliados_hierarquia_afiliado_filho_id_fkey"
            columns: ["afiliado_filho_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rede_afiliados_hierarquia_afiliado_pai_id_fkey"
            columns: ["afiliado_pai_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rede_afiliados_hierarquia_empresa_id_fkey"
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
      status_afiliado: "pendente" | "ativo" | "inativo" | "suspenso" | "banido"
      status_ativo: "ativo" | "inativo" | "suspenso" | "bloqueado"
      status_checkout: "rascunho" | "publicado" | "arquivado"
      status_comissao:
        | "pendente"
        | "aprovada"
        | "liberada"
        | "paga"
        | "cancelada"
        | "estornada"
      status_cupom: "ativo" | "inativo" | "expirado"
      status_link_pagamento: "ativo" | "expirado" | "usado" | "desativado"
      status_marketplace_produto:
        | "pendente_aprovacao"
        | "publicado"
        | "rejeitado"
        | "arquivado"
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
      tipo_rede_afiliado: "uninivel" | "binario" | "matriz"
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
      status_afiliado: ["pendente", "ativo", "inativo", "suspenso", "banido"],
      status_ativo: ["ativo", "inativo", "suspenso", "bloqueado"],
      status_checkout: ["rascunho", "publicado", "arquivado"],
      status_comissao: [
        "pendente",
        "aprovada",
        "liberada",
        "paga",
        "cancelada",
        "estornada",
      ],
      status_cupom: ["ativo", "inativo", "expirado"],
      status_link_pagamento: ["ativo", "expirado", "usado", "desativado"],
      status_marketplace_produto: [
        "pendente_aprovacao",
        "publicado",
        "rejeitado",
        "arquivado",
      ],
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
      tipo_rede_afiliado: ["uninivel", "binario", "matriz"],
    },
  },
} as const
