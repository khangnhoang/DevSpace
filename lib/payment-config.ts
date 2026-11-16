// The bank account the payment QR pays into comes from deployment configuration, never from the source (SE-U5).
// The values reach the browser by design: the QR must show them.

export type PaymentBankConfig = {
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

type RawPaymentBankConfig = {
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
};

// The whole configuration, or null when any value is missing or blank: a partial configuration must never build a
// QR (SE-U5 G4), because a learner could pay into an account the Owner does not hold.
export function paymentBankConfig(
  raw: RawPaymentBankConfig,
): PaymentBankConfig | null {
  const bankCode = raw.bankCode?.trim();
  const accountNumber = raw.accountNumber?.trim();
  const accountName = raw.accountName?.trim();
  if (!bankCode || !accountNumber || !accountName) return null;
  return { bankCode, accountNumber, accountName };
}

// Each read names its public variable literally: `next build` inlines only such reads into the client bundle, so a
// dynamic key would leave the modal unconfigured in production. The values are fixed when the build runs.
export function readPaymentBankConfig(): PaymentBankConfig | null {
  return paymentBankConfig({
    bankCode: process.env.NEXT_PUBLIC_PAYMENT_BANK_CODE,
    accountNumber: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER,
    accountName: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME,
  });
}

// The VietQR quick-link image for one order: the amount and the transfer content are what the banking app fills in.
export function buildVietQrUrl(
  config: PaymentBankConfig,
  amount: number,
  transferContent: string,
): string {
  const image = `${encodeURIComponent(config.bankCode)}-${encodeURIComponent(config.accountNumber)}-compact2.png`;
  return (
    `https://img.vietqr.io/image/${image}` +
    `?amount=${encodeURIComponent(String(amount))}` +
    `&addInfo=${encodeURIComponent(transferContent)}` +
    `&accountName=${encodeURIComponent(config.accountName)}`
  );
}
