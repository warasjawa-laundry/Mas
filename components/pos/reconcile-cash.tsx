'use client';
import {useActionState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import type {CommandActionResult} from '@/lib/pos/command-recovery';
import styles from '@/app/kasir/pesanan/orders.module.css';
export default function ReconcileCash({expected,requestId,action,pilotTestOnly=true}:{expected:string;requestId:string;action:(form:FormData)=>Promise<CommandActionResult>;pilotTestOnly?:boolean}){
 const [state,submit,pending]=useActionState((_previous:CommandActionResult,form:FormData)=>action(form),{error:''});const router=useRouter();
 useEffect(()=>{if(state.confirmed)router.refresh()},[state.confirmed,router]);
 return <section className={styles.card}><h2>Cocokkan Kas</h2><p>{pilotTestOnly?'Mode Uji: gunakan hitungan simulasi, jangan cocokkan uang sungguhan dengan jurnal dummy.':'Hitung uang fisik.'} Selisih tersimpan untuk pemeriksaan Owner, tanpa mengubah uang atau menutup kas.</p>
 <form action={submit} className={styles.paymentForm}><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="expectedIdr" value={expected}/>
 <label>{pilotTestOnly?'Hitungan simulasi (Rp)':'Uang fisik (Rp)'}<input name="countedIdr" inputMode="numeric" required pattern="(0|[1-9][0-9]*)" maxLength={10}/></label><label>Catatan penghitungan<input name="reason" required minLength={3} maxLength={300}/></label>
 {state.error&&<p role="alert">{state.error}</p>}{state.confirmed&&<p role="status">Hasil penghitungan tersimpan. Jurnal tidak diubah.</p>}
 <button className={styles.mainButton} disabled={pending||state.confirmed}>{pending?'Menyimpan…':'Simpan hasil penghitungan'}</button>{state.confirmed&&<a className={styles.mainLink} href="/admin/kas">Catat penghitungan baru</a>}</form></section>;
}
