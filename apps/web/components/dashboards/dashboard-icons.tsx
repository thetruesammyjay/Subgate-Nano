import type { ComponentProps } from "react";
import {
  Activity01Icon,
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  ClipboardCheckIcon,
  Clock01Icon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  DoorOpenIcon,
  Edit01Icon,
  FileClockIcon,
  FileCheckIcon,
  FileEmpty01Icon,
  MoreHorizontalCircle01Icon,
  Menu01Icon,
  GaugeIcon,
  LockKeyholeIcon,
  Link01Icon,
  KeyRoundIcon,
  PlayIcon,
  RefreshCwIcon,
  Radio01Icon,
  ReceiptTextIcon,
  Settings01Icon,
  ShieldCheckIcon,
  Tick01Icon,
  UserGroupIcon,
  UserIcon,
  WalletCardsIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type HugeIconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;
type HugeIconData = ComponentProps<typeof HugeiconsIcon>["icon"];

function iconComponent(icon: HugeIconData) {
  return function DashboardIcon(props: HugeIconProps) {
    return <HugeiconsIcon icon={icon} color="currentColor" {...props} />;
  };
}

// Stable aliases keep dashboard views readable while standardizing on Hugeicons.
export const Activity = iconComponent(Activity01Icon);
export const AlertCircle = iconComponent(AlertCircleIcon);
export const ArrowLeft = iconComponent(ArrowLeft01Icon);
export const ArrowRight = iconComponent(ArrowRight01Icon);
export const ArrowUpRight = iconComponent(ArrowUpRight01Icon);
export const Check = iconComponent(Tick01Icon);
export const CircleDollarSign = iconComponent(DollarCircleIcon);
export const ClipboardCheck = iconComponent(ClipboardCheckIcon);
export const Clock3 = iconComponent(Clock01Icon);
export const Construction = iconComponent(Wrench01Icon);
export const Gauge = iconComponent(GaugeIcon);
export const FileClock = iconComponent(FileClockIcon);
export const Inbox = iconComponent(FileEmpty01Icon);
export const LayoutDashboard = iconComponent(DashboardSquare01Icon);
export const LogOut = iconComponent(DoorOpenIcon);
export const LockKeyhole = iconComponent(LockKeyholeIcon);
export const Link2 = iconComponent(Link01Icon);
export const KeyRound = iconComponent(KeyRoundIcon);
export const Menu = iconComponent(Menu01Icon);
export const MoreHorizontal = iconComponent(MoreHorizontalCircle01Icon);
export const Pencil = iconComponent(Edit01Icon);
export const RadioTower = iconComponent(Radio01Icon);
export const Play = iconComponent(PlayIcon);
export const RefreshCw = iconComponent(RefreshCwIcon);
export const ReceiptText = iconComponent(ReceiptTextIcon);
export const Save = iconComponent(FileCheckIcon);
export const Settings = iconComponent(Settings01Icon);
export const Settings2 = iconComponent(Settings01Icon);
export const ShieldCheck = iconComponent(ShieldCheckIcon);
export const Users = iconComponent(UserGroupIcon);
export const UserRound = iconComponent(UserIcon);
export const CircleUserRound = iconComponent(UserIcon);
export const WalletCards = iconComponent(WalletCardsIcon);
export const X = iconComponent(Cancel01Icon);
