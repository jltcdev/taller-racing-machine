import type { ReactElement } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export function Hint({ text, children }: { text: string; children: ReactElement }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent className="max-w-64">{text}</TooltipContent></Tooltip>;
}
export function Help({ text, label }: { text: string; label: string }) {
  return <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" aria-label={`Ayuda: ${label}`}><CircleHelp /></Button></PopoverTrigger><PopoverContent className="text-sm" side="top">{text}</PopoverContent></Popover>;
}