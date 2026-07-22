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
          original_term_months: number | null
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
          original_term_months?: number | null
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
          original_term_months?: number | null
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
      card_statement_lines: {
        Row: {
          account_id: string
          amount: number
          auth_code: string | null
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["statement_line_kind"]
          line_no: number
          made_on: string
          mcc: string | null
          posted_on: string
          reference: string | null
          statement_id: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          auth_code?: string | null
          created_at?: string
          description: string
          id?: string
          kind: Database["public"]["Enums"]["statement_line_kind"]
          line_no: number
          made_on: string
          mcc?: string | null
          posted_on: string
          reference?: string | null
          statement_id: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          auth_code?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["statement_line_kind"]
          line_no?: number
          made_on?: string
          mcc?: string | null
          posted_on?: string
          reference?: string | null
          statement_id?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "card_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "card_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_statement_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      card_statements: {
        Row: {
          account_id: string
          available_credit: number | null
          avg_daily_balance: number | null
          avg_daily_balance_prior: number | null
          cost_of_carry: number | null
          cost_of_carry_prior: number | null
          created_at: string
          credit_limit: number | null
          due_date: string | null
          file_url: string | null
          id: string
          import_id: string | null
          interest_rate_annual: number | null
          minimum_payment: number | null
          overdue_amount: number | null
          overdue_installments: number | null
          period_end: string
          period_start: string
          previous_balance: number | null
          section_key: string | null
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
          available_credit?: number | null
          avg_daily_balance?: number | null
          avg_daily_balance_prior?: number | null
          cost_of_carry?: number | null
          cost_of_carry_prior?: number | null
          created_at?: string
          credit_limit?: number | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          import_id?: string | null
          interest_rate_annual?: number | null
          minimum_payment?: number | null
          overdue_amount?: number | null
          overdue_installments?: number | null
          period_end: string
          period_start: string
          previous_balance?: number | null
          section_key?: string | null
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
          available_credit?: number | null
          avg_daily_balance?: number | null
          avg_daily_balance_prior?: number | null
          cost_of_carry?: number | null
          cost_of_carry_prior?: number | null
          created_at?: string
          credit_limit?: number | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          import_id?: string | null
          interest_rate_annual?: number | null
          minimum_payment?: number | null
          overdue_amount?: number | null
          overdue_installments?: number | null
          period_end?: string
          period_start?: string
          previous_balance?: number | null
          section_key?: string | null
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
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
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
          {
            foreignKeyName: "card_statements_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "statement_imports"
            referencedColumns: ["id"]
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
      category_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          pattern: string
          priority: number
          rule_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          pattern: string
          priority?: number
          rule_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          pattern?: string
          priority?: number
          rule_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
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
          onboarded_at: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      statement_imports: {
        Row: {
          card_group_id: string | null
          created_at: string
          error: string | null
          file_name: string
          file_path: string | null
          id: string
          parser_id: string
          status: string
          user_id: string
        }
        Insert: {
          card_group_id?: string | null
          created_at?: string
          error?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          parser_id: string
          status?: string
          user_id: string
        }
        Update: {
          card_group_id?: string | null
          created_at?: string
          error?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          parser_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_imports_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "card_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_section_mappings: {
        Row: {
          account_id: string
          card_group_id: string
          created_at: string
          id: string
          parser_id: string
          section_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          card_group_id: string
          created_at?: string
          id?: string
          parser_id: string
          section_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          card_group_id?: string
          created_at?: string
          id?: string
          parser_id?: string
          section_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "card_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loan_status"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "statement_section_mappings_card_group_id_fkey"
            columns: ["card_group_id"]
            isOneToOne: false
            referencedRelation: "card_groups"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
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
          statement_line_id: string | null
          subscription_id: string | null
          tax_amount: number
          to_account_id: string | null
          to_amount: number | null
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
          statement_line_id?: string | null
          subscription_id?: string | null
          tax_amount?: number
          to_account_id?: string | null
          to_amount?: number | null
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
          statement_line_id?: string | null
          subscription_id?: string | null
          tax_amount?: number
          to_account_id?: string | null
          to_amount?: number | null
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
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
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
            foreignKeyName: "transactions_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "card_statement_lines"
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
            referencedRelation: "card_cost_of_carry"
            referencedColumns: ["account_id"]
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
      card_cost_of_carry: {
        Row: {
          account_id: string | null
          avg_daily_balance: number | null
          cost_of_carry: number | null
          cost_of_carry_prior: number | null
          currency: string | null
          group_name: string | null
          interest_rate_annual: number | null
          name: string | null
          period_end: string | null
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
          original_term_months: number | null
          outstanding_balance: number | null
          payment_due_day: number | null
          principal: number | null
          progress_installments_paid: number | null
          progress_term_months: number | null
          term_months: number | null
          user_id: string | null
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
      delete_own_account: { Args: never; Returns: undefined }
      import_card_statement: { Args: { p: Json }; Returns: string }
      recompute_card_balance: {
        Args: { p_account: string }
        Returns: undefined
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
      statement_line_kind: "purchase" | "fee" | "credit" | "payment"
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
      statement_line_kind: ["purchase", "fee", "credit", "payment"],
      statement_source: ["manual", "import"],
      transaction_type: ["expense", "income", "payment"],
    },
  },
} as const
