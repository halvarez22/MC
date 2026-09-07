/**
 * Badge presentacional — estado Lista Nominal (U-First Soft).
 */

import React from 'react';
import type { ListaNominalResult } from '../../types';

interface ListaNominalStatusBadgeProps {
  isValidating: boolean;
  result: ListaNominalResult | null;
  onRetry?: () => void;
}

const ListaNominalStatusBadge: React.FC<ListaNominalStatusBadgeProps> = ({
  isValidating,
  result,
  onRetry,
}) => {
  if (isValidating) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
          aria-hidden
        />
        <span>Validando con el padrón…</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.status === 'valid') {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        🟢 Vigente en Lista Nominal
      </div>
    );
  }

  if (
    result.status === 'not_found' ||
    result.status === 'not_current' ||
    result.status === 'expired'
  ) {
    const tone =
      result.status === 'not_found'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-900';
    const label =
      result.status === 'not_found'
        ? '🔴 No encontrada en Lista Nominal'
        : result.status === 'expired'
          ? '🟡 Credencial vencida / no vigente'
          : '🟡 No es la credencial vigente';
    return (
      <div className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
        <p className="font-medium">{label}</p>
        {result.rawMessage ? (
          <p className="mt-1 text-xs opacity-90">{result.rawMessage}</p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs underline underline-offset-2 hover:opacity-80"
          >
            Reintentar validación
          </button>
        ) : null}
      </div>
    );
  }

  if (result.status === 'skipped_flag_off' || result.status === 'skipped_offline') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
        ⚪ Validación omitida (Modo Demo/Offline)
      </div>
    );
  }

  // error
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p className="font-medium">⚠️ No se pudo validar con el padrón</p>
      {result.rawMessage ? (
        <p className="mt-1 text-xs opacity-90">{result.rawMessage}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs underline underline-offset-2 hover:opacity-80"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
};

export default ListaNominalStatusBadge;
