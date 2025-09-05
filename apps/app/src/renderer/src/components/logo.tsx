import { cn } from '@/lib/utils'

export const Logo = ({ className }: { className?: string }) => {
  return (
    <img
      src="/logo/intevia_logo.svg"
      alt="INTEVIA"
      width={100}
      height={100}
      className={cn('h-8 w-auto', className)}
    />
  )
}
