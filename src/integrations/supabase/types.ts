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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_banimentos: {
        Row: {
          acoes_disparadas: Json | null
          apelacao_aceita: boolean | null
          aplicado_por: string | null
          created_at: string
          data_desfeito: string | null
          data_fim: string | null
          data_inicio: string
          desfeito: boolean | null
          desfeito_por: string | null
          detalhamento: string | null
          empresa_id: string | null
          evidencias_urls: string[] | null
          id: string
          identificador: string
          motivo_desfeito: string | null
          motivo_principal: string
          nivel_gravidade: string
          permanente: boolean | null
          profile_id: string | null
          revisado_em: string | null
          revisado_por: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          acoes_disparadas?: Json | null
          apelacao_aceita?: boolean | null
          aplicado_por?: string | null
          created_at?: string
          data_desfeito?: string | null
          data_fim?: string | null
          data_inicio?: string
          desfeito?: boolean | null
          desfeito_por?: string | null
          detalhamento?: string | null
          empresa_id?: string | null
          evidencias_urls?: string[] | null
          id?: string
          identificador: string
          motivo_desfeito?: string | null
          motivo_principal: string
          nivel_gravidade?: string
          permanente?: boolean | null
          profile_id?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          acoes_disparadas?: Json | null
          apelacao_aceita?: boolean | null
          aplicado_por?: string | null
          created_at?: string
          data_desfeito?: string | null
          data_fim?: string | null
          data_inicio?: string
          desfeito?: boolean | null
          desfeito_por?: string | null
          detalhamento?: string | null
          empresa_id?: string | null
          evidencias_urls?: string[] | null
          id?: string
          identificador?: string
          motivo_desfeito?: string | null
          motivo_principal?: string
          nivel_gravidade?: string
          permanente?: boolean | null
          profile_id?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_banimentos_aplicado_por_fkey"
            columns: ["aplicado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_banimentos_desfeito_por_fkey"
            columns: ["desfeito_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_banimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_banimentos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_banimentos_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_comunicados: {
        Row: {
          banner_cor: string | null
          created_at: string
          dados_popup: Json | null
          data_fim: string | null
          data_inicio: string
          data_publicacao: string | null
          deleted_at: string | null
          empresas_destino_ids: string[] | null
          id: string
          mensagem: string
          mostrar_banner_dashboard: boolean | null
          mostrar_email: boolean | null
          mostrar_popup: boolean | null
          nivel_importancia: number | null
          perfis_destino_ids: string[] | null
          publicado: boolean | null
          publicado_por: string | null
          publico_alvo: string | null
          requer_confirmacao: boolean | null
          tipo: string
          titulo: string
          total_confirmacoes: number | null
          total_visualizacoes: number | null
          updated_at: string
        }
        Insert: {
          banner_cor?: string | null
          created_at?: string
          dados_popup?: Json | null
          data_fim?: string | null
          data_inicio?: string
          data_publicacao?: string | null
          deleted_at?: string | null
          empresas_destino_ids?: string[] | null
          id?: string
          mensagem: string
          mostrar_banner_dashboard?: boolean | null
          mostrar_email?: boolean | null
          mostrar_popup?: boolean | null
          nivel_importancia?: number | null
          perfis_destino_ids?: string[] | null
          publicado?: boolean | null
          publicado_por?: string | null
          publico_alvo?: string | null
          requer_confirmacao?: boolean | null
          tipo?: string
          titulo: string
          total_confirmacoes?: number | null
          total_visualizacoes?: number | null
          updated_at?: string
        }
        Update: {
          banner_cor?: string | null
          created_at?: string
          dados_popup?: Json | null
          data_fim?: string | null
          data_inicio?: string
          data_publicacao?: string | null
          deleted_at?: string | null
          empresas_destino_ids?: string[] | null
          id?: string
          mensagem?: string
          mostrar_banner_dashboard?: boolean | null
          mostrar_email?: boolean | null
          mostrar_popup?: boolean | null
          nivel_importancia?: number | null
          perfis_destino_ids?: string[] | null
          publicado?: boolean | null
          publicado_por?: string | null
          publico_alvo?: string | null
          requer_confirmacao?: boolean | null
          tipo?: string
          titulo?: string
          total_confirmacoes?: number | null
          total_visualizacoes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_comunicados_publicado_por_fkey"
            columns: ["publicado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_empresas_gestao: {
        Row: {
          bloqueado_funcionalidades: string[] | null
          categoria_cliente: string | null
          contrato_assinado_url: string | null
          created_at: string
          dados_kpi_extras: Json | null
          data_ultima_revisao: string | null
          desconto_plano_percentual: number | null
          empresa_id: string
          id: string
          limites_customizados: Json | null
          observacoes_admin: string | null
          revisado_por: string | null
          risco_nivel: string | null
          risco_score: number | null
          tags_admin: string[] | null
          termo_adesao_assinado: string | null
          updated_at: string
          vip: boolean | null
        }
        Insert: {
          bloqueado_funcionalidades?: string[] | null
          categoria_cliente?: string | null
          contrato_assinado_url?: string | null
          created_at?: string
          dados_kpi_extras?: Json | null
          data_ultima_revisao?: string | null
          desconto_plano_percentual?: number | null
          empresa_id: string
          id?: string
          limites_customizados?: Json | null
          observacoes_admin?: string | null
          revisado_por?: string | null
          risco_nivel?: string | null
          risco_score?: number | null
          tags_admin?: string[] | null
          termo_adesao_assinado?: string | null
          updated_at?: string
          vip?: boolean | null
        }
        Update: {
          bloqueado_funcionalidades?: string[] | null
          categoria_cliente?: string | null
          contrato_assinado_url?: string | null
          created_at?: string
          dados_kpi_extras?: Json | null
          data_ultima_revisao?: string | null
          desconto_plano_percentual?: number | null
          empresa_id?: string
          id?: string
          limites_customizados?: Json | null
          observacoes_admin?: string | null
          revisado_por?: string | null
          risco_nivel?: string | null
          risco_score?: number | null
          tags_admin?: string[] | null
          termo_adesao_assinado?: string | null
          updated_at?: string
          vip?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_empresas_gestao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_empresas_gestao_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_global_config: {
        Row: {
          categoria: string | null
          chave: string
          created_at: string
          descricao: string | null
          id: string
          modulo: string | null
          publico: boolean | null
          sensivel: boolean | null
          somente_leitura: boolean | null
          tipo_valor: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          categoria?: string | null
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string | null
          publico?: boolean | null
          sensivel?: boolean | null
          somente_leitura?: boolean | null
          tipo_valor?: string
          updated_at?: string
          updated_by?: string | null
          valor: Json
        }
        Update: {
          categoria?: string | null
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          modulo?: string | null
          publico?: boolean | null
          sensivel?: boolean | null
          somente_leitura?: boolean | null
          tipo_valor?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_global_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_moderacao: {
        Row: {
          acoes_tomadas: Json | null
          analisado_em: string | null
          analisado_por: string | null
          atribuido_em: string | null
          atribuido_para: string | null
          categoria_risco: string | null
          checkout_reportado_id: string | null
          created_at: string
          decisao: string | null
          detalhe_decisao: string | null
          detalhe_motivo: string | null
          empresa_reportada_id: string | null
          evidencias: string[] | null
          id: string
          item_reportado_id: string | null
          marketplace_reportado_id: string | null
          motivo: string
          produto_reportado_id: string | null
          profile_reportado_id: string | null
          reportado_por: string | null
          sinalizacoes_count: number | null
          status: string
          tipo_item_reportado: string
          updated_at: string
        }
        Insert: {
          acoes_tomadas?: Json | null
          analisado_em?: string | null
          analisado_por?: string | null
          atribuido_em?: string | null
          atribuido_para?: string | null
          categoria_risco?: string | null
          checkout_reportado_id?: string | null
          created_at?: string
          decisao?: string | null
          detalhe_decisao?: string | null
          detalhe_motivo?: string | null
          empresa_reportada_id?: string | null
          evidencias?: string[] | null
          id?: string
          item_reportado_id?: string | null
          marketplace_reportado_id?: string | null
          motivo: string
          produto_reportado_id?: string | null
          profile_reportado_id?: string | null
          reportado_por?: string | null
          sinalizacoes_count?: number | null
          status?: string
          tipo_item_reportado: string
          updated_at?: string
        }
        Update: {
          acoes_tomadas?: Json | null
          analisado_em?: string | null
          analisado_por?: string | null
          atribuido_em?: string | null
          atribuido_para?: string | null
          categoria_risco?: string | null
          checkout_reportado_id?: string | null
          created_at?: string
          decisao?: string | null
          detalhe_decisao?: string | null
          detalhe_motivo?: string | null
          empresa_reportada_id?: string | null
          evidencias?: string[] | null
          id?: string
          item_reportado_id?: string | null
          marketplace_reportado_id?: string | null
          motivo?: string
          produto_reportado_id?: string | null
          profile_reportado_id?: string | null
          reportado_por?: string | null
          sinalizacoes_count?: number | null
          status?: string
          tipo_item_reportado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_moderacao_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_atribuido_para_fkey"
            columns: ["atribuido_para"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_checkout_reportado_id_fkey"
            columns: ["checkout_reportado_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_empresa_reportada_id_fkey"
            columns: ["empresa_reportada_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_marketplace_reportado_id_fkey"
            columns: ["marketplace_reportado_id"]
            isOneToOne: false
            referencedRelation: "marketplace_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_produto_reportado_id_fkey"
            columns: ["produto_reportado_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_profile_reportado_id_fkey"
            columns: ["profile_reportado_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_moderacao_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliado_cliques: {
        Row: {
          afiliado_id: string
          created_at: string
          dedupe_bucket: string
          dedupe_key: string
          empresa_id: string
          fingerprint_hash: string
          id: string
          ip_hash: string | null
          link_afiliado_id: string
          metadata: Json
          referrer_host: string | null
          user_agent_hash: string | null
        }
        Insert: {
          afiliado_id: string
          created_at?: string
          dedupe_bucket: string
          dedupe_key: string
          empresa_id: string
          fingerprint_hash: string
          id?: string
          ip_hash?: string | null
          link_afiliado_id: string
          metadata?: Json
          referrer_host?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          afiliado_id?: string
          created_at?: string
          dedupe_bucket?: string
          dedupe_key?: string
          empresa_id?: string
          fingerprint_hash?: string
          id?: string
          ip_hash?: string | null
          link_afiliado_id?: string
          metadata?: Json
          referrer_host?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afiliado_cliques_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliado_cliques_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliado_cliques_link_afiliado_id_fkey"
            columns: ["link_afiliado_id"]
            isOneToOne: false
            referencedRelation: "links_afiliados"
            referencedColumns: ["id"]
          },
        ]
      }
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
          encerrado_em: string | null
          encerrado_por: string | null
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
          status_alterado_em: string | null
          status_alterado_por: string | null
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
          encerrado_em?: string | null
          encerrado_por?: string | null
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
          status_alterado_em?: string | null
          status_alterado_por?: string | null
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
          encerrado_em?: string | null
          encerrado_por?: string | null
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
          status_alterado_em?: string | null
          status_alterado_por?: string | null
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
            foreignKeyName: "afiliados_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "afiliados_status_alterado_por_fkey"
            columns: ["status_alterado_por"]
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
          regra_atribuicao: Json
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
          regra_atribuicao?: Json
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
          regra_atribuicao?: Json
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
      ajuda_artigos: {
        Row: {
          anexos_urls: string[] | null
          atualizado_por: string | null
          avaliacao_media: number | null
          categoria_id: string | null
          conteudo: string
          conteudo_html: string | null
          created_at: string
          criado_por: string | null
          data_publicacao: string | null
          deleted_at: string | null
          destaque: boolean | null
          empresa_id: string | null
          id: string
          meta_descricao: string | null
          meta_titulo: string | null
          nivel_acesso_minimo: number | null
          ordem: number | null
          palavras_chave: string[] | null
          publico: boolean | null
          requer_autenticacao: boolean | null
          resumo: string | null
          slug: string
          status: string | null
          tags: string[] | null
          tempo_leitura_minutos: number | null
          titulo: string
          total_avaliacoes: number | null
          total_comentarios: number | null
          total_curtidas: number | null
          total_nao_curtidas: number | null
          total_visualizacoes: number | null
          total_visualizacoes_unicas: number | null
          updated_at: string
          versao: number | null
          video_url: string | null
        }
        Insert: {
          anexos_urls?: string[] | null
          atualizado_por?: string | null
          avaliacao_media?: number | null
          categoria_id?: string | null
          conteudo: string
          conteudo_html?: string | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string | null
          deleted_at?: string | null
          destaque?: boolean | null
          empresa_id?: string | null
          id?: string
          meta_descricao?: string | null
          meta_titulo?: string | null
          nivel_acesso_minimo?: number | null
          ordem?: number | null
          palavras_chave?: string[] | null
          publico?: boolean | null
          requer_autenticacao?: boolean | null
          resumo?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          tempo_leitura_minutos?: number | null
          titulo: string
          total_avaliacoes?: number | null
          total_comentarios?: number | null
          total_curtidas?: number | null
          total_nao_curtidas?: number | null
          total_visualizacoes?: number | null
          total_visualizacoes_unicas?: number | null
          updated_at?: string
          versao?: number | null
          video_url?: string | null
        }
        Update: {
          anexos_urls?: string[] | null
          atualizado_por?: string | null
          avaliacao_media?: number | null
          categoria_id?: string | null
          conteudo?: string
          conteudo_html?: string | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string | null
          deleted_at?: string | null
          destaque?: boolean | null
          empresa_id?: string | null
          id?: string
          meta_descricao?: string | null
          meta_titulo?: string | null
          nivel_acesso_minimo?: number | null
          ordem?: number | null
          palavras_chave?: string[] | null
          publico?: boolean | null
          requer_autenticacao?: boolean | null
          resumo?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          tempo_leitura_minutos?: number | null
          titulo?: string
          total_avaliacoes?: number | null
          total_comentarios?: number | null
          total_curtidas?: number | null
          total_nao_curtidas?: number | null
          total_visualizacoes?: number | null
          total_visualizacoes_unicas?: number | null
          updated_at?: string
          versao?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ajuda_artigos_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_artigos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "ajuda_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_artigos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_artigos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ajuda_categorias: {
        Row: {
          categoria_pai_id: string | null
          cor: string | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          publica: boolean | null
          slug: string
          total_artigos: number | null
          updated_at: string
        }
        Insert: {
          categoria_pai_id?: string | null
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          publica?: boolean | null
          slug: string
          total_artigos?: number | null
          updated_at?: string
        }
        Update: {
          categoria_pai_id?: string | null
          cor?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          publica?: boolean | null
          slug?: string
          total_artigos?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ajuda_categorias_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "ajuda_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ajuda_feedback: {
        Row: {
          artigo_id: string | null
          avaliacao: number | null
          cliente_id: string | null
          comentario: string | null
          created_at: string
          data_resposta: string | null
          foi_util: boolean | null
          id: string
          ip_address: string | null
          motivo_insatisfacao: string | null
          profile_id: string | null
          resolvido: boolean | null
          respondido_por: string | null
          resposta_equipe: string | null
          sugestao_melhoria: string | null
          ticket_id: string | null
          user_agent: string | null
        }
        Insert: {
          artigo_id?: string | null
          avaliacao?: number | null
          cliente_id?: string | null
          comentario?: string | null
          created_at?: string
          data_resposta?: string | null
          foi_util?: boolean | null
          id?: string
          ip_address?: string | null
          motivo_insatisfacao?: string | null
          profile_id?: string | null
          resolvido?: boolean | null
          respondido_por?: string | null
          resposta_equipe?: string | null
          sugestao_melhoria?: string | null
          ticket_id?: string | null
          user_agent?: string | null
        }
        Update: {
          artigo_id?: string | null
          avaliacao?: number | null
          cliente_id?: string | null
          comentario?: string | null
          created_at?: string
          data_resposta?: string | null
          foi_util?: boolean | null
          id?: string
          ip_address?: string | null
          motivo_insatisfacao?: string | null
          profile_id?: string | null
          resolvido?: boolean | null
          respondido_por?: string | null
          resposta_equipe?: string | null
          sugestao_melhoria?: string | null
          ticket_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ajuda_feedback_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "ajuda_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_feedback_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuda_feedback_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      chargebacks: {
        Row: {
          arquivos_defesa: string[] | null
          cliente_id: string | null
          codigo_chargeback_banco: string | null
          created_at: string
          data_decisao: string | null
          data_limite_resposta: string | null
          data_notificacao: string
          data_ocorrencia: string | null
          data_resposta_enviada: string | null
          decisao_final: string | null
          empresa_id: string
          fase_processo: number | null
          id: string
          metadata: Json | null
          moeda: string | null
          motivo_banco: string | null
          observacoes: string | null
          protocolo: string
          responsavel_defesa: string | null
          resposta_banco: string | null
          status: string
          texto_defesa: string | null
          transacao_id: string
          updated_at: string
          valor_chargeback: number
          valor_multa_banco: number | null
          valor_total_prejuizo: number
        }
        Insert: {
          arquivos_defesa?: string[] | null
          cliente_id?: string | null
          codigo_chargeback_banco?: string | null
          created_at?: string
          data_decisao?: string | null
          data_limite_resposta?: string | null
          data_notificacao?: string
          data_ocorrencia?: string | null
          data_resposta_enviada?: string | null
          decisao_final?: string | null
          empresa_id: string
          fase_processo?: number | null
          id?: string
          metadata?: Json | null
          moeda?: string | null
          motivo_banco?: string | null
          observacoes?: string | null
          protocolo: string
          responsavel_defesa?: string | null
          resposta_banco?: string | null
          status?: string
          texto_defesa?: string | null
          transacao_id: string
          updated_at?: string
          valor_chargeback: number
          valor_multa_banco?: number | null
          valor_total_prejuizo: number
        }
        Update: {
          arquivos_defesa?: string[] | null
          cliente_id?: string | null
          codigo_chargeback_banco?: string | null
          created_at?: string
          data_decisao?: string | null
          data_limite_resposta?: string | null
          data_notificacao?: string
          data_ocorrencia?: string | null
          data_resposta_enviada?: string | null
          decisao_final?: string | null
          empresa_id?: string
          fase_processo?: number | null
          id?: string
          metadata?: Json | null
          moeda?: string | null
          motivo_banco?: string | null
          observacoes?: string | null
          protocolo?: string
          responsavel_defesa?: string | null
          resposta_banco?: string | null
          status?: string
          texto_defesa?: string | null
          transacao_id?: string
          updated_at?: string
          valor_chargeback?: number
          valor_multa_banco?: number | null
          valor_total_prejuizo?: number
        }
        Relationships: [
          {
            foreignKeyName: "chargebacks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chargebacks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chargebacks_responsavel_defesa_fkey"
            columns: ["responsavel_defesa"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chargebacks_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_banners: {
        Row: {
          alt_text: string
          aspect_ratio_desktop: number | null
          aspect_ratio_mobile: number | null
          ativo: boolean
          checkout_id: string
          checkout_version_id: string
          created_at: string
          desktop_asset_id: string | null
          desktop_path: string | null
          destino_url: string | null
          empresa_id: string
          id: string
          mobile_asset_id: string | null
          mobile_path: string | null
          ordem: number
          posicao: string
          updated_at: string
        }
        Insert: {
          alt_text?: string
          aspect_ratio_desktop?: number | null
          aspect_ratio_mobile?: number | null
          ativo?: boolean
          checkout_id: string
          checkout_version_id: string
          created_at?: string
          desktop_asset_id?: string | null
          desktop_path?: string | null
          destino_url?: string | null
          empresa_id: string
          id?: string
          mobile_asset_id?: string | null
          mobile_path?: string | null
          ordem?: number
          posicao?: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          aspect_ratio_desktop?: number | null
          aspect_ratio_mobile?: number | null
          ativo?: boolean
          checkout_id?: string
          checkout_version_id?: string
          created_at?: string
          desktop_asset_id?: string | null
          desktop_path?: string | null
          destino_url?: string | null
          empresa_id?: string
          id?: string
          mobile_asset_id?: string | null
          mobile_path?: string | null
          ordem?: number
          posicao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_banners_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_banners_checkout_version_id_fkey"
            columns: ["checkout_version_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_banners_desktop_asset_id_fkey"
            columns: ["desktop_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_banners_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_banners_mobile_asset_id_fkey"
            columns: ["mobile_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_order_bumps: {
        Row: {
          apresentacao: Json
          ativo: boolean
          checkout_id: string
          checkout_version_id: string | null
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          desconto_fixo: number | null
          desconto_percentual: number | null
          descricao: string | null
          empresa_id: string
          grupo_combinacao: string | null
          id: string
          imagem_url: string | null
          max_selecao_grupo: number | null
          metadata: Json
          modo_preco: string
          oferta_id: string | null
          ordem: number
          preco_fixo: number | null
          produto_id: string
          regras_combinacao: Json
          texto_oferta: string | null
          tipo_preco: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          apresentacao?: Json
          ativo?: boolean
          checkout_id: string
          checkout_version_id?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          desconto_fixo?: number | null
          desconto_percentual?: number | null
          descricao?: string | null
          empresa_id: string
          grupo_combinacao?: string | null
          id?: string
          imagem_url?: string | null
          max_selecao_grupo?: number | null
          metadata?: Json
          modo_preco?: string
          oferta_id?: string | null
          ordem?: number
          preco_fixo?: number | null
          produto_id: string
          regras_combinacao?: Json
          texto_oferta?: string | null
          tipo_preco?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          apresentacao?: Json
          ativo?: boolean
          checkout_id?: string
          checkout_version_id?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          desconto_fixo?: number | null
          desconto_percentual?: number | null
          descricao?: string | null
          empresa_id?: string
          grupo_combinacao?: string | null
          id?: string
          imagem_url?: string | null
          max_selecao_grupo?: number | null
          metadata?: Json
          modo_preco?: string
          oferta_id?: string | null
          ordem?: number
          preco_fixo?: number | null
          produto_id?: string
          regras_combinacao?: Json
          texto_oferta?: string | null
          tipo_preco?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_order_bumps_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_order_bumps_checkout_version_id_fkey"
            columns: ["checkout_version_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_order_bumps_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_order_bumps_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_order_bumps_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_order_bumps_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_version_order_bumps: {
        Row: {
          checkout_id: string
          checkout_version_id: string
          created_at: string
          descricao_snapshot: string | null
          empresa_id: string
          grupo_combinacao: string | null
          id: string
          imagem_snapshot: string | null
          max_selecao_grupo: number | null
          ordem: number
          preco_publicado_snapshot: number
          produto_id: string
          regra_preco_snapshot: Json
          source_order_bump_id: string | null
          texto_oferta_snapshot: string | null
          titulo_snapshot: string
        }
        Insert: {
          checkout_id: string
          checkout_version_id: string
          created_at?: string
          descricao_snapshot?: string | null
          empresa_id: string
          grupo_combinacao?: string | null
          id?: string
          imagem_snapshot?: string | null
          max_selecao_grupo?: number | null
          ordem?: number
          preco_publicado_snapshot: number
          produto_id: string
          regra_preco_snapshot?: Json
          source_order_bump_id?: string | null
          texto_oferta_snapshot?: string | null
          titulo_snapshot: string
        }
        Update: {
          checkout_id?: string
          checkout_version_id?: string
          created_at?: string
          descricao_snapshot?: string | null
          empresa_id?: string
          grupo_combinacao?: string | null
          id?: string
          imagem_snapshot?: string | null
          max_selecao_grupo?: number | null
          ordem?: number
          preco_publicado_snapshot?: number
          produto_id?: string
          regra_preco_snapshot?: Json
          source_order_bump_id?: string | null
          texto_oferta_snapshot?: string | null
          titulo_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_version_order_bumps_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_version_order_bumps_checkout_version_id_fkey"
            columns: ["checkout_version_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_version_order_bumps_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_version_order_bumps_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_version_order_bumps_source_order_bump_id_fkey"
            columns: ["source_order_bump_id"]
            isOneToOne: false
            referencedRelation: "checkout_order_bumps"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_versions: {
        Row: {
          checkout_id: string
          config: Json
          created_at: string
          criado_por: string | null
          empresa_id: string
          estado: string
          id: string
          numero: number | null
          publicado_em: string | null
          publicado_por: string | null
          updated_at: string
          versao: number | null
        }
        Insert: {
          checkout_id: string
          config?: Json
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          estado: string
          id?: string
          numero?: number | null
          publicado_em?: string | null
          publicado_por?: string | null
          updated_at?: string
          versao?: number | null
        }
        Update: {
          checkout_id?: string
          config?: Json
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          estado?: string
          id?: string
          numero?: number | null
          publicado_em?: string | null
          publicado_por?: string | null
          updated_at?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_versions_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_versions_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_versions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_versions_publicado_por_fkey"
            columns: ["publicado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          afiliado_requerido: boolean | null
          atualizado_por: string | null
          banner_url: string | null
          created_at: string
          criado_por: string | null
          cupom_id: string | null
          cupons_aceitos: string[] | null
          customizacao_override: Json | null
          deleted_at: string | null
          desativado_em: string | null
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
          oferta_id: string | null
          permite_convidado: boolean | null
          permite_multiplos_cupons: boolean | null
          permitir_valor_personalizado: boolean | null
          pixel_facebook_id: string | null
          pixel_google_id: string | null
          politica_privacidade: string | null
          prazo_expiracao: number | null
          produto_id: string | null
          produtos_config: Json
          public_token: string
          publicacao_data: string | null
          publicado_versao_id: string | null
          rascunho_versao_id: string | null
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
          atualizado_por?: string | null
          banner_url?: string | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          cupons_aceitos?: string[] | null
          customizacao_override?: Json | null
          deleted_at?: string | null
          desativado_em?: string | null
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
          oferta_id?: string | null
          permite_convidado?: boolean | null
          permite_multiplos_cupons?: boolean | null
          permitir_valor_personalizado?: boolean | null
          pixel_facebook_id?: string | null
          pixel_google_id?: string | null
          politica_privacidade?: string | null
          prazo_expiracao?: number | null
          produto_id?: string | null
          produtos_config?: Json
          public_token?: string
          publicacao_data?: string | null
          publicado_versao_id?: string | null
          rascunho_versao_id?: string | null
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
          atualizado_por?: string | null
          banner_url?: string | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          cupons_aceitos?: string[] | null
          customizacao_override?: Json | null
          deleted_at?: string | null
          desativado_em?: string | null
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
          oferta_id?: string | null
          permite_convidado?: boolean | null
          permite_multiplos_cupons?: boolean | null
          permitir_valor_personalizado?: boolean | null
          pixel_facebook_id?: string | null
          pixel_google_id?: string | null
          politica_privacidade?: string | null
          prazo_expiracao?: number | null
          produto_id?: string | null
          produtos_config?: Json
          public_token?: string
          publicacao_data?: string | null
          publicado_versao_id?: string | null
          rascunho_versao_id?: string | null
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
            foreignKeyName: "checkouts_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "checkouts_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
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
            foreignKeyName: "checkouts_publicado_versao_fk"
            columns: ["publicado_versao_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_publicado_versao_id_fkey"
            columns: ["publicado_versao_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_rascunho_versao_fk"
            columns: ["rascunho_versao_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_rascunho_versao_id_fkey"
            columns: ["rascunho_versao_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
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
      cliques_afiliados: {
        Row: {
          afiliado_id: string
          contabilizado: boolean
          created_at: string
          empresa_id: string
          fingerprint_hash: string
          id: string
          link_afiliado_id: string
          produto_id: string | null
          referrer: string | null
        }
        Insert: {
          afiliado_id: string
          contabilizado?: boolean
          created_at?: string
          empresa_id: string
          fingerprint_hash: string
          id?: string
          link_afiliado_id: string
          produto_id?: string | null
          referrer?: string | null
        }
        Update: {
          afiliado_id?: string
          contabilizado?: boolean
          created_at?: string
          empresa_id?: string
          fingerprint_hash?: string
          id?: string
          link_afiliado_id?: string
          produto_id?: string | null
          referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliques_afiliados_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliques_afiliados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliques_afiliados_link_afiliado_id_fkey"
            columns: ["link_afiliado_id"]
            isOneToOne: false
            referencedRelation: "links_afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliques_afiliados_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
          valor_estornado: number
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
          valor_estornado?: number
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
          valor_estornado?: number
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
      comunidade_posts: {
        Row: {
          afiliado_id: string | null
          categoria: string | null
          corpo: string
          corpo_html: string | null
          created_at: string
          deleted_at: string | null
          destaque: boolean | null
          empresa_id: string | null
          fechado: boolean | null
          fixado: boolean | null
          id: string
          imagem_destaque: string | null
          melhor_resposta_id: string | null
          post_pai_id: string | null
          profile_id: string | null
          slug: string | null
          status: string | null
          tags: string[] | null
          tipo_post: string | null
          titulo: string
          total_comentarios: number | null
          total_compartilhamentos: number | null
          total_curtidas: number | null
          total_visualizacoes: number | null
          updated_at: string
        }
        Insert: {
          afiliado_id?: string | null
          categoria?: string | null
          corpo: string
          corpo_html?: string | null
          created_at?: string
          deleted_at?: string | null
          destaque?: boolean | null
          empresa_id?: string | null
          fechado?: boolean | null
          fixado?: boolean | null
          id?: string
          imagem_destaque?: string | null
          melhor_resposta_id?: string | null
          post_pai_id?: string | null
          profile_id?: string | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          tipo_post?: string | null
          titulo: string
          total_comentarios?: number | null
          total_compartilhamentos?: number | null
          total_curtidas?: number | null
          total_visualizacoes?: number | null
          updated_at?: string
        }
        Update: {
          afiliado_id?: string | null
          categoria?: string | null
          corpo?: string
          corpo_html?: string | null
          created_at?: string
          deleted_at?: string | null
          destaque?: boolean | null
          empresa_id?: string | null
          fechado?: boolean | null
          fixado?: boolean | null
          id?: string
          imagem_destaque?: string | null
          melhor_resposta_id?: string | null
          post_pai_id?: string | null
          profile_id?: string | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          tipo_post?: string | null
          titulo?: string
          total_comentarios?: number | null
          total_compartilhamentos?: number | null
          total_curtidas?: number | null
          total_visualizacoes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunidade_posts_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidade_posts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidade_posts_melhor_resposta_id_fkey"
            columns: ["melhor_resposta_id"]
            isOneToOne: false
            referencedRelation: "comunidade_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidade_posts_post_pai_id_fkey"
            columns: ["post_pai_id"]
            isOneToOne: false
            referencedRelation: "comunidade_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidade_posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          afiliado_id: string | null
          agencia: string
          agencia_dv: string | null
          banco_codigo: string
          banco_nome: string
          chave_pix: string | null
          conta: string
          conta_dv: string | null
          created_at: string
          data_verificacao: string | null
          deleted_at: string | null
          documento_titular: string
          documento_verificacao_url: string | null
          empresa_id: string | null
          id: string
          is_verificada: boolean | null
          metadata: Json | null
          principal: boolean | null
          profile_id: string | null
          tipo_chave_pix: string | null
          tipo_conta: Database["public"]["Enums"]["tipo_conta"]
          titular: string
          updated_at: string
        }
        Insert: {
          afiliado_id?: string | null
          agencia: string
          agencia_dv?: string | null
          banco_codigo: string
          banco_nome: string
          chave_pix?: string | null
          conta: string
          conta_dv?: string | null
          created_at?: string
          data_verificacao?: string | null
          deleted_at?: string | null
          documento_titular: string
          documento_verificacao_url?: string | null
          empresa_id?: string | null
          id?: string
          is_verificada?: boolean | null
          metadata?: Json | null
          principal?: boolean | null
          profile_id?: string | null
          tipo_chave_pix?: string | null
          tipo_conta?: Database["public"]["Enums"]["tipo_conta"]
          titular: string
          updated_at?: string
        }
        Update: {
          afiliado_id?: string | null
          agencia?: string
          agencia_dv?: string | null
          banco_codigo?: string
          banco_nome?: string
          chave_pix?: string | null
          conta?: string
          conta_dv?: string | null
          created_at?: string
          data_verificacao?: string | null
          deleted_at?: string | null
          documento_titular?: string
          documento_verificacao_url?: string | null
          empresa_id?: string | null
          id?: string
          is_verificada?: boolean | null
          metadata?: Json | null
          principal?: boolean | null
          profile_id?: string | null
          tipo_chave_pix?: string | null
          tipo_conta?: Database["public"]["Enums"]["tipo_conta"]
          titular?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_bancarias_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      distribuicoes_financeiras: {
        Row: {
          afiliado_id: string | null
          beneficiario_tipo: string
          chave_idempotencia: string
          created_at: string
          empresa_id: string
          id: string
          moeda: string
          pedido_id: string | null
          profile_id: string | null
          regra_snapshot: Json
          status: string
          transacao_id: string
          transferencia_bancaria_confirmada: boolean
          updated_at: string
          valor: number
          valor_revertido: number
          versao_regra: string
        }
        Insert: {
          afiliado_id?: string | null
          beneficiario_tipo: string
          chave_idempotencia: string
          created_at?: string
          empresa_id: string
          id?: string
          moeda?: string
          pedido_id?: string | null
          profile_id?: string | null
          regra_snapshot?: Json
          status?: string
          transacao_id: string
          transferencia_bancaria_confirmada?: boolean
          updated_at?: string
          valor: number
          valor_revertido?: number
          versao_regra: string
        }
        Update: {
          afiliado_id?: string | null
          beneficiario_tipo?: string
          chave_idempotencia?: string
          created_at?: string
          empresa_id?: string
          id?: string
          moeda?: string
          pedido_id?: string | null
          profile_id?: string | null
          regra_snapshot?: Json
          status?: string
          transacao_id?: string
          transferencia_bancaria_confirmada?: boolean
          updated_at?: string
          valor?: number
          valor_revertido?: number
          versao_regra?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribuicoes_financeiras_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_financeiras_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_financeiras_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicoes_financeiras_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
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
      equipe_membros: {
        Row: {
          adicionado_por: string | null
          carga_horaria_semanal: number | null
          cargo: string
          convite_id: string | null
          created_at: string
          data_admissao: string | null
          data_desligamento: string | null
          deleted_at: string | null
          departamento: string | null
          empresa_id: string
          id: string
          limite_aprovacao_valor: number | null
          metadata: Json | null
          numero_registro: string | null
          observacoes: string | null
          pode_assinar_documentos: boolean | null
          profile_id: string
          salario: number | null
          status: Database["public"]["Enums"]["status_ativo"]
          supervisor_direto: string | null
          updated_at: string
        }
        Insert: {
          adicionado_por?: string | null
          carga_horaria_semanal?: number | null
          cargo: string
          convite_id?: string | null
          created_at?: string
          data_admissao?: string | null
          data_desligamento?: string | null
          deleted_at?: string | null
          departamento?: string | null
          empresa_id: string
          id?: string
          limite_aprovacao_valor?: number | null
          metadata?: Json | null
          numero_registro?: string | null
          observacoes?: string | null
          pode_assinar_documentos?: boolean | null
          profile_id: string
          salario?: number | null
          status?: Database["public"]["Enums"]["status_ativo"]
          supervisor_direto?: string | null
          updated_at?: string
        }
        Update: {
          adicionado_por?: string | null
          carga_horaria_semanal?: number | null
          cargo?: string
          convite_id?: string | null
          created_at?: string
          data_admissao?: string | null
          data_desligamento?: string | null
          deleted_at?: string | null
          departamento?: string | null
          empresa_id?: string
          id?: string
          limite_aprovacao_valor?: number | null
          metadata?: Json | null
          numero_registro?: string | null
          observacoes?: string | null
          pode_assinar_documentos?: boolean | null
          profile_id?: string
          salario?: number | null
          status?: Database["public"]["Enums"]["status_ativo"]
          supervisor_direto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_membros_supervisor_direto_fkey"
            columns: ["supervisor_direto"]
            isOneToOne: false
            referencedRelation: "equipe_membros"
            referencedColumns: ["id"]
          },
        ]
      }
      estorno_processamento_tentativas: {
        Row: {
          created_at: string
          criada_por: string | null
          empresa_id: string
          erro: string | null
          estorno_id: string
          id: string
          idempotency_key: string
          provedor: string
          referencia_externa: string | null
          request_snapshot: Json
          response_snapshot: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criada_por?: string | null
          empresa_id: string
          erro?: string | null
          estorno_id: string
          id?: string
          idempotency_key: string
          provedor: string
          referencia_externa?: string | null
          request_snapshot?: Json
          response_snapshot?: Json
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criada_por?: string | null
          empresa_id?: string
          erro?: string | null
          estorno_id?: string
          id?: string
          idempotency_key?: string
          provedor?: string
          referencia_externa?: string | null
          request_snapshot?: Json
          response_snapshot?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estorno_processamento_tentativas_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_processamento_tentativas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_processamento_tentativas_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "estornos"
            referencedColumns: ["id"]
          },
        ]
      }
      estorno_split_reversoes: {
        Row: {
          afiliado_id: string | null
          beneficiario_tipo: string
          created_at: string
          empresa_id: string
          estorno_id: string
          id: string
          politica_snapshot: Json
          profile_id: string | null
          split_distribuicao_id: string | null
          transacao_id: string
          valor_acumulado_apos: number
          valor_delta: number
        }
        Insert: {
          afiliado_id?: string | null
          beneficiario_tipo: string
          created_at?: string
          empresa_id: string
          estorno_id: string
          id?: string
          politica_snapshot?: Json
          profile_id?: string | null
          split_distribuicao_id?: string | null
          transacao_id: string
          valor_acumulado_apos: number
          valor_delta: number
        }
        Update: {
          afiliado_id?: string | null
          beneficiario_tipo?: string
          created_at?: string
          empresa_id?: string
          estorno_id?: string
          id?: string
          politica_snapshot?: Json
          profile_id?: string | null
          split_distribuicao_id?: string | null
          transacao_id?: string
          valor_acumulado_apos?: number
          valor_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "estorno_split_reversoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_split_reversoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_split_reversoes_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "estornos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_split_reversoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_split_reversoes_split_distribuicao_id_fkey"
            columns: ["split_distribuicao_id"]
            isOneToOne: false
            referencedRelation: "split_distribuicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estorno_split_reversoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      estornos: {
        Row: {
          analisado_por: string | null
          aprovado_por: string | null
          cliente_id: string | null
          comprovantes_urls: string[] | null
          conciliado_em: string | null
          conciliado_por: string | null
          created_at: string
          dados_estorno_alternativo: Json | null
          data_analise: string | null
          data_aprovacao: string | null
          data_cancelamento: string | null
          data_conclusao: string | null
          data_solicitacao: string
          detalhamento_motivo: string | null
          empresa_id: string
          evidencia_conciliacao: string | null
          id: string
          id_estorno_gateway: string | null
          idempotency_key: string | null
          metadata: Json | null
          metodo_estorno: string | null
          modo_confirmacao: string | null
          modo_processamento: string
          motivo: string
          observacoes_internas: string | null
          ocorrencia_tipo: string
          pedido_cliente_motivo: string | null
          pedido_id: string | null
          protocolo: string
          provider_fee_refunded: number
          provider_payload: Json
          referencia_conciliacao: string | null
          regra_reversao_snapshot: Json
          rejeitado_por: string | null
          responsavel_conciliacao: string | null
          saque_relacionado_id: string | null
          solicitado_por: string | null
          status: Database["public"]["Enums"]["status_estorno"]
          taxa_estorno: number | null
          tipo_estorno: string
          tipo_ocorrencia: string
          transacao_id: string
          updated_at: string
          valor_aprovado_estorno: number | null
          valor_efetivamente_estornado: number | null
          valor_original: number
          valor_solicitado_estorno: number
        }
        Insert: {
          analisado_por?: string | null
          aprovado_por?: string | null
          cliente_id?: string | null
          comprovantes_urls?: string[] | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          created_at?: string
          dados_estorno_alternativo?: Json | null
          data_analise?: string | null
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_conclusao?: string | null
          data_solicitacao?: string
          detalhamento_motivo?: string | null
          empresa_id: string
          evidencia_conciliacao?: string | null
          id?: string
          id_estorno_gateway?: string | null
          idempotency_key?: string | null
          metadata?: Json | null
          metodo_estorno?: string | null
          modo_confirmacao?: string | null
          modo_processamento?: string
          motivo: string
          observacoes_internas?: string | null
          ocorrencia_tipo?: string
          pedido_cliente_motivo?: string | null
          pedido_id?: string | null
          protocolo: string
          provider_fee_refunded?: number
          provider_payload?: Json
          referencia_conciliacao?: string | null
          regra_reversao_snapshot?: Json
          rejeitado_por?: string | null
          responsavel_conciliacao?: string | null
          saque_relacionado_id?: string | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["status_estorno"]
          taxa_estorno?: number | null
          tipo_estorno?: string
          tipo_ocorrencia?: string
          transacao_id: string
          updated_at?: string
          valor_aprovado_estorno?: number | null
          valor_efetivamente_estornado?: number | null
          valor_original: number
          valor_solicitado_estorno: number
        }
        Update: {
          analisado_por?: string | null
          aprovado_por?: string | null
          cliente_id?: string | null
          comprovantes_urls?: string[] | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          created_at?: string
          dados_estorno_alternativo?: Json | null
          data_analise?: string | null
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_conclusao?: string | null
          data_solicitacao?: string
          detalhamento_motivo?: string | null
          empresa_id?: string
          evidencia_conciliacao?: string | null
          id?: string
          id_estorno_gateway?: string | null
          idempotency_key?: string | null
          metadata?: Json | null
          metodo_estorno?: string | null
          modo_confirmacao?: string | null
          modo_processamento?: string
          motivo?: string
          observacoes_internas?: string | null
          ocorrencia_tipo?: string
          pedido_cliente_motivo?: string | null
          pedido_id?: string | null
          protocolo?: string
          provider_fee_refunded?: number
          provider_payload?: Json
          referencia_conciliacao?: string | null
          regra_reversao_snapshot?: Json
          rejeitado_por?: string | null
          responsavel_conciliacao?: string | null
          saque_relacionado_id?: string | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["status_estorno"]
          taxa_estorno?: number | null
          tipo_estorno?: string
          tipo_ocorrencia?: string
          transacao_id?: string
          updated_at?: string
          valor_aprovado_estorno?: number | null
          valor_efetivamente_estornado?: number | null
          valor_original?: number
          valor_solicitado_estorno?: number
        }
        Relationships: [
          {
            foreignKeyName: "estornos_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_conciliado_por_fkey"
            columns: ["conciliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_rejeitado_por_fkey"
            columns: ["rejeitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_responsavel_conciliacao_fkey"
            columns: ["responsavel_conciliacao"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_saque_relacionado_id_fkey"
            columns: ["saque_relacionado_id"]
            isOneToOne: false
            referencedRelation: "saques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes: {
        Row: {
          categoria: string | null
          conectado_por: string | null
          config: Json | null
          connected_at: string | null
          created_at: string
          credenciais_criptografadas: Json | null
          deleted_at: string | null
          desconectado_por: string | null
          descricao: string | null
          disconnected_at: string | null
          empresa_id: string
          id: string
          last_error: string | null
          last_error_at: string | null
          last_sync_at: string | null
          logo_url: string | null
          metadata: Json | null
          nome_integracao: string
          provider: string
          rate_limit_por_dia: number | null
          rate_limit_por_minuto: number | null
          status: Database["public"]["Enums"]["status_integracao"]
          total_requisicoes: number | null
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          categoria?: string | null
          conectado_por?: string | null
          config?: Json | null
          connected_at?: string | null
          created_at?: string
          credenciais_criptografadas?: Json | null
          deleted_at?: string | null
          desconectado_por?: string | null
          descricao?: string | null
          disconnected_at?: string | null
          empresa_id: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          logo_url?: string | null
          metadata?: Json | null
          nome_integracao: string
          provider: string
          rate_limit_por_dia?: number | null
          rate_limit_por_minuto?: number | null
          status?: Database["public"]["Enums"]["status_integracao"]
          total_requisicoes?: number | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          categoria?: string | null
          conectado_por?: string | null
          config?: Json | null
          connected_at?: string | null
          created_at?: string
          credenciais_criptografadas?: Json | null
          deleted_at?: string | null
          desconectado_por?: string | null
          descricao?: string | null
          disconnected_at?: string | null
          empresa_id?: string
          id?: string
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          logo_url?: string | null
          metadata?: Json | null
          nome_integracao?: string
          provider?: string
          rate_limit_por_dia?: number | null
          rate_limit_por_minuto?: number | null
          status?: Database["public"]["Enums"]["status_integracao"]
          total_requisicoes?: number | null
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_conectado_por_fkey"
            columns: ["conectado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_desconectado_por_fkey"
            columns: ["desconectado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_catalogo: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          nome: string
          operational: boolean
          provider: string
          requires_secret: boolean
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          descricao?: string | null
          nome: string
          operational?: boolean
          provider: string
          requires_secret?: boolean
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          nome?: string
          operational?: boolean
          provider?: string
          requires_secret?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      integracoes_logs: {
        Row: {
          acao: string
          cabecalhos_requisicao: Json | null
          cabecalhos_resposta: Json | null
          corpo_requisicao: Json | null
          corpo_resposta: string | null
          created_at: string
          duracao_ms: number | null
          empresa_id: string
          endpoint_url: string | null
          id: string
          idempotency_key: string | null
          integracao_id: string
          mensagem_erro: string | null
          metodo_http: string | null
          status_resposta: number | null
          sucesso: boolean | null
          tentativa_numero: number | null
        }
        Insert: {
          acao: string
          cabecalhos_requisicao?: Json | null
          cabecalhos_resposta?: Json | null
          corpo_requisicao?: Json | null
          corpo_resposta?: string | null
          created_at?: string
          duracao_ms?: number | null
          empresa_id: string
          endpoint_url?: string | null
          id?: string
          idempotency_key?: string | null
          integracao_id: string
          mensagem_erro?: string | null
          metodo_http?: string | null
          status_resposta?: number | null
          sucesso?: boolean | null
          tentativa_numero?: number | null
        }
        Update: {
          acao?: string
          cabecalhos_requisicao?: Json | null
          cabecalhos_resposta?: Json | null
          corpo_requisicao?: Json | null
          corpo_resposta?: string | null
          created_at?: string
          duracao_ms?: number | null
          empresa_id?: string
          endpoint_url?: string | null
          id?: string
          idempotency_key?: string | null
          integracao_id?: string
          mensagem_erro?: string | null
          metodo_http?: string | null
          status_resposta?: number | null
          sucesso?: boolean | null
          tentativa_numero?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integracoes_logs_integracao_id_fkey"
            columns: ["integracao_id"]
            isOneToOne: false
            referencedRelation: "integracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          cargo: string | null
          codigo_convite: string
          convidado_por: string
          created_at: string
          email: string | null
          empresa_id: string
          expira_em: string
          id: string
          link_afiliado_base: string | null
          mensagem: string | null
          metadata: Json
          nome: string | null
          produtos_autorizados: string[]
          regras_afiliacao: Json
          revogado_em: string | null
          revogado_por: string | null
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
          email?: string | null
          empresa_id: string
          expira_em?: string
          id?: string
          link_afiliado_base?: string | null
          mensagem?: string | null
          metadata?: Json
          nome?: string | null
          produtos_autorizados?: string[]
          regras_afiliacao?: Json
          revogado_em?: string | null
          revogado_por?: string | null
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
          email?: string | null
          empresa_id?: string
          expira_em?: string
          id?: string
          link_afiliado_base?: string | null
          mensagem?: string | null
          metadata?: Json
          nome?: string | null
          produtos_autorizados?: string[]
          regras_afiliacao?: Json
          revogado_em?: string | null
          revogado_por?: string | null
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
            foreignKeyName: "invites_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      lancamentos_contabeis: {
        Row: {
          afiliado_id: string | null
          automatico: boolean | null
          bucket: string | null
          chave_idempotencia: string | null
          comissao_id: string | null
          competencia: string
          conta_contabil: string
          created_at: string
          criado_por: string | null
          data_lancamento: string
          descricao: string
          documento_referencia: string | null
          empresa_id: string | null
          estado: string
          estorno_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          moeda: string | null
          motivo_manual: string | null
          origem_id: string | null
          origem_tipo: string | null
          profile_id: string | null
          repasse_id: string | null
          reversao_de: string | null
          reversao_de_id: string | null
          saldo_anterior: number | null
          saldo_atual: number | null
          saque_id: string | null
          status: string
          tipo_lancamento: string
          transacao_id: string | null
          valor: number
        }
        Insert: {
          afiliado_id?: string | null
          automatico?: boolean | null
          bucket?: string | null
          chave_idempotencia?: string | null
          comissao_id?: string | null
          competencia: string
          conta_contabil: string
          created_at?: string
          criado_por?: string | null
          data_lancamento?: string
          descricao: string
          documento_referencia?: string | null
          empresa_id?: string | null
          estado?: string
          estorno_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          moeda?: string | null
          motivo_manual?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          profile_id?: string | null
          repasse_id?: string | null
          reversao_de?: string | null
          reversao_de_id?: string | null
          saldo_anterior?: number | null
          saldo_atual?: number | null
          saque_id?: string | null
          status?: string
          tipo_lancamento: string
          transacao_id?: string | null
          valor: number
        }
        Update: {
          afiliado_id?: string | null
          automatico?: boolean | null
          bucket?: string | null
          chave_idempotencia?: string | null
          comissao_id?: string | null
          competencia?: string
          conta_contabil?: string
          created_at?: string
          criado_por?: string | null
          data_lancamento?: string
          descricao?: string
          documento_referencia?: string | null
          empresa_id?: string | null
          estado?: string
          estorno_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          moeda?: string | null
          motivo_manual?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          profile_id?: string | null
          repasse_id?: string | null
          reversao_de?: string | null
          reversao_de_id?: string | null
          saldo_anterior?: number | null
          saldo_atual?: number | null
          saque_id?: string | null
          status?: string
          tipo_lancamento?: string
          transacao_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_contabeis_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "estornos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_repasse_id_fkey"
            columns: ["repasse_id"]
            isOneToOne: false
            referencedRelation: "repasses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_reversao_de_fkey"
            columns: ["reversao_de"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_reversao_de_id_fkey"
            columns: ["reversao_de_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_saque_id_fkey"
            columns: ["saque_id"]
            isOneToOne: false
            referencedRelation: "saques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      link_pagamento_reservas: {
        Row: {
          created_at: string
          empresa_id: string
          expira_em: string
          id: string
          link_pagamento_id: string
          pedido_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          expira_em: string
          id?: string
          link_pagamento_id: string
          pedido_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          link_pagamento_id?: string
          pedido_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_pagamento_reservas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_pagamento_reservas_link_pagamento_id_fkey"
            columns: ["link_pagamento_id"]
            isOneToOne: false
            referencedRelation: "links_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_pagamento_reservas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
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
          idempotency_key: string | null
          max_usos: number | null
          mensagem_sucesso_personalizada: string | null
          metadata: Json | null
          moeda: string | null
          nome_cliente_obrigatorio: boolean | null
          notificar_email_criador: boolean | null
          notificar_whatsapp_criador: boolean | null
          oferta_id: string | null
          permite_editar_valor: boolean | null
          produto_id: string | null
          public_token: string
          status: Database["public"]["Enums"]["status_link_pagamento"]
          telefone_cliente_obrigatorio: boolean | null
          termo_utm: string | null
          tipo: Database["public"]["Enums"]["tipo_link_pagamento"]
          titulo: string
          updated_at: string
          url_redirecionamento_sucesso: string | null
          uso_unico: boolean
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
          idempotency_key?: string | null
          max_usos?: number | null
          mensagem_sucesso_personalizada?: string | null
          metadata?: Json | null
          moeda?: string | null
          nome_cliente_obrigatorio?: boolean | null
          notificar_email_criador?: boolean | null
          notificar_whatsapp_criador?: boolean | null
          oferta_id?: string | null
          permite_editar_valor?: boolean | null
          produto_id?: string | null
          public_token?: string
          status?: Database["public"]["Enums"]["status_link_pagamento"]
          telefone_cliente_obrigatorio?: boolean | null
          termo_utm?: string | null
          tipo?: Database["public"]["Enums"]["tipo_link_pagamento"]
          titulo: string
          updated_at?: string
          url_redirecionamento_sucesso?: string | null
          uso_unico?: boolean
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
          idempotency_key?: string | null
          max_usos?: number | null
          mensagem_sucesso_personalizada?: string | null
          metadata?: Json | null
          moeda?: string | null
          nome_cliente_obrigatorio?: boolean | null
          notificar_email_criador?: boolean | null
          notificar_whatsapp_criador?: boolean | null
          oferta_id?: string | null
          permite_editar_valor?: boolean | null
          produto_id?: string | null
          public_token?: string
          status?: Database["public"]["Enums"]["status_link_pagamento"]
          telefone_cliente_obrigatorio?: boolean | null
          termo_utm?: string | null
          tipo?: Database["public"]["Enums"]["tipo_link_pagamento"]
          titulo?: string
          updated_at?: string
          url_redirecionamento_sucesso?: string | null
          uso_unico?: boolean
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
            foreignKeyName: "links_pagamento_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
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
      media_assets: {
        Row: {
          altura: number | null
          bucket: string
          created_at: string
          empresa_id: string
          enviado_por: string | null
          id: string
          largura: number | null
          mime_type: string
          path: string
          sha256: string | null
          status: string
          tamanho_bytes: number
          updated_at: string
        }
        Insert: {
          altura?: number | null
          bucket?: string
          created_at?: string
          empresa_id: string
          enviado_por?: string | null
          id?: string
          largura?: number | null
          mime_type: string
          path: string
          sha256?: string | null
          status?: string
          tamanho_bytes: number
          updated_at?: string
        }
        Update: {
          altura?: number | null
          bucket?: string
          created_at?: string
          empresa_id?: string
          enviado_por?: string | null
          id?: string
          largura?: number | null
          mime_type?: string
          path?: string
          sha256?: string | null
          status?: string
          tamanho_bytes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          afiliado_id: string | null
          agrupamento_chave: string | null
          arquivada: boolean | null
          canal_email: boolean | null
          canal_inapp: boolean | null
          canal_push: boolean | null
          canal_sms: boolean | null
          canal_whatsapp: boolean | null
          cliente_id: string | null
          cor: string | null
          created_at: string
          criada_por: string | null
          criada_sistema: boolean | null
          dados_relacionados: Json | null
          data_arquivamento: string | null
          data_envio_email: string | null
          data_envio_push: string | null
          data_envio_sms: string | null
          data_envio_whatsapp: string | null
          data_leitura: string | null
          dedupe_key: string | null
          deleted_at: string | null
          disparar_email_em: string | null
          email_enviado: boolean | null
          empresa_id: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          expira_em: string | null
          fixada: boolean | null
          icone: string | null
          id: string
          id_email_provedor: string | null
          imagem_url: string | null
          lida: boolean | null
          mensagem: string
          metadata: Json | null
          prioridade: number | null
          profile_id: string | null
          push_enviado: boolean | null
          resumo_curto: string | null
          sms_enviado: boolean | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
          updated_at: string
          url_destino: string | null
          whatsapp_enviado: boolean | null
        }
        Insert: {
          afiliado_id?: string | null
          agrupamento_chave?: string | null
          arquivada?: boolean | null
          canal_email?: boolean | null
          canal_inapp?: boolean | null
          canal_push?: boolean | null
          canal_sms?: boolean | null
          canal_whatsapp?: boolean | null
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          criada_por?: string | null
          criada_sistema?: boolean | null
          dados_relacionados?: Json | null
          data_arquivamento?: string | null
          data_envio_email?: string | null
          data_envio_push?: string | null
          data_envio_sms?: string | null
          data_envio_whatsapp?: string | null
          data_leitura?: string | null
          dedupe_key?: string | null
          deleted_at?: string | null
          disparar_email_em?: string | null
          email_enviado?: boolean | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          expira_em?: string | null
          fixada?: boolean | null
          icone?: string | null
          id?: string
          id_email_provedor?: string | null
          imagem_url?: string | null
          lida?: boolean | null
          mensagem: string
          metadata?: Json | null
          prioridade?: number | null
          profile_id?: string | null
          push_enviado?: boolean | null
          resumo_curto?: string | null
          sms_enviado?: boolean | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
          updated_at?: string
          url_destino?: string | null
          whatsapp_enviado?: boolean | null
        }
        Update: {
          afiliado_id?: string | null
          agrupamento_chave?: string | null
          arquivada?: boolean | null
          canal_email?: boolean | null
          canal_inapp?: boolean | null
          canal_push?: boolean | null
          canal_sms?: boolean | null
          canal_whatsapp?: boolean | null
          cliente_id?: string | null
          cor?: string | null
          created_at?: string
          criada_por?: string | null
          criada_sistema?: boolean | null
          dados_relacionados?: Json | null
          data_arquivamento?: string | null
          data_envio_email?: string | null
          data_envio_push?: string | null
          data_envio_sms?: string | null
          data_envio_whatsapp?: string | null
          data_leitura?: string | null
          dedupe_key?: string | null
          deleted_at?: string | null
          disparar_email_em?: string | null
          email_enviado?: boolean | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          expira_em?: string | null
          fixada?: boolean | null
          icone?: string | null
          id?: string
          id_email_provedor?: string | null
          imagem_url?: string | null
          lida?: boolean | null
          mensagem?: string
          metadata?: Json | null
          prioridade?: number | null
          profile_id?: string | null
          push_enviado?: boolean | null
          resumo_curto?: string | null
          sms_enviado?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_notificacao"]
          titulo?: string
          updated_at?: string
          url_destino?: string | null
          whatsapp_enviado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_entregas: {
        Row: {
          canal: string
          created_at: string
          erro: string | null
          id: string
          notificacao_id: string
          profile_id: string | null
          provedor_id: string | null
          proxima_tentativa_em: string | null
          status: string
          tentativa: number
          updated_at: string
        }
        Insert: {
          canal: string
          created_at?: string
          erro?: string | null
          id?: string
          notificacao_id: string
          profile_id?: string | null
          provedor_id?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          tentativa?: number
          updated_at?: string
        }
        Update: {
          canal?: string
          created_at?: string
          erro?: string | null
          id?: string
          notificacao_id?: string
          profile_id?: string | null
          provedor_id?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          tentativa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_entregas_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_entregas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_preferencias: {
        Row: {
          afiliado_id: string | null
          created_at: string
          dias_silenciosos: number[] | null
          horario_fim_silencioso: string | null
          horario_inicio_silencioso: string | null
          id: string
          profile_id: string
          receber_email: boolean | null
          receber_inapp: boolean | null
          receber_push: boolean | null
          receber_sms: boolean | null
          receber_whatsapp: boolean | null
          tipo_notificacao: string
          updated_at: string
        }
        Insert: {
          afiliado_id?: string | null
          created_at?: string
          dias_silenciosos?: number[] | null
          horario_fim_silencioso?: string | null
          horario_inicio_silencioso?: string | null
          id?: string
          profile_id: string
          receber_email?: boolean | null
          receber_inapp?: boolean | null
          receber_push?: boolean | null
          receber_sms?: boolean | null
          receber_whatsapp?: boolean | null
          tipo_notificacao: string
          updated_at?: string
        }
        Update: {
          afiliado_id?: string | null
          created_at?: string
          dias_silenciosos?: number[] | null
          horario_fim_silencioso?: string | null
          horario_inicio_silencioso?: string | null
          id?: string
          profile_id?: string
          receber_email?: boolean | null
          receber_inapp?: boolean | null
          receber_push?: boolean | null
          receber_sms?: boolean | null
          receber_whatsapp?: boolean | null
          tipo_notificacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_preferencias_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_preferencias_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_push_inscricoes: {
        Row: {
          ativo: boolean
          auth_ciphertext: string | null
          created_at: string
          device_id: string
          endpoint_ciphertext: string | null
          endpoint_hash: string
          erro_em: string | null
          erro_ultimo: string | null
          id: string
          p256dh_ciphertext: string | null
          profile_id: string
          ultimo_sucesso_em: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ativo?: boolean
          auth_ciphertext?: string | null
          created_at?: string
          device_id: string
          endpoint_ciphertext?: string | null
          endpoint_hash: string
          erro_em?: string | null
          erro_ultimo?: string | null
          id?: string
          p256dh_ciphertext?: string | null
          profile_id: string
          ultimo_sucesso_em?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ativo?: boolean
          auth_ciphertext?: string | null
          created_at?: string
          device_id?: string
          endpoint_ciphertext?: string | null
          endpoint_hash?: string
          erro_em?: string | null
          erro_ultimo?: string | null
          id?: string
          p256dh_ciphertext?: string | null
          profile_id?: string
          ultimo_sucesso_em?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_push_inscricoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ofertas: {
        Row: {
          condicoes: Json
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          idempotency_key: string | null
          metadata: Json
          moeda: string
          nome: string
          permitir_valor_personalizado: boolean
          preco: number
          preco_comparacao: number | null
          preco_original: number | null
          produto_id: string
          status: string
          updated_at: string
          valor_maximo: number | null
          valor_minimo: number | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          condicoes?: Json
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          moeda?: string
          nome: string
          permitir_valor_personalizado?: boolean
          preco: number
          preco_comparacao?: number | null
          preco_original?: number | null
          produto_id: string
          status?: string
          updated_at?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          condicoes?: Json
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          moeda?: string
          nome?: string
          permitir_valor_personalizado?: boolean
          preco?: number
          preco_comparacao?: number | null
          preco_original?: number | null
          produto_id?: string
          status?: string
          updated_at?: string
          valor_maximo?: number | null
          valor_minimo?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofertas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_estoque_reservas: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          pedido_id: string
          pedido_item_id: string
          produto_id: string
          quantidade: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          pedido_id: string
          pedido_item_id: string
          produto_id: string
          quantidade: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          pedido_id?: string
          pedido_item_id?: string
          produto_id?: string
          quantidade?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_estoque_reservas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_estoque_reservas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_estoque_reservas_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: true
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_estoque_reservas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          comissao_percentual_snapshot: number
          comissao_valor_snapshot: number | null
          created_at: string
          desconto_snapshot: number
          desconto_unitario: number
          descricao_snapshot: string | null
          empresa_id: string
          id: string
          imagem_snapshot: string | null
          item_chave: string | null
          nome_snapshot: string
          oferta_id: string | null
          order_bump_id: string | null
          pedido_id: string
          preco_base_unitario: number | null
          preco_final_unitario: number | null
          preco_unitario_snapshot: number | null
          produto_id: string
          quantidade: number
          regra_comissao_snapshot: Json
          regra_preco_snapshot: Json
          regras_comissao_snapshot: Json
          regras_preco_snapshot: Json
          subtotal: number | null
          taxa_comissao_percentual_snapshot: number | null
          tipo: string | null
          tipo_item: string | null
          total_snapshot: number | null
        }
        Insert: {
          comissao_percentual_snapshot?: number
          comissao_valor_snapshot?: number | null
          created_at?: string
          desconto_snapshot?: number
          desconto_unitario?: number
          descricao_snapshot?: string | null
          empresa_id: string
          id?: string
          imagem_snapshot?: string | null
          item_chave?: string | null
          nome_snapshot: string
          oferta_id?: string | null
          order_bump_id?: string | null
          pedido_id: string
          preco_base_unitario?: number | null
          preco_final_unitario?: number | null
          preco_unitario_snapshot?: number | null
          produto_id: string
          quantidade?: number
          regra_comissao_snapshot?: Json
          regra_preco_snapshot?: Json
          regras_comissao_snapshot?: Json
          regras_preco_snapshot?: Json
          subtotal?: number | null
          taxa_comissao_percentual_snapshot?: number | null
          tipo?: string | null
          tipo_item?: string | null
          total_snapshot?: number | null
        }
        Update: {
          comissao_percentual_snapshot?: number
          comissao_valor_snapshot?: number | null
          created_at?: string
          desconto_snapshot?: number
          desconto_unitario?: number
          descricao_snapshot?: string | null
          empresa_id?: string
          id?: string
          imagem_snapshot?: string | null
          item_chave?: string | null
          nome_snapshot?: string
          oferta_id?: string | null
          order_bump_id?: string | null
          pedido_id?: string
          preco_base_unitario?: number | null
          preco_final_unitario?: number | null
          preco_unitario_snapshot?: number | null
          produto_id?: string
          quantidade?: number
          regra_comissao_snapshot?: Json
          regra_preco_snapshot?: Json
          regras_comissao_snapshot?: Json
          regras_preco_snapshot?: Json
          subtotal?: number | null
          taxa_comissao_percentual_snapshot?: number | null
          tipo?: string | null
          tipo_item?: string | null
          total_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_order_bump_id_fkey"
            columns: ["order_bump_id"]
            isOneToOne: false
            referencedRelation: "checkout_order_bumps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          afiliado_id: string | null
          cancelado_em: string | null
          checkout_id: string | null
          checkout_versao_id: string | null
          checkout_version_id: string | null
          cliente_id: string | null
          comprador_documento: string | null
          comprador_email: string | null
          comprador_nome: string | null
          confirmado_em: string | null
          created_at: string
          criado_em: string
          desconto_total: number
          empresa_id: string
          id: string
          idempotency_key: string | null
          link_afiliado_id: string | null
          link_pagamento_id: string | null
          metadata: Json
          metodo_pagamento: string
          moeda: string
          numero: string
          oferta_id: string | null
          origem: string
          profile_id: string | null
          status: string
          status_pagamento: string
          subtotal: number
          total: number
          updated_at: string
          valor_comissoes: number
          valor_desconto: number
          valor_devolvido: number
          valor_taxas: number
          valor_total: number
        }
        Insert: {
          afiliado_id?: string | null
          cancelado_em?: string | null
          checkout_id?: string | null
          checkout_versao_id?: string | null
          checkout_version_id?: string | null
          cliente_id?: string | null
          comprador_documento?: string | null
          comprador_email?: string | null
          comprador_nome?: string | null
          confirmado_em?: string | null
          created_at?: string
          criado_em?: string
          desconto_total?: number
          empresa_id: string
          id?: string
          idempotency_key?: string | null
          link_afiliado_id?: string | null
          link_pagamento_id?: string | null
          metadata?: Json
          metodo_pagamento?: string
          moeda?: string
          numero: string
          oferta_id?: string | null
          origem?: string
          profile_id?: string | null
          status?: string
          status_pagamento?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valor_comissoes?: number
          valor_desconto?: number
          valor_devolvido?: number
          valor_taxas?: number
          valor_total?: number
        }
        Update: {
          afiliado_id?: string | null
          cancelado_em?: string | null
          checkout_id?: string | null
          checkout_versao_id?: string | null
          checkout_version_id?: string | null
          cliente_id?: string | null
          comprador_documento?: string | null
          comprador_email?: string | null
          comprador_nome?: string | null
          confirmado_em?: string | null
          created_at?: string
          criado_em?: string
          desconto_total?: number
          empresa_id?: string
          id?: string
          idempotency_key?: string | null
          link_afiliado_id?: string | null
          link_pagamento_id?: string | null
          metadata?: Json
          metodo_pagamento?: string
          moeda?: string
          numero?: string
          oferta_id?: string | null
          origem?: string
          profile_id?: string | null
          status?: string
          status_pagamento?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valor_comissoes?: number
          valor_desconto?: number
          valor_devolvido?: number
          valor_taxas?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_checkout_versao_id_fkey"
            columns: ["checkout_versao_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_checkout_version_id_fkey"
            columns: ["checkout_version_id"]
            isOneToOne: false
            referencedRelation: "checkout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_link_afiliado_id_fkey"
            columns: ["link_afiliado_id"]
            isOneToOne: false
            referencedRelation: "links_afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_link_pagamento_id_fkey"
            columns: ["link_pagamento_id"]
            isOneToOne: false
            referencedRelation: "links_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      pix_confirmacoes_manuais: {
        Row: {
          confirmado_em: string
          confirmado_por: string
          empresa_id: string
          evidencia: string
          id: string
          metadata: Json
          pedido_id: string | null
          recebedor_snapshot: Json
          referencia_bancaria: string
          transacao_id: string
          valor_confirmado: number
        }
        Insert: {
          confirmado_em?: string
          confirmado_por: string
          empresa_id: string
          evidencia: string
          id?: string
          metadata?: Json
          pedido_id?: string | null
          recebedor_snapshot?: Json
          referencia_bancaria: string
          transacao_id: string
          valor_confirmado: number
        }
        Update: {
          confirmado_em?: string
          confirmado_por?: string
          empresa_id?: string
          evidencia?: string
          id?: string
          metadata?: Json
          pedido_id?: string | null
          recebedor_snapshot?: Json
          referencia_bancaria?: string
          transacao_id?: string
          valor_confirmado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_confirmacoes_manuais_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_confirmacoes_manuais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_confirmacoes_manuais_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_confirmacoes_manuais_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: true
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
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
          estoque_reservado: number
          galeria_urls: string[] | null
          gerencia_estoque: boolean | null
          id: string
          idempotency_key: string | null
          imagem_principal_asset_id: string | null
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
          estoque_reservado?: number
          galeria_urls?: string[] | null
          gerencia_estoque?: boolean | null
          id?: string
          idempotency_key?: string | null
          imagem_principal_asset_id?: string | null
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
          estoque_reservado?: number
          galeria_urls?: string[] | null
          gerencia_estoque?: boolean | null
          id?: string
          idempotency_key?: string | null
          imagem_principal_asset_id?: string | null
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
          {
            foreignKeyName: "produtos_imagem_principal_asset_id_fkey"
            columns: ["imagem_principal_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_company_context: {
        Row: {
          empresa_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          empresa_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          empresa_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_company_context_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_company_context_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      relatorios_agendados: {
        Row: {
          assunto_email: string | null
          ativo: boolean | null
          colunas_exibidas: string[] | null
          compactar_arquivo: boolean | null
          corpo_email: string | null
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          destinatarios_emails: string[]
          destinatarios_profiles: string[] | null
          dia_mes: number | null
          dia_semana: number | null
          empresa_id: string
          enviar_se_sem_dados: boolean | null
          erro_ultimo: string | null
          filtros: Json | null
          formato: string | null
          frequencia: Database["public"]["Enums"]["frequencia_relatorio"]
          hora: string
          id: string
          nome_relatorio: string
          proximo_envio: string | null
          status: string | null
          tipo_relatorio: string
          total_enviados: number | null
          total_falhas: number | null
          ultimo_envio: string | null
          updated_at: string
          webhook_notificacao: string | null
          zip_senha_protegida: boolean | null
        }
        Insert: {
          assunto_email?: string | null
          ativo?: boolean | null
          colunas_exibidas?: string[] | null
          compactar_arquivo?: boolean | null
          corpo_email?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          destinatarios_emails?: string[]
          destinatarios_profiles?: string[] | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa_id: string
          enviar_se_sem_dados?: boolean | null
          erro_ultimo?: string | null
          filtros?: Json | null
          formato?: string | null
          frequencia: Database["public"]["Enums"]["frequencia_relatorio"]
          hora: string
          id?: string
          nome_relatorio: string
          proximo_envio?: string | null
          status?: string | null
          tipo_relatorio: string
          total_enviados?: number | null
          total_falhas?: number | null
          ultimo_envio?: string | null
          updated_at?: string
          webhook_notificacao?: string | null
          zip_senha_protegida?: boolean | null
        }
        Update: {
          assunto_email?: string | null
          ativo?: boolean | null
          colunas_exibidas?: string[] | null
          compactar_arquivo?: boolean | null
          corpo_email?: string | null
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          destinatarios_emails?: string[]
          destinatarios_profiles?: string[] | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa_id?: string
          enviar_se_sem_dados?: boolean | null
          erro_ultimo?: string | null
          filtros?: Json | null
          formato?: string | null
          frequencia?: Database["public"]["Enums"]["frequencia_relatorio"]
          hora?: string
          id?: string
          nome_relatorio?: string
          proximo_envio?: string | null
          status?: string | null
          tipo_relatorio?: string
          total_enviados?: number | null
          total_falhas?: number | null
          ultimo_envio?: string | null
          updated_at?: string
          webhook_notificacao?: string | null
          zip_senha_protegida?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_agendados_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_agendados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_historico: {
        Row: {
          agendamento_id: string | null
          created_at: string
          empresa_id: string | null
          error_message: string | null
          expira_em: string | null
          filtros_aplicados: Json | null
          formato: string
          gerado_por: string | null
          id: string
          nome_arquivo: string
          periodo_fim: string | null
          periodo_inicio: string | null
          profile_id: string | null
          status: string
          tamanho_bytes: number | null
          tempo_geracao_ms: number | null
          tipo_relatorio: string
          total_downloads: number | null
          total_registros: number | null
          total_visualizacoes: number | null
          url_arquivo: string | null
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          empresa_id?: string | null
          error_message?: string | null
          expira_em?: string | null
          filtros_aplicados?: Json | null
          formato: string
          gerado_por?: string | null
          id?: string
          nome_arquivo: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          profile_id?: string | null
          status?: string
          tamanho_bytes?: number | null
          tempo_geracao_ms?: number | null
          tipo_relatorio: string
          total_downloads?: number | null
          total_registros?: number | null
          total_visualizacoes?: number | null
          url_arquivo?: string | null
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          empresa_id?: string | null
          error_message?: string | null
          expira_em?: string | null
          filtros_aplicados?: Json | null
          formato?: string
          gerado_por?: string | null
          id?: string
          nome_arquivo?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          profile_id?: string | null
          status?: string
          tamanho_bytes?: number | null
          tempo_geracao_ms?: number | null
          tipo_relatorio?: string
          total_downloads?: number | null
          total_registros?: number | null
          total_visualizacoes?: number | null
          url_arquivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_historico_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "relatorios_agendados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_historico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_historico_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repasses: {
        Row: {
          comprovante_url: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_agendada: string | null
          data_confirmacao: string | null
          data_envio: string | null
          data_recebimento: string | null
          destinatario_documento: string
          destinatario_nome: string
          empresa_id: string
          enviado_por: string | null
          id: string
          id_repasse_externo: string | null
          metadata: Json | null
          metodo_repasse: string | null
          moeda: string | null
          observacoes: string | null
          parcela_id: string | null
          percentual_acordado: number | null
          status: Database["public"]["Enums"]["status_repasse"]
          taxa_administrativa: number | null
          transacao_id: string | null
          updated_at: string
          valor_bruto: number
          valor_liquido: number
        }
        Insert: {
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_agendada?: string | null
          data_confirmacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          destinatario_documento: string
          destinatario_nome: string
          empresa_id: string
          enviado_por?: string | null
          id?: string
          id_repasse_externo?: string | null
          metadata?: Json | null
          metodo_repasse?: string | null
          moeda?: string | null
          observacoes?: string | null
          parcela_id?: string | null
          percentual_acordado?: number | null
          status?: Database["public"]["Enums"]["status_repasse"]
          taxa_administrativa?: number | null
          transacao_id?: string | null
          updated_at?: string
          valor_bruto: number
          valor_liquido: number
        }
        Update: {
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_agendada?: string | null
          data_confirmacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          destinatario_documento?: string
          destinatario_nome?: string
          empresa_id?: string
          enviado_por?: string | null
          id?: string
          id_repasse_externo?: string | null
          metadata?: Json | null
          metodo_repasse?: string | null
          moeda?: string | null
          observacoes?: string | null
          parcela_id?: string | null
          percentual_acordado?: number | null
          status?: Database["public"]["Enums"]["status_repasse"]
          taxa_administrativa?: number | null
          transacao_id?: string | null
          updated_at?: string
          valor_bruto?: number
          valor_liquido?: number
        }
        Relationships: [
          {
            foreignKeyName: "repasses_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "transacoes_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasses_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      reversoes_financeiras: {
        Row: {
          afiliado_id: string | null
          chave_idempotencia: string
          componente: string
          created_at: string
          empresa_id: string
          estorno_id: string
          id: string
          regra_snapshot: Json
          transacao_id: string
          valor: number
        }
        Insert: {
          afiliado_id?: string | null
          chave_idempotencia: string
          componente: string
          created_at?: string
          empresa_id: string
          estorno_id: string
          id?: string
          regra_snapshot?: Json
          transacao_id: string
          valor: number
        }
        Update: {
          afiliado_id?: string | null
          chave_idempotencia?: string
          componente?: string
          created_at?: string
          empresa_id?: string
          estorno_id?: string
          id?: string
          regra_snapshot?: Json
          transacao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "reversoes_financeiras_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reversoes_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reversoes_financeiras_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "estornos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reversoes_financeiras_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
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
      saldos: {
        Row: {
          afiliado_id: string | null
          atualizado_em: string
          created_at: string
          empresa_id: string | null
          id: string
          moeda: string | null
          origem_calculo: string
          profile_id: string | null
          saldo_a_receber: number
          saldo_bloqueado: number
          saldo_bloqueado_operacional: number
          saldo_bruto: number
          saldo_devedor: number
          saldo_disponivel: number
          saldo_em_analise: number
          saldo_estornado: number
          saldo_liquidado: number
          saldo_previsao_liberar: number
          saldo_reservado: number
          total_com_impostos: number | null
          total_entrado_historico: number
          total_sacado: number
          total_saido_historico: number
          ultimo_movimento: string | null
        }
        Insert: {
          afiliado_id?: string | null
          atualizado_em?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          moeda?: string | null
          origem_calculo?: string
          profile_id?: string | null
          saldo_a_receber?: number
          saldo_bloqueado?: number
          saldo_bloqueado_operacional?: number
          saldo_bruto?: number
          saldo_devedor?: number
          saldo_disponivel?: number
          saldo_em_analise?: number
          saldo_estornado?: number
          saldo_liquidado?: number
          saldo_previsao_liberar?: number
          saldo_reservado?: number
          total_com_impostos?: number | null
          total_entrado_historico?: number
          total_sacado?: number
          total_saido_historico?: number
          ultimo_movimento?: string | null
        }
        Update: {
          afiliado_id?: string | null
          atualizado_em?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          moeda?: string | null
          origem_calculo?: string
          profile_id?: string | null
          saldo_a_receber?: number
          saldo_bloqueado?: number
          saldo_bloqueado_operacional?: number
          saldo_bruto?: number
          saldo_devedor?: number
          saldo_disponivel?: number
          saldo_em_analise?: number
          saldo_estornado?: number
          saldo_liquidado?: number
          saldo_previsao_liberar?: number
          saldo_reservado?: number
          total_com_impostos?: number | null
          total_entrado_historico?: number
          total_sacado?: number
          total_saido_historico?: number
          ultimo_movimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saldos_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saque_processamento_tentativas: {
        Row: {
          afiliado_id: string | null
          created_at: string
          criada_por: string | null
          empresa_id: string | null
          erro: string | null
          id: string
          idempotency_key: string
          provedor: string
          referencia_externa: string | null
          request_snapshot: Json
          response_snapshot: Json
          saque_id: string
          status: string
          updated_at: string
        }
        Insert: {
          afiliado_id?: string | null
          created_at?: string
          criada_por?: string | null
          empresa_id?: string | null
          erro?: string | null
          id?: string
          idempotency_key: string
          provedor: string
          referencia_externa?: string | null
          request_snapshot?: Json
          response_snapshot?: Json
          saque_id: string
          status: string
          updated_at?: string
        }
        Update: {
          afiliado_id?: string | null
          created_at?: string
          criada_por?: string | null
          empresa_id?: string | null
          erro?: string | null
          id?: string
          idempotency_key?: string
          provedor?: string
          referencia_externa?: string | null
          request_snapshot?: Json
          response_snapshot?: Json
          saque_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saque_processamento_tentativas_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saque_processamento_tentativas_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saque_processamento_tentativas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saque_processamento_tentativas_saque_id_fkey"
            columns: ["saque_id"]
            isOneToOne: false
            referencedRelation: "saques"
            referencedColumns: ["id"]
          },
        ]
      }
      saques: {
        Row: {
          afiliado_id: string | null
          analisado_por: string | null
          aprovado_por: string | null
          autenticacao_bancaria: string | null
          cancelado_por: string | null
          comissoes_ids: string[] | null
          comprovante_url: string | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_analise: string | null
          data_aprovacao: string | null
          data_cancelamento: string | null
          data_envio: string | null
          data_pagamento: string | null
          data_rejeicao: string | null
          data_solicitacao: string
          data_transferencia: string | null
          destino_snapshot: Json
          empresa_id: string | null
          evidencia_conciliacao: string | null
          evidencia_transferencia: string | null
          id: string
          id_transferencia_externa: string | null
          idempotency_key: string | null
          metadata: Json | null
          metodo_saque: string
          modo_processamento: string
          moeda: string | null
          motivo_cancelamento: string | null
          motivo_rejeicao: string | null
          observacoes: string | null
          profile_id: string | null
          protocolo: string
          provedor_transferencia: string | null
          referencia_conciliacao: string | null
          referencia_transferencia: string | null
          regra_taxa_snapshot: Json
          rejeitado_por: string | null
          reserva_criada_em: string | null
          reserva_liberada_em: string | null
          reservado_em: string | null
          responsavel_pagamento: string | null
          solicitado_por_profile_id: string | null
          status: Database["public"]["Enums"]["status_saque"]
          taxa_saque: number | null
          transacoes_ids: string[] | null
          ultima_consulta_provedor_em: string | null
          ultima_tentativa_em: string | null
          ultimo_erro_provedor: string | null
          updated_at: string
          valor_liquido: number
          valor_solicitado: number
        }
        Insert: {
          afiliado_id?: string | null
          analisado_por?: string | null
          aprovado_por?: string | null
          autenticacao_bancaria?: string | null
          cancelado_por?: string | null
          comissoes_ids?: string[] | null
          comprovante_url?: string | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_analise?: string | null
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_rejeicao?: string | null
          data_solicitacao?: string
          data_transferencia?: string | null
          destino_snapshot?: Json
          empresa_id?: string | null
          evidencia_conciliacao?: string | null
          evidencia_transferencia?: string | null
          id?: string
          id_transferencia_externa?: string | null
          idempotency_key?: string | null
          metadata?: Json | null
          metodo_saque?: string
          modo_processamento?: string
          moeda?: string | null
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          profile_id?: string | null
          protocolo: string
          provedor_transferencia?: string | null
          referencia_conciliacao?: string | null
          referencia_transferencia?: string | null
          regra_taxa_snapshot?: Json
          rejeitado_por?: string | null
          reserva_criada_em?: string | null
          reserva_liberada_em?: string | null
          reservado_em?: string | null
          responsavel_pagamento?: string | null
          solicitado_por_profile_id?: string | null
          status?: Database["public"]["Enums"]["status_saque"]
          taxa_saque?: number | null
          transacoes_ids?: string[] | null
          ultima_consulta_provedor_em?: string | null
          ultima_tentativa_em?: string | null
          ultimo_erro_provedor?: string | null
          updated_at?: string
          valor_liquido: number
          valor_solicitado: number
        }
        Update: {
          afiliado_id?: string | null
          analisado_por?: string | null
          aprovado_por?: string | null
          autenticacao_bancaria?: string | null
          cancelado_por?: string | null
          comissoes_ids?: string[] | null
          comprovante_url?: string | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_analise?: string | null
          data_aprovacao?: string | null
          data_cancelamento?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_rejeicao?: string | null
          data_solicitacao?: string
          data_transferencia?: string | null
          destino_snapshot?: Json
          empresa_id?: string | null
          evidencia_conciliacao?: string | null
          evidencia_transferencia?: string | null
          id?: string
          id_transferencia_externa?: string | null
          idempotency_key?: string | null
          metadata?: Json | null
          metodo_saque?: string
          modo_processamento?: string
          moeda?: string | null
          motivo_cancelamento?: string | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          profile_id?: string | null
          protocolo?: string
          provedor_transferencia?: string | null
          referencia_conciliacao?: string | null
          referencia_transferencia?: string | null
          regra_taxa_snapshot?: Json
          rejeitado_por?: string | null
          reserva_criada_em?: string | null
          reserva_liberada_em?: string | null
          reservado_em?: string | null
          responsavel_pagamento?: string | null
          solicitado_por_profile_id?: string | null
          status?: Database["public"]["Enums"]["status_saque"]
          taxa_saque?: number | null
          transacoes_ids?: string[] | null
          ultima_consulta_provedor_em?: string | null
          ultima_tentativa_em?: string | null
          ultimo_erro_provedor?: string | null
          updated_at?: string
          valor_liquido?: number
          valor_solicitado?: number
        }
        Relationships: [
          {
            foreignKeyName: "saques_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_conciliado_por_fkey"
            columns: ["conciliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_rejeitado_por_fkey"
            columns: ["rejeitado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_responsavel_pagamento_fkey"
            columns: ["responsavel_pagamento"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saques_solicitado_por_profile_id_fkey"
            columns: ["solicitado_por_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_2fa: {
        Row: {
          ativado_por: string | null
          chave_secreta_criptografada: string
          codigos_recuperacao: string[] | null
          confiavel: boolean | null
          created_at: string
          data_ativacao: string | null
          data_desativacao: string | null
          desativado_por: string | null
          email_registrado: string | null
          id: string
          is_primario: boolean | null
          metadata: Json | null
          metodo: string
          motivo_desativacao: string | null
          profile_id: string
          qrcode_url: string | null
          telefone_registrado: string | null
          total_falhas: number | null
          total_usos: number | null
          ultimo_uso: string | null
          updated_at: string
        }
        Insert: {
          ativado_por?: string | null
          chave_secreta_criptografada: string
          codigos_recuperacao?: string[] | null
          confiavel?: boolean | null
          created_at?: string
          data_ativacao?: string | null
          data_desativacao?: string | null
          desativado_por?: string | null
          email_registrado?: string | null
          id?: string
          is_primario?: boolean | null
          metadata?: Json | null
          metodo: string
          motivo_desativacao?: string | null
          profile_id: string
          qrcode_url?: string | null
          telefone_registrado?: string | null
          total_falhas?: number | null
          total_usos?: number | null
          ultimo_uso?: string | null
          updated_at?: string
        }
        Update: {
          ativado_por?: string | null
          chave_secreta_criptografada?: string
          codigos_recuperacao?: string[] | null
          confiavel?: boolean | null
          created_at?: string
          data_ativacao?: string | null
          data_desativacao?: string | null
          desativado_por?: string | null
          email_registrado?: string | null
          id?: string
          is_primario?: boolean | null
          metadata?: Json | null
          metodo?: string
          motivo_desativacao?: string | null
          profile_id?: string
          qrcode_url?: string | null
          telefone_registrado?: string | null
          total_falhas?: number | null
          total_usos?: number | null
          ultimo_uso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_2fa_ativado_por_fkey"
            columns: ["ativado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_2fa_desativado_por_fkey"
            columns: ["desativado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_2fa_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_audit_log: {
        Row: {
          acao: Database["public"]["Enums"]["tipo_audit_log"]
          afiliado_id: string | null
          alerta_disparado: boolean | null
          cidade: string | null
          cliente_id: string | null
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          descricao: string
          detalhes: Json | null
          empresa_id: string | null
          endpoint_url: string | null
          entidade: string | null
          entidade_id: string | null
          fk_registro_id: string | null
          fk_tabela_nome: string | null
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          metodo_http: string | null
          modulo: string | null
          pais: string | null
          profile_id: string | null
          risco_nivel: string | null
          risco_score: number | null
          sessao_id: string | null
          status_resposta: number | null
          user_agent: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["tipo_audit_log"]
          afiliado_id?: string | null
          alerta_disparado?: boolean | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          descricao: string
          detalhes?: Json | null
          empresa_id?: string | null
          endpoint_url?: string | null
          entidade?: string | null
          entidade_id?: string | null
          fk_registro_id?: string | null
          fk_tabela_nome?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          metodo_http?: string | null
          modulo?: string | null
          pais?: string | null
          profile_id?: string | null
          risco_nivel?: string | null
          risco_score?: number | null
          sessao_id?: string | null
          status_resposta?: number | null
          user_agent?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["tipo_audit_log"]
          afiliado_id?: string | null
          alerta_disparado?: boolean | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          descricao?: string
          detalhes?: Json | null
          empresa_id?: string | null
          endpoint_url?: string | null
          entidade?: string | null
          entidade_id?: string | null
          fk_registro_id?: string | null
          fk_tabela_nome?: string | null
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          metodo_http?: string | null
          modulo?: string | null
          pais?: string | null
          profile_id?: string | null
          risco_nivel?: string | null
          risco_score?: number | null
          sessao_id?: string | null
          status_resposta?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_audit_log_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_audit_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_audit_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_audit_log_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "seguranca_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_bloqueios: {
        Row: {
          alerta_enviado: boolean | null
          cidade: string | null
          contador_falhas: number | null
          created_at: string
          data_desbloqueio: string | null
          data_fim: string | null
          data_inicio: string
          desbloqueado: boolean | null
          desbloqueado_por: string | null
          id: string
          identificador: string
          ip_address: string | null
          motivo: string
          motivo_desbloqueio: string | null
          pais: string | null
          permanente: boolean | null
          profile_id: string | null
          tipo: string
        }
        Insert: {
          alerta_enviado?: boolean | null
          cidade?: string | null
          contador_falhas?: number | null
          created_at?: string
          data_desbloqueio?: string | null
          data_fim?: string | null
          data_inicio?: string
          desbloqueado?: boolean | null
          desbloqueado_por?: string | null
          id?: string
          identificador: string
          ip_address?: string | null
          motivo: string
          motivo_desbloqueio?: string | null
          pais?: string | null
          permanente?: boolean | null
          profile_id?: string | null
          tipo: string
        }
        Update: {
          alerta_enviado?: boolean | null
          cidade?: string | null
          contador_falhas?: number | null
          created_at?: string
          data_desbloqueio?: string | null
          data_fim?: string | null
          data_inicio?: string
          desbloqueado?: boolean | null
          desbloqueado_por?: string | null
          id?: string
          identificador?: string
          ip_address?: string | null
          motivo?: string
          motivo_desbloqueio?: string | null
          pais?: string | null
          permanente?: boolean | null
          profile_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_bloqueios_desbloqueado_por_fkey"
            columns: ["desbloqueado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_bloqueios_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_chaves_api: {
        Row: {
          ativa: boolean | null
          chave_hash: string
          chave_prefixo: string
          created_at: string
          criado_por: string | null
          data_criacao: string
          data_expiracao: string | null
          data_renovacao: string | null
          data_ultima_rotacao: string | null
          data_ultimo_uso: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          enderecos_ip_bloqueados: string[] | null
          enderecos_ip_permitidos: string[] | null
          escopos: string[] | null
          id: string
          metadata: Json | null
          motivo_revogacao: string | null
          nome: string
          permissoes: Json | null
          profile_id: string | null
          revogada_em: string | null
          revogada_por: string | null
          taxa_limite_por_dia: number | null
          taxa_limite_por_minuto: number | null
          tipo_chave: string
          total_requisicoes: number | null
          total_requisicoes_falha: number | null
          total_requisicoes_sucesso: number | null
          ultimo_ip_uso: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean | null
          chave_hash: string
          chave_prefixo: string
          created_at?: string
          criado_por?: string | null
          data_criacao?: string
          data_expiracao?: string | null
          data_renovacao?: string | null
          data_ultima_rotacao?: string | null
          data_ultimo_uso?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          enderecos_ip_bloqueados?: string[] | null
          enderecos_ip_permitidos?: string[] | null
          escopos?: string[] | null
          id?: string
          metadata?: Json | null
          motivo_revogacao?: string | null
          nome: string
          permissoes?: Json | null
          profile_id?: string | null
          revogada_em?: string | null
          revogada_por?: string | null
          taxa_limite_por_dia?: number | null
          taxa_limite_por_minuto?: number | null
          tipo_chave?: string
          total_requisicoes?: number | null
          total_requisicoes_falha?: number | null
          total_requisicoes_sucesso?: number | null
          ultimo_ip_uso?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean | null
          chave_hash?: string
          chave_prefixo?: string
          created_at?: string
          criado_por?: string | null
          data_criacao?: string
          data_expiracao?: string | null
          data_renovacao?: string | null
          data_ultima_rotacao?: string | null
          data_ultimo_uso?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          enderecos_ip_bloqueados?: string[] | null
          enderecos_ip_permitidos?: string[] | null
          escopos?: string[] | null
          id?: string
          metadata?: Json | null
          motivo_revogacao?: string | null
          nome?: string
          permissoes?: Json | null
          profile_id?: string | null
          revogada_em?: string | null
          revogada_por?: string | null
          taxa_limite_por_dia?: number | null
          taxa_limite_por_minuto?: number | null
          tipo_chave?: string
          total_requisicoes?: number | null
          total_requisicoes_falha?: number | null
          total_requisicoes_sucesso?: number | null
          ultimo_ip_uso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_chaves_api_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_chaves_api_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_chaves_api_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_chaves_api_revogada_por_fkey"
            columns: ["revogada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_dispositivos: {
        Row: {
          ativo: boolean | null
          bloqueado: boolean | null
          confirmado_por: string | null
          created_at: string
          data_confirmacao: string | null
          data_primeiro_acesso: string
          data_ultimo_acesso: string
          expira_em: string | null
          fingerprint: string
          id: string
          ip_primeiro_acesso: string | null
          marca: string | null
          metadata: Json | null
          modelo: string | null
          motivo_bloqueio: string | null
          navegador: string | null
          nome_dispositivo: string | null
          pais_primeiro_acesso: string | null
          profile_id: string
          sistema_operacional: string | null
          tipo_dispositivo: string | null
          user_agent: string | null
        }
        Insert: {
          ativo?: boolean | null
          bloqueado?: boolean | null
          confirmado_por?: string | null
          created_at?: string
          data_confirmacao?: string | null
          data_primeiro_acesso?: string
          data_ultimo_acesso?: string
          expira_em?: string | null
          fingerprint: string
          id?: string
          ip_primeiro_acesso?: string | null
          marca?: string | null
          metadata?: Json | null
          modelo?: string | null
          motivo_bloqueio?: string | null
          navegador?: string | null
          nome_dispositivo?: string | null
          pais_primeiro_acesso?: string | null
          profile_id: string
          sistema_operacional?: string | null
          tipo_dispositivo?: string | null
          user_agent?: string | null
        }
        Update: {
          ativo?: boolean | null
          bloqueado?: boolean | null
          confirmado_por?: string | null
          created_at?: string
          data_confirmacao?: string | null
          data_primeiro_acesso?: string
          data_ultimo_acesso?: string
          expira_em?: string | null
          fingerprint?: string
          id?: string
          ip_primeiro_acesso?: string | null
          marca?: string | null
          metadata?: Json | null
          modelo?: string | null
          motivo_bloqueio?: string | null
          navegador?: string | null
          nome_dispositivo?: string | null
          pais_primeiro_acesso?: string | null
          profile_id?: string
          sistema_operacional?: string | null
          tipo_dispositivo?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_dispositivos_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_dispositivos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_senhas_historico: {
        Row: {
          algoritmo: string | null
          created_at: string
          data_criacao: string
          data_ultimo_uso: string | null
          expirada: boolean | null
          id: string
          profile_id: string
          salt: string | null
          senha_hash: string
        }
        Insert: {
          algoritmo?: string | null
          created_at?: string
          data_criacao?: string
          data_ultimo_uso?: string | null
          expirada?: boolean | null
          id?: string
          profile_id: string
          salt?: string | null
          senha_hash: string
        }
        Update: {
          algoritmo?: string | null
          created_at?: string
          data_criacao?: string
          data_ultimo_uso?: string | null
          expirada?: boolean | null
          id?: string
          profile_id?: string
          salt?: string | null
          senha_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_senhas_historico_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_sessoes: {
        Row: {
          cep: string | null
          cidade: string | null
          coordenadas_geograficas: unknown
          created_at: string
          data_expiracao: string
          data_login: string
          data_logout: string | null
          data_ultima_atividade: string
          dispositivo: string | null
          dispositivo_tipo: string | null
          eh_dispositivo_confiavel: boolean | null
          empresa_id: string | null
          id: string
          ip_address: string
          metodo_2fa_usado: string | null
          navegador: string | null
          navegador_versao: string | null
          pais: string | null
          profile_id: string
          provedor_internet: string | null
          regiao: string | null
          session_id_auth: string | null
          sistema_operacional: string | null
          so_versao: string | null
          status: Database["public"]["Enums"]["status_sessao"]
          token_fingerprint: string | null
          user_agent: string
          verificacao_2fa_feita: boolean | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          coordenadas_geograficas?: unknown
          created_at?: string
          data_expiracao: string
          data_login?: string
          data_logout?: string | null
          data_ultima_atividade?: string
          dispositivo?: string | null
          dispositivo_tipo?: string | null
          eh_dispositivo_confiavel?: boolean | null
          empresa_id?: string | null
          id?: string
          ip_address: string
          metodo_2fa_usado?: string | null
          navegador?: string | null
          navegador_versao?: string | null
          pais?: string | null
          profile_id: string
          provedor_internet?: string | null
          regiao?: string | null
          session_id_auth?: string | null
          sistema_operacional?: string | null
          so_versao?: string | null
          status?: Database["public"]["Enums"]["status_sessao"]
          token_fingerprint?: string | null
          user_agent: string
          verificacao_2fa_feita?: boolean | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          coordenadas_geograficas?: unknown
          created_at?: string
          data_expiracao?: string
          data_login?: string
          data_logout?: string | null
          data_ultima_atividade?: string
          dispositivo?: string | null
          dispositivo_tipo?: string | null
          eh_dispositivo_confiavel?: boolean | null
          empresa_id?: string | null
          id?: string
          ip_address?: string
          metodo_2fa_usado?: string | null
          navegador?: string | null
          navegador_versao?: string | null
          pais?: string | null
          profile_id?: string
          provedor_internet?: string | null
          regiao?: string | null
          session_id_auth?: string | null
          sistema_operacional?: string | null
          so_versao?: string | null
          status?: Database["public"]["Enums"]["status_sessao"]
          token_fingerprint?: string | null
          user_agent?: string
          verificacao_2fa_feita?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_sessoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_webhooks: {
        Row: {
          algoritmo_assinatura: string | null
          ativo: boolean | null
          created_at: string
          data_ultimo_disparo: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          eventos_ouvidos: string[]
          headers_personalizados: Json | null
          id: string
          intervalo_entre_tentativas: number | null
          metodo_http: string | null
          nome: string
          profile_id: string | null
          revogado_em: string | null
          revogado_por: string | null
          segredo_assinatura: string
          segredo_prefixo: string | null
          segredo_vault_id: string | null
          tempo_limite_ms: number | null
          tentativas_max: number | null
          total_disparos: number | null
          total_falhas: number | null
          total_sucessos: number | null
          ultima_resposta_corpo: string | null
          ultima_resposta_status: number | null
          updated_at: string
          url_endpoint: string
          verificar_ssl: boolean | null
        }
        Insert: {
          algoritmo_assinatura?: string | null
          ativo?: boolean | null
          created_at?: string
          data_ultimo_disparo?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          eventos_ouvidos?: string[]
          headers_personalizados?: Json | null
          id?: string
          intervalo_entre_tentativas?: number | null
          metodo_http?: string | null
          nome: string
          profile_id?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          segredo_assinatura: string
          segredo_prefixo?: string | null
          segredo_vault_id?: string | null
          tempo_limite_ms?: number | null
          tentativas_max?: number | null
          total_disparos?: number | null
          total_falhas?: number | null
          total_sucessos?: number | null
          ultima_resposta_corpo?: string | null
          ultima_resposta_status?: number | null
          updated_at?: string
          url_endpoint: string
          verificar_ssl?: boolean | null
        }
        Update: {
          algoritmo_assinatura?: string | null
          ativo?: boolean | null
          created_at?: string
          data_ultimo_disparo?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          eventos_ouvidos?: string[]
          headers_personalizados?: Json | null
          id?: string
          intervalo_entre_tentativas?: number | null
          metodo_http?: string | null
          nome?: string
          profile_id?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          segredo_assinatura?: string
          segredo_prefixo?: string | null
          segredo_vault_id?: string | null
          tempo_limite_ms?: number | null
          tentativas_max?: number | null
          total_disparos?: number | null
          total_falhas?: number | null
          total_sucessos?: number | null
          ultima_resposta_corpo?: string | null
          ultima_resposta_status?: number | null
          updated_at?: string
          url_endpoint?: string
          verificar_ssl?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_webhooks_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_webhooks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seguranca_webhooks_revogado_por_fkey"
            columns: ["revogado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seguranca_webhooks_log: {
        Row: {
          assinatura_enviada: string | null
          corpo_requisicao: Json
          corpo_resposta: string | null
          created_at: string
          evento: string
          headers_resposta: Json | null
          id: string
          idempotency_key: string | null
          max_tentativas: number | null
          mensagem_erro: string | null
          status_resposta: number | null
          sucesso: boolean | null
          tempo_resposta_ms: number | null
          tentativa_numero: number | null
          webhook_id: string
        }
        Insert: {
          assinatura_enviada?: string | null
          corpo_requisicao: Json
          corpo_resposta?: string | null
          created_at?: string
          evento: string
          headers_resposta?: Json | null
          id?: string
          idempotency_key?: string | null
          max_tentativas?: number | null
          mensagem_erro?: string | null
          status_resposta?: number | null
          sucesso?: boolean | null
          tempo_resposta_ms?: number | null
          tentativa_numero?: number | null
          webhook_id: string
        }
        Update: {
          assinatura_enviada?: string | null
          corpo_requisicao?: Json
          corpo_resposta?: string | null
          created_at?: string
          evento?: string
          headers_resposta?: Json | null
          id?: string
          idempotency_key?: string | null
          max_tentativas?: number | null
          mensagem_erro?: string | null
          status_resposta?: number | null
          sucesso?: boolean | null
          tempo_resposta_ms?: number | null
          tentativa_numero?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seguranca_webhooks_log_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "seguranca_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      split_distribuicoes: {
        Row: {
          afiliado_id: string | null
          base_calculo: number
          beneficiario_tipo: string
          created_at: string
          empresa_id: string
          id: string
          pedido_id: string | null
          percentual_snapshot: number | null
          profile_id: string | null
          regra_id: string | null
          regra_snapshot: Json
          regra_versao: number | null
          transacao_id: string
          valor_distribuido: number
          valor_fixo_snapshot: number | null
          valor_revertido: number
        }
        Insert: {
          afiliado_id?: string | null
          base_calculo: number
          beneficiario_tipo: string
          created_at?: string
          empresa_id: string
          id?: string
          pedido_id?: string | null
          percentual_snapshot?: number | null
          profile_id?: string | null
          regra_id?: string | null
          regra_snapshot?: Json
          regra_versao?: number | null
          transacao_id: string
          valor_distribuido: number
          valor_fixo_snapshot?: number | null
          valor_revertido?: number
        }
        Update: {
          afiliado_id?: string | null
          base_calculo?: number
          beneficiario_tipo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          pedido_id?: string | null
          percentual_snapshot?: number | null
          profile_id?: string | null
          regra_id?: string | null
          regra_snapshot?: Json
          regra_versao?: number | null
          transacao_id?: string
          valor_distribuido?: number
          valor_fixo_snapshot?: number | null
          valor_revertido?: number
        }
        Relationships: [
          {
            foreignKeyName: "split_distribuicoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_distribuicoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_distribuicoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_distribuicoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_distribuicoes_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "split_regras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_distribuicoes_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      split_regra_beneficiarios: {
        Row: {
          afiliado_id: string | null
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          metadata: Json
          percentual: number
          prioridade: number
          profile_id: string | null
          split_regra_id: string
          tipo: string
          valor_fixo: number
        }
        Insert: {
          afiliado_id?: string | null
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          metadata?: Json
          percentual?: number
          prioridade?: number
          profile_id?: string | null
          split_regra_id: string
          tipo: string
          valor_fixo?: number
        }
        Update: {
          afiliado_id?: string | null
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          metadata?: Json
          percentual?: number
          prioridade?: number
          profile_id?: string | null
          split_regra_id?: string
          tipo?: string
          valor_fixo?: number
        }
        Relationships: [
          {
            foreignKeyName: "split_regra_beneficiarios_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_regra_beneficiarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_regra_beneficiarios_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_regra_beneficiarios_split_regra_id_fkey"
            columns: ["split_regra_id"]
            isOneToOne: false
            referencedRelation: "split_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      split_regras: {
        Row: {
          arredondamento: string
          base_calculo: string
          created_at: string
          criado_por: string | null
          empresa_id: string
          id: string
          metadata: Json
          nome: string
          status: string
          versao: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          arredondamento?: string
          base_calculo?: string
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          id?: string
          metadata?: Json
          nome: string
          status?: string
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          arredondamento?: string
          base_calculo?: string
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          id?: string
          metadata?: Json
          nome?: string
          status?: string
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_regras_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      suporte_canais_config: {
        Row: {
          ativo: boolean
          canal: string
          id: string
          label: string
          updated_at: string
          updated_by: string | null
          valor: string | null
        }
        Insert: {
          ativo?: boolean
          canal: string
          id?: string
          label: string
          updated_at?: string
          updated_by?: string | null
          valor?: string | null
        }
        Update: {
          ativo?: boolean
          canal?: string
          id?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suporte_canais_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      taxa_operacao_snapshots: {
        Row: {
          base_valor: number
          created_at: string
          empresa_id: string
          estorno_id: string | null
          fixo_snapshot: number
          id: string
          maximo_snapshot: number | null
          minimo_snapshot: number | null
          operacao: string
          percentual_snapshot: number
          regra_id: string | null
          regra_snapshot: Json
          saque_id: string | null
          transacao_id: string | null
          valor_calculado: number
        }
        Insert: {
          base_valor: number
          created_at?: string
          empresa_id: string
          estorno_id?: string | null
          fixo_snapshot?: number
          id?: string
          maximo_snapshot?: number | null
          minimo_snapshot?: number | null
          operacao: string
          percentual_snapshot?: number
          regra_id?: string | null
          regra_snapshot?: Json
          saque_id?: string | null
          transacao_id?: string | null
          valor_calculado: number
        }
        Update: {
          base_valor?: number
          created_at?: string
          empresa_id?: string
          estorno_id?: string | null
          fixo_snapshot?: number
          id?: string
          maximo_snapshot?: number | null
          minimo_snapshot?: number | null
          operacao?: string
          percentual_snapshot?: number
          regra_id?: string | null
          regra_snapshot?: Json
          saque_id?: string | null
          transacao_id?: string | null
          valor_calculado?: number
        }
        Relationships: [
          {
            foreignKeyName: "taxa_operacao_snapshots_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxa_operacao_snapshots_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "estornos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxa_operacao_snapshots_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "taxas_plataforma"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxa_operacao_snapshots_saque_id_fkey"
            columns: ["saque_id"]
            isOneToOne: false
            referencedRelation: "saques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxa_operacao_snapshots_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_plataforma: {
        Row: {
          alterado_por: string | null
          arredondamento: string
          ativo: boolean | null
          atualizado_por: string | null
          base_calculo: string
          created_at: string
          criado_por: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string
          dias_liquidacao: number | null
          empresa_id: string | null
          id: string
          is_padrao: boolean | null
          max_parcelas_sem_juros: number | null
          metodo_pagamento: Database["public"]["Enums"]["metodo_pagamento"]
          operacao: string
          plano: string
          prioridade: number
          reembolsar_em_estorno: boolean
          regra_snapshot: Json
          reverter_taxa_em_devolucao: boolean
          taxa_antecipacao_percentual: number | null
          taxa_boleto: number | null
          taxa_fixa: number
          taxa_maxima: number | null
          taxa_minima: number | null
          taxa_minima_saque: number | null
          taxa_parcelamento_por_parcela: number | null
          taxa_percentual: number
          taxa_pix_fixa: number | null
          taxa_pix_percentual: number | null
          taxa_saque_fixa: number | null
          taxa_saque_percentual: number | null
          updated_at: string
          versao: number
          vigencia_fim_em: string | null
          vigencia_inicio_em: string | null
        }
        Insert: {
          alterado_por?: string | null
          arredondamento?: string
          ativo?: boolean | null
          atualizado_por?: string | null
          base_calculo?: string
          created_at?: string
          criado_por?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string
          dias_liquidacao?: number | null
          empresa_id?: string | null
          id?: string
          is_padrao?: boolean | null
          max_parcelas_sem_juros?: number | null
          metodo_pagamento: Database["public"]["Enums"]["metodo_pagamento"]
          operacao?: string
          plano?: string
          prioridade?: number
          reembolsar_em_estorno?: boolean
          regra_snapshot?: Json
          reverter_taxa_em_devolucao?: boolean
          taxa_antecipacao_percentual?: number | null
          taxa_boleto?: number | null
          taxa_fixa?: number
          taxa_maxima?: number | null
          taxa_minima?: number | null
          taxa_minima_saque?: number | null
          taxa_parcelamento_por_parcela?: number | null
          taxa_percentual?: number
          taxa_pix_fixa?: number | null
          taxa_pix_percentual?: number | null
          taxa_saque_fixa?: number | null
          taxa_saque_percentual?: number | null
          updated_at?: string
          versao?: number
          vigencia_fim_em?: string | null
          vigencia_inicio_em?: string | null
        }
        Update: {
          alterado_por?: string | null
          arredondamento?: string
          ativo?: boolean | null
          atualizado_por?: string | null
          base_calculo?: string
          created_at?: string
          criado_por?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string
          dias_liquidacao?: number | null
          empresa_id?: string | null
          id?: string
          is_padrao?: boolean | null
          max_parcelas_sem_juros?: number | null
          metodo_pagamento?: Database["public"]["Enums"]["metodo_pagamento"]
          operacao?: string
          plano?: string
          prioridade?: number
          reembolsar_em_estorno?: boolean
          regra_snapshot?: Json
          reverter_taxa_em_devolucao?: boolean
          taxa_antecipacao_percentual?: number | null
          taxa_boleto?: number | null
          taxa_fixa?: number
          taxa_maxima?: number | null
          taxa_minima?: number | null
          taxa_minima_saque?: number | null
          taxa_parcelamento_por_parcela?: number | null
          taxa_percentual?: number
          taxa_pix_fixa?: number | null
          taxa_pix_percentual?: number | null
          taxa_saque_fixa?: number | null
          taxa_saque_percentual?: number | null
          updated_at?: string
          versao?: number
          vigencia_fim_em?: string | null
          vigencia_inicio_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taxas_plataforma_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxas_plataforma_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxas_plataforma_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxas_plataforma_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_plataforma_historico: {
        Row: {
          acao: string
          alterado_em: string
          alterado_por: string | null
          id: string
          snapshot: Json
          taxa_id: string
        }
        Insert: {
          acao: string
          alterado_em?: string
          alterado_por?: string | null
          id?: string
          snapshot: Json
          taxa_id: string
        }
        Update: {
          acao?: string
          alterado_em?: string
          alterado_por?: string | null
          id?: string
          snapshot?: Json
          taxa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxas_plataforma_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxas_plataforma_historico_taxa_id_fkey"
            columns: ["taxa_id"]
            isOneToOne: false
            referencedRelation: "taxas_plataforma"
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
      tickets: {
        Row: {
          aberto_por_email: string | null
          aberto_por_nome: string | null
          aberto_por_telefone: string | null
          afiliado_id: string | null
          anexos_urls: string[] | null
          assunto: string
          atribuido_em: string | null
          atribuido_para: string | null
          avaliacao_atendimento: number | null
          canal_origem: string | null
          categoria: string | null
          cliente_id: string | null
          comentario_avaliacao: string | null
          created_at: string
          data_fechamento: string | null
          data_primeira_resposta: string | null
          data_resolucao: string | null
          data_ultima_interacao: string
          deleted_at: string | null
          departamento_responsavel: string | null
          descricao: string
          empresa_id: string
          fechado_por: string | null
          fechado_satisfatorio: boolean | null
          id: string
          ip_origem: string | null
          metadata: Json | null
          numero_protocolo: string
          origem: string | null
          prioridade: Database["public"]["Enums"]["prioridade_ticket"]
          produto_relacionado_id: string | null
          profile_id: string | null
          reaberto_contador: number | null
          resolucao_descricao: string | null
          resolucao_tipo: string | null
          resolvido_por: string | null
          sla_data_maxima: string | null
          sla_tempo_resposta: number | null
          sla_violado: boolean | null
          status: Database["public"]["Enums"]["status_ticket"]
          tags: string[] | null
          tempo_total_resolucao_minutos: number | null
          tipo: Database["public"]["Enums"]["tipo_ticket"]
          transacao_relacionada_id: string | null
          updated_at: string
        }
        Insert: {
          aberto_por_email?: string | null
          aberto_por_nome?: string | null
          aberto_por_telefone?: string | null
          afiliado_id?: string | null
          anexos_urls?: string[] | null
          assunto: string
          atribuido_em?: string | null
          atribuido_para?: string | null
          avaliacao_atendimento?: number | null
          canal_origem?: string | null
          categoria?: string | null
          cliente_id?: string | null
          comentario_avaliacao?: string | null
          created_at?: string
          data_fechamento?: string | null
          data_primeira_resposta?: string | null
          data_resolucao?: string | null
          data_ultima_interacao?: string
          deleted_at?: string | null
          departamento_responsavel?: string | null
          descricao: string
          empresa_id: string
          fechado_por?: string | null
          fechado_satisfatorio?: boolean | null
          id?: string
          ip_origem?: string | null
          metadata?: Json | null
          numero_protocolo: string
          origem?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_ticket"]
          produto_relacionado_id?: string | null
          profile_id?: string | null
          reaberto_contador?: number | null
          resolucao_descricao?: string | null
          resolucao_tipo?: string | null
          resolvido_por?: string | null
          sla_data_maxima?: string | null
          sla_tempo_resposta?: number | null
          sla_violado?: boolean | null
          status?: Database["public"]["Enums"]["status_ticket"]
          tags?: string[] | null
          tempo_total_resolucao_minutos?: number | null
          tipo?: Database["public"]["Enums"]["tipo_ticket"]
          transacao_relacionada_id?: string | null
          updated_at?: string
        }
        Update: {
          aberto_por_email?: string | null
          aberto_por_nome?: string | null
          aberto_por_telefone?: string | null
          afiliado_id?: string | null
          anexos_urls?: string[] | null
          assunto?: string
          atribuido_em?: string | null
          atribuido_para?: string | null
          avaliacao_atendimento?: number | null
          canal_origem?: string | null
          categoria?: string | null
          cliente_id?: string | null
          comentario_avaliacao?: string | null
          created_at?: string
          data_fechamento?: string | null
          data_primeira_resposta?: string | null
          data_resolucao?: string | null
          data_ultima_interacao?: string
          deleted_at?: string | null
          departamento_responsavel?: string | null
          descricao?: string
          empresa_id?: string
          fechado_por?: string | null
          fechado_satisfatorio?: boolean | null
          id?: string
          ip_origem?: string | null
          metadata?: Json | null
          numero_protocolo?: string
          origem?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_ticket"]
          produto_relacionado_id?: string | null
          profile_id?: string | null
          reaberto_contador?: number | null
          resolucao_descricao?: string | null
          resolucao_tipo?: string | null
          resolvido_por?: string | null
          sla_data_maxima?: string | null
          sla_tempo_resposta?: number | null
          sla_violado?: boolean | null
          status?: Database["public"]["Enums"]["status_ticket"]
          tags?: string[] | null
          tempo_total_resolucao_minutos?: number | null
          tipo?: Database["public"]["Enums"]["tipo_ticket"]
          transacao_relacionada_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_atribuido_para_fkey"
            columns: ["atribuido_para"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_produto_relacionado_id_fkey"
            columns: ["produto_relacionado_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_transacao_relacionada_id_fkey"
            columns: ["transacao_relacionada_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_anexos: {
        Row: {
          created_at: string
          empresa_id: string
          file_name: string
          id: string
          mensagem_id: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          file_name: string
          id?: string
          mensagem_id?: string | null
          mime_type: string
          size_bytes: number
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          file_name?: string
          id?: string
          mensagem_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_anexos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_anexos_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "tickets_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_anexos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_anexos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_mensagens: {
        Row: {
          afiliado_id: string | null
          anexos_urls: string[] | null
          citada_mensagem_id: string | null
          cliente_id: string | null
          corpo_html: string | null
          corpo_mensagem: string
          created_at: string
          eh_nota_interna: boolean | null
          eh_resposta_automatica: boolean | null
          email_remetente: string | null
          empresa_id: string
          formato_mensagem: string | null
          id: string
          ip_address: string | null
          nome_remetente: string
          profile_id: string | null
          template_usado: string | null
          ticket_id: string
          tipo_remetente: string
          user_agent: string | null
          variaveis_template: Json | null
        }
        Insert: {
          afiliado_id?: string | null
          anexos_urls?: string[] | null
          citada_mensagem_id?: string | null
          cliente_id?: string | null
          corpo_html?: string | null
          corpo_mensagem: string
          created_at?: string
          eh_nota_interna?: boolean | null
          eh_resposta_automatica?: boolean | null
          email_remetente?: string | null
          empresa_id: string
          formato_mensagem?: string | null
          id?: string
          ip_address?: string | null
          nome_remetente: string
          profile_id?: string | null
          template_usado?: string | null
          ticket_id: string
          tipo_remetente: string
          user_agent?: string | null
          variaveis_template?: Json | null
        }
        Update: {
          afiliado_id?: string | null
          anexos_urls?: string[] | null
          citada_mensagem_id?: string | null
          cliente_id?: string | null
          corpo_html?: string | null
          corpo_mensagem?: string
          created_at?: string
          eh_nota_interna?: boolean | null
          eh_resposta_automatica?: boolean | null
          email_remetente?: string | null
          empresa_id?: string
          formato_mensagem?: string | null
          id?: string
          ip_address?: string | null
          nome_remetente?: string
          profile_id?: string | null
          template_usado?: string | null
          ticket_id?: string
          tipo_remetente?: string
          user_agent?: string | null
          variaveis_template?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_mensagens_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_mensagens_citada_mensagem_id_fkey"
            columns: ["citada_mensagem_id"]
            isOneToOne: false
            referencedRelation: "tickets_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_mensagens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes: {
        Row: {
          afiliado_id: string | null
          assinatura_id: string | null
          autorizacao_codigo: string | null
          cartao_bandeira: string | null
          cartao_final: string | null
          cartao_parcelado_mercado: boolean | null
          cartao_titular: string | null
          checkout_id: string | null
          cliente_id: string | null
          codigo_boleto_barras: string | null
          codigo_boleto_linha: string | null
          codigo_externo: string | null
          created_at: string
          criado_por: string | null
          cupom_id: string | null
          dados_entrega: Json | null
          data_disponivel: string | null
          data_estorno: string | null
          data_expiracao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          empresa_id: string
          endereco_cobranca: Json | null
          id: string
          id_transacao_gateway: string | null
          idempotency_key: string | null
          ip_cliente: string | null
          link_afiliado_id: string | null
          link_pagamento_id: string | null
          link_uso_contabilizado_em: string | null
          metadata: Json | null
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          moeda: string | null
          moeda_original: string | null
          notas_internas: string | null
          nsu: string | null
          oferta_id: string | null
          origem_dispositivo: string | null
          parcela_atual: number | null
          parcelas: number | null
          payload_provedor: Json
          pedido_id: string | null
          pedido_numero: string | null
          pix_chave_snapshot: string | null
          pix_copia_cola: string | null
          pix_expiracao: string | null
          pix_gerado_em: string | null
          pix_modo: string | null
          pix_qrcode: string | null
          pix_recebedor_cidade: string | null
          pix_recebedor_nome: string | null
          pix_txid: string | null
          produto_id: string | null
          profile_id: string | null
          provedor_pagamento: string | null
          regra_financeira_snapshot: Json
          regra_financeira_versao: string | null
          regras_antifraude: Json | null
          risco_nivel: string | null
          risco_score: number | null
          saldo_liberado_em: string | null
          saldo_processado_em: string | null
          saldo_revertido_em: string | null
          split_pagamento: Json | null
          status: Database["public"]["Enums"]["status_transacao"]
          status_detalhe_provedor: string | null
          taxa_cambio: number | null
          tid: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          updated_at: string
          url_callback: string | null
          valor_bruto: number
          valor_comissao_afiliado: number
          valor_descontos: number | null
          valor_impostos: number | null
          valor_juros: number | null
          valor_liquido: number
          valor_multa: number | null
          valor_original_moeda: number | null
          valor_parcela: number | null
          valor_saldo_empresa: number
          valor_taxa_antecipacao: number | null
          valor_taxa_plataforma: number | null
          valor_taxa_processamento: number | null
        }
        Insert: {
          afiliado_id?: string | null
          assinatura_id?: string | null
          autorizacao_codigo?: string | null
          cartao_bandeira?: string | null
          cartao_final?: string | null
          cartao_parcelado_mercado?: boolean | null
          cartao_titular?: string | null
          checkout_id?: string | null
          cliente_id?: string | null
          codigo_boleto_barras?: string | null
          codigo_boleto_linha?: string | null
          codigo_externo?: string | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          dados_entrega?: Json | null
          data_disponivel?: string | null
          data_estorno?: string | null
          data_expiracao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id: string
          endereco_cobranca?: Json | null
          id?: string
          id_transacao_gateway?: string | null
          idempotency_key?: string | null
          ip_cliente?: string | null
          link_afiliado_id?: string | null
          link_pagamento_id?: string | null
          link_uso_contabilizado_em?: string | null
          metadata?: Json | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          moeda?: string | null
          moeda_original?: string | null
          notas_internas?: string | null
          nsu?: string | null
          oferta_id?: string | null
          origem_dispositivo?: string | null
          parcela_atual?: number | null
          parcelas?: number | null
          payload_provedor?: Json
          pedido_id?: string | null
          pedido_numero?: string | null
          pix_chave_snapshot?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_gerado_em?: string | null
          pix_modo?: string | null
          pix_qrcode?: string | null
          pix_recebedor_cidade?: string | null
          pix_recebedor_nome?: string | null
          pix_txid?: string | null
          produto_id?: string | null
          profile_id?: string | null
          provedor_pagamento?: string | null
          regra_financeira_snapshot?: Json
          regra_financeira_versao?: string | null
          regras_antifraude?: Json | null
          risco_nivel?: string | null
          risco_score?: number | null
          saldo_liberado_em?: string | null
          saldo_processado_em?: string | null
          saldo_revertido_em?: string | null
          split_pagamento?: Json | null
          status?: Database["public"]["Enums"]["status_transacao"]
          status_detalhe_provedor?: string | null
          taxa_cambio?: number | null
          tid?: string | null
          tipo: Database["public"]["Enums"]["tipo_transacao"]
          updated_at?: string
          url_callback?: string | null
          valor_bruto: number
          valor_comissao_afiliado?: number
          valor_descontos?: number | null
          valor_impostos?: number | null
          valor_juros?: number | null
          valor_liquido: number
          valor_multa?: number | null
          valor_original_moeda?: number | null
          valor_parcela?: number | null
          valor_saldo_empresa?: number
          valor_taxa_antecipacao?: number | null
          valor_taxa_plataforma?: number | null
          valor_taxa_processamento?: number | null
        }
        Update: {
          afiliado_id?: string | null
          assinatura_id?: string | null
          autorizacao_codigo?: string | null
          cartao_bandeira?: string | null
          cartao_final?: string | null
          cartao_parcelado_mercado?: boolean | null
          cartao_titular?: string | null
          checkout_id?: string | null
          cliente_id?: string | null
          codigo_boleto_barras?: string | null
          codigo_boleto_linha?: string | null
          codigo_externo?: string | null
          created_at?: string
          criado_por?: string | null
          cupom_id?: string | null
          dados_entrega?: Json | null
          data_disponivel?: string | null
          data_estorno?: string | null
          data_expiracao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_id?: string
          endereco_cobranca?: Json | null
          id?: string
          id_transacao_gateway?: string | null
          idempotency_key?: string | null
          ip_cliente?: string | null
          link_afiliado_id?: string | null
          link_pagamento_id?: string | null
          link_uso_contabilizado_em?: string | null
          metadata?: Json | null
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          moeda?: string | null
          moeda_original?: string | null
          notas_internas?: string | null
          nsu?: string | null
          oferta_id?: string | null
          origem_dispositivo?: string | null
          parcela_atual?: number | null
          parcelas?: number | null
          payload_provedor?: Json
          pedido_id?: string | null
          pedido_numero?: string | null
          pix_chave_snapshot?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_gerado_em?: string | null
          pix_modo?: string | null
          pix_qrcode?: string | null
          pix_recebedor_cidade?: string | null
          pix_recebedor_nome?: string | null
          pix_txid?: string | null
          produto_id?: string | null
          profile_id?: string | null
          provedor_pagamento?: string | null
          regra_financeira_snapshot?: Json
          regra_financeira_versao?: string | null
          regras_antifraude?: Json | null
          risco_nivel?: string | null
          risco_score?: number | null
          saldo_liberado_em?: string | null
          saldo_processado_em?: string | null
          saldo_revertido_em?: string | null
          split_pagamento?: Json | null
          status?: Database["public"]["Enums"]["status_transacao"]
          status_detalhe_provedor?: string | null
          taxa_cambio?: number | null
          tid?: string | null
          tipo?: Database["public"]["Enums"]["tipo_transacao"]
          updated_at?: string
          url_callback?: string | null
          valor_bruto?: number
          valor_comissao_afiliado?: number
          valor_descontos?: number | null
          valor_impostos?: number | null
          valor_juros?: number | null
          valor_liquido?: number
          valor_multa?: number | null
          valor_original_moeda?: number | null
          valor_parcela?: number | null
          valor_saldo_empresa?: number
          valor_taxa_antecipacao?: number | null
          valor_taxa_plataforma?: number | null
          valor_taxa_processamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_link_afiliado_id_fkey"
            columns: ["link_afiliado_id"]
            isOneToOne: false
            referencedRelation: "links_afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_link_pagamento_id_fkey"
            columns: ["link_pagamento_id"]
            isOneToOne: false
            referencedRelation: "links_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes_parcelas: {
        Row: {
          created_at: string
          data_disponivel: string | null
          data_pagamento: string | null
          data_vencimento: string
          empresa_id: string
          id: string
          id_parcela_gateway: string | null
          numero_parcela: number
          saldo_devedor: number | null
          status: Database["public"]["Enums"]["status_transacao"]
          taxa_antecipacao: number | null
          total_parcelas: number
          transacao_id: string
          updated_at: string
          valor_amortizado: number | null
          valor_juros: number | null
          valor_liquido_parcela: number | null
          valor_parcela: number
          valor_taxa_processamento: number | null
        }
        Insert: {
          created_at?: string
          data_disponivel?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          empresa_id: string
          id?: string
          id_parcela_gateway?: string | null
          numero_parcela: number
          saldo_devedor?: number | null
          status?: Database["public"]["Enums"]["status_transacao"]
          taxa_antecipacao?: number | null
          total_parcelas: number
          transacao_id: string
          updated_at?: string
          valor_amortizado?: number | null
          valor_juros?: number | null
          valor_liquido_parcela?: number | null
          valor_parcela: number
          valor_taxa_processamento?: number | null
        }
        Update: {
          created_at?: string
          data_disponivel?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: string
          id?: string
          id_parcela_gateway?: string | null
          numero_parcela?: number
          saldo_devedor?: number | null
          status?: Database["public"]["Enums"]["status_transacao"]
          taxa_antecipacao?: number | null
          total_parcelas?: number
          transacao_id?: string
          updated_at?: string
          valor_amortizado?: number | null
          valor_juros?: number | null
          valor_liquido_parcela?: number | null
          valor_parcela?: number
          valor_taxa_processamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_parcelas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_parcelas_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos_aulas: {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          attachments: string[] | null
          conteudo_html: string | null
          conteudo_texto: string | null
          created_at: string
          curso_id: string
          descricao: string | null
          duracao_estimada_min: number | null
          empresa_id: string | null
          gratuito_previzualizacao: boolean | null
          id: string
          max_downloads: number | null
          min_tempo_segundos: number | null
          min_visualizacoes: number | null
          modulo_id: string
          nota_minima_aprovacao: number | null
          ordem: number
          perguntas_quiz: Json | null
          recursos_links: Json | null
          require_download: boolean | null
          tipo: Database["public"]["Enums"]["tipo_curso"]
          titulo: string
          total_comentarios: number | null
          updated_at: string
          url_externa: string | null
          video_duracao_segundos: number | null
          video_resolucoes: Json | null
          video_tipo: string | null
          video_url: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          attachments?: string[] | null
          conteudo_html?: string | null
          conteudo_texto?: string | null
          created_at?: string
          curso_id: string
          descricao?: string | null
          duracao_estimada_min?: number | null
          empresa_id?: string | null
          gratuito_previzualizacao?: boolean | null
          id?: string
          max_downloads?: number | null
          min_tempo_segundos?: number | null
          min_visualizacoes?: number | null
          modulo_id: string
          nota_minima_aprovacao?: number | null
          ordem?: number
          perguntas_quiz?: Json | null
          recursos_links?: Json | null
          require_download?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_curso"]
          titulo: string
          total_comentarios?: number | null
          updated_at?: string
          url_externa?: string | null
          video_duracao_segundos?: number | null
          video_resolucoes?: Json | null
          video_tipo?: string | null
          video_url?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          attachments?: string[] | null
          conteudo_html?: string | null
          conteudo_texto?: string | null
          created_at?: string
          curso_id?: string
          descricao?: string | null
          duracao_estimada_min?: number | null
          empresa_id?: string | null
          gratuito_previzualizacao?: boolean | null
          id?: string
          max_downloads?: number | null
          min_tempo_segundos?: number | null
          min_visualizacoes?: number | null
          modulo_id?: string
          nota_minima_aprovacao?: number | null
          ordem?: number
          perguntas_quiz?: Json | null
          recursos_links?: Json | null
          require_download?: boolean | null
          tipo?: Database["public"]["Enums"]["tipo_curso"]
          titulo?: string
          total_comentarios?: number | null
          updated_at?: string
          url_externa?: string | null
          video_duracao_segundos?: number | null
          video_resolucoes?: Json | null
          video_tipo?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_aulas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "treinamentos_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_aulas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "treinamentos_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos_cursos: {
        Row: {
          acesso_vitalicio: boolean | null
          aprendizados: string[] | null
          atualizado_por: string | null
          avaliacao_media: number | null
          capa_url: string | null
          carga_horaria_horas: number | null
          categoria: string | null
          certificado_disponivel: boolean | null
          created_at: string
          criado_por: string | null
          data_publicacao: string | null
          deleted_at: string | null
          descricao_curta: string | null
          descricao_longa: string | null
          destaque: boolean | null
          dias_validade: number | null
          duracao_total_minutos: number | null
          empresa_id: string | null
          gratuito: boolean | null
          id: string
          instrutor_avatar: string | null
          instrutor_bio: string | null
          instrutor_nome: string | null
          libera_afiliados: boolean | null
          modelo_certificado: string | null
          nivel: string | null
          permite_parcelamento: boolean | null
          preco: number | null
          publicado: boolean | null
          publico_alvo: string | null
          requisitos: string[] | null
          slug: string
          status: string | null
          subtitulo: string | null
          tags: string[] | null
          taxa_comissao_afiliado: number | null
          taxa_conclusao: number | null
          tipo: Database["public"]["Enums"]["tipo_curso"]
          titulo: string
          total_aulas: number | null
          total_avaliacoes: number | null
          total_concluidos: number | null
          total_matriculas: number | null
          total_modulos: number | null
          updated_at: string
          video_demo_url: string | null
        }
        Insert: {
          acesso_vitalicio?: boolean | null
          aprendizados?: string[] | null
          atualizado_por?: string | null
          avaliacao_media?: number | null
          capa_url?: string | null
          carga_horaria_horas?: number | null
          categoria?: string | null
          certificado_disponivel?: boolean | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string | null
          deleted_at?: string | null
          descricao_curta?: string | null
          descricao_longa?: string | null
          destaque?: boolean | null
          dias_validade?: number | null
          duracao_total_minutos?: number | null
          empresa_id?: string | null
          gratuito?: boolean | null
          id?: string
          instrutor_avatar?: string | null
          instrutor_bio?: string | null
          instrutor_nome?: string | null
          libera_afiliados?: boolean | null
          modelo_certificado?: string | null
          nivel?: string | null
          permite_parcelamento?: boolean | null
          preco?: number | null
          publicado?: boolean | null
          publico_alvo?: string | null
          requisitos?: string[] | null
          slug: string
          status?: string | null
          subtitulo?: string | null
          tags?: string[] | null
          taxa_comissao_afiliado?: number | null
          taxa_conclusao?: number | null
          tipo?: Database["public"]["Enums"]["tipo_curso"]
          titulo: string
          total_aulas?: number | null
          total_avaliacoes?: number | null
          total_concluidos?: number | null
          total_matriculas?: number | null
          total_modulos?: number | null
          updated_at?: string
          video_demo_url?: string | null
        }
        Update: {
          acesso_vitalicio?: boolean | null
          aprendizados?: string[] | null
          atualizado_por?: string | null
          avaliacao_media?: number | null
          capa_url?: string | null
          carga_horaria_horas?: number | null
          categoria?: string | null
          certificado_disponivel?: boolean | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string | null
          deleted_at?: string | null
          descricao_curta?: string | null
          descricao_longa?: string | null
          destaque?: boolean | null
          dias_validade?: number | null
          duracao_total_minutos?: number | null
          empresa_id?: string | null
          gratuito?: boolean | null
          id?: string
          instrutor_avatar?: string | null
          instrutor_bio?: string | null
          instrutor_nome?: string | null
          libera_afiliados?: boolean | null
          modelo_certificado?: string | null
          nivel?: string | null
          permite_parcelamento?: boolean | null
          preco?: number | null
          publicado?: boolean | null
          publico_alvo?: string | null
          requisitos?: string[] | null
          slug?: string
          status?: string | null
          subtitulo?: string | null
          tags?: string[] | null
          taxa_comissao_afiliado?: number | null
          taxa_conclusao?: number | null
          tipo?: Database["public"]["Enums"]["tipo_curso"]
          titulo?: string
          total_aulas?: number | null
          total_avaliacoes?: number | null
          total_concluidos?: number | null
          total_matriculas?: number | null
          total_modulos?: number | null
          updated_at?: string
          video_demo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_cursos_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_cursos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_cursos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos_matriculas: {
        Row: {
          afiliado_id: string | null
          aprovado: boolean | null
          certificado_emitido: boolean | null
          certificado_url: string | null
          cliente_id: string | null
          created_at: string
          curso_id: string
          data_certificado: string | null
          data_conclusao: string | null
          data_expiracao: string | null
          data_matricula: string
          empresa_id: string | null
          id: string
          metadata: Json | null
          motivo_cancelamento: string | null
          nota_final: number | null
          numero_certificado: string | null
          originou_de: string | null
          pausado_em: string | null
          profile_id: string
          progresso_percentual: number | null
          reativado_em: string | null
          status: Database["public"]["Enums"]["status_matricula"]
          tempo_total_estudado_seg: number | null
          total_aulas_concluidas: number | null
          transacao_id: string | null
          ultimo_acesso: string | null
          updated_at: string
          valor_pago: number | null
        }
        Insert: {
          afiliado_id?: string | null
          aprovado?: boolean | null
          certificado_emitido?: boolean | null
          certificado_url?: string | null
          cliente_id?: string | null
          created_at?: string
          curso_id: string
          data_certificado?: string | null
          data_conclusao?: string | null
          data_expiracao?: string | null
          data_matricula?: string
          empresa_id?: string | null
          id?: string
          metadata?: Json | null
          motivo_cancelamento?: string | null
          nota_final?: number | null
          numero_certificado?: string | null
          originou_de?: string | null
          pausado_em?: string | null
          profile_id: string
          progresso_percentual?: number | null
          reativado_em?: string | null
          status?: Database["public"]["Enums"]["status_matricula"]
          tempo_total_estudado_seg?: number | null
          total_aulas_concluidas?: number | null
          transacao_id?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Update: {
          afiliado_id?: string | null
          aprovado?: boolean | null
          certificado_emitido?: boolean | null
          certificado_url?: string | null
          cliente_id?: string | null
          created_at?: string
          curso_id?: string
          data_certificado?: string | null
          data_conclusao?: string | null
          data_expiracao?: string | null
          data_matricula?: string
          empresa_id?: string | null
          id?: string
          metadata?: Json | null
          motivo_cancelamento?: string | null
          nota_final?: number | null
          numero_certificado?: string | null
          originou_de?: string | null
          pausado_em?: string | null
          profile_id?: string
          progresso_percentual?: number | null
          reativado_em?: string | null
          status?: Database["public"]["Enums"]["status_matricula"]
          tempo_total_estudado_seg?: number | null
          total_aulas_concluidas?: number | null
          transacao_id?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_matriculas_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_matriculas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_matriculas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "treinamentos_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_matriculas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_matriculas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_matriculas_transacao_id_fkey"
            columns: ["transacao_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos_modulos: {
        Row: {
          aula_requisito_id: string | null
          created_at: string
          curso_id: string
          data_desbloqueio: string | null
          desbloqueio_automatico: boolean | null
          descricao: string | null
          duracao_total_minutos: number | null
          empresa_id: string | null
          id: string
          ordem: number
          titulo: string
          total_aulas: number | null
          updated_at: string
        }
        Insert: {
          aula_requisito_id?: string | null
          created_at?: string
          curso_id: string
          data_desbloqueio?: string | null
          desbloqueio_automatico?: boolean | null
          descricao?: string | null
          duracao_total_minutos?: number | null
          empresa_id?: string | null
          id?: string
          ordem?: number
          titulo: string
          total_aulas?: number | null
          updated_at?: string
        }
        Update: {
          aula_requisito_id?: string | null
          created_at?: string
          curso_id?: string
          data_desbloqueio?: string | null
          desbloqueio_automatico?: boolean | null
          descricao?: string | null
          duracao_total_minutos?: number | null
          empresa_id?: string | null
          id?: string
          ordem?: number
          titulo?: string
          total_aulas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "treinamentos_cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_modulos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamentos_progresso: {
        Row: {
          aula_id: string
          concluida: boolean | null
          created_at: string
          data_conclusao: string | null
          downloads_feitos: number | null
          id: string
          matricula_id: string
          nota_quiz: number | null
          primeiro_acesso: string | null
          profile_id: string
          quiz_tentativas: number | null
          tempo_assistido_seg: number | null
          total_acessos: number | null
          ultima_posicao_video_seg: number | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          aula_id: string
          concluida?: boolean | null
          created_at?: string
          data_conclusao?: string | null
          downloads_feitos?: number | null
          id?: string
          matricula_id: string
          nota_quiz?: number | null
          primeiro_acesso?: string | null
          profile_id: string
          quiz_tentativas?: number | null
          tempo_assistido_seg?: number | null
          total_acessos?: number | null
          ultima_posicao_video_seg?: number | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          aula_id?: string
          concluida?: boolean | null
          created_at?: string
          data_conclusao?: string | null
          downloads_feitos?: number | null
          id?: string
          matricula_id?: string
          nota_quiz?: number | null
          primeiro_acesso?: string | null
          profile_id?: string
          quiz_tentativas?: number | null
          tempo_assistido_seg?: number | null
          total_acessos?: number | null
          ultima_posicao_video_seg?: number | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamentos_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_progresso_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "treinamentos_matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_progresso_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_entregas: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          empresa_id: string
          id: string
          last_error: string | null
          last_status: number | null
          max_tentativas: number
          outbox_id: string
          proxima_tentativa_em: string
          status: string
          tentativa_atual: number
          updated_at: string
          webhook_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          last_error?: string | null
          last_status?: number | null
          max_tentativas?: number
          outbox_id: string
          proxima_tentativa_em?: string
          status?: string
          tentativa_atual?: number
          updated_at?: string
          webhook_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          last_error?: string | null
          last_status?: number | null
          max_tentativas?: number
          outbox_id?: string
          proxima_tentativa_em?: string
          status?: string
          tentativa_atual?: number
          updated_at?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_entregas_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "webhook_eventos_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_entregas_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "seguranca_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_eventos_outbox: {
        Row: {
          created_at: string
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          event_key: string
          evento: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          event_key: string
          evento: string
          id?: string
          payload: Json
        }
        Update: {
          created_at?: string
          empresa_id?: string
          entidade_id?: string
          entidade_tipo?: string
          event_key?: string
          evento?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "webhook_eventos_outbox_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          error: string | null
          event_type: string
          external_event_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          attempts?: number
          error?: string | null
          event_type: string
          external_event_id: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          attempts?: number
          error?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transacoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_empresa_id: { Args: never; Returns: string }
      fn_aceitar_convite_afiliado: {
        Args: { p_token: string }
        Returns: string
      }
      fn_admin_ajuda_artigo_salvar: {
        Args: {
          p_categoria_id: string
          p_conteudo: string
          p_destaque: boolean
          p_id: string
          p_publico: boolean
          p_resumo: string
          p_status: string
          p_titulo: string
        }
        Returns: string
      }
      fn_admin_ajuda_artigos: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          categoria_id: string
          categoria_nome: string
          conteudo: string
          destaque: boolean
          id: string
          publico: boolean
          resumo: string
          status: string
          tempo_leitura_minutos: number
          titulo: string
          updated_at: string
        }[]
      }
      fn_admin_ajuda_categoria_salvar: {
        Args: {
          p_descricao: string
          p_id: string
          p_nome: string
          p_ordem?: number
          p_publica: boolean
        }
        Returns: string
      }
      fn_admin_ajuda_categorias: {
        Args: never
        Returns: {
          descricao: string
          id: string
          nome: string
          ordem: number
          publica: boolean
          slug: string
          updated_at: string
        }[]
      }
      fn_admin_banimento_revogar: {
        Args: { p_id: string; p_motivo: string }
        Returns: boolean
      }
      fn_admin_banimentos_list: {
        Args: { p_active?: boolean }
        Returns: {
          aplicado_por_nome: string
          created_at: string
          data_fim: string
          data_inicio: string
          desfeito: boolean
          detalhamento: string
          empresa_id: string
          empresa_nome: string
          gravidade: string
          id: string
          identificador: string
          motivo: string
          permanente: boolean
          profile_id: string
          profile_nome: string
          tipo: string
        }[]
      }
      fn_admin_banir: {
        Args: {
          p_data_fim?: string
          p_detalhamento?: string
          p_empresa_id: string
          p_gravidade?: string
          p_identificador: string
          p_motivo: string
          p_permanente?: boolean
          p_profile_id: string
          p_tipo: string
        }
        Returns: string
      }
      fn_admin_bootstrap_platform: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      fn_admin_comunicado_arquivar: { Args: { p_id: string }; Returns: boolean }
      fn_admin_comunicado_criar: {
        Args: {
          p_fim?: string
          p_importancia?: number
          p_inicio?: string
          p_mensagem: string
          p_publico: string
          p_requer_confirmacao?: boolean
          p_tipo: string
          p_titulo: string
        }
        Returns: string
      }
      fn_admin_comunicado_publicar: { Args: { p_id: string }; Returns: number }
      fn_admin_comunicados_list: {
        Args: never
        Returns: {
          created_at: string
          data_fim: string
          data_inicio: string
          data_publicacao: string
          id: string
          mensagem: string
          nivel_importancia: number
          publicado: boolean
          publico_alvo: string
          requer_confirmacao: boolean
          tipo: string
          titulo: string
          total_confirmacoes: number
          total_visualizacoes: number
        }[]
      }
      fn_admin_config_list: {
        Args: never
        Returns: {
          categoria: string
          chave: string
          descricao: string
          id: string
          modulo: string
          publico: boolean
          sensivel: boolean
          somente_leitura: boolean
          tipo_valor: string
          updated_at: string
          valor: Json
        }[]
      }
      fn_admin_config_set: {
        Args: { p_key: string; p_value: Json }
        Returns: boolean
      }
      fn_admin_dashboard_global: { Args: { p_days?: number }; Returns: Json }
      fn_admin_empresa_set: {
        Args: {
          p_empresa_id: string
          p_observacao?: string
          p_plano?: string
          p_risco_nivel?: string
          p_risco_score?: number
          p_status?: string
          p_vip?: boolean
        }
        Returns: boolean
      }
      fn_admin_empresas_list: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_plano?: string
          p_query?: string
          p_status?: string
        }
        Returns: {
          cidade: string
          cnpj: string
          created_at: string
          devolucoes: number
          email: string
          estado: string
          id: string
          nome: string
          owner_email: string
          owner_nome: string
          pedidos_confirmados: number
          plano: string
          razao_social: string
          risco_nivel: string
          risco_score: number
          saques_pendentes: number
          status: string
          total_registros: number
          updated_at: string
          usuarios: number
          vip: boolean
          volume_confirmado: number
        }[]
      }
      fn_admin_estorno_conciliar_manual: {
        Args: {
          p_data_conclusao?: string
          p_estorno_id: string
          p_evidencia: string
          p_referencia: string
          p_valor_efetivo: number
        }
        Returns: boolean
      }
      fn_admin_estorno_preparar_tentativa_provedor: {
        Args: {
          p_estorno_id: string
          p_idempotency_key: string
          p_provedor: string
        }
        Returns: string
      }
      fn_admin_estorno_rejeitar: {
        Args: { p_estorno_id: string; p_motivo: string }
        Returns: boolean
      }
      fn_admin_estornos_operacionais: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          data_conclusao: string
          data_solicitacao: string
          empresa_id: string
          empresa_nome: string
          id: string
          modo_processamento: string
          motivo: string
          pedido_numero: string
          protocolo: string
          referencia_conciliacao: string
          status: string
          total_registros: number
          transacao_id: string
          valor_efetivo: number
          valor_original: number
          valor_solicitado: number
        }[]
      }
      fn_admin_financeiro_saques: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          beneficiario_id: string
          beneficiario_nome: string
          beneficiario_tipo: string
          destino: Json
          modo: string
          pago_em: string
          referencia: string
          saque_id: string
          solicitado_em: string
          status: Database["public"]["Enums"]["status_saque"]
          valor_liquido: number
          valor_solicitado: number
        }[]
      }
      fn_admin_global_set: {
        Args: { p_enabled: boolean; p_profile_id: string; p_reason: string }
        Returns: boolean
      }
      fn_admin_moderacao_decidir: {
        Args: {
          p_decisao: string
          p_detalhe: string
          p_id: string
          p_status: string
        }
        Returns: boolean
      }
      fn_admin_moderacao_list: {
        Args: { p_status?: string }
        Returns: {
          categoria_risco: string
          checkout_id: string
          checkout_nome: string
          created_at: string
          decisao: string
          detalhe: string
          detalhe_decisao: string
          empresa_id: string
          empresa_nome: string
          id: string
          motivo: string
          produto_id: string
          produto_nome: string
          profile_id: string
          profile_nome: string
          sinalizacoes: number
          status: string
          tipo_item: string
          updated_at: string
        }[]
      }
      fn_admin_pesquisa_global: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          destino: string
          id: string
          subtitulo: string
          tipo: string
          titulo: string
        }[]
      }
      fn_admin_saque_preparar_tentativa_provedor: {
        Args: {
          p_idempotency_key: string
          p_provedor: string
          p_saque_id: string
        }
        Returns: string
      }
      fn_admin_saque_registrar_pagamento_manual: {
        Args: {
          p_data_pagamento?: string
          p_evidencia: string
          p_referencia_bancaria: string
          p_saque_id: string
        }
        Returns: boolean
      }
      fn_admin_saque_transicionar: {
        Args: { p_motivo?: string; p_novo_status: string; p_saque_id: string }
        Returns: boolean
      }
      fn_admin_saques_operacionais: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          data_pagamento: string
          data_solicitacao: string
          destino: Json
          empresa_id: string
          empresa_nome: string
          id: string
          modo_processamento: string
          protocolo: string
          referencia_conciliacao: string
          solicitante: string
          status: string
          taxa_saque: number
          total_registros: number
          valor_liquido: number
          valor_solicitado: number
        }[]
      }
      fn_admin_suporte_canal_salvar: {
        Args: {
          p_ativo: boolean
          p_canal: string
          p_label: string
          p_valor: string
        }
        Returns: boolean
      }
      fn_admin_suporte_status: {
        Args: { p_status: string; p_ticket_id: string }
        Returns: boolean
      }
      fn_admin_suporte_tickets: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: {
          assunto: string
          atribuido_nome: string
          created_at: string
          empresa_id: string
          empresa_nome: string
          id: string
          mensagens: number
          prioridade: string
          protocolo: string
          solicitante: string
          status: string
          tipo: string
          total_records: number
          updated_at: string
        }[]
      }
      fn_admin_taxa_criar_versao: {
        Args: {
          p_base_calculo?: string
          p_dias_liquidacao?: number
          p_empresa_id: string
          p_fixo: number
          p_maximo?: number
          p_metodo: Database["public"]["Enums"]["metodo_pagamento"]
          p_minimo?: number
          p_operacao: string
          p_percentual: number
          p_plano?: string
          p_prioridade?: number
          p_reembolsar_em_estorno?: boolean
          p_vigencia_inicio?: string
        }
        Returns: string
      }
      fn_admin_usuario_status_set: {
        Args: { p_profile_id: string; p_reason: string; p_status: string }
        Returns: boolean
      }
      fn_admin_usuarios_list: {
        Args: {
          p_admin_global?: boolean
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_status?: string
        }
        Returns: {
          cargo: string
          created_at: string
          email: string
          empresa_id: string
          empresa_nome: string
          id: string
          is_admin_global: boolean
          is_owner: boolean
          nome: string
          status: string
          total_registros: number
          ultimo_login: string
        }[]
      }
      fn_afiliado_contextos: {
        Args: never
        Returns: {
          afiliado_id: string
          codigo: string
          empresa_id: string
          empresa_nome: string
          status: string
        }[]
      }
      fn_afiliado_convite_aceitar: {
        Args: { p_code: string; p_token: string }
        Returns: string
      }
      fn_afiliado_convite_criar: {
        Args: {
          p_email: string
          p_expira_dias?: number
          p_nome?: string
          p_taxa_comissao?: number
        }
        Returns: Json
      }
      fn_afiliado_convite_revogar: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      fn_afiliado_convite_visualizar: {
        Args: { p_code: string; p_token: string }
        Returns: Json
      }
      fn_afiliado_convites_listar: {
        Args: never
        Returns: {
          created_at: string
          email: string
          expira_em: string
          id: string
          nome: string
          status: string
          taxa_comissao: number
        }[]
      }
      fn_afiliado_destinos_listar: {
        Args: { p_afiliado_id: string }
        Returns: {
          destino_id: string
          destino_nome: string
          destino_tipo: string
          produto_id: string
          produto_nome: string
        }[]
      }
      fn_afiliado_link_criar: {
        Args: {
          p_afiliado_id: string
          p_checkout_id?: string
          p_link_pagamento_id?: string
          p_nome_campanha?: string
          p_produto_id: string
        }
        Returns: string
      }
      fn_afiliado_link_resolver: {
        Args: { p_code: string; p_fingerprint: string; p_referrer?: string }
        Returns: Json
      }
      fn_afiliado_produto_definir: {
        Args: {
          p_afiliado_id: string
          p_ativo: boolean
          p_data_fim?: string
          p_data_inicio?: string
          p_percentual?: number
          p_produto_id: string
          p_valor_fixo?: number
        }
        Returns: string
      }
      fn_afiliado_resumo: { Args: { p_afiliado_id: string }; Returns: Json }
      fn_afiliado_status_definir: {
        Args: { p_afiliado_id: string; p_motivo?: string; p_status: string }
        Returns: boolean
      }
      fn_afiliados_listar: {
        Args: never
        Returns: {
          cliques: number
          codigo: string
          comissao_estornada: number
          comissao_reconhecida: number
          conversao: number
          created_at: string
          email: string
          faturamento_bruto: number
          faturamento_liquido_devolucoes: number
          id: string
          nome: string
          produtos_autorizados: number
          profile_id: string
          status: string
          vendas_confirmadas: number
        }[]
      }
      fn_ajuda_buscar: {
        Args: {
          p_categoria_id?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          categoria_id: string
          categoria_nome: string
          conteudo: string
          destaque: boolean
          id: string
          resumo: string
          tempo_leitura_minutos: number
          titulo: string
          total_records: number
          updated_at: string
        }[]
      }
      fn_ajuda_categorias: {
        Args: never
        Returns: {
          descricao: string
          id: string
          nome: string
          ordem: number
        }[]
      }
      fn_api_key_validate: {
        Args: { p_required_scope: string; p_secret: string }
        Returns: Json
      }
      fn_api_orders: {
        Args: {
          p_empresa_id: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          commissions: number
          confirmed_at: string
          created_at: string
          currency: string
          discounts: number
          fees: number
          id: string
          items: Json
          number: string
          payment_method: string
          payment_status: string
          refunded: number
          subtotal: number
          total: number
          total_records: number
        }[]
      }
      fn_api_products: {
        Args: { p_empresa_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          currency: string
          description: string
          id: string
          name: string
          price: number
          status: string
          total_records: number
          updated_at: string
        }[]
      }
      fn_api_report_summary: {
        Args: { p_empresa_id: string; p_end: string; p_start: string }
        Returns: Json
      }
      fn_aplicar_reversao_financeira: {
        Args: {
          p_estorno_id: string
          p_provider_fee_refunded?: number
          p_valor: number
        }
        Returns: boolean
      }
      fn_assert_permissions_delegaveis: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      fn_assert_role_delegavel: {
        Args: { p_role_id: string }
        Returns: undefined
      }
      fn_cancelar_saque: { Args: { p_saque_id: string }; Returns: boolean }
      fn_checkout_bump_salvar: {
        Args: {
          p_ativo?: boolean
          p_checkout_id: string
          p_desconto_percentual?: number
          p_descricao?: string
          p_grupo_combinacao?: string
          p_id: string
          p_imagem_url?: string
          p_max_selecao_grupo?: number
          p_ordem?: number
          p_preco_fixo?: number
          p_produto_id: string
          p_texto_oferta?: string
          p_tipo_preco?: string
          p_titulo: string
        }
        Returns: string
      }
      fn_checkout_config_sanitizada: { Args: { p_config: Json }; Returns: Json }
      fn_checkout_config_validar: { Args: { p_config: Json }; Returns: boolean }
      fn_checkout_criar: {
        Args: { p_descricao?: string; p_nome: string; p_oferta_id: string }
        Returns: string
      }
      fn_checkout_criar_pedido_pix: {
        Args: {
          p_afiliado_id?: string
          p_checkout_id: string
          p_cliente_id: string
          p_empresa_id: string
          p_idempotency_key: string
          p_link_afiliado_id?: string
          p_link_pagamento_id: string
          p_order_bump_ids?: string[]
          p_provedor?: string
          p_valor_solicitado?: number
        }
        Returns: {
          numero_pedido: string
          pedido_id: string
          transacao_id: string
          valor_total: number
        }[]
      }
      fn_checkout_despublicar: {
        Args: { p_checkout_id: string }
        Returns: boolean
      }
      fn_checkout_publicar: {
        Args: { p_checkout_id: string }
        Returns: {
          public_token: string
          version_id: string
        }[]
      }
      fn_checkout_publico: { Args: { p_public_token: string }; Returns: Json }
      fn_checkout_restaurar_publicado: {
        Args: { p_checkout_id: string }
        Returns: string
      }
      fn_checkout_salvar_rascunho:
        | { Args: { p_checkout_id: string; p_config: Json }; Returns: string }
        | {
            Args: {
              p_checkout_id: string
              p_config: Json
              p_descricao: string
              p_nome: string
            }
            Returns: string
          }
      fn_checkouts_listar: {
        Args: {
          p_busca?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          descricao: string
          faturamento_bruto: number
          id: string
          nome: string
          oferta_id: string
          oferta_nome: string
          pedidos_confirmados: number
          preco: number
          produto_id: string
          produto_nome: string
          public_token: string
          publicado_em: string
          slug: string
          status: string
          updated_at: string
        }[]
      }
      fn_comissoes_listar: {
        Args: {
          p_afiliado_id?: string
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          afiliado_id: string
          afiliado_nome: string
          id: string
          liberacao_em: string
          pagamento_em: string
          pedido_numero: string
          percentual: number
          produto_nome: string
          status: string
          total_registros: number
          transacao_id: string
          valor_estornado: number
          valor_original: number
          valor_reconhecido: number
          valor_venda: number
          venda_em: string
        }[]
      }
      fn_configurar_produto_afiliado: {
        Args: {
          p_afiliado_id: string
          p_ativo?: boolean
          p_percentual?: number
          p_produto_id: string
          p_valor_fixo?: number
        }
        Returns: string
      }
      fn_confirmar_estorno_manual: {
        Args: {
          p_data: string
          p_estorno_id: string
          p_evidencia: string
          p_referencia: string
        }
        Returns: boolean
      }
      fn_confirmar_estorno_provedor: {
        Args: {
          p_estorno_id: string
          p_gateway_ref: string
          p_provider_fee_refunded?: number
          p_provider_payload: Json
          p_valor: number
        }
        Returns: boolean
      }
      fn_confirmar_pix_manual: {
        Args: {
          p_evidencia: string
          p_referencia_bancaria: string
          p_transacao_id: string
        }
        Returns: string
      }
      fn_confirmar_saque_manual: {
        Args: {
          p_data_transferencia: string
          p_evidencia: string
          p_referencia: string
          p_saque_id: string
        }
        Returns: boolean
      }
      fn_conta_atualizar: {
        Args: {
          p_avatar_url: string
          p_currency: string
          p_idioma: string
          p_nome: string
          p_telefone: string
          p_timezone: string
        }
        Returns: boolean
      }
      fn_conta_obter: { Args: never; Returns: Json }
      fn_contexto_empresa_definir: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      fn_criar_convite_afiliado: {
        Args: {
          p_email?: string
          p_expira_em?: string
          p_mensagem?: string
          p_produtos?: string[]
          p_taxa_padrao?: number
        }
        Returns: Json
      }
      fn_criar_link_afiliado: {
        Args: {
          p_checkout_id?: string
          p_empresa_id: string
          p_link_pagamento_id?: string
          p_nome_campanha?: string
          p_produto_id: string
        }
        Returns: Json
      }
      fn_criar_link_pagamento: {
        Args: {
          p_checkout_id: string
          p_expira_em?: string
          p_max_usos?: number
          p_oferta_id: string
          p_titulo: string
          p_uso_unico?: boolean
        }
        Returns: Json
      }
      fn_criar_pedido_checkout_pix: {
        Args: {
          p_afiliado_id?: string
          p_checkout_id: string
          p_cliente_id: string
          p_custom_amount: number
          p_idempotency_key: string
          p_link_afiliado_id?: string
          p_link_id: string
          p_order_bump_ids: string[]
          p_provedor?: string
        }
        Returns: {
          pedido_id: string
          pedido_numero: string
          total: number
          transacao_id: string
        }[]
      }
      fn_dashboard_operacional: {
        Args: { p_empresa_id: string; p_fim: string; p_inicio: string }
        Returns: {
          pagamentos_aprovados: number
          receita_liquida: number
          tentativas_validas: number
          vendas_pagas: number
          volume_processado: number
        }[]
      }
      fn_dashboard_series: {
        Args: { p_fim: string; p_granularidade?: string; p_inicio: string }
        Returns: {
          bucket_start: string
          sales: number
          volume: number
        }[]
      }
      fn_dashboard_top_products: {
        Args: { p_fim: string; p_inicio: string; p_limit?: number }
        Returns: {
          commission_rate: number
          product_id: string
          product_name: string
          revenue: number
          sales: number
        }[]
      }
      fn_desativar_link_pagamento: {
        Args: { p_link_id: string }
        Returns: boolean
      }
      fn_dev_api_key_create: {
        Args: {
          p_empresa_id: string
          p_escopos: string[]
          p_expira_em?: string
          p_nome: string
          p_tipo: string
        }
        Returns: Json
      }
      fn_dev_api_key_revoke: {
        Args: { p_key_id: string; p_motivo?: string }
        Returns: boolean
      }
      fn_dev_api_key_rotate: { Args: { p_key_id: string }; Returns: Json }
      fn_dev_api_keys_list: {
        Args: never
        Returns: {
          ativa: boolean
          chave_prefixo: string
          data_criacao: string
          data_expiracao: string
          data_ultimo_uso: string
          empresa_id: string
          empresa_nome: string
          escopos: string[]
          id: string
          nome: string
          revogada_em: string
          tipo_chave: string
          total_requisicoes: number
        }[]
      }
      fn_dev_audit_logs: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_result?: string
          p_search?: string
        }
        Returns: {
          action: string
          actor: string
          created_at: string
          id: string
          ip_address: string
          module: string
          result: string
          risco_nivel: string
          status_resposta: number
          target: string
          total_registros: number
        }[]
      }
      fn_dev_webhook_create: {
        Args: {
          p_empresa_id: string
          p_eventos: string[]
          p_nome: string
          p_url: string
        }
        Returns: Json
      }
      fn_dev_webhook_deliveries: {
        Args: { p_limit?: number; p_offset?: number; p_webhook_id?: string }
        Returns: {
          created_at: string
          endpoint_url: string
          evento: string
          id: string
          idempotency_key: string
          max_tentativas: number
          mensagem_erro: string
          status_resposta: number
          sucesso: boolean
          tempo_resposta_ms: number
          tentativa_numero: number
          total_registros: number
          webhook_id: string
          webhook_nome: string
        }[]
      }
      fn_dev_webhook_revoke: {
        Args: { p_webhook_id: string }
        Returns: boolean
      }
      fn_dev_webhook_set_active: {
        Args: { p_active: boolean; p_webhook_id: string }
        Returns: boolean
      }
      fn_dev_webhooks_list: {
        Args: never
        Returns: {
          ativo: boolean
          created_at: string
          data_ultimo_disparo: string
          empresa_id: string
          empresa_nome: string
          eventos_ouvidos: string[]
          id: string
          nome: string
          revogado_em: string
          segredo_prefixo: string
          total_disparos: number
          total_falhas: number
          total_sucessos: number
          ultima_resposta_status: number
          url_endpoint: string
        }[]
      }
      fn_empresa_config_atualizar: {
        Args: {
          p_bairro: string
          p_cep: string
          p_cidade: string
          p_cnpj: string
          p_complemento: string
          p_email: string
          p_estado: string
          p_ie: string
          p_logradouro: string
          p_nome_fantasia: string
          p_numero: string
          p_razao_social: string
          p_segmento: string
          p_site: string
          p_telefone: string
          p_timezone: string
        }
        Returns: boolean
      }
      fn_empresa_config_obter: { Args: never; Returns: Json }
      fn_empresas_autorizadas: {
        Args: never
        Returns: {
          contexto_ativo: boolean
          empresa_id: string
          is_owner: boolean
          nome: string
          vinculo: string
        }[]
      }
      fn_equipe_convite_aceitar: {
        Args: { p_code: string; p_token: string }
        Returns: string
      }
      fn_equipe_convite_criar: {
        Args: {
          p_cargo: string
          p_email: string
          p_expira_dias?: number
          p_nome: string
          p_role_id: string
        }
        Returns: Json
      }
      fn_equipe_convite_revogar: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      fn_equipe_convite_visualizar: {
        Args: { p_code: string; p_token: string }
        Returns: Json
      }
      fn_equipe_convites_listar: {
        Args: never
        Returns: {
          cargo: string
          created_at: string
          email: string
          expira_em: string
          id: string
          nome: string
          role_id: string
          role_nome: string
          status: string
        }[]
      }
      fn_equipe_listar: {
        Args: never
        Returns: {
          avatar_url: string
          cargo: string
          created_at: string
          email: string
          is_owner: boolean
          membro_id: string
          nome: string
          profile_id: string
          role_id: string
          role_nome: string
          status: string
          ultimo_acesso: string
        }[]
      }
      fn_equipe_remover: {
        Args: { p_motivo: string; p_profile_id: string }
        Returns: boolean
      }
      fn_equipe_role_definir: {
        Args: { p_profile_id: string; p_role_id: string }
        Returns: boolean
      }
      fn_estorno_solicitar: {
        Args: {
          p_detalhes: string
          p_idempotency_key: string
          p_motivo: string
          p_transacao_id: string
          p_valor: number
        }
        Returns: string
      }
      fn_estornos_contestacoes: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          evidencias: string[]
          id: string
          motivo: string
          pedido_id: string
          protocolo: string
          responsavel: string
          status: string
          tipo: string
          transacao_id: string
          valor: number
        }[]
      }
      fn_extrato_financeiro: {
        Args: {
          p_bucket?: string
          p_conta?: string
          p_entidade?: string
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          bucket: string
          conta: string
          data_lancamento: string
          descricao: string
          documento: string
          estorno_id: string
          id: string
          saldo_abertura: number
          saldo_periodo: number
          saque_id: string
          tipo: string
          total_registros: number
          transacao_id: string
          valor: number
          valor_assinado: number
        }[]
      }
      fn_extrato_financeiro_v2: {
        Args: {
          p_bucket?: string
          p_busca?: string
          p_entidade?: string
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_offset?: number
          p_tipo?: string
        }
        Returns: {
          bucket: string
          conta: string
          data_lancamento: string
          descricao: string
          documento: string
          estorno_id: string
          id: string
          movimento_periodo: number
          saldo_abertura: number
          saque_id: string
          tipo: string
          total_registros: number
          transacao_id: string
          valor: number
          valor_assinado: number
        }[]
      }
      fn_extrato_resumo: {
        Args: { p_entidade?: string; p_fim?: string; p_inicio?: string }
        Returns: {
          creditos: number
          debitos: number
          movimento_liquido: number
          saldo_abertura: number
          saldo_fechamento: number
        }[]
      }
      fn_financeiro_liberar_transacao: {
        Args: { p_transacao_id: string }
        Returns: boolean
      }
      fn_financeiro_saldo: {
        Args: { p_entidade?: string }
        Returns: {
          a_receber: number
          atualizado_em: string
          bloqueado: number
          devedor: number
          disponivel: number
          entidade: string
          estornado_historico: number
          liquidado_historico: number
          reservado_saque: number
        }[]
      }
      fn_financeiro_snapshot_venda: {
        Args: { p_transacao_id: string }
        Returns: boolean
      }
      fn_gerir_afiliacao: {
        Args: { p_acao: string; p_afiliado_id: string; p_motivo?: string }
        Returns: boolean
      }
      fn_get_empresa_usuario: { Args: never; Returns: string }
      fn_increment_afiliado_clique: {
        Args: { p_afiliado_id: string }
        Returns: undefined
      }
      fn_increment_link_afiliado_clique: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      fn_integracao_configurar_secret: {
        Args: { p_provider: string; p_secret: string }
        Returns: string
      }
      fn_integracao_desconectar: {
        Args: { p_integracao_id: string }
        Returns: boolean
      }
      fn_integracao_pode_gerenciar: { Args: never; Returns: boolean }
      fn_integracao_service_secret: {
        Args: { p_integracao_id: string }
        Returns: {
          empresa_id: string
          provider: string
          secret: string
        }[]
      }
      fn_integracao_test_result: {
        Args: {
          p_error?: string
          p_integracao_id: string
          p_status: number
          p_success: boolean
        }
        Returns: boolean
      }
      fn_integracoes_listar_safe: {
        Args: never
        Returns: {
          categoria: string
          connected_at: string
          descricao: string
          disconnected_at: string
          integracao_id: string
          last_error: string
          last_error_at: string
          last_sync_at: string
          nome: string
          operational: boolean
          provider: string
          status: string
        }[]
      }
      fn_is_admin_global: { Args: never; Returns: boolean }
      fn_is_empresa_owner: { Args: { p_empresa_id?: string }; Returns: boolean }
      fn_ledger_debitar_entidade: {
        Args: {
          p_afiliado_id: string
          p_conta: string
          p_descricao: string
          p_documento: string
          p_empresa_id: string
          p_estorno_id: string
          p_key_prefix: string
          p_metadata?: Json
          p_profile_id: string
          p_transacao_id: string
          p_valor: number
        }
        Returns: number
      }
      fn_ledger_registrar: {
        Args: {
          p_afiliado_id: string
          p_bucket: string
          p_comissao_id: string
          p_conta: string
          p_descricao: string
          p_documento: string
          p_empresa_id: string
          p_estado: string
          p_estorno_id: string
          p_idempotency_key: string
          p_metadata?: Json
          p_origem_id: string
          p_origem_tipo: string
          p_profile_id: string
          p_repasse_id: string
          p_reversao_de?: string
          p_saque_id: string
          p_tipo: string
          p_transacao_id: string
          p_valor: number
        }
        Returns: string
      }
      fn_ledger_saldo_bucket: {
        Args: {
          p_afiliado_id: string
          p_bucket: string
          p_empresa_id: string
          p_profile_id: string
        }
        Returns: number
      }
      fn_link_pagamento_criar: {
        Args: {
          p_checkout_id: string
          p_descricao?: string
          p_expira_em?: string
          p_idempotency_key?: string
          p_max_usos?: number
          p_permitir_editar_valor?: boolean
          p_titulo: string
          p_uso_unico?: boolean
          p_valor?: number
        }
        Returns: string
      }
      fn_link_pagamento_desativar: {
        Args: { p_link_id: string }
        Returns: boolean
      }
      fn_links_afiliados_listar: {
        Args: {
          p_afiliado_id?: string
          p_busca?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          afiliado_id: string
          afiliado_nome: string
          cliques: number
          codigo: string
          comissao_reconhecida: number
          conversao: number
          created_at: string
          destino: string
          id: string
          produto_id: string
          produto_nome: string
          status: string
          total_registros: number
          vendas_confirmadas: number
        }[]
      }
      fn_links_pagamento_listar: {
        Args: { p_busca?: string; p_limit?: number; p_offset?: number }
        Returns: {
          checkout_nome: string
          codigo: string
          contador_usos: number
          created_at: string
          data_expiracao: string
          faturamento_bruto: number
          id: string
          max_usos: number
          oferta_nome: string
          pedidos_confirmados: number
          produto_nome: string
          public_token: string
          status: string
          titulo: string
          uso_unico: boolean
          valor: number
        }[]
      }
      fn_listar_pix_manual_pendente: {
        Args: never
        Returns: {
          cliente_email: string
          cliente_nome: string
          criado_em: string
          pedido_id: string
          pedido_numero: string
          recebedor_cidade: string
          recebedor_nome: string
          transacao_id: string
          txid: string
          valor: number
        }[]
      }
      fn_media_asset_em_uso_publicado: {
        Args: { p_asset_id: string }
        Returns: boolean
      }
      fn_media_registrar: {
        Args: {
          p_altura?: number
          p_largura?: number
          p_mime: string
          p_path: string
          p_sha256?: string
          p_tamanho: number
        }
        Returns: string
      }
      fn_media_remover: { Args: { p_asset_id: string }; Returns: boolean }
      fn_notificacao_canais_status: { Args: never; Returns: Json }
      fn_notificacao_criar: {
        Args: {
          p_dados?: Json
          p_empresa_id: string
          p_entidade_id: string
          p_entidade_tipo: string
          p_event_key: string
          p_mensagem: string
          p_profile_id: string
          p_tipo: Database["public"]["Enums"]["tipo_notificacao"]
          p_titulo: string
          p_url: string
        }
        Returns: string
      }
      fn_notificacao_marcar_lida: { Args: { p_id: string }; Returns: boolean }
      fn_notificacao_preferencia: {
        Args: { p_canal: string; p_profile_id: string; p_tipo: string }
        Returns: boolean
      }
      fn_notificacao_preferencia_salvar: {
        Args: {
          p_email: boolean
          p_inapp: boolean
          p_push: boolean
          p_tipo: string
        }
        Returns: boolean
      }
      fn_notificacao_preferencias_me: {
        Args: never
        Returns: {
          receber_email: boolean
          receber_inapp: boolean
          receber_push: boolean
          tipo: string
        }[]
      }
      fn_notificacoes_marcar_todas_lidas: { Args: never; Returns: number }
      fn_notificacoes_me: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          total_nao_lidas: number
          total_registros: number
          url_destino: string
        }[]
      }
      fn_notificar_empresa_permitidos: {
        Args: {
          p_dados?: Json
          p_empresa_id: string
          p_entidade_id: string
          p_entidade_tipo: string
          p_event_prefix: string
          p_mensagem: string
          p_modulo: string
          p_recurso: string
          p_tipo: Database["public"]["Enums"]["tipo_notificacao"]
          p_titulo: string
          p_url: string
        }
        Returns: number
      }
      fn_notification_channels_sync: {
        Args: {
          p_details?: Json
          p_email_enabled: boolean
          p_push_enabled: boolean
        }
        Returns: boolean
      }
      fn_notification_delivery_claim: {
        Args: { p_limit?: number }
        Returns: {
          canal: string
          delivery_id: string
          email_destino: string
          mensagem: string
          notificacao_id: string
          profile_id: string
          push_subscriptions: Json
          tentativa: number
          titulo: string
          url_destino: string
        }[]
      }
      fn_notification_delivery_finish: {
        Args: {
          p_delivery_id: string
          p_error?: string
          p_provider_id?: string
          p_retry_after_seconds?: number
          p_success: boolean
        }
        Returns: boolean
      }
      fn_notification_push_crypto_ready: { Args: never; Returns: boolean }
      fn_obter_config_pix_admin: {
        Args: never
        Returns: {
          chave: string
          configurado: boolean
          modo: string
          recebedor_cidade: string
          recebedor_nome: string
        }[]
      }
      fn_ocorrencias_financeiras_listar: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_tipo?: string
        }
        Returns: {
          data_ocorrencia: string
          modo_processamento: string
          motivo: string
          origem_id: string
          pedido_numero: string
          referencia: string
          status: string
          tipo: string
          total_registros: number
          transacao_id: string
          valor: number
        }[]
      }
      fn_ocorrencias_financeiras_resumo: {
        Args: never
        Returns: {
          chargebacks_reais: number
          estornos_concluidos: number
          estornos_pendentes: number
          total_chargebacks: number
          total_estornos: number
        }[]
      }
      fn_oferta_salvar: {
        Args: {
          p_descricao?: string
          p_id?: string
          p_idempotency_key?: string
          p_nome?: string
          p_permitir_valor_personalizado?: boolean
          p_preco?: number
          p_preco_comparacao?: number
          p_produto_id?: string
          p_status?: string
          p_valor_maximo?: number
          p_valor_minimo?: number
          p_vigencia_fim?: string
          p_vigencia_inicio?: string
        }
        Returns: string
      }
      fn_ofertas_listar: {
        Args: {
          p_busca?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          checkouts: number
          descricao: string
          faturamento_bruto: number
          id: string
          nome: string
          pedidos_confirmados: number
          preco: number
          preco_comparacao: number
          produto_id: string
          produto_nome: string
          status: string
          updated_at: string
        }[]
      }
      fn_permissions_listar: {
        Args: never
        Returns: {
          acao: string
          descricao: string
          id: string
          modulo: string
          nome_exibicao: string
          recurso: string
        }[]
      }
      fn_pesquisa_global: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          grupo: string
          id: string
          relevancia: number
          subtitulo: string
          titulo: string
          url: string
        }[]
      }
      fn_pode_gerenciar_equipe: { Args: never; Returns: boolean }
      fn_pode_gerenciar_permissoes: { Args: never; Returns: boolean }
      fn_pode_gerir_afiliados: { Args: never; Returns: boolean }
      fn_pode_inscrever_marketplace: {
        Args: {
          p_afiliado_id: string
          p_empresa_id: string
          p_marketplace_produto_id: string
          p_produto_id: string
        }
        Returns: boolean
      }
      fn_preco_produto_atual: {
        Args: { p_produto: Database["public"]["Tables"]["produtos"]["Row"] }
        Returns: number
      }
      fn_processar_financeiro_transacao: {
        Args: { p_transacao_id: string }
        Returns: boolean
      }
      fn_produto_arquivar: { Args: { p_produto_id: string }; Returns: boolean }
      fn_produto_salvar: {
        Args: {
          p_categoria_id?: string
          p_descricao?: string
          p_galeria_urls?: string[]
          p_id?: string
          p_idempotency_key?: string
          p_imagem_url?: string
          p_nome?: string
          p_preco?: number
          p_status?: string
        }
        Returns: string
      }
      fn_produtos_operacionais: {
        Args: { p_busca?: string; p_limit?: number; p_offset?: number }
        Returns: {
          checkouts_publicados: number
          comissao_percentual: number
          faturamento_bruto: number
          id: string
          nome: string
          ofertas_ativas: number
          preco: number
          status: string
          vendas_confirmadas: number
        }[]
      }
      fn_profile_tem_permissao: {
        Args: {
          p_acao: Database["public"]["Enums"]["tipo_operacao"]
          p_empresa_id: string
          p_modulo: string
          p_profile_id: string
          p_recurso: string
        }
        Returns: boolean
      }
      fn_push_inscricao_desativar_device: {
        Args: { p_device_id: string }
        Returns: number
      }
      fn_push_inscricao_registrar: {
        Args: {
          p_auth: string
          p_device_id: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: string
      }
      fn_push_subscription_fail: {
        Args: {
          p_error: string
          p_expired?: boolean
          p_subscription_id: string
        }
        Returns: boolean
      }
      fn_push_subscription_success: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      fn_recalcular_agregados_transacao: {
        Args: {
          p_checkout_id?: string
          p_cliente_id?: string
          p_produto_id?: string
        }
        Returns: undefined
      }
      fn_recalcular_pedido_financeiro: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      fn_recalcular_saldo_entidade: {
        Args: {
          p_afiliado_id?: string
          p_empresa_id?: string
          p_profile_id?: string
        }
        Returns: string
      }
      fn_relatorio_afiliados: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          afiliado_id: string
          afiliado_nome: string
          cliques: number
          comissao_estornada: number
          comissao_original: number
          comissao_reconhecida: number
          conversao: number
          devolucoes: number
          faturamento_bruto: number
          faturamento_liquido_devolucoes: number
          vendas_confirmadas: number
        }[]
      }
      fn_relatorio_autorizado: { Args: { p_recurso: string }; Returns: boolean }
      fn_relatorio_consistencia_pedido: {
        Args: { p_pedido_id: string }
        Returns: Json
      }
      fn_relatorio_definicoes: { Args: never; Returns: Json }
      fn_relatorio_financeiro_categorias: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          conta: string
          creditos: number
          debitos: number
          liquido: number
          movimento_economico: boolean
          quantidade: number
        }[]
      }
      fn_relatorio_intervalo: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          fim_utc: string
          inicio_utc: string
          timezone: string
        }[]
      }
      fn_relatorio_produtos: {
        Args: { p_fim: string; p_inicio: string }
        Returns: {
          comissao_snapshot: number
          devolucoes_rateadas: number
          pedidos_confirmados: number
          produto_id: string
          produto_nome: string
          receita_bruta_itens: number
          receita_liquida_devolucoes: number
          status_atual: string
          ticket_medio_item: number
          unidades: number
        }[]
      }
      fn_relatorio_resumo: {
        Args: { p_fim: string; p_inicio: string; p_metodo?: string }
        Returns: {
          comissoes_estornadas: number
          comissoes_originais: number
          comissoes_reconhecidas: number
          devolucoes: number
          faturamento_bruto: number
          faturamento_liquido_devolucoes: number
          fim_utc: string
          inicio_utc: string
          pagamentos_confirmados: number
          pedidos_criados: number
          pedidos_pendentes: number
          taxas_plataforma: number
          ticket_medio: number
          timezone: string
        }[]
      }
      fn_relatorio_timezone: { Args: never; Returns: string }
      fn_relatorio_vendas_diario: {
        Args: { p_fim: string; p_inicio: string; p_metodo?: string }
        Returns: {
          devolucoes: number
          dia: string
          faturamento_bruto: number
          faturamento_liquido_devolucoes: number
          pedidos: number
        }[]
      }
      fn_revogar_convite_afiliado: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      fn_role_criar: {
        Args: {
          p_descricao: string
          p_nome: string
          p_permission_ids: string[]
        }
        Returns: string
      }
      fn_role_permissoes_salvar: {
        Args: { p_permission_ids: string[]; p_role_id: string }
        Returns: boolean
      }
      fn_roles_listar: {
        Args: never
        Returns: {
          descricao: string
          id: string
          is_admin: boolean
          is_sistema: boolean
          membros: number
          nivel: number
          nome: string
          permissoes: string[]
        }[]
      }
      fn_saldo_recalcular_entidade: {
        Args: {
          p_afiliado_id?: string
          p_empresa_id?: string
          p_profile_id?: string
        }
        Returns: string
      }
      fn_salvar_config_pix: {
        Args: {
          p_chave?: string
          p_modo: string
          p_recebedor_cidade?: string
          p_recebedor_nome?: string
        }
        Returns: undefined
      }
      fn_saque_admin_transicionar: {
        Args: {
          p_motivo?: string
          p_novo_status: Database["public"]["Enums"]["status_saque"]
          p_saque_id: string
        }
        Returns: boolean
      }
      fn_saque_entidade_dados: {
        Args: { p_entidade: string }
        Returns: {
          afiliado_id: string
          empresa_id: string
          profile_id: string
        }[]
      }
      fn_saque_liberar_reserva: {
        Args: { p_motivo: string; p_saque_id: string }
        Returns: boolean
      }
      fn_saque_taxa_snapshot: {
        Args: { p_empresa_id: string; p_saque_id: string; p_valor: number }
        Returns: number
      }
      fn_saques_listar: {
        Args: {
          p_entidade?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          data_pagamento: string
          data_solicitacao: string
          destino: Json
          id: string
          modo_processamento: string
          protocolo: string
          referencia_conciliacao: string
          status: string
          taxa_saque: number
          total_registros: number
          valor_liquido: number
          valor_solicitado: number
        }[]
      }
      fn_search_normalize: { Args: { p_text: string }; Returns: string }
      fn_seed_role_permissions: { Args: never; Returns: undefined }
      fn_seguranca_eventos_me: {
        Args: { p_limit?: number }
        Returns: {
          acao: string
          cidade: string
          created_at: string
          descricao: string
          id: string
          ip_address: string
          modulo: string
          pais: string
          risco_nivel: string
          status_resposta: number
          user_agent: string
        }[]
      }
      fn_seguranca_sessoes_me: {
        Args: never
        Returns: {
          cidade: string
          data_expiracao: string
          data_login: string
          data_ultima_atividade: string
          dispositivo: string
          dispositivo_tipo: string
          id: string
          ip_address: string
          navegador: string
          pais: string
          regiao: string
          sistema_operacional: string
          status: string
        }[]
      }
      fn_sincronizar_saldo_empresa: { Args: never; Returns: number }
      fn_solicitar_estorno: {
        Args: {
          p_detalhes?: string
          p_idempotency_key?: string
          p_motivo: string
          p_transacao_id: string
          p_valor: number
        }
        Returns: string
      }
      fn_solicitar_saque: {
        Args: { p_conta_bancaria_id: string; p_valor: number }
        Returns: string
      }
      fn_solicitar_saque_v2: {
        Args: {
          p_conta_bancaria_id: string
          p_entidade?: string
          p_idempotency_key: string
          p_valor: number
        }
        Returns: string
      }
      fn_split_aplicar_regra_venda: {
        Args: { p_transacao_id: string }
        Returns: number
      }
      fn_split_registros: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          data_referencia: string
          distribuicoes: Json
          pedido_id: string
          pedido_numero: string
          status_pagamento: string
          total_distribuido: number
          total_registros: number
          total_revertido: number
          transacao_id: string
          valor_bruto: number
        }[]
      }
      fn_split_regra_atual: { Args: never; Returns: Json }
      fn_split_regra_criar_versao: {
        Args: {
          p_beneficiarios: Json
          p_nome: string
          p_vigencia_inicio?: string
        }
        Returns: string
      }
      fn_split_simular: {
        Args: { p_afiliado_id?: string; p_produto_id: string; p_valor: number }
        Returns: Json
      }
      fn_suporte_anexo_registrar: {
        Args: {
          p_file_name: string
          p_mensagem_id: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_path: string
          p_ticket_id: string
        }
        Returns: string
      }
      fn_suporte_responder: {
        Args: { p_mensagem: string; p_ticket_id: string }
        Returns: string
      }
      fn_suporte_ticket_criar: {
        Args: {
          p_assunto: string
          p_categoria?: string
          p_descricao: string
          p_prioridade?: string
          p_tipo?: string
        }
        Returns: string
      }
      fn_suporte_ticket_mensagens: {
        Args: { p_ticket_id: string }
        Returns: {
          attachments: Json
          body: string
          created_at: string
          id: string
          is_automatic: boolean
          sender_name: string
          sender_type: string
        }[]
      }
      fn_suporte_tickets_me: {
        Args: never
        Returns: {
          assunto: string
          categoria: string
          created_at: string
          id: string
          mensagens: number
          prioridade: string
          protocolo: string
          status: string
          tipo: string
          updated_at: string
        }[]
      }
      fn_taxa_calcular: {
        Args: {
          p_base: number
          p_fixo: number
          p_maximo?: number
          p_minimo?: number
          p_percentual: number
        }
        Returns: number
      }
      fn_taxa_operacao_calcular: {
        Args: {
          p_empresa_id: string
          p_metodo: Database["public"]["Enums"]["metodo_pagamento"]
          p_operacao: string
          p_valor_bruto: number
          p_valor_liquido_provedor?: number
        }
        Returns: Json
      }
      fn_taxa_preview: {
        Args: {
          p_metodo: Database["public"]["Enums"]["metodo_pagamento"]
          p_operacao?: string
          p_valor: number
        }
        Returns: Json
      }
      fn_taxa_regra_aplicavel: {
        Args: {
          p_empresa_id: string
          p_metodo: Database["public"]["Enums"]["metodo_pagamento"]
          p_momento: string
          p_operacao: string
        }
        Returns: {
          alterado_por: string | null
          arredondamento: string
          ativo: boolean | null
          atualizado_por: string | null
          base_calculo: string
          created_at: string
          criado_por: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string
          dias_liquidacao: number | null
          empresa_id: string | null
          id: string
          is_padrao: boolean | null
          max_parcelas_sem_juros: number | null
          metodo_pagamento: Database["public"]["Enums"]["metodo_pagamento"]
          operacao: string
          plano: string
          prioridade: number
          reembolsar_em_estorno: boolean
          regra_snapshot: Json
          reverter_taxa_em_devolucao: boolean
          taxa_antecipacao_percentual: number | null
          taxa_boleto: number | null
          taxa_fixa: number
          taxa_maxima: number | null
          taxa_minima: number | null
          taxa_minima_saque: number | null
          taxa_parcelamento_por_parcela: number | null
          taxa_percentual: number
          taxa_pix_fixa: number | null
          taxa_pix_percentual: number | null
          taxa_saque_fixa: number | null
          taxa_saque_percentual: number | null
          updated_at: string
          versao: number
          vigencia_fim_em: string | null
          vigencia_inicio_em: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "taxas_plataforma"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_taxas_operacionais: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: {
          custo_provedor_registrado: number
          metodo: string
          operacao: string
          quantidade: number
          taxa_plataforma: number
          volume_base: number
        }[]
      }
      fn_tem_permissao: {
        Args: {
          p_acao: Database["public"]["Enums"]["tipo_operacao"]
          p_modulo: string
          p_recurso: string
        }
        Returns: boolean
      }
      fn_ticket_can_access: { Args: { p_ticket_id: string }; Returns: boolean }
      fn_ticket_storage_access: { Args: { p_name: string }; Returns: boolean }
      fn_ticket_support_staff: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      fn_usuario_tem_empresa: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      fn_vendas_consultar: {
        Args: {
          p_busca?: string
          p_fim?: string
          p_inicio?: string
          p_limit?: number
          p_metodo?: string
          p_offset?: number
          p_produto_id?: string
          p_status?: string
        }
        Returns: {
          comissoes: number
          comprador_email: string
          comprador_nome: string
          confirmado_em: string
          criado_em: string
          data_referencia: string
          devolvido: number
          itens: Json
          metodo_pagamento: string
          numero: string
          pedido_id: string
          status_pagamento: string
          status_pedido: string
          taxas: number
          total_registros: number
          valor_liquido: number
          valor_total: number
        }[]
      }
      fn_vendas_operacionais: {
        Args: {
          p_busca?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          comissoes: number
          comprador_email: string
          comprador_nome: string
          confirmado_em: string
          criado_em: string
          devolvido: number
          itens: Json
          metodo_pagamento: string
          numero: string
          pedido_id: string
          status_pagamento: string
          status_pedido: string
          taxas: number
          valor_total: number
        }[]
      }
      fn_vendas_resumo: {
        Args: {
          p_busca?: string
          p_fim?: string
          p_inicio?: string
          p_metodo?: string
          p_produto_id?: string
          p_status?: string
        }
        Returns: {
          comissoes: number
          devolucoes: number
          faturamento_bruto: number
          pagamentos_confirmados: number
          pagamentos_pendentes: number
          pedidos: number
          taxas: number
          ticket_medio: number
          valor_liquido: number
        }[]
      }
      fn_webhook_dispatch_claim: {
        Args: { p_limit?: number }
        Returns: {
          attempt: number
          custom_headers: Json
          delivery_id: string
          endpoint_url: string
          evento: string
          idempotency_key: string
          max_attempts: number
          payload: Json
          signing_secret: string
          timeout_ms: number
          webhook_id: string
        }[]
      }
      fn_webhook_dispatch_complete: {
        Args: {
          p_delivery_id: string
          p_duration_ms: number
          p_error: string
          p_response_body: string
          p_response_headers: Json
          p_signature: string
          p_status: number
          p_success: boolean
        }
        Returns: boolean
      }
      fn_webhook_enqueue: {
        Args: {
          p_empresa_id: string
          p_entidade_id: string
          p_entidade_tipo: string
          p_event: string
          p_event_key: string
          p_payload: Json
        }
        Returns: string
      }
      fn_webhook_event_match: {
        Args: { p_event: string; p_subscriptions: string[] }
        Returns: boolean
      }
      is_admin_global: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      frequencia_relatorio:
        | "diario"
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "trimestral"
        | "anual"
      metodo_pagamento:
        | "pix"
        | "cartao_credito"
        | "cartao_debito"
        | "boleto"
        | "ted"
        | "doc"
        | "picpay"
        | "mercadopago"
        | "paypal"
        | "transferencia"
        | "saldo_conta"
        | "outro"
      prioridade_ticket: "baixa" | "media" | "alta" | "critica" | "urgente"
      status_afiliado: "pendente" | "ativo" | "inativo" | "suspenso" | "banido"
      status_ativo: "ativo" | "inativo" | "suspenso" | "bloqueado"
      status_checkout: "rascunho" | "publicado" | "arquivado" | "desativado"
      status_comissao:
        | "pendente"
        | "aprovada"
        | "liberada"
        | "paga"
        | "cancelada"
        | "estornada"
      status_cupom: "ativo" | "inativo" | "expirado"
      status_estorno:
        | "solicitado"
        | "processando"
        | "aprovado_parcial"
        | "aprovado_total"
        | "concluido"
        | "rejeitado"
        | "cancelado"
        | "em_disputa"
      status_integracao:
        | "nao_configurado"
        | "conectado"
        | "erro"
        | "expirado"
        | "revogado"
      status_link_pagamento: "ativo" | "expirado" | "usado" | "desativado"
      status_marketplace_produto:
        | "pendente_aprovacao"
        | "publicado"
        | "rejeitado"
        | "arquivado"
      status_matricula:
        | "ativa"
        | "pausada"
        | "cancelada"
        | "concluida"
        | "expirada"
      status_produto: "rascunho" | "publicado" | "arquivado" | "indisponivel"
      status_repasse:
        | "agendado"
        | "processando"
        | "enviado"
        | "recebido"
        | "confirmado"
        | "cancelado"
        | "falhou"
      status_saque:
        | "solicitado"
        | "em_analise"
        | "aprovado"
        | "processando"
        | "enviado"
        | "pago"
        | "cancelado"
        | "rejeitado"
        | "falhou"
      status_sessao: "ativa" | "expirada" | "revogada" | "bloqueada"
      status_ticket:
        | "aberto"
        | "respondido_cliente"
        | "respondido_suporte"
        | "em_analise"
        | "pendente_terceiro"
        | "resolvido"
        | "fechado"
        | "reaberto"
      status_transacao:
        | "pendente"
        | "processando"
        | "aprovada"
        | "autorizada"
        | "capturada"
        | "paga"
        | "disponivel"
        | "atrasada"
        | "cancelada"
        | "rejeitada"
        | "estornada_parcial"
        | "estornada_total"
        | "reembolsada"
        | "chargeback"
        | "em_disputa"
        | "falhou"
        | "expirada"
      tipo_audit_log:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "login_falha"
        | "troca_senha"
        | "email_verificado"
        | "acesso_negado"
        | "permissao_concedida"
        | "permissao_revogada"
        | "troca_email"
        | "2fa_ativada"
        | "2fa_desativada"
        | "saque_solicitado"
        | "saque_aprovado"
        | "saque_rejeitado"
        | "transacao_aprovada"
        | "transacao_estornada"
        | "convite_enviado"
        | "convite_aceito"
        | "produto_publicado"
        | "checkout_publicado"
      tipo_conta: "corrente" | "poupanca" | "pagamento" | "juridica"
      tipo_cupom: "percentual" | "valor_fixo" | "frete_gratis"
      tipo_curso: "video" | "texto" | "quiz" | "live" | "arquivo" | "webinar"
      tipo_desconto: "percentual" | "valor_fixo"
      tipo_link_pagamento:
        | "simples"
        | "produto"
        | "assinatura"
        | "doacao"
        | "personalizado"
      tipo_notificacao:
        | "sistema"
        | "transacao"
        | "venda"
        | "saque"
        | "comissao"
        | "afiliado"
        | "seguranca"
        | "atualizacao"
        | "promocao"
        | "tarefa"
        | "lembrete"
        | "suporte"
        | "financeiro"
      tipo_operacao:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "approve"
        | "manage"
      tipo_produto: "fisico" | "digital" | "assinatura" | "servico" | "ingresso"
      tipo_rede_afiliado: "uninivel" | "binario" | "matriz"
      tipo_ticket:
        | "suporte"
        | "duvida"
        | "reclamacao"
        | "sugestao"
        | "bug"
        | "financeiro"
      tipo_transacao:
        | "venda"
        | "assinatura"
        | "saque"
        | "transferencia_entrada"
        | "transferencia_saida"
        | "estorno"
        | "reembolso"
        | "chargeback"
        | "taxa_plataforma"
        | "ajuste_credito"
        | "ajuste_debito"
        | "pagamento_comissao"
        | "recolhimento_imposto"
        | "boleto_gerado"
        | "link_pagamento"
        | "recarga_saldo"
        | "cancelamento"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      frequencia_relatorio: [
        "diario",
        "semanal",
        "quinzenal",
        "mensal",
        "trimestral",
        "anual",
      ],
      metodo_pagamento: [
        "pix",
        "cartao_credito",
        "cartao_debito",
        "boleto",
        "ted",
        "doc",
        "picpay",
        "mercadopago",
        "paypal",
        "transferencia",
        "saldo_conta",
        "outro",
      ],
      prioridade_ticket: ["baixa", "media", "alta", "critica", "urgente"],
      status_afiliado: ["pendente", "ativo", "inativo", "suspenso", "banido"],
      status_ativo: ["ativo", "inativo", "suspenso", "bloqueado"],
      status_checkout: ["rascunho", "publicado", "arquivado", "desativado"],
      status_comissao: [
        "pendente",
        "aprovada",
        "liberada",
        "paga",
        "cancelada",
        "estornada",
      ],
      status_cupom: ["ativo", "inativo", "expirado"],
      status_estorno: [
        "solicitado",
        "processando",
        "aprovado_parcial",
        "aprovado_total",
        "concluido",
        "rejeitado",
        "cancelado",
        "em_disputa",
      ],
      status_integracao: [
        "nao_configurado",
        "conectado",
        "erro",
        "expirado",
        "revogado",
      ],
      status_link_pagamento: ["ativo", "expirado", "usado", "desativado"],
      status_marketplace_produto: [
        "pendente_aprovacao",
        "publicado",
        "rejeitado",
        "arquivado",
      ],
      status_matricula: [
        "ativa",
        "pausada",
        "cancelada",
        "concluida",
        "expirada",
      ],
      status_produto: ["rascunho", "publicado", "arquivado", "indisponivel"],
      status_repasse: [
        "agendado",
        "processando",
        "enviado",
        "recebido",
        "confirmado",
        "cancelado",
        "falhou",
      ],
      status_saque: [
        "solicitado",
        "em_analise",
        "aprovado",
        "processando",
        "enviado",
        "pago",
        "cancelado",
        "rejeitado",
        "falhou",
      ],
      status_sessao: ["ativa", "expirada", "revogada", "bloqueada"],
      status_ticket: [
        "aberto",
        "respondido_cliente",
        "respondido_suporte",
        "em_analise",
        "pendente_terceiro",
        "resolvido",
        "fechado",
        "reaberto",
      ],
      status_transacao: [
        "pendente",
        "processando",
        "aprovada",
        "autorizada",
        "capturada",
        "paga",
        "disponivel",
        "atrasada",
        "cancelada",
        "rejeitada",
        "estornada_parcial",
        "estornada_total",
        "reembolsada",
        "chargeback",
        "em_disputa",
        "falhou",
        "expirada",
      ],
      tipo_audit_log: [
        "create",
        "read",
        "update",
        "delete",
        "login",
        "logout",
        "login_falha",
        "troca_senha",
        "email_verificado",
        "acesso_negado",
        "permissao_concedida",
        "permissao_revogada",
        "troca_email",
        "2fa_ativada",
        "2fa_desativada",
        "saque_solicitado",
        "saque_aprovado",
        "saque_rejeitado",
        "transacao_aprovada",
        "transacao_estornada",
        "convite_enviado",
        "convite_aceito",
        "produto_publicado",
        "checkout_publicado",
      ],
      tipo_conta: ["corrente", "poupanca", "pagamento", "juridica"],
      tipo_cupom: ["percentual", "valor_fixo", "frete_gratis"],
      tipo_curso: ["video", "texto", "quiz", "live", "arquivo", "webinar"],
      tipo_desconto: ["percentual", "valor_fixo"],
      tipo_link_pagamento: [
        "simples",
        "produto",
        "assinatura",
        "doacao",
        "personalizado",
      ],
      tipo_notificacao: [
        "sistema",
        "transacao",
        "venda",
        "saque",
        "comissao",
        "afiliado",
        "seguranca",
        "atualizacao",
        "promocao",
        "tarefa",
        "lembrete",
        "suporte",
        "financeiro",
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
      tipo_ticket: [
        "suporte",
        "duvida",
        "reclamacao",
        "sugestao",
        "bug",
        "financeiro",
      ],
      tipo_transacao: [
        "venda",
        "assinatura",
        "saque",
        "transferencia_entrada",
        "transferencia_saida",
        "estorno",
        "reembolso",
        "chargeback",
        "taxa_plataforma",
        "ajuste_credito",
        "ajuste_debito",
        "pagamento_comissao",
        "recolhimento_imposto",
        "boleto_gerado",
        "link_pagamento",
        "recarga_saldo",
        "cancelamento",
      ],
    },
  },
} as const
