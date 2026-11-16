import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVietQrUrl,
  paymentBankConfig,
  readPaymentBankConfig,
} from "../../lib/payment-config";

// Invented values (SE-U5 G3).
const complete = {
  bankCode: "VCB",
  accountNumber: "0000000000",
  accountName: "DEVSPACE TEST",
};

describe("paymentBankConfig", () => {
  it("returns the three values of a complete configuration, trimmed", () => {
    expect(
      paymentBankConfig({
        bankCode: " VCB ",
        accountNumber: "0000000000\n",
        accountName: "  DEVSPACE TEST",
      }),
    ).toEqual(complete);
  });

  const fields = ["bankCode", "accountNumber", "accountName"] as const;
  it.each(
    fields.flatMap((field) => [
      [field, "missing", undefined],
      [field, "empty", ""],
      [field, "whitespace only", " \t "],
    ]),
  )(
    "treats the configuration as absent when %s is %s",
    (field, _label, value) => {
      expect(paymentBankConfig({ ...complete, [field]: value })).toBeNull();
    },
  );
});

describe("readPaymentBankConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the three public payment variables", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_BANK_CODE", "VCB");
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER", "0000000000");
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME", "DEVSPACE TEST");
    expect(readPaymentBankConfig()).toEqual(complete);
  });

  it("returns null when one of them is blank", () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_BANK_CODE", "VCB");
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_ACCOUNT_NUMBER", "   ");
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_ACCOUNT_NAME", "DEVSPACE TEST");
    expect(readPaymentBankConfig()).toBeNull();
  });
});

describe("buildVietQrUrl", () => {
  it("builds the VietQR image of the configured account with the amount, transfer content and name encoded", () => {
    expect(
      buildVietQrUrl(complete, 179100, "HOCPHI ABCD PAY12 JAVASCRIPT-CAN-BAN"),
    ).toBe(
      "https://img.vietqr.io/image/VCB-0000000000-compact2.png" +
        "?amount=179100&addInfo=HOCPHI%20ABCD%20PAY12%20JAVASCRIPT-CAN-BAN" +
        "&accountName=DEVSPACE%20TEST",
    );
  });

  it("keeps a value with URL syntax inside its own parameter", () => {
    const url = new URL(
      buildVietQrUrl(
        { bankCode: "A/B", accountNumber: "1?2", accountName: "X & Y=Z" },
        5,
        "PAY#1&amount=0",
      ),
    );
    expect(url.pathname).toBe("/image/A%2FB-1%3F2-compact2.png");
    expect([...url.searchParams]).toEqual([
      ["amount", "5"],
      ["addInfo", "PAY#1&amount=0"],
      ["accountName", "X & Y=Z"],
    ]);
  });
});
