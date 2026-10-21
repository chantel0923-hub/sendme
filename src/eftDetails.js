// SendMe — bank details shown to donors who give by bank transfer (EFT / SWIFT).
//
// >>> FILL THESE IN with SendMe's real bank account details. <<<
// Until accountHolder, bankName and accountNumber are filled in, donors do NOT see a transfer form —
// they are told to tap the green WhatsApp button to ask for the details instead.
//
// Check with your bank first that the account can receive international (SWIFT) payments, and which
// currencies it accepts, before promising this to donors.
export const EFT_DETAILS = {
  accountHolder: "",   // e.g. "SendMe Global Mission Fund NPC"
  bankName:      "",   // e.g. "First National Bank"
  accountNumber: "",
  accountType:   "",   // e.g. "Cheque / Current"
  branchCode:    "",   // South African branch (universal) code
  swiftCode:     "",   // SWIFT / BIC code, needed for payments from outside South Africa
  bankCountry:   "South Africa",
  note:          "",   // optional extra line shown under the details (e.g. which currencies the account accepts)
};

export const eftConfigured = () =>
  !!(EFT_DETAILS.accountHolder.trim() && EFT_DETAILS.bankName.trim() && EFT_DETAILS.accountNumber.trim());
