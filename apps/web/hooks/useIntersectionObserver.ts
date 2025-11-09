import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number | number[]
  root?: Element | null
  rootMargin?: string
  freezeOnceVisible?: boolean
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const { threshold = 0.5, root = null, rootMargin = '0px', freezeOnceVisible = false } = options

  const [isIntersecting, setIsIntersecting] = useState(false)
  const elementRef = useRef<HTMLDivElement | null>(null)
  const frozen = useRef(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // If already frozen (once visible), don't observe again
    if (frozen.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return

        const isElementIntersecting = entry.isIntersecting

        setIsIntersecting(isElementIntersecting)

        // Freeze state if freezeOnceVisible is enabled and element is visible
        if (freezeOnceVisible && isElementIntersecting) {
          frozen.current = true
        }
      },
      { threshold, root, rootMargin }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [threshold, root, rootMargin, freezeOnceVisible])

  return [elementRef, isIntersecting]
}
