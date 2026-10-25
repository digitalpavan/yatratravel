import {
  ArrowRight, Bell, Calendar, Car, ChartColumn, Check, ChevronDown, ChevronRight, CircleCheck, CircleX, ClipboardList, Clock, Copy,
  Download, FileText, House, Image, IndianRupee, Inbox, Info, ListFilter, LogOut, Mail, MapPin, Menu, Package, Pencil, Phone, Plane,
  Plus, RefreshCw, Route, Search, Settings, ShieldCheck, Sparkles, Star, TrainFront, Trash2, TriangleAlert, Users, Volume2, VolumeX, X,
  type LucideIcon,
} from 'lucide-react';

// Lucide line icons, plus two the library doesn't include: a South Indian temple (gopuram) and WhatsApp.
const lucide = {
  menu: Menu, close: X, phone: Phone, 'arrow-right': ArrowRight, 'chevron-right': ChevronRight, 'chevron-down': ChevronDown,
  clock: Clock, car: Car, users: Users, pin: MapPin, calendar: Calendar, check: Check, 'check-circle': CircleCheck, 'x-circle': CircleX,
  alert: TriangleAlert, info: Info, star: Star, shield: ShieldCheck, search: Search, filter: ListFilter, home: House, package: Package,
  inbox: Inbox, clipboard: ClipboardList, image: Image, settings: Settings, file: FileText, rupee: IndianRupee, plane: Plane,
  train: TrainFront, copy: Copy, download: Download, plus: Plus, edit: Pencil, logout: LogOut, route: Route, chart: ChartColumn,
  sparkle: Sparkles, bell: Bell, mail: Mail, refresh: RefreshCw, trash: Trash2, volume: Volume2, mute: VolumeX,
} satisfies Record<string, LucideIcon>;

const custom = {
  temple: 'M12 2.5 9.5 6h5zM8 6h8l1.5 4h-11zM5 10h14v2H5zM6.5 12v8M17.5 12v8M10 20v-4h4v4M4 20.5h16',
  whatsapp: 'M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .9a4 4 0 0 1-2.2-2.2l.9-1-1-2L9 9.5z',
};

export type IconName = keyof typeof lucide | keyof typeof custom;

export function Icon({ name, size = 20, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  const cls = `icon icon-${name}${className ? ` ${className}` : ''}`;
  if (name in custom) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cls} focusable="false" {...a11y}>
        <path d={custom[name as keyof typeof custom]} />
      </svg>
    );
  }
  const L = lucide[name as keyof typeof lucide];
  return <L size={size} strokeWidth={2} className={cls} focusable="false" {...a11y} />;
}
