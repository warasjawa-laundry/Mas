"use client";
export default function PrintCardButton() {
  return <button type="button" className="member-add" onClick={()=>window.print()}>Cetak Kartu</button>;
}
