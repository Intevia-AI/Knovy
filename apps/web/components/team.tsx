import Image from "next/image";
import { useLanguage } from "@/context/language-context";

const members = [
  {
    name: "Paul (政治四)",
    role: "CEO",
    avatar: "/team/yao.jpg",
  },
  {
    name: "John (電機四)",
    role: "CTO",
    avatar: "/team/wei.jpg",
  },
  {
    name: "Ming (資管四)",
    role: "CTO",
    avatar: "/team/ye.jpg",
  },
];

export function TeamSection() {
  const { t } = useLanguage();
  return (
    <section className="bg-gray-50 py-16 md:py-32 dark:bg-transparent" id="teams">
      <div className="mx-auto max-w-5xl border-t px-6">
        <span className="text-caption -ml-6 -mt-3.5 block w-max bg-gray-50 px-6 dark:bg-gray-950">
          {t("team.our_team")}
        </span>

        <div className="mt-12 gap-4 sm:grid sm:grid-cols-2 md:mt-24">
          {/* <div className="sm:w-2/5">
              <h2 className="text-3xl font-bold sm:text-4xl">我們的團隊</h2>
          </div> */}
          <p className="text-muted-foreground">{t("team.description")}</p>
          {/* <div className="mt-6 sm:mt-0">
            {/* <p className="text-muted-foreground">
              認識 Knovy 背後的核心團隊。
            </p> */}
          {/* </div>  */}
        </div>
        <div className="mt-12 md:mt-24">
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member, index) => (
              <div key={index} className="group overflow-hidden">
                <Image
                  className="h-96 w-full rounded-md object-cover object-top transition-all duration-500 group-hover:h-[22.5rem] group-hover:rounded-xl"
                  src={member.avatar}
                  alt={`Avatar of ${member.name}`}
                  width={826}
                  height={1239}
                />
                <div className="px-2 pt-2 sm:pb-0 sm:pt-4">
                  <div className="flex justify-between">
                    <h3 className="text-title text-base font-medium transition-all duration-500 group-hover:tracking-wider">
                      {member.name}
                    </h3>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground inline-block text-sm transition duration-300 group-hover:opacity-100">
                      {member.role}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-24 max-w-2xl text-center">
        <h3 className="text-xl font-semibold">{t("team.progress")}</h3>
        <div className="mt-4 space-y-2 text-muted-foreground">
          <p>{t("team.progress.item1")}</p>
          <p>{t("team.progress.item2")}</p>
          <p>{t("team.progress.item3")}</p>
          <p>{t("team.progress.item4")}</p>
        </div>
      </div>
    </section>
  );
}
