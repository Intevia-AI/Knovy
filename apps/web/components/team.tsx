import Image from "next/image";

const members = [
  {
    name: "姚志磐 Paul",
    role: "CEO (政治四)",
    avatar: "/placeholder.png", // Replace with actual image path
  },
  {
    name: "魏睿強 John",
    role: "CTO (電機四)",
    avatar: "/placeholder.png", // Replace with actual image path
  },
  {
    name: "葉又銘 Ming",
    role: "Co-CTO (資管四)",
    avatar: "/placeholder.png", // Replace with actual image path
  },
];

export function TeamSection() {
  return (
    <section
      className="bg-gray-50 py-16 md:py-32 dark:bg-transparent"
      id="teams"
    >
      <div className="mx-auto max-w-5xl border-t px-6">
        <span className="text-caption -ml-6 -mt-3.5 block w-max bg-gray-50 px-6 dark:bg-gray-950">
          團隊成員
        </span>
        <div className="mt-12 gap-4 sm:grid sm:grid-cols-2 md:mt-24">
          <div className="sm:w-2/5">
            <h2 className="text-3xl font-bold sm:text-4xl">我們的團隊</h2>
          </div>
          <div className="mt-6 sm:mt-0">
            <p className="text-muted-foreground">
              認識 INTEVIA AI 背後的核心團隊。
            </p>
            <h3 className="mt-6 text-xl font-semibold">目前進度</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>開發產品 MVP、收集第一波使用者回饋</li>
              <li>討論商業模式、申請比賽資金</li>
              <li>申請新型應用專利中</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 md:mt-24">
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member, index) => (
              <div key={index} className="group overflow-hidden">
                <Image
                  className="h-96 w-full rounded-md object-cover object-top grayscale transition-all duration-500 hover:grayscale-0 group-hover:h-[22.5rem] group-hover:rounded-xl"
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
    </section>
  );
}
