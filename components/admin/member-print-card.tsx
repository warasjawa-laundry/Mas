type Props = { name: string; number: string; qrSvg: string; logoUrl: string };

/** Print dimensions and QR quiet zone are maintained by the card stylesheet. */
export default function MemberPrintCard({name, number, qrSvg, logoUrl}: Props) {
  const nameSize = name.length > 64 ? "mj-card-name-small" : name.length > 32 ? "mj-card-name-medium" : "";
  return <div className="mj-card-preview">
    <div className="mj-card" aria-label="Kartu member Mas Jawa Laundry">
      <div className="mj-card-info">
        <div className="mj-card-heading">
          <img src={logoUrl} width={28} height={28} alt="" loading="eager" />
          <span>Mas Jawa<strong>Laundry</strong></span>
        </div>
        <div className="mj-card-bottom">
          <small>KARTU MEMBER</small>
          <strong className={nameSize}>{name}</strong>
          <span>{number}</span>
        </div>
        <p className="mj-card-instruction">Tunjukkan kartu saat transaksi.</p>
      </div>
      <div className="mj-card-code">
        <div className="mj-card-qr" dangerouslySetInnerHTML={{__html:qrSvg}} />
        <span>Scan untuk melihat catatan</span>
      </div>
    </div>
  </div>;
}
