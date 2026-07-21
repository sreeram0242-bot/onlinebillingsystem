/**
 * Thermal Printer utility using Web Serial API (ESC/POS)
 * Works with USB thermal printers (Xprinter, Rongta, Epson, etc.)
 */

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT:         [ESC, 0x40],
  ALIGN_LEFT:   [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  BOLD_ON:      [ESC, 0x45, 0x01],
  BOLD_OFF:     [ESC, 0x45, 0x00],
  DOUBLE_SIZE:  [GS, 0x21, 0x11],
  NORMAL_SIZE:  [GS, 0x21, 0x00],
  CUT:          [GS, 0x56, 0x42, 0x00],
  FEED_3:       [ESC, 0x64, 0x03],
};

function enc(text: string): Uint8Array { return new TextEncoder().encode(text); }
function b(...cmds: number[][]): Uint8Array { return new Uint8Array(cmds.flat()); }
function padEnd(s: string, len: number): string { return (s + " ".repeat(len)).substring(0, len); }
function padStart(s: string, len: number): string { return (" ".repeat(len) + s).slice(-len); }
function twoCol(left: string, right: string, w = 32): string {
  const maxL = w - right.length - 1;
  return padEnd(left.substring(0, maxL), maxL) + " " + right + "\n";
}

let _port: any = null;
let _writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

export async function connectPrinter(): Promise<boolean> {
  if (!("serial" in navigator)) throw new Error("Web Serial API not supported. Use Chrome or Edge.");
  try {
    _port = await (navigator as any).serial.requestPort();
    await _port!.open({ baudRate: 9600 });
    _writer = _port!.writable!.getWriter();
    return true;
  } catch (e: any) {
    if (e?.name === "NotFoundError") return false;
    throw e;
  }
}

export async function disconnectPrinter() {
  try { _writer?.releaseLock(); await _port?.close(); } catch { /* ignore */ }
  _writer = null; _port = null;
}

export function isPrinterConnected(): boolean {
  return !!_port;
}

async function writeAll(chunks: Uint8Array[]) {
  if (!_writer) throw new Error("Printer not connected");
  for (const c of chunks) await _writer.write(c);
}

export type PrintBillArgs = {
  hotelName: string;
  orderNo?: number;
  date: string;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  items: { name: string; price: number; qty: number; isFree?: boolean }[];
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  total: number;
  paymentMethod: string;
  splitCash?: number;
  splitGpay?: number;
  freeItemName?: string;
};

export async function printBill(bill: PrintBillArgs) {
  if (!_writer) throw new Error("Printer not connected");
  const W = 32;
  const c: Uint8Array[] = [];

  c.push(b(CMD.INIT));
  c.push(b(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_SIZE));
  c.push(enc(bill.hotelName.substring(0, 16) + "\n"));
  c.push(b(CMD.NORMAL_SIZE, CMD.BOLD_OFF));
  c.push(enc("--------------------------------\n"));

  c.push(b(CMD.ALIGN_LEFT));
  if (bill.orderNo) c.push(enc(`Bill No : #${bill.orderNo}\n`));
  c.push(enc(`Date    : ${bill.date}\n`));
  if (bill.tableName) c.push(enc(`Table   : ${bill.tableName}\n`));
  if (bill.customerName) c.push(enc(`Name    : ${bill.customerName}\n`));
  if (bill.customerPhone) c.push(enc(`Phone   : ${bill.customerPhone}\n`));
  c.push(enc("--------------------------------\n"));

  c.push(b(CMD.BOLD_ON));
  c.push(enc(padEnd("Item", 18) + padStart("Qty", 4) + padStart("Amt", 7) + " \n"));
  c.push(b(CMD.BOLD_OFF));
  c.push(enc("--------------------------------\n"));

  for (const it of bill.items) {
    const amt = it.isFree ? "FREE" : `${it.price * it.qty}`;
    c.push(enc(padEnd(it.name.substring(0, 18), 18) + padStart(String(it.qty), 4) + padStart(amt, 7) + " \n"));
  }
  if (bill.freeItemName) {
    c.push(enc(padEnd(bill.freeItemName.substring(0, 18), 18) + padStart("1", 4) + padStart("FREE", 7) + " \n"));
  }
  c.push(enc("--------------------------------\n"));

  if (bill.subtotal !== bill.total) {
    c.push(enc(twoCol("Subtotal", `Rs.${bill.subtotal}`, W)));
    c.push(enc(twoCol(`GST (${bill.gstPct}%)`, `Rs.${bill.gstAmount}`, W)));
  }
  c.push(b(CMD.BOLD_ON));
  c.push(enc(twoCol("TOTAL", `Rs.${bill.total}`, W)));
  c.push(b(CMD.BOLD_OFF));

  c.push(enc("--------------------------------\n"));
  const payLabel = bill.paymentMethod === "SPLIT"
    ? `Cash Rs.${bill.splitCash ?? 0} + GPay Rs.${bill.splitGpay ?? 0}`
    : bill.paymentMethod === "GPAY" ? "Paid via GPay" : "Paid in Cash";
  c.push(b(CMD.ALIGN_CENTER));
  c.push(enc(payLabel + "\n"));
  c.push(enc("--------------------------------\n"));
  c.push(enc("  Thank you! Visit again :)  \n"));
  c.push(enc("    Powered by Clouddine     \n"));
  c.push(b(CMD.FEED_3, CMD.CUT));

  await writeAll(c);
}
