import React, { useState } from 'react';
import { use_club } from '@/hooks/use-supabase-data';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, QrCode, Copy, Check } from 'lucide-react';

interface SchedaProps { atleta: any; on_back: () => void; }

const SchedaAnagrafica: React.FC<SchedaProps> = ({ atleta, on_back }) => {
  const { data: club } = use_club();
  const codice = atleta.codice_atleta || (atleta.cognome + atleta.nome + '0001').toUpperCase().replace(/\s/g, '').slice(0, 16);
  const url_foto = 'https://app.icearena.ch/carica-foto/' + encodeURIComponent(codice);
  const qr_src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(url_foto);
  const [copiato, set_copiato] = useState(false);

  const copia_link = async () => {
    try {
      await navigator.clipboard.writeText(url_foto);
      set_copiato(true);
      setTimeout(() => set_copiato(false), 2000);
    } catch {
      set_copiato(false);
    }
  };


  return (
    <div className='space-y-4 animate-fade-in'>
      <div className='flex items-center gap-3 print:hidden'>
        <Button variant='ghost' size='sm' onClick={on_back}><ArrowLeft className='w-4 h-4 mr-1' /> Indietro</Button>
        <Button size='sm' onClick={() => window.print()} className='ml-auto'><Printer className='w-4 h-4 mr-2' /> Stampa / Salva PDF</Button>
      </div>

      <div id='scheda' className='bg-white rounded-2xl overflow-hidden border border-gray-200 max-w-2xl mx-auto print:max-w-full print:border-0 print:rounded-none'>
        <div style={{background:'#1a1a2e'}} className='px-6 py-4 flex items-center gap-4'>
          <div style={{background:'#818cf8'}} className='w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0'>C</div>
          <div>
            <p className='text-white font-semibold text-base'>{club?.nome || 'Club'}</p>
            <p style={{color:'rgba(255,255,255,0.5)'}} className='text-xs'>Scheda anagrafica atleta</p>
          </div>
          <span style={{background:'rgba(129,140,248,0.2)',color:'#818cf8'}} className='ml-auto text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider'>{atleta.stato === 'attivo' ? 'Attivo' : 'Inattivo'}</span>
        </div>

        <div className='grid grid-cols-3 divide-x divide-gray-100'>
          <div className='col-span-2 p-6 space-y-5'>
            <div className='flex items-center gap-4'>
              {atleta.foto_url ? <img src={atleta.foto_url} className='w-16 h-16 rounded-full object-cover border-2 border-indigo-100' /> : <div className='w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl'>{atleta.nome?.[0]}{atleta.cognome?.[0]}</div>}
              <div>
                <p className='text-xl font-semibold text-gray-900'>{atleta.nome} {atleta.cognome}</p>
                <p className='text-sm text-gray-500 mt-0.5'>Nato/a il {atleta.data_nascita ? new Date(atleta.data_nascita).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</p>
                <span className='inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700'>{atleta.percorso_amatori || atleta.carriera_artistica || '—'}</span>
              </div>
            </div>

            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>Dati personali</p>
              <div className='grid grid-cols-2 gap-2'>
                {[['Luogo di nascita', atleta.luogo_nascita],['Indirizzo', atleta.indirizzo],['Telefono', atleta.telefono]].map(([l,v]) => (
                  <div key={l} className='bg-gray-50 rounded-lg px-3 py-2'>
                    <p className='text-xs text-gray-400'>{l}</p>
                    <p className='text-sm font-medium text-gray-800'>{v || <span className='text-gray-300 italic'>—</span>}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>Genitore / Tutore</p>
              <div className='grid grid-cols-2 gap-2'>
                {[['Nome', atleta.genitore1_nome ? atleta.genitore1_nome + ' ' + atleta.genitore1_cognome : null],['Email', atleta.genitore1_email],['Telefono', atleta.genitore1_telefono]].map(([l,v]) => (
                  <div key={l} className='bg-gray-50 rounded-lg px-3 py-2'>
                    <p className='text-xs text-gray-400'>{l}</p>
                    <p className='text-sm font-medium text-gray-800'>{v || <span className='text-gray-300 italic'>—</span>}</p>
                  </div>
                ))}
              </div>
            </div>

            {(atleta.carriera_artistica || atleta.carriera_stile) && atleta.licenza_sis_numero && (
              <div>
                <p className='text-xs font-bold text-gray-400 uppercase tracking-widest mb-2'>Licenza Swiss Ice Skating</p>
                <div className='grid grid-cols-2 gap-2'>
                  {[['N. Licenza', atleta.licenza_sis_numero],['Categoria', atleta.licenza_sis_categoria],['Disciplina', atleta.licenza_sis_disciplina],['Validita', atleta.licenza_sis_validita_a ? 'fino al ' + new Date(atleta.licenza_sis_validita_a).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null]].map(([l,v]) => (
                    <div key={l} className='bg-blue-50 rounded-lg px-3 py-2 border border-blue-100'>
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
                  <p className='text-xs text-green-600 font-medium'>Tag NFC</p>
                  <p className='text-sm font-bold text-green-800 font-mono'>{atleta.tag_nfc}</p>
                </div>
              </div>
            )}
          </div>

          <div className='p-5 flex flex-col items-center gap-4'>
            <div className='text-center'>
              <p className='text-xs font-bold text-gray-500 uppercase tracking-widest mb-3'>Foto profilo online</p>
              {qr_src ? <img src={qr_src} alt='QR per caricare la foto profilo' className='w-28 h-28 rounded-xl border border-gray-200' /> : <div className='w-28 h-28 bg-gray-100 rounded-xl animate-pulse' />}
              <p className='text-xs text-gray-500 mt-2 leading-snug'>Scansiona per caricare<br/>la foto dell atleta</p>
              <a href={url_foto} target='_blank' rel='noopener noreferrer' className='block text-xs text-indigo-600 underline font-medium mt-2 break-all select-all leading-snug'>{url_foto}</a>
              <button type='button' onClick={copia_link} className='print:hidden mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'>
                {copiato ? <Check className='w-3.5 h-3.5' /> : <Copy className='w-3.5 h-3.5' />}
                {copiato ? 'Copiato' : 'Copia link'}
              </button>
              <p className='text-xs text-gray-400 mt-2 font-mono break-all'>Codice atleta: {codice}</p>
              <p className='text-xs text-green-600 font-medium mt-1'>Nessun login richiesto</p>
            </div>

            <div className='w-full border-t border-gray-100 pt-3 space-y-2'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest text-center'>Requisiti foto</p>
              <div className='bg-amber-50 border border-amber-200 rounded-lg p-2 text-center'>
                <p className='text-xs text-amber-700 font-medium leading-snug'>Sfondo bianco<br/>Busto e viso<br/>JPG/PNG min 300px<br/>Max 2MB</p>
              </div>
            </div>

            <div className='w-full space-y-1 text-center'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-widest'>Come fare</p>
              <p className='text-xs text-gray-500 leading-snug'>1. Inquadra il QR col telefono<br/>2. Si apre la pagina dell atleta<br/>3. Scatta o scegli la foto<br/>4. Conferma il caricamento</p>
              <p className='text-xs text-gray-500 leading-snug pt-1'>Non riesci a scansionare? Apri il link qui sopra oppure copialo nel browser del telefono.</p>
            </div>

          </div>
        </div>

        <div className='px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between'>
          <p className='text-xs text-gray-400'><span className='inline-block w-2 h-2 bg-green-500 rounded-full mr-1'></span>Tessera valida · Stagione 2025/26</p>
          <p className='text-xs text-gray-400'>Generato il {new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })} · Ice Arena Manager</p>
        </div>
      </div>
    </div>
  );
};

export default SchedaAnagrafica;
