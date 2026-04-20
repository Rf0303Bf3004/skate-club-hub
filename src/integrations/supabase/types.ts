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
            foreignKeyName: "adesioni_atleta_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
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
      clubs: {
        Row: {
          citta: string | null
          colore_primario: string | null
          created_at: string
          descrizione: string | null
          email: string | null
          id: string
          indirizzo: string | null
          logo_url: string | null
          nome: string
          numero_tessera_federale: string | null
          paese: string | null
          sito_web: string | null
          telefono: string | null
        }
        Insert: {
          citta?: string | null
          colore_primario?: string | null
          created_at?: string
          descrizione?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          logo_url?: string | null
          nome?: string
          numero_tessera_federale?: string | null
          paese?: string | null
          sito_web?: string | null
          telefono?: string | null
        }
        Update: {
          citta?: string | null
          colore_primario?: string | null
          created_at?: string
          descrizione?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          logo_url?: string | null
          nome?: string
          numero_tessera_federale?: string | null
          paese?: string | null
          sito_web?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      comunicazioni: {
        Row: {
          atleta_id: string | null
          club_id: string
          corpo: string | null
          corso_id: string | null
          creata_da: string | null
          created_at: string
          deep_link: string | null
          evento_straordinario_id: string | null
          id: string
          inviata_at: string | null
          planning_corso_id: string | null
          programmata_per: string | null
          richiede_rsvp: boolean
          rsvp_scadenza: string | null
          stato: string
          testo: string
          tipo: string
          tipo_destinatari: string
          titolo: string
        }
        Insert: {
          atleta_id?: string | null
          club_id: string
          corpo?: string | null
          corso_id?: string | null
          creata_da?: string | null
          created_at?: string
          deep_link?: string | null
          evento_straordinario_id?: string | null
          id?: string
          inviata_at?: string | null
          planning_corso_id?: string | null
          programmata_per?: string | null
          richiede_rsvp?: boolean
          rsvp_scadenza?: string | null
          stato?: string
          testo?: string
          tipo?: string
          tipo_destinatari?: string
          titolo?: string
        }
        Update: {
          atleta_id?: string | null
          club_id?: string
          corpo?: string | null
          corso_id?: string | null
          creata_da?: string | null
          created_at?: string
          deep_link?: string | null
          evento_straordinario_id?: string | null
          id?: string
          inviata_at?: string | null
          planning_corso_id?: string | null
          programmata_per?: string | null
          richiede_rsvp?: boolean
          rsvp_scadenza?: string | null
          stato?: string
          testo?: string
          tipo?: string
          tipo_destinatari?: string
          titolo?: string
        }
        Relationships: []
      }
      comunicazioni_destinatari: {
        Row: {
          atleta_id: string
          comunicazione_id: string
          creato_at: string
          id: string
          letto_at: string | null
          rsvp_at: string | null
          rsvp_risposta: string | null
          stato: string
        }
        Insert: {
          atleta_id: string
          comunicazione_id: string
          creato_at?: string
          id?: string
          letto_at?: string | null
          rsvp_at?: string | null
          rsvp_risposta?: string | null
          stato?: string
        }
        Update: {
          atleta_id?: string
          comunicazione_id?: string
          creato_at?: string
          id?: string
          letto_at?: string | null
          rsvp_at?: string | null
          rsvp_risposta?: string | null
          stato?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicazioni_destinatari_comunicazione_id_fkey"
            columns: ["comunicazione_id"]
            isOneToOne: false
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
          max_atleti_contemporanei: number
          max_atleti_per_istruttore: number
          min_atleti_attivazione_corso: number
          min_iscritti_attivazione_corso: number | null
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
          min_iscritti_attivazione_corso?: number | null
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
          min_iscritti_attivazione_corso?: number | null
          ora_apertura_default?: string
          ora_chiusura_default?: string
          stagione_id?: string | null
        }
        Relationships: []
      }
      corsi: {
        Row: {
          attivo: boolean | null
          categoria: string | null
          club_id: string
          costo_annuale: number | null
          costo_mensile: number | null
          created_at: string
          giorno: string | null
          id: string
          livello_richiesto: string | null
          nome: string
          note: string | null
          ora_fine: string | null
          ora_inizio: string | null
          stagione_id: string | null
          tipo: string | null
          usa_ghiaccio: boolean
        }
        Insert: {
          attivo?: boolean | null
          categoria?: string | null
          club_id: string
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          giorno?: string | null
          id?: string
          livello_richiesto?: string | null
          nome?: string
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stagione_id?: string | null
          tipo?: string | null
          usa_ghiaccio?: boolean
        }
        Update: {
          attivo?: boolean | null
          categoria?: string | null
          club_id?: string
          costo_annuale?: number | null
          costo_mensile?: number | null
          created_at?: string
          giorno?: string | null
          id?: string
          livello_richiesto?: string | null
          nome?: string
          note?: string | null
          ora_fine?: string | null
          ora_inizio?: string | null
          stagione_id?: string | null
          tipo?: string | null
          usa_ghiaccio?: boolean
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
      device_tokens: {
        Row: {
          atleta_id: string | null
          attivo: boolean
          creato_at: string
          id: string
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
          stagione_id?: string | null
          tipo?: string
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
          atleta_id: string | null
          club_id: string
          created_at: string
          data_scadenza: string | null
          descrizione: string | null
          id: string
          importo: number | null
          pagata: boolean | null
        }
        Insert: {
          atleta_id?: string | null
          club_id: string
          created_at?: string
          data_scadenza?: string | null
          descrizione?: string | null
          id?: string
          importo?: number | null
          pagata?: boolean | null
        }
        Update: {
          atleta_id?: string | null
          club_id?: string
          created_at?: string
          data_scadenza?: string | null
          descrizione?: string | null
          id?: string
          importo?: number | null
          pagata?: boolean | null
        }
        Relationships: []
      }
      gare_calendario: {
        Row: {
          club_id: string
          created_at: string
          data: string | null
          id: string
          livello_minimo: string | null
          luogo: string | null
          nome: string
          note: string | null
          stagione_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          data?: string | null
          id?: string
          livello_minimo?: string | null
          luogo?: string | null
          nome?: string
          note?: string | null
          stagione_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          data?: string | null
          id?: string
          livello_minimo?: string | null
          luogo?: string | null
          nome?: string
          note?: string | null
          stagione_id?: string | null
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
      iscrizioni_gare: {
        Row: {
          atleta_id: string
          carriera: string | null
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
        Relationships: []
      }
      istruttori: {
        Row: {
          attivo: boolean | null
          club_id: string
          cognome: string
          colore: string | null
          costo_minuto_lezione_privata: number | null
          created_at: string
          email: string | null
          id: string
          nome: string
          note: string | null
          specialita: string | null
          telefono: string | null
        }
        Insert: {
          attivo?: boolean | null
          club_id: string
          cognome?: string
          colore?: string | null
          costo_minuto_lezione_privata?: number | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          specialita?: string | null
          telefono?: string | null
        }
        Update: {
          attivo?: boolean | null
          club_id?: string
          cognome?: string
          colore?: string | null
          costo_minuto_lezione_privata?: number | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          note?: string | null
          specialita?: string | null
          telefono?: string | null
        }
        Relationships: []
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
          ricorrente?: boolean
        }
        Relationships: []
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
            foreignKeyName: "lezioni_private_atlete_lezione_id_fkey"
            columns: ["lezione_id"]
            isOneToOne: false
            referencedRelation: "lezioni_private"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      setup_club: {
        Row: {
          banca: string | null
          club_id: string
          created_at: string
          data_fine_stagione: string | null
          data_inizio_stagione: string | null
          iban: string | null
          id: string
          indirizzo_banca: string | null
          intestatario_conto: string | null
          max_atlete_lezione_condivisa: number | null
          max_lezioni_private_contemporanee: number | null
          slot_lezione_privata_minuti: number | null
          twint_paylink: string | null
        }
        Insert: {
          banca?: string | null
          club_id: string
          created_at?: string
          data_fine_stagione?: string | null
          data_inizio_stagione?: string | null
          iban?: string | null
          id?: string
          indirizzo_banca?: string | null
          intestatario_conto?: string | null
          max_atlete_lezione_condivisa?: number | null
          max_lezioni_private_contemporanee?: number | null
          slot_lezione_privata_minuti?: number | null
          twint_paylink?: string | null
        }
        Update: {
          banca?: string | null
          club_id?: string
          created_at?: string
          data_fine_stagione?: string | null
          data_inizio_stagione?: string | null
          iban?: string | null
          id?: string
          indirizzo_banca?: string | null
          intestatario_conto?: string | null
          max_atlete_lezione_condivisa?: number | null
          max_lezioni_private_contemporanee?: number | null
          slot_lezione_privata_minuti?: number | null
          twint_paylink?: string | null
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
        Relationships: []
      }
      test_livello: {
        Row: {
          club_id: string
          created_at: string
          data: string | null
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
          created_at?: string
          data?: string | null
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
          created_at?: string
          data?: string | null
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
        Relationships: []
      }
      test_livello_atleti: {
        Row: {
          atleta_id: string
          created_at: string
          esito: string
          id: string
          note_istruttore: string | null
          test_id: string
        }
        Insert: {
          atleta_id: string
          created_at?: string
          esito?: string
          id?: string
          note_istruttore?: string | null
          test_id: string
        }
        Update: {
          atleta_id?: string
          created_at?: string
          esito?: string
          id?: string
          note_istruttore?: string | null
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
            foreignKeyName: "test_livello_atleti_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "test_livello"
            referencedColumns: ["id"]
          },
        ]
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
