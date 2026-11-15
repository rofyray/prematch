import SavedBrief from "../../../components/SavedBrief";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedBrief id={id} print />;
}
