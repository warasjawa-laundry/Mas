export type CommandActionResult={error:string;confirmed?:boolean;redirectTo?:string};
export const commandUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type RecoverableOperation='CREATE_ORDER'|'PAYMENT'|'FULL_REFUND'|'CASH_ENTRY'|'CLOSE_SHIFT'|'OPEN_SHIFT'|'SET_WORK'|'CANCEL';

/** Scope contains identifiers only; the stored value is always just a request UUID. */
export function commandRecoveryKey(role:'owner'|'cashier',actorId:string,operation:RecoverableOperation,orderId?:string){
 return `mjl:pending:v1:${role}:${actorId}:${operation}${orderId?':'+orderId:''}`;
}
