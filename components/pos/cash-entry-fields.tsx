'use client';
import {useState} from 'react';
import {CASH_CATEGORIES} from '@/lib/pos/g6-cash';
import styles from '@/app/kasir/pesanan/orders.module.css';

export default function CashEntryFields({role}:{role:'owner'|'cashier'}){
 const [category,setCategory]=useState('PACKAGING'),[direction,setDirection]=useState('OUT');
 const drawerMovement=category==='CASH_TRANSFER';
 return <>
  <label>Jenis<select name="direction" value={direction} onChange={e=>setDirection(e.target.value)}>{role==='owner'&&<option value="IN">Kas masuk</option>}<option value="OUT">Kas keluar</option></select></label>
  <label>Nominal (Rp)<input name="amountIdr" required inputMode="numeric" pattern="[1-9][0-9]*" maxLength={10}/></label>
  <label htmlFor="cash-category">Kategori</label><select id="cash-category" name="categoryCode" required value={category} onChange={e=>setCategory(e.target.value)}>{CASH_CATEGORIES.filter(c=>role==='owner'||c.classification==='EXPENSE').map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select>
  <p className={styles.muted}>Pengeluaran memakai Kas keluar.{role==='owner'?' Modal dan perpindahan uang laci hanya dapat dicatat Owner.':''}</p>
  {drawerMovement&&<><label>{direction==='IN'?'Sumber dana':'Tujuan dana'}<input name="counterparty" required minLength={3} maxLength={100} autoComplete="off" placeholder="Contoh: rekening tujuan atau laci asal"/></label>
   <p className={styles.muted}>Ini hanya mencatat uang masuk/keluar laci. Saldo rekening dan pasangan transfer tidak dikelola atau direkonsiliasi di sini.</p></>}
  <label>Catatan (opsional)<input name="note" maxLength={drawerMovement?160:300} placeholder="Rincian transaksi"/></label>
 </>;
}
