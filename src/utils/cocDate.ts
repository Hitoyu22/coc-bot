// Convertit une date API CoC (format compact "20260703T070000.000Z"), ISO, Date ou timestamp
export function parseCocDate(s: string | Date | number): Date {
    if (s instanceof Date) return s;
    if (typeof s === 'number') return new Date(s);
    if (typeof s === 'string' && s.length >= 15 && !s.includes('-')) {
        return new Date(
            `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}.000Z`
        );
    }
    return new Date(s);
}
