import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, DEMO_CLUB_ID } from '@/lib/supabase';

export function use_upsert_atleta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        cognome: data.cognome,
        data_nascita: data.data_nascita,
        percorso_amatori: data.percorso_amatori || 'pulcini',
        carriera_artistica: data.carriera_artistica || null,
        carriera_stile: data.carriera_stile || null,
        atleta_federazione: data.atleta_federazione || false,
        ore_pista_stagione: data.ore_pista_stagione || 0,
        genitore1_nome: data.genitore1_nome || '',
        genitore1_cognome: data.genitore1_cognome || '',
        genitore1_telefono: data.genitore1_telefono || '',
        genitore1_email: data.genitore1_email || '',
        genitore2_nome: data.genitore2_nome || '',
        genitore2_cognome: data.genitore2_cognome || '',
        genitore2_telefono: data.genitore2_telefono || '',
        genitore2_email: data.genitore2_email || '',
        attivo: data.attivo !== false,
        note: data.note || '',
        disco_in_preparazione: data.disco_in_preparazione || null,
      };
      if (data.id) {
        const { error } = await supabase.from('atleti').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('atleti').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atleti'] }),
  });
}

export function use_upsert_istruttore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        cognome: data.cognome,
        email: data.email || '',
        telefono: data.telefono || '',
        costo_minuto_lezione_privata: data.costo_minuto_lezione_privata || 0,
        attivo: data.attivo !== false,
        note: data.note || '',
      };
      if (data.id) {
        const { error } = await supabase.from('istruttori').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('istruttori').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['istruttori'] }),
  });
}

export function use_upsert_corso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        tipo: data.tipo || '',
        giorno: data.giorno || 'lunedi',
        ora_inizio: data.ora_inizio || '08:00',
        ora_fine: data.ora_fine || '09:00',
        durata_minuti: data.durata_minuti || 60,
        costo_mensile: data.costo_mensile || 0,
        costo_annuale: data.costo_annuale || 0,
        attivo: data.attivo !== false,
        note: data.note || '',
        stagione_id: data.stagione_id || null,
      };
      let corso_id = data.id;
      if (data.id) {
        const { error } = await supabase.from('corsi').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('corsi').insert(payload).select('id').single();
        if (error) throw error;
        corso_id = inserted.id;
      }
      // Update istruttori
      if (data.istruttori_ids) {
        await supabase.from('corsi_istruttori').delete().eq('corso_id', corso_id);
        if (data.istruttori_ids.length > 0) {
          const rows = data.istruttori_ids.map((istruttore_id: string) => ({ corso_id, istruttore_id }));
          await supabase.from('corsi_istruttori').insert(rows);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['corsi'] }),
  });
}

export function use_upsert_gara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        data: data.data,
        ora: data.ora || '09:00',
        club_ospitante: data.club_ospitante || '',
        localita: data.localita || '',
        livello_minimo: data.livello_minimo || 'pulcini',
        carriera: data.carriera || '',
        costo_iscrizione: data.costo_iscrizione || 0,
        costo_accompagnamento: data.costo_accompagnamento || 0,
        note: data.note || '',
      };
      if (data.id) {
        const { error } = await supabase.from('gare_calendario').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('gare_calendario').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gare'] }),
  });
}

export function use_iscrivi_atleta_gara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { atleta_id: string; gara_id: string; carriera?: string; punteggio?: number; voto_giudici?: number; posizione?: number; medaglia?: string; costo_iscrizione?: number; costo_accompagnamento?: number }) => {
      const { error } = await supabase.from('iscrizioni_gare').insert({
        atleta_id: data.atleta_id,
        gara_id: data.gara_id,
        carriera: data.carriera || '',
        punteggio: data.punteggio || null,
        voto_giudici: data.voto_giudici || null,
        posizione: data.posizione || null,
        medaglia: data.medaglia || null,
        costo_iscrizione: data.costo_iscrizione || 0,
        costo_accompagnamento: data.costo_accompagnamento || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gare'] }),
  });
}

export function use_crea_lezione_privata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const { data: lezione, error } = await supabase.from('lezioni_private').insert({
        club_id: DEMO_CLUB_ID,
        istruttore_id: data.istruttore_id,
        data: data.data,
        ora_inizio: data.ora_inizio,
        ora_fine: data.ora_fine,
        durata_minuti: data.durata_minuti || 20,
        ricorrente: data.ricorrente || false,
        condivisa: (data.atleti_ids?.length || 0) > 1,
        costo_totale: data.costo_totale || 0,
        annullata: false,
        note: data.note || '',
      }).select('id').single();
      if (error) throw error;
      if (data.atleti_ids?.length > 0) {
        const quota = (data.costo_totale || 0) / data.atleti_ids.length;
        const rows = data.atleti_ids.map((atleta_id: string) => ({
          lezione_id: lezione.id,
          atleta_id,
          quota_costo: quota,
        }));
        await supabase.from('lezioni_private_atlete').insert(rows);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lezioni_private'] }),
  });
}

export function use_segna_fattura_pagata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fatture').update({
        pagata: true,
        data_pagamento: new Date().toISOString().split('T')[0],
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fatture'] }),
  });
}

export function use_genera_fatture_mensili() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Get active courses with enrollments
      const { data: corsi } = await supabase.from('corsi').select('*').eq('club_id', DEMO_CLUB_ID).eq('attivo', true);
      const { data: iscrizioni } = await supabase.from('iscrizioni_corsi').select('*').eq('attiva', true);
      const { data: fatture_esistenti } = await supabase.from('fatture').select('numero').eq('club_id', DEMO_CLUB_ID).order('numero', { ascending: false }).limit(1);
      
      let next_num = 1;
      if (fatture_esistenti && fatture_esistenti.length > 0) {
        const match = fatture_esistenti[0].numero?.match(/(\d+)/);
        if (match) next_num = parseInt(match[1]) + 1;
      }

      const now = new Date();
      const scadenza = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const fatture_da_creare: any[] = [];

      for (const isc of (iscrizioni || [])) {
        const corso = (corsi || []).find(c => c.id === isc.corso_id);
        if (!corso) continue;
        fatture_da_creare.push({
          club_id: DEMO_CLUB_ID,
          atleta_id: isc.atleta_id,
          numero: `F-${String(next_num++).padStart(4, '0')}`,
          descrizione: `Corso ${corso.nome} - ${now.toLocaleString('it-CH', { month: 'long', year: 'numeric' })}`,
          importo: corso.costo_mensile || 0,
          data_emissione: now.toISOString().split('T')[0],
          data_scadenza: scadenza,
          pagata: false,
          tipo: 'corso',
          riferimento_id: corso.id,
        });
      }

      if (fatture_da_creare.length > 0) {
        const { error } = await supabase.from('fatture').insert(fatture_da_creare);
        if (error) throw error;
      }
      return fatture_da_creare.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fatture'] }),
  });
}

export function use_crea_comunicazione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('comunicazioni').insert({
        club_id: DEMO_CLUB_ID,
        titolo: data.titolo,
        testo: data.testo,
        tipo_destinatari: data.tipo_destinatari || 'tutti',
        corso_id: data.corso_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comunicazioni'] }),
  });
}

export function use_upsert_stagione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        tipo: data.tipo || 'regolare',
        data_inizio: data.data_inizio,
        data_fine: data.data_fine,
        attiva: data.attiva !== false,
      };
      if (data.id) {
        const { error } = await supabase.from('stagioni').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stagioni').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stagioni'] }),
  });
}

export function use_upsert_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        club_id: DEMO_CLUB_ID,
        nome: data.nome,
        data_inizio: data.data_inizio,
        data_fine: data.data_fine,
        luogo: data.luogo || '',
        club_ospitante: data.club_ospitante || '',
        costo_diurno: data.costo_diurno || 0,
        costo_completo: data.costo_completo || 0,
        note: data.note || '',
      };
      if (data.id) {
        const { error } = await supabase.from('campi_allenamento').update(payload).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campi_allenamento').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campi'] }),
  });
}

export function use_iscrivi_atleta_campo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { campo_id: string; atleta_id: string; tipo: string; costo_totale: number }) => {
      const { error } = await supabase.from('iscrizioni_campo').insert({
        campo_id: data.campo_id,
        atleta_id: data.atleta_id,
        tipo: data.tipo,
        costo_totale: data.costo_totale,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campi'] }),
  });
}
