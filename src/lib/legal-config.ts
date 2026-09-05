/**
 * Identità legale mostrata sulle pagine pubbliche.
 * Unica fonte: non duplicare questi valori nelle pagine.
 */
export const LEGAL_PRODUCT_NAME = "Ally";

export const LEGAL_SITE_URL = "https://affianco.vercel.app";

export const LEGAL_CONTROLLER_NAME = "Federica Cucca";

export const LEGAL_CONTACT_EMAIL = "federicacucca03@gmail.com";

export const LEGAL_ADDRESS = "Via Salvatore Talamo 8";

export const LEGAL_VAT_ID = "16621431002";

export function contattoPrivacy(): string {
  return LEGAL_CONTACT_EMAIL;
}

export function titolareTrattamento(): string {
  return LEGAL_CONTROLLER_NAME;
}
