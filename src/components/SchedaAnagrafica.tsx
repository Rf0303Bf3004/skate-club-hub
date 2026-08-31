import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { use_club, use_setup_club, use_stagioni } from '@/hooks/use-supabase-data';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, QrCode, Copy, Check, Send } from 'lucide-react';
import { build_contratto } from '@/lib/contratto-adesione';
import { use_app_store_links } from '@/hooks/use-app-store-links';
import { use_qr_data_url } from '@/hooks/use-qr-data-url';
import FotoAtleta from "@/components/common/FotoAtleta";

interface SchedaProps { atleta: any; on_back: () => void; modo?: 'foto' | 'iscrizione'; }

/** Rende una stringa con separatore " · " su più righe */
const multiline = (testo: string) =>
  testo.split(' · ').map((riga, i, arr) => (
    <React.Fragment key={i}>
      {riga}
      {i < arr.length - 1 ? <br /> : null}
    </React.Fragment>
  ));

const SchedaAnagrafica: React.FC<SchedaProps> = ({ atleta, on_back, modo = 'foto' }) => {
  const { t } = useTranslation('atleti');
  const { data: club } = use_club();
  const { data: setup } = use_setup_club();
  const { data: stagioni = [] } = use_stagioni();
  const stagione_attiva = (stagioni as any[]).find((s: any) => s.attiva);
  const codice = atleta.codice_atleta || (atleta.cognome + atleta.nome + '0001').toUpperCase().replace(/\s/g, '').slice(0, 16);
  const e_iscrizione = modo === 'iscrizione';
  const url_foto = 'https://app.icearena.ch/' + (e_iscrizione ? 'iscrizione/' : 'carica-foto/') + encodeURIComponent(codice);
  const { ios_store_url, android_store_url } = use_app_store_links();
  const url_app_store = ios_store_url || android_store_url;
  const qr_src = use_qr_data_url(url_foto, 200);
  const qr_store = use_qr_data_url(url_app_store, 200);
  const [copiato, set_copiato] = useState(false);

  const articoli = useMemo(() => build_contratto({
    club_nome: (club as any)?.nome,
    club_citta: (club as any)?.citta,
    club_cantone: (club as any)?.cantone,
    club_paese: (club as any)?.paese,
    stagione_nome: stagione_attiva?.nome,
    stagione_data_inizio: stagione_attiva?.data_inizio,
    stagione_data_fine: stagione_attiva?.data_fine,
    clausole_contratto: (setup as any)?.clausole_contratto,
  }), [club, setup, stagione_attiva]);

  const copia_link = async () => {
    try {
      await navigator.clipboard.writeText(url_foto);
      set_copiato(true);
      setTimeout(() => set_copiato(false), 2000);
    } catch {
      set_copiato(false);
    }
  };


  const url_whatsapp = 'https://wa.me/?text=' + encodeURIComponent(
    t(e_iscrizione ? 'anagrafica.whatsapp_message_iscrizione' : 'anagrafica.whatsapp_message_foto', {
      nome: atleta.nome,
      cognome: atleta.cognome,
      codice,
      url: url_foto,
    })
  );

  return (
    <div className='space-y-4 animate-fade-in'>
      <div className='flex items-center gap-3 print:hidden'>
        <Button variant='ghost' size='sm' onClick={on_back}><ArrowLeft className='w-4 h-4 mr-1' /> {t('anagrafica.back')}</Button>
        <Button variant='outline' size='sm' onClick={() => window.open(url_whatsapp, '_blank')} className='ml-auto'>
          <Send className='w-4 h-4 mr-2' /> {t('anagrafica.send_whatsapp')}
        </Button>
        <Button size='sm' onClick={() => window.print()}><Printer className='w-4 h-4 mr-2' /> {t('anagrafica.print')}</Button>
      </div>


      <div id='scheda' className='bg-white rounded-2xl overflow-hidden border border-gray-200 max-w-2xl mx-auto print:max-w-full print:border-0 print:rounded-none'>
        <div style={{background:'#1a1a2e'}} className='px-6 py-4 flex items-center gap-4'>
          <div style={{background:'#818cf8'}} className='w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0'>C</div>
          <div>
            <p className='text-white font-semibold text-base'>{club?.nome || t('anagrafica.club_fallback')}</p>
            <p style={{color:'rgba(255,255,255,0.5)'}} className='text-xs'>{e_iscrizione ? t('anagrafica.subtitle_iscrizione') : t('anagrafica.subtitle_scheda')}</p>
          </div>
          <span style={{background:'rgba(129,140,248,0.2)',color:'#818cf8'}} className='ml-auto text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider'>{atleta.stato === 'attivo' ? t('anagrafica.status_active') : t('anagrafica.status_inactive')}</span>
        </div>

        <div className='grid grid-cols-3 divide-x divide-gray-100'>
          <div className='col-span-2 p-6 space-y-5'>
            <div className='flex items-center gap-4'>
              <FotoAtleta foto_path={atleta.foto_path} nome={atleta.nome} cognome={atleta.cognome} className='w-16 h-16 rounded-full border-2 border-indigo-100' fallback={<div className='w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl'>{atleta.nome?.[0]}{atleta.cognome?.[0]}</div>} />
              <div>
                <p className='text-xl font-semibold text-gray-900'>{atleta.nome} {atleta.cognome}</p>
                <p className='text-sm text-gray-500 mt-0.5'>{t('anagrafica.born_on')} {atleta.data_nascita ? new Date(atleta.data_nascita).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</p>
                <span className='inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700'>{atleta.percorso_amatori || atleta.carriera_artistica || '—'}</span>
              </div>
            </div>

            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>{t('anagrafica.personal_data')}</p>
              <div className='grid grid-cols-2 gap-2'>
                {[[t('anagrafica.birth_place'), atleta.luogo_nascita],[t('anagrafica.address'), atleta.indirizzo],[t('anagrafica.phone'), atleta.telefono]].map(([l,v]) => (
                  <div key={l as string} className='bg-gray-50 rounded-lg px-3 py-2'>
                    <p className='text-xs text-gray-400'>{l}</p>
                    <p className='text-sm font-medium text-gray-800'>{v || <span className='text-gray-300 italic'>—</span>}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>{t('anagrafica.parent_guardian')}</p>
              <div className='grid grid-cols-2 gap-2'>
                {[[t('anagrafica.name'), atleta.genitore1_nome ? atleta.genitore1_nome + ' ' + atleta.genitore1_cognome : null],[t('anagrafica.email'), atleta.genitore1_email],[t('anagrafica.phone'), atleta.genitore1_telefono]].map(([l,v]) => (
                  <div key={l as string} className='bg-gray-50 rounded-lg px-3 py-2'>
                    <p className='text-xs text-gray-400'>{l}</p>
                    <p className='text-sm font-medium text-gray-800'>{v || <span className='text-gray-300 italic'>—</span>}</p>
                  </div>
                ))}
              </div>
            </div>

            {(atleta.carriera_artistica || atleta.carriera_stile) && atleta.licenza_sis_numero && (
              <div>
                <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>{t('anagrafica.license_title')}</p>
                <div className='grid grid-cols-2 gap-2'>
                  {[[t('anagrafica.license_number'), atleta.licenza_sis_numero],[t('anagrafica.license_category'), atleta.licenza_sis_categoria],[t('anagrafica.license_discipline'), atleta.licenza_sis_disciplina],[t('anagrafica.license_validity'), atleta.licenza_sis_validita_a ? t('anagrafica.license_until', { data: new Date(atleta.licenza_sis_validita_a).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) }) : null]].map(([l,v]) => (
                    <div key={l as string} className='bg-blue-50 rounded-lg px-3 py-2 border border-blue-100'>
                      <p className='text-xs text-blue-400'>{l}</p>
                      <p className='text-sm font-medium text-blue-800'>{v || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {atleta.tag_nfc && (
              <div className='flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2'>
                <div className='w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0'>
                  <QrCode className='w-4 h-4 text-green-700' />
                </div>
                <div>
                  <p className='text-xs text-green-600 font-medium'>{t('anagrafica.nfc_tag')}</p>
                  <p className='text-sm font-bold text-green-800 font-mono'>{atleta.tag_nfc}</p>
                </div>
              </div>
            )}
          </div>

          <div className='p-5 flex flex-col items-center gap-4'>
            {e_iscrizione && (
              <div className='text-center w-full border-b border-gray-100 pb-4'>
                <p className='text-xs font-bold text-gray-500 uppercase tracking-widest mb-3'>{t('anagrafica.step_app')}</p>
                {url_app_store && qr_store ? (
                  <>
                    <img src={qr_store} alt={t('anagrafica.qr_store_alt')} className='w-24 h-24 rounded-xl border border-gray-200 mx-auto' />
                    <p className='text-xs text-gray-500 mt-2 leading-snug'>{t('anagrafica.store_hint')}</p>
                    <p className='text-xs text-gray-400 mt-1 break-all'>{url_app_store}</p>
                  </>
                ) : (
                  <div className='w-24 h-24 rounded-xl border border-dashed border-gray-300 mx-auto flex items-center justify-center px-2 text-center text-[10px] text-gray-400'>
                    {t('codice_card.link_unavailable')}
                  </div>
                )}
              </div>
            )}
            <div className='text-center'>
              <p className='text-xs font-bold text-gray-500 uppercase tracking-widest mb-3'>{e_iscrizione ? t('anagrafica.step_iscrizione') : t('anagrafica.step_foto')}</p>
              {qr_src ? <img src={qr_src} alt={e_iscrizione ? t('anagrafica.qr_iscrizione_alt') : t('anagrafica.qr_foto_alt')} className='w-28 h-28 rounded-xl border border-gray-200' /> : <div className='w-28 h-28 bg-gray-100 rounded-xl animate-pulse' />}
              <p className='text-xs text-gray-500 mt-2 leading-snug'>{e_iscrizione ? t('anagrafica.hint_iscrizione') : t('anagrafica.hint_foto')}</p>
              <a href={url_foto} target='_blank' rel='noopener noreferrer' className='block text-xs text-indigo-600 underline font-medium mt-2 break-all select-all leading-snug'>{url_foto}</a>
              <button type='button' onClick={copia_link} className='print:hidden mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'>
                {copiato ? <Check className='w-3.5 h-3.5' /> : <Copy className='w-3.5 h-3.5' />}
                {copiato ? t('anagrafica.copied') : t('anagrafica.copy_link')}
              </button>
              <p className='text-xs text-gray-400 mt-2 font-mono whitespace-nowrap'>{t('anagrafica.athlete_code')} <span className='font-bold text-gray-600 tracking-tight select-all'>{codice}</span></p>
              <p className='text-xs text-green-600 font-medium mt-1'>{t('anagrafica.no_login')}</p>
            </div>

            <div className='w-full border-t border-gray-100 pt-3 space-y-2'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest text-center'>{t('anagrafica.photo_requirements')}</p>
              <div className='bg-amber-50 border border-amber-200 rounded-lg p-2 text-center'>
                <p className='text-xs text-amber-700 font-medium leading-snug'>{multiline(t('anagrafica.photo_rules'))}</p>
              </div>
            </div>

            <div className='w-full space-y-1 text-center'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest'>{t('anagrafica.how_to')}</p>
              <p className='text-xs text-gray-500 leading-snug'>{multiline(t(e_iscrizione ? 'anagrafica.how_to_iscrizione' : 'anagrafica.how_to_foto'))}</p>
              <p className='text-xs text-gray-500 leading-snug pt-1'>{t('anagrafica.cannot_scan')}</p>
            </div>

          </div>
        </div>

        {e_iscrizione && (
          <div className='px-6 py-4 border-t border-gray-100 space-y-2'>
            <p className='text-xs font-bold text-gray-500 uppercase tracking-widest'>{t('anagrafica.contract_title')}</p>
            <div className='space-y-1.5'>
              {articoli.map((a) => (
                <div key={a.numero}>
                  <p className='text-[10px] font-bold text-gray-700'>{t('anagrafica.contract_article', { numero: a.numero, titolo: a.titolo })}</p>
                  <p className='text-[10px] text-gray-500 leading-snug whitespace-pre-line'>{a.testo}</p>
                </div>
              ))}
            </div>
            <p className='text-[10px] text-gray-400 pt-2'>{t('anagrafica.contract_note')}</p>
          </div>
        )}

        <div className='px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between'>
          <p className='text-xs text-gray-400'><span className='inline-block w-2 h-2 bg-green-500 rounded-full mr-1'></span>{stagione_attiva?.nome ? t('anagrafica.card_valid_season', { stagione: stagione_attiva.nome }) : t('anagrafica.card_valid')}</p>
          <p className='text-xs text-gray-400'>{t('anagrafica.generated_on', { data: new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) })}</p>
        </div>
      </div>
    </div>
  );
};

export default SchedaAnagrafica;
