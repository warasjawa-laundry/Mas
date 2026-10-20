export const site = {
  name: "Mas Jawa Laundry",
  baseUrl: "https://masjawalaundry.web.id",
  whatsappNumber: "6282313359989",
  shortAddress: "Kandang Jati Kulon, Probolinggo",
  address: "Jl. Raya Kandang Jati Kulon RT.06 RW.01",
  landmark: "Depan Masjid Al-Hidayah",
  hours: "07.00–20.00 WIB",
  instagram: "https://www.instagram.com/masjawalaundry",
  tiktok: "https://www.tiktok.com/@masjawalaundry",
} as const;

export const assets = {
  logo: "https://raw.githubusercontent.com/warasjawa-laundry/Web-asset/f259a9e48d3a52552e97d5540546f359ca16631f/IMG-20251228-WA0010.jpg",
  packing: "https://raw.githubusercontent.com/warasjawa-laundry/Web-asset/f259a9e48d3a52552e97d5540546f359ca16631f/IMG-20251228-WA0007.jpg",
  workspace: "https://raw.githubusercontent.com/warasjawa-laundry/Web-asset/f259a9e48d3a52552e97d5540546f359ca16631f/IMG-20251228-WA0005.jpg",
  og: "https://raw.githubusercontent.com/warasjawa-laundry/Web-asset/f259a9e48d3a52552e97d5540546f359ca16631f/IMG-20251228-WA0011.jpg",
} as const;

export function whatsappLink(message?: string): string {
  return "https://wa.me/" + site.whatsappNumber + (message ? "?text=" + encodeURIComponent(message) : "");
}

export const kiloPackages = [
  { name: "Reguler", duration: "1–3 hari", items: [
    { label: "Cuci lipat", price: "Rp3.000/kg" },
    { label: "Cuci setrika", price: "Rp5.000/kg" },
  ] },
  { name: "Express", duration: "1–2 hari", items: [
    { label: "Cuci lipat", price: "Rp5.000/kg" },
    { label: "Cuci setrika", price: "Rp7.000/kg" },
  ] },
  { name: "Kilat", duration: "6 jam", items: [
    { label: "Cuci lipat", price: "Rp7.000/kg" },
    { label: "Cuci setrika", price: "Rp10.000/kg" },
  ] },
] as const;

// Published curtain-service tariffs.
export const curtainPrices = [
  { label: "Gorden tebal", price: "Rp4.500/meter" },
  { label: "Gorden tipis", price: "Rp3.500/meter" },
] as const;
