// Reproduces the five defect classes the harvey `strictly primitives` run shipped and a human had to
// find by hand (branch cursor/harvey-primitives-run-4-98f8, commits 39edf95 + 68214b6). Every one of
// them renders correctly, passes a pixel diff, and is wrong.
//
//   P9  the filter panel is toggled by unmounting a RELOCATED child  -> React throws NotFoundError
//   P10 defaultCondition passed to tags whose component never reads it -> documents a gate that is not there
//   P11 the status filter is keyed to CustomFilterService's FALLBACK ids -> empties a configured workspace
//   P12 the row anchors commentId with no commentIndex               -> index-resolving descendants read comment 0
//   P13 setCommentSidebarFilters called inside a setState updater    -> fires twice under StrictMode
import { useState } from 'react';
import {
  VeltCommentSidebarV2FilterDropdown,
  VeltCommentSidebarV2FilterDropdownContent,
  VeltCommentSidebarV2FilterDropdownContentListItem,
  VeltCommentSidebarV2FilterDropdownContentListItemLabel,
  VeltCommentDialogThreadCard,
} from '@veltdev/react';

const RESOLVED_STATUS_ID = 'RESOLVED';
const DEFAULT_STATUS_IDS = ['OPEN', 'IN_PROGRESS'];

export function StaleFilterRow({ commentElement, comments }) {
  const [open, setOpen] = useState(false);
  const [toggles, setToggles] = useState({ resolved: false });

  const toggleResolved = () => {
    setToggles((prev) => {
      const next = { ...prev, resolved: !prev.resolved };
      commentElement.setCommentSidebarFilters({
        status: next.resolved ? [RESOLVED_STATUS_ID] : DEFAULT_STATUS_IDS,
      });
      return next;
    });
  };

  return (
    <div className="vc-sidebar-header-filter">
      <VeltCommentSidebarV2FilterDropdown>
        {open ? (
          <VeltCommentSidebarV2FilterDropdownContent defaultCondition={false}>
            <div className="vc-filter-panel">
              <VeltCommentSidebarV2FilterDropdownContentListItem defaultCondition={false}>
                <button type="button" onClick={toggleResolved}>
                  <VeltCommentSidebarV2FilterDropdownContentListItemLabel defaultCondition={false}>
                    <span>Show resolved comments</span>
                  </VeltCommentSidebarV2FilterDropdownContentListItemLabel>
                </button>
              </VeltCommentSidebarV2FilterDropdownContentListItem>
            </div>
          </VeltCommentSidebarV2FilterDropdownContent>
        ) : null}
      </VeltCommentSidebarV2FilterDropdown>

      {comments.map((c) => (
        <VeltCommentDialogThreadCard key={c.commentId} commentId={c.commentId}>
          <div className="vc-thread-comment" />
        </VeltCommentDialogThreadCard>
      ))}
    </div>
  );
}
