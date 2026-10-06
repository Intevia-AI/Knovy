import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import inteviaLogo from '@/assets/intevia_logo.svg';
import inteviaLogoWhite from '@/assets/intevia_logo_white.svg';
const navLinks = [{
  href: '#what-is-knovy',
  label: 'What is Knovy?'
}, {
  href: '#demo',
  label: 'Demo'
}, {
  href: '#features',
  label: 'Features'
}, {
  href: '#about',
  label: 'About Me'
}, {
  href: '#contact',
  label: 'Contact'
}];
export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'glass border-b border-border' : 'bg-transparent'}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#" className="flex items-center gap-2">
            <img src={inteviaLogo} alt="Intevia AI" className="h-8 w-auto dark:hidden" />
            <img src={inteviaLogoWhite} alt="Intevia AI" className="hidden h-8 w-auto dark:block" />
            
          </a>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map(link => <a key={link.href} href={link.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </a>)}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && <nav className="md:hidden py-4 border-t border-border animate-fade-in">
            {navLinks.map(link => <a key={link.href} href={link.href} className="block py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                {link.label}
              </a>)}
          </nav>}
      </div>
    </header>;
}
