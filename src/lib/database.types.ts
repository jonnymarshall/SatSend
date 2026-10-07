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
    PostgrestVersion: "14.18"
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
      email_events: {
        Row: {
          created_at: string
          email_type: Database["public"]["Enums"]["email_type"]
          error_message: string | null
          id: string
          invoice_id: string
          recipient: string
          resend_message_id: string | null
          status: Database["public"]["Enums"]["email_event_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_type: Database["public"]["Enums"]["email_type"]
          error_message?: string | null
          id?: string
          invoice_id: string
          recipient: string
          resend_message_id?: string | null
          status?: Database["public"]["Enums"]["email_event_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_type?: Database["public"]["Enums"]["email_type"]
          error_message?: string | null
          id?: string
          invoice_id?: string
          recipient?: string
          resend_message_id?: string | null
          status?: Database["public"]["Enums"]["email_event_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_email_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["invoice_event_type"]
          id: string
          invoice_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["invoice_event_type"]
          id?: string
          invoice_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["invoice_event_type"]
          id?: string
          invoice_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_email_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          access_code: string | null
          amount_received_fiat: number | null
          amount_received_sats: number | null
          btc_address: string | null
          btc_price_at_detection: number | null
          btc_txid: string | null
          client_address: string | null
          client_company: string | null
          client_email: string
          client_name: string
          client_tax_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          email_attempted_at: string | null
          id: string
          invoice_number: string | null
          line_items: Json
          mempool_seen_at: string | null
          next_check_at: string | null
          overpaid: boolean
          pre_archive_status:
            | Database["public"]["Enums"]["invoice_status"]
            | null
          published_at: string | null
          send_method: string | null
          sent_at: string | null
          stage_attempt: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_fiat: number
          tax_fiat: number
          tax_percent: number
          total_fiat: number
          updated_at: string
          user_id: string
          your_address: string | null
          your_company: string | null
          your_email: string | null
          your_name: string | null
          your_tax_id: string | null
        }
        Insert: {
          access_code?: string | null
          amount_received_fiat?: number | null
          amount_received_sats?: number | null
          btc_address?: string | null
          btc_price_at_detection?: number | null
          btc_txid?: string | null
          client_address?: string | null
          client_company?: string | null
          client_email: string
          client_name: string
          client_tax_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          email_attempted_at?: string | null
          id?: string
          invoice_number?: string | null
          line_items?: Json
          mempool_seen_at?: string | null
          next_check_at?: string | null
          overpaid?: boolean
          pre_archive_status?:
            | Database["public"]["Enums"]["invoice_status"]
            | null
          published_at?: string | null
          send_method?: string | null
          sent_at?: string | null
          stage_attempt?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_fiat?: number
          tax_fiat?: number
          tax_percent?: number
          total_fiat?: number
          updated_at?: string
          user_id: string
          your_address?: string | null
          your_company?: string | null
          your_email?: string | null
          your_name?: string | null
          your_tax_id?: string | null
        }
        Update: {
          access_code?: string | null
          amount_received_fiat?: number | null
          amount_received_sats?: number | null
          btc_address?: string | null
          btc_price_at_detection?: number | null
          btc_txid?: string | null
          client_address?: string | null
          client_company?: string | null
          client_email?: string
          client_name?: string
          client_tax_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          email_attempted_at?: string | null
          id?: string
          invoice_number?: string | null
          line_items?: Json
          mempool_seen_at?: string | null
          next_check_at?: string | null
          overpaid?: boolean
          pre_archive_status?:
            | Database["public"]["Enums"]["invoice_status"]
            | null
          published_at?: string | null
          send_method?: string | null
          sent_at?: string | null
          stage_attempt?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_fiat?: number
          tax_fiat?: number
          tax_percent?: number
          total_fiat?: number
          updated_at?: string
          user_id?: string
          your_address?: string | null
          your_company?: string | null
          your_email?: string | null
          your_name?: string | null
          your_tax_id?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          event_type: string
          received_at: string
          svix_id: string
        }
        Insert: {
          event_type: string
          received_at?: string
          svix_id: string
        }
        Update: {
          event_type?: string
          received_at?: string
          svix_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      invoice_email_summary: {
        Row: {
          access_code: string | null
          amount_received_fiat: number | null
          amount_received_sats: number | null
          btc_address: string | null
          btc_price_at_detection: number | null
          btc_txid: string | null
          client_address: string | null
          client_company: string | null
          client_email: string | null
          client_name: string | null
          client_tax_id: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          email_attempted_at: string | null
          id: string | null
          invoice_number: string | null
          last_publish_email_at: string | null
          last_publish_email_error: string | null
          last_publish_email_status:
            | Database["public"]["Enums"]["email_event_status"]
            | null
          line_items: Json | null
          mempool_seen_at: string | null
          next_check_at: string | null
          overpaid: boolean | null
          pre_archive_status:
            | Database["public"]["Enums"]["invoice_status"]
            | null
          published_at: string | null
          send_method: string | null
          sent_at: string | null
          stage_attempt: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal_fiat: number | null
          tax_fiat: number | null
          tax_percent: number | null
          total_fiat: number | null
          updated_at: string | null
          user_id: string | null
          your_address: string | null
          your_company: string | null
          your_email: string | null
          your_name: string | null
          your_tax_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_address_registered: { Args: { addr: string }; Returns: boolean }
      line_items_valid: { Args: { items: Json }; Returns: boolean }
    }
    Enums: {
      email_event_status:
        | "queued"
        | "sent"
        | "failed"
        | "skipped_no_api_key"
        | "delivered"
        | "bounced"
        | "complained"
      email_type: "invoice_published" | "payment_detected" | "payment_confirmed"
      invoice_event_type:
        | "marked_as_sent"
        | "marked_as_paid"
        | "marked_as_overdue"
        | "marked_as_unpaid"
      invoice_status:
        | "draft"
        | "pending"
        | "payment_detected"
        | "paid"
        | "overdue"
        | "archived"
        | "underpaid"
    }
    CompositeTypes: {
      invoice_broadcast_record: {
        id: string | null
        status: string | null
        btc_txid: string | null
      }
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
      email_event_status: [
        "queued",
        "sent",
        "failed",
        "skipped_no_api_key",
        "delivered",
        "bounced",
        "complained",
      ],
      email_type: [
        "invoice_published",
        "payment_detected",
        "payment_confirmed",
      ],
      invoice_event_type: [
        "marked_as_sent",
        "marked_as_paid",
        "marked_as_overdue",
        "marked_as_unpaid",
      ],
      invoice_status: [
        "draft",
        "pending",
        "payment_detected",
        "paid",
        "overdue",
        "archived",
        "underpaid",
      ],
    },
  },
} as const
