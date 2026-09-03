export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      quiz_answer_events: {
        Row: {
          answer_order: number;
          id: string;
          is_correct: boolean;
          points_awarded: number;
          question_id: string;
          round: number;
          selected_answer: number;
          submitted_at: string;
          team_id: string;
        };
        Insert: {
          answer_order?: number;
          id?: string;
          is_correct: boolean;
          points_awarded: number;
          question_id: string;
          round: number;
          selected_answer: number;
          submitted_at?: string;
          team_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_answer_events"]["Insert"]>;
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          completed_at: string | null;
          id: string;
          question_number: number;
          round: number;
          started_at: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          id?: string;
          question_number: number;
          round: number;
          started_at?: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quiz_questions"]["Insert"]>;
        Relationships: [];
      };
      teams: {
        Row: {
          bracket: number;
          created_at: string;
          current_round: number;
          group_name: string;
          id: string;
          position: number;
          qualified_for_final: boolean;
          qualified_from_round: number | null;
          round_1_correct: number;
          round_1_score: number | null;
          round_1_time: number;
          round_2_correct: number;
          round_2_score: number | null;
          round_2_time: number;
          round_3_correct: number;
          round_3_score: number | null;
          round_3_time: number;
          team_name: string;
          total_score: number;
          updated_at: string;
        };
        Insert: {
          bracket?: number;
          created_at?: string;
          current_round?: number;
          group_name: string;
          id?: string;
          position?: number;
          qualified_for_final?: boolean;
          qualified_from_round?: number | null;
          round_1_correct?: number;
          round_1_score?: number | null;
          round_1_time?: number;
          round_2_correct?: number;
          round_2_score?: number | null;
          round_2_time?: number;
          round_3_correct?: number;
          round_3_score?: number | null;
          round_3_time?: number;
          team_name: string;
          total_score?: number;
          updated_at?: string;
        };
        Update: {
          bracket?: number;
          created_at?: string;
          current_round?: number;
          group_name?: string;
          id?: string;
          position?: number;
          qualified_for_final?: boolean;
          qualified_from_round?: number | null;
          round_1_correct?: number;
          round_1_score?: number | null;
          round_1_time?: number;
          round_2_correct?: number;
          round_2_score?: number | null;
          round_2_time?: number;
          round_3_correct?: number;
          round_3_score?: number | null;
          round_3_time?: number;
          team_name?: string;
          total_score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      expire_quiz_question: {
        Args: { p_question_id: string };
        Returns: boolean;
      };
      ensure_quiz_question: {
        Args: { p_question_number: number; p_round: number };
        Returns: Database["public"]["Tables"]["quiz_questions"]["Row"];
      };
      recalculate_qualification: { Args: never; Returns: undefined };
      submit_quiz_answer: {
        Args: {
          p_correct_answer: number;
          p_question_number: number;
          p_round: number;
          p_selected_answer: number;
          p_team_id: string;
        };
        Returns: {
          accepted: boolean;
          answer_order: number;
          is_correct: boolean;
          points_awarded: number;
          question_status: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
