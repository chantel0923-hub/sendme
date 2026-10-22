// SendMe — bank details shown to donors who give by bank transfer (EFT / SWIFT).
//
// Taken from the FNB account confirmation letter dated 2026-08-26 (account opened 2026-08-20).
// If the account ever changes, edit it here, push, and donors see the new details straight away.
// If accountHolder, bankName or accountNumber is ever left empty, donors do NOT see the transfer form —
// they are told to tap the green WhatsApp button to ask for the details instead.
export const EFT_DETAILS = {
  accountHolder: "SENDME GLOBAL MISSION FUND NPC",
  bankName:      "First National Bank (FNB)",
  accountNumber: "63224034560",
  accountType:   "Gold Business Account",
  branchCode:    "250112",
  branchName:    "Northmead Square",
  swiftCode:     "FIRNZAJJ",
  bankCountry:   "South Africa",
  bankAddress:   "6th Floor, 1 First Place, Simmonds Street, Johannesburg, 2001, South Africa",
  // shown under the details
  note:          "Paying from outside South Africa? If your bank asks who pays the transfer fees, choose \"OUR\" (you pay all fees) so the full amount reaches us.",
};

export const eftConfigured = () =>
  !!(EFT_DETAILS.accountHolder.trim() && EFT_DETAILS.bankName.trim() && EFT_DETAILS.accountNumber.trim());
