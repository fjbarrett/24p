import Image from "next/image";

type MovieTrailerToggleProps = {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerEndpoint?: string;
};

export function MovieTrailerToggle({ title, posterUrl }: MovieTrailerToggleProps) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative aspect-[2/3] w-full max-w-[220px] overflow-hidden rounded-2xl bg-neutral-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)]">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={`${title} poster`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
            No art available
          </div>
        )}
      </div>
    </div>
  );
}
