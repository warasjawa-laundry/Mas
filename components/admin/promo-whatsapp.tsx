"use client";

import {useRef, useState} from "react";

type PromoWhatsappProps={
  promoId:string;
  memberName:string;
  title:string;
  terms:string|null;
  expiresAt:string|null;
  whatsappPhone:string|null;
  whatsappConsent:boolean;
  memberActive:boolean;
};

const validE164=(value:string|null):value is string=>
  typeof value==="string" && /^\+[1-9][0-9]{7,14}$/.test(value);

function dateWIB(value:string){
  return new Intl.DateTimeFormat("id-ID",{
    day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Jakarta"
  }).format(new Date(value));
}

export function promoMessage({memberName,title,terms,expiresAt}:Pick<PromoWhatsappProps,"memberName"|"title"|"terms"|"expiresAt">){
  const parts=[
    `Halo Kak ${memberName},`,
    "",
    "Ada promo khusus untuk Kakak dari Mas Jawa Laundry:",
    `*${title}*`,
  ];
  if(terms?.trim()) parts.push("",`Ketentuan: ${terms.trim()}`);
  if(expiresAt) parts.push("",`Berlaku sampai ${dateWIB(expiresAt)}.`);
  parts.push("","Jika ingin menggunakan promo ini, silakan hubungi kami atau datang ke Mas Jawa Laundry.","","Terima kasih!");
  return parts.join("\n");
}

export default function PromoWhatsapp(props:PromoWhatsappProps){
  const [message,setMessage]=useState(()=>promoMessage(props));
  const [feedback,setFeedback]=useState("");
  const inputRef=useRef<HTMLTextAreaElement>(null);
  const validPhone=validE164(props.whatsappPhone);
  const allowed=props.memberActive && validPhone && props.whatsappConsent;
  const digits=allowed && validE164(props.whatsappPhone) ? props.whatsappPhone.slice(1) : null;
  // This URL is only used for an owner-initiated click, never sent automatically.
  const waUrl=digits && message.trim()
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`
    : null;

  async function copyMessage(){
    if(!message.trim())return;
    try{
      if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setFeedback("Pesan disalin. Silakan periksa penerima sebelum mengirim.");
    }catch{
      inputRef.current?.focus();
      inputRef.current?.select();
      setFeedback("Pilih dan salin teks yang disorot secara manual.");
    }
  }

  return <div className="owner-wa-panel">
    <h3>Beritahu via WhatsApp</h3>
    <p>Pesan bisa diedit. Tidak akan terkirim otomatis.</p>
    <label htmlFor={`wa-message-${props.promoId}`}>
      Isi pesan untuk pelanggan
    </label>
    <textarea
      ref={inputRef}
      id={`wa-message-${props.promoId}`}
      rows={9}
      maxLength={2200}
      value={message}
      onChange={event=>{setMessage(event.target.value.slice(0,2200));setFeedback("");}}
    />
    <div className="owner-wa-actions">
      <button type="button" className="admin-logout" disabled={!message.trim()} onClick={()=>void copyMessage()}>
        Salin Pesan
      </button>
      {waUrl ?
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="member-add">
          Buka WhatsApp
        </a> :
        <button type="button" className="member-add" disabled aria-disabled="true">Buka WhatsApp</button>}
    </div>
    {!props.memberActive ?
      <p className="owner-wa-warning">Member tidak aktif. WhatsApp tidak dapat dibuka.</p> :
      !validPhone ?
      <p className="owner-wa-warning">Nomor WhatsApp belum tersedia atau tidak valid. Pesan tetap bisa disalin.</p> :
      !props.whatsappConsent ?
      <p className="owner-wa-warning">Persetujuan menerima promo WhatsApp belum tercatat. Jangan kirim promo tanpa persetujuan pelanggan.</p> :
      <p className="owner-wa-hint">WhatsApp membuka percakapan dan mengisi draf. Periksa isi pesan sebelum menekan Kirim.</p>}
    {feedback && <p className="owner-wa-feedback" role="status" aria-live="polite">{feedback}</p>}
  </div>;
}
