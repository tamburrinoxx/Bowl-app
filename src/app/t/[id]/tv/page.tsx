import TvBoard from "./tv-board";

export const revalidate = 0;

export default async function TvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TvBoard tournamentId={id} />;
}