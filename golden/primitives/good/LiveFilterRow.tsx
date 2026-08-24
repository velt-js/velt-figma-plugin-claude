// The same surface, composed the way the corrected harvey build does it.
//
//   the panel is ALWAYS mounted and hidden by CSS off our own data-vc-* attribute (no relocated
//   child is ever unmounted); defaultCondition is passed nowhere it is not read; the status ids are
//   derived from live annotations by status.type; the row anchors commentId AND commentIndex; and
//   the SDK call happens in the handler, never inside the setState updater.
import { useState } from 'react';
import {
  VeltCommentSidebarV2FilterDropdown,
  VeltCommentSidebarV2FilterDropdownContent,
  VeltCommentSidebarV2FilterDropdownContentListItem,
  VeltCommentSidebarV2FilterDropdownContentListItemLabel,
  VeltCommentDialogThreadCard,
} from '@veltdev/react';

// Derived from the live annotation set, split on status.type — 'terminal' is the SDK's own
// discriminator for resolved-like, and it covers a workspace's custom statuses too.
function useStatusIdsByType(annotations) {
  const open = [];
  const terminal = [];
  for (const a of annotations ?? []) {
    const status = a?.status;
    if (!status?.id) continue;
    (status.type === 'terminal' ? terminal : open).push(status.id);
  }
  return { open: [...new Set(open)], terminal: [...new Set(terminal)] };
}

export function LiveFilterRow({ commentElement, comments, annotations }) {
  const [open, setOpen] = useState(false);
  const [toggles, setToggles] = useState({ resolved: false });
  const statusIds = useStatusIdsByType(annotations);

  const toggleResolved = () => {
    const next = { ...toggles, resolved: !toggles.resolved };
    setToggles(next);
    // Every key this menu owns, every call: setCommentSidebarFilters MERGES by key, so a key you
    // omit keeps its previous value instead of clearing.
    commentElement.setCommentSidebarFilters({
      status: next.resolved ? statusIds.terminal : statusIds.open,
      tagged: [],
    });
  };

  return (
    <div className="vc-sidebar-header-filter" data-vc-filter-open={open ? 'true' : 'false'}>
      <VeltCommentSidebarV2FilterDropdown>
        <VeltCommentSidebarV2FilterDropdownContent>
          <div className="vc-filter-panel">
            <VeltCommentSidebarV2FilterDropdownContentListItem>
              <button type="button" onClick={toggleResolved}>
                <VeltCommentSidebarV2FilterDropdownContentListItemLabel>
                  <span>Show resolved comments</span>
                </VeltCommentSidebarV2FilterDropdownContentListItemLabel>
              </button>
            </VeltCommentSidebarV2FilterDropdownContentListItem>
          </div>
        </VeltCommentSidebarV2FilterDropdownContent>
      </VeltCommentSidebarV2FilterDropdown>

      {comments.map((c, commentIndex) => (
        <VeltCommentDialogThreadCard
          key={c.commentId}
          commentId={c.commentId}
          commentIndex={commentIndex}
        >
          <div className="vc-thread-comment" />
        </VeltCommentDialogThreadCard>
      ))}
    </div>
  );
}
