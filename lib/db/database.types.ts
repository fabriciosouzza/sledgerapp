export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          closing_day: number | null
          created_at: string
          credit_limit_cents: number | null
          due_day: number | null
          id: string
          institution: string | null
          is_active: boolean
          name: string
          opening_balance_cents: number
          opening_on: string
          sort_order: number
          target_cents: number | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          closing_day?: number | null
          created_at?: string
          credit_limit_cents?: number | null
          due_day?: number | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name: string
          opening_balance_cents?: number
          opening_on?: string
          sort_order?: number
          target_cents?: number | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          closing_day?: number | null
          created_at?: string
          credit_limit_cents?: number | null
          due_day?: number | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name?: string
          opening_balance_cents?: number
          opening_on?: string
          sort_order?: number
          target_cents?: number | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_movements: {
        Row: {
          amount_cents: number
          asset_id: string
          created_at: string
          date: string
          entry_id: string | null
          id: string
          kind: Database["public"]["Enums"]["movement_kind"]
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          asset_id: string
          created_at?: string
          date: string
          entry_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["movement_kind"]
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          asset_id?: string
          created_at?: string
          date?: string
          entry_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["movement_kind"]
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_fkey"
            columns: ["asset_id", "user_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "asset_movements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          broker: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          subclass: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          broker?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subclass?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          broker?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subclass?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          applies_to: Database["public"]["Enums"]["entry_kind"][] | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_benefit: boolean
          monthly_cap_cents: number | null
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["entry_kind"][] | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_benefit?: boolean
          monthly_cap_cents?: number | null
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["entry_kind"][] | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_benefit?: boolean
          monthly_cap_cents?: number | null
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_fkey"
            columns: ["parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      entries: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string | null
          counter_account_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          installment_group_id: string | null
          installment_no: number | null
          installment_total: number | null
          kind: Database["public"]["Enums"]["entry_kind"]
          notes: string | null
          period: string | null
          recurrence_id: string | null
          settled_on: string | null
          source: Database["public"]["Enums"]["entry_source"]
          statement_id: string | null
          status: Database["public"]["Enums"]["entry_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id?: string | null
          counter_account_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          installment_group_id?: string | null
          installment_no?: number | null
          installment_total?: number | null
          kind: Database["public"]["Enums"]["entry_kind"]
          notes?: string | null
          period?: string | null
          recurrence_id?: string | null
          settled_on?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          statement_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string | null
          counter_account_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          installment_group_id?: string | null
          installment_no?: number | null
          installment_total?: number | null
          kind?: Database["public"]["Enums"]["entry_kind"]
          notes?: string | null
          period?: string | null
          recurrence_id?: string | null
          settled_on?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          statement_id?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_account_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "entries_category_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "entries_counter_account_fkey"
            columns: ["counter_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "entries_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_statement_fkey"
            columns: ["statement_id", "user_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      recurrences: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string | null
          counter_account_id: string | null
          created_at: string
          description: string
          due_day: number
          ends_on: string | null
          id: string
          is_active: boolean
          is_variable: boolean
          kind: Database["public"]["Enums"]["entry_kind"]
          starts_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id?: string | null
          counter_account_id?: string | null
          created_at?: string
          description: string
          due_day: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          is_variable?: boolean
          kind: Database["public"]["Enums"]["entry_kind"]
          starts_on: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string | null
          counter_account_id?: string | null
          created_at?: string
          description?: string
          due_day?: number
          ends_on?: string | null
          id?: string
          is_active?: boolean
          is_variable?: boolean
          kind?: Database["public"]["Enums"]["entry_kind"]
          starts_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurrences_category_fkey"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurrences_counter_account_fkey"
            columns: ["counter_account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      statements: {
        Row: {
          account_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          due_date: string
          id: string
          paid_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          due_date: string
          id?: string
          paid_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          due_date?: string
          id?: string
          paid_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statements_account_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "cash"
        | "credit_card"
        | "brokerage"
        | "other"
      asset_class:
        | "fixed_income"
        | "crypto"
        | "foreign_currency"
        | "stocks"
        | "reits"
        | "other"
      entry_kind: "income" | "expense" | "contribution" | "transfer"
      entry_source: "manual" | "recurrence" | "installment"
      entry_status: "planned" | "settled"
      movement_kind:
        | "contribution"
        | "yield"
        | "market_adjustment"
        | "withdrawal"
        | "fee_tax"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: [
        "checking",
        "savings",
        "cash",
        "credit_card",
        "brokerage",
        "other",
      ],
      asset_class: [
        "fixed_income",
        "crypto",
        "foreign_currency",
        "stocks",
        "reits",
        "other",
      ],
      entry_kind: ["income", "expense", "contribution", "transfer"],
      entry_source: ["manual", "recurrence", "installment"],
      entry_status: ["planned", "settled"],
      movement_kind: [
        "contribution",
        "yield",
        "market_adjustment",
        "withdrawal",
        "fee_tax",
      ],
    },
  },
} as const

