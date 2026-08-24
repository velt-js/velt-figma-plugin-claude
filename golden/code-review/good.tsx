// The same component, written so a reviewer can trust it: state on a data-vc-* attribute for CSS to
// read, design values in the stylesheet where the measurement engine can see them, no SDK-namespace
// attribute authored, no residue — and the one dead end it does record cites what was checked.
import { VeltCommentDialogThreadCard } from '@veltdev/react';

// There is no Cancel primitive on this family — grepped manifest/velt-primitives.json and checked
// the component's own inputs before concluding it. Forward a real Escape instead.
export function Good({ comment, commentIndex, selected }) {
  return (
    <div className="vc-row" data-vc-selected={selected ? 'true' : 'false'}>
      <VeltCommentDialogThreadCard commentId={comment.commentId} commentIndex={commentIndex}>
        <span>{comment.text}</span>
      </VeltCommentDialogThreadCard>
    </div>
  );
}
