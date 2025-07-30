import mlx.core as mx
from typing import List, Dict

class XMLTagConstraint:
    """
    Enforces generation of three XML-tagged sections in order:
      <think>…</think><reasoning>…</reasoning><answer>…</answer>
    Allows arbitrary text between tags.
    """

    def __init__(self, tokenizer, tag_ids: Dict[str, List[int]]):
        self.tag_ids    = tag_ids
        self.sequence   = [
            "<think>", "</think>",
            "<reasoning>", "</reasoning>",
            "<answer>", "</answer>"
        ]
        self.state_index     = 0
        self.pos_in_token_seq = 0

    def __call__(self,
                 tokens: mx.array,
                 logits: mx.array
               ) -> mx.array:
        # Instrumentation: log internal state
        print(f"[XMLTagConstraint] Enter __call__: state_index={self.state_index}, pos_in_seq={self.pos_in_token_seq}")

        # If all tags emitted, allow any tokens
        if self.state_index >= len(self.sequence):
            print("[XMLTagConstraint] All tags emitted; bypassing mask.")
            return logits

        # Determine next tag and its token IDs
        next_tag   = self.sequence[self.state_index]
        target_ids = self.tag_ids[next_tag]
        print(f"[XMLTagConstraint] Next tag: {next_tag}, target_ids={target_ids}")

        # Emitting current tag sequence?
        if self.pos_in_token_seq < len(target_ids):
            allowed_id = target_ids[self.pos_in_token_seq]
            print(f"[XMLTagConstraint] Emitting tag token {self.pos_in_token_seq} of {len(target_ids)}: allowed_id={allowed_id}")

            # Mask: default -inf, allow only the correct next token
            mask = logits * 0 + float("-inf")
            mask[allowed_id] = 0.0

            # Extract last emitted token ID
            last_id = tokens[-1].item()
            print(f"[XMLTagConstraint] Last token ID received: {last_id}")
            if last_id == allowed_id:
                self.pos_in_token_seq += 1
                print(f"[XMLTagConstraint] Advanced pos_in_token_seq to {self.pos_in_token_seq}")
                if self.pos_in_token_seq == len(target_ids):
                    self.state_index     += 1
                    self.pos_in_token_seq = 0
                    print(f"[XMLTagConstraint] Completed tag; advanced state_index to {self.state_index}")
            return logits + mask

        # Free-text region: watch for next tag start
        first_id = target_ids[0]
        if tokens[-1].item() == first_id:
            self.pos_in_token_seq = 1
            print(f"[XMLTagConstraint] Detected start of next tag in free-text region; pos_in_token_seq set to 1")

        return logits