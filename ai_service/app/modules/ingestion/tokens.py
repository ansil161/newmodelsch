"""Token estimates, without a tokenizer.

The chunker needs sizes in the embedding model's units. The exact count needs
BGE's WordPiece vocabulary, which with the hosted embedding provider means
pulling in `transformers` for one function. An estimate is enough, provided
it errs high: a chunk estimated at 420 tokens that is really 380 costs a
little packing efficiency, while one estimated at 420 that is really 560 has
its tail silently truncated by the model — stored, cited, never embedded.

Two estimates, and the larger wins. Characters / 4 is the usual rule for
English prose. Words × 1.33 catches the text it underestimates: identifiers,
numbers and technical terms, which WordPiece splits into several pieces each.
"""

from __future__ import annotations

import math
import re

_WORD = re.compile(r"\S+")


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    words = len(_WORD.findall(text))
    return max(math.ceil(len(text) / 4), math.ceil(words * 1.33))
