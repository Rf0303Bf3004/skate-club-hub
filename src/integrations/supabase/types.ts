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
            foreignKeyName: "adesioni_atleta_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
          agonista: boolean
          atleta_federazione: boolean | null
          attivo: boolean | null
          attivo_come_monitore: boolean | null
          carriera_artistica: string | null
          carriera_stile: string | null
          categoria: string
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
          portal_token: string | null
          ruolo_pista: string | null
          tag_nfc: string | null
          telefono: string | null
        }
        Insert: {
          agonista?: boolean
          atleta_federazione?: boolean | null
          attivo?: boolean | null
          attivo_come_monitore?: boolean | null
          carriera_artistica?: string | null
          carriera_stile?: string | null
          categoria?: string
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
          portal_token?: string | null
          ruolo_pista?: string | null
          tag_nfc?: string | null
          telefono?: string | null
        }
        Update: {
          agonista?: boolean
          atleta_federazione?: boolean | null
          attivo?: boolean | null
          attivo_come_monitore?: boolean | null
          carriera_artistica?: string | null
          carriera_stile?: string | null
          categoria?: string
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
          portal_token?: string | null
          ruolo_pista?: string | null
          tag_nfc?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atleti_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "catalogo_pacchetti_opzionali_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          cap: string | null
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
          cap?: string | null
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
          cap?: string | null
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
        Relationships: [
          {
            foreignKeyName: "comunicazioni_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
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
            foreignKeyName: "comunicazioni_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "comunicazioni_destinatari_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
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
          max_atleti_lezione_privata: number
          max_atleti_per_istruttore: number
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
          max_atleti_contemporanei?: number
          max_atleti_lezione_privata?: number
          max_atleti_per_istruttore?: number
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
          max_atleti_contemporanei?: number
          max_atleti_lezione_privata?: number
          max_atleti_per_istruttore?: number
          min_atleti_attivazione_corso?: number
          min_iscritti_attivazione_corso?: number | null
          modalita_costo_privata?: string
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
          percorso: string | null
          richiede_approvazione: boolean
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
          percorso?: string | null
          richiede_approvazione?: boolean
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
          percorso?: string | null
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
            foreignKeyName: "corsi_livello_richiesto_fkey"
            columns: ["livello_richiesto"]
            isOneToOne: false
            referencedRelation: "livelli"
            referencedColumns: ["nome"]
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
          stagione_id: string | null
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
          stagione_id?: string | null
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
          stagione_id?: string | null
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
          data_emissione: string | null
          data_pagamento: string | null
          data_scadenza: string | null
          descrizione: string | null
          email_inviata_at: string | null
          id: string
          importo: number | null
          note: string | null
          numero: string | null
          pagata: boolean | null
          periodo: string | null
          riferimento_id: string | null
          stato: string | null
          tipo: string | null
        }
        Insert: {
          atleta_id?: string | null
          club_id: string
          created_at?: string
          data_emissione?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          email_inviata_at?: string | null
          id?: string
          importo?: number | null
          note?: string | null
          numero?: string | null
          pagata?: boolean | null
          periodo?: string | null
          riferimento_id?: string | null
          stato?: string | null
          tipo?: string | null
        }
        Update: {
          atleta_id?: string | null
          club_id?: string
          created_at?: string
          data_emissione?: string | null
          data_pagamento?: string | null
          data_scadenza?: string | null
          descrizione?: string | null
          email_inviata_at?: string | null
          id?: string
          importo?: number | null
          note?: string | null
          numero?: string | null
          pagata?: boolean | null
          periodo?: string | null
          riferimento_id?: string | null
          stato?: string | null
          tipo?: string | null
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
            foreignKeyName: "fatture_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
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
            foreignKeyName: "gare_calendario_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "inviti_genitori_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inviti_genitori_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "iscrizioni_corsi_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iscrizioni_corsi_corso_id_fkey"
            columns: ["corso_id"]
            isOneToOne: false
            referencedRelation: "corsi"
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
            foreignKeyName: "iscrizioni_gare_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
            referencedColumns: ["id"]
          },
        ]
      }
      iscrizioni_pacchetti: {
        Row: {
          atleta_id: string
          attiva: boolean
          created_at: string
          id: string
          note: string | null
          numero_sessioni: number | null
          pacchetto_id: string
        }
        Insert: {
          atleta_id: string
          attiva?: boolean
          created_at?: string
          id?: string
          note?: string | null
          numero_sessioni?: number | null
          pacchetto_id: string
        }
        Update: {
          atleta_id?: string
          attiva?: boolean
          created_at?: string
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
            foreignKeyName: "iscrizioni_pacchetti_pacchetto_id_fkey"
            columns: ["pacchetto_id"]
            isOneToOne: false
            referencedRelation: "catalogo_pacchetti_opzionali"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "istruttori_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
            foreignKeyName: "lezioni_private_atlete_lezione_id_fkey"
            columns: ["lezione_id"]
            isOneToOne: false
            referencedRelation: "lezioni_private"
            referencedColumns: ["id"]
          },
        ]
      }
      livelli: {
        Row: {
          attivo: boolean
          created_at: string
          fase: string
          id: number
          nome: string
          ordine: number
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          fase: string
          id?: number
          nome: string
          ordine: number
        }
        Update: {
          attivo?: boolean
          created_at?: string
          fase?: string
          id?: number
          nome?: string
          ordine?: number
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
        Relationships: [
          {
            foreignKeyName: "risultati_gara_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risultati_gara_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
            referencedColumns: ["id"]
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
          banca: string | null
          club_id: string
          created_at: string
          data_fine_stagione: string | null
          data_inizio_stagione: string | null
          fatturazione_costo_test: number | null
          fatturazione_giorno_mese: number | null
          fatturazione_invio_email_auto: boolean | null
          iban: string | null
          id: string
          indirizzo_banca: string | null
          intestatario_conto: string | null
          max_atlete_lezione_condivisa: number | null
          max_lezioni_private_contemporanee: number | null
          medagliere_punti: Json | null
          slot_lezione_privata_minuti: number | null
          twint_paylink: string | null
        }
        Insert: {
          banca?: string | null
          club_id: string
          created_at?: string
          data_fine_stagione?: string | null
          data_inizio_stagione?: string | null
          fatturazione_costo_test?: number | null
          fatturazione_giorno_mese?: number | null
          fatturazione_invio_email_auto?: boolean | null
          iban?: string | null
          id?: string
          indirizzo_banca?: string | null
          intestatario_conto?: string | null
          max_atlete_lezione_condivisa?: number | null
          max_lezioni_private_contemporanee?: number | null
          medagliere_punti?: Json | null
          slot_lezione_privata_minuti?: number | null
          twint_paylink?: string | null
        }
        Update: {
          banca?: string | null
          club_id?: string
          created_at?: string
          data_fine_stagione?: string | null
          data_inizio_stagione?: string | null
          fatturazione_costo_test?: number | null
          fatturazione_giorno_mese?: number | null
          fatturazione_invio_email_auto?: boolean | null
          iban?: string | null
          id?: string
          indirizzo_banca?: string | null
          intestatario_conto?: string | null
          max_atlete_lezione_condivisa?: number | null
          max_lezioni_private_contemporanee?: number | null
          medagliere_punti?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "storico_livelli_atleta_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atleti"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "test_livello_gara_id_fkey"
            columns: ["gara_id"]
            isOneToOne: false
            referencedRelation: "gare_calendario"
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
      utenti_club: {
        Row: {
          attivo: boolean
          club_id: string | null
          cognome: string
          created_at: string
          id: string
          nome: string
          ruolo: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_mobile_parent: { Args: never; Returns: boolean }
      mobile_atleta_id: { Args: never; Returns: string }
      mobile_club_id: { Args: never; Returns: string }
      slot_liberi_istruttore: {
        Args: { p_data_a: string; p_data_da: string; p_istruttore_id: string }
        Returns: {
          data: string
          durata_minuti: number
          ora_fine: string
          ora_inizio: string
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
