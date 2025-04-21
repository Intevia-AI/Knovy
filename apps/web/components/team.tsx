import Image from "next/image";

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
  return (
    <section
      className="bg-gray-50 py-16 md:py-32 dark:bg-transparent"
      id="teams"
    >
      <div className="mx-auto max-w-5xl border-t px-6">
        <span className="text-caption -ml-6 -mt-3.5 block w-max bg-gray-50 px-6 dark:bg-gray-950">
          我們的團隊
        </span>
        
        <div className="mt-12 gap-4 sm:grid sm:grid-cols-2 md:mt-24">
          {/* <div className="sm:w-2/5">
              <h2 className="text-3xl font-bold sm:text-4xl">我們的團隊</h2>
          </div> */}
          <p className="text-muted-foreground">
          我們是三個來自台大的學生，都各自參與過一些創業專案，這次因著「台大鳥巢」（台大第一個創業家和VC社團）聚集在一起。我們一開始從語音出發，想做即時的「口音轉換、優化AI」，在研究了一下後，發現此類產品市場上已非常多，技術也很成熟，甚至只是一些會議AI的「附屬功能」。因此，對於學生來說，現在才進入市場並且從零開始研發難度高的語音技術，似乎不是太好的起點，因此我們朝著會議、面試AI助力的方向軸轉。
        </p>
          {/* <div className="mt-6 sm:mt-0">
            {/* <p className="text-muted-foreground">
              認識 INTEVIA AI 背後的核心團隊。
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
        <h3 className="text-xl font-semibold">目前進度</h3>
        <div className="mt-4 space-y-2 text-muted-foreground">
          <p>開發產品Demo MVP</p>
          <p>收集第一波用戶回饋、改良產品</p>
          <p>開發客戶、參加創業競賽與尋求資金</p>
          <p>申請新型應用專利中</p>
        </div>
      </div>
    </section>
  );
}
