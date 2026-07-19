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
          bank_id: string | null
          card_group_id: string | null
          color: string | null
          created_at: string
          credit_limit: number | null
          currency: string
          current_balance: number
          icon: string | null
          id: string
          installment_amount: number | null
          interest_rate: number | null
          is_archived: boolean
          logo_url: string | null
          name: string
          network_fee_amount: number
          network_fee_optional: boolean
          payment_due_day: number | null
          principal: number | null
          sort_order: number
          start_date: string | null
          starting_balance: number
          statement_closing_day: number | null
          term_months: number | null
          transfer_tax_rate: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_id?: string | null
          card_group_id?: string | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          currency: string
          current_balance?: number
          icon?: string | null
          id?: string
          installment_amount?: number | null
          interest_rate?: number | null
          is_archived?: boolean
          logo_url?: string | null
          name: string
          network_fee_amount?: number
          network_fee_optional?: boolean
          payment_due_day?: number | null
          principal?: number | null
          sort_order?: number
          start_date?: string | null
          starting_balance?: number
          statement_closing_day?: number | null
          term_months?: number | null
          transfer_tax_rate?: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_id?: string | null
          card_group_id?: string | null
          color?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          current_balance?: number
          icon?: string | null
          id?: string
          installment_amount?: number | null
          interest_rate?: number | null
          is_archived?: boolean
          logo_url?: string | null
          name?: string
          network_fee_amount?: number
          network_fee_optional?: boolean
          payment_due_day?: number | null
          principal?: number | null
          sort_order?: number
          start_date?: string | null
          starting_balance?: number
          statement_closing_day?: number | null
          term_months?: number | null
          transfer_tax_rate?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "card_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_groups: {
        Row: {
          art_color: string | null
          art_url: string | null
          brand: string | null
          created_at: string
          id: string
          last4: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          art_color?: string | null
          art_url?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          last4?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          art_color?: string | null
          art_url?: string | null
          brand?: string | null
          created_at?: string
          id?: string
          last4?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_statements: {
        Row: {
          account_id: string
          created_at: string
          due_date: string | null
          file_url: string | null
          id: string
          period_end: string
          period_start: string
          source: Database["public"]["Enums"]["statement_source"]
          statement_balance: number
          total_balance: number
          total_credits: number
          total_debits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          period_end: string
          period_start: string
          source?: Database["public"]["Enums"]["statement_source"]
          statement_balance?: number
          total_balance?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          due_date?: string | null
          file_url?: string | null
          id?: string
          period_end?: string
          period_start?: string
          source?: Database["public"]["Enums"]["statement_source"]
          statement_balance?: number
          total_balance?: number
          total_credits?: number
          total_debits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          emoji: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          emoji?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      category_budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          name: string
          symbol: string
        }
        Insert: {
          code: string
          name: string
          symbol: string
        }
        Update: {
          code?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          account_id: string | null
          amount: number
          anchor_day: number | null
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          brand: string | null
          category_id: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          anchor_day?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          brand?: string | null
          category_id?: string | null
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          anchor_day?: number | null
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          brand?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "subscriptions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          base_amount: number
          base_total_amount: number
          budget_only: boolean
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          exchange_rate: number
          fee_amount: number
          id: string
          include_commission: boolean
          include_tax: boolean
          notes: string | null
          occurred_at: string
          subscription_id: string | null
          tax_amount: number
          to_account_id: string | null
          total_amount: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          base_amount?: number
          base_total_amount?: number
          budget_only?: boolean
          category_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          exchange_rate?: number
          fee_amount?: number
          id?: string
          include_commission?: boolean
          include_tax?: boolean
          notes?: string | null
          occurred_at?: string
          subscription_id?: string | null
          tax_amount?: number
          to_account_id?: string | null
          total_amount?: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          base_amount?: number
          base_total_amount?: number
          budget_only?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          exchange_rate?: number
          fee_amount?: number
          id?: string
          include_commission?: boolean
          include_tax?: boolean
          notes?: string | null
          occurred_at?: string
          subscription_id?: string | null
          tax_amount?: number
          to_account_id?: string | null
          total_amount?: number
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          base_movement: number | null
          currency: string | null
          starting_balance: number | null
          user_id: string | null
        }
        Relationships: []
      }
      card_status: {
        Row: {
          account_id: string | null
          credit_limit: number | null
          currency: string | null
          latest_due_date: string | null
          latest_statement_balance: number | null
          owed: number | null
          payment_due_day: number | null
          statement_closing_day: number | null
          user_id: string | null
          utilization_pct: number | null
        }
        Relationships: []
      }
      loan_status: {
        Row: {
          account_id: string | null
          currency: string | null
          installment_amount: number | null
          installments_paid: number | null
          outstanding_balance: number | null
          payment_due_day: number | null
          principal: number | null
          term_months: number | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          currency?: string | null
          installment_amount?: number | null
          installments_paid?: never
          outstanding_balance?: never
          payment_due_day?: number | null
          principal?: number | null
          term_months?: number | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          currency?: string | null
          installment_amount?: number | null
          installments_paid?: never
          outstanding_balance?: never
          payment_due_day?: number | null
          principal?: number | null
          term_months?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      monthly_cashflow: {
        Row: {
          expense: number | null
          income: number | null
          month: string | null
          net: number | null
          user_id: string | null
        }
        Relationships: []
      }
      net_worth: {
        Row: {
          base_currency: string | null
          net_worth: number | null
          user_id: string | null
        }
        Insert: {
          base_currency?: string | null
          net_worth?: never
          user_id?: string | null
        }
        Update: {
          base_currency?: string | null
          net_worth?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      category_usage: {
        Args: { p_month: string }
        Returns: {
          budget: number
          category_id: string
          remaining: number
          status: Database["public"]["Enums"]["budget_status"]
          used: number
        }[]
      }
      seed_default_categories: { Args: { p_user: string }; Returns: undefined }
      spend_distribution: {
        Args: { p_month: string }
        Returns: {
          category_id: string
          total: number
        }[]
      }
    }
    Enums: {
      account_type:
        | "checking"
        | "savings"
        | "cash"
        | "investment"
        | "asset"
        | "credit_card"
        | "loan"
      billing_cycle: "weekly" | "monthly" | "yearly" | "custom"
      budget_status: "within" | "approaching" | "over"
      statement_source: "manual" | "import"
      transaction_type: "expense" | "income" | "payment"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: [
        "checking",
        "savings",
        "cash",
        "investment",
        "asset",
        "credit_card",
        "loan",
      ],
      billing_cycle: ["weekly", "monthly", "yearly", "custom"],
      budget_status: ["within", "approaching", "over"],
      statement_source: ["manual", "import"],
      transaction_type: ["expense", "income", "payment"],
    },
  },
} as const
