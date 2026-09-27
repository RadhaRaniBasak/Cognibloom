import { useParams } from 'react-router';

export function useIdParam(): number | null {
  const { id } = useParams();
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
