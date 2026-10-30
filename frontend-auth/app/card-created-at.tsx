import { CalendarDays } from 'lucide-react';
import { cardCreationDate, CARD_TIMEZONE_LABEL } from '@/lib/card-dates';

export default function CardCreatedAt({createdAt, compact = false}: {createdAt?: number; compact?: boolean}) {
  const date = cardCreationDate(createdAt);
  if (compact) return <div className="card-created-at-compact" title={date ? `Fecha de creación: ${date.full} · ${CARD_TIMEZONE_LABEL}` : 'Este ticket no tiene una fecha de creación guardada.'}>
    <CalendarDays size={14} aria-hidden="true"/>
    <span>Creado: {date ? <time dateTime={date.iso}>{date.short}</time> : 'No disponible'}</span>
  </div>;
  return <div className="card-created-at-detail">
    <CalendarDays size={18} aria-hidden="true"/>
    <div><span className="card-created-at-label">Fecha de creación</span>
      <div>{date ? <time dateTime={date.iso}>{date.full}</time> : <span>No disponible</span>}</div>
      <small>{date ? CARD_TIMEZONE_LABEL : 'Este ticket no tiene una fecha de creación guardada.'}</small>
    </div>
  </div>;
}
