import type {QuantityUnit} from './money';

export function stepQuantity(value:string,unit:QuantityUnit,direction:1|-1,stepMilli=1000):string {
 if(![1,10,100,1000].includes(stepMilli))return value;
 const increment=unit==='pcs'?1000:stepMilli;
 if(value==='')return direction===1?String(increment/1000):'';
 const normalized=value.replace(',','.');
 const pattern=unit==='pcs'?/^(?:0|[1-9][0-9]*)$/:/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/;
 if(value.length>11||!pattern.test(normalized))return value;
 const [whole,fraction='']=normalized.split('.');
 const current=BigInt(whole)*BigInt(1000)+BigInt(fraction.padEnd(3,'0'));
 const next=current+BigInt(direction)*BigInt(increment);
 if(next<=BigInt(0))return '';
 if(next>BigInt(1000000000))return value;
 const remainder=(next%BigInt(1000)).toString().padStart(3,'0').replace(/0+$/,'');
 return (next/BigInt(1000)).toString()+(remainder?'.'+remainder:'');
}

export function canAdvanceOrderStep(step:number,customerValid:boolean,hasServices:boolean,hasQuote:boolean):boolean {
 if(step===0)return customerValid;
 if(step===1)return customerValid&&hasServices&&hasQuote;
 return false;
}
