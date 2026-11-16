// The bank configuration of the payment QR in the dev and e2e servers (CI's build sets the same values in ci.yml).
// Plainly invented (SE-U5 G3): an all-zero account cannot be paid by a QA scan, and no local run needs a real value.
export const PAYMENT_PLACEHOLDER_ENV = {
  NEXT_PUBLIC_PAYMENT_BANK_CODE: "VCB",
  NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER: "0000000000",
  NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME: "DEVSPACE TEST",
} as const;
