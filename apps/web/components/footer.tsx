import { Logo } from "@/components/logo";
import Link from "next/link";

const links = [
  {
    title: "首頁",
    href: "#home",
  },
  {
    title: "功能",
    href: "#features",
  },
  {
    title: "團隊",
    href: "#teams", // Match ID in team.tsx
  },
  {
    title: "聯絡我們",
    href: "#footer", // Point to footer itself for contact info
  },
];

export default function FooterSection() {
  return (
    <footer className="py-16 md:py-32" id="footer">
      <div className="mx-auto max-w-5xl px-6">
        <Link href="/" aria-label="go home" className="mx-auto block size-fit">
          <Logo />
        </Link>

        <div className="my-8 flex flex-wrap justify-center gap-6 text-sm">
          {links.map((link, index) => (
            <Link
              key={index}
              href={link.href}
              className="text-muted-foreground hover:text-primary block duration-150"
            >
              <span>{link.title}</span>
            </Link>
          ))}
        </div>

        {/* Contact Info */}
        <div className="my-8 text-center">
          <h3 className="text-lg font-semibold mb-2">聯絡我們</h3>
          <p className="text-muted-foreground text-sm"><a href="mailto:paulyao0825@gmail.com" className="hover:text-primary">電子郵件: paulyao0825@gmail.com</a></p>
          <div className="mt-4 flex justify-center gap-4">
            <Link
              href="https://www.instagram.com/paulyao825" // Assuming this is the correct URL
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-muted-foreground hover:text-primary block"
            >
              <svg
                className="size-6"
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3"
                ></path>
              </svg>
            </Link>
            {/* Add other relevant social links if needed */}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">歡迎對這個題目有興趣的同學來找我們聊聊！</p>
        </div>

        <span className="text-muted-foreground block text-center text-sm">
          © {new Date().getFullYear()} INTEVIA AI, 版權所有
        </span>
      </div>
    </footer>
  );
}
