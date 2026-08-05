import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

/**
 * Presentational contributor identity chip — coloured Avatar with initials
 * and a full-name Tooltip. Relies on a parent TooltipProvider; does not
 * render its own provider.
 */
export function ContributorChip({
  initials,
  name,
  size = 24,
}: {
  initials: string;
  name: string;
  size?: number;
}) {
  const color = CONTRIBUTOR_COLORS[initials];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar
          className="ring-0 after:hidden"
          style={{ width: size, height: size, backgroundColor: color?.bg }}
        >
          <AvatarFallback
            style={{
              backgroundColor: color?.bg,
              color: color?.fg,
              fontSize: size <= 20 ? "9px" : "11px",
            }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
