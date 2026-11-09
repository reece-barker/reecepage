// The fixed words on letters and invoices in German, English and Dutch. Everything a person types (the subject, the
// body, the line items) stays in whatever language they typed it in, only these labels follow the document language.
// German uses Sie, Dutch uses u, like any business letter.

export const WORDS = {
  de: {
    yourRef: "Ihr Zeichen", yourMessage: "Ihre Nachricht vom", ourRef: "Unser Zeichen", documentNo: "Dokument-Nr.",
    customerNo: "Kunden-/Projekt-Nr.", contact: "Ansprechpartner", phone: "Telefon", email: "E-Mail", date: "Datum",
    page: "Seite", of: "von", enclosures: "Anlagen", enclosure: "Anlage",
    invoice: "Rechnung", invoiceNo: "Rechnungsnummer", invoiceDate: "Rechnungsdatum", serviceDate: "Leistungsdatum",
    servicePeriod: "Leistungszeitraum", dueDate: "Zahlbar bis", position: "Pos.", description: "Beschreibung",
    quantity: "Menge", unit: "Einheit", unitPrice: "Einzelpreis", amount: "Betrag", vatRate: "USt.",
    net: "Nettobetrag", vat: (rate) => `Umsatzsteuer ${rate}`, total: "Gesamtbetrag", totalDue: "Zu zahlen",
    payment: "Zahlung", accountHolder: "Kontoinhaber", bank: "Bank", iban: "IBAN", bic: "BIC", reference: "Verwendungszweck",
    payBy: (date) => `Bitte überweisen Sie den Betrag bis zum ${date} auf das unten genannte Konto.`,
    smallBusiness: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
    reverseCharge: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).",
    taxNumber: "Steuernummer", vatId: "USt-IdNr.", wId: "W-IdNr.", register: "Registergericht", directors: "Geschäftsführung",
    owner: "Inhaber", seat: "Sitz", kvk: "KvK", btw: "btw-id", companyNo: "Company No.", registeredIn: "Registriert in",
    hours: "Std.", pieces: "Stk.", flat: "pauschal"
  },
  en: {
    yourRef: "Your ref", yourMessage: "Your message of", ourRef: "Our ref", documentNo: "Document no.",
    customerNo: "Customer/project no.", contact: "Contact", phone: "Phone", email: "Email", date: "Date",
    page: "Page", of: "of", enclosures: "Enclosures", enclosure: "Enclosure",
    invoice: "Invoice", invoiceNo: "Invoice number", invoiceDate: "Invoice date", serviceDate: "Date of supply",
    servicePeriod: "Period of supply", dueDate: "Due by", position: "No.", description: "Description",
    quantity: "Qty", unit: "Unit", unitPrice: "Unit price", amount: "Amount", vatRate: "VAT",
    net: "Net amount", vat: (rate) => `VAT ${rate}`, total: "Total", totalDue: "Amount due",
    payment: "Payment", accountHolder: "Account holder", bank: "Bank", iban: "IBAN", bic: "BIC", reference: "Reference",
    payBy: (date) => `Please pay the amount by ${date} to the account below.`,
    smallBusiness: "No VAT is charged, the supplier is not VAT registered.",
    reverseCharge: "Reverse charge: VAT to be accounted for by the recipient.",
    taxNumber: "Tax number", vatId: "VAT number", wId: "Business ID", register: "Register", directors: "Directors",
    owner: "Owner", seat: "Registered seat", kvk: "KvK", btw: "VAT ID", companyNo: "Company number", registeredIn: "Registered in",
    hours: "h", pieces: "pcs", flat: "flat"
  },
  nl: {
    yourRef: "Uw kenmerk", yourMessage: "Uw bericht van", ourRef: "Ons kenmerk", documentNo: "Documentnr.",
    customerNo: "Klant-/projectnr.", contact: "Contactpersoon", phone: "Telefoon", email: "E-mail", date: "Datum",
    page: "Pagina", of: "van", enclosures: "Bijlagen", enclosure: "Bijlage",
    invoice: "Factuur", invoiceNo: "Factuurnummer", invoiceDate: "Factuurdatum", serviceDate: "Leveringsdatum",
    servicePeriod: "Leveringsperiode", dueDate: "Te betalen voor", position: "Nr.", description: "Omschrijving",
    quantity: "Aantal", unit: "Eenheid", unitPrice: "Prijs per eenheid", amount: "Bedrag", vatRate: "Btw",
    net: "Bedrag excl. btw", vat: (rate) => `Btw ${rate}`, total: "Totaal", totalDue: "Te betalen",
    payment: "Betaling", accountHolder: "Rekeninghouder", bank: "Bank", iban: "IBAN", bic: "BIC", reference: "Omschrijving",
    payBy: (date) => `Graag ontvangen wij het bedrag uiterlijk ${date} op de onderstaande rekening.`,
    smallBusiness: "Vrijgesteld van btw op grond van de kleineondernemersregeling.",
    reverseCharge: "Btw verlegd.",
    taxNumber: "Belastingnummer", vatId: "Btw-id", wId: "Bedrijfs-ID", register: "Register", directors: "Bestuurders",
    owner: "Eigenaar", seat: "Statutaire zetel", kvk: "KvK", btw: "btw-id", companyNo: "Company number", registeredIn: "Geregistreerd in",
    hours: "uur", pieces: "st.", flat: "vast"
  }
};

export function words(lang) {
  return WORDS[lang] || WORDS.de;
}
