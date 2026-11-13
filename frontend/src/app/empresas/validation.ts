import { profileLabels, type Profile } from './contracts';

export function validCnpj(value: string): boolean {
  const text = value.trim().toUpperCase();
  if (!/^(?:[A-Z0-9]{12}[0-9]{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-[0-9]{2})$/.test(text)) return false;
  const cnpj = text.replace(/[./-]/g, '');
  if (new Set(cnpj).size === 1) return false;
  for (const length of [12, 13]) {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = weights.reduce((sum, weight, index) => sum + (cnpj.charCodeAt(index) - 48) * weight, 0) % 11;
    if (Number(cnpj[length]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}

export function profileError(profile: Profile): string | null {
  if (profile.razao_social.trim().length < 2) return 'Informe uma razão social com pelo menos dois caracteres.';
  if (!validCnpj(profile.cnpj)) return 'CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.';
  if (profile.cnae_principal && !/^[0-9]{7}$/.test(profile.cnae_principal)) return 'CNAE principal deve conter sete dígitos sem pontuação.';
  if (profile.cnaes_secundarios.some(value => !/^[0-9]{7}$/.test(value))) return 'Cada CNAE secundário deve conter sete dígitos sem pontuação.';
  for (const name of ['cnaes_secundarios', 'areas_atuacao', 'capacidades', 'tecnologias'] as const) {
    if (profile[name].length > 50 || profile[name].some(value => !value.trim() || value.length > 500)) return `${profileLabels[name]}: informe até 50 itens, com até 500 caracteres por item.`;
  }
  return null;
}
