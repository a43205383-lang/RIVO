import type {
  Currency,
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
  UserRole,
} from '@/shared/types/domain'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProfileRow = {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export type ExpenseRow = {
  id: string
  user_id: string
  merchant: string | null
  merchant_normalized: string | null
  expense_date: string | null
  currency: Currency
  subtotal: number | null
  tax: number | null
  tip: number | null
  total: number | null
  payment_method: PaymentMethod | null
  rnc: string | null
  ncf: string | null
  category: ExpenseCategory
  notes: string | null
  status: ExpenseStatus
  ai_confidence: Json | null
  ai_notes: string | null
  review_reason: string | null
  approval_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export type ExpenseItemRow = {
  id: string
  expense_id: string
  description: string
  quantity: number
  unit_price: number | null
  line_total: number | null
  position: number
  created_at: string
}

export type ExpenseImageRow = {
  id: string
  expense_id: string
  storage_path: string
  thumb_path: string | null
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  image_hash: string | null
  position: number
  created_at: string
}

export type AiUsageRow = {
  id: number
  user_id: string
  kind: 'extract' | 'ask'
  status: 'started' | 'succeeded' | 'failed'
  created_at: string
}

export type ProfileInsert = {
  id: string
  email: string
  full_name?: string
  role?: UserRole
  created_at?: string
  updated_at?: string
}

export type ProfileUpdate = {
  email?: string
  full_name?: string
  role?: UserRole
  updated_at?: string
}

type ExpenseInsert = {
  id?: string
  user_id: string
  merchant?: string | null
  expense_date?: string | null
  currency?: Currency
  subtotal?: number | null
  tax?: number | null
  tip?: number | null
  total?: number | null
  payment_method?: PaymentMethod | null
  rnc?: string | null
  ncf?: string | null
  category?: ExpenseCategory
  notes?: string | null
  status?: ExpenseStatus
  ai_confidence?: Json | null
  ai_notes?: string | null
  review_reason?: string | null
  approval_comment?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  submitted_at?: string | null
  created_at?: string
  updated_at?: string
}

export type ExpenseUpdate = Partial<Omit<ExpenseInsert, 'user_id' | 'created_at'> & { user_id?: string }>

type ExpenseItemInsert = {
  id?: string
  expense_id: string
  description: string
  quantity?: number
  unit_price?: number | null
  line_total?: number | null
  position?: number
  created_at?: string
}

type ExpenseItemUpdate = Partial<Omit<ExpenseItemInsert, 'expense_id'>>

type ExpenseImageInsert = {
  id?: string
  expense_id: string
  storage_path: string
  thumb_path?: string | null
  mime_type: string
  size_bytes: number
  width?: number | null
  height?: number | null
  image_hash?: string | null
  position?: number
  created_at?: string
}

type ExpenseImageUpdate = Partial<Omit<ExpenseImageInsert, 'expense_id'>>

type ExpenseRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneRelation: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export interface Database {
  public: {
    __InternalSupabase: { PostgrestVersion: '12' }
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      expenses: {
        Row: ExpenseRow
        Insert: ExpenseInsert
        Update: ExpenseUpdate
        Relationships: [
          {
            foreignKeyName: 'expenses_user_id_fkey'
            columns: ['user_id']
            isOneRelation: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneRelation: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      expense_items: {
        Row: ExpenseItemRow
        Insert: ExpenseItemInsert
        Update: ExpenseItemUpdate
        Relationships: [
          {
            foreignKeyName: 'expense_items_expense_id_fkey'
            columns: ['expense_id']
            isOneRelation: true
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
        ]
      }
      expense_images: {
        Row: ExpenseImageRow
        Insert: ExpenseImageInsert
        Update: ExpenseImageUpdate
        Relationships: [
          {
            foreignKeyName: 'expense_images_expense_id_fkey'
            columns: ['expense_id']
            isOneRelation: true
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
        ]
      }
      ai_usage: {
        Row: AiUsageRow
        Insert: {
          user_id: string
          kind: 'extract' | 'ask'
          status?: 'started' | 'succeeded' | 'failed'
          created_at?: string
        }
        Update: {
          status?: 'started' | 'succeeded' | 'failed'
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_user_id_fkey'
            columns: ['user_id']
            isOneRelation: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      approve_expense: {
        Args: { p_expense_id: string; p_comment?: string | null }
        Returns: ExpenseRow
      }
      reject_expense: {
        Args: { p_expense_id: string; p_comment: string }
        Returns: ExpenseRow
      }
      is_accountant: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_monthly_summary: {
        Args: {
          p_from: string
          p_to: string
          p_currency: string
          p_scope_all?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      user_role: UserRole
      expense_status: ExpenseStatus
      expense_category: ExpenseCategory
      payment_method: PaymentMethod
    }
    CompositeTypes: Record<string, never>
  }
  graphql_public: { Tables: Record<string, never>; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> }
}

export type ExpenseWithRelations = ExpenseRow & {
  images: ExpenseImageRow[]
  items: ExpenseItemRow[]
  reviewer?: Pick<ProfileRow, 'id' | 'full_name' | 'email'> | null
  owner?: Pick<ProfileRow, 'id' | 'full_name' | 'email'> | null
}

export type ProfileRelationship = ExpenseRelationship
