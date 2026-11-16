import { EmptyState } from "@/components/ui/EmptyState";

type Props = {
  title: string;
  description?: string;
};

export function PageStub({ title, description }: Props) {
  return (
    <section>
      <h2 className="mb-3 mt-[10px] text-[16.5px] font-extrabold text-tx">
        {title}
      </h2>
      <EmptyState
        title="Раздел в разработке"
        description={
          description ??
          "Эта страница появится в следующих фазах. Каркас и навигация уже готовы."
        }
        icon="◇"
      />
    </section>
  );
}
