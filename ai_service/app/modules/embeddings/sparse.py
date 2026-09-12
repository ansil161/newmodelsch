"""Sparse (lexical) vectors, for the keyword half of hybrid search.

WHY THIS EXISTS. Dense embeddings are good at meaning and bad at strings.
"X200", "SKU-4471", "clause 7.3", a person's surname — these carry almost no
semantic signal, so a dense model places them near whatever their surrounding
prose was about. A user asking "what is the warranty on the X200" gets
passages about warranties in general and not the one page that says X200.
Lexical matching is what fixes that, and it is why hybrid retrieval beats
either half alone.

WHY NOT BM25 IN PYTHON, OR SPLADE. Qdrant scores sparse vectors natively and
can apply IDF itself: declare the sparse field with `modifier: idf` and send
plain term-frequency vectors, and the server computes inverse document
frequency across the live collection. That means no corpus statistics to
maintain in this process, no drift between the index and the scorer as
documents are added and removed, and no second neural model to download.
SPLADE would be better still at synonyms — and it is another 500MB model on
the critical path for what the dense retriever already does well.

THE TOKENISER IS PART OF THE INDEX. Documents and queries must be tokenised
identically or nothing matches. Changing anything in this file invalidates
every stored sparse vector and requires a reindex — hence the deliberate lack
of configuration here.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable
from dataclasses import dataclass
from hashlib import blake2b

# Letters, digits, and the punctuation that appears *inside* identifiers.
# "SKU-4471" and "v1.5" must survive as single tokens, which a naive \w+ split
# would destroy — and those are exactly the strings this retriever exists for.
_TOKEN = re.compile(r"[a-z0-9]+(?:[-_./][a-z0-9]+)*")

# A short list, and no longer. Aggressive stopword removal hurts here: "how
# to" and "not" carry real meaning in a support knowledge base, and IDF
# already discounts common words far better than a fixed list can.
_STOPWORDS = frozenset(
    """
    a an and are as at be by for from has have how i in is it its of on or
    that the this to was were what when where which who why will with you
    """.split()
)

_MIN_TOKEN_LENGTH = 2


@dataclass(frozen=True)
class SparseVector:
    """Qdrant's sparse representation: parallel index and value arrays."""

    indices: list[int]
    values: list[float]

    def __len__(self) -> int:
        return len(self.indices)

    @property
    def is_empty(self) -> bool:
        return not self.indices


def tokenize(text: str) -> list[str]:
    """The one tokenisation used for both documents and queries."""
    lowered = text.lower()
    return [
        token
        for token in _TOKEN.findall(lowered)
        if len(token) >= _MIN_TOKEN_LENGTH and token not in _STOPWORDS
    ]


def _term_index(term: str) -> int:
    """Map a term to a stable 32-bit coordinate.

    blake2b rather than Python's `hash()`: the built-in is salted per process,
    so the same document would produce different sparse indices after a
    restart and every stored vector would stop matching.

    Collisions exist — two unrelated terms can land on one coordinate — and
    are tolerable: at 2^32 slots they are rare, and a collision costs a
    slightly wrong score on one term rather than a wrong document.
    """
    digest = blake2b(term.encode("utf-8"), digest_size=4).digest()
    return int.from_bytes(digest, "big")


def encode(text: str) -> SparseVector:
    """Term-frequency vector. Qdrant supplies the IDF half of BM25."""
    counts: dict[str, int] = {}
    for token in tokenize(text):
        counts[token] = counts.get(token, 0) + 1

    if not counts:
        return SparseVector(indices=[], values=[])

    # Sub-linear term frequency, the `1 + log(tf)` of BM25's numerator. A word
    # used forty times is more relevant than one used once, but not forty
    # times more.
    merged: dict[int, float] = {}
    for term, count in counts.items():
        index = _term_index(term)
        # Two terms colliding on one coordinate add, which is the standard
        # behaviour for a hashed feature space.
        merged[index] = merged.get(index, 0.0) + (1.0 + math.log(count))

    indices = sorted(merged)
    return SparseVector(indices=indices, values=[merged[i] for i in indices])


def encode_many(texts: Iterable[str]) -> list[SparseVector]:
    return [encode(text) for text in texts]
