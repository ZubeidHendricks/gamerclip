export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          email: string
          avatar_url: string | null
          subscription_tier: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          email: string
          avatar_url?: string | null
          subscription_tier?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          email?: string
          avatar_url?: string | null
          subscription_tier?: string
          created_at?: string
          updated_at?: string
        }
      }
      clips: {
        Row: {
          id: string
          user_id: string
          title: string
          source_url: string | null
          source_type: string
          duration: number
          thumbnail_url: string | null
          video_url: string | null
          game_title: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          source_url?: string | null
          source_type: string
          duration?: number
          thumbnail_url?: string | null
          video_url?: string | null
          game_title?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          source_url?: string | null
          source_type?: string
          duration?: number
          thumbnail_url?: string | null
          video_url?: string | null
          game_title?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      style_packs: {
        Row: {
          id: string
          name: string
          game: string
          description: string
          thumbnail_url: string
          is_premium: boolean
          assets_config: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          game: string
          description: string
          thumbnail_url: string
          is_premium?: boolean
          assets_config?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          game?: string
          description?: string
          thumbnail_url?: string
          is_premium?: boolean
          assets_config?: Json
          created_at?: string
        }
      }
      exports: {
        Row: {
          id: string
          user_id: string
          clip_id: string
          style_pack_id: string | null
          output_url: string | null
          status: string
          settings: Json
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          clip_id: string
          style_pack_id?: string | null
          output_url?: string | null
          status?: string
          settings?: Json
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          clip_id?: string
          style_pack_id?: string | null
          output_url?: string | null
          status?: string
          settings?: Json
          created_at?: string
          completed_at?: string | null
        }
      }
      ai_detections: {
        Row: {
          id: string
          clip_id: string
          detection_type: string
          timestamp: number
          confidence: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          detection_type: string
          timestamp: number
          confidence: number
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          detection_type?: string
          timestamp?: number
          confidence?: number
          metadata?: Json
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
