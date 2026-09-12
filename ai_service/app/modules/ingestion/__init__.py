"""Document ingestion: bytes or a URL in, citable chunks out.

    bytes / URL
      → detect the format from what the file claims, checked against what it is
      → parse into structural blocks (headings, paragraphs, lists, tables)
      → clean (encoding debris, page furniture, broken lines)
      → chunk along the structure, carrying page and section with every chunk

Stateless, like the rest of this service. The caller — Django's ingestion
worker — owns the file, the document record and its status; it stores the
chunks returned here and sends them to the indexing endpoint. Splitting
extraction from indexing is what lets the console show "extracting" and
"indexing" as distinct stages, and what lets a re-embed after a model change
skip re-parsing entirely.
"""
