import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { generateId } from './utils';
import {
  UploadedBill,
  UploadedBillType,
  UploadedBillPaymentStatus,
} from './types';

/**
 * Uploaded media bills: a photo of a handwritten / digital bill stored as
 * private media plus manually entered metadata. No OCR.
 *
 * All writes go through server RPCs (create_uploaded_bill_atomic /
 * mark_uploaded_bill_paid_atomic). Deletion is done server-side by the
 * purge-expired-bills Edge Function; the app never deletes bills.
 */

export const UPLOADED_BILLS_BUCKET = 'uploaded-bills';

type Row = Record<string, any>;

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const s = (v: unknown) => (v == null ? '' : String(v));
const o = (v: unknown) => (v == null || v === '' ? undefined : String(v));

function mapUploadedBill(r: Row): UploadedBill {
  // A to-one embed can come back as an object or a one-element array.
  const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
  return {
    id: s(r.id),
    businessId: s(r.business_id),
    customerId: o(r.customer_id),
    customerName: o(customer?.name),
    mediaPath: s(r.media_path),
    billType: r.bill_type,
    amount: n(r.amount),
    paymentStatus: r.payment_status,
    uploadedAt: s(r.uploaded_at),
    paidAt: o(r.paid_at),
    deleteAfter: o(r.delete_after),
    createdAt: s(r.created_at),
    updatedAt: s(r.updated_at),
  };
}

export async function getUploadedBills(businessId: string): Promise<UploadedBill[]> {
  const { data, error } = await supabase
    .from('uploaded_bills')
    .select('*, customers(name)')
    .eq('business_id', businessId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  return (Array.isArray(data) ? data : []).map(mapUploadedBill);
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export interface PickedBillMedia {
  uri: string;
  mimeType?: string | null;
}

export interface CreateUploadedBillInput {
  businessId: string;
  customerId?: string;
  billType: UploadedBillType;
  amount: number;
  paymentStatus: UploadedBillPaymentStatus;
  media: PickedBillMedia;
}

/**
 * Uploads the media to the private bucket, then creates the bill record.
 * If the record cannot be created the freshly uploaded file is removed again
 * (allowed by the "orphan" storage delete policy).
 */
export async function createUploadedBill(input: CreateUploadedBillInput): Promise<string> {
  const id = generateId();
  const contentType = (input.media.mimeType || 'image/jpeg').toLowerCase();
  const ext = EXTENSIONS[contentType];

  if (!ext) {
    throw new Error('Unsupported image type. Please use a JPEG, PNG, WebP or HEIC photo.');
  }

  const mediaPath = `${input.businessId}/${id}.${ext}`;

  let body: ArrayBuffer | Blob;
  if (Platform.OS === 'web') {
    body = await (await fetch(input.media.uri)).blob();
  } else {
    body = await new File(input.media.uri).arrayBuffer();
  }

  const { error: uploadError } = await supabase.storage
    .from(UPLOADED_BILLS_BUCKET)
    .upload(mediaPath, body, { contentType, upsert: false });

  if (uploadError) throw uploadError;

  const { error } = await supabase.rpc('create_uploaded_bill_atomic', {
    payload: {
      id,
      businessId: input.businessId,
      customerId: input.customerId ?? null,
      mediaPath,
      billType: input.billType,
      amount: input.amount,
      paymentStatus: input.paymentStatus,
    },
  });

  if (error) {
    try {
      await supabase.storage.from(UPLOADED_BILLS_BUCKET).remove([mediaPath]);
    } catch {
      // best effort; the file has no bill row and is not reachable from the app
    }
    throw error;
  }

  return id;
}

/** Marks a credit bill paid; the server starts the 7-day deletion period. */
export async function markUploadedBillPaid(
  businessId: string,
  billId: string
): Promise<void> {
  const { error } = await supabase.rpc('mark_uploaded_bill_paid_atomic', {
    payload: { id: billId, businessId },
  });

  if (error) throw error;
}

/** Short-lived signed URL. The bucket is private, so there is no permanent URL. */
export async function getUploadedBillUrl(
  mediaPath: string,
  expiresInSeconds = 120
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(UPLOADED_BILLS_BUCKET)
    .createSignedUrl(mediaPath, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not open bill');

  return data.signedUrl;
}

/** Human readable deletion countdown for the bill list. */
export function getDeletionLabel(bill: UploadedBill, now: Date = new Date()): string {
  if (!bill.deleteAfter) {
    return bill.paymentStatus === 'credit' ? 'Kept until paid' : '';
  }

  const ms = new Date(bill.deleteAfter).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'Deleting soon';

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  if (days > 0) return `Deletes in ${days}d ${hours}h`;
  if (hours > 0) return `Deletes in ${hours}h ${minutes}m`;
  return `Deletes in ${Math.max(minutes, 1)}m`;
}
