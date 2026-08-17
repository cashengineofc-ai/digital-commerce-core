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
      tipo_operacao:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "approve"
        | "manage"
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
      tipo_operacao: [
        "create",
        "read",
        "update",
        "delete",
        "approve",
        "manage",
      ],
    },
  },
} as const
