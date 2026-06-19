// AUTO-GENERATED — do not edit manually
// Regenerate after schema changes: npm run db:types
//
// This is a hand-written stub that mirrors the migration.
// Run `npm run db:types` after `supabase db push` to replace with the real generated file.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      quests: {
        Row: {
          id: string;
          slug: string;
          title: Json;
          description: Json;
          city: string | null;
          is_published: boolean;
          attempts_before_hint: number;
          cover_gradient: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: Json;
          description: Json;
          city?: string | null;
          is_published?: boolean;
          attempts_before_hint?: number;
          cover_gradient?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quests']['Insert']>;
      };
      clues: {
        Row: {
          id: string;
          quest_id: string;
          order: number;
          title: Json;
          content: Json;
          code: string;
          hint: Json | null;
          found_label: Json | null;
          location_name: string | null;
          lat: number | null;
          lng: number | null;
          media_url: string | null;
        };
        Insert: {
          id?: string;
          quest_id: string;
          order: number;
          title: Json;
          content: Json;
          code: string;
          hint?: Json | null;
          found_label?: Json | null;
          location_name?: string | null;
          lat?: number | null;
          lng?: number | null;
          media_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['clues']['Insert']>;
      };
      teams: {
        Row: {
          id: string;
          quest_id: string;
          name: string;
          join_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          quest_id: string;
          name: string;
          join_code: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
      };
      sessions: {
        Row: {
          id: string;
          quest_id: string;
          team_id: string | null;
          device_id: string;
          nickname: string;
          lang: string;
          current_clue: number;
          started_at: string;
          last_active_at: string;
          finished_at: string | null;
          is_test: boolean;
        };
        Insert: {
          id?: string;
          quest_id: string;
          team_id?: string | null;
          device_id: string;
          nickname: string;
          lang?: string;
          current_clue?: number;
          started_at?: string;
          last_active_at?: string;
          finished_at?: string | null;
          is_test?: boolean;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'sessions_quest_id_fkey';
            columns: ['quest_id'];
            isOneToOne: false;
            referencedRelation: 'quests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_team_id_fkey';
            columns: ['team_id'];
            isOneToOne: false;
            referencedRelation: 'teams';
            referencedColumns: ['id'];
          },
        ];
      };
      attempt_log: {
        Row: {
          id: string;
          session_id: string;
          clue_order: number;
          code_entered: string;
          is_correct: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          clue_order: number;
          code_entered: string;
          is_correct: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attempt_log']['Insert']>;
      };
      admins: {
        Row: { user_id: string };
        Insert: { user_id: string };
        Update: { user_id?: string };
      };
      admin_prompts: {
        Row: {
          id: string;
          label: string;
          description: string;
          template: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          description: string;
          template: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['admin_prompts']['Insert']>;
      };
    };
    Views: {
      clues_public: {
        Row: {
          id: string;
          quest_id: string;
          order: number;
          title: Json;
          content: Json;
          hint: Json | null;
          found_label: Json | null;
          location_name: string | null;
          lat: number | null;
          lng: number | null;
          media_url: string | null;
        };
      };
    };
    Functions: {
      start_session: {
        Args: {
          p_quest_slug: string;
          p_nickname: string;
          p_device_id: string;
          p_lang?: string;
          p_team_id?: string | null;
        };
        Returns: string; // uuid
      };
      create_team: {
        Args: { p_quest_slug: string; p_name: string };
        Returns: Json; // { team_id, join_code }
      };
      join_team_by_code: {
        Args: {
          p_code: string;
          p_nickname: string;
          p_device_id: string;
          p_lang?: string;
        };
        Returns: Json; // { session_id } | { error }
      };
      check_clue_code: {
        Args: { p_session_id: string; p_code: string };
        Returns: Json;
      };
      get_session: {
        Args: { p_session_id: string };
        Returns: Json;
      };
      get_leaderboard: {
        Args: { p_quest_id: string; p_limit?: number };
        Returns: Json;
      };
    };
  };
}
