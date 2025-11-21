'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  FileText,
  Users,
  DollarSign,
  Settings,
  Menu,
  LogOut,
  User,
  CreditCard,
  Plus,
  BarChart3,
  Wallet,
  Building2,
  Mail,
  Bell,
  HelpCircle,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    current: false,
  },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: FileText,
    current: false,
    children: [
      { name: 'All Invoices', href: '/dashboard/invoices' },
      { name: 'Create Invoice', href: '/dashboard/invoices/new' },
      { name: 'Draft Invoices', href: '/dashboard/invoices?status=draft' },
      { name: 'Overdue', href: '/dashboard/invoices?status=overdue' },
    ],
  },
  {
    name: 'Clients',
    href: '/dashboard/clients',
    icon: Users,
    current: false,
    children: [
      { name: 'All Clients', href: '/dashboard/clients' },
      { name: 'Add Client', href: '/dashboard/clients/new' },
    ],
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    current: false,
  },
  {
    name: 'Currencies',
    href: '/dashboard/currencies',
    icon: DollarSign,
    current: false,
  },
];

const secondaryNavigation = [
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
  {
    name: 'Help & Support',
    href: '/dashboard/help',
    icon: HelpCircle,
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => {
    if (isActive(item.href)) return true;
    if (item.children) {
      return item.children.some((child: any) => isActive(child.href));
    }
    return false;
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn('flex h-full w-64 flex-col bg-white border-r', className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl">Invoice Manager</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4 py-4">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isExpanded = expandedItems.includes(item.name);
            const hasChildren = item.children && item.children.length > 0;
            const parentActive = isParentActive(item);

            return (
              <div key={item.name}>
                <Button
                  variant={parentActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start h-10',
                    parentActive && 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  )}
                  onClick={() => {
                    if (hasChildren) {
                      toggleExpanded(item.name);
                    }
                  }}
                  asChild={!hasChildren}
                >
                  {hasChildren ? (
                    <div className="flex items-center w-full">
                      <item.icon className="mr-3 h-4 w-4" />
                      <span className="flex-1 text-left">{item.name}</span>
                      <Plus 
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isExpanded && "rotate-45"
                        )}
                      />
                    </div>
                  ) : (
                    <Link href={item.href} className="flex items-center w-full">
                      <item.icon className="mr-3 h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  )}
                </Button>

                {/* Submenu */}
                {hasChildren && isExpanded && (
                  <div className="ml-6 mt-2 space-y-1">
                    {item.children?.map((child) => (
                      <Button
                        key={child.href}
                        variant={isActive(child.href) ? 'secondary' : 'ghost'}
                        className={cn(
                          'w-full justify-start h-8 text-sm',
                          isActive(child.href) && 'bg-blue-50 text-blue-700'
                        )}
                        asChild
                      >
                        <Link href={child.href}>
                          <span className="ml-2">{child.name}</span>
                        </Link>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Secondary Navigation */}
        <div className="mt-8 border-t pt-4">
          <nav className="space-y-2">
            {secondaryNavigation.map((item) => (
              <Button
                key={item.name}
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start h-10',
                  isActive(item.href) && 'bg-blue-50 text-blue-700'
                )}
                asChild
              >
                <Link href={item.href}>
                  <item.icon className="mr-3 h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </ScrollArea>

      {/* User Menu */}
      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start h-12 px-3"
            >
              <Avatar className="h-8 w-8 mr-3">
                <AvatarImage src={session?.user?.image || ''} />
                <AvatarFallback className="bg-blue-100 text-blue-700">
                  {session?.user?.name ? getUserInitials(session.user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">
                  {session?.user?.name || 'User'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {session?.user?.email || ''}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {session?.user?.name}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help & Support</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface MobileSidebarProps {
  children: React.ReactNode;
}

export function MobileSidebar({ children }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0 w-64">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}