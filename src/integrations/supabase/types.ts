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
  public: {
    Tables: {
      adesioni_atleta: {
        Row: {
          atleta_id: string
          club_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          id: string
          note: string | null
          stagione_id: string | null
          stato: string
          tipo: string
        }
        Insert: {
          atleta_id: string
          club_id: string
          created_at?: string
          data_fine: string
          data_inizio: string
          id?: string
          note?: string | null
          stagione_id?: string | null
          stato?: string
          tipo?: string
        }
        Update: {
          atleta_id?: string
          club_id?: string
          created_at?: string
          data_fine?: string
          data_inizio?: string
          id?: string
          note?: string | null
          stagione_id?: string | null
          stato?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "adesioni_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adesioni_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adesioni_atleta_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adesioni_atleta_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adesioni_atleta_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adesioni_atleta_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "adesioni_atleta_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      atleta_ppc_elementi: {
        Row: {
          atleta_id: string
          categoria_elemento: string | null
          codice_elemento: string | null
          created_at: string
          creato_da: string | null
          descrizione: string | null
          id: string
          note: string | null
          ordine: number | null
          programma: string | null
          stagione_id: string | null
          updated_at: string
        }
        Insert: {
          atleta_id: string
          categoria_elemento?: string | null
          codice_elemento?: string | null
          created_at?: string
          creato_da?: string | null
          descrizione?: string | null
          id?: string
          note?: string | null
          ordine?: number | null
          programma?: string | null
          stagione_id?: string | null
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          categoria_elemento?: string | null
          codice_elemento?: string | null
          created_at?: string
          creato_da?: string | null
          descrizione?: string | null
          id?: string
          note?: string | null
          ordine?: number | null
          programma?: string | null
          stagione_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atleta_ppc_elementi_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_ppc_elementi_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleta_ppc_elementi_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      atleti: {
        Row: {
          a_rischio: boolean
          a_rischio_da: string | null
          agonista: boolean
          atleta_club: boolean | null
          atleta_esterno: boolean | null
          atleta_federazione: boolean | null
          attivo: boolean | null
          attivo_come_monitore: boolean | null
          cantone: string | null
          cap: string | null
          carriera_artistica: string | null
          carriera_stile: string | null
          categoria: string | null
          citta: string | null
          club_id: string
          codice_atleta: string | null
          codice_fiscale: string | null
          cognome: string
          compenso_orario_pista: number | null
          consenso_foto_video: boolean
          contratto_accettato_at: string | null
          created_at: string
          data_nascita: string | null
          deroga_anagrafica: boolean
          deroga_anagrafica_da: string | null
          deroga_anagrafica_il: string | null
          deroga_anagrafica_motivo: string | null
          disco_in_preparazione: string | null
          disco_url: string | null
          e_aiuto_monitrice: boolean
          e_monitrice: boolean
          foto_url: string | null
          genitore1_cantone: string | null
          genitore1_cap: string | null
          genitore1_citta: string | null
          genitore1_cognome: string | null
          genitore1_email: string | null
          genitore1_indirizzo: string | null
          genitore1_nome: string | null
          genitore1_paese_iso: string | null
          genitore1_provincia: string | null
          genitore1_regione: string | null
          genitore1_telefono: string | null
          genitore2_cantone: string | null
          genitore2_cap: string | null
          genitore2_citta: string | null
          genitore2_cognome: string | null
          genitore2_email: string | null
          genitore2_indirizzo: string | null
          genitore2_nome: string | null
          genitore2_paese_iso: string | null
          genitore2_provincia: string | null
          genitore2_regione: string | null
          genitore2_telefono: string | null
          id: string
          importato_da_excel: boolean
          indirizzo: string | null
          intende_test_livello: boolean
          licenza_sis_categoria: string | null
          licenza_sis_disciplina: string | null
          licenza_sis_numero: string | null
          licenza_sis_validita_a: string | null
          livello_amatori: string | null
          livello_artistica: string | null
          livello_artistica_in_preparazione: string | null
          livello_attuale: string | null
          livello_in_preparazione: string | null
          livello_stile: string | null
          livello_stile_in_preparazione: string | null
          nome: string
          note: string | null
          ore_pista_stagione: number | null
          paese_iso: string
          partecipa_gare: boolean
          provincia: string | null
          ragione_sociale_id: string | null
          ragione_sociale_listino_id: string | null
          regione: string | null
          ruolo_pista: string | null
          sesso: string | null
          tag_nfc: string | null
          telefono: string | null
          verificato: boolean
          verificato_at: string | null
          verificato_da_user_id: string | null
        }
        Insert: {
          a_rischio?: boolean
          a_rischio_da?: string | null
          agonista?: boolean
          atleta_club?: boolean | null
          atleta_esterno?: boolean | null
          atleta_federazione?: boolean | null
          attivo?: boolean | null
          attivo_come_monitore?: boolean | null
          cantone?: string | null
          cap?: string | null
          carriera_artistica?: string | null
          carriera_stile?: string | null
          categoria?: string | null
          citta?: string | null
          club_id: string
          codice_atleta?: string | null
          codice_fiscale?: string | null
          cognome?: string
          compenso_orario_pista?: number | null
          consenso_foto_video?: boolean
          contratto_accettato_at?: string | null
          created_at?: string
          data_nascita?: string | null
          deroga_anagrafica?: boolean
          deroga_anagrafica_da?: string | null
          deroga_anagrafica_il?: string | null
          deroga_anagrafica_motivo?: string | null
          disco_in_preparazione?: string | null
          disco_url?: string | null
          e_aiuto_monitrice?: boolean
          e_monitrice?: boolean
          foto_url?: string | null
          genitore1_cantone?: string | null
          genitore1_cap?: string | null
          genitore1_citta?: string | null
          genitore1_cognome?: string | null
          genitore1_email?: string | null
          genitore1_indirizzo?: string | null
          genitore1_nome?: string | null
          genitore1_paese_iso?: string | null
          genitore1_provincia?: string | null
          genitore1_regione?: string | null
          genitore1_telefono?: string | null
          genitore2_cantone?: string | null
          genitore2_cap?: string | null
          genitore2_citta?: string | null
          genitore2_cognome?: string | null
          genitore2_email?: string | null
          genitore2_indirizzo?: string | null
          genitore2_nome?: string | null
          genitore2_paese_iso?: string | null
          genitore2_provincia?: string | null
          genitore2_regione?: string | null
          genitore2_telefono?: string | null
          id?: string
          importato_da_excel?: boolean
          indirizzo?: string | null
          intende_test_livello?: boolean
          licenza_sis_categoria?: string | null
          licenza_sis_disciplina?: string | null
          licenza_sis_numero?: string | null
          licenza_sis_validita_a?: string | null
          livello_amatori?: string | null
          livello_artistica?: string | null
          livello_artistica_in_preparazione?: string | null
          livello_attuale?: string | null
          livello_in_preparazione?: string | null
          livello_stile?: string | null
          livello_stile_in_preparazione?: string | null
          nome?: string
          note?: string | null
          ore_pista_stagione?: number | null
          paese_iso?: string
          partecipa_gare?: boolean
          provincia?: string | null
          ragione_sociale_id?: string | null
          ragione_sociale_listino_id?: string | null
          regione?: string | null
          ruolo_pista?: string | null
          sesso?: string | null
          tag_nfc?: string | null
          telefono?: string | null
          verificato?: boolean
          verificato_at?: string | null
          verificato_da_user_id?: string | null
        }
        Update: {
          a_rischio?: boolean
          a_rischio_da?: string | null
          agonista?: boolean
          atleta_club?: boolean | null
          atleta_esterno?: boolean | null
          atleta_federazione?: boolean | null
          attivo?: boolean | null
          attivo_come_monitore?: boolean | null
          cantone?: string | null
          cap?: string | null
          carriera_artistica?: string | null
          carriera_stile?: string | null
          categoria?: string | null
          citta?: string | null
          club_id?: string
          codice_atleta?: string | null
          codice_fiscale?: string | null
          cognome?: string
          compenso_orario_pista?: number | null
          consenso_foto_video?: boolean
          contratto_accettato_at?: string | null
          created_at?: string
          data_nascita?: string | null
          deroga_anagrafica?: boolean
          deroga_anagrafica_da?: string | null
          deroga_anagrafica_il?: string | null
          deroga_anagrafica_motivo?: string | null
          disco_in_preparazione?: string | null
          disco_url?: string | null
          e_aiuto_monitrice?: boolean
          e_monitrice?: boolean
          foto_url?: string | null
          genitore1_cantone?: string | null
          genitore1_cap?: string | null
          genitore1_citta?: string | null
          genitore1_cognome?: string | null
          genitore1_email?: string | null
          genitore1_indirizzo?: string | null
          genitore1_nome?: string | null
          genitore1_paese_iso?: string | null
          genitore1_provincia?: string | null
          genitore1_regione?: string | null
          genitore1_telefono?: string | null
          genitore2_cantone?: string | null
          genitore2_cap?: string | null
          genitore2_citta?: string | null
          genitore2_cognome?: string | null
          genitore2_email?: string | null
          genitore2_indirizzo?: string | null
          genitore2_nome?: string | null
          genitore2_paese_iso?: string | null
          genitore2_provincia?: string | null
          genitore2_regione?: string | null
          genitore2_telefono?: string | null
          id?: string
          importato_da_excel?: boolean
          indirizzo?: string | null
          intende_test_livello?: boolean
          licenza_sis_categoria?: string | null
          licenza_sis_disciplina?: string | null
          licenza_sis_numero?: string | null
          licenza_sis_validita_a?: string | null
          livello_amatori?: string | null
          livello_artistica?: string | null
          livello_artistica_in_preparazione?: string | null
          livello_attuale?: string | null
          livello_in_preparazione?: string | null
          livello_stile?: string | null
          livello_stile_in_preparazione?: string | null
          nome?: string
          note?: string | null
          ore_pista_stagione?: number | null
          paese_iso?: string
          partecipa_gare?: boolean
          provincia?: string | null
          ragione_sociale_id?: string | null
          ragione_sociale_listino_id?: string | null
          regione?: string | null
          ruolo_pista?: string | null
          sesso?: string | null
          tag_nfc?: string | null
          telefono?: string | null
          verificato?: boolean
          verificato_at?: string | null
          verificato_da_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "atleti_ragione_sociale_id_fkey"
            columns: ["ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_ragione_sociale_listino_id_fkey"
            columns: ["ragione_sociale_listino_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali_listini"
            referencedColumns: ["id"]
          },
        ]
      }
      atleti_storici_stagioni: {
        Row: {
          atleta_id: string | null
          club_id: string
          created_at: string
          data_abbandono: string | null
          data_iscrizione: string | null
          id: string
          livello: string | null
          motivo_abbandono: string | null
          stagione_id: string
          status: string
        }
        Insert: {
          atleta_id?: string | null
          club_id: string
          created_at?: string
          data_abbandono?: string | null
          data_iscrizione?: string | null
          id?: string
          livello?: string | null
          motivo_abbandono?: string | null
          stagione_id: string
          status?: string
        }
        Update: {
          atleta_id?: string | null
          club_id?: string
          created_at?: string
          data_abbandono?: string | null
          data_iscrizione?: string | null
          id?: string
          livello?: string | null
          motivo_abbandono?: string | null
          stagione_id?: string
          status?: string
        }
        Relationships: []
      }
      bilancio_stagione: {
        Row: {
          cassa_finale: number
          cassa_iniziale: number
          club_id: string
          created_at: string
          id: string
          saldo: number
          stagione_id: string
          totale_entrate: number
          totale_uscite: number
        }
        Insert: {
          cassa_finale?: number
          cassa_iniziale?: number
          club_id: string
          created_at?: string
          id?: string
          saldo?: number
          stagione_id: string
          totale_entrate?: number
          totale_uscite?: number
        }
        Update: {
          cassa_finale?: number
          cassa_iniziale?: number
          club_id?: string
          created_at?: string
          id?: string
          saldo?: number
          stagione_id?: string
          totale_entrate?: number
          totale_uscite?: number
        }
        Relationships: []
      }
      campi_allenamento: {
        Row: {
          club_id: string
          costo: number | null
          created_at: string
          data_fine: string | null
          data_inizio: string | null
          id: string
          luogo: string | null
          nome: string
          note: string | null
        }
        Insert: {
          club_id: string
          costo?: number | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string | null
          id?: string
          luogo?: string | null
          nome?: string
          note?: string | null
        }
        Update: {
          club_id?: string
          costo?: number | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string | null
          id?: string
          luogo?: string | null
          nome?: string
          note?: string | null
        }
        Relationships: []
      }
      campi_club_partecipanti: {
        Row: {
          accettato_at: string | null
          club_esterno_nome: string | null
          club_id: string | null
          created_at: string
          evento_campo_id: string
          id: string
          invitato_at: string
          invitato_da: string | null
          quota_club: number | null
          stato: string
          stato_pagamento: string
          updated_at: string
          valido_al: string
          valido_dal: string
        }
        Insert: {
          accettato_at?: string | null
          club_esterno_nome?: string | null
          club_id?: string | null
          created_at?: string
          evento_campo_id: string
          id?: string
          invitato_at?: string
          invitato_da?: string | null
          quota_club?: number | null
          stato?: string
          stato_pagamento?: string
          updated_at?: string
          valido_al: string
          valido_dal: string
        }
        Update: {
          accettato_at?: string | null
          club_esterno_nome?: string | null
          club_id?: string | null
          created_at?: string
          evento_campo_id?: string
          id?: string
          invitato_at?: string
          invitato_da?: string | null
          quota_club?: number | null
          stato?: string
          stato_pagamento?: string
          updated_at?: string
          valido_al?: string
          valido_dal?: string
        }
        Relationships: [
          {
            foreignKeyName: "campi_club_partecipanti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campi_club_partecipanti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campi_club_partecipanti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campi_club_partecipanti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "campi_club_partecipanti_evento_campo_id_fkey"
            columns: ["evento_campo_id"]
            isOneToOne: false
            referencedRelation: "eventi_campi"
            referencedColumns: ["id"]
          },
        ]
      }
      campi_gruppi: {
        Row: {
          capienza_max: number | null
          created_at: string
          criterio: string | null
          evento_campo_id: string
          id: string
          nome: string
          ordine: number
        }
        Insert: {
          capienza_max?: number | null
          created_at?: string
          criterio?: string | null
          evento_campo_id: string
          id?: string
          nome: string
          ordine?: number
        }
        Update: {
          capienza_max?: number | null
          created_at?: string
          criterio?: string | null
          evento_campo_id?: string
          id?: string
          nome?: string
          ordine?: number
        }
        Relationships: [
          {
            foreignKeyName: "campi_gruppi_evento_campo_id_fkey"
            columns: ["evento_campo_id"]
            isOneToOne: false
            referencedRelation: "eventi_campi"
            referencedColumns: ["id"]
          },
        ]
      }
      capacita_corsi: {
        Row: {
          capacita_max: number
          club_id: string
          corso_id: string
          created_at: string
          id: string
          note: string | null
          ore_settimanali_dedicate: number
        }
        Insert: {
          capacita_max?: number
          club_id: string
          corso_id: string
          created_at?: string
          id?: string
          note?: string | null
          ore_settimanali_dedicate?: number
        }
        Update: {
          capacita_max?: number
          club_id?: string
          corso_id?: string
          created_at?: string
          id?: string
          note?: string | null
          ore_settimanali_dedicate?: number
        }
        Relationships: []
      }
      cassa_movimenti: {
        Row: {
          categoria: string
          club_id: string
          created_at: string
          data: string
          descrizione: string | null
          id: string
          importo: number
          stagione_id: string
          tipo: string
        }
        Insert: {
          categoria: string
          club_id: string
          created_at?: string
          data: string
          descrizione?: string | null
          id?: string
          importo?: number
          stagione_id: string
          tipo: string
        }
        Update: {
          categoria?: string
          club_id?: string
          created_at?: string
          data?: string
          descrizione?: string | null
          id?: string
          importo?: number
          stagione_id?: string
          tipo?: string
        }
        Relationships: []
      }
      catalogo_livelli: {
        Row: {
          atleti_per_area: number
          club_id: string
          costo_annuale: number
          created_at: string
          durata_minuti: number
          id: string
          iscritti_attuali: number
          lezioni_per_settimana: number
          livello: string
          max_atleti_pista: number
          max_per_monitrice: number
          stagione_id: string | null
          tipo_sessione_default: string
          updated_at: string
          usa_corsie: boolean
        }
        Insert: {
          atleti_per_area?: number
          club_id: string
          costo_annuale?: number
          created_at?: string
          durata_minuti?: number
          id?: string
          iscritti_attuali?: number
          lezioni_per_settimana?: number
          livello: string
          max_atleti_pista?: number
          max_per_monitrice?: number
          stagione_id?: string | null
          tipo_sessione_default?: string
          updated_at?: string
          usa_corsie?: boolean
        }
        Update: {
          atleti_per_area?: number
          club_id?: string
          costo_annuale?: number
          created_at?: string
          durata_minuti?: number
          id?: string
          iscritti_attuali?: number
          lezioni_per_settimana?: number
          livello?: string
          max_atleti_pista?: number
          max_per_monitrice?: number
          stagione_id?: string | null
          tipo_sessione_default?: string
          updated_at?: string
          usa_corsie?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_livelli_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_livelli_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_livelli_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_livelli_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "catalogo_livelli_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_pacchetti_opzionali: {
        Row: {
          attivo: boolean
          club_id: string
          costo_1_sessione: number | null
          costo_2_sessioni: number | null
          costo_annuale: number | null
          costo_mensile: number | null
          created_at: string
          durata_minuti: number | null
          id: string
          nome: string
          note: string | null
          richiede_approvazione: boolean
          stagione_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          club_id: string
          costo_1_sessione?: number | null
          costo_2_sessioni?: number | null
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          durata_minuti?: number | null
          id?: string
          nome: string
          note?: string | null
          richiede_approvazione?: boolean
          stagione_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          club_id?: string
          costo_1_sessione?: number | null
          costo_2_sessioni?: number | null
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          durata_minuti?: number | null
          id?: string
          nome?: string
          note?: string | null
          richiede_approvazione?: boolean
          stagione_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_pacchetti_opzionali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_pacchetti_opzionali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_pacchetti_opzionali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_pacchetti_opzionali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "catalogo_pacchetti_opzionali_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      club_identity: {
        Row: {
          anno_fondazione: number | null
          citta: string | null
          club_id: string
          created_at: string
          email_contatto: string | null
          federazione: string | null
          id: string
          mission: string | null
          sito_web: string | null
          social_facebook: string | null
          social_instagram: string | null
        }
        Insert: {
          anno_fondazione?: number | null
          citta?: string | null
          club_id: string
          created_at?: string
          email_contatto?: string | null
          federazione?: string | null
          id?: string
          mission?: string | null
          sito_web?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
        }
        Update: {
          anno_fondazione?: number | null
          citta?: string | null
          club_id?: string
          created_at?: string
          email_contatto?: string | null
          federazione?: string | null
          id?: string
          mission?: string | null
          sito_web?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
        }
        Relationships: []
      }
      clubs: {
        Row: {
          attivo: boolean
          banner_onboarding_chiuso: boolean
          cantone: string | null
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          colore_primario: string | null
          costo_setup_chf: number
          created_at: string
          descrizione: string | null
          disponibilita_giorni_preavviso: number
          disponibilita_notifica_inviata_per: string | null
          disponibilita_periodo_giorni: number | null
          disponibilita_tipo_pianificazione: string
          disponibilita_valida_fino_al: string | null
          email: string | null
          fee_fissa_chf: number
          iban: string | null
          id: string
          indirizzo: string | null
          intestatario_iban: string | null
          logo_url: string | null
          mese_inizio_fatturazione: number
          mesi_fatturazione_atleti: number
          mesi_fatturazione_fee: number
          nome: string
          numero_iva_chf: string | null
          numero_tessera_federale: string | null
          onboarding_completato: boolean
          paese: string
          paese_iso: string
          partita_iva: string | null
          prezzo_per_atleta_chf: number
          provincia: string | null
          regione: string | null
          reminder_allenamenti_attivo: boolean
          reminder_anticipo_giorni: number
          reminder_last_run_date: string | null
          reminder_orario_invio: number
          reminder_planning_anticipo_giorni: number
          reminder_planning_atleti_attivo: boolean
          reminder_planning_istruttori_attivo: boolean
          reminder_planning_last_run_date: string | null
          reminder_planning_orario_invio: number
          reminder_staff_attivo: boolean
          setup_fatturato: boolean
          sigla: string | null
          sito_web: string | null
          telefono: string | null
          twint_qr_url: string | null
        }
        Insert: {
          attivo?: boolean
          banner_onboarding_chiuso?: boolean
          cantone?: string | null
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          colore_primario?: string | null
          costo_setup_chf?: number
          created_at?: string
          descrizione?: string | null
          disponibilita_giorni_preavviso?: number
          disponibilita_notifica_inviata_per?: string | null
          disponibilita_periodo_giorni?: number | null
          disponibilita_tipo_pianificazione?: string
          disponibilita_valida_fino_al?: string | null
          email?: string | null
          fee_fissa_chf?: number
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_iban?: string | null
          logo_url?: string | null
          mese_inizio_fatturazione?: number
          mesi_fatturazione_atleti?: number
          mesi_fatturazione_fee?: number
          nome?: string
          numero_iva_chf?: string | null
          numero_tessera_federale?: string | null
          onboarding_completato?: boolean
          paese?: string
          paese_iso?: string
          partita_iva?: string | null
          prezzo_per_atleta_chf?: number
          provincia?: string | null
          regione?: string | null
          reminder_allenamenti_attivo?: boolean
          reminder_anticipo_giorni?: number
          reminder_last_run_date?: string | null
          reminder_orario_invio?: number
          reminder_planning_anticipo_giorni?: number
          reminder_planning_atleti_attivo?: boolean
          reminder_planning_istruttori_attivo?: boolean
          reminder_planning_last_run_date?: string | null
          reminder_planning_orario_invio?: number
          reminder_staff_attivo?: boolean
          setup_fatturato?: boolean
          sigla?: string | null
          sito_web?: string | null
          telefono?: string | null
          twint_qr_url?: string | null
        }
        Update: {
          attivo?: boolean
          banner_onboarding_chiuso?: boolean
          cantone?: string | null
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          colore_primario?: string | null
          costo_setup_chf?: number
          created_at?: string
          descrizione?: string | null
          disponibilita_giorni_preavviso?: number
          disponibilita_notifica_inviata_per?: string | null
          disponibilita_periodo_giorni?: number | null
          disponibilita_tipo_pianificazione?: string
          disponibilita_valida_fino_al?: string | null
          email?: string | null
          fee_fissa_chf?: number
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_iban?: string | null
          logo_url?: string | null
          mese_inizio_fatturazione?: number
          mesi_fatturazione_atleti?: number
          mesi_fatturazione_fee?: number
          nome?: string
          numero_iva_chf?: string | null
          numero_tessera_federale?: string | null
          onboarding_completato?: boolean
          paese?: string
          paese_iso?: string
          partita_iva?: string | null
          prezzo_per_atleta_chf?: number
          provincia?: string | null
          regione?: string | null
          reminder_allenamenti_attivo?: boolean
          reminder_anticipo_giorni?: number
          reminder_last_run_date?: string | null
          reminder_orario_invio?: number
          reminder_planning_anticipo_giorni?: number
          reminder_planning_atleti_attivo?: boolean
          reminder_planning_istruttori_attivo?: boolean
          reminder_planning_last_run_date?: string | null
          reminder_planning_orario_invio?: number
          reminder_staff_attivo?: boolean
          setup_fatturato?: boolean
          sigla?: string | null
          sito_web?: string | null
          telefono?: string | null
          twint_qr_url?: string | null
        }
        Relationships: []
      }
      comunicazioni: {
        Row: {
          archiviata: boolean
          archiviata_at: string | null
          atleta_id: string | null
          atleti_ids: string[] | null
          categoria: string
          club_id: string
          corpo: string | null
          corsi_ids: string[] | null
          corso_id: string | null
          creata_da: string | null
          created_at: string
          data_evento: string | null
          deep_link: string | null
          evento_straordinario_id: string | null
          gara_id: string | null
          id: string
          inviata_at: string | null
          letta: boolean
          livelli: string[] | null
          planning_corso_id: string | null
          programmata_per: string | null
          richiede_rsvp: boolean
          rsvp_scadenza: string | null
          ruoli_destinatari: string[] | null
          sotto_tipo: string | null
          stato: string
          test_livello_id: string | null
          testo: string
          tipo: string
          tipo_destinatari: string
          titolo: string
          urgente: boolean
        }
        Insert: {
          archiviata?: boolean
          archiviata_at?: string | null
          atleta_id?: string | null
          atleti_ids?: string[] | null
          categoria?: string
          club_id: string
          corpo?: string | null
          corsi_ids?: string[] | null
          corso_id?: string | null
          creata_da?: string | null
          created_at?: string
          data_evento?: string | null
          deep_link?: string | null
          evento_straordinario_id?: string | null
          gara_id?: string | null
          id?: string
          inviata_at?: string | null
          letta?: boolean
          livelli?: string[] | null
          planning_corso_id?: string | null
          programmata_per?: string | null
          richiede_rsvp?: boolean
          rsvp_scadenza?: string | null
          ruoli_destinatari?: string[] | null
          sotto_tipo?: string | null
          stato?: string
          test_livello_id?: string | null
          testo?: string
          tipo?: string
          tipo_destinatari?: string
          titolo?: string
          urgente?: boolean
        }
        Update: {
          archiviata?: boolean
          archiviata_at?: string | null
          atleta_id?: string | null
          atleti_ids?: string[] | null
          categoria?: string
          club_id?: string
          corpo?: string | null
          corsi_ids?: string[] | null
          corso_id?: string | null
          creata_da?: string | null
          created_at?: string
          data_evento?: string | null
          deep_link?: string | null
          evento_straordinario_id?: string | null
          gara_id?: string | null
          id?: string
          inviata_at?: string | null
          letta?: boolean
          livelli?: string[] | null
          planning_corso_id?: string | null
          programmata_per?: string | null
          richiede_rsvp?: boolean
          rsvp_scadenza?: string | null
          ruoli_destinatari?: string[] | null
          sotto_tipo?: string | null
          stato?: string
          test_livello_id?: string | null
          testo?: string
          tipo?: string
          tipo_destinatari?: string
          titolo?: string
          urgente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "comunicazioni_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_test_livello_id_fkey"
            columns: ["test_livello_id"]
            isOneToOne: false
            referencedRelation: "test_livello"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicazioni_destinatari: {
        Row: {
          archiviato_at: string | null
          atleta_id: string
          comunicazione_id: string
          creato_at: string
          id: string
          letto_at: string | null
          nascosto_at: string | null
          rsvp_at: string | null
          rsvp_risposta: string | null
          stato: string
        }
        Insert: {
          archiviato_at?: string | null
          atleta_id: string
          comunicazione_id: string
          creato_at?: string
          id?: string
          letto_at?: string | null
          nascosto_at?: string | null
          rsvp_at?: string | null
          rsvp_risposta?: string | null
          stato?: string
        }
        Update: {
          archiviato_at?: string | null
          atleta_id?: string
          comunicazione_id?: string
          creato_at?: string
          id?: string
          letto_at?: string | null
          nascosto_at?: string | null
          rsvp_at?: string | null
          rsvp_risposta?: string | null
          stato?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_destinatari_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_destinatari_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunicazioni_destinatari_comunicazione_id_fkey"
            columns: ["comunicazione_id"]
            isOneToOne: false
            referencedRelation: "comunicazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicazioni_destinatari_staff: {
        Row: {
          archiviato_at: string | null
          club_id: string
          comunicazione_id: string
          creato_at: string
          id: string
          letto_at: string | null
          rsvp_at: string | null
          rsvp_risposta: string | null
          stato: string
          user_id: string
        }
        Insert: {
          archiviato_at?: string | null
          club_id: string
          comunicazione_id: string
          creato_at?: string
          id?: string
          letto_at?: string | null
          rsvp_at?: string | null
          rsvp_risposta?: string | null
          stato?: string
          user_id: string
        }
        Update: {
          archiviato_at?: string | null
          club_id?: string
          comunicazione_id?: string
          creato_at?: string
          id?: string
          letto_at?: string | null
          rsvp_at?: string | null
          rsvp_risposta?: string | null
          stato?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_destinatari_staff_comunicazione_id_fkey"
            columns: ["comunicazione_id"]
            isOneToOne: false
            referencedRelation: "comunicazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicazioni_push_inviate: {
        Row: {
          comunicazione_id: string
          destinatari: number
          inviata_at: string
        }
        Insert: {
          comunicazione_id: string
          destinatari?: number
          inviata_at?: string
        }
        Update: {
          comunicazione_id?: string
          destinatari?: number
          inviata_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_push_inviate_comunicazione_id_fkey"
            columns: ["comunicazione_id"]
            isOneToOne: true
            referencedRelation: "comunicazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicazioni_template: {
        Row: {
          club_id: string
          created_at: string
          id: string
          nome: string
          testo: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          nome?: string
          testo?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          nome?: string
          testo?: string | null
        }
        Relationships: []
      }
      configurazione_ghiaccio: {
        Row: {
          club_id: string
          created_at: string
          durata_pulizia_minuti: number
          id: string
          max_atleti_contemporanei: number | null
          max_atleti_lezione_privata: number
          max_atleti_per_istruttore: number | null
          min_atleti_attivazione_corso: number
          min_iscritti_attivazione_corso: number | null
          modalita_costo_privata: string
          ora_apertura_default: string
          ora_chiusura_default: string
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          durata_pulizia_minuti?: number
          id?: string
          max_atleti_contemporanei?: number | null
          max_atleti_lezione_privata?: number
          max_atleti_per_istruttore?: number | null
          min_atleti_attivazione_corso?: number
          min_iscritti_attivazione_corso?: number | null
          modalita_costo_privata?: string
          ora_apertura_default?: string
          ora_chiusura_default?: string
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          durata_pulizia_minuti?: number
          id?: string
          max_atleti_contemporanei?: number | null
          max_atleti_lezione_privata?: number
          max_atleti_per_istruttore?: number | null
          min_atleti_attivazione_corso?: number
          min_iscritti_attivazione_corso?: number | null
          modalita_costo_privata?: string
          ora_apertura_default?: string
          ora_chiusura_default?: string
          stagione_id?: string | null
        }
        Relationships: []
      }
      contenuti_traduzioni: {
        Row: {
          aggiornato_da: string | null
          aggiornato_il: string
          campo: string
          de: string | null
          en: string | null
          fr: string | null
          id: string
          it: string | null
          record_id: string
          rm: string | null
          stato: string
          tabella: string
        }
        Insert: {
          aggiornato_da?: string | null
          aggiornato_il?: string
          campo: string
          de?: string | null
          en?: string | null
          fr?: string | null
          id?: string
          it?: string | null
          record_id: string
          rm?: string | null
          stato?: string
          tabella: string
        }
        Update: {
          aggiornato_da?: string | null
          aggiornato_il?: string
          campo?: string
          de?: string | null
          en?: string | null
          fr?: string | null
          id?: string
          it?: string | null
          record_id?: string
          rm?: string | null
          stato?: string
          tabella?: string
        }
        Relationships: []
      }
      convenzioni: {
        Row: {
          area_id: string | null
          azienda: string
          codice_sconto: string | null
          created_at: string
          descrizione: string | null
          fascia_prezzo: string | null
          geo_cantone: string | null
          geo_citta: string | null
          id: string
          immagine_url: string | null
          in_evidenza: boolean
          indirizzo: string | null
          logo_url: string | null
          provincia_id: string | null
          pubblicazione_a: string | null
          pubblicazione_da: string | null
          qr_token: string
          regione_id: string | null
          sito_web: string | null
          stato: string
          stelle: number | null
          telefono: string | null
          tipo_cucina: string | null
          tipo_proposta_id: string | null
          titolo: string
          validita_a: string | null
          validita_da: string | null
          valore_proposta: string | null
        }
        Insert: {
          area_id?: string | null
          azienda: string
          codice_sconto?: string | null
          created_at?: string
          descrizione?: string | null
          fascia_prezzo?: string | null
          geo_cantone?: string | null
          geo_citta?: string | null
          id?: string
          immagine_url?: string | null
          in_evidenza?: boolean
          indirizzo?: string | null
          logo_url?: string | null
          provincia_id?: string | null
          pubblicazione_a?: string | null
          pubblicazione_da?: string | null
          qr_token?: string
          regione_id?: string | null
          sito_web?: string | null
          stato?: string
          stelle?: number | null
          telefono?: string | null
          tipo_cucina?: string | null
          tipo_proposta_id?: string | null
          titolo: string
          validita_a?: string | null
          validita_da?: string | null
          valore_proposta?: string | null
        }
        Update: {
          area_id?: string | null
          azienda?: string
          codice_sconto?: string | null
          created_at?: string
          descrizione?: string | null
          fascia_prezzo?: string | null
          geo_cantone?: string | null
          geo_citta?: string | null
          id?: string
          immagine_url?: string | null
          in_evidenza?: boolean
          indirizzo?: string | null
          logo_url?: string | null
          provincia_id?: string | null
          pubblicazione_a?: string | null
          pubblicazione_da?: string | null
          qr_token?: string
          regione_id?: string | null
          sito_web?: string | null
          stato?: string
          stelle?: number | null
          telefono?: string | null
          tipo_cucina?: string | null
          tipo_proposta_id?: string | null
          titolo?: string
          validita_a?: string | null
          validita_da?: string | null
          valore_proposta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convenzioni_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "convenzioni_aree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenzioni_provincia_id_fkey"
            columns: ["provincia_id"]
            isOneToOne: false
            referencedRelation: "convenzioni_province"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenzioni_regione_id_fkey"
            columns: ["regione_id"]
            isOneToOne: false
            referencedRelation: "convenzioni_regioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenzioni_tipo_proposta_id_fkey"
            columns: ["tipo_proposta_id"]
            isOneToOne: false
            referencedRelation: "convenzioni_tipi_proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      convenzioni_aree: {
        Row: {
          attiva: boolean
          created_at: string
          icona: string | null
          id: string
          nome: string
          ordine: number
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          icona?: string | null
          id?: string
          nome: string
          ordine?: number
        }
        Update: {
          attiva?: boolean
          created_at?: string
          icona?: string | null
          id?: string
          nome?: string
          ordine?: number
        }
        Relationships: []
      }
      convenzioni_nazioni: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordine: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordine?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordine?: number
          updated_at?: string
        }
        Relationships: []
      }
      convenzioni_province: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordine: number
          regione_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordine?: number
          regione_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordine?: number
          regione_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenzioni_province_regione_id_fkey"
            columns: ["regione_id"]
            isOneToOne: false
            referencedRelation: "convenzioni_regioni"
            referencedColumns: ["id"]
          },
        ]
      }
      convenzioni_regioni: {
        Row: {
          created_at: string
          id: string
          nazione_id: string
          nome: string
          ordine: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nazione_id: string
          nome: string
          ordine?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nazione_id?: string
          nome?: string
          ordine?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenzioni_regioni_nazione_id_fkey"
            columns: ["nazione_id"]
            isOneToOne: false
            referencedRelation: "convenzioni_nazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      convenzioni_scansioni: {
        Row: {
          atleta_id: string | null
          club_id: string | null
          convenzione_id: string | null
          id: string
          qr_token: string | null
          scansionato_at: string
          user_agent: string | null
        }
        Insert: {
          atleta_id?: string | null
          club_id?: string | null
          convenzione_id?: string | null
          id?: string
          qr_token?: string | null
          scansionato_at?: string
          user_agent?: string | null
        }
        Update: {
          atleta_id?: string | null
          club_id?: string | null
          convenzione_id?: string | null
          id?: string
          qr_token?: string | null
          scansionato_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convenzioni_scansioni_convenzione_id_fkey"
            columns: ["convenzione_id"]
            isOneToOne: false
            referencedRelation: "convenzioni"
            referencedColumns: ["id"]
          },
        ]
      }
      convenzioni_tipi_proposta: {
        Row: {
          attiva: boolean
          created_at: string
          formato: string | null
          id: string
          nome: string
          ordine: number
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          formato?: string | null
          id?: string
          nome: string
          ordine?: number
        }
        Update: {
          attiva?: boolean
          created_at?: string
          formato?: string | null
          id?: string
          nome?: string
          ordine?: number
        }
        Relationships: []
      }
      corsi: {
        Row: {
          attivo: boolean | null
          capienza_max: number | null
          categoria: string | null
          club_id: string
          costo_annuale: number | null
          costo_mensile: number | null
          created_at: string
          giorno: string | null
          id: string
          livello_id: string | null
          livello_richiesto: string | null
          nome: string
          note: string | null
          ora_fine: string | null
          ora_inizio: string | null
          percorso: string | null
          proposta_id: string | null
          richiede_approvazione: boolean
          stagione_id: string | null
          tipo: string | null
          usa_ghiaccio: boolean
        }
        Insert: {
          attivo?: boolean | null
          capienza_max?: number | null
          categoria?: string | null
          club_id: string
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          giorno?: string | null
          id?: string
          livello_id?: string | null
          livello_richiesto?: string | null
          nome?: string
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          percorso?: string | null
          proposta_id?: string | null
          richiede_approvazione?: boolean
          stagione_id?: string | null
          tipo?: string | null
          usa_ghiaccio?: boolean
        }
        Update: {
          attivo?: boolean | null
          capienza_max?: number | null
          categoria?: string | null
          club_id?: string
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          giorno?: string | null
          id?: string
          livello_id?: string | null
          livello_richiesto?: string | null
          nome?: string
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          percorso?: string | null
          proposta_id?: string | null
          richiede_approvazione?: boolean
          stagione_id?: string | null
          tipo?: string | null
          usa_ghiaccio?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "corsi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corsi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corsi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corsi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "corsi_livello_id_fkey"
            columns: ["livello_id"]
            isOneToOne: false
            referencedRelation: "livelli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corsi_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "proposte"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corsi_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "corsi_istruttori_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corsi_istruttori_istruttore_id_fkey"
            columns: ["istruttore_id"]
            isOneToOne: false
            referencedRelation: "istruttori"
            referencedColumns: ["id"]
          },
        ]
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
      costi_istruttori: {
        Row: {
          club_id: string
          contratto_tipo: string
          costo_fisso_mensile: number | null
          created_at: string
          id: string
          istruttore_id: string
          ore_concordate_settimanali: number | null
          stagione_id: string
          tariffa_oraria: number
        }
        Insert: {
          club_id: string
          contratto_tipo?: string
          costo_fisso_mensile?: number | null
          created_at?: string
          id?: string
          istruttore_id: string
          ore_concordate_settimanali?: number | null
          stagione_id: string
          tariffa_oraria?: number
        }
        Update: {
          club_id?: string
          contratto_tipo?: string
          costo_fisso_mensile?: number | null
          created_at?: string
          id?: string
          istruttore_id?: string
          ore_concordate_settimanali?: number | null
          stagione_id?: string
          tariffa_oraria?: number
        }
        Relationships: []
      }
      dashboard_card_permessi: {
        Row: {
          club_id: string
          codice_card: string
          created_at: string | null
          id: string
          ordine: number | null
          ruolo: string
          updated_at: string | null
          visibile: boolean | null
        }
        Insert: {
          club_id: string
          codice_card: string
          created_at?: string | null
          id?: string
          ordine?: number | null
          ruolo: string
          updated_at?: string | null
          visibile?: boolean | null
        }
        Update: {
          club_id?: string
          codice_card?: string
          created_at?: string | null
          id?: string
          ordine?: number | null
          ruolo?: string
          updated_at?: string | null
          visibile?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_card_permessi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_card_permessi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_card_permessi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_card_permessi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          atleta_id: string | null
          attivo: boolean
          creato_at: string
          id: string
          lingua: string | null
          piattaforma: string
          token: string
          ultimo_uso_at: string | null
          user_id: string | null
        }
        Insert: {
          atleta_id?: string | null
          attivo?: boolean
          creato_at?: string
          id?: string
          lingua?: string | null
          piattaforma?: string
          token: string
          ultimo_uso_at?: string | null
          user_id?: string | null
        }
        Update: {
          atleta_id?: string | null
          attivo?: boolean
          creato_at?: string
          id?: string
          lingua?: string | null
          piattaforma?: string
          token?: string
          ultimo_uso_at?: string | null
          user_id?: string | null
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
          risorsa_id: string | null
          stagione_id: string | null
          tipo: string
        }
        Insert: {
          club_id: string
          created_at?: string
          giorno?: string
          id?: string
          note?: string | null
          ora_fine: string
          ora_inizio: string
          risorsa_id?: string | null
          stagione_id?: string | null
          tipo?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          giorno?: string
          id?: string
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          risorsa_id?: string | null
          stagione_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "disponibilita_ghiaccio_risorsa_id_fkey"
            columns: ["risorsa_id"]
            isOneToOne: false
            referencedRelation: "risorse_strutture"
            referencedColumns: ["id"]
          },
        ]
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
      elementi_gara: {
        Row: {
          base_value: number | null
          created_at: string
          goe: number | null
          id: string
          info_flag: string | null
          nome: string
          risultato_id: string
          score: number | null
          seq: number
        }
        Insert: {
          base_value?: number | null
          created_at?: string
          goe?: number | null
          id?: string
          info_flag?: string | null
          nome?: string
          risultato_id: string
          score?: number | null
          seq?: number
        }
        Update: {
          base_value?: number | null
          created_at?: string
          goe?: number | null
          id?: string
          info_flag?: string | null
          nome?: string
          risultato_id?: string
          score?: number | null
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "elementi_gara_risultato_id_fkey"
            columns: ["risultato_id"]
            isOneToOne: false
            referencedRelation: "risultati_gara"
            referencedColumns: ["id"]
          },
        ]
      }
      eventi_calendario: {
        Row: {
          atleta_id: string
          club_id: string
          created_at: string
          data: string
          id: string
          luogo: string | null
          nome_evento: string | null
          note: string | null
          ora_fine: string | null
          ora_inizio: string
          riferimento_id: string | null
          stato: string
          tipo: string
          updated_at: string
        }
        Insert: {
          atleta_id: string
          club_id: string
          created_at?: string
          data: string
          id?: string
          luogo?: string | null
          nome_evento?: string | null
          note?: string | null
          ora_fine?: string | null
          ora_inizio: string
          riferimento_id?: string | null
          stato?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          club_id?: string
          created_at?: string
          data?: string
          id?: string
          luogo?: string | null
          nome_evento?: string | null
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string
          riferimento_id?: string | null
          stato?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventi_campi: {
        Row: {
          club_id: string
          contatti: string | null
          costo: number | null
          created_at: string
          data_fine: string | null
          data_inizio: string | null
          descrizione: string | null
          id: string
          luogo: string | null
          modalita: string
          nome: string
          note: string | null
          quota_atleta: number | null
          quota_club_default: number | null
          scadenza_adesioni: string | null
          stagione_id: string | null
          stato: string
        }
        Insert: {
          club_id: string
          contatti?: string | null
          costo?: number | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string | null
          descrizione?: string | null
          id?: string
          luogo?: string | null
          modalita?: string
          nome?: string
          note?: string | null
          quota_atleta?: number | null
          quota_club_default?: number | null
          scadenza_adesioni?: string | null
          stagione_id?: string | null
          stato?: string
        }
        Update: {
          club_id?: string
          contatti?: string | null
          costo?: number | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string | null
          descrizione?: string | null
          id?: string
          luogo?: string | null
          modalita?: string
          nome?: string
          note?: string | null
          quota_atleta?: number | null
          quota_club_default?: number | null
          scadenza_adesioni?: string | null
          stagione_id?: string | null
          stato?: string
        }
        Relationships: []
      }
      eventi_esterni: {
        Row: {
          club_id: string
          costo_indicativo: number | null
          created_at: string
          data_fine: string | null
          data_inizio: string | null
          descrizione: string | null
          disciplina: string | null
          id: string
          nome: string
          note: string | null
          stagione_id: string | null
          struttura_citta: string | null
          struttura_contatti: string | null
          struttura_nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          club_id: string
          costo_indicativo?: number | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string | null
          descrizione?: string | null
          disciplina?: string | null
          id?: string
          nome?: string
          note?: string | null
          stagione_id?: string | null
          struttura_citta?: string | null
          struttura_contatti?: string | null
          struttura_nome?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          costo_indicativo?: number | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string | null
          descrizione?: string | null
          disciplina?: string | null
          id?: string
          nome?: string
          note?: string | null
          stagione_id?: string | null
          struttura_citta?: string | null
          struttura_contatti?: string | null
          struttura_nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventi_pubblici: {
        Row: {
          club_id: string
          created_at: string
          data_evento: string | null
          descrizione: string | null
          id: string
          nome_evento: string
          partecipanti_stimati: number
          stagione_id: string | null
          tipo: string
        }
        Insert: {
          club_id: string
          created_at?: string
          data_evento?: string | null
          descrizione?: string | null
          id?: string
          nome_evento?: string
          partecipanti_stimati?: number
          stagione_id?: string | null
          tipo?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          data_evento?: string | null
          descrizione?: string | null
          id?: string
          nome_evento?: string
          partecipanti_stimati?: number
          stagione_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      eventi_straordinari: {
        Row: {
          club_id: string
          creato_at: string
          creato_da: string | null
          data: string
          descrizione: string | null
          id: string
          luogo: string | null
          ora_fine: string | null
          ora_inizio: string | null
          stagione_id: string | null
          tipo: string
          titolo: string
        }
        Insert: {
          club_id: string
          creato_at?: string
          creato_da?: string | null
          data: string
          descrizione?: string | null
          id?: string
          luogo?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stagione_id?: string | null
          tipo?: string
          titolo?: string
        }
        Update: {
          club_id?: string
          creato_at?: string
          creato_da?: string | null
          data?: string
          descrizione?: string | null
          id?: string
          luogo?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stagione_id?: string | null
          tipo?: string
          titolo?: string
        }
        Relationships: []
      }
      fatture: {
        Row: {
          annullata_da: string | null
          annullata_il: string | null
          atleta_id: string | null
          club_id: string
          created_at: string
          data_emissione: string | null
          data_pagamento: string | null
          data_scadenza: string | null
          descrizione: string | null
          documento_origine_id: string | null
          email_inviata_at: string | null
          id: string
          importo: number | null
          intestatario_cantone: string | null
          intestatario_cap: string | null
          intestatario_citta: string | null
          intestatario_cognome: string | null
          intestatario_email: string | null
          intestatario_indirizzo: string | null
          intestatario_nome: string | null
          intestatario_paese_iso: string | null
          intestatario_provincia: string | null
          intestatario_regione: string | null
          motivo_annullamento: string | null
          note: string | null
          numero: string | null
          pagata: boolean | null
          pdf_url: string | null
          periodo: string | null
          ragione_sociale_id: string | null
          riferimento_id: string | null
          riferimento_numero: number
          righe: Json | null
          sconto_causale: string | null
          sconto_importo_chf: number
          sconto_note: string | null
          sconto_percentuale: number
          solleciti_inviati: number
          stato: string
          tipo: string | null
          tipo_documento: string
          ultimo_sollecito_il: string | null
        }
        Insert: {
          annullata_da?: string | null
          annullata_il?: string | null
          atleta_id?: string | null
          club_id: string
          created_at?: string
          data_emissione?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          documento_origine_id?: string | null
          email_inviata_at?: string | null
          id?: string
          importo?: number | null
          intestatario_cantone?: string | null
          intestatario_cap?: string | null
          intestatario_citta?: string | null
          intestatario_cognome?: string | null
          intestatario_email?: string | null
          intestatario_indirizzo?: string | null
          intestatario_nome?: string | null
          intestatario_paese_iso?: string | null
          intestatario_provincia?: string | null
          intestatario_regione?: string | null
          motivo_annullamento?: string | null
          note?: string | null
          numero?: string | null
          pagata?: boolean | null
          pdf_url?: string | null
          periodo?: string | null
          ragione_sociale_id?: string | null
          riferimento_id?: string | null
          riferimento_numero?: number
          righe?: Json | null
          sconto_causale?: string | null
          sconto_importo_chf?: number
          sconto_note?: string | null
          sconto_percentuale?: number
          solleciti_inviati?: number
          stato?: string
          tipo?: string | null
          tipo_documento?: string
          ultimo_sollecito_il?: string | null
        }
        Update: {
          annullata_da?: string | null
          annullata_il?: string | null
          atleta_id?: string | null
          club_id?: string
          created_at?: string
          data_emissione?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          documento_origine_id?: string | null
          email_inviata_at?: string | null
          id?: string
          importo?: number | null
          intestatario_cantone?: string | null
          intestatario_cap?: string | null
          intestatario_citta?: string | null
          intestatario_cognome?: string | null
          intestatario_email?: string | null
          intestatario_indirizzo?: string | null
          intestatario_nome?: string | null
          intestatario_paese_iso?: string | null
          intestatario_provincia?: string | null
          intestatario_regione?: string | null
          motivo_annullamento?: string | null
          note?: string | null
          numero?: string | null
          pagata?: boolean | null
          pdf_url?: string | null
          periodo?: string | null
          ragione_sociale_id?: string | null
          riferimento_id?: string | null
          riferimento_numero?: number
          righe?: Json | null
          sconto_causale?: string | null
          sconto_importo_chf?: number
          sconto_note?: string | null
          sconto_percentuale?: number
          solleciti_inviati?: number
          stato?: string
          tipo?: string | null
          tipo_documento?: string
          ultimo_sollecito_il?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fatture_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "fatture_documento_origine_id_fkey"
            columns: ["documento_origine_id"]
            isOneToOne: false
            referencedRelation: "fatture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_ragione_sociale_id_fkey"
            columns: ["ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
        ]
      }
      fatture_clubs: {
        Row: {
          club_id: string
          created_at: string
          data_emissione: string
          data_invio: string | null
          data_pagamento: string | null
          data_scadenza: string
          fee_fissa_chf: number
          id: string
          importo_atleti_chf: number
          importo_chf: number
          importo_setup_chf: number
          intestatario_cantone: string | null
          intestatario_cap: string | null
          intestatario_citta: string | null
          intestatario_iban: string | null
          intestatario_indirizzo: string | null
          intestatario_nome: string | null
          intestatario_numero_iva_chf: string | null
          intestatario_paese_iso: string | null
          intestatario_partita_iva: string | null
          intestatario_provincia: string | null
          intestatario_regione: string | null
          n_atleti: number
          note: string | null
          pagata: boolean
          pdf_url: string | null
          periodo: string
          prezzo_per_atleta_chf: number
          righe_custom: Json | null
          stato: string
        }
        Insert: {
          club_id: string
          created_at?: string
          data_emissione?: string
          data_invio?: string | null
          data_pagamento?: string | null
          data_scadenza: string
          fee_fissa_chf?: number
          id?: string
          importo_atleti_chf?: number
          importo_chf: number
          importo_setup_chf?: number
          intestatario_cantone?: string | null
          intestatario_cap?: string | null
          intestatario_citta?: string | null
          intestatario_iban?: string | null
          intestatario_indirizzo?: string | null
          intestatario_nome?: string | null
          intestatario_numero_iva_chf?: string | null
          intestatario_paese_iso?: string | null
          intestatario_partita_iva?: string | null
          intestatario_provincia?: string | null
          intestatario_regione?: string | null
          n_atleti: number
          note?: string | null
          pagata?: boolean
          pdf_url?: string | null
          periodo: string
          prezzo_per_atleta_chf: number
          righe_custom?: Json | null
          stato?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          data_emissione?: string
          data_invio?: string | null
          data_pagamento?: string | null
          data_scadenza?: string
          fee_fissa_chf?: number
          id?: string
          importo_atleti_chf?: number
          importo_chf?: number
          importo_setup_chf?: number
          intestatario_cantone?: string | null
          intestatario_cap?: string | null
          intestatario_citta?: string | null
          intestatario_iban?: string | null
          intestatario_indirizzo?: string | null
          intestatario_nome?: string | null
          intestatario_numero_iva_chf?: string | null
          intestatario_paese_iso?: string | null
          intestatario_partita_iva?: string | null
          intestatario_provincia?: string | null
          intestatario_regione?: string | null
          n_atleti?: number
          note?: string | null
          pagata?: boolean
          pdf_url?: string | null
          periodo?: string
          prezzo_per_atleta_chf?: number
          righe_custom?: Json | null
          stato?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatture_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatture_clubs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      gare_calendario: {
        Row: {
          archiviata: boolean | null
          carriera: string | null
          club_id: string
          club_ospitante: string | null
          costo_accompagnamento: number | null
          costo_iscrizione: number | null
          created_at: string
          data: string | null
          id: string
          indirizzo: string | null
          livello_minimo: string | null
          luogo: string | null
          nome: string
          note: string | null
          ora: string | null
          stagione_id: string | null
        }
        Insert: {
          archiviata?: boolean | null
          carriera?: string | null
          club_id: string
          club_ospitante?: string | null
          costo_accompagnamento?: number | null
          costo_iscrizione?: number | null
          created_at?: string
          data?: string | null
          id?: string
          indirizzo?: string | null
          livello_minimo?: string | null
          luogo?: string | null
          nome?: string
          note?: string | null
          ora?: string | null
          stagione_id?: string | null
        }
        Update: {
          archiviata?: boolean | null
          carriera?: string | null
          club_id?: string
          club_ospitante?: string | null
          costo_accompagnamento?: number | null
          costo_iscrizione?: number | null
          created_at?: string
          data?: string | null
          id?: string
          indirizzo?: string | null
          livello_minimo?: string | null
          luogo?: string | null
          nome?: string
          note?: string | null
          ora?: string | null
          stagione_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "gare_calendario_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_blocchi: {
        Row: {
          club_id: string
          created_at: string
          creato_da: string | null
          data: string
          evento_campo_id: string | null
          forzato_at: string | null
          forzato_da: string | null
          fuori_disponibilita: boolean
          id: string
          motivo_forzatura: string | null
          ora_fine: string
          ora_inizio: string
          pubblicato_at: string | null
          risorsa_id: string | null
          stato: string
          titolo: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          creato_da?: string | null
          data: string
          evento_campo_id?: string | null
          forzato_at?: string | null
          forzato_da?: string | null
          fuori_disponibilita?: boolean
          id?: string
          motivo_forzatura?: string | null
          ora_fine: string
          ora_inizio: string
          pubblicato_at?: string | null
          risorsa_id?: string | null
          stato?: string
          titolo?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          creato_da?: string | null
          data?: string
          evento_campo_id?: string | null
          forzato_at?: string | null
          forzato_da?: string | null
          fuori_disponibilita?: boolean
          id?: string
          motivo_forzatura?: string | null
          ora_fine?: string
          ora_inizio?: string
          pubblicato_at?: string | null
          risorsa_id?: string | null
          stato?: string
          titolo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "griglia_blocchi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_blocchi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_blocchi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_blocchi_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "griglia_blocchi_evento_campo_id_fkey"
            columns: ["evento_campo_id"]
            isOneToOne: false
            referencedRelation: "eventi_campi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_blocchi_risorsa_id_fkey"
            columns: ["risorsa_id"]
            isOneToOne: false
            referencedRelation: "risorse_strutture"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_sessioni: {
        Row: {
          blocco_id: string
          corso_id: string | null
          created_at: string
          forzato_at: string | null
          forzato_da: string | null
          fuori_disponibilita: boolean
          id: string
          messaggio_atleti: string | null
          motivo_forzatura: string | null
          note: string | null
          ora_fine: string
          ora_inizio: string
          ordine: number
          specialita_id: string | null
          specialita_testo_libero: string | null
          updated_at: string
        }
        Insert: {
          blocco_id: string
          corso_id?: string | null
          created_at?: string
          forzato_at?: string | null
          forzato_da?: string | null
          fuori_disponibilita?: boolean
          id?: string
          messaggio_atleti?: string | null
          motivo_forzatura?: string | null
          note?: string | null
          ora_fine: string
          ora_inizio: string
          ordine?: number
          specialita_id?: string | null
          specialita_testo_libero?: string | null
          updated_at?: string
        }
        Update: {
          blocco_id?: string
          corso_id?: string | null
          created_at?: string
          forzato_at?: string | null
          forzato_da?: string | null
          fuori_disponibilita?: boolean
          id?: string
          messaggio_atleti?: string | null
          motivo_forzatura?: string | null
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          ordine?: number
          specialita_id?: string | null
          specialita_testo_libero?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "griglia_sessioni_blocco_id_fkey"
            columns: ["blocco_id"]
            isOneToOne: false
            referencedRelation: "griglia_blocchi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_specialita_id_fkey"
            columns: ["specialita_id"]
            isOneToOne: false
            referencedRelation: "griglia_specialita"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_sessioni_atleti: {
        Row: {
          atleta_id: string
          campo_gruppo_id: string | null
          club_id: string | null
          conflitto_forzato: boolean
          created_at: string
          etichetta: string | null
          forzato_at: string | null
          forzato_da: string | null
          gruppo_sessione_id: string | null
          id: string
          motivo_forzatura: string | null
          origine_corso_id: string | null
          provenienza: string
          sessione_id: string
        }
        Insert: {
          atleta_id: string
          campo_gruppo_id?: string | null
          club_id?: string | null
          conflitto_forzato?: boolean
          created_at?: string
          etichetta?: string | null
          forzato_at?: string | null
          forzato_da?: string | null
          gruppo_sessione_id?: string | null
          id?: string
          motivo_forzatura?: string | null
          origine_corso_id?: string | null
          provenienza?: string
          sessione_id: string
        }
        Update: {
          atleta_id?: string
          campo_gruppo_id?: string | null
          club_id?: string | null
          conflitto_forzato?: boolean
          created_at?: string
          etichetta?: string | null
          forzato_at?: string | null
          forzato_da?: string | null
          gruppo_sessione_id?: string | null
          id?: string
          motivo_forzatura?: string | null
          origine_corso_id?: string | null
          provenienza?: string
          sessione_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "griglia_sessioni_atleti_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_campo_gruppo_id_fkey"
            columns: ["campo_gruppo_id"]
            isOneToOne: false
            referencedRelation: "campi_gruppi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_gruppo_sessione_id_fkey"
            columns: ["gruppo_sessione_id"]
            isOneToOne: false
            referencedRelation: "griglia_sessioni_gruppi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_origine_corso_id_fkey"
            columns: ["origine_corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_sessione_id_fkey"
            columns: ["sessione_id"]
            isOneToOne: false
            referencedRelation: "griglia_sessioni"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_sessioni_gruppi: {
        Row: {
          created_at: string
          gruppo_livello: string
          gruppo_ragione_sociale_id: string | null
          gruppo_scope: string
          id: string
          sessione_id: string
        }
        Insert: {
          created_at?: string
          gruppo_livello: string
          gruppo_ragione_sociale_id?: string | null
          gruppo_scope: string
          id?: string
          sessione_id: string
        }
        Update: {
          created_at?: string
          gruppo_livello?: string
          gruppo_ragione_sociale_id?: string | null
          gruppo_scope?: string
          id?: string
          sessione_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "griglia_sessioni_gruppi_gruppo_ragione_sociale_id_fkey"
            columns: ["gruppo_ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_gruppi_sessione_id_fkey"
            columns: ["sessione_id"]
            isOneToOne: false
            referencedRelation: "griglia_sessioni"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_sessioni_istruttori: {
        Row: {
          created_at: string
          id: string
          istruttore_id: string
          sessione_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          istruttore_id: string
          sessione_id: string
        }
        Update: {
          created_at?: string
          id?: string
          istruttore_id?: string
          sessione_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "griglia_sessioni_istruttori_istruttore_id_fkey"
            columns: ["istruttore_id"]
            isOneToOne: false
            referencedRelation: "istruttori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_istruttori_sessione_id_fkey"
            columns: ["sessione_id"]
            isOneToOne: false
            referencedRelation: "griglia_sessioni"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_specialita: {
        Row: {
          attivo: boolean
          club_id: string
          created_at: string
          descrizione_messaggio: string | null
          id: string
          nome: string
          ordine: number
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          club_id: string
          created_at?: string
          descrizione_messaggio?: string | null
          id?: string
          nome: string
          ordine?: number
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          club_id?: string
          created_at?: string
          descrizione_messaggio?: string | null
          id?: string
          nome?: string
          ordine?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "griglia_specialita_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_specialita_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_specialita_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_specialita_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      impostazioni_app_mobile: {
        Row: {
          android_store_url: string | null
          id: string
          ios_store_url: string | null
          updated_at: string
        }
        Insert: {
          android_store_url?: string | null
          id?: string
          ios_store_url?: string | null
          updated_at?: string
        }
        Update: {
          android_store_url?: string | null
          id?: string
          ios_store_url?: string | null
          updated_at?: string
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
      iscrizioni_campo: {
        Row: {
          atleta_id: string
          campo_id: string
          created_at: string
          giorni_selezionati: Json | null
          id: string
          tipo: string | null
        }
        Insert: {
          atleta_id: string
          campo_id: string
          created_at?: string
          giorni_selezionati?: Json | null
          id?: string
          tipo?: string | null
        }
        Update: {
          atleta_id?: string
          campo_id?: string
          created_at?: string
          giorni_selezionati?: Json | null
          id?: string
          tipo?: string | null
        }
        Relationships: []
      }
      iscrizioni_corsi: {
        Row: {
          atleta_id: string
          attiva: boolean | null
          corso_id: string
          created_at: string
          data_fine: string | null
          data_iscrizione: string | null
          id: string
          note_salto_livello: string | null
          ragione_sociale_id: string | null
          ragione_sociale_listino_id: string | null
          salto_livello: boolean | null
        }
        Insert: {
          atleta_id: string
          attiva?: boolean | null
          corso_id: string
          created_at?: string
          data_fine?: string | null
          data_iscrizione?: string | null
          id?: string
          note_salto_livello?: string | null
          ragione_sociale_id?: string | null
          ragione_sociale_listino_id?: string | null
          salto_livello?: boolean | null
        }
        Update: {
          atleta_id?: string
          attiva?: boolean | null
          corso_id?: string
          created_at?: string
          data_fine?: string | null
          data_iscrizione?: string | null
          id?: string
          note_salto_livello?: string | null
          ragione_sociale_id?: string | null
          ragione_sociale_listino_id?: string | null
          salto_livello?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_corsi_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_corsi_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_corsi_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_corsi_ragione_sociale_id_fkey"
            columns: ["ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_corsi_ragione_sociale_listino_id_fkey"
            columns: ["ragione_sociale_listino_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali_listini"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_eventi: {
        Row: {
          atleta_id: string
          creato_at: string
          evento_id: string
          id: string
          note: string | null
          stato: string
        }
        Insert: {
          atleta_id: string
          creato_at?: string
          evento_id: string
          id?: string
          note?: string | null
          stato?: string
        }
        Update: {
          atleta_id?: string
          creato_at?: string
          evento_id?: string
          id?: string
          note?: string | null
          stato?: string
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_eventi_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventi_straordinari"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_eventi_campi: {
        Row: {
          atleta_id: string
          created_at: string
          evento_campo_id: string
          id: string
          note: string | null
          stato: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          evento_campo_id: string
          id?: string
          note?: string | null
          stato?: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          evento_campo_id?: string
          id?: string
          note?: string | null
          stato?: string
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_eventi_campi_evento_campo_id_fkey"
            columns: ["evento_campo_id"]
            isOneToOne: false
            referencedRelation: "eventi_campi"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_eventi_esterni: {
        Row: {
          atleta_id: string
          created_at: string
          evento_esterno_id: string
          id: string
          note: string | null
          quota_atleta: number | null
          quota_club: number | null
          stato_pagamento: string
          updated_at: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          evento_esterno_id: string
          id?: string
          note?: string | null
          quota_atleta?: number | null
          quota_club?: number | null
          stato_pagamento?: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          evento_esterno_id?: string
          id?: string
          note?: string | null
          quota_atleta?: number | null
          quota_club?: number | null
          stato_pagamento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_eventi_esterni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_eventi_esterni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_eventi_esterni_evento_esterno_id_fkey"
            columns: ["evento_esterno_id"]
            isOneToOne: false
            referencedRelation: "eventi_esterni"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_gare: {
        Row: {
          atleta_id: string
          carriera: string | null
          costo_accompagnamento: number | null
          costo_iscrizione: number | null
          created_at: string
          disciplina: string | null
          gara_id: string
          id: string
          livello_atleta: string | null
          medaglia: string | null
          note: string | null
          posizione: number | null
          punteggio: number | null
          punteggio_artistico: number | null
          punteggio_tecnico: number | null
          voto_giudici: number | null
        }
        Insert: {
          atleta_id: string
          carriera?: string | null
          costo_accompagnamento?: number | null
          costo_iscrizione?: number | null
          created_at?: string
          disciplina?: string | null
          gara_id: string
          id?: string
          livello_atleta?: string | null
          medaglia?: string | null
          note?: string | null
          posizione?: number | null
          punteggio?: number | null
          punteggio_artistico?: number | null
          punteggio_tecnico?: number | null
          voto_giudici?: number | null
        }
        Update: {
          atleta_id?: string
          carriera?: string | null
          costo_accompagnamento?: number | null
          costo_iscrizione?: number | null
          created_at?: string
          disciplina?: string | null
          gara_id?: string
          id?: string
          livello_atleta?: string | null
          medaglia?: string | null
          note?: string | null
          posizione?: number | null
          punteggio?: number | null
          punteggio_artistico?: number | null
          punteggio_tecnico?: number | null
          voto_giudici?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_gare_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_gare_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_gare_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_gare_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_pacchetti: {
        Row: {
          atleta_id: string
          attiva: boolean
          created_at: string
          data_fine: string | null
          data_iscrizione: string | null
          id: string
          note: string | null
          numero_sessioni: number | null
          pacchetto_id: string
        }
        Insert: {
          atleta_id: string
          attiva?: boolean
          created_at?: string
          data_fine?: string | null
          data_iscrizione?: string | null
          id?: string
          note?: string | null
          numero_sessioni?: number | null
          pacchetto_id: string
        }
        Update: {
          atleta_id?: string
          attiva?: boolean
          created_at?: string
          data_fine?: string | null
          data_iscrizione?: string | null
          id?: string
          note?: string | null
          numero_sessioni?: number | null
          pacchetto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "iscrizioni_pacchetti_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_pacchetti_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_pacchetti_pacchetto_id_fkey"
            columns: ["pacchetto_id"]
            isOneToOne: false
            referencedRelation: "catalogo_pacchetti_opzionali"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_pacchetti_storiche: {
        Row: {
          atleta_id: string | null
          club_id: string
          created_at: string
          data_iscrizione: string | null
          id: string
          pacchetto_id: string
          prezzo_pagato: number
          stagione_id: string | null
        }
        Insert: {
          atleta_id?: string | null
          club_id: string
          created_at?: string
          data_iscrizione?: string | null
          id?: string
          pacchetto_id: string
          prezzo_pagato?: number
          stagione_id?: string | null
        }
        Update: {
          atleta_id?: string | null
          club_id?: string
          created_at?: string
          data_iscrizione?: string | null
          id?: string
          pacchetto_id?: string
          prezzo_pagato?: number
          stagione_id?: string | null
        }
        Relationships: []
      }
      istruttori: {
        Row: {
          attivo: boolean | null
          club_id: string
          codice_istruttore: string | null
          cognome: string
          colore: string | null
          compenso_fisso_corsi: number | null
          compenso_fisso_mensile: number | null
          costo_minuto_lezione_privata: number | null
          costo_orario_corsi: number | null
          costo_orario_lezioni: number | null
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          linked_atleta_id: string | null
          livello_istruttore: Database["public"]["Enums"]["livello_istruttore_enum"]
          nome: string
          note: string | null
          specialita: string | null
          stato_staff: Database["public"]["Enums"]["stato_staff_enum"]
          tag_nfc: string | null
          telefono: string | null
          tipo_contratto: string
          user_id: string | null
        }
        Insert: {
          attivo?: boolean | null
          club_id: string
          codice_istruttore?: string | null
          cognome?: string
          colore?: string | null
          compenso_fisso_corsi?: number | null
          compenso_fisso_mensile?: number | null
          costo_minuto_lezione_privata?: number | null
          costo_orario_corsi?: number | null
          costo_orario_lezioni?: number | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          linked_atleta_id?: string | null
          livello_istruttore?: Database["public"]["Enums"]["livello_istruttore_enum"]
          nome?: string
          note?: string | null
          specialita?: string | null
          stato_staff?: Database["public"]["Enums"]["stato_staff_enum"]
          tag_nfc?: string | null
          telefono?: string | null
          tipo_contratto?: string
          user_id?: string | null
        }
        Update: {
          attivo?: boolean | null
          club_id?: string
          codice_istruttore?: string | null
          cognome?: string
          colore?: string | null
          compenso_fisso_corsi?: number | null
          compenso_fisso_mensile?: number | null
          costo_minuto_lezione_privata?: number | null
          costo_orario_corsi?: number | null
          costo_orario_lezioni?: number | null
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          linked_atleta_id?: string | null
          livello_istruttore?: Database["public"]["Enums"]["livello_istruttore_enum"]
          nome?: string
          note?: string | null
          specialita?: string | null
          stato_staff?: Database["public"]["Enums"]["stato_staff_enum"]
          tag_nfc?: string | null
          telefono?: string | null
          tipo_contratto?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "istruttori_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "istruttori_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "istruttori_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "istruttori_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "istruttori_linked_atleta_id_fkey"
            columns: ["linked_atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "istruttori_linked_atleta_id_fkey"
            columns: ["linked_atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
        ]
      }
      istruttori_ragioni_sociali_tariffe: {
        Row: {
          created_at: string
          id: string
          istruttore_id: string
          note: string | null
          ragione_sociale_id: string
          tariffa_oraria_chf: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          istruttore_id: string
          note?: string | null
          ragione_sociale_id: string
          tariffa_oraria_chf?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          istruttore_id?: string
          note?: string | null
          ragione_sociale_id?: string
          tariffa_oraria_chf?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "istruttori_ragioni_sociali_tariffe_istruttore_id_fkey"
            columns: ["istruttore_id"]
            isOneToOne: false
            referencedRelation: "istruttori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "istruttori_ragioni_sociali_tariffe_ragione_sociale_id_fkey"
            columns: ["ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
        ]
      }
      letture_comunicazioni: {
        Row: {
          archiviata_at: string | null
          atleta_id: string
          comunicazione_id: string
          created_at: string
          id: string
          letta_at: string | null
        }
        Insert: {
          archiviata_at?: string | null
          atleta_id: string
          comunicazione_id: string
          created_at?: string
          id?: string
          letta_at?: string | null
        }
        Update: {
          archiviata_at?: string | null
          atleta_id?: string
          comunicazione_id?: string
          created_at?: string
          id?: string
          letta_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "letture_comunicazioni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letture_comunicazioni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "letture_comunicazioni_comunicazione_id_fkey"
            columns: ["comunicazione_id"]
            isOneToOne: false
            referencedRelation: "comunicazioni"
            referencedColumns: ["id"]
          },
        ]
      }
      lezioni_private: {
        Row: {
          annullata: boolean
          club_id: string
          condivisa: boolean
          costo_totale: number
          created_at: string
          data: string | null
          data_revoca: string | null
          durata_minuti: number
          id: string
          istruttore_id: string | null
          note: string | null
          ora_fine: string | null
          ora_inizio: string | null
          richiede_approvazione: boolean
          ricorrente: boolean
        }
        Insert: {
          annullata?: boolean
          club_id: string
          condivisa?: boolean
          costo_totale?: number
          created_at?: string
          data?: string | null
          data_revoca?: string | null
          durata_minuti?: number
          id?: string
          istruttore_id?: string | null
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          richiede_approvazione?: boolean
          ricorrente?: boolean
        }
        Update: {
          annullata?: boolean
          club_id?: string
          condivisa?: boolean
          costo_totale?: number
          created_at?: string
          data?: string | null
          data_revoca?: string | null
          durata_minuti?: number
          id?: string
          istruttore_id?: string | null
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          richiede_approvazione?: boolean
          ricorrente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lezioni_private_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lezioni_private_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lezioni_private_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lezioni_private_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "lezioni_private_istruttore_id_fkey"
            columns: ["istruttore_id"]
            isOneToOne: false
            referencedRelation: "istruttori"
            referencedColumns: ["id"]
          },
        ]
      }
      lezioni_private_atlete: {
        Row: {
          atleta_id: string
          created_at: string
          id: string
          lezione_id: string
          quota_costo: number
        }
        Insert: {
          atleta_id: string
          created_at?: string
          id?: string
          lezione_id: string
          quota_costo?: number
        }
        Update: {
          atleta_id?: string
          created_at?: string
          id?: string
          lezione_id?: string
          quota_costo?: number
        }
        Relationships: [
          {
            foreignKeyName: "lezioni_private_atlete_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lezioni_private_atlete_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lezioni_private_atlete_lezione_id_fkey"
            columns: ["lezione_id"]
            isOneToOne: false
            referencedRelation: "lezioni_private"
            referencedColumns: ["id"]
          },
        ]
      }
      lezioni_private_storiche: {
        Row: {
          atleta_id: string | null
          club_id: string
          created_at: string
          data: string
          id: string
          importo_pagato: number
          istruttore_id: string | null
          ore: number
          stagione_id: string
        }
        Insert: {
          atleta_id?: string | null
          club_id: string
          created_at?: string
          data: string
          id?: string
          importo_pagato?: number
          istruttore_id?: string | null
          ore?: number
          stagione_id: string
        }
        Update: {
          atleta_id?: string | null
          club_id?: string
          created_at?: string
          data?: string
          id?: string
          importo_pagato?: number
          istruttore_id?: string | null
          ore?: number
          stagione_id?: string
        }
        Relationships: []
      }
      livelli: {
        Row: {
          attivo: boolean
          created_at: string
          fase: string
          id: string
          nome: string
          ordine: number
          paese: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          fase: string
          id?: string
          nome: string
          ordine: number
          paese?: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          fase?: string
          id?: string
          nome?: string
          ordine?: number
          paese?: string
        }
        Relationships: []
      }
      materiali_promo: {
        Row: {
          club_id: string
          descrizione: string | null
          file_url: string | null
          id: string
          tipo: string
          titolo: string
          updated_at: string
        }
        Insert: {
          club_id: string
          descrizione?: string | null
          file_url?: string | null
          id?: string
          tipo?: string
          titolo?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          descrizione?: string | null
          file_url?: string | null
          id?: string
          tipo?: string
          titolo?: string
          updated_at?: string
        }
        Relationships: []
      }
      migrazioni: {
        Row: {
          club_destinazione_id: string | null
          club_origine_id: string | null
          created_at: string
          id: string
          note: string | null
          persona_id: string
          persona_nome: string | null
          tipo: string
        }
        Insert: {
          club_destinazione_id?: string | null
          club_origine_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          persona_id: string
          persona_nome?: string | null
          tipo: string
        }
        Update: {
          club_destinazione_id?: string | null
          club_origine_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          persona_id?: string
          persona_nome?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "migrazioni_club_destinazione_id_fkey"
            columns: ["club_destinazione_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migrazioni_club_destinazione_id_fkey"
            columns: ["club_destinazione_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migrazioni_club_destinazione_id_fkey"
            columns: ["club_destinazione_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migrazioni_club_destinazione_id_fkey"
            columns: ["club_destinazione_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "migrazioni_club_origine_id_fkey"
            columns: ["club_origine_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migrazioni_club_origine_id_fkey"
            columns: ["club_origine_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migrazioni_club_origine_id_fkey"
            columns: ["club_origine_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "migrazioni_club_origine_id_fkey"
            columns: ["club_origine_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      moduli_gestione_club: {
        Row: {
          area: string
          attivato_at: string | null
          attivato_da: string | null
          club_id: string
          created_at: string
          id: string
          modalita: string
          updated_at: string
        }
        Insert: {
          area: string
          attivato_at?: string | null
          attivato_da?: string | null
          club_id: string
          created_at?: string
          id?: string
          modalita?: string
          updated_at?: string
        }
        Update: {
          area?: string
          attivato_at?: string | null
          attivato_da?: string | null
          club_id?: string
          created_at?: string
          id?: string
          modalita?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moduli_gestione_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moduli_gestione_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moduli_gestione_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moduli_gestione_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      motivi_abbandono_aggregati: {
        Row: {
          club_id: string
          count: number
          id: string
          motivo: string
          stagione_id: string
        }
        Insert: {
          club_id: string
          count?: number
          id?: string
          motivo: string
          stagione_id: string
        }
        Update: {
          club_id?: string
          count?: number
          id?: string
          motivo?: string
          stagione_id?: string
        }
        Relationships: []
      }
      ore_lavorate_dettaglio: {
        Row: {
          club_id: string
          confermato_at: string | null
          confermato_da: string | null
          created_at: string
          data: string
          id: string
          istruttore_id: string
          motivo: string | null
          note: string | null
          ora_fine: string | null
          ora_inizio: string | null
          ore_calcolate: number
          planning_corso_id: string | null
          source_presenza_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          club_id: string
          confermato_at?: string | null
          confermato_da?: string | null
          created_at?: string
          data: string
          id?: string
          istruttore_id: string
          motivo?: string | null
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          ore_calcolate?: number
          planning_corso_id?: string | null
          source_presenza_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          confermato_at?: string | null
          confermato_da?: string | null
          created_at?: string
          data?: string
          id?: string
          istruttore_id?: string
          motivo?: string | null
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          ore_calcolate?: number
          planning_corso_id?: string | null
          source_presenza_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      ore_lavorate_istruttori: {
        Row: {
          anno: number | null
          club_id: string
          created_at: string
          id: string
          istruttore_id: string
          mese: number | null
          note_extra: string | null
          ore_amministrative: number | null
          ore_campi: number | null
          ore_corsi: number | null
          ore_eventi: number | null
          ore_extra: number | null
          ore_gare: number | null
          ore_lezioni_private: number | null
          periodo: string
          stagione_id: string
          updated_at: string
        }
        Insert: {
          anno?: number | null
          club_id: string
          created_at?: string
          id?: string
          istruttore_id: string
          mese?: number | null
          note_extra?: string | null
          ore_amministrative?: number | null
          ore_campi?: number | null
          ore_corsi?: number | null
          ore_eventi?: number | null
          ore_extra?: number | null
          ore_gare?: number | null
          ore_lezioni_private?: number | null
          periodo: string
          stagione_id: string
          updated_at?: string
        }
        Update: {
          anno?: number | null
          club_id?: string
          created_at?: string
          id?: string
          istruttore_id?: string
          mese?: number | null
          note_extra?: string | null
          ore_amministrative?: number | null
          ore_campi?: number | null
          ore_corsi?: number | null
          ore_eventi?: number | null
          ore_extra?: number | null
          ore_gare?: number | null
          ore_lezioni_private?: number | null
          periodo?: string
          stagione_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ore_pista_disponibili: {
        Row: {
          club_id: string
          costo_orario_pista: number
          created_at: string
          id: string
          ore_richieste_se_accettassimo_tutti: number
          ore_settimanali_totali: number
          ore_settimanali_utilizzate: number
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          costo_orario_pista?: number
          created_at?: string
          id?: string
          ore_richieste_se_accettassimo_tutti?: number
          ore_settimanali_totali?: number
          ore_settimanali_utilizzate?: number
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          costo_orario_pista?: number
          created_at?: string
          id?: string
          ore_richieste_se_accettassimo_tutti?: number
          ore_settimanali_totali?: number
          ore_settimanali_utilizzate?: number
          stagione_id?: string | null
        }
        Relationships: []
      }
      ore_pista_monitors: {
        Row: {
          anno: number
          atleta_id: string
          created_at: string
          id: string
          mese: number
          note_extra: string | null
          ore_extra: number
          updated_at: string
        }
        Insert: {
          anno: number
          atleta_id: string
          created_at?: string
          id?: string
          mese: number
          note_extra?: string | null
          ore_extra?: number
          updated_at?: string
        }
        Update: {
          anno?: number
          atleta_id?: string
          created_at?: string
          id?: string
          mese?: number
          note_extra?: string | null
          ore_extra?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ore_pista_monitors_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ore_pista_monitors_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
        ]
      }
      pacchetti_opzionali: {
        Row: {
          attivo: boolean
          club_id: string
          created_at: string
          descrizione: string | null
          durata_settimane: number | null
          id: string
          max_partecipanti: number | null
          nome: string
          prezzo: number
          tipo: string
        }
        Insert: {
          attivo?: boolean
          club_id: string
          created_at?: string
          descrizione?: string | null
          durata_settimane?: number | null
          id?: string
          max_partecipanti?: number | null
          nome: string
          prezzo?: number
          tipo?: string
        }
        Update: {
          attivo?: boolean
          club_id?: string
          created_at?: string
          descrizione?: string | null
          durata_settimane?: number | null
          id?: string
          max_partecipanti?: number | null
          nome?: string
          prezzo?: number
          tipo?: string
        }
        Relationships: []
      }
      pacchetti_sponsor: {
        Row: {
          attivo: boolean
          benefits: Json
          club_id: string
          colore_brand: string
          created_at: string
          id: string
          livello: string
          max_sponsor_disponibili: number | null
          nome_visualizzato: string
          ordine: number
          prezzo_annuo: number
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          benefits?: Json
          club_id: string
          colore_brand?: string
          created_at?: string
          id?: string
          livello: string
          max_sponsor_disponibili?: number | null
          nome_visualizzato: string
          ordine?: number
          prezzo_annuo?: number
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          benefits?: Json
          club_id?: string
          colore_brand?: string
          created_at?: string
          id?: string
          livello?: string
          max_sponsor_disponibili?: number | null
          nome_visualizzato?: string
          ordine?: number
          prezzo_annuo?: number
          updated_at?: string
        }
        Relationships: []
      }
      percorsi_atleta: {
        Row: {
          atleta_id: string
          attivo: boolean
          created_at: string
          id: string
          livelli_extra_autorizzati_ids: string[]
          livello_attuale_id: string | null
          livello_in_preparazione_id: string | null
          percorso: string
          updated_at: string
        }
        Insert: {
          atleta_id: string
          attivo?: boolean
          created_at?: string
          id?: string
          livelli_extra_autorizzati_ids?: string[]
          livello_attuale_id?: string | null
          livello_in_preparazione_id?: string | null
          percorso: string
          updated_at?: string
        }
        Update: {
          atleta_id?: string
          attivo?: boolean
          created_at?: string
          id?: string
          livelli_extra_autorizzati_ids?: string[]
          livello_attuale_id?: string | null
          livello_in_preparazione_id?: string | null
          percorso?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "percorsi_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "percorsi_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "percorsi_atleta_livello_attuale_id_fkey"
            columns: ["livello_attuale_id"]
            isOneToOne: false
            referencedRelation: "livelli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "percorsi_atleta_livello_in_preparazione_id_fkey"
            columns: ["livello_in_preparazione_id"]
            isOneToOne: false
            referencedRelation: "livelli"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_template_overrides: {
        Row: {
          club_id: string
          created_at: string
          id: string
          sezione: string
          testo: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          sezione: string
          testo?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          sezione?: string
          testo?: string
          updated_at?: string
        }
        Relationships: []
      }
      planning_corsi_settimana: {
        Row: {
          annullato: boolean
          corso_id: string
          created_at: string
          creato_at: string
          creato_da: string | null
          data: string
          evento_straordinario_id: string | null
          id: string
          is_evento_extra: boolean
          istruttore_id: string | null
          modificato_at: string
          motivo: string | null
          note_settimana: string | null
          ora_fine: string
          ora_inizio: string
          settimana_id: string
          sostituisce_id: string | null
          titolo_override: string | null
        }
        Insert: {
          annullato?: boolean
          corso_id: string
          created_at?: string
          creato_at?: string
          creato_da?: string | null
          data: string
          evento_straordinario_id?: string | null
          id?: string
          is_evento_extra?: boolean
          istruttore_id?: string | null
          modificato_at?: string
          motivo?: string | null
          note_settimana?: string | null
          ora_fine: string
          ora_inizio: string
          settimana_id: string
          sostituisce_id?: string | null
          titolo_override?: string | null
        }
        Update: {
          annullato?: boolean
          corso_id?: string
          created_at?: string
          creato_at?: string
          creato_da?: string | null
          data?: string
          evento_straordinario_id?: string | null
          id?: string
          is_evento_extra?: boolean
          istruttore_id?: string | null
          modificato_at?: string
          motivo?: string | null
          note_settimana?: string | null
          ora_fine?: string
          ora_inizio?: string
          settimana_id?: string
          sostituisce_id?: string | null
          titolo_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_corsi_settimana_settimana_id_fkey"
            columns: ["settimana_id"]
            isOneToOne: false
            referencedRelation: "planning_settimane"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_corsi_settimana_sostituisce_id_fkey"
            columns: ["sostituisce_id"]
            isOneToOne: false
            referencedRelation: "planning_corsi_settimana"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_private_settimana: {
        Row: {
          annullato: boolean
          created_at: string
          data: string
          id: string
          istruttore_id: string | null
          lezione_privata_id: string
          motivo: string | null
          ora_fine: string
          ora_inizio: string
          settimana_id: string
        }
        Insert: {
          annullato?: boolean
          created_at?: string
          data: string
          id?: string
          istruttore_id?: string | null
          lezione_privata_id: string
          motivo?: string | null
          ora_fine: string
          ora_inizio: string
          settimana_id: string
        }
        Update: {
          annullato?: boolean
          created_at?: string
          data?: string
          id?: string
          istruttore_id?: string | null
          lezione_privata_id?: string
          motivo?: string | null
          ora_fine?: string
          ora_inizio?: string
          settimana_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_private_settimana_settimana_id_fkey"
            columns: ["settimana_id"]
            isOneToOne: false
            referencedRelation: "planning_settimane"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_settimane: {
        Row: {
          archiviato: boolean | null
          club_id: string
          copiata_da: string | null
          created_at: string
          data_lunedi: string
          id: string
          note: string | null
          stagione_id: string | null
          stato: string
        }
        Insert: {
          archiviato?: boolean | null
          club_id: string
          copiata_da?: string | null
          created_at?: string
          data_lunedi: string
          id?: string
          note?: string | null
          stagione_id?: string | null
          stato?: string
        }
        Update: {
          archiviato?: boolean | null
          club_id?: string
          copiata_da?: string | null
          created_at?: string
          data_lunedi?: string
          id?: string
          note?: string | null
          stagione_id?: string | null
          stato?: string
        }
        Relationships: []
      }
      presenze: {
        Row: {
          club_id: string
          created_at: string
          data: string
          id: string
          metodo: string | null
          ora_entrata: string | null
          ora_uscita: string | null
          persona_id: string
          riferimento_id: string | null
          tipo_persona: string
          tipo_riferimento: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          data: string
          id?: string
          metodo?: string | null
          ora_entrata?: string | null
          ora_uscita?: string | null
          persona_id: string
          riferimento_id?: string | null
          tipo_persona?: string
          tipo_riferimento?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          data?: string
          id?: string
          metodo?: string | null
          ora_entrata?: string | null
          ora_uscita?: string | null
          persona_id?: string
          riferimento_id?: string | null
          tipo_persona?: string
          tipo_riferimento?: string | null
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
      presenze_staff_corso: {
        Row: {
          corso_id: string
          created_at: string
          data: string
          id: string
          note: string | null
          persona_id: string
          sostituto_id: string | null
          stato: string
          tipo_persona: string
          updated_at: string
        }
        Insert: {
          corso_id: string
          created_at?: string
          data: string
          id?: string
          note?: string | null
          persona_id: string
          sostituto_id?: string | null
          stato?: string
          tipo_persona: string
          updated_at?: string
        }
        Update: {
          corso_id?: string
          created_at?: string
          data?: string
          id?: string
          note?: string | null
          persona_id?: string
          sostituto_id?: string | null
          stato?: string
          tipo_persona?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenze_staff_corso_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
        ]
      }
      proposte: {
        Row: {
          attiva: boolean
          club_id: string
          created_at: string
          descrizione: string | null
          id: string
          livello_id: string | null
          nome: string
          prezzo_mensile: number | null
          stagione_id: string | null
        }
        Insert: {
          attiva?: boolean
          club_id: string
          created_at?: string
          descrizione?: string | null
          id?: string
          livello_id?: string | null
          nome: string
          prezzo_mensile?: number | null
          stagione_id?: string | null
        }
        Update: {
          attiva?: boolean
          club_id?: string
          created_at?: string
          descrizione?: string | null
          id?: string
          livello_id?: string | null
          nome?: string
          prezzo_mensile?: number | null
          stagione_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposte_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposte_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposte_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposte_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "proposte_livello_id_fkey"
            columns: ["livello_id"]
            isOneToOne: false
            referencedRelation: "livelli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposte_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      ragioni_sociali: {
        Row: {
          accesso_dedicato: boolean
          anno_numerazione: number | null
          attivo: boolean
          banca: string | null
          cap: string | null
          citta: string | null
          club_id: string
          colore_primario: string
          created_at: string
          formato_numero_fattura: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestatario_iban: string | null
          layout_config: Json
          logo_url: string | null
          nome: string
          numero_fattura_prefisso: string | null
          numero_iva: string | null
          ordine: number
          paese_iso: string
          partita_iva: string | null
          prossimo_numero_fattura: number
          updated_at: string
        }
        Insert: {
          accesso_dedicato?: boolean
          anno_numerazione?: number | null
          attivo?: boolean
          banca?: string | null
          cap?: string | null
          citta?: string | null
          club_id: string
          colore_primario?: string
          created_at?: string
          formato_numero_fattura?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_iban?: string | null
          layout_config?: Json
          logo_url?: string | null
          nome: string
          numero_fattura_prefisso?: string | null
          numero_iva?: string | null
          ordine?: number
          paese_iso?: string
          partita_iva?: string | null
          prossimo_numero_fattura?: number
          updated_at?: string
        }
        Update: {
          accesso_dedicato?: boolean
          anno_numerazione?: number | null
          attivo?: boolean
          banca?: string | null
          cap?: string | null
          citta?: string | null
          club_id?: string
          colore_primario?: string
          created_at?: string
          formato_numero_fattura?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_iban?: string | null
          layout_config?: Json
          logo_url?: string | null
          nome?: string
          numero_fattura_prefisso?: string | null
          numero_iva?: string | null
          ordine?: number
          paese_iso?: string
          partita_iva?: string | null
          prossimo_numero_fattura?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ragioni_sociali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ragioni_sociali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ragioni_sociali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ragioni_sociali_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      ragioni_sociali_listini: {
        Row: {
          attivo: boolean
          created_at: string
          descrizione: string | null
          id: string
          nome: string
          ordine: number
          prezzo_slot_chf: number | null
          ragione_sociale_id: string
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          descrizione?: string | null
          id?: string
          nome: string
          ordine?: number
          prezzo_slot_chf?: number | null
          ragione_sociale_id: string
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          descrizione?: string | null
          id?: string
          nome?: string
          ordine?: number
          prezzo_slot_chf?: number | null
          ragione_sociale_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ragioni_sociali_listini_ragione_sociale_id_fkey"
            columns: ["ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
        ]
      }
      ragioni_sociali_utenti: {
        Row: {
          created_at: string
          id: string
          ragione_sociale_id: string
          utente_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ragione_sociale_id: string
          utente_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ragione_sociale_id?: string
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ragioni_sociali_utenti_ragione_sociale_id_fkey"
            columns: ["ragione_sociale_id"]
            isOneToOne: false
            referencedRelation: "ragioni_sociali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ragioni_sociali_utenti_utente_id_fkey"
            columns: ["utente_id"]
            isOneToOne: false
            referencedRelation: "utenti_club"
            referencedColumns: ["id"]
          },
        ]
      }
      regole_comunicazioni_club: {
        Row: {
          attiva: boolean
          club_id: string
          codice: string
          created_at: string
          destinatario_notifica: string
          id: string
          parametri: Json
          updated_at: string
        }
        Insert: {
          attiva?: boolean
          club_id: string
          codice: string
          created_at?: string
          destinatario_notifica?: string
          id?: string
          parametri?: Json
          updated_at?: string
        }
        Update: {
          attiva?: boolean
          club_id?: string
          codice?: string
          created_at?: string
          destinatario_notifica?: string
          id?: string
          parametri?: Json
          updated_at?: string
        }
        Relationships: []
      }
      relazione_preferenze: {
        Row: {
          attivo: boolean
          club_id: string
          created_at: string
          id: string
          ordine: number
          sezione_id: string
          sezione_tipo: string
          stagione_id: string | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          club_id: string
          created_at?: string
          id?: string
          ordine?: number
          sezione_id: string
          sezione_tipo: string
          stagione_id?: string | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          club_id?: string
          created_at?: string
          id?: string
          ordine?: number
          sezione_id?: string
          sezione_tipo?: string
          stagione_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relazioni_allegati: {
        Row: {
          attivo: boolean
          categoria: string
          club_id: string
          created_at: string
          descrizione: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string
          ordine: number
          stagione_id: string | null
          titolo: string
          uploaded_by: string | null
        }
        Insert: {
          attivo?: boolean
          categoria: string
          club_id: string
          created_at?: string
          descrizione?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string
          ordine?: number
          stagione_id?: string | null
          titolo: string
          uploaded_by?: string | null
        }
        Update: {
          attivo?: boolean
          categoria?: string
          club_id?: string
          created_at?: string
          descrizione?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string
          ordine?: number
          stagione_id?: string | null
          titolo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relazioni_allegati_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relazioni_allegati_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relazioni_allegati_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relazioni_allegati_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "relazioni_allegati_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      relazioni_blocchi_testo: {
        Row: {
          attivo: boolean
          categoria: string
          club_id: string
          contenuto: string
          created_at: string
          id: string
          ordine: number
          stagione_id: string | null
          titolo: string
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          categoria: string
          club_id: string
          contenuto?: string
          created_at?: string
          id?: string
          ordine?: number
          stagione_id?: string | null
          titolo: string
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          categoria?: string
          club_id?: string
          contenuto?: string
          created_at?: string
          id?: string
          ordine?: number
          stagione_id?: string | null
          titolo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relazioni_blocchi_testo_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relazioni_blocchi_testo_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relazioni_blocchi_testo_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relazioni_blocchi_testo_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "relazioni_blocchi_testo_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      relazioni_paragrafi_auto: {
        Row: {
          area_id: string
          club_id: string
          contenuto: string
          generated_at: string
          id: string
          is_edited: boolean
          paragrafo_ordine: number
          stagione_id: string
          tono: string
          updated_at: string
        }
        Insert: {
          area_id: string
          club_id: string
          contenuto?: string
          generated_at?: string
          id?: string
          is_edited?: boolean
          paragrafo_ordine: number
          stagione_id: string
          tono: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          club_id?: string
          contenuto?: string
          generated_at?: string
          id?: string
          is_edited?: boolean
          paragrafo_ordine?: number
          stagione_id?: string
          tono?: string
          updated_at?: string
        }
        Relationships: []
      }
      ricavi_per_fonte: {
        Row: {
          club_id: string
          created_at: string
          fonte: string
          id: string
          importo: number
          stagione_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          fonte: string
          id?: string
          importo?: number
          stagione_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          fonte?: string
          id?: string
          importo?: number
          stagione_id?: string
        }
        Relationships: []
      }
      richieste_iscrizione: {
        Row: {
          atleta_id: string
          club_id: string
          corso_id: string
          created_at: string
          gestita_da: string | null
          gestita_il: string | null
          id: string
          note_richiesta: string | null
          note_risposta: string | null
          stato: string
        }
        Insert: {
          atleta_id: string
          club_id: string
          corso_id: string
          created_at?: string
          gestita_da?: string | null
          gestita_il?: string | null
          id?: string
          note_richiesta?: string | null
          note_risposta?: string | null
          stato?: string
        }
        Update: {
          atleta_id?: string
          club_id?: string
          corso_id?: string
          created_at?: string
          gestita_da?: string | null
          gestita_il?: string | null
          id?: string
          note_richiesta?: string | null
          note_risposta?: string | null
          stato?: string
        }
        Relationships: []
      }
      richieste_iscrizione_storiche: {
        Row: {
          club_id: string
          corso_id: string | null
          created_at: string
          id: string
          n_in_lista_attesa: number
          n_iscritti_accettati: number
          n_richieste_ricevute: number
          periodo: string | null
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          corso_id?: string | null
          created_at?: string
          id?: string
          n_in_lista_attesa?: number
          n_iscritti_accettati?: number
          n_richieste_ricevute?: number
          periodo?: string | null
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          corso_id?: string | null
          created_at?: string
          id?: string
          n_in_lista_attesa?: number
          n_iscritti_accettati?: number
          n_richieste_ricevute?: number
          periodo?: string | null
          stagione_id?: string | null
        }
        Relationships: []
      }
      risorse_strutture: {
        Row: {
          attiva: boolean
          capienza_max: number | null
          club_id: string
          colore: string | null
          created_at: string
          evento_campo_id: string | null
          id: string
          indirizzo_ospitante: string | null
          is_ospite: boolean
          nome: string
          nome_struttura_ospitante: string | null
          ordine: number
          tipo: string
          updated_at: string
        }
        Insert: {
          attiva?: boolean
          capienza_max?: number | null
          club_id: string
          colore?: string | null
          created_at?: string
          evento_campo_id?: string | null
          id?: string
          indirizzo_ospitante?: string | null
          is_ospite?: boolean
          nome: string
          nome_struttura_ospitante?: string | null
          ordine?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          attiva?: boolean
          capienza_max?: number | null
          club_id?: string
          colore?: string | null
          created_at?: string
          evento_campo_id?: string | null
          id?: string
          indirizzo_ospitante?: string | null
          is_ospite?: boolean
          nome?: string
          nome_struttura_ospitante?: string | null
          ordine?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risorse_strutture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risorse_strutture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risorse_strutture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risorse_strutture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "risorse_strutture_evento_campo_id_fkey"
            columns: ["evento_campo_id"]
            isOneToOne: false
            referencedRelation: "eventi_campi"
            referencedColumns: ["id"]
          },
        ]
      }
      risultati_gara: {
        Row: {
          atleta_id: string | null
          atleta_nome_esterno: string
          categoria: string
          club_esterno: string
          created_at: string
          deductions: number | null
          disciplina: string
          gara_id: string
          gruppo: string
          id: string
          pcs: number | null
          pcs_presentation: number | null
          pcs_skating_skills: number | null
          rank: number | null
          segmento: string | null
          starting_number: number | null
          tes: number | null
          tot: number | null
        }
        Insert: {
          atleta_id?: string | null
          atleta_nome_esterno?: string
          categoria?: string
          club_esterno?: string
          created_at?: string
          deductions?: number | null
          disciplina?: string
          gara_id: string
          gruppo?: string
          id?: string
          pcs?: number | null
          pcs_presentation?: number | null
          pcs_skating_skills?: number | null
          rank?: number | null
          segmento?: string | null
          starting_number?: number | null
          tes?: number | null
          tot?: number | null
        }
        Update: {
          atleta_id?: string | null
          atleta_nome_esterno?: string
          categoria?: string
          club_esterno?: string
          created_at?: string
          deductions?: number | null
          disciplina?: string
          gara_id?: string
          gruppo?: string
          id?: string
          pcs?: number | null
          pcs_presentation?: number | null
          pcs_skating_skills?: number | null
          rank?: number | null
          segmento?: string | null
          starting_number?: number | null
          tes?: number | null
          tot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "risultati_gara_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risultati_gara_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risultati_gara_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risultati_gara_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario_mobile"
            referencedColumns: ["id"]
          },
        ]
      }
      risultati_storici_stagioni: {
        Row: {
          atleti_gareggianti: number
          club_id: string
          created_at: string
          gare_disputate: number
          id: string
          podi_conquistati: number
          stagione_id: string
        }
        Insert: {
          atleti_gareggianti?: number
          club_id: string
          created_at?: string
          gare_disputate?: number
          id?: string
          podi_conquistati?: number
          stagione_id: string
        }
        Update: {
          atleti_gareggianti?: number
          club_id?: string
          created_at?: string
          gare_disputate?: number
          id?: string
          podi_conquistati?: number
          stagione_id?: string
        }
        Relationships: []
      }
      ruoli_permessi_sezioni: {
        Row: {
          club_id: string
          codice_sezione: string
          created_at: string
          id: string
          ordine: number
          ruolo: string
          updated_at: string
          visibile: boolean
        }
        Insert: {
          club_id: string
          codice_sezione: string
          created_at?: string
          id?: string
          ordine?: number
          ruolo: string
          updated_at?: string
          visibile?: boolean
        }
        Update: {
          club_id?: string
          codice_sezione?: string
          created_at?: string
          id?: string
          ordine?: number
          ruolo?: string
          updated_at?: string
          visibile?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ruoli_permessi_sezioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruoli_permessi_sezioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruoli_permessi_sezioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruoli_permessi_sezioni_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      sessioni_campo: {
        Row: {
          created_at: string
          data: string
          evento_campo_id: string
          id: string
          istruttore_id: string | null
          note: string | null
          ora_fine: string
          ora_inizio: string
          titolo: string
        }
        Insert: {
          created_at?: string
          data: string
          evento_campo_id: string
          id?: string
          istruttore_id?: string | null
          note?: string | null
          ora_fine: string
          ora_inizio: string
          titolo?: string
        }
        Update: {
          created_at?: string
          data?: string
          evento_campo_id?: string
          id?: string
          istruttore_id?: string | null
          note?: string | null
          ora_fine?: string
          ora_inizio?: string
          titolo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessioni_campo_evento_campo_id_fkey"
            columns: ["evento_campo_id"]
            isOneToOne: false
            referencedRelation: "eventi_campi"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_club: {
        Row: {
          anno_fondazione: number | null
          anno_numerazione: number | null
          banca: string | null
          clausole_contratto: string | null
          club_id: string
          created_at: string
          data_fine_stagione: string | null
          data_inizio_stagione: string | null
          fattura_colore_accento: string | null
          fattura_footer_testo: string | null
          fattura_giorni_scadenza: number
          fattura_mostra_iban: boolean
          fattura_mostra_logo: boolean
          fattura_note_legali: string | null
          fattura_prefisso_numero: string
          fatturazione_costo_test: number | null
          fatturazione_giorno_mese: number | null
          fatturazione_invio_email_auto: boolean | null
          formato_numero_fattura: string | null
          iban: string | null
          id: string
          indirizzo_banca: string | null
          intestatario_conto: string | null
          max_atlete_lezione_condivisa: number | null
          max_lezioni_private_contemporanee: number | null
          medagliere_punti: Json | null
          missione: string | null
          prossimo_numero_fattura: number
          slot_lezione_privata_minuti: number | null
          sollecito_attivo: boolean
          sollecito_giorni: number[]
          storia_breve: string | null
          twint_paylink: string | null
          valori: string | null
        }
        Insert: {
          anno_fondazione?: number | null
          anno_numerazione?: number | null
          banca?: string | null
          clausole_contratto?: string | null
          club_id: string
          created_at?: string
          data_fine_stagione?: string | null
          data_inizio_stagione?: string | null
          fattura_colore_accento?: string | null
          fattura_footer_testo?: string | null
          fattura_giorni_scadenza?: number
          fattura_mostra_iban?: boolean
          fattura_mostra_logo?: boolean
          fattura_note_legali?: string | null
          fattura_prefisso_numero?: string
          fatturazione_costo_test?: number | null
          fatturazione_giorno_mese?: number | null
          fatturazione_invio_email_auto?: boolean | null
          formato_numero_fattura?: string | null
          iban?: string | null
          id?: string
          indirizzo_banca?: string | null
          intestatario_conto?: string | null
          max_atlete_lezione_condivisa?: number | null
          max_lezioni_private_contemporanee?: number | null
          medagliere_punti?: Json | null
          missione?: string | null
          prossimo_numero_fattura?: number
          slot_lezione_privata_minuti?: number | null
          sollecito_attivo?: boolean
          sollecito_giorni?: number[]
          storia_breve?: string | null
          twint_paylink?: string | null
          valori?: string | null
        }
        Update: {
          anno_fondazione?: number | null
          anno_numerazione?: number | null
          banca?: string | null
          clausole_contratto?: string | null
          club_id?: string
          created_at?: string
          data_fine_stagione?: string | null
          data_inizio_stagione?: string | null
          fattura_colore_accento?: string | null
          fattura_footer_testo?: string | null
          fattura_giorni_scadenza?: number
          fattura_mostra_iban?: boolean
          fattura_mostra_logo?: boolean
          fattura_note_legali?: string | null
          fattura_prefisso_numero?: string
          fatturazione_costo_test?: number | null
          fatturazione_giorno_mese?: number | null
          fatturazione_invio_email_auto?: boolean | null
          formato_numero_fattura?: string | null
          iban?: string | null
          id?: string
          indirizzo_banca?: string | null
          intestatario_conto?: string | null
          max_atlete_lezione_condivisa?: number | null
          max_lezioni_private_contemporanee?: number | null
          medagliere_punti?: Json | null
          missione?: string | null
          prossimo_numero_fattura?: number
          slot_lezione_privata_minuti?: number | null
          sollecito_attivo?: boolean
          sollecito_giorni?: number[]
          storia_breve?: string | null
          twint_paylink?: string | null
          valori?: string | null
        }
        Relationships: []
      }
      sponsor: {
        Row: {
          attivo: boolean | null
          categoria: string | null
          club_id: string
          created_at: string | null
          data_fine: string | null
          data_inizio: string | null
          id: string
          importo_annuo: number | null
          logo_url: string | null
          nome: string
          note_interne: string | null
          pacchetto_id: string | null
          visibilita_banner: boolean | null
          visibilita_gala: boolean | null
          visibilita_maglie: boolean | null
          visibilita_social: boolean | null
        }
        Insert: {
          attivo?: boolean | null
          categoria?: string | null
          club_id: string
          created_at?: string | null
          data_fine?: string | null
          data_inizio?: string | null
          id?: string
          importo_annuo?: number | null
          logo_url?: string | null
          nome: string
          note_interne?: string | null
          pacchetto_id?: string | null
          visibilita_banner?: boolean | null
          visibilita_gala?: boolean | null
          visibilita_maglie?: boolean | null
          visibilita_social?: boolean | null
        }
        Update: {
          attivo?: boolean | null
          categoria?: string | null
          club_id?: string
          created_at?: string | null
          data_fine?: string | null
          data_inizio?: string | null
          id?: string
          importo_annuo?: number | null
          logo_url?: string | null
          nome?: string
          note_interne?: string | null
          pacchetto_id?: string | null
          visibilita_banner?: boolean | null
          visibilita_gala?: boolean | null
          visibilita_maglie?: boolean | null
          visibilita_social?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      sponsor_attivi: {
        Row: {
          categoria: string | null
          club_id: string
          created_at: string
          descrizione_breve: string | null
          id: string
          importo_annuo: number
          livello: string
          nome_sponsor: string
          stagione_fine: number | null
          stagione_inizio: number | null
        }
        Insert: {
          categoria?: string | null
          club_id: string
          created_at?: string
          descrizione_breve?: string | null
          id?: string
          importo_annuo?: number
          livello?: string
          nome_sponsor?: string
          stagione_fine?: number | null
          stagione_inizio?: number | null
        }
        Update: {
          categoria?: string | null
          club_id?: string
          created_at?: string
          descrizione_breve?: string | null
          id?: string
          importo_annuo?: number
          livello?: string
          nome_sponsor?: string
          stagione_fine?: number | null
          stagione_inizio?: number | null
        }
        Relationships: []
      }
      sponsor_categorie_cercate: {
        Row: {
          categoria: string
          club_id: string
          created_at: string
          descrizione_offerta: string | null
          id: string
          importo_richiesto_indicativo: number
          priorita: string
        }
        Insert: {
          categoria?: string
          club_id: string
          created_at?: string
          descrizione_offerta?: string | null
          id?: string
          importo_richiesto_indicativo?: number
          priorita?: string
        }
        Update: {
          categoria?: string
          club_id?: string
          created_at?: string
          descrizione_offerta?: string | null
          id?: string
          importo_richiesto_indicativo?: number
          priorita?: string
        }
        Relationships: []
      }
      stagioni: {
        Row: {
          attiva: boolean | null
          club_id: string
          created_at: string
          data_fine: string
          data_inizio: string
          id: string
          nome: string
          stato: string | null
          tipo: string
        }
        Insert: {
          attiva?: boolean | null
          club_id: string
          created_at?: string
          data_fine: string
          data_inizio: string
          id?: string
          nome?: string
          stato?: string | null
          tipo?: string
        }
        Update: {
          attiva?: boolean | null
          club_id?: string
          created_at?: string
          data_fine?: string
          data_inizio?: string
          id?: string
          nome?: string
          stato?: string | null
          tipo?: string
        }
        Relationships: []
      }
      storico_livelli_atleta: {
        Row: {
          atleta_id: string
          carriera: string | null
          created_at: string
          data_fine: string | null
          data_inizio: string
          id: string
          livello: string
          note: string | null
        }
        Insert: {
          atleta_id: string
          carriera?: string | null
          created_at?: string
          data_fine?: string | null
          data_inizio: string
          id?: string
          livello: string
          note?: string | null
        }
        Update: {
          atleta_id?: string
          carriera?: string | null
          created_at?: string
          data_fine?: string | null
          data_inizio?: string
          id?: string
          livello?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storico_livelli_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storico_livelli_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
        ]
      }
      tentativi_accesso: {
        Row: {
          codice_hash: string | null
          esito: string
          id: number
          motivo: string | null
          origine: string
          quando: string
        }
        Insert: {
          codice_hash?: string | null
          esito: string
          id?: number
          motivo?: string | null
          origine: string
          quando?: string
        }
        Update: {
          codice_hash?: string | null
          esito?: string
          id?: number
          motivo?: string | null
          origine?: string
          quando?: string
        }
        Relationships: []
      }
      test_livello: {
        Row: {
          club_id: string
          club_ospitante: string | null
          costo_iscrizione: number | null
          created_at: string
          data: string | null
          gara_id: string | null
          id: string
          livello_accesso: string | null
          livello_attuale: string | null
          luogo: string | null
          nome: string
          note: string | null
          ora: string | null
          stagione_id: string | null
          tipo: string
        }
        Insert: {
          club_id: string
          club_ospitante?: string | null
          costo_iscrizione?: number | null
          created_at?: string
          data?: string | null
          gara_id?: string | null
          id?: string
          livello_accesso?: string | null
          livello_attuale?: string | null
          luogo?: string | null
          nome?: string
          note?: string | null
          ora?: string | null
          stagione_id?: string | null
          tipo?: string
        }
        Update: {
          club_id?: string
          club_ospitante?: string | null
          costo_iscrizione?: number | null
          created_at?: string
          data?: string | null
          gara_id?: string | null
          id?: string
          livello_accesso?: string | null
          livello_attuale?: string | null
          luogo?: string | null
          nome?: string
          note?: string | null
          ora?: string | null
          stagione_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_livello_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "test_livello_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario_mobile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      test_livello_atleti: {
        Row: {
          atleta_id: string
          created_at: string
          disciplina: string | null
          esito: string
          id: string
          livello_accesso: string
          livello_target: string
          note_istruttore: string | null
          ordine: number
          test_id: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          disciplina?: string | null
          esito?: string
          id?: string
          livello_accesso: string
          livello_target: string
          note_istruttore?: string | null
          ordine?: number
          test_id: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          disciplina?: string | null
          esito?: string
          id?: string
          livello_accesso?: string
          livello_target?: string
          note_istruttore?: string | null
          ordine?: number
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_livello_atleti_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_atleti_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti_con_completezza"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_livello_atleti_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_livello"
            referencedColumns: ["id"]
          },
        ]
      }
      test_storici_stagioni: {
        Row: {
          club_id: string
          created_at: string
          id: string
          sostenuti: number
          stagione_id: string
          superati: number
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          sostenuti?: number
          stagione_id: string
          superati?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          sostenuti?: number
          stagione_id?: string
          superati?: number
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
      traduzioni_jobs: {
        Row: {
          created_at: string
          id: string
          record_id: string
          tabella: string
        }
        Insert: {
          created_at?: string
          id?: string
          record_id: string
          tabella: string
        }
        Update: {
          created_at?: string
          id?: string
          record_id?: string
          tabella?: string
        }
        Relationships: []
      }
      traduzioni_ui: {
        Row: {
          aggiornato_da: string | null
          aggiornato_il: string
          chiave: string
          de: string | null
          en: string | null
          fr: string | null
          id: string
          it: string | null
          namespace: string
          rm: string | null
        }
        Insert: {
          aggiornato_da?: string | null
          aggiornato_il?: string
          chiave: string
          de?: string | null
          en?: string | null
          fr?: string | null
          id?: string
          it?: string | null
          namespace: string
          rm?: string | null
        }
        Update: {
          aggiornato_da?: string | null
          aggiornato_il?: string
          chiave?: string
          de?: string | null
          en?: string | null
          fr?: string | null
          id?: string
          it?: string | null
          namespace?: string
          rm?: string | null
        }
        Relationships: []
      }
      utenti_club: {
        Row: {
          attivo: boolean
          club_id: string | null
          cognome: string
          created_at: string
          id: string
          nome: string
          ruolo: string
          telefono: string | null
          user_id: string
        }
        Insert: {
          attivo?: boolean
          club_id?: string | null
          cognome?: string
          created_at?: string
          id?: string
          nome?: string
          ruolo?: string
          telefono?: string | null
          user_id: string
        }
        Update: {
          attivo?: boolean
          club_id?: string | null
          cognome?: string
          created_at?: string
          id?: string
          nome?: string
          ruolo?: string
          telefono?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utenti_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utenti_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utenti_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utenti_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
    }
    Views: {
      atleti_con_completezza: {
        Row: {
          a_rischio: boolean | null
          a_rischio_da: string | null
          agonista: boolean | null
          atleta_federazione: boolean | null
          attivo: boolean | null
          attivo_come_monitore: boolean | null
          campi_mancanti: string[] | null
          cantone: string | null
          cap: string | null
          carriera_artistica: string | null
          carriera_stile: string | null
          categoria: string | null
          citta: string | null
          club_id: string | null
          club_paese: string | null
          codice_atleta: string | null
          codice_fiscale: string | null
          cognome: string | null
          compenso_orario_pista: number | null
          created_at: string | null
          data_nascita: string | null
          disco_in_preparazione: string | null
          disco_url: string | null
          e_aiuto_monitrice: boolean | null
          e_monitrice: boolean | null
          foto_url: string | null
          genitore1_cantone: string | null
          genitore1_cap: string | null
          genitore1_citta: string | null
          genitore1_cognome: string | null
          genitore1_email: string | null
          genitore1_indirizzo: string | null
          genitore1_nome: string | null
          genitore1_paese_iso: string | null
          genitore1_provincia: string | null
          genitore1_regione: string | null
          genitore1_telefono: string | null
          genitore2_cantone: string | null
          genitore2_cap: string | null
          genitore2_citta: string | null
          genitore2_cognome: string | null
          genitore2_email: string | null
          genitore2_indirizzo: string | null
          genitore2_nome: string | null
          genitore2_paese_iso: string | null
          genitore2_provincia: string | null
          genitore2_regione: string | null
          genitore2_telefono: string | null
          id: string | null
          importato_da_excel: boolean | null
          indirizzo: string | null
          licenza_sis_categoria: string | null
          licenza_sis_disciplina: string | null
          licenza_sis_numero: string | null
          licenza_sis_validita_a: string | null
          livello_amatori: string | null
          livello_artistica: string | null
          livello_artistica_in_preparazione: string | null
          livello_attuale: string | null
          livello_in_preparazione: string | null
          livello_stile: string | null
          livello_stile_in_preparazione: string | null
          nome: string | null
          note: string | null
          ore_pista_stagione: number | null
          paese_iso: string | null
          provincia: string | null
          regione: string | null
          ruolo_pista: string | null
          scheda_completa: boolean | null
          sesso: string | null
          tag_nfc: string | null
          telefono: string | null
          verificato: boolean | null
          verificato_at: string | null
          verificato_da_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
        ]
      }
      clubs_mobile_public: {
        Row: {
          cantone: string | null
          cap: string | null
          citta: string | null
          colore_primario: string | null
          descrizione: string | null
          email: string | null
          id: string | null
          indirizzo: string | null
          logo_url: string | null
          nome: string | null
          paese: string | null
          sigla: string | null
          sito_web: string | null
          telefono: string | null
        }
        Insert: {
          cantone?: string | null
          cap?: string | null
          citta?: string | null
          colore_primario?: string | null
          descrizione?: string | null
          email?: string | null
          id?: string | null
          indirizzo?: string | null
          logo_url?: string | null
          nome?: string | null
          paese?: string | null
          sigla?: string | null
          sito_web?: string | null
          telefono?: string | null
        }
        Update: {
          cantone?: string | null
          cap?: string | null
          citta?: string | null
          colore_primario?: string | null
          descrizione?: string | null
          email?: string | null
          id?: string | null
          indirizzo?: string | null
          logo_url?: string | null
          nome?: string | null
          paese?: string | null
          sigla?: string | null
          sito_web?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      elenco_club: {
        Row: {
          cantone: string | null
          citta: string | null
          id: string | null
          logo_url: string | null
          nome: string | null
          paese: string | null
          sigla: string | null
        }
        Insert: {
          cantone?: string | null
          citta?: string | null
          id?: string | null
          logo_url?: string | null
          nome?: string | null
          paese?: string | null
          sigla?: string | null
        }
        Update: {
          cantone?: string | null
          citta?: string | null
          id?: string | null
          logo_url?: string | null
          nome?: string | null
          paese?: string | null
          sigla?: string | null
        }
        Relationships: []
      }
      gare_calendario_mobile: {
        Row: {
          archiviata: boolean | null
          carriera: string | null
          club_id: string | null
          club_ospitante: string | null
          created_at: string | null
          data: string | null
          id: string | null
          indirizzo: string | null
          livello_minimo: string | null
          luogo: string | null
          nome: string | null
          note: string | null
          ora: string | null
          stagione_id: string | null
        }
        Insert: {
          archiviata?: boolean | null
          carriera?: string | null
          club_id?: string | null
          club_ospitante?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          indirizzo?: string | null
          livello_minimo?: string | null
          luogo?: string | null
          nome?: string | null
          note?: string | null
          ora?: string | null
          stagione_id?: string | null
        }
        Update: {
          archiviata?: boolean | null
          carriera?: string | null
          club_id?: string | null
          club_ospitante?: string | null
          created_at?: string | null
          data?: string | null
          id?: string | null
          indirizzo?: string | null
          livello_minimo?: string | null
          luogo?: string | null
          nome?: string | null
          note?: string | null
          ora?: string | null
          stagione_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gare_calendario_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "gare_calendario_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      griglia_sessioni_atleti_vista: {
        Row: {
          atleta_id: string | null
          campo_gruppo_id: string | null
          club_id: string | null
          conflitto_forzato: boolean | null
          created_at: string | null
          etichetta: string | null
          gruppo_sessione_id: string | null
          id: string | null
          origine_corso_id: string | null
          provenienza: string | null
          sessione_id: string | null
        }
        Insert: {
          atleta_id?: never
          campo_gruppo_id?: string | null
          club_id?: string | null
          conflitto_forzato?: boolean | null
          created_at?: string | null
          etichetta?: string | null
          gruppo_sessione_id?: string | null
          id?: string | null
          origine_corso_id?: string | null
          provenienza?: string | null
          sessione_id?: string | null
        }
        Update: {
          atleta_id?: never
          campo_gruppo_id?: string | null
          club_id?: string | null
          conflitto_forzato?: boolean | null
          created_at?: string | null
          etichetta?: string | null
          gruppo_sessione_id?: string | null
          id?: string | null
          origine_corso_id?: string | null
          provenienza?: string | null
          sessione_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "griglia_sessioni_atleti_campo_gruppo_id_fkey"
            columns: ["campo_gruppo_id"]
            isOneToOne: false
            referencedRelation: "campi_gruppi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs_mobile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "elenco_club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "kpi_pitch_sponsor"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_gruppo_sessione_id_fkey"
            columns: ["gruppo_sessione_id"]
            isOneToOne: false
            referencedRelation: "griglia_sessioni_gruppi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_origine_corso_id_fkey"
            columns: ["origine_corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "griglia_sessioni_atleti_sessione_id_fkey"
            columns: ["sessione_id"]
            isOneToOne: false
            referencedRelation: "griglia_sessioni"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_gare_mobile: {
        Row: {
          atleta_id: string | null
          carriera: string | null
          created_at: string | null
          disciplina: string | null
          gara_id: string | null
          id: string | null
          livello_atleta: string | null
          medaglia: string | null
          note: string | null
          posizione: number | null
          punteggio: number | null
          punteggio_artistico: number | null
          punteggio_tecnico: number | null
          voto_giudici: string | null
        }
        Relationships: []
      }
      kpi_pitch_sponsor: {
        Row: {
          atleti_agonisti: number | null
          atleti_nuovi_stagione: number | null
          atleti_totali: number | null
          club_id: string | null
          corsi_attivi: number | null
          gare_stagione: number | null
          ore_ghiaccio_settimanali: number | null
          presenza_media_settimanale: number | null
          staff_totale: number | null
          stagione_id: string | null
        }
        Relationships: []
      }
      setup_club_pagamenti: {
        Row: {
          banca: string | null
          club_id: string | null
          iban: string | null
          intestatario_conto: string | null
          twint_paylink: string | null
        }
        Insert: {
          banca?: string | null
          club_id?: string | null
          iban?: string | null
          intestatario_conto?: string | null
          twint_paylink?: string | null
        }
        Update: {
          banca?: string | null
          club_id?: string | null
          iban?: string | null
          intestatario_conto?: string | null
          twint_paylink?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aggiorna_fatture_scadute: {
        Args: never
        Returns: {
          club: string
          marcate_scadute: number
          solleciti_generati: number
        }[]
      }
      anagrafica_fatturazione: {
        Args: { p_atleta: string }
        Returns: {
          cantone: string
          cap: string
          citta: string
          cognome: string
          email: string
          fonte: string
          indirizzo: string
          nome: string
          paese_iso: string
        }[]
      }
      anagrafica_fatturazione_mancante: {
        Args: { p_atleta: string }
        Returns: string
      }
      annulla_fattura: {
        Args: { p_fattura: string; p_motivo: string }
        Returns: string
      }
      anteprima_fatture_periodo: {
        Args: { p_anno: number; p_club: string; p_mese: number }
        Returns: {
          atleta: string
          atleta_id: string
          avviso: string
          gia_fatturata: boolean
          n_righe: number
          ragione_sociale: string
          ragione_sociale_id: string
          righe: Json
          totale: number
        }[]
      }
      archivia_comunicazioni_vecchie: { Args: never; Returns: number }
      arrotonda_chf: { Args: { p: number }; Returns: number }
      attesa_prima_di_riprovare: {
        Args: { p_origine: string }
        Returns: {
          bloccato: boolean
          falliti_recenti: number
          messaggio: string
          secondi_di_attesa: number
        }[]
      }
      campo_club_ospitante: { Args: { p_campo: string }; Returns: string }
      cancel_corso_atleta: {
        Args: { p_atleta_id: string; p_corso_id: string }
        Returns: undefined
      }
      cleanup_archived_communications: { Args: never; Returns: number }
      club_invitato_a_campo: { Args: { p_campo: string }; Returns: boolean }
      club_partecipa_a_campo: { Args: { p_campo: string }; Returns: boolean }
      controlla_saturazione_corsi: { Args: never; Returns: number }
      corsi_per_atleta: {
        Args: { p_atleta_id: string }
        Returns: {
          attivo: boolean
          club_id: string
          costo_annuale: number
          costo_mensile: number
          giorno: string
          id: string
          iscritto: boolean
          livello_richiesto: string
          nome: string
          ora_fine: string
          ora_inizio: string
          percorso: string
          richiede_approvazione: boolean
          richiesta_in_attesa: boolean
          salto_livello: boolean
          tipo: string
        }[]
      }
      diagnosi_avvio_club: {
        Args: { p_club: string }
        Returns: {
          area: string
          blocca: boolean
          controllo: string
          dettaglio: string
          esito: string
          passo: number
        }[]
      }
      duplica_fattura: { Args: { p_fattura: string }; Returns: string }
      formatta_numero_fattura: {
        Args: {
          p_anno: number
          p_mese: number
          p_modello: string
          p_prefisso: string
          p_progressivo: number
        }
        Returns: string
      }
      genera_codice_atleta: { Args: never; Returns: string }
      genera_codice_istruttore: { Args: never; Returns: string }
      genera_fatture_periodo: {
        Args: { p_anno: number; p_club: string; p_mese: number }
        Returns: {
          atleta: string
          creata: boolean
          motivo: string
          numero: string
          totale: number
        }[]
      }
      genera_planning_giornaliero: { Args: never; Returns: number }
      genera_reminder_giornalieri: { Args: never; Returns: number }
      genera_reminder_scadenza_ghiaccio: { Args: never; Returns: number }
      genera_settimana_planning: {
        Args: { p_settimana_id: string }
        Returns: number
      }
      get_atleti_impattati_da_planning: {
        Args: { p_planning_corso_id: string }
        Returns: {
          atleta_id: string
          cognome: string
          nome: string
          telefono: string
        }[]
      }
      get_gare_costi: {
        Args: { p_club_id: string }
        Returns: {
          costo_accompagnamento: number
          costo_iscrizione: number
          id: string
        }[]
      }
      get_istruttori_contatti: {
        Args: { p_club_id: string }
        Returns: {
          email: string
          id: string
          telefono: string
        }[]
      }
      get_istruttori_costi: {
        Args: { p_club_id: string }
        Returns: {
          compenso_fisso_corsi: number
          compenso_fisso_mensile: number
          costo_minuto_lezione_privata: number
          costo_orario_corsi: number
          costo_orario_lezioni: number
          id: string
        }[]
      }
      get_utente_club_display_name: {
        Args: { _user_id: string }
        Returns: string
      }
      iban_e_qr_iban: { Args: { p: string }; Returns: boolean }
      iban_normalizza: { Args: { p: string }; Returns: string }
      iban_valido: { Args: { p: string }; Returns: boolean }
      invia_push_comunicazioni_programmate: { Args: never; Returns: number }
      is_mobile_parent: { Args: never; Returns: boolean }
      is_mobile_staff: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      lezione_privata_appartiene_al_club: {
        Args: { _club_id: string; _lezione_id: string }
        Returns: boolean
      }
      migra_atleta: {
        Args: {
          p_atleta_id: string
          p_atleta_nome: string
          p_club_destinazione_id: string
          p_club_origine_id: string
          p_note?: string
        }
        Returns: undefined
      }
      migra_atleta_livello: {
        Args: { p_atleta_id: string }
        Returns: undefined
      }
      mobile_atleta_id: { Args: never; Returns: string }
      mobile_can_see_comunicazione: {
        Args: { p_com_id: string }
        Returns: boolean
      }
      mobile_club_id: { Args: never; Returns: string }
      mobile_club_info: {
        Args: never
        Returns: {
          cantone: string
          cap: string
          citta: string
          colore_primario: string
          descrizione: string
          email: string
          id: string
          indirizzo: string
          logo_url: string
          nome: string
          paese: string
          sigla: string
          sito_web: string
          telefono: string
        }[]
      }
      mobile_iscrizioni_gare: {
        Args: never
        Returns: {
          atleta_id: string
          carriera: string
          created_at: string
          disciplina: string
          gara_id: string
          id: string
          livello_atleta: string
          medaglia: string
          note: string
          posizione: number
          punteggio: number
          punteggio_artistico: number
          punteggio_tecnico: number
          voto_giudici: string
        }[]
      }
      mobile_istruttore_id: { Args: never; Returns: string }
      mobile_ruolo: { Args: never; Returns: string }
      mobile_sezioni_permesse: { Args: never; Returns: string[] }
      mod10_ricorsivo: { Args: { p_cifre: string }; Returns: number }
      normalize_label: { Args: { input: string }; Returns: string }
      passa_stagione: {
        Args: { p_nuova: string; p_vecchia: string }
        Returns: string
      }
      pulisci_tentativi_accesso: { Args: never; Returns: number }
      registra_tentativo_accesso: {
        Args: {
          p_codice: string
          p_esito: string
          p_motivo?: string
          p_origine: string
        }
        Returns: undefined
      }
      ricalcola_cache_ore_mensile: {
        Args: { p_anno: number; p_istruttore_id: string; p_mese: number }
        Returns: undefined
      }
      riconosci_identita: {
        Args: { p_valore: string }
        Returns: {
          club_id: string
          id: string
          mezzo: string
          nome: string
          ruolo: string
          tipo: string
        }[]
      }
      riferimento_qrr: { Args: { p_numero: number }; Returns: string }
      riferimento_scor: { Args: { p_numero: number }; Returns: string }
      righe_fatturabili_periodo: {
        Args: { p_anno: number; p_club: string; p_mese: number }
        Returns: {
          atleta_id: string
          descrizione: string
          giorni: number
          giorni_mese: number
          importo: number
          periodo_a: string
          periodo_da: string
          prezzo_unitario: number
          quantita: number
          ragione_sociale_id: string
          riferimento_id: string
          tipo: string
          voce: string
        }[]
      }
      ruoli_che_approvano_iscrizioni: {
        Args: { p_club: string }
        Returns: string[]
      }
      seed_dashboard_cards_default: {
        Args: { p_club: string }
        Returns: number
      }
      seed_pacchetti_sponsor_default: {
        Args: { p_club_id: string }
        Returns: undefined
      }
      seed_permessi_default: { Args: { p_club_id: string }; Returns: undefined }
      seed_permessi_integrazioni: { Args: { p_club: string }; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slot_liberi_istruttore: {
        Args: { p_data_a: string; p_data_da: string; p_istruttore_id: string }
        Returns: {
          data: string
          durata_minuti: number
          ora_fine: string
          ora_inizio: string
        }[]
      }
      sostituisci_fattura: {
        Args: { p_fattura: string; p_motivo: string }
        Returns: string
      }
      spawn_corso_atleta: {
        Args: { p_atleta_id: string; p_corso_id: string }
        Returns: undefined
      }
      storna_fattura: {
        Args: { p_fattura: string; p_motivo: string }
        Returns: string
      }
      swiss_qr_payload: {
        Args: { p_fattura: string }
        Returns: {
          errori: string
          payload: string
          riferimento: string
          tipo_riferimento: string
        }[]
      }
      sync_atleta_to_staff: { Args: { p_atleta_id: string }; Returns: string }
      testo_tradotto: {
        Args: {
          p_campo: string
          p_default: string
          p_lingua: string
          p_record: string
          p_tabella: string
        }
        Returns: string
      }
      user_can_manage_griglia: { Args: never; Returns: boolean }
      user_can_manage_richieste: { Args: never; Returns: boolean }
      user_can_see_finance: { Args: never; Returns: boolean }
      user_club_id: { Args: never; Returns: string }
      user_has_ruolo: { Args: { _ruolo: string }; Returns: boolean }
      user_is_admin_like: { Args: never; Returns: boolean }
      user_is_presidente: { Args: never; Returns: boolean }
      user_is_vicepresidente: { Args: never; Returns: boolean }
    }
    Enums: {
      livello_istruttore_enum: "istruttore" | "monitrice" | "aiuto_monitrice"
      stato_staff_enum: "attivo" | "sospeso"
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
      livello_istruttore_enum: ["istruttore", "monitrice", "aiuto_monitrice"],
      stato_staff_enum: ["attivo", "sospeso"],
    },
  },
} as const
