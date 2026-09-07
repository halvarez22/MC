/**
 * Render presentacional del Aviso de Privacidad (Anti-God: sin lógica de negocio).
 */

import React from 'react';
import {
  buildPrivacyNoticeSections,
  getPrivacyOrgConfig,
} from '../../services/privacyNoticeContent';

const PrivacyNoticeBody: React.FC = () => {
  const notice = buildPrivacyNoticeSections(getPrivacyOrgConfig());

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-gray-700 dark:text-gray-300">
      <div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0">
          {notice.title}
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-0">{notice.subtitle}</p>
      </div>

      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
        <p className="font-medium text-gray-900 dark:text-gray-100 m-0 mb-2">
          {notice.responsible.label}
        </p>
        <ul className="list-none pl-0 m-0 space-y-1">
          {notice.responsible.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {notice.intro.map((p) => (
        <p key={p.slice(0, 40)} className="leading-relaxed m-0">
          {p}
        </p>
      ))}

      {notice.sections.map((section) => (
        <section key={section.id} className="space-y-2">
          <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 m-0">
            {section.title}
          </h5>
          {section.paragraphs.map((p, i) => (
            <p key={`${section.id}-p-${i}`} className="leading-relaxed m-0 text-sm">
              {p}
            </p>
          ))}
          {section.bullets && section.bullets.length > 0 ? (
            <ul className="list-disc pl-5 m-0 space-y-1 text-sm">
              {section.bullets.map((b) => (
                <li key={b.slice(0, 48)}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <p className="text-xs text-gray-500 dark:text-gray-400 m-0 pt-2 border-t border-gray-200 dark:border-gray-700">
        {notice.footer}
      </p>
    </div>
  );
};

export default PrivacyNoticeBody;
