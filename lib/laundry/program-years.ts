/**
 * Date-based rules in WIB. Old ledgers remain browsable; only the current
 * and following year can be edited, and new years must be set up explicitly.
 */
export function currentProgramYear(now:Date = new Date()):number {
  return Number(new Intl.DateTimeFormat("en-US",{
    year:"numeric",timeZone:"Asia/Jakarta",
  }).format(now));
}

export function availableProgramYears(now:Date = new Date()):number[] {
  const current=currentProgramYear(now);
  return [...new Set([2026,2027,current,Math.min(current+1,2100)])]
    .filter(year=>year>=2026&&year<=2100).sort((a,b)=>a-b);
}

export function canEditProgramYear(year:number,now:Date=new Date()):boolean {
  const current=currentProgramYear(now);
  return Number.isSafeInteger(year)&&year>=2026&&year<=2100 &&
    year>=current&&year<=current+1;
}

export function canInitializeProgramYear(year:number,now:Date=new Date()):boolean {
  return year>=2027&&canEditProgramYear(year,now);
}
