import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const paths=["app/page.tsx","app/membership/page.tsx","components/site-header.tsx","components/site-footer.tsx","components/customer-card-scanner.tsx","app/k/[token]/page.tsx","app/layout.tsx","lib/site.ts"];
test("public text avoids em dashes, while valid time ranges remain",()=>{
 for(const p of paths)assert.doesNotMatch(read(p),/—/,p);
 assert.match(read("lib/site.ts"),/1–3 hari/);
 assert.match(read("lib/site.ts"),/07\.00–20\.00 WIB/);
});
test("headlines name the service instead of generic promises",()=>{
 const h=read("app/page.tsx"),m=read("app/membership/page.tsx");
 for(const expected of ["Daftar harga laundry","Cara menggunakan layanan","Kartu member"])assert.ok(h.includes(expected));
 assert.match(m,/Kartu member/);
 assert.match(read("app/k/[token]/page.tsx"),/Catatan Kartu Member/);
 for(const old of ["Pilih yang sesuai kebutuhan.","Informasi jelas, jadi lebih mudah menentukan layanan.","Kartu langganan, tanpa harus mengingat jumlah transaksi."])assert.ok(!h.includes(old));
});
test("copy keeps correct privacy, status and operational policies",()=>{
 const h=read("app/page.tsx"),m=read("app/membership/page.tsx"),sc=read("components/customer-card-scanner.tsx"),p=read("app/k/[token]/page.tsx");
 assert.match(h,/poin dan riwayat transaksi/);
 assert.match(h,/Konfirmasi biaya dan perkiraan waktu/);
 assert.doesNotMatch(h+m,/uji coba|sedang disiapkan|sedang menyiapkan|informasi sebelumnya|preview/i);
 assert.match(m,/Promo tidak diberikan otomatis/);
 assert.match(m,/hanya dikirim jika Anda setuju/);
 assert.match(m,/Nomor WhatsApp boleh dikosongkan/);
 assert.match(sc,/tidak dikirim ke server/);
 assert.match(sc,/bukan mencatat transaksi baru/);
 assert.match(read("components/member-progress-view.tsx"),/disesuaikan jika transaksi dibatalkan/);
 assert.match(m,/href="#scan-kartu"/);
 assert.match(m,/siteHref\("\/admin\/login"\)/);
});
