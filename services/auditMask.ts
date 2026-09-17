/**
 * APO-AUDIT-FORENSIC — enmascarado CURP + resumen de origen.
 */

/** AAGH650922HGTLTC04 → AAGH********TC04 (4 + 8 máscara + 4) */
export function maskCurp(curp: string | undefined | null): string {
  const c = String(curp ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (c.length < 10) return '********';
  return `${c.slice(0, 4)}${'*'.repeat(8)}${c.slice(-4)}`;
}

export function briefUserAgent(ua: string | undefined | null): string {
  const s = String(ua ?? '').trim();
  if (!s) return '';
  if (/iPhone|iPad/i.test(s)) return 'iOS Safari';
  if (/Android/i.test(s)) return 'Android';
  if (/Edg\//i.test(s)) return 'Edge';
  if (/Chrome\//i.test(s) && !/Edg\//i.test(s)) return 'Chrome';
  if (/Firefox\//i.test(s)) return 'Firefox';
  if (/Safari\//i.test(s)) return 'Safari';
  return s.slice(0, 32);
}

export function extractClientIp(headers: {
  [k: string]: string | string[] | undefined;
}): string {
  const xf = headers['x-forwarded-for'];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  if (raw && raw.trim()) {
    return raw.split(',')[0]!.trim();
  }
  const real = headers['x-real-ip'];
  const r = Array.isArray(real) ? real[0] : real;
  if (r && r.trim()) return r.trim();
  return '';
}

export function buildSourceSummary(ip: string, ua: string): string {
  const parts = [ip.trim(), briefUserAgent(ua)].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'origen desconocido';
}

export function formatAuditActionLabel(action: string, curpMasked?: string, screen?: string): string {
  switch (action) {
    case 'LOGIN_SUCCESS':
      return 'Acceso correcto';
    case 'LOGIN_FAILURE':
      return 'Login fallido';
    case 'LOGOUT':
      return 'Cierre de sesión';
    case 'AFFILIATE_CREATE':
      return curpMasked ? `Afilió · CURP ${curpMasked}` : 'Afilió simpatizante';
    case 'AFFILIATE_DUPLICATE':
      return curpMasked ? `Duplicado · CURP ${curpMasked}` : 'Intento duplicado';
    case 'ADMIN_AFFILIATE_DELETE':
      return curpMasked ? `Baja · CURP ${curpMasked}` : 'Baja de afiliado';
    case 'SCREEN_VIEW':
      return screen ? `Menú: ${screenLabel(screen)}` : 'Navegación';
    default:
      return action;
  }
}

function screenLabel(screen: string): string {
  const map: Record<string, string> = {
    'admin.dashboard': 'Dashboard',
    'admin.affiliates': 'Afiliados',
    'admin.affiliate_detail': 'Detalle afiliado',
    'admin.ine_data': 'Datos INE',
    'admin.audit': 'Bitácora',
    'admin.users': 'Usuarios',
    'field.home': 'Modo Campo',
  };
  return map[screen] || screen;
}
