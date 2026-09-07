/**
 * Aviso de Privacidad LFPDPPP — contenido centralizado (Regla 2 HRU / Regla 7).
 * Datos del Responsable vía VITE_PRIVACY_* (no hardcodear razón social en UI).
 */

export type PrivacyOrgConfig = {
  orgName: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  updatedAt: string;
};

export function getPrivacyOrgConfig(): PrivacyOrgConfig {
  const env = import.meta.env;
  return {
    orgName: (env.VITE_PRIVACY_ORG_NAME as string) || '[Nombre completo o razón social de la empresa]',
    address:
      (env.VITE_PRIVACY_ORG_ADDRESS as string) ||
      '[Calle, número, colonia, código postal, ciudad, estado, México]',
    email: (env.VITE_PRIVACY_ORG_EMAIL as string) || '[correo@empresa.com]',
    phone: (env.VITE_PRIVACY_ORG_PHONE as string) || '[número de contacto]',
    website: (env.VITE_PRIVACY_ORG_WEBSITE as string) || '[sitio web de la empresa]',
    updatedAt: (env.VITE_PRIVACY_UPDATED_AT as string) || '7 de septiembre de 2026',
  };
}

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export function buildPrivacyNoticeSections(org: PrivacyOrgConfig = getPrivacyOrgConfig()): {
  title: string;
  subtitle: string;
  intro: string[];
  responsible: { label: string; lines: string[] };
  sections: PrivacySection[];
  footer: string;
} {
  return {
    title: 'Aviso de Privacidad',
    subtitle:
      'Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)',
    intro: [
      `En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, ${org.orgName} (en adelante “el Responsable”) pone a su disposición el presente Aviso de Privacidad.`,
    ],
    responsible: {
      label: 'Responsable del tratamiento de los datos personales',
      lines: [
        org.orgName,
        `Domicilio: ${org.address}`,
        `Correo electrónico de contacto: ${org.email}`,
        `Teléfono: ${org.phone}`,
      ],
    },
    sections: [
      {
        id: 'datos',
        title: '1. Datos personales que recabamos',
        paragraphs: [
          'A través de nuestra aplicación móvil y/o plataforma web (la “App”), podemos recabar las siguientes categorías de datos personales:',
          'Los datos biométricos y los datos contenidos en la INE se consideran datos personales sensibles o de especial protección, por lo que se tratan con medidas de seguridad reforzadas.',
        ],
        bullets: [
          'Datos de identificación: nombre completo, fecha de nacimiento, sexo, fotografía, CURP, Clave de Elector, CIC, OCR / Identificador de Ciudadano, número de emisión de la credencial, domicilio, sección electoral y demás datos contenidos en la Credencial para Votar (INE/IFE).',
          'Datos de contacto: correo electrónico, número de teléfono móvil.',
          'Datos biométricos (cuando aplique): imagen facial (selfie), prueba de vida (liveness) y, en su caso, huellas dactilares.',
          'Datos técnicos y de uso: dirección IP, tipo de dispositivo, sistema operativo, identificadores del dispositivo, logs de actividad dentro de la App y datos de geolocalización (solo cuando el usuario lo autorice expresamente).',
          'Imágenes y documentos: fotografías del anverso y reverso de la Credencial para Votar u otros documentos de identidad que el usuario cargue voluntariamente.',
        ],
      },
      {
        id: 'finalidades',
        title: '2. Finalidades del tratamiento',
        paragraphs: [
          'Finalidades primarias (necesarias para la prestación del servicio): verificar la autenticidad y vigencia de la Credencial para Votar (INE) mediante extracción de datos (OCR/Visión) y consulta a fuentes autorizadas (Lista Nominal del INE a través de proveedores de verificación de identidad autorizados y, en su caso, RENAPO); realizar procesos de identificación y autenticación de usuarios (KYC); comparar la fotografía de la INE con la selfie del usuario (face-match) y realizar pruebas de vida cuando aplique; generar constancias o reportes de verificación de identidad; prevenir fraudes, suplantación de identidad y uso de documentos alterados o falsificados; cumplir con obligaciones legales y regulatorias aplicables.',
          `Finalidades secundarias (no necesarias para el servicio principal): envío de comunicaciones comerciales, promociones o información sobre nuevos servicios (solo con su consentimiento); análisis estadísticos y mejora de la App (de forma anonimizada o agregada siempre que sea posible). Usted puede oponerse al tratamiento para finalidades secundarias en cualquier momento enviando un correo a ${org.email}.`,
        ],
      },
      {
        id: 'transferencias',
        title: '3. Transferencias de datos',
        paragraphs: [
          'Los datos personales podrán ser transferidos a:',
          'No realizamos transferencias a terceros con fines mercadotécnicos sin su consentimiento previo.',
        ],
        bullets: [
          'Proveedores de servicios de verificación de identidad y KYC que cuenten con acceso autorizado a la Lista Nominal del INE o a bases de datos oficiales (bajo contratos de confidencialidad y encargados de tratamiento), incluyendo proveedores como Datos Non Stop u otros autorizados.',
          'Autoridades competentes cuando exista requerimiento legal o judicial.',
          'Empresas del mismo grupo corporativo (si aplica), para las mismas finalidades aquí descritas.',
        ],
      },
      {
        id: 'seguridad',
        title: '4. Medidas de seguridad',
        paragraphs: [
          'Implementamos medidas administrativas, técnicas y físicas de seguridad para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso, acceso o tratamiento no autorizados, incluyendo cifrado de datos en tránsito y en reposo, control de accesos y auditorías periódicas. Las claves de API de proveedores de verificación se almacenan únicamente en el servidor (nunca en el navegador).',
        ],
      },
      {
        id: 'arco',
        title: '5. Derechos ARCO y revocación del consentimiento',
        paragraphs: [
          'Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales, así como a Revocar el consentimiento que haya otorgado.',
          `Para ejercer cualquiera de estos derechos, envíe una solicitud al correo ${org.email} indicando: nombre completo del titular; medio para recibir la respuesta; descripción clara de los datos y del derecho que desea ejercer; documentos que acrediten su identidad (o la de su representante legal).`,
          'Responderemos en un plazo máximo de 20 días hábiles.',
        ],
      },
      {
        id: 'cookies',
        title: '6. Uso de cookies y tecnologías similares',
        paragraphs: [
          'La App y el sitio web pueden utilizar cookies, web beacons u otras tecnologías para mejorar la experiencia del usuario y obtener información estadística. Usted puede deshabilitarlas en la configuración de su dispositivo o navegador; sin embargo, algunas funcionalidades podrían verse limitadas.',
        ],
      },
      {
        id: 'cambios',
        title: '7. Cambios al Aviso de Privacidad',
        paragraphs: [
          `Nos reservamos el derecho de modificar o actualizar el presente Aviso de Privacidad en cualquier momento. Las modificaciones se publicarán en la App y/o en el sitio web ${org.website}. Se recomienda revisarlo periódicamente.`,
        ],
      },
      {
        id: 'consentimiento',
        title: '8. Consentimiento',
        paragraphs: [
          'Al utilizar la App, cargar su Credencial para Votar o proporcionar sus datos personales, usted manifiesta haber leído, entendido y aceptado los términos del presente Aviso de Privacidad, otorgando su consentimiento para el tratamiento de sus datos conforme a lo aquí establecido (incluido el tratamiento de datos sensibles cuando corresponda).',
        ],
      },
    ],
    footer: `Fecha de última actualización: ${org.updatedAt}.`,
  };
}
