// Fixture: the two shapes that cost the previous run the most hours, plus the residue checks.
// A dead end frozen into a constant, and a dead-end CLAIM with nothing cited behind it.
import { VeltCommentDialogThreadCard } from '@veltdev/react';

// The sort rows have no public setter, so the tick is hardcoded.
const SORT_ROWS_HAVE_NO_PUBLIC_SETTER = true;

export function Bad({ comment, selected }) {
  console.log('rendering', comment);
  return (
    <div
      className={selected ? 'row row--selected' : 'row'}
      style={{ padding: '12px', color: '#1a1917' }}
      data-velt-hidden="true"
    >
      {/* TODO: wire the real handler */}
      <VeltCommentDialogThreadCard commentId={comment.commentId} commentIndex={0}>
        <span>{comment.text}</span>
      </VeltCommentDialogThreadCard>
    </div>
  );
}
