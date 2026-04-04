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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      atleti: {
        Row: {
          atleta_federazione: boolean | null
          attivo: boolean | null
          attivo_come_monitore: boolean | null
          carriera_artistica: string | null
          carriera_stile: string | null
          club_id: string
          codice_fiscale: string | null
          cognome: string
          compenso_orario_pista: number | null
          created_at: string
          data_nascita: string | null
          disco_in_preparazione: string | null
          disco_url: string | null
          foto_url: string | null
          genitore1_cognome: string | null
          genitore1_email: string | null
          genitore1_nome: string | null
          genitore1_telefono: string | null
          genitore2_cognome: string | null
          genitore2_email: string | null
          genitore2_nome: string | null
          genitore2_telefono: string | null
          id: string
          indirizzo: string | null
          licenza_sis_categoria: string | null
          licenza_sis_disciplina: string | null
          licenza_sis_numero: string | null
          licenza_sis_validita_a: string | null
          luogo_nascita: string | null
          nome: string
          note: string | null
          ore_pista_stagione: number | null
          percorso_amatori: string | null
          ruolo_pista: string | null
          tag_nfc: string | null
          telefono: string | null
        }
        Insert: {
          atleta_federazione?: boolean | null
          attivo?: boolean | null
          attivo_come_monitore?: boolean | null
          carriera_artistica?: string | null
          carriera_stile?: string | null
          club_id: string
          codice_fiscale?: string | null
          cognome?: string
          compenso_orario_pista?: number | null
          created_at?: string
          data_nascita?: string | null
          disco_in_preparazione?: string | null
          disco_url?: string | null
          foto_url?: string | null
          genitore1_cognome?: string | null
          genitore1_email?: string | null
          genitore1_nome?: string | null
          genitore1_telefono?: string | null
          genitore2_cognome?: string | null
          genitore2_email?: string | null
          genitore2_nome?: string | null
          genitore2_telefono?: string | null
          id?: string
          indirizzo?: string | null
          licenza_sis_categoria?: string | null
          licenza_sis_disciplina?: string | null
          licenza_sis_numero?: string | null
          licenza_sis_validita_a?: string | null
          luogo_nascita?: string | null
          nome?: string
          note?: string | null
          ore_pista_stagione?: number | null
          percorso_amatori?: string | null
          ruolo_pista?: string | null
          tag_nfc?: string | null
          telefono?: string | null
        }
        Update: {
          atleta_federazione?: boolean | null
          attivo?: boolean | null
          attivo_come_monitore?: boolean | null
          carriera_artistica?: string | null
          carriera_stile?: string | null
          club_id?: string
          codice_fiscale?: string | null
          cognome?: string
          compenso_orario_pista?: number | null
          created_at?: string
          data_nascita?: string | null
          disco_in_preparazione?: string | null
          disco_url?: string | null
          foto_url?: string | null
          genitore1_cognome?: string | null
          genitore1_email?: string | null
          genitore1_nome?: string | null
          genitore1_telefono?: string | null
          genitore2_cognome?: string | null
          genitore2_email?: string | null
          genitore2_nome?: string | null
          genitore2_telefono?: string | null
          id?: string
          indirizzo?: string | null
          licenza_sis_categoria?: string | null
          licenza_sis_disciplina?: string | null
          licenza_sis_numero?: string | null
          licenza_sis_validita_a?: string | null
          luogo_nascita?: string | null
          nome?: string
          note?: string | null
          ore_pista_stagione?: number | null
          percorso_amatori?: string | null
          ruolo_pista?: string | null
          tag_nfc?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      configurazione_ghiaccio: {
        Row: {
          club_id: string
          created_at: string
          durata_pulizia_minuti: number
          id: string
          max_atleti_contemporanei: number
          max_atleti_per_istruttore: number
          min_atleti_attivazione_corso: number
          ora_apertura_default: string
          ora_chiusura_default: string
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          durata_pulizia_minuti?: number
          id?: string
          max_atleti_contemporanei?: number
          max_atleti_per_istruttore?: number
          min_atleti_attivazione_corso?: number
          ora_apertura_default?: string
          ora_chiusura_default?: string
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          durata_pulizia_minuti?: number
          id?: string
          max_atleti_contemporanei?: number
          max_atleti_per_istruttore?: number
          min_atleti_attivazione_corso?: number
          ora_apertura_default?: string
          ora_chiusura_default?: string
          stagione_id?: string | null
        }
        Relationships: []
      }
      corsi: {
        Row: {
          attivo: boolean | null
          club_id: string
          costo_annuale: number | null
          costo_mensile: number | null
          created_at: string
          giorno: string
          id: string
          livello_richiesto: string | null
          nome: string
          note: string | null
          ora_fine: string
          ora_inizio: string
          stagione_id: string | null
          tipo: string | null
        }
        Insert: {
          attivo?: boolean | null
          club_id: string
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          giorno?: string
          id?: string
          livello_richiesto?: string | null
          nome?: string
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          stagione_id?: string | null
          tipo?: string | null
        }
        Update: {
          attivo?: boolean | null
          club_id?: string
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          giorno?: string
          id?: string
          livello_richiesto?: string | null
          nome?: string
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          stagione_id?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      corsi_istruttori: {
        Row: {
          corso_id: string
          created_at: string
          id: string
          istruttore_id: string
        }
        Insert: {
          corso_id: string
          created_at?: string
          id?: string
          istruttore_id: string
        }
        Update: {
          corso_id?: string
          created_at?: string
          id?: string
          istruttore_id?: string
        }
        Relationships: []
      }
      corsi_monitori: {
        Row: {
          corso_id: string
          created_at: string
          id: string
          persona_id: string
          tipo: string
        }
        Insert: {
          corso_id: string
          created_at?: string
          id?: string
          persona_id: string
          tipo?: string
        }
        Update: {
          corso_id?: string
          created_at?: string
          id?: string
          persona_id?: string
          tipo?: string
        }
        Relationships: []
      }
      disponibilita_ghiaccio: {
        Row: {
          club_id: string
          created_at: string
          giorno: string
          id: string
          note: string | null
          ora_fine: string
          ora_inizio: string
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          giorno?: string
          id?: string
          note?: string | null
          ora_fine: string
          ora_inizio: string
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          giorno?: string
          id?: string
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          stagione_id?: string | null
        }
        Relationships: []
      }
      disponibilita_istruttori: {
        Row: {
          club_id: string
          created_at: string
          giorno: string
          id: string
          istruttore_id: string
          ora_fine: string
          ora_inizio: string
        }
        Insert: {
          club_id: string
          created_at?: string
          giorno?: string
          id?: string
          istruttore_id: string
          ora_fine: string
          ora_inizio: string
        }
        Update: {
          club_id?: string
          created_at?: string
          giorno?: string
          id?: string
          istruttore_id?: string
          ora_fine?: string
          ora_inizio?: string
        }
        Relationships: []
      }
      impostazioni_planning: {
        Row: {
          club_id: string
          created_at: string
          durata_slot_minuti: number
          id: string
          ora_fine_giornata: string
          ora_inizio_giornata: string
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          durata_slot_minuti?: number
          id?: string
          ora_fine_giornata?: string
          ora_inizio_giornata?: string
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          durata_slot_minuti?: number
          id?: string
          ora_fine_giornata?: string
          ora_inizio_giornata?: string
          stagione_id?: string | null
        }
        Relationships: []
      }
      inviti_genitori: {
        Row: {
          atleta_id: string
          club_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          usato: boolean
        }
        Insert: {
          atleta_id: string
          club_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          usato?: boolean
        }
        Update: {
          atleta_id?: string
          club_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          usato?: boolean
        }
        Relationships: []
      }
      iscrizioni_corsi: {
        Row: {
          atleta_id: string
          attiva: boolean | null
          corso_id: string
          created_at: string
          id: string
          note_salto_livello: string | null
          salto_livello: boolean | null
        }
        Insert: {
          atleta_id: string
          attiva?: boolean | null
          corso_id: string
          created_at?: string
          id?: string
          note_salto_livello?: string | null
          salto_livello?: boolean | null
        }
        Update: {
          atleta_id?: string
          attiva?: boolean | null
          corso_id?: string
          created_at?: string
          id?: string
          note_salto_livello?: string | null
          salto_livello?: boolean | null
        }
        Relationships: []
      }
      presenze_corso: {
        Row: {
          atleta_id: string
          corso_id: string
          created_at: string
          data: string
          id: string
          presente: boolean | null
        }
        Insert: {
          atleta_id: string
          corso_id: string
          created_at?: string
          data: string
          id?: string
          presente?: boolean | null
        }
        Update: {
          atleta_id?: string
          corso_id?: string
          created_at?: string
          data?: string
          id?: string
          presente?: boolean | null
        }
        Relationships: []
      }
      tipi_corso: {
        Row: {
          club_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const
