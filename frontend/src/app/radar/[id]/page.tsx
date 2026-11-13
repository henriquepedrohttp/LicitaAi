import { redirect } from "next/navigation";
import { searchQuery, type SearchParams } from "../query";

export default async function OpportunityLink({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const query = searchQuery(await searchParams);
  query.set("oportunidade", id);
  redirect(`/radar?${query}`);
}
